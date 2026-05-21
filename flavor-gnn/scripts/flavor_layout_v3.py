"""flavor_layout_v3.py — UMAP 3D/2D + KMeans + cluster labeling from V3c embeddings.

Final compute step in the corpus-wide V3 chain. Reads the imputed
embedding matrix from V3c, projects to 3D and 2D for the network
scene, runs KMeans with silhouette-based auto-elbow over k ∈ [8,16]
(prefers k=12 when within 0.02 of the elbow), and labels each cluster
with lift-scored leaves so common-corpus tags like "alcoholic" and
"ethereal" don't dominate every label.

Inputs
------
- flavor-gnn/artifacts/flavor_embeddings_v3_imputed.npy   (3,390 × 16)
- public/proDataset/flavor_graph_data_v3.json             (name ordering)
- flavor-gnn/curation/flavor_graph_full.csv               (leaves per node)

Outputs
-------
- public/proDataset/flavor_positions_v3.json              ({name: [x,y,z]})
- public/proDataset/flavor_positions_2d_v3.json           ({name: [x,y]})
- public/proDataset/cluster_labels_v3.json                ({
    "ingredients": {name: cluster_id},
    "clusters": {cluster_id: label},
    "_meta": {k, k_silhouette, k_grid_silhouettes, ...}
  })

Locked behavior (per N+1 v3 plan):
- UMAP min_dist=0.45 (matches flavor_layout_v2 visual style)
- KMeans seed=42
- Auto-elbow over k ∈ [8,16] by silhouette; if k=12 silhouette is
  within 0.02 of the max, prefer 12 (avoids over-fragmenting the network)
- Cluster labels via lift = cluster_share / corpus_share, with a
  min-support requirement and a corpus-dominance blocklist
"""
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import umap
from sklearn.cluster import HDBSCAN, KMeans
from sklearn.metrics import silhouette_score

ROOT = Path(__file__).resolve().parents[2]

EMB_PATH = ROOT / "flavor-gnn" / "artifacts" / "flavor_embeddings_v3_imputed.npy"
GRAPH_V3 = ROOT / "public" / "proDataset" / "flavor_graph_data_v3.json"
CSV_PATH = ROOT / "flavor-gnn" / "curation" / "flavor_graph_full.csv"
CHEF_LABELS_PATH = ROOT / "flavor-gnn" / "curation" / "v3_cluster_labels_chef.json"

OUT_POS_3D = ROOT / "public" / "proDataset" / "flavor_positions_v3.json"
OUT_POS_2D = ROOT / "public" / "proDataset" / "flavor_positions_2d_v3.json"
OUT_CLUSTERS = ROOT / "public" / "proDataset" / "cluster_labels_v3.json"

SEED = 42
UMAP_MIN_DIST = 0.45
UMAP_N_NEIGHBORS = 15
SCENE_SCALE = 10.0
KMEANS_K_GRID = list(range(8, 17))
K_PREFERRED = 12
K_PREFER_BAND = 0.02

# Leaves that appear in >50% of nodes are too common to discriminate
# clusters; blocklist them from labeling. (corpus-wide counts derived
# from flavor_graph_full.csv at V3a output: alcoholic 70%, ethereal 69%)
LABEL_BLOCKLIST = frozenset({"alcoholic", "ethereal"})

# A leaf must appear in at least this many cluster members to be a
# candidate for that cluster's label.
MIN_LEAF_SUPPORT = 3

# A leaf's lift (cluster_share / corpus_share) must exceed this to be
# a candidate. 1.5× = at least 50% over-represented vs corpus.
MIN_LIFT = 1.5


def _split_pipe(s: object) -> list[str]:
    if not isinstance(s, str):
        return []
    return [t.strip() for t in s.split("|") if t.strip()]


def _cluster_hdbscan(
    emb: np.ndarray,
    min_cluster_size: int,
    reassign_noise: bool = True,
) -> tuple[np.ndarray, dict]:
    """HDBSCAN clustering with optional noise-point reassignment.

    HDBSCAN labels outlier points as -1 (noise). When reassign_noise=True
    (default) we assign each noise point to its nearest cluster centroid
    so every node has a numeric cluster id. When False, noise stays -1
    and the renderer should treat those points as "uncolored / low
    confidence" (V3e Option B — only the dense cores get cluster color,
    noise points fall through to the default taste-based tint).
    """
    hdb = HDBSCAN(
        min_cluster_size=min_cluster_size,
        cluster_selection_method="leaf",
    )
    raw_labels = hdb.fit_predict(emb)
    unique_clusters = sorted(c for c in set(raw_labels.tolist()) if c >= 0)
    n_clusters = len(unique_clusters)

    centroids = np.stack([emb[raw_labels == c].mean(axis=0) for c in unique_clusters])
    remap = {old: new for new, old in enumerate(unique_clusters)}
    out = np.array([remap[c] if c >= 0 else -1 for c in raw_labels])

    # Track which points were dense-core (HDBSCAN-confident) vs reassigned
    # noise. The renderer uses dense-core members for label position so
    # cluster sprites sit at the heart of the real chemistry signal,
    # not at the noise-sink centroid that includes peripheral reassignment.
    dense_core_mask = (out >= 0).copy()

    noise_idx = np.where(out == -1)[0]
    if reassign_noise:
        for i in noise_idx:
            dists = np.linalg.norm(centroids - emb[i], axis=1)
            out[i] = int(dists.argmin())

    meta = {
        "n_clusters": n_clusters,
        "noise_count": int(len(noise_idx)),
        "noise_reassigned": int(len(noise_idx)) if reassign_noise else 0,
        "noise_kept_as_minus_one": 0 if reassign_noise else int(len(noise_idx)),
        "min_cluster_size": min_cluster_size,
        "cluster_selection_method": "leaf",
        "dense_core_mask": dense_core_mask.tolist(),
    }
    return out, meta


def build(cluster_algo: str = "kmeans", hdbscan_min_size: int = 40,
          reassign_noise: bool = True) -> None:
    # ── Load embeddings + name ordering ─────────────────────────
    emb = np.load(EMB_PATH).astype(np.float32)
    graph = json.loads(GRAPH_V3.read_text(encoding="utf-8"))
    names = [n["name"] for n in graph["nodes"]]
    assert len(names) == emb.shape[0], (
        f"name count {len(names)} != embedding rows {emb.shape[0]}"
    )
    n_nodes = emb.shape[0]
    print(f"[v3d] loaded embeddings {emb.shape} for {n_nodes} ingredients")

    # ── Per-node leaves (for cluster labeling) ──────────────────
    leaves_per_node: dict[str, list[str]] = {}
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            name = (row.get("name") or "").strip()
            if name:
                leaves_per_node[name] = _split_pipe(row.get("leaves"))

    # ── UMAP 3D ─────────────────────────────────────────────────
    print(f"[v3d] UMAP → 3D (n_components=3, min_dist={UMAP_MIN_DIST}, seed={SEED})")
    reducer_3d = umap.UMAP(
        n_components=3,
        n_neighbors=UMAP_N_NEIGHBORS,
        min_dist=UMAP_MIN_DIST,
        random_state=SEED,
    )
    coords_3d = reducer_3d.fit_transform(emb)
    coords_3d = (coords_3d - coords_3d.mean(0)) / (coords_3d.std(0) + 1e-8)
    coords_3d *= SCENE_SCALE
    print(f"[v3d] 3D bbox: x={coords_3d[:,0].min():.1f}..{coords_3d[:,0].max():.1f} "
          f"y={coords_3d[:,1].min():.1f}..{coords_3d[:,1].max():.1f} "
          f"z={coords_3d[:,2].min():.1f}..{coords_3d[:,2].max():.1f}")

    # ── UMAP 2D ─────────────────────────────────────────────────
    print(f"[v3d] UMAP → 2D (n_components=2, min_dist={UMAP_MIN_DIST}, seed={SEED})")
    reducer_2d = umap.UMAP(
        n_components=2,
        n_neighbors=UMAP_N_NEIGHBORS,
        min_dist=UMAP_MIN_DIST,
        random_state=SEED,
    )
    coords_2d = reducer_2d.fit_transform(emb)
    coords_2d = (coords_2d - coords_2d.mean(0)) / (coords_2d.std(0) + 1e-8)
    coords_2d *= SCENE_SCALE
    print(f"[v3d] 2D bbox: x={coords_2d[:,0].min():.1f}..{coords_2d[:,0].max():.1f} "
          f"y={coords_2d[:,1].min():.1f}..{coords_2d[:,1].max():.1f}")

    # ── Clustering ──────────────────────────────────────────────
    sil_sample_size = min(2000, n_nodes)
    rng = np.random.default_rng(SEED)
    sil_idx = rng.choice(n_nodes, sil_sample_size, replace=False)
    cluster_meta: dict = {"algo": cluster_algo}

    if cluster_algo in ("hdbscan", "hdbscan-umap"):
        space = "umap3d" if cluster_algo == "hdbscan-umap" else "embedding"
        X = coords_3d if space == "umap3d" else emb
        print(f"[v3d] HDBSCAN on {space} space "
              f"(min_cluster_size={hdbscan_min_size}, method=leaf, "
              f"reassign_noise={reassign_noise})")
        cluster_ids, hdb_meta = _cluster_hdbscan(
            X, hdbscan_min_size, reassign_noise=reassign_noise,
        )
        cluster_meta.update(hdb_meta)
        cluster_meta["space"] = space
        # Silhouette excludes -1 noise points (sklearn requires ≥2 labels;
        # a partially-noise label set throws otherwise).
        sample_labels = cluster_ids[sil_idx]
        in_cluster = sample_labels >= 0
        if in_cluster.sum() >= 2 and len(set(sample_labels[in_cluster].tolist())) >= 2:
            sil = float(silhouette_score(X[sil_idx][in_cluster], sample_labels[in_cluster]))
        else:
            sil = float("nan")
        cluster_meta["silhouette"] = sil
        chosen_k = hdb_meta["n_clusters"]
        print(f"[v3d] HDBSCAN found {chosen_k} clusters "
              f"(silhouette={sil:.4f}, noise={hdb_meta['noise_count']}, "
              f"reassigned={hdb_meta['noise_reassigned']}, kept_as_-1={hdb_meta['noise_kept_as_minus_one']})")
    else:
        silhouettes: dict[int, float] = {}
        km_runs: dict[int, KMeans] = {}
        print(f"[v3d] KMeans sweep k={KMEANS_K_GRID} (silhouette on {sil_sample_size}-row sample)")
        for k in KMEANS_K_GRID:
            km = KMeans(n_clusters=k, random_state=SEED, n_init=10)
            labels = km.fit_predict(emb)
            sil = float(silhouette_score(emb[sil_idx], labels[sil_idx]))
            silhouettes[k] = sil
            km_runs[k] = km
            print(f"  k={k:>2}: silhouette={sil:.4f}")
        best_k = max(silhouettes, key=lambda k: silhouettes[k])
        best_sil = silhouettes[best_k]
        if abs(silhouettes[K_PREFERRED] - best_sil) <= K_PREFER_BAND:
            chosen_k = K_PREFERRED
            print(f"[v3d] elbow={best_k} (sil={best_sil:.4f}); "
                  f"k={K_PREFERRED} within {K_PREFER_BAND} → choosing {K_PREFERRED}")
        else:
            chosen_k = best_k
            print(f"[v3d] elbow={best_k} (sil={best_sil:.4f}); k={K_PREFERRED} too far → choosing {chosen_k}")
        cluster_ids = km_runs[chosen_k].fit_predict(emb)
        cluster_meta["k_grid_silhouettes"] = silhouettes
        cluster_meta["silhouette"] = silhouettes[chosen_k]

    # ── Cluster labels via lift ─────────────────────────────────
    corpus_leaf_counts = Counter()
    for name in names:
        corpus_leaf_counts.update(set(leaves_per_node.get(name, [])))
    corpus_n = n_nodes

    cluster_members: dict[int, list[str]] = defaultdict(list)
    for i, c in enumerate(cluster_ids.tolist()):
        cluster_members[int(c)].append(names[i])

    cluster_label_map: dict[int, str] = {}
    cluster_size_map: dict[int, int] = {}
    for c, members in sorted(cluster_members.items()):
        if c < 0:
            # HDBSCAN noise (Option B): don't try to label, don't emit a
            # cluster sprite. Members keep clusterId=-1 so the renderer
            # treats them as low-confidence / uncolored.
            cluster_size_map[c] = len(members)
            continue
        cluster_size_map[c] = len(members)
        cluster_leaf_counts = Counter()
        for m in members:
            cluster_leaf_counts.update(set(leaves_per_node.get(m, [])))

        candidates: list[tuple[str, float, int]] = []
        for leaf, cnt in cluster_leaf_counts.items():
            if leaf in LABEL_BLOCKLIST:
                continue
            if cnt < MIN_LEAF_SUPPORT:
                continue
            cluster_share = cnt / max(len(members), 1)
            corpus_share = corpus_leaf_counts[leaf] / corpus_n
            lift = cluster_share / max(corpus_share, 1e-6)
            if lift < MIN_LIFT:
                continue
            candidates.append((leaf, lift, cnt))

        candidates.sort(key=lambda t: (-t[1], -t[2], t[0]))
        top3 = candidates[:3]
        if top3:
            cluster_label_map[c] = "-".join(leaf for leaf, _l, _n in top3)
        else:
            # Fall back to top-3 by support if nothing meets lift threshold.
            fallback = sorted(
                ((leaf, cnt) for leaf, cnt in cluster_leaf_counts.items()
                 if leaf not in LABEL_BLOCKLIST and cnt >= MIN_LEAF_SUPPORT),
                key=lambda t: (-t[1], t[0]),
            )[:3]
            cluster_label_map[c] = "-".join(l for l, _ in fallback) or f"cluster-{c}"

    print(f"[v3d] cluster labels:")
    for c in sorted(cluster_label_map):
        print(f"  c{c:>2} (n={cluster_size_map[c]:>4}): {cluster_label_map[c]}")

    # ── Emit outputs ────────────────────────────────────────────
    pos_3d = {names[i]: [round(float(coords_3d[i, 0]), 4),
                          round(float(coords_3d[i, 1]), 4),
                          round(float(coords_3d[i, 2]), 4)]
              for i in range(n_nodes)}
    pos_2d = {names[i]: [round(float(coords_2d[i, 0]), 4),
                          round(float(coords_2d[i, 1]), 4)]
              for i in range(n_nodes)}
    ingredient_to_cluster = {names[i]: int(cluster_ids[i]) for i in range(n_nodes)}

    OUT_POS_3D.parent.mkdir(parents=True, exist_ok=True)
    OUT_POS_3D.write_text(json.dumps(pos_3d), encoding="utf-8")
    print(f"[v3d] wrote {OUT_POS_3D.relative_to(ROOT)} ({n_nodes} entries)")

    OUT_POS_2D.write_text(json.dumps(pos_2d), encoding="utf-8")
    print(f"[v3d] wrote {OUT_POS_2D.relative_to(ROOT)} ({n_nodes} entries)")

    # Chef-curated label override — apply v3_cluster_labels_chef.json
    # when present so the rendered cluster sprites + IngredientPanel
    # show cooking-friendly names ("Apple, Spice & Cider") instead of
    # the auto-generated chemistry labels ("cider-like-peely-zesty").
    # Original chemistry label is preserved in each cluster entry's
    # `chemistry_label` field for debugging.
    chef_labels: dict[int, str] = {}
    if CHEF_LABELS_PATH.exists():
        chef_doc = json.loads(CHEF_LABELS_PATH.read_text(encoding="utf-8"))
        for cid_str, entry in (chef_doc.get("labels") or {}).items():
            try:
                chef_labels[int(cid_str)] = str(entry.get("chef") or "")
            except (ValueError, AttributeError, TypeError):
                continue
        print(f"[v3d] loaded {len(chef_labels)} chef-curated labels from "
              f"{CHEF_LABELS_PATH.relative_to(ROOT)}")
    else:
        print(f"[v3d] no chef labels file at {CHEF_LABELS_PATH.relative_to(ROOT)} — using chemistry labels")

    # Cluster centroids in 3D scene space — used by consumers that
    # render a label sprite at each cluster centroid.
    # For HDBSCAN modes with noise reassignment: prefer the DENSE-CORE
    # centroid (computed from points HDBSCAN was confident on, before
    # reassignment) so the label sprite sits at the chemistry signal's
    # heart, not at the noise-sink center pulled by peripheral
    # reassignment. Falls back to all-member centroid for KMeans or when
    # the dense-core mask is missing.
    dense_core_mask = cluster_meta.pop("dense_core_mask", None)
    clusters_array = []
    for c in sorted(cluster_label_map):
        all_member_idxs = [i for i, cid in enumerate(cluster_ids.tolist()) if cid == c]
        core_member_idxs = (
            [i for i in all_member_idxs if dense_core_mask[i]]
            if dense_core_mask is not None else all_member_idxs
        )
        label_idxs = core_member_idxs if core_member_idxs else all_member_idxs
        if label_idxs:
            centroid_3d = coords_3d[label_idxs].mean(axis=0)
            centroid_3d = [round(float(v), 4) for v in centroid_3d]
        else:
            centroid_3d = [0.0, 0.0, 0.0]
        chemistry_label = cluster_label_map[c]
        chef_label = chef_labels.get(c) or chemistry_label
        clusters_array.append({
            "id": c,
            "label": chef_label,
            "chemistry_label": chemistry_label,
            "size": cluster_size_map[c],
            "dense_core_size": len(core_member_idxs),
            "centroid_3d": centroid_3d,
        })

    OUT_CLUSTERS.write_text(
        json.dumps({
            "k": chosen_k,
            "clusters": clusters_array,
            "ingredients": ingredient_to_cluster,
            "_meta": {
                "k": chosen_k,
                "cluster": cluster_meta,
                "umap_min_dist": UMAP_MIN_DIST,
                "umap_n_neighbors": UMAP_N_NEIGHBORS,
                "umap_seed": SEED,
                "scene_scale": SCENE_SCALE,
                "label_blocklist": sorted(LABEL_BLOCKLIST),
                "min_leaf_support": MIN_LEAF_SUPPORT,
                "min_lift": MIN_LIFT,
                "cluster_sizes": cluster_size_map,
            },
        }),
        encoding="utf-8",
    )
    print(f"[v3d] wrote {OUT_CLUSTERS.relative_to(ROOT)}")

    # ── Spot-check summary ──────────────────────────────────────
    spotchecks = {
        "alliums":   ["garlic", "onion", "shallot", "leek", "chive"],
        "citruses":  ["lemon", "lime", "orange", "grapefruit"],
        "herbs":     ["thyme", "oregano", "basil", "rosemary", "sage"],
        "dairy":     ["butter", "cream", "milk", "yogurt"],
        "meaty":     ["beef", "pork", "chicken", "bacon"],
        "thyme+oregano": ["thyme", "oregano"],
    }
    print(f"[v3d] spot-checks:")
    for label, members in spotchecks.items():
        hits = [(m, ingredient_to_cluster.get(m)) for m in members
                if m in ingredient_to_cluster]
        cc = Counter(c for _, c in hits if c is not None)
        if not cc:
            print(f"  {label}: NO MEMBERS")
            continue
        dom_cluster, dom_n = cc.most_common(1)[0]
        total = sum(cc.values())
        print(f"  {label}: cohesion={dom_n}/{total} in c{dom_cluster} "
              f"({cluster_label_map.get(dom_cluster, '?')})")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--cluster-algo",
                   choices=["kmeans", "hdbscan", "hdbscan-umap"],
                   default="kmeans",
                   help="hdbscan clusters on 16-d embedding; hdbscan-umap clusters on the 3D UMAP output")
    p.add_argument("--hdbscan-min-size", type=int, default=40,
                   help="HDBSCAN min_cluster_size (only when --cluster-algo=hdbscan)")
    p.add_argument("--keep-noise", action="store_true",
                   help="When HDBSCAN labels a point as noise (-1), keep it -1 instead "
                        "of reassigning to nearest centroid. Renderer treats -1 as uncolored.")
    args = p.parse_args()
    build(cluster_algo=args.cluster_algo,
          hdbscan_min_size=args.hdbscan_min_size,
          reassign_noise=not args.keep_noise)
