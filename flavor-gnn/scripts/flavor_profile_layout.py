"""flavor_profile_layout.py — re-derive V3 positions + clusters from flavor profile.

Replaces the GAT-pairing-based V3 layout with one that clusters ingredients
by their chef-curated **flavor profile** (tier1 aroma + tier2 taste +
tier3 mouthfeel + leaves). Chef preference per
`feedback-flavor-clustering-axis` memory: ingredients with similar flavor
should sit close AND share cluster, regardless of recipe co-occurrence.

Pipeline:
  1. Read `flavor-gnn/curation/flavor_graph_full.csv`.
  2. Build flavor feature vector per row:
       - tier1_aroma  (multi-hot, ~5 dims)
       - tier2_taste  (multi-hot, ~8 dims)
       - tier3_mouthfeel (multi-hot, ~15 dims after pruning rare)
       - leaves       (multi-hot top-N most-frequent, ~80 dims)
     Each block is L2-normalized then concatenated; tier blocks
     weighted higher than leaves so high-level descriptors dominate.
  3. UMAP → 3D and 2D for positions.
  4. KMeans on the feature vectors (k=12 default) → cluster IDs.
  5. Label each cluster by its dominant tier1 + tier2 + tier3 tokens
     (lift-scored to avoid corpus-dominant terms).
  6. Write outputs:
       - public/proDataset/flavor_positions_v3.json
       - public/proDataset/flavor_positions_2d_v3.json
       - public/proDataset/cluster_labels_v3.json

After this, run `apply_v3_assignments.py` + `fold_aliases_visually.py`
to layer the chef-classify items and alias visual fold back on top.

Usage:
    python flavor-gnn/scripts/flavor_profile_layout.py [--k 12] [--leaves-topn 80]
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import shutil
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import umap
from sklearn.cluster import KMeans

ROOT = Path(__file__).resolve().parents[2]

CSV_PATH = ROOT / "flavor-gnn" / "curation" / "flavor_graph_full.csv"
INGREDIENTS_PATH = ROOT / "public" / "proDataset" / "ingredients.json"
OUT_POS_3D = ROOT / "public" / "proDataset" / "flavor_positions_v3.json"
OUT_POS_2D = ROOT / "public" / "proDataset" / "flavor_positions_2d_v3.json"
OUT_CLUSTERS = ROOT / "public" / "proDataset" / "cluster_labels_v3.json"

SEED = 42
UMAP_MIN_DIST = 0.55
UMAP_N_NEIGHBORS = 12
SCENE_SCALE = 10.0

# Feature-block weights. Tier columns dominate when present; category +
# taste from ingredients.json act as a fallback signal for the 1570
# rows where the CSV tier columns are empty.
W_TIER1 = 2.5
W_TIER2 = 2.0
W_TIER3 = 1.8
W_LEAVES = 1.0
W_CATEGORY = 1.5  # ingredients.json.category - 26 chef-curated buckets
W_TASTE_FALLBACK = 1.5  # ingredients.json.taste - blended taste string

# Cluster-labeling: how many top features to mention in the label
LABEL_TOP_N = 3
# Minimum cluster share for a feature to count as a label candidate.
# Lowered to 0.25 (from 0.35) so multi-category clusters like
# "grain + fat + baked" still get a derived label instead of falling
# through to "cluster-N".
LABEL_MIN_SHARE = 0.25
# Minimum lift (cluster_share / corpus_share) to count
LABEL_MIN_LIFT = 1.3


def split_pipe(s: str | None) -> list[str]:
    if not isinstance(s, str) or not s.strip():
        return []
    return [t.strip().lower() for t in s.split("|") if t.strip()]


def snapshot(path: Path) -> None:
    bak = path.with_suffix(path.suffix + ".pre-flavor-layout.bak")
    if not bak.exists() and path.exists():
        shutil.copy2(path, bak)


def build_vocab(values: list[list[str]], min_support: int = 1) -> list[str]:
    """Tokens that appear in at least `min_support` rows, sorted by frequency."""
    c = Counter()
    for tokens in values:
        for t in set(tokens):
            c[t] += 1
    return [tok for tok, n in c.most_common() if n >= min_support]


def multihot(tokens: list[str], vocab: dict[str, int]) -> np.ndarray:
    v = np.zeros(len(vocab), dtype=np.float32)
    for t in tokens:
        if t in vocab:
            v[vocab[t]] = 1.0
    return v


def l2_normalize(v: np.ndarray) -> np.ndarray:
    n = float(np.linalg.norm(v))
    return v / n if n > 1e-9 else v


def main(k: int, leaves_topn: int) -> None:
    # ── Load CSV ───────────────────────────────────────────────────
    names: list[str] = []
    tier1s: list[list[str]] = []
    tier2s: list[list[str]] = []
    tier3s: list[list[str]] = []
    leavess: list[list[str]] = []
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
    n_rows = len(names)
    print(f"[flavor-layout] loaded {n_rows} rows from CSV")

    # ── Load ingredients.json for category + taste fallback ────────
    ing_data = json.loads(INGREDIENTS_PATH.read_text(encoding="utf-8"))
    categories: list[list[str]] = []
    tastes: list[list[str]] = []
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

    tier_empty_count = sum(1 for i in range(n_rows)
                           if not tier1s[i] and not tier2s[i] and not tier3s[i])
    print(f"[flavor-layout] rows with all-empty tiers: {tier_empty_count} "
          f"({100 * tier_empty_count / n_rows:.1f}%) — will rely on category + taste")

    # ── Build vocabularies ─────────────────────────────────────────
    v1 = build_vocab(tier1s, min_support=3)
    v2 = build_vocab(tier2s, min_support=3)
    v3 = build_vocab(tier3s, min_support=5)
    v_leaves_all = build_vocab(leavess, min_support=3)
    v_leaves = v_leaves_all[:leaves_topn]
    v_cat = build_vocab(categories, min_support=3)
    v_taste = build_vocab(tastes, min_support=3)

    idx1 = {t: i for i, t in enumerate(v1)}
    idx2 = {t: i for i, t in enumerate(v2)}
    idx3 = {t: i for i, t in enumerate(v3)}
    idxL = {t: i for i, t in enumerate(v_leaves)}
    idxC = {t: i for i, t in enumerate(v_cat)}
    idxT = {t: i for i, t in enumerate(v_taste)}
    print(f"[flavor-layout] vocab — tier1: {len(v1)}, tier2: {len(v2)}, "
          f"tier3: {len(v3)}, leaves(top-{leaves_topn}): {len(v_leaves)}, "
          f"category: {len(v_cat)}, taste-fallback: {len(v_taste)}")

    # ── Encode flavor feature vectors ──────────────────────────────
    feats: list[np.ndarray] = []
    for i in range(n_rows):
        f1 = l2_normalize(multihot(tier1s[i], idx1)) * W_TIER1
        f2 = l2_normalize(multihot(tier2s[i], idx2)) * W_TIER2
        f3 = l2_normalize(multihot(tier3s[i], idx3)) * W_TIER3
        fL = l2_normalize(multihot(leavess[i], idxL)) * W_LEAVES
        fC = l2_normalize(multihot(categories[i], idxC)) * W_CATEGORY
        fT = l2_normalize(multihot(tastes[i], idxT)) * W_TASTE_FALLBACK
        feats.append(np.concatenate([f1, f2, f3, fL, fC, fT]))
    X = np.stack(feats).astype(np.float32)
    print(f"[flavor-layout] feature matrix: {X.shape}")

    # Drop rows that ended up all-zero (no signal anywhere).
    norms = np.linalg.norm(X, axis=1)
    keep_mask = norms > 1e-6
    drop_count = int((~keep_mask).sum())
    if drop_count:
        print(f"[flavor-layout] dropping {drop_count} all-zero-feature rows from layout")
        X = X[keep_mask]

    # ── UMAP 3D ────────────────────────────────────────────────────
    print(f"[flavor-layout] UMAP → 3D (n_neighbors={UMAP_N_NEIGHBORS}, "
          f"min_dist={UMAP_MIN_DIST}, seed={SEED})")
    reducer_3d = umap.UMAP(
        n_components=3, n_neighbors=UMAP_N_NEIGHBORS,
        min_dist=UMAP_MIN_DIST, metric="cosine", random_state=SEED,
    )
    coords_3d = reducer_3d.fit_transform(X)
    coords_3d = (coords_3d - coords_3d.mean(0)) / (coords_3d.std(0) + 1e-8)
    coords_3d *= SCENE_SCALE

    # ── UMAP 2D ────────────────────────────────────────────────────
    print(f"[flavor-layout] UMAP → 2D")
    reducer_2d = umap.UMAP(
        n_components=2, n_neighbors=UMAP_N_NEIGHBORS,
        min_dist=UMAP_MIN_DIST, metric="cosine", random_state=SEED,
    )
    coords_2d = reducer_2d.fit_transform(X)
    coords_2d = (coords_2d - coords_2d.mean(0)) / (coords_2d.std(0) + 1e-8)
    coords_2d *= SCENE_SCALE

    # ── KMeans on feature vectors ──────────────────────────────────
    print(f"[flavor-layout] KMeans (k={k}, seed={SEED}) on flavor features")
    km = KMeans(n_clusters=k, random_state=SEED, n_init=10)
    cluster_ids = km.fit_predict(X)

    # ── Derive cluster labels by lift on tier features ─────────────
    # Aggregate per-cluster feature presence (back from the encoded
    # vectors). Then pick top tier1+tier2+tier3 tokens per cluster by
    # lift (cluster_share / corpus_share).
    corpus_share = {}
    for vocab, getter in (
        (v1, lambda i: tier1s[i]),
        (v2, lambda i: tier2s[i]),
        (v3, lambda i: tier3s[i]),
        (v_cat, lambda i: categories[i]),
    ):
        for tok in vocab:
            corpus_share[tok] = sum(1 for i in range(n_rows) if tok in set(getter(i))) / n_rows

    # cluster members (using kept index)
    kept_index_of_row: dict[int, int] = {}
    j = 0
    for i, k_flag in enumerate(keep_mask):
        if k_flag:
            kept_index_of_row[i] = j
            j += 1

    cluster_members: dict[int, list[int]] = defaultdict(list)
    for orig_i, kept_i in kept_index_of_row.items():
        cluster_members[int(cluster_ids[kept_i])].append(orig_i)

    cluster_labels: dict[int, str] = {}
    cluster_sizes: dict[int, int] = {}
    cluster_centroids_3d: dict[int, list[float]] = {}
    for cid in sorted(cluster_members.keys()):
        members = cluster_members[cid]
        size = len(members)
        cluster_sizes[cid] = size
        # 3D centroid
        member_kept = [kept_index_of_row[i] for i in members]
        c3 = coords_3d[member_kept].mean(axis=0).tolist()
        cluster_centroids_3d[cid] = [round(v, 4) for v in c3]
        # Label by lift on tier + category tokens. Category tokens get
        # a boost so they win ties (chef cares more about "vegetable"
        # than "cooling" when both apply).
        cat_candidates: list[tuple[str, float]] = []
        tier_candidates: list[tuple[str, float]] = []
        for vocab, getter, bucket in (
            (v1, lambda i: tier1s[i], tier_candidates),
            (v2, lambda i: tier2s[i], tier_candidates),
            (v3, lambda i: tier3s[i], tier_candidates),
            (v_cat, lambda i: categories[i], cat_candidates),
        ):
            for tok in vocab:
                in_cluster = sum(1 for i in members if tok in set(getter(i)))
                if in_cluster == 0:
                    continue
                cs = in_cluster / size
                if cs < LABEL_MIN_SHARE:
                    continue
                lift = cs / max(corpus_share.get(tok, 1e-6), 1e-6)
                if lift < LABEL_MIN_LIFT:
                    continue
                bucket.append((tok, lift))
        # Top 2 categories, then top 1-2 tiers
        cat_candidates.sort(key=lambda c: -c[1])
        tier_candidates.sort(key=lambda c: -c[1])
        top_cat = [tok for tok, _ in cat_candidates[:2]]
        top_tier = [tok for tok, _ in tier_candidates[:2]]
        label_parts = top_cat + [t for t in top_tier if t not in top_cat]
        label_parts = label_parts[:LABEL_TOP_N]
        cluster_labels[cid] = "-".join(label_parts) if label_parts else f"cluster-{cid}"

    print(f"[flavor-layout] {k} clusters labeled:")
    for cid in sorted(cluster_sizes.keys()):
        print(f"  c{cid:>2} ({cluster_sizes[cid]:>4})  {cluster_labels[cid]}")

    # ── Write outputs ──────────────────────────────────────────────
    snapshot(OUT_POS_3D); snapshot(OUT_POS_2D); snapshot(OUT_CLUSTERS)

    pos_3d: dict[str, list[float]] = {}
    pos_2d: dict[str, list[float]] = {}
    for orig_i, name in enumerate(names):
        if not keep_mask[orig_i]:
            continue
        kept_i = kept_index_of_row[orig_i]
        pos_3d[name] = [round(float(v), 4) for v in coords_3d[kept_i]]
        pos_2d[name] = [round(float(v), 4) for v in coords_2d[kept_i]]
    OUT_POS_3D.write_text(json.dumps(pos_3d, separators=(",", ":")), encoding="utf-8")
    OUT_POS_2D.write_text(json.dumps(pos_2d, separators=(",", ":")), encoding="utf-8")
    print(f"[flavor-layout] wrote {OUT_POS_3D.relative_to(ROOT)} ({len(pos_3d)} entries)")
    print(f"[flavor-layout] wrote {OUT_POS_2D.relative_to(ROOT)} ({len(pos_2d)} entries)")

    clusters_arr = []
    for cid in sorted(cluster_sizes.keys()):
        clusters_arr.append({
            "id": cid,
            "label": cluster_labels[cid],
            "chemistry_label": cluster_labels[cid],
            "size": cluster_sizes[cid],
            "dense_core_size": cluster_sizes[cid],
            "centroid_3d": cluster_centroids_3d[cid],
        })

    ingredients_map = {}
    for orig_i, name in enumerate(names):
        if not keep_mask[orig_i]:
            continue
        kept_i = kept_index_of_row[orig_i]
        ingredients_map[name] = int(cluster_ids[kept_i])

    cluster_data = {
        "k": k,
        "clusters": clusters_arr,
        "ingredients": ingredients_map,
        "_meta": {
            "source": "flavor_profile_layout",
            "feature_block_weights": {
                "tier1": W_TIER1, "tier2": W_TIER2, "tier3": W_TIER3, "leaves": W_LEAVES,
            },
            "umap": {"n_neighbors": UMAP_N_NEIGHBORS, "min_dist": UMAP_MIN_DIST,
                     "metric": "cosine", "seed": SEED},
            "kmeans": {"k": k, "seed": SEED, "n_init": 10},
            "feat_dim": int(X.shape[1]),
            "label_lift_min": LABEL_MIN_LIFT,
            "label_share_min": LABEL_MIN_SHARE,
        },
    }
    OUT_CLUSTERS.write_text(json.dumps(cluster_data, separators=(",", ":")), encoding="utf-8")
    print(f"[flavor-layout] wrote {OUT_CLUSTERS.relative_to(ROOT)} ({len(ingredients_map)} ingredients)")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--k", type=int, default=12)
    p.add_argument("--leaves-topn", type=int, default=80)
    args = p.parse_args()
    main(k=args.k, leaves_topn=args.leaves_topn)
