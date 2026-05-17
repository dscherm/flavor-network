"""Prototype C₁: UMAP 3D layout from per-ingredient flavor vectors.

For each of 2,790 GNN-covered ingredients build an 11-dim feature vector
(5 taste probs + 6 aroma probs), project to 3D via UMAP, and inspect
nearest-neighbor lists per ingredient.

The goal is to qualitatively answer: does a flavor-space layout group
flavor-similar ingredients (lemon near lime / orange, basil near mint /
cilantro, chili near chili) rather than co-occurrence-similar ingredients
(basil near parmesan, ginger near soy sauce)?

Outputs:
- public/proDataset/flavor_positions.json — {name: [x, y, z]} for 2,790 ingredients
- prints nearest-neighbor lists for representative ingredients

Run: .venv/Scripts/python.exe scripts/flavor_layout_prototype.py
"""
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
ENTROPY = ROOT / "public" / "proDataset" / "gnn_entropy.json"
OUT = ROOT / "public" / "proDataset" / "flavor_positions.json"

TASTE_AXES = ["sweet", "bitter", "umami", "salty", "sour"]
ODOR_AXES = [
    "odor_fruity", "odor_floral", "odor_green",
    "odor_woody", "odor_spicy", "odor_fatty",
]
ALL_AXES = TASTE_AXES + ODOR_AXES


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


def normalize(X):
    mean = X.mean(axis=0)
    std = X.std(axis=0)
    return (X - mean) / (std + 1e-8)


def neighbors_of(name, names, positions, k=10):
    if name not in names:
        return None
    idx = names.index(name)
    target = positions[idx]
    dists = np.linalg.norm(positions - target, axis=1)
    order = dists.argsort()[1:k+1]
    return [(names[i], float(dists[i])) for i in order]


def main():
    import umap
    names, X = build_features()
    print(f"[layout] features {X.shape}")
    Xn = normalize(X)

    print(f"[layout] UMAP → 3D...")
    reducer = umap.UMAP(
        n_components=3,
        n_neighbors=15,
        min_dist=0.1,
        metric="cosine",
        random_state=42,
    )
    pos = reducer.fit_transform(Xn)
    print(f"[layout] projected: {pos.shape}, ranges: "
          f"x={pos[:,0].min():.2f}..{pos[:,0].max():.2f} "
          f"y={pos[:,1].min():.2f}..{pos[:,1].max():.2f} "
          f"z={pos[:,2].min():.2f}..{pos[:,2].max():.2f}")

    # Inspect nearest neighbors for representative ingredients
    probes = [
        "lemon", "lime", "orange", "grapefruit",
        "basil", "mint", "cilantro", "parsley", "thyme", "rosemary",
        "vanilla", "cinnamon", "clove", "nutmeg", "cardamom",
        "chili", "jalapeno", "habanero", "scotch bonnet",
        "soy sauce", "fish sauce", "miso", "gochujang",
        "parmesan", "cheddar", "mozzarella", "feta",
        "mushroom", "shiitake mushroom", "tomato",
        "ginger", "garlic", "onion",
        "coconut milk", "coconut",
        "strawberry", "banana", "pineapple", "apple",
        "beef", "chicken", "pork", "salmon",
        "cumin", "turmeric", "paprika",
    ]
    print("\n=== Nearest-neighbor probes in flavor-UMAP space ===")
    for p in probes:
        nn = neighbors_of(p, names, pos, k=6)
        if nn is None:
            print(f"  {p}: <not in GNN-covered set>")
            continue
        nbrs = ", ".join(f"{n}" for n, _ in nn)
        print(f"  {p:22s} → {nbrs}")

    # Write positions out
    out_data = {name: [float(pos[i,0]), float(pos[i,1]), float(pos[i,2])]
                for i, name in enumerate(names)}
    OUT.write_text(json.dumps(out_data), encoding="utf-8")
    print(f"\n[layout] wrote {OUT} ({len(out_data)} ingredients)")


if __name__ == "__main__":
    main()
