"""Discover cluster labels for the ML network views.

Runs k-means on Node2Vec 64-dim embeddings, then auto-labels each cluster
by its dominant ingredient categories and cuisines. Outputs centroid positions
in both 3D (UMAP) and 2D (PCA) coordinate systems so the UI can render
floating labels in whichever mode is active.

Output: public/proDataset/cluster_labels.json

Usage:
    python -m src.infer.cluster_labels
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

import networkx as nx
import numpy as np
from node2vec import Node2Vec
from sklearn.cluster import KMeans


K = 10
SEED = 42


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _norm(s):
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


def auto_label(ingredients: list[dict], all_ingredients: dict, max_words: int = 3) -> str:
    """Generate a short descriptive label from ingredient names, categories, and cuisines.

    Strategy: find the most distinctive category or cuisine for this cluster
    relative to the overall distribution, BUT only accept it if the cluster's
    top-pairing ingredients actually have that category. A label that doesn't
    match the top items users see ("Protein" cluster topped by sugar/butter/milk)
    is worse than no label.

    Falls back to a "<TopIngredient> & friends"-style label when no
    category/cuisine survives the top-ingredient sanity check.
    """
    n = len(ingredients)
    if n == 0:
        return "Mixed"

    cats = Counter()
    cuisines = Counter()
    for ing in ingredients:
        cat = (ing.get("category") or "").lower().strip()
        if cat:
            cats[cat] += 1
        for c in ing.get("cuisines", []):
            cn = c.replace(" cuisine", "").strip().lower()
            if cn:
                cuisines[cn] += 1

    # Top ingredients (by pairing count) — these are what the UI surfaces.
    # Any label MUST match what's visibly shown.
    top = sorted(ingredients, key=lambda x: x.get("totalCount", 0) or 0, reverse=True)
    top_5 = top[:5]
    top_5_cats = {(t.get("category") or "").lower().strip() for t in top_5}
    top_5_cuisines = set()
    for t in top_5:
        for c in t.get("cuisines", []) or []:
            top_5_cuisines.add(c.replace(" cuisine", "").strip().lower())

    # Find the most over-represented category vs global rate
    global_cats = Counter()
    for v in all_ingredients.values():
        if isinstance(v, dict):
            gc = (v.get("category") or "").lower().strip()
            if gc:
                global_cats[gc] += 1
    total_global = sum(global_cats.values()) or 1

    best_cat = None
    best_lift = 0
    for cat, count in cats.most_common(5):
        cluster_rate = count / n
        global_rate = global_cats.get(cat, 1) / total_global
        lift = cluster_rate / max(global_rate, 0.001)
        # Sanity check: the cluster top-5 must include this category, or
        # the lift is coming from long-tail items and the label will mislead.
        if lift > best_lift and count >= 5 and cat in top_5_cats:
            best_lift = lift
            best_cat = cat

    # Find the most over-represented cuisine
    global_cuisines = Counter()
    for v in all_ingredients.values():
        if isinstance(v, dict):
            for c in v.get("cuisines", []) or []:
                global_cuisines[c.replace(" cuisine", "").strip().lower()] += 1
    total_gc = sum(global_cuisines.values()) or 1

    best_cuisine = None
    best_cuisine_lift = 0
    for cuis, count in cuisines.most_common(5):
        cluster_rate = count / n
        global_rate = global_cuisines.get(cuis, 1) / total_gc
        lift = cluster_rate / max(global_rate, 0.001)
        if lift > best_cuisine_lift and count >= 3 and cuis in top_5_cuisines:
            best_cuisine_lift = lift
            best_cuisine = cuis

    parts = []
    if best_cuisine and best_cuisine_lift > 1.5:
        parts.append(best_cuisine.title())
    if best_cat and best_lift > 1.3:
        cat_label = best_cat.title()
        if cat_label not in parts:
            parts.append(cat_label)

    if not parts:
        # Fall back to "<TopIngredient> & friends" so the label echoes the
        # top item the UI actually shows. Avoids the v3 mismatch where a
        # category label was attached to a cluster with unrelated top items.
        if top:
            parts = [top[0]["name"].split()[0].title()]
        else:
            parts = ["Mixed"]

    return " & ".join(parts[:max_words])


def main() -> int:
    root = _project_root()

    # Load pairings and build graph
    with (root / "public" / "proDataset" / "pairings.json").open("r", encoding="utf-8") as fh:
        pairings = json.load(fh)
    G = nx.Graph()
    for p in pairings:
        a, b, s = p.get("ingredientA"), p.get("ingredientB"), float(p.get("strength") or 0)
        if a and b and s > 0:
            G.add_edge(a, b, weight=s)
    names = list(G.nodes())
    print(f"[clusters] graph: {len(names)} nodes")

    # Node2Vec
    n2v = Node2Vec(G, dimensions=64, walk_length=20, num_walks=40,
                   p=1.0, q=1.0, workers=1, quiet=True, seed=SEED)
    model = n2v.fit(window=10, min_count=1, batch_words=4, seed=SEED, workers=1)
    X = np.stack([np.asarray(model.wv[n]) for n in names])
    print(f"[clusters] embedded {X.shape[0]} -> {X.shape[1]}-dim")

    # K-means
    km = KMeans(n_clusters=K, random_state=SEED, n_init=10)
    labels = km.fit_predict(X)
    print(f"[clusters] k-means k={K}, sizes: {sorted(Counter(labels).values(), reverse=True)}")

    # Load ingredient metadata
    with (root / "public" / "proDataset" / "ingredients.json").open("r", encoding="utf-8") as fh:
        ingredients_data = json.load(fh)

    # Load 3D + 2D positions for centroids
    with (root / "public" / "proDataset" / "gnn_positions.json").open("r", encoding="utf-8") as fh:
        pos3d_data = json.load(fh)
    pca_data = {}
    pca_path = root / "public" / "proDataset" / "pca_positions.json"
    if pca_path.exists():
        with pca_path.open("r", encoding="utf-8") as fh:
            pca_data = json.load(fh)

    # Build clusters
    clusters = []
    label_counts: Counter = Counter()  # for collision detection
    for k in range(K):
        members = [names[i] for i in range(len(names)) if labels[i] == k]
        member_data = [
            {**ingredients_data.get(n, {}), "name": n}
            for n in members
        ]

        label_text = auto_label(member_data, ingredients_data)
        # If another cluster already claimed this label, disambiguate by
        # appending the top-paired ingredient that uniquely belongs to
        # this cluster's pool (e.g. "Chili (cumin)" vs "Chili (ginger)").
        if label_counts[label_text] >= 1:
            top = sorted(member_data, key=lambda x: x.get("totalCount", 0) or 0, reverse=True)
            differentiator = next((t["name"].split()[0] for t in top if t.get("name")), None)
            if differentiator:
                label_text = f"{label_text} ({differentiator.lower()})"
        label_counts[label_text.split(" (")[0]] += 1

        # Compute centroid in 3D and 2D
        positions_3d = [pos3d_data[n] for n in members if n in pos3d_data and isinstance(pos3d_data[n], list)]
        positions_2d = [pca_data[n] for n in members if n in pca_data and isinstance(pca_data[n], list)]

        centroid_3d = np.mean(positions_3d, axis=0).tolist() if positions_3d else [0, 0, 0]
        centroid_2d = np.mean(positions_2d, axis=0).tolist() if positions_2d else [0, 0]

        # Top ingredients by pairing count
        top = sorted(member_data, key=lambda x: x.get("totalCount", 0) or 0, reverse=True)[:5]

        # Dominant taste for color
        taste_counts = Counter()
        for m in member_data:
            for t in (m.get("taste") or "").lower().split():
                if t:
                    taste_counts[t] += 1
        dominant_taste = taste_counts.most_common(1)[0][0] if taste_counts else "sweet"

        clusters.append({
            "id": k,
            "label": label_text,
            "size": len(members),
            "centroid_3d": [round(x, 2) for x in centroid_3d],
            "centroid_2d": [round(x, 2) for x in centroid_2d],
            "dominant_taste": dominant_taste,
            "top_ingredients": [t["name"] for t in top],
        })
        print(f"  [{k}] {label_text:30s} n={len(members):4d}  taste={dominant_taste:10s}  top: {', '.join(t['name'] for t in top[:3])}")

    out = {"k": K, "clusters": clusters}
    out_path = root / "public" / "proDataset" / "cluster_labels.json"
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2)
    print(f"[clusters] wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
