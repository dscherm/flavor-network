"""PCA 2D layout — project Node2Vec embeddings onto the two most-informative axes.

Unlike UMAP (which preserves neighborhoods), PCA finds the directions of
maximum variance in the recipe-co-occurrence embedding. The resulting axes
have real semantic meaning that can be discovered by examining extreme
ingredients on each end.

Output:
    public/proDataset/pca_positions.json
    {
        "<ingredient>": [x, y],
        "_meta": { axis1_label, axis2_label, ... }
    }

Usage:
    python -m src.infer.pca_2d_positions
"""
from __future__ import annotations

import json
from pathlib import Path

import networkx as nx
import numpy as np
from node2vec import Node2Vec


TARGET_RADIUS = 50.0


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def discover_axis_label(positions_2d: dict[str, np.ndarray], ingredients_data: dict,
                        axis: int, n: int = 5) -> dict:
    """Find ingredients at the extremes of a PCA axis to generate a human label."""
    items = [(name, pos[axis]) for name, pos in positions_2d.items()]
    items.sort(key=lambda x: x[1])
    low = items[:n]
    high = items[-n:]
    high.reverse()

    def taste_summary(names):
        tastes = {}
        for name in names:
            t = (ingredients_data.get(name, {}).get("taste") or "").lower().split()
            for tok in t:
                if tok:
                    tastes[tok] = tastes.get(tok, 0) + 1
        return sorted(tastes, key=tastes.get, reverse=True)[:2]

    low_names = [x[0] for x in low]
    high_names = [x[0] for x in high]
    low_tastes = taste_summary(low_names)
    high_tastes = taste_summary(high_names)

    return {
        "low": low_names,
        "high": high_names,
        "low_taste": low_tastes,
        "high_taste": high_tastes,
        "label": f"{'/'.join(low_tastes) or '?'} ← → {'/'.join(high_tastes) or '?'}",
    }


def main() -> int:
    root = _project_root()

    # Load pairings and build graph
    pairings_path = root / "public" / "proDataset" / "pairings.json"
    with pairings_path.open("r", encoding="utf-8") as fh:
        pairings = json.load(fh)
    print(f"[pca2d] loaded {len(pairings)} pairings")

    G = nx.Graph()
    for p in pairings:
        a, b, s = p.get("ingredientA"), p.get("ingredientB"), float(p.get("strength") or 0)
        if a and b and s > 0:
            G.add_edge(a, b, weight=s)
    print(f"[pca2d] graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

    # Node2Vec embedding (64-dim)
    n2v = Node2Vec(G, dimensions=64, walk_length=20, num_walks=40,
                   p=1.0, q=1.0, workers=1, quiet=True, seed=42)
    model = n2v.fit(window=10, min_count=1, batch_words=4, seed=42, workers=1)
    names = list(G.nodes())
    X = np.stack([np.asarray(model.wv[n]) for n in names])
    print(f"[pca2d] embedded {X.shape[0]} ingredients -> {X.shape[1]}-dim")

    # PCA to 2D (numpy, no sklearn needed)
    X_centered = X - X.mean(axis=0, keepdims=True)
    _, _, Vt = np.linalg.svd(X_centered, full_matrices=False)
    Y = X_centered @ Vt[:2].T  # (N, 2)

    # Explained variance
    S = np.linalg.svd(X_centered, compute_uv=False)
    total_var = (S ** 2).sum()
    exp_var = [(S[i] ** 2) / total_var for i in range(2)]
    print(f"[pca2d] PCA: axis1 explains {exp_var[0]:.1%}, axis2 explains {exp_var[1]:.1%}")

    # Normalize to target radius
    Y = Y - Y.mean(axis=0, keepdims=True)
    d = np.linalg.norm(Y, axis=1)
    p95 = float(np.percentile(d, 95)) if len(d) else 1.0
    scale = (TARGET_RADIUS / p95) if p95 > 0 else 1.0
    Y = Y * scale

    positions_2d = {n: Y[i] for i, n in enumerate(names)}

    # Discover semantic axis labels
    ingredients_path = root / "public" / "proDataset" / "ingredients.json"
    with ingredients_path.open("r", encoding="utf-8") as fh:
        ingredients_data = json.load(fh)

    axis1_info = discover_axis_label(positions_2d, ingredients_data, 0, n=8)
    axis2_info = discover_axis_label(positions_2d, ingredients_data, 1, n=8)
    print(f"[pca2d] Axis 1: {axis1_info['label']}")
    print(f"[pca2d]   low:  {', '.join(axis1_info['low'][:5])}")
    print(f"[pca2d]   high: {', '.join(axis1_info['high'][:5])}")
    print(f"[pca2d] Axis 2: {axis2_info['label']}")
    print(f"[pca2d]   low:  {', '.join(axis2_info['low'][:5])}")
    print(f"[pca2d]   high: {', '.join(axis2_info['high'][:5])}")

    # Write output
    out = {n: [float(round(Y[i][0], 3)), float(round(Y[i][1], 3))] for i, n in enumerate(names)}
    out["_meta"] = {
        "source": "Node2Vec(64d) -> PCA(2d)",
        "n": len(names),
        "target_radius": TARGET_RADIUS,
        "explained_variance": [round(v, 4) for v in exp_var],
        "axis1": axis1_info,
        "axis2": axis2_info,
    }

    out_path = root / "public" / "proDataset" / "pca_positions.json"
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(out, fh)
    print(f"[pca2d] wrote {out_path} — {len(names)} positions")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
