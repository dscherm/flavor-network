"""gat_3d_position_correlations.py — what does each UMAP axis mean?

For each of the 3 UMAP-projected axes (X / Y / Z), compute Pearson
correlations against:
  - chef tier1 aroma firings (13 binary cols)
  - chef tier2 taste tags (6 binary cols)
  - GNN aroma probabilities (5 columns: odor_fruity/floral/green/woody/fatty)
  - GNN taste probabilities (5 columns: sweet/sour/bitter/salty/umami)
  - cluster membership (7 binary cols from cluster_labels_v3)
  - pairing count + category one-hot
  - taste-string tokens

Reports top +N and -N correlations per axis so we can name each axis
in human terms ("X is roughly the savory↔sweet axis" etc.).
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
PRO = REPO / "public" / "proDataset"

CHEF_AROMAS = [
    "citrus", "fruity", "floral", "herbal", "green", "creamy",
    "woody", "earthy", "roasted", "caramel", "fermented", "marine", "pungent",
]
CHEF_TASTES = ["sweet", "sour", "bitter", "salty", "umami", "spicy", "pungent", "astringent"]
GNN_AROMAS = ["odor_fruity", "odor_floral", "odor_green", "odor_woody", "odor_fatty"]
GNN_TASTES = ["sweet", "sour", "bitter", "salty", "umami"]


def main():
    positions = json.loads((PRO / "flavor_positions_v3.json").read_text(encoding="utf-8"))
    ingredients_raw = json.loads((PRO / "ingredients.json").read_text(encoding="utf-8"))
    cluster_labels = json.loads((PRO / "cluster_labels_v3.json").read_text(encoding="utf-8"))
    gnn_entropy = json.loads((PRO / "gnn_entropy.json").read_text(encoding="utf-8"))
    flavor_graph = json.loads((PRO / "flavor_graph_data_v3.json").read_text(encoding="utf-8"))

    if isinstance(ingredients_raw, list):
        ing_by_name = {row.get("name"): row for row in ingredients_raw if row.get("name")}
    else:
        ing_by_name = ingredients_raw

    fg_by_name = {}
    for n in flavor_graph.get("nodes", []):
        nm = n.get("name")
        if nm:
            fg_by_name[nm] = n

    cluster_id_by_name = cluster_labels.get("ingredients", {})
    cluster_id_to_label = {c["id"]: c.get("label", f"c{c['id']}") for c in cluster_labels.get("clusters", [])}

    names = []
    coords = []
    for name, xyz in positions.items():
        if isinstance(xyz, list) and len(xyz) == 3:
            names.append(name)
            coords.append([float(xyz[0]), float(xyz[1]), float(xyz[2])])
    coords = np.array(coords, dtype=np.float64)
    n = len(names)
    print(f"loaded {n} positioned ingredients")

    feature_names = []
    feature_matrix = []

    for aroma in CHEF_AROMAS:
        col = []
        for nm in names:
            fg = fg_by_name.get(nm, {})
            tier1 = fg.get("tier1") or []
            col.append(1.0 if isinstance(tier1, list) and aroma in [t.lower() for t in tier1] else 0.0)
        feature_names.append(f"chef-aroma:{aroma}")
        feature_matrix.append(col)

    for taste in CHEF_TASTES:
        col = []
        for nm in names:
            ing = ing_by_name.get(nm, {})
            s = (ing.get("taste") or "").lower()
            col.append(1.0 if taste in s.split() else 0.0)
        feature_names.append(f"chef-taste:{taste}")
        feature_matrix.append(col)

    for key in GNN_AROMAS:
        col = []
        for nm in names:
            probs = gnn_entropy.get(nm, {}).get("probs", {})
            col.append(float(probs.get(key, 0.0)))
        feature_names.append(f"gnn:{key}")
        feature_matrix.append(col)

    for key in GNN_TASTES:
        col = []
        for nm in names:
            probs = gnn_entropy.get(nm, {}).get("probs", {})
            col.append(float(probs.get(key, 0.0)))
        feature_names.append(f"gnn-taste:{key}")
        feature_matrix.append(col)

    for cid in sorted(cluster_id_to_label.keys()):
        col = []
        for nm in names:
            col.append(1.0 if cluster_id_by_name.get(nm) == cid else 0.0)
        feature_names.append(f"cluster:{cluster_id_to_label[cid]}")
        feature_matrix.append(col)

    categories = set()
    for nm in names:
        cat = ing_by_name.get(nm, {}).get("category")
        if cat:
            categories.add(cat)
    for cat in sorted(categories):
        col = []
        for nm in names:
            col.append(1.0 if ing_by_name.get(nm, {}).get("category") == cat else 0.0)
        feature_names.append(f"category:{cat}")
        feature_matrix.append(col)

    feature_matrix = np.array(feature_matrix, dtype=np.float64)
    print(f"feature matrix: {feature_matrix.shape}")

    AXES = ["X (horizontal, right=+)", "Y (vertical, up=+)", "Z (depth, near=+)"]
    for axis_idx, axis_label in enumerate(AXES):
        axis = coords[:, axis_idx]
        ax_std = axis.std()
        corrs = []
        for fi, fname in enumerate(feature_names):
            f = feature_matrix[fi]
            f_std = f.std()
            if f_std < 1e-8:
                continue
            r = float(np.corrcoef(axis, f)[0, 1])
            if not np.isnan(r):
                corrs.append((fname, r))
        corrs.sort(key=lambda kv: -kv[1])
        print(f"\n=== {axis_label} (std={ax_std:.2f}, range [{axis.min():.1f}, {axis.max():.1f}]) ===")
        print(f"  TOP +CORR (features high where axis is positive):")
        for nm, r in corrs[:8]:
            print(f"    +{r:6.3f}  {nm}")
        print(f"  TOP -CORR (features high where axis is negative):")
        for nm, r in sorted(corrs, key=lambda kv: kv[1])[:8]:
            print(f"    {r:6.3f}  {nm}")

    print("\n=== CLUSTER CENTROIDS ===")
    print(f"  {'cluster':<32} {'X':>8} {'Y':>8} {'Z':>8}  n")
    for cid in sorted(cluster_id_to_label.keys()):
        members = [i for i, nm in enumerate(names) if cluster_id_by_name.get(nm) == cid]
        if not members:
            continue
        cx = coords[members].mean(axis=0)
        label = cluster_id_to_label[cid]
        print(f"  {label:<32} {cx[0]:>+8.2f} {cx[1]:>+8.2f} {cx[2]:>+8.2f}  {len(members)}")


if __name__ == "__main__":
    main()
