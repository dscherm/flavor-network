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

# ML deps (networkx, node2vec, gensim, sklearn) are imported lazily inside
# main() so the pure-Python auto_label() helper can be imported on its own
# (e.g. from preview / verification scripts) without the heavy stack.

K = 10
SEED = 42


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _norm(s):
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


# Single-word categories that don't capture cluster identity by themselves.
# When the only signal is one of these, prefer cuisine or top-ingredient pair.
# A cluster of basil/parmesan/oregano labeled "Dairy" or "Umami" loses what
# it actually means (Italian aromatics).
_GENERIC_CATEGORIES = frozenset({
    "sugar", "fat", "egg", "sweetener", "thickener", "spice",
    "aromatic", "dairy", "spirit", "fruit", "vegetable", "grain",
    "protein", "herb", "nut", "umami", "citrus", "chili",
})


def auto_label(ingredients: list[dict], all_ingredients: dict,
               cuisine_map: dict[str, list[str]] | None = None,
               max_words: int = 3) -> str:
    """Generate a short descriptive cluster label.

    Cuisine-first strategy:
      1. If a cuisine has strong over-representation in the cluster
         (lift ≥ 1.5, count ≥ 3, present in top-5 ingredients), use
         that cuisine alone — it's what the cluster cooks-with.
      2. Otherwise prefer a non-generic ingredient category that
         survives the top-5 sanity check (e.g. "Wine", "Berry", "Noodle").
      3. Fall back to top-2 ingredient names ("Egg & Onion") — the pair
         captures the cluster's identity better than a single name.

    Cuisine signal is read from `cuisine_map` (public/data/cuisine_map.json),
    not from ingredients.json (which has empty cuisines arrays). "Global"
    is filtered — it's noise (sugar, butter, olive oil, milk are all Global).
    """
    n = len(ingredients)
    if n == 0:
        return "Mixed"

    cuisine_map = cuisine_map or {}

    cats: Counter[str] = Counter()
    cuisines: Counter[str] = Counter()
    for ing in ingredients:
        cat = (ing.get("category") or "").lower().strip()
        if cat:
            cats[cat] += 1
        name = ing.get("name", "")
        for c in cuisine_map.get(name, []) or []:
            cn = c.strip()
            if cn and cn.lower() != "global":
                cuisines[cn] += 1

    # Top ingredients (by pairing count) — these are what the UI surfaces.
    # Any label MUST match what's visibly shown.
    top = sorted(ingredients, key=lambda x: x.get("totalCount", 0) or 0, reverse=True)
    top_5 = top[:5]
    top_5_cats = {(t.get("category") or "").lower().strip() for t in top_5}
    top_5_cuisines: set[str] = set()
    for t in top_5:
        for c in cuisine_map.get(t.get("name", ""), []) or []:
            cn = c.strip()
            if cn and cn.lower() != "global":
                top_5_cuisines.add(cn)

    # Cuisine lift over global frequency
    global_cuisines: Counter[str] = Counter()
    for cms in cuisine_map.values():
        for c in cms or []:
            cn = c.strip()
            if cn and cn.lower() != "global":
                global_cuisines[cn] += 1
    total_gc = sum(global_cuisines.values()) or 1

    # Cuisine selection: rank by raw COUNT (not lift). Lift acts only as
    # a relevance floor — globally rare cuisines like Peruvian/Australian
    # produce huge lift spikes for any modest co-occurrence, drowning out
    # canonical Italian/Mexican/Chinese identities. Adding a 15%-of-cluster
    # presence floor ensures we only label a cluster by cuisine when that
    # cuisine truly dominates, not when it's just one of several near-ties.
    CLUSTER_PRESENCE_FLOOR = 0.15
    LIFT_FLOOR = 1.5
    presence_min = max(3, int(n * CLUSTER_PRESENCE_FLOOR))

    # The top_5_cuisines set (built above) is too strict to use as a hard
    # filter: top ingredients like "vanilla" / "pecan" / "olive oil" have
    # empty or Global-only cuisine tags, which pre-excludes legitimate
    # dominant cuisines. We rely instead on the presence + lift floors
    # below — those keep noise out without depending on cuisine being
    # tagged on top-5 ingredients.
    _ = top_5_cuisines  # retained for diagnostics; not used in decision

    best_cuisine: str | None = None
    best_cuisine_count = 0
    best_cuisine_lift = 0.0
    for cuis, count in cuisines.most_common(20):
        if count < presence_min:
            continue
        cluster_rate = count / n
        global_rate = global_cuisines.get(cuis, 1) / total_gc
        lift = cluster_rate / max(global_rate, 0.001)
        if lift < LIFT_FLOOR:
            continue
        # Primary score: count. Tiebreaker: lift.
        if count > best_cuisine_count or (count == best_cuisine_count and lift > best_cuisine_lift):
            best_cuisine = cuis
            best_cuisine_count = count
            best_cuisine_lift = lift

    if best_cuisine:
        return best_cuisine

    # Otherwise look for a non-generic category.
    global_cats: Counter[str] = Counter()
    for v in all_ingredients.values():
        if isinstance(v, dict):
            gc = (v.get("category") or "").lower().strip()
            if gc:
                global_cats[gc] += 1
    total_global = sum(global_cats.values()) or 1

    best_cat: str | None = None
    best_lift = 0.0
    for cat, count in cats.most_common(5):
        if cat in _GENERIC_CATEGORIES:
            continue
        cluster_rate = count / n
        global_rate = global_cats.get(cat, 1) / total_global
        lift = cluster_rate / max(global_rate, 0.001)
        if lift > best_lift and count >= 5 and cat in top_5_cats:
            best_lift = lift
            best_cat = cat

    if best_cat and best_lift > 1.3:
        return best_cat.title()

    # Fallback: top-2 ingredient pair. "Egg & Onion" reads better than
    # "Protein" or "Egg & friends" — the pair captures the cluster's
    # cooking-with-what gestalt for clusters without a cuisine identity.
    # Use full ingredient names (title-cased) so multi-word names like
    # "vegetable oil" stay intact rather than collapsing to "Vegetable".
    if len(top) >= 2:
        a = top[0]["name"].title()
        b = top[1]["name"].title()
        if a.lower() != b.lower():
            return f"{a} & {b}"
        return a
    if top:
        return top[0]["name"].title()
    return "Mixed"


def main() -> int:
    import networkx as nx  # noqa: PLC0415
    import numpy as np  # noqa: PLC0415
    from node2vec import Node2Vec  # noqa: PLC0415
    from sklearn.cluster import KMeans  # noqa: PLC0415

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

    # Cuisine signal lives in public/data/cuisine_map.json — ingredients.json
    # ships with empty cuisines arrays. Without this map auto_label cannot
    # find the cuisine identity of a cluster (the original cause of the
    # "Dairy" mislabel for what is really an Italian aromatics cluster).
    cuisine_map: dict[str, list[str]] = {}
    cuisine_path = root / "public" / "data" / "cuisine_map.json"
    if cuisine_path.exists():
        with cuisine_path.open("r", encoding="utf-8") as fh:
            cuisine_map = json.load(fh)
        print(f"[clusters] cuisine_map: {len(cuisine_map)} ingredients")
    else:
        print(f"[clusters] WARNING: {cuisine_path} not found — cuisine signal disabled")

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

        label_text = auto_label(member_data, ingredients_data, cuisine_map=cuisine_map)
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
