"""flavor_gnn_layout.py — train a flavor-profile GNN, then UMAP + cluster.

Alternative to flavor_profile_layout.py (which is encoding + UMAP only).
This trains a Graph Attention Network on tier-similarity edges with
multi-label aux supervision on tier1 / tier2 / tier3 / category, then
uses the learned embeddings for the UMAP + KMeans layout.

Key differences from flavor_profile_layout.py:
  - Graph structure: edges from Jaccard similarity over tier tokens
    (top-K nearest per node, K=15)
  - Learned 32-dim embeddings via GAT message passing → higher-order
    similarity (mint learns from rosemary via basil)
  - Aux supervision on all 4 chef-curated fields — 100% node coverage
    (vs ~5% in the original V3 GAT trained on pairing principles)
  - Outputs land in *_v3_gnn.json* file names so the chef can A/B
    them against the encoded version via a runtime flag

Pipeline:
  1. Read flavor_graph_full.csv + ingredients.json.
  2. Build per-node feature vector (same as flavor_profile_layout)
     for the GAT's input node-features.
  3. Build edges from tier Jaccard sim, keep top-K=15 per node.
  4. Train PyG GAT for 200 epochs:
       node embedding → 4 classifier heads (T1, T2, T3, category)
       loss = BCE over all 4 heads, masked by feature presence.
  5. Extract embeddings, UMAP to 3D/2D, KMeans k=16.
  6. Write *_v3_gnn.json triplet.

Usage:
    python flavor-gnn/scripts/flavor_gnn_layout.py [--k 16] [--epochs 200] [--top-k-edges 15]
"""
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import umap
from sklearn.cluster import KMeans
from torch_geometric.data import Data
from torch_geometric.nn import GATv2Conv

ROOT = Path(__file__).resolve().parents[2]

CSV_PATH = ROOT / "flavor-gnn" / "curation" / "flavor_graph_full.csv"
INGREDIENTS_PATH = ROOT / "public" / "proDataset" / "ingredients.json"
OUT_POS_3D = ROOT / "public" / "proDataset" / "flavor_positions_v3_gnn.json"
OUT_POS_2D = ROOT / "public" / "proDataset" / "flavor_positions_2d_v3_gnn.json"
OUT_CLUSTERS = ROOT / "public" / "proDataset" / "cluster_labels_v3_gnn.json"
OUT_EMB = ROOT / "flavor-gnn" / "artifacts" / "flavor_embeddings_v3_gnn.npy"

SEED = 42
UMAP_MIN_DIST = 0.25  # 0.55 too spread, 0.1 piled up — middle keeps within-cluster breathing room
UMAP_N_NEIGHBORS = 12
SCENE_SCALE = 10.0
SUPERVISED_UMAP = True
TARGET_WEIGHT = 0.5   # 0.95 collapsed clusters to single points (92% overlap)
                      # 0.5 (default) preserves within-cluster structure while
                      # still pulling same-cluster points together
POST_JITTER = 0.4     # final per-name deterministic offset to break exact overlaps

EMB_DIM = 32
HIDDEN_DIM = 64
N_HEADS = 4
N_LAYERS = 2
LEARNING_RATE = 1e-3
WEIGHT_DECAY = 1e-5

LABEL_TOP_N = 3
LABEL_MIN_SHARE = 0.25
LABEL_MIN_LIFT = 1.3


def split_pipe(s):
    if not isinstance(s, str) or not s.strip():
        return []
    return [t.strip().lower() for t in s.split("|") if t.strip()]


def build_vocab(values, min_support=1):
    c = Counter()
    for tokens in values:
        for t in set(tokens):
            c[t] += 1
    return [tok for tok, n in c.most_common() if n >= min_support]


def multihot(tokens, vocab_idx):
    v = np.zeros(len(vocab_idx), dtype=np.float32)
    for t in tokens:
        if t in vocab_idx:
            v[vocab_idx[t]] = 1.0
    return v


def jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    if inter == 0:
        return 0.0
    return inter / len(a | b)


class FlavorGAT(nn.Module):
    def __init__(self, in_dim, hidden, emb_dim, n_heads, n_layers,
                 head_dims: list[int]):
        super().__init__()
        self.conv1 = GATv2Conv(in_dim, hidden, heads=n_heads, dropout=0.1)
        self.conv2 = GATv2Conv(hidden * n_heads, emb_dim, heads=1, dropout=0.1)
        self.heads = nn.ModuleList([nn.Linear(emb_dim, d) for d in head_dims])

    def forward(self, x, edge_index, edge_weight=None):
        h = self.conv1(x, edge_index)
        h = F.elu(h)
        h = self.conv2(h, edge_index)
        z = F.normalize(h, p=2, dim=1)
        logits = [head(z) for head in self.heads]
        return z, logits


def main(k_clusters: int, epochs: int, top_k_edges: int,
         max_cluster_size: int = 0) -> None:
    torch.manual_seed(SEED)
    np.random.seed(SEED)

    # ── Load ───────────────────────────────────────────────────────
    names = []
    tier1s = []
    tier2s = []
    tier3s = []
    leavess = []
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            n = (r.get("name") or "").strip()
            if not n:
                continue
            names.append(n)
            tier1s.append(split_pipe(r.get("tier1_aroma")))
            tier2s.append(split_pipe(r.get("tier2_taste")))
            tier3s.append(split_pipe(r.get("tier3_mouthfeel")))
            leavess.append(split_pipe(r.get("leaves")))
    n_nodes = len(names)
    print(f"[gnn-layout] loaded {n_nodes} ingredients from CSV")

    ing_data = json.loads(INGREDIENTS_PATH.read_text(encoding="utf-8"))
    categories = []
    tastes = []
    for n in names:
        info = ing_data.get(n) if isinstance(ing_data, dict) else None
        if isinstance(info, dict):
            cat = info.get("category")
            categories.append([cat.lower()] if isinstance(cat, str) and cat else [])
            tt = info.get("taste")
            if isinstance(tt, str) and tt:
                tastes.append([t.strip().lower() for t in tt.split() if t.strip()])
            else:
                tastes.append([])
        else:
            categories.append([])
            tastes.append([])

    # ── Vocabularies ───────────────────────────────────────────────
    v1 = build_vocab(tier1s, min_support=3)
    v2 = build_vocab(tier2s, min_support=3)
    v3 = build_vocab(tier3s, min_support=5)
    v_leaves = build_vocab(leavess, min_support=3)[:80]
    v_cat = build_vocab(categories, min_support=3)
    v_taste = build_vocab(tastes, min_support=3)
    idx1 = {t: i for i, t in enumerate(v1)}
    idx2 = {t: i for i, t in enumerate(v2)}
    idx3 = {t: i for i, t in enumerate(v3)}
    idxL = {t: i for i, t in enumerate(v_leaves)}
    idxC = {t: i for i, t in enumerate(v_cat)}
    idxT = {t: i for i, t in enumerate(v_taste)}
    print(f"[gnn-layout] vocabs: T1={len(v1)}, T2={len(v2)}, T3={len(v3)}, "
          f"leaves={len(v_leaves)}, cat={len(v_cat)}, taste={len(v_taste)}")

    # ── Node features ──────────────────────────────────────────────
    def feat_vec(i):
        return np.concatenate([
            multihot(tier1s[i], idx1),
            multihot(tier2s[i], idx2),
            multihot(tier3s[i], idx3),
            multihot(leavess[i], idxL),
            multihot(categories[i], idxC),
            multihot(tastes[i], idxT),
        ])
    X = np.stack([feat_vec(i) for i in range(n_nodes)]).astype(np.float32)
    print(f"[gnn-layout] node-feature matrix: {X.shape}")

    # ── Build edges via top-K Jaccard over tier+category tokens ────
    # Token bag = tier1+tier2+tier3+category (no leaves, which are too noisy)
    bags = [set(tier1s[i]) | set(tier2s[i]) | set(tier3s[i]) | set(categories[i])
            for i in range(n_nodes)]
    # Group nodes by token to find candidate neighbors quickly
    token_to_nodes = defaultdict(set)
    for i, b in enumerate(bags):
        for t in b:
            token_to_nodes[t].add(i)

    edge_set = set()
    edges_with_weight = []
    for i in range(n_nodes):
        if not bags[i]:
            continue
        candidates = set()
        for t in bags[i]:
            candidates |= token_to_nodes[t]
        candidates.discard(i)
        if not candidates:
            continue
        scored = [(j, jaccard(bags[i], bags[j])) for j in candidates]
        scored.sort(key=lambda x: -x[1])
        for j, w in scored[:top_k_edges]:
            if w < 0.1:
                break
            key = (min(i, j), max(i, j))
            if key in edge_set:
                continue
            edge_set.add(key)
            edges_with_weight.append((i, j, w))
            edges_with_weight.append((j, i, w))

    if not edges_with_weight:
        raise SystemExit("no edges built — check tier coverage in CSV")
    src = torch.tensor([e[0] for e in edges_with_weight], dtype=torch.long)
    dst = torch.tensor([e[1] for e in edges_with_weight], dtype=torch.long)
    edge_index = torch.stack([src, dst], dim=0)
    edge_weight = torch.tensor([e[2] for e in edges_with_weight], dtype=torch.float32)
    print(f"[gnn-layout] graph: {n_nodes} nodes, {len(edge_set)} undirected edges "
          f"(top-{top_k_edges} per node, Jaccard >= 0.1)")

    # ── Multi-label aux targets ────────────────────────────────────
    def to_target(per_node_tokens, idx_map):
        Y = np.zeros((n_nodes, len(idx_map)), dtype=np.float32)
        mask = np.zeros(n_nodes, dtype=np.float32)
        for i, toks in enumerate(per_node_tokens):
            if toks:
                mask[i] = 1.0
                for t in toks:
                    if t in idx_map:
                        Y[i, idx_map[t]] = 1.0
        return Y, mask
    Y1, M1 = to_target(tier1s, idx1)
    Y2, M2 = to_target(tier2s, idx2)
    Y3, M3 = to_target(tier3s, idx3)
    YC, MC = to_target(categories, idxC)
    print(f"[gnn-layout] aux supervision coverage: T1={int(M1.sum())}, "
          f"T2={int(M2.sum())}, T3={int(M3.sum())}, category={int(MC.sum())} "
          f"of {n_nodes}")

    Y1_t = torch.tensor(Y1); M1_t = torch.tensor(M1)
    Y2_t = torch.tensor(Y2); M2_t = torch.tensor(M2)
    Y3_t = torch.tensor(Y3); M3_t = torch.tensor(M3)
    YC_t = torch.tensor(YC); MC_t = torch.tensor(MC)

    x_t = torch.tensor(X)
    data = Data(x=x_t, edge_index=edge_index, edge_attr=edge_weight)

    # ── Train ──────────────────────────────────────────────────────
    head_dims = [Y1.shape[1], Y2.shape[1], Y3.shape[1], YC.shape[1]]
    model = FlavorGAT(in_dim=X.shape[1], hidden=HIDDEN_DIM, emb_dim=EMB_DIM,
                      n_heads=N_HEADS, n_layers=N_LAYERS, head_dims=head_dims)
    opt = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY)
    bce = nn.BCEWithLogitsLoss(reduction="none")
    print(f"[gnn-layout] training GAT for {epochs} epochs "
          f"(emb_dim={EMB_DIM}, hidden={HIDDEN_DIM}, heads={N_HEADS}) on CPU...")
    model.train()
    for epoch in range(epochs):
        opt.zero_grad()
        z, logits = model(data.x, data.edge_index)
        l1 = (bce(logits[0], Y1_t) * M1_t.unsqueeze(1)).sum() / max(M1_t.sum() * Y1.shape[1], 1)
        l2 = (bce(logits[1], Y2_t) * M2_t.unsqueeze(1)).sum() / max(M2_t.sum() * Y2.shape[1], 1)
        l3 = (bce(logits[2], Y3_t) * M3_t.unsqueeze(1)).sum() / max(M3_t.sum() * Y3.shape[1], 1)
        lc = (bce(logits[3], YC_t) * MC_t.unsqueeze(1)).sum() / max(MC_t.sum() * YC.shape[1], 1)
        loss = l1 + l2 + l3 + lc
        loss.backward()
        opt.step()
        if epoch % 25 == 0 or epoch == epochs - 1:
            print(f"  epoch {epoch:>3d}  T1={l1.item():.3f} T2={l2.item():.3f} "
                  f"T3={l3.item():.3f} cat={lc.item():.3f} total={loss.item():.3f}")

    # ── Extract embeddings ─────────────────────────────────────────
    model.eval()
    with torch.no_grad():
        z, _ = model(data.x, data.edge_index)
    emb = z.cpu().numpy().astype(np.float32)
    OUT_EMB.parent.mkdir(parents=True, exist_ok=True)
    np.save(OUT_EMB, emb)
    print(f"[gnn-layout] wrote {OUT_EMB.relative_to(ROOT)} shape={emb.shape}")

    # ── KMeans first (so UMAP can use the labels as supervision) ───
    print(f"[gnn-layout] KMeans k={k_clusters} on 32-dim embeddings (before UMAP)")
    km = KMeans(n_clusters=k_clusters, random_state=SEED, n_init=10)
    cluster_ids = km.fit_predict(emb)

    # ── Bisect mega-clusters via per-cluster KMeans on the embeddings ─
    # Same idea as flavor_layout_v3._split_large_clusters: any cluster
    # above max_cluster_size gets recursively k-mean'd into chunks of
    # ~max_size each. Sub-clusters get new monotonically-increasing IDs.
    # Must run BEFORE supervised UMAP so the final cluster_ids feed in.
    if max_cluster_size > 0:
        before_n = len(set(cluster_ids.tolist()))
        next_id = int(cluster_ids.max()) + 1
        splits = 0
        for cid in sorted(set(cluster_ids.tolist())):
            mask = cluster_ids == cid
            size = int(mask.sum())
            if size <= max_cluster_size:
                continue
            k_sub = int(np.ceil(size / max_cluster_size))
            if k_sub < 2:
                continue
            member_idxs = np.where(mask)[0]
            sub_km = KMeans(n_clusters=k_sub, random_state=SEED, n_init=10)
            sub_labels = sub_km.fit_predict(emb[member_idxs])
            for sub_i in range(1, k_sub):
                cluster_ids[member_idxs[sub_labels == sub_i]] = next_id
                next_id += 1
            splits += k_sub - 1
        after_n = len(set(cluster_ids.tolist()))
        print(f"[gnn-layout] mega-split: {before_n} -> {after_n} clusters "
              f"(+{splits} sub-clusters at max_size={max_cluster_size})")

    # ── Supervised UMAP — pulls same-cluster points together ───────
    umap_y = cluster_ids if SUPERVISED_UMAP else None
    print(f"[gnn-layout] UMAP → 3D + 2D  "
          f"(min_dist={UMAP_MIN_DIST}, supervised={SUPERVISED_UMAP})")
    reducer_3d = umap.UMAP(n_components=3, n_neighbors=UMAP_N_NEIGHBORS,
                           min_dist=UMAP_MIN_DIST, metric="cosine",
                           target_metric="categorical", target_weight=TARGET_WEIGHT,
                           random_state=SEED)
    coords_3d = reducer_3d.fit_transform(emb, y=umap_y)
    coords_3d = (coords_3d - coords_3d.mean(0)) / (coords_3d.std(0) + 1e-8)
    coords_3d *= SCENE_SCALE
    reducer_2d = umap.UMAP(n_components=2, n_neighbors=UMAP_N_NEIGHBORS,
                           min_dist=UMAP_MIN_DIST, metric="cosine",
                           target_metric="categorical", target_weight=TARGET_WEIGHT,
                           random_state=SEED)
    coords_2d = reducer_2d.fit_transform(emb, y=umap_y)
    coords_2d = (coords_2d - coords_2d.mean(0)) / (coords_2d.std(0) + 1e-8)
    coords_2d *= SCENE_SCALE

    # ── Post-jitter — break exact-position overlaps via deterministic offsets ──
    # Even with min_dist=0.25 + target_weight=0.5, some same-cluster points
    # collapse to identical coordinates. Apply a stable per-name offset so
    # every node has a unique location (within visible tolerance).
    import hashlib as _hashlib
    for i, n in enumerate(names):
        h = _hashlib.sha1(n.encode('utf-8')).digest()
        off3 = [(h[k] - 128) / 128.0 * POST_JITTER for k in range(3)]
        off2 = [(h[k] - 128) / 128.0 * POST_JITTER for k in range(2)]
        coords_3d[i] += off3
        coords_2d[i] += off2

    # ── Cluster labels (lift on tier + category tokens) ────────────
    cluster_members = defaultdict(list)
    for i, c in enumerate(cluster_ids.tolist()):
        cluster_members[int(c)].append(i)

    corpus_share = {}
    for vocab, getter in (
        (v1, lambda i: tier1s[i]),
        (v2, lambda i: tier2s[i]),
        (v3, lambda i: tier3s[i]),
        (v_cat, lambda i: categories[i]),
    ):
        for tok in vocab:
            corpus_share[tok] = sum(1 for i in range(n_nodes) if tok in set(getter(i))) / n_nodes

    cluster_labels = {}
    cluster_sizes = {}
    cluster_centroids = {}
    for cid in sorted(cluster_members):
        members = cluster_members[cid]
        cluster_sizes[cid] = len(members)
        cluster_centroids[cid] = [round(float(v), 4) for v in coords_3d[members].mean(axis=0)]
        cat_c, tier_c = [], []
        for vocab, getter, bucket in (
            (v1, lambda i: tier1s[i], tier_c),
            (v2, lambda i: tier2s[i], tier_c),
            (v3, lambda i: tier3s[i], tier_c),
            (v_cat, lambda i: categories[i], cat_c),
        ):
            for tok in vocab:
                in_c = sum(1 for i in members if tok in set(getter(i)))
                if in_c == 0:
                    continue
                cs = in_c / len(members)
                if cs < LABEL_MIN_SHARE:
                    continue
                lift = cs / max(corpus_share.get(tok, 1e-6), 1e-6)
                if lift < LABEL_MIN_LIFT:
                    continue
                bucket.append((tok, lift))
        cat_c.sort(key=lambda c: -c[1])
        tier_c.sort(key=lambda c: -c[1])
        top_cat = [t for t, _ in cat_c[:2]]
        top_tier = [t for t, _ in tier_c[:2]]
        parts = top_cat + [t for t in top_tier if t not in top_cat]
        cluster_labels[cid] = "-".join(parts[:LABEL_TOP_N]) if parts else f"cluster-{cid}"

    print(f"[gnn-layout] {k_clusters} clusters:")
    for cid in sorted(cluster_sizes):
        print(f"  c{cid:>2} ({cluster_sizes[cid]:>4})  {cluster_labels[cid]}")

    # ── Write outputs ──────────────────────────────────────────────
    pos_3d = {names[i]: [round(float(v), 4) for v in coords_3d[i]] for i in range(n_nodes)}
    pos_2d = {names[i]: [round(float(v), 4) for v in coords_2d[i]] for i in range(n_nodes)}
    OUT_POS_3D.write_text(json.dumps(pos_3d, separators=(",", ":")), encoding="utf-8")
    OUT_POS_2D.write_text(json.dumps(pos_2d, separators=(",", ":")), encoding="utf-8")

    clusters_arr = []
    for cid in sorted(cluster_sizes):
        clusters_arr.append({
            "id": cid,
            "label": cluster_labels[cid],
            "chemistry_label": cluster_labels[cid],
            "size": cluster_sizes[cid],
            "dense_core_size": cluster_sizes[cid],
            "centroid_3d": cluster_centroids[cid],
        })
    cluster_data = {
        "k": k_clusters,
        "clusters": clusters_arr,
        "ingredients": {names[i]: int(cluster_ids[i]) for i in range(n_nodes)},
        "_meta": {
            "source": "flavor_gnn_layout",
            "emb_dim": EMB_DIM,
            "hidden": HIDDEN_DIM,
            "heads": N_HEADS,
            "epochs": epochs,
            "top_k_edges": top_k_edges,
            "umap": {"n_neighbors": UMAP_N_NEIGHBORS, "min_dist": UMAP_MIN_DIST,
                     "metric": "cosine", "seed": SEED},
            "kmeans": {"k": k_clusters, "seed": SEED},
        },
    }
    OUT_CLUSTERS.write_text(json.dumps(cluster_data, separators=(",", ":")), encoding="utf-8")
    print(f"[gnn-layout] wrote {OUT_POS_3D.relative_to(ROOT)}")
    print(f"[gnn-layout] wrote {OUT_POS_2D.relative_to(ROOT)}")
    print(f"[gnn-layout] wrote {OUT_CLUSTERS.relative_to(ROOT)}")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--k", type=int, default=16)
    p.add_argument("--epochs", type=int, default=200)
    p.add_argument("--top-k-edges", type=int, default=15)
    p.add_argument("--max-cluster-size", type=int, default=0,
                   help="If > 0, bisect any cluster above this size via per-cluster KMeans.")
    args = p.parse_args()
    main(k_clusters=args.k, epochs=args.epochs, top_k_edges=args.top_k_edges,
         max_cluster_size=args.max_cluster_size)
