"""Flavor-space layout v2: spread overlapping nodes + emit cluster labels.

Improvements over flavor_layout_prototype.py:
  1. UMAP min_dist bumped 0.1 → 0.45 so variant ingredients (94 chicken
     variants, 299 potato variants) spread visibly instead of stacking
     at near-identical points.
  2. Deterministic per-name jitter applied AFTER UMAP, so identical-
     vector siblings (e.g. shitake mushroom + shiitake mushroom +
     shiitake mushroom cap, which all share the same GNN prediction)
     get distinct visible positions. Jitter is stable across reloads
     (hashed from name).
  3. Runs k-means on the 3D positions and writes flavor_cluster_labels.json
     with auto-labels per cluster, so the renderer can drop floating
     labels into flavor space.

Outputs:
  - public/proDataset/flavor_positions.json
  - public/proDataset/flavor_cluster_labels.json

Run: .venv/Scripts/python.exe scripts/flavor_layout_v2.py [k]
"""
import json
import math
import re
from collections import Counter
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
ENTROPY = ROOT / "public" / "proDataset" / "gnn_entropy.json"
INGREDIENTS = ROOT / "public" / "proDataset" / "ingredients.json"
OUT_POS = ROOT / "public" / "proDataset" / "flavor_positions.json"
OUT_CL = ROOT / "public" / "proDataset" / "flavor_cluster_labels.json"

TASTE_AXES = ["sweet", "bitter", "umami", "salty", "sour"]
ODOR_AXES = [
    "odor_fruity", "odor_floral", "odor_green",
    "odor_woody", "odor_spicy", "odor_fatty",
]
ALL_AXES = TASTE_AXES + ODOR_AXES

# Hashed-jitter magnitude in UMAP coordinate frame. The UMAP output
# with min_dist=0.45 spans roughly ±15 per axis. Bumping this from 1.5
# → 3.5 makes variant siblings (chicken variants, potato variants)
# visually distinct without merging adjacent cluster pockets — a
# typical cluster radius is 5-7 units, so 3.5 stays under that.
JITTER_MAGNITUDE = 3.5


def _hash_name(name: str) -> int:
    # FNV-1a-ish, mirrors the JS hash used elsewhere in this repo.
    h = 2166136261
    for c in name:
        h ^= ord(c)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def _jitter_for(name: str):
    h = _hash_name(name)
    u = ((h >> 0) & 0xFFFF) / 0xFFFF
    v = ((h >> 16) & 0xFFFF) / 0xFFFF
    w = (h >> 8) & 0xFFFF
    w = w / 0xFFFF
    theta = u * 2 * math.pi
    phi = math.acos(2 * v - 1)
    r = JITTER_MAGNITUDE * (w ** (1 / 3))
    return (
        r * math.sin(phi) * math.cos(theta),
        r * math.sin(phi) * math.sin(theta),
        r * math.cos(phi),
    )


def build_features():
    entropy = json.loads(ENTROPY.read_text(encoding="utf-8"))
    names, features = [], []
    for name, data in entropy.items():
        probs = (data or {}).get("probs")
        if not probs:
            continue
        vec = [probs.get(ax, 0.0) for ax in ALL_AXES]
        names.append(name)
        features.append(vec)
    return names, np.array(features)


# Simple stop words; we want lasting descriptive tokens, not generic ones.
_STOP_WORDS = frozenset({
    "the", "and", "of", "with", "in", "a", "an",
    "fresh", "freshly", "dry", "dried", "raw", "cooked", "whole", "half",
    "halved", "ground", "grnd", "powdered", "powder", "extract", "essence",
    "concentrate", "flavored", "flavor", "flavoring", "flavour",
    "low", "fat", "skim", "lean", "thin", "thick",
    "red", "green", "yellow", "white", "black", "brown", "pink",
    "large", "small", "medium", "baby",
    "frozen", "canned", "tinned", "instant", "natural",
    "italian", "asian", "chinese", "indian", "mexican", "american",
    "thai", "japanese", "korean", "french", "spanish", "greek",
    "leaf", "leave", "leaves",
    "juice", "juiced", "rind", "zest", "peel",
    "cup", "tablespoon", "teaspoon", "ounce", "pound", "gram",
})


def _root_tokens(name: str):
    tokens = re.findall(r"[a-z]+", name.lower())
    return [t for t in tokens if t not in _STOP_WORDS and len(t) > 2]


def _compute_global_baselines(names, ingredients, entropy):
    """Global taste-share + aroma-mean across all GNN-covered ingredients.

    The per-cluster labeler uses LIFT (cluster_share / global_share) so it
    surfaces the *distinctive* taste/aroma rather than just the most
    common one. Sweet is the most common curated taste tag everywhere —
    using share alone makes every cluster say "Sweet". Using lift makes
    "Sour" win where sour is unusually concentrated, "Pungent" where
    pungent is, "Woody" where woody aroma lifts above baseline, etc.
    """
    taste_total = Counter()
    n_taste = 0
    aroma_sum = {a.replace("odor_", ""): 0.0 for a in ODOR_AXES}
    n_aroma = 0
    for name in names:
        node = ingredients.get(name) or {}
        taste_str = (node.get("taste") or "").lower()
        if taste_str:
            n_taste += 1
            for t in re.split(r"[,\s]+", taste_str):
                t = t.strip()
                if t:
                    taste_total[t] += 1
        probs = (entropy.get(name) or {}).get("probs")
        if probs:
            n_aroma += 1
            for a in ODOR_AXES:
                aroma_sum[a.replace("odor_", "")] += probs.get(a, 0.0)
    taste_share = {t: c / max(n_taste, 1) for t, c in taste_total.items()}
    aroma_mean = {k: v / max(n_aroma, 1) for k, v in aroma_sum.items()}
    return taste_share, aroma_mean


def auto_label_flavor_cluster(sorted_members, ingredients, entropy,
                              global_taste_share, global_aroma_mean):
    """Label a cluster from its 25 centroid-closest members using LIFT
    against global baselines so non-sweet tastes and aroma signal can
    win the label.

    Output format: "<Taste-lift> <Aroma-lift> <Anchor>" where each piece
    only appears if it's discriminating. Pieces drop out when below
    lift threshold:
      - Taste: cluster_share / global_share ≥ 1.3 AND cluster_share ≥ 15%
      - Aroma: cluster_mean / global_mean ≥ 1.4 AND cluster_mean ≥ 5%
      - Anchor: category at ≥40% support, else top non-stopword token,
        else nearest ingredient name
    """
    TOP_N = 25
    closest = sorted_members[:TOP_N]

    tastes = Counter()
    aromas_sum = {a.replace("odor_", ""): 0.0 for a in ODOR_AXES}
    aroma_n = 0
    cats = Counter()
    tokens = Counter()

    for name in closest:
        node = ingredients.get(name) or {}
        for t in re.split(r"[,\s]+", (node.get("taste") or "").lower()):
            t = t.strip()
            if t:
                tastes[t] += 1
        cat = (node.get("category") or "").lower().strip()
        if cat and cat != "other":
            cats[cat] += 1
        for tok in _root_tokens(name):
            tokens[tok] += 1
        probs = (entropy.get(name) or {}).get("probs")
        if probs:
            aroma_n += 1
            for a in ODOR_AXES:
                aromas_sum[a.replace("odor_", "")] += probs.get(a, 0.0)

    # Taste lift
    taste_word = ""
    taste_candidates = []
    for t, c in tastes.items():
        share = c / TOP_N
        if share < 0.15:
            continue
        gshare = global_taste_share.get(t, 0.01)
        if gshare < 0.001:
            continue
        lift = share / gshare
        if lift >= 1.3:
            taste_candidates.append((t, lift, share))
    if taste_candidates:
        taste_candidates.sort(key=lambda x: x[1], reverse=True)
        taste_word = taste_candidates[0][0].title()

    # Aroma lift
    aroma_word = ""
    if aroma_n > 0:
        aroma_candidates = []
        for a, total in aromas_sum.items():
            cmean = total / aroma_n
            if cmean < 0.05:
                continue
            gmean = global_aroma_mean.get(a, 0.01)
            if gmean < 0.001:
                continue
            lift = cmean / gmean
            if lift >= 1.4:
                aroma_candidates.append((a, lift, cmean))
        if aroma_candidates:
            aroma_candidates.sort(key=lambda x: x[1], reverse=True)
            aroma_word = aroma_candidates[0][0].title()

    # Anchor
    anchor = ""
    top_cat = cats.most_common(1)
    if top_cat and top_cat[0][1] / TOP_N >= 0.4:
        anchor = top_cat[0][0].title()
    else:
        top_tok = tokens.most_common(1)
        if top_tok and top_tok[0][1] >= max(3, TOP_N // 5):
            anchor = top_tok[0][0].title()
    if not anchor:
        anchor = (closest[0] if closest else "Mix").title()

    parts = []
    if taste_word:
        parts.append(taste_word)
    if aroma_word and aroma_word.lower() != (taste_word or "").lower():
        parts.append(aroma_word)
    if anchor.lower() not in " ".join(p.lower() for p in parts):
        parts.append(anchor)

    return " ".join(parts) if parts else "Flavor Mix"


def main(k: int = 12):
    import umap
    from sklearn.cluster import KMeans

    names, X = build_features()
    ingredients = json.loads(INGREDIENTS.read_text(encoding="utf-8"))
    entropy = json.loads(ENTROPY.read_text(encoding="utf-8"))
    print(f"[v2] features {X.shape} | k={k}")

    global_taste_share, global_aroma_mean = _compute_global_baselines(
        names, ingredients, entropy,
    )
    print("[v2] global taste baseline:", {t: f"{v*100:.0f}%" for t, v in sorted(
        global_taste_share.items(), key=lambda kv: -kv[1])[:6]})
    print("[v2] global aroma baseline:", {a: f"{v*100:.1f}%" for a, v in sorted(
        global_aroma_mean.items(), key=lambda kv: -kv[1])})

    # z-score so no axis dominates
    mean = X.mean(axis=0)
    std = X.std(axis=0)
    Xn = (X - mean) / (std + 1e-8)

    print("[v2] UMAP → 3D (min_dist=0.45 for spread)...")
    reducer = umap.UMAP(
        n_components=3,
        n_neighbors=20,
        min_dist=0.45,
        metric="cosine",
        random_state=42,
    )
    pos = reducer.fit_transform(Xn).astype(float)

    # Per-name jitter for variant separation
    for i, name in enumerate(names):
        jx, jy, jz = _jitter_for(name)
        pos[i, 0] += jx
        pos[i, 1] += jy
        pos[i, 2] += jz

    print(f"[v2] projected + jittered: x={pos[:,0].min():.2f}..{pos[:,0].max():.2f} "
          f"y={pos[:,1].min():.2f}..{pos[:,1].max():.2f} "
          f"z={pos[:,2].min():.2f}..{pos[:,2].max():.2f}")

    # Write positions
    out_pos = {name: [float(pos[i,0]), float(pos[i,1]), float(pos[i,2])]
               for i, name in enumerate(names)}
    OUT_POS.write_text(json.dumps(out_pos), encoding="utf-8")
    print(f"[v2] wrote {OUT_POS.name} ({len(out_pos)} ingredients)")

    # K-means on 3D positions → cluster labels
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = km.fit_predict(pos)

    clusters = []
    ingredient_clusters = {}
    for cid in range(k):
        mask = labels == cid
        member_idx = np.where(mask)[0]
        if len(member_idx) == 0:
            continue
        member_names = [names[i] for i in member_idx]

        # Top ingredients by closeness to centroid
        centroid = km.cluster_centers_[cid]
        dists = np.linalg.norm(pos[mask] - centroid, axis=1)
        order = dists.argsort()
        sorted_members = [member_names[i] for i in order]

        label = auto_label_flavor_cluster(
            sorted_members, ingredients, entropy,
            global_taste_share, global_aroma_mean,
        )

        clusters.append({
            "id": cid,
            "label": label,
            "size": int(len(member_idx)),
            "centroid_3d": [float(centroid[0]), float(centroid[1]), float(centroid[2])],
            "top_ingredients": sorted_members[:8],
        })
        for n in member_names:
            ingredient_clusters[n] = {
                "cluster_id": int(cid),
                "cluster_label": label,
            }

    OUT_CL.write_text(json.dumps({
        "clusters": clusters,
        "ingredient_clusters": ingredient_clusters,
        "_meta": {
            "source": "flavor-umap-kmeans",
            "k": int(k),
            "n_ingredients": int(len(names)),
            "umap_params": {"n_neighbors": 20, "min_dist": 0.45, "metric": "cosine"},
        },
    }), encoding="utf-8")
    print(f"[v2] wrote {OUT_CL.name} ({len(clusters)} clusters)")

    # Report
    for c in clusters:
        print(f"  c{c['id']:>2} n={c['size']:>4}  {c['label']:30s} top: {', '.join(c['top_ingredients'][:5])}")


if __name__ == "__main__":
    import sys
    k = int(sys.argv[1]) if len(sys.argv) > 1 else 12
    main(k)
