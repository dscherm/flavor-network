"""End-to-end Path B trainer for the v3 chef-curated flavor graph.

Pipeline:
  1. dataset.load_flavor_graph(...) → tensors + vocabularies
  2. FlavorGAT trained for `--epochs` with the hybrid loss from
     `.omc/plans/ralplan-flavor-model-expansion-v3-pathAB.md` §P-B3 (ADR-3):
        total = 0.7 * contrastive + 0.3 * classification
     - contrastive: mean(||z_i - z_j||²) over positive edges
     - classification: cross-entropy on principle label from a small MLP
       head over concat(z[src], z[tgt]); inverse-frequency class weights
     - tradition edges dropped from aux loss by default (ADR-4)
     - annealing safeguard: if clf < 0.1 by epoch 50, downweight 0.5×
  3. UMAP → 3D (random_state=42)
  4. KMeans (random_state=42 per ADR-5)
  5. Post-hoc cluster labels from each cluster's most-common leaves
  6. Emit:
       - public/proDataset/flavor_graph_data.json
       - train/training_log.json
       - train/cluster_labels.json

CLI:
    python train_gnn.py [--csv PATH] [--epochs 300] [--include-tradition]
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import umap
from sklearn.cluster import KMeans

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dataset import load_flavor_graph
from model import FlavorGAT

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CSV = ROOT / "flavor-gnn" / "curation" / "top500_flavor_graph.csv"
PRODATA_DIR = ROOT / "public" / "proDataset"
GRAPH_OUT = PRODATA_DIR / "flavor_graph_data.json"
LOG_OUT = Path(__file__).resolve().parent / "training_log.json"
CLUSTER_LABELS_OUT = Path(__file__).resolve().parent / "cluster_labels.json"

SEED = 42
SCENE_SCALE = 40.0


class EdgeClassifier(nn.Module):
    """Two-layer MLP head over concat(z_src, z_tgt) → principle logits."""
    def __init__(self, embed_dim: int, n_classes: int, hidden: int = 32):
        super().__init__()
        self.fc1 = nn.Linear(2 * embed_dim, hidden)
        self.fc2 = nn.Linear(hidden, n_classes)

    def forward(self, z: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        src, tgt = edge_index
        e = torch.cat([z[src], z[tgt]], dim=1)
        return self.fc2(F.elu(self.fc1(e)))


def derive_edge_labels(
    edge_attr: torch.Tensor, principles: list[str]
) -> tuple[torch.Tensor, torch.Tensor]:
    """argmax multi-hot edge_attr → single class index per edge.

    Returns (class_idx [E], tradition_mask [E]) where mask[i]=True for
    tradition edges (to drop from aux loss per ADR-4).
    """
    class_idx = edge_attr.argmax(dim=1)
    tradition_i = principles.index("tradition") if "tradition" in principles else -1
    tradition_mask = class_idx == tradition_i if tradition_i >= 0 else torch.zeros(
        class_idx.shape[0], dtype=torch.bool
    )
    return class_idx, tradition_mask


def class_weights_from(
    class_idx: torch.Tensor, n_classes: int, mask: torch.Tensor
) -> torch.Tensor:
    keep = class_idx[mask]
    counts = torch.bincount(keep, minlength=n_classes).float()
    counts = counts.clamp(min=1.0)
    weights = counts.sum() / (n_classes * counts)
    return weights


def label_clusters_by_leaves(
    cluster_ids: np.ndarray, leaves_per_node: list[list[str]], k: int = 3
) -> dict[int, str]:
    out: dict[int, str] = {}
    for c in sorted(set(cluster_ids.tolist())):
        bag: Counter[str] = Counter()
        for i, cid in enumerate(cluster_ids):
            if cid == c:
                bag.update(leaves_per_node[i])
        if bag:
            top = [tok for tok, _ in bag.most_common(k)]
            out[int(c)] = "-".join(top)
        else:
            out[int(c)] = f"cluster-{c}"
    return out


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    p.add_argument("--epochs", type=int, default=300)
    p.add_argument("--lr", type=float, default=0.01)
    p.add_argument("--n-clusters", type=int, default=8)
    p.add_argument("--include-tradition", action="store_true",
                   help="Include tradition edges in the auxiliary classification loss")
    p.add_argument("--graph-out", type=Path, default=GRAPH_OUT)
    p.add_argument("--log-out", type=Path, default=LOG_OUT)
    p.add_argument("--cluster-labels-out", type=Path, default=CLUSTER_LABELS_OUT)
    p.add_argument("--embeddings-out", type=Path, default=None,
                   help="If set, np.save the full embedding matrix here (float32)")
    p.add_argument("--no-require-leaves", dest="require_leaves",
                   action="store_false", default=True,
                   help="Keep rows with empty leaves (V3 corpus-wide mode)")
    p.add_argument("--extra-edges", type=Path, default=None,
                   help="Optional pairings JSON; topology-only edges supplement chef principles (V3 mode)")
    p.add_argument("--extra-edges-strength", type=float, default=0.0,
                   help="Min pairings.strength threshold for --extra-edges (filters dense topology)")
    p.add_argument("--clf-weight", type=float, default=0.3,
                   help="Weight of the aux classification loss in the hybrid total (contrastive + clf)")
    args = p.parse_args(argv)

    torch.manual_seed(SEED)
    np.random.seed(SEED)

    print(f"[train_gnn] loading {args.csv}")
    data = load_flavor_graph(
        args.csv,
        require_leaves=args.require_leaves,
        extra_edges_path=args.extra_edges,
        extra_edges_min_strength=args.extra_edges_strength,
    )
    n_nodes = data.node_features.shape[0]
    n_edges = data.edge_index.shape[1]
    principles = data.vocabularies["principles"]
    n_classes = len(principles)
    print(f"[train_gnn] N={n_nodes} E={n_edges} principles={n_classes} "
          f"node_dim={data.node_features.shape[1]}")

    if n_edges == 0:
        print("[train_gnn] no edges — aborting")
        return 1

    class_idx, tradition_mask = derive_edge_labels(data.edge_attr, principles)
    # V3 corpus-wide mode adds topology-only edges (edge_attr all zeros)
    # via --extra-edges. Those edges must NOT contribute to the aux
    # classification loss; argmax on a zero vector picks class 0 and
    # would poison the head with false positives.
    has_principle_mask = data.edge_attr.sum(dim=1) > 0
    if args.include_tradition:
        aux_mask = has_principle_mask.clone()
    else:
        aux_mask = has_principle_mask & ~tradition_mask
    n_aux = int(aux_mask.sum().item())
    print(f"[train_gnn] aux-loss edges: {n_aux}/{n_edges} (tradition dropped: "
          f"{int(tradition_mask.sum().item())}, topology-only: "
          f"{int((~has_principle_mask).sum().item())})")

    weights = class_weights_from(class_idx, n_classes, aux_mask)
    print(f"[train_gnn] class weights: " + ", ".join(
        f"{p}={w:.2f}" for p, w in zip(principles, weights.tolist())
    ))

    model = FlavorGAT(node_in=data.node_features.shape[1], edge_in=n_classes)
    classifier = EdgeClassifier(embed_dim=16, n_classes=n_classes)
    optimizer = torch.optim.Adam(
        list(model.parameters()) + list(classifier.parameters()), lr=args.lr,
    )

    clf_weight = args.clf_weight
    annealed = False
    log: list[dict] = []

    print(f"[train_gnn] training {args.epochs} epochs (hybrid 0.7 contrastive + {clf_weight} clf)")
    for epoch in range(args.epochs):
        model.train()
        classifier.train()
        optimizer.zero_grad()
        z = model(data.node_features, data.edge_index, data.edge_attr)
        src, tgt = data.edge_index
        contrastive = (z[src] - z[tgt]).pow(2).sum(dim=1).mean()

        if n_aux > 0:
            logits = classifier(z, data.edge_index)
            clf = F.cross_entropy(
                logits[aux_mask], class_idx[aux_mask], weight=weights
            )
        else:
            clf = torch.tensor(0.0)

        total = 0.7 * contrastive + clf_weight * clf
        total.backward()
        optimizer.step()

        log.append({
            "epoch": epoch,
            "contrastive": float(contrastive.item()),
            "classification": float(clf.item()),
            "total": float(total.item()),
            "clf_weight": clf_weight,
        })

        if (epoch == 50) and (not annealed) and (clf.item() < 0.1):
            clf_weight *= 0.5
            annealed = True
            print(f"[train_gnn] WARN epoch 50 clf={clf.item():.4f} <0.1 — "
                  f"downweighting classification by 0.5× → {clf_weight}")

        if epoch % 50 == 0 or epoch == args.epochs - 1:
            print(f"  epoch {epoch:3d} | contrastive={contrastive.item():.4f} "
                  f"| clf={clf.item():.4f} | total={total.item():.4f}")

    model.eval()
    classifier.eval()
    with torch.no_grad():
        full_emb = model(data.node_features, data.edge_index, data.edge_attr).numpy()
        clf_acc = None
        if n_aux > 0:
            logits = classifier(
                model(data.node_features, data.edge_index, data.edge_attr),
                data.edge_index,
            )
            preds = logits[aux_mask].argmax(dim=1)
            clf_acc = float((preds == class_idx[aux_mask]).float().mean().item())
            print(f"[train_gnn] final aux classification accuracy: {clf_acc:.3f}")

    print(f"[train_gnn] UMAP → 3D (random_state={SEED})")
    reducer = umap.UMAP(n_components=3, n_neighbors=15, min_dist=0.1, random_state=SEED)
    coords3d = reducer.fit_transform(full_emb)
    coords3d = (coords3d - coords3d.mean(0)) / (coords3d.std(0) + 1e-8)

    n_clusters = min(args.n_clusters, n_nodes)
    print(f"[train_gnn] KMeans k={n_clusters} (random_state={SEED})")
    km = KMeans(n_clusters=n_clusters, random_state=SEED, n_init=10)
    cluster_ids = km.fit_predict(full_emb)

    idx_to_name = {v: k for k, v in data.name_to_idx.items()}
    leaves_vocab = data.vocabularies["leaves"]
    tier1_vocab = data.vocabularies["tier1"]
    tier2_vocab = data.vocabularies["tier2"]
    tier3_vocab = data.vocabularies["tier3"]

    leaves_per_node: list[list[str]] = []
    tier1_per_node: list[list[str]] = []
    tier2_per_node: list[list[str]] = []
    tier3_per_node: list[list[str]] = []
    feat = data.node_features.numpy()
    t1_n, t2_n, t3_n, lv_n = len(tier1_vocab), len(tier2_vocab), len(tier3_vocab), len(leaves_vocab)
    t1_off = 0
    t2_off = t1_n
    t3_off = t1_n + t2_n
    lv_off = t1_n + t2_n + t3_n
    for i in range(n_nodes):
        tier1_per_node.append([tier1_vocab[j] for j in range(t1_n) if feat[i, t1_off + j] > 0.5])
        tier2_per_node.append([tier2_vocab[j] for j in range(t2_n) if feat[i, t2_off + j] > 0.5])
        tier3_per_node.append([tier3_vocab[j] for j in range(t3_n) if feat[i, t3_off + j] > 0.5])
        leaves_per_node.append([leaves_vocab[j] for j in range(lv_n) if feat[i, lv_off + j] > 0.5])

    cluster_labels = label_clusters_by_leaves(cluster_ids, leaves_per_node)

    nodes_out = []
    for i in range(n_nodes):
        nodes_out.append({
            "name": idx_to_name[i],
            "x": round(float(coords3d[i, 0]) * SCENE_SCALE, 4),
            "y": round(float(coords3d[i, 1]) * SCENE_SCALE, 4),
            "z": round(float(coords3d[i, 2]) * SCENE_SCALE, 4),
            "embedding": [round(float(v), 4) for v in full_emb[i]],
            "cluster": int(cluster_ids[i]),
            "tier1": tier1_per_node[i],
            "tier2": tier2_per_node[i],
            "tier3": tier3_per_node[i],
            "leaves": leaves_per_node[i],
        })

    edges_out = []
    edge_attr_np = data.edge_attr.numpy()
    for ei in range(n_edges):
        s = int(data.edge_index[0, ei].item())
        t = int(data.edge_index[1, ei].item())
        active = [principles[k] for k in range(n_classes) if edge_attr_np[ei, k] > 0.5]
        edges_out.append({
            "source": idx_to_name[s],
            "target": idx_to_name[t],
            "principle": active[0] if len(active) == 1 else None,
            "principles": active,
        })

    centroids = km.cluster_centers_.tolist()
    clusters_out = [
        {"id": c, "label": cluster_labels[c],
         "centroid": [round(float(v), 4) for v in centroids[c]]}
        for c in range(n_clusters)
    ]

    meta = {
        "n_nodes": n_nodes,
        "n_edges": n_edges,
        "principle_vocab": principles,
        "tier1_vocabulary": tier1_vocab,
        "tier2_vocabulary": tier2_vocab,
        "tier3_vocabulary": tier3_vocab,
        "leaves_vocabulary": leaves_vocab,
        "trained_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "tradition_dropped_from_aux_loss": not args.include_tradition,
        "epochs": args.epochs,
        "final_aux_classification_accuracy": clf_acc,
        "annealed": annealed,
        "seed": SEED,
        "scene_scale": SCENE_SCALE,
        "dataset_stats": data.stats,
    }

    args.graph_out.parent.mkdir(parents=True, exist_ok=True)
    args.graph_out.write_text(
        json.dumps({"nodes": nodes_out, "edges": edges_out, "clusters": clusters_out, "_meta": meta}),
        encoding="utf-8",
    )
    print(f"[train_gnn] wrote {args.graph_out}")

    args.log_out.parent.mkdir(parents=True, exist_ok=True)
    args.log_out.write_text(json.dumps(log, indent=2), encoding="utf-8")
    print(f"[train_gnn] wrote {args.log_out}")

    args.cluster_labels_out.parent.mkdir(parents=True, exist_ok=True)
    args.cluster_labels_out.write_text(
        json.dumps({str(k): v for k, v in cluster_labels.items()}, indent=2),
        encoding="utf-8",
    )
    print(f"[train_gnn] wrote {args.cluster_labels_out}")

    if args.embeddings_out is not None:
        args.embeddings_out.parent.mkdir(parents=True, exist_ok=True)
        np.save(args.embeddings_out, full_emb.astype(np.float32))
        print(f"[train_gnn] wrote {args.embeddings_out} (shape={full_emb.shape}, float32)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
