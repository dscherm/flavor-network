"""Generate plain-English explanations for ingredient cluster membership.

For each cluster: why are these ingredients together?
For adjacent cluster pairs: what molecular patterns do they share?

Output: public/proDataset/cluster_explanations.json

Usage:
    python -m src.infer.explain_clusters
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

import numpy as np


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _norm(s):
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


def find_shared_compounds(foods_a: list[str], foods_b: list[str],
                          foodb: dict, flavordb_mols: dict, max_shared: int = 5) -> list[dict]:
    """Find flavor compounds shared between two sets of ingredients."""
    foodb_foods = foodb.get("foods", {})
    foodb_compounds = foodb.get("compounds", {})

    def get_compounds(food_names):
        cids = set()
        for name in food_names:
            key = _norm(name)
            for fn, info in foodb_foods.items():
                if _norm(fn) == key:
                    for cid in info.get("compounds", [])[:50]:
                        cids.add(str(cid))
                    break
        return cids

    cids_a = get_compounds(foods_a)
    cids_b = get_compounds(foods_b)
    shared = cids_a & cids_b

    results = []
    for cid in list(shared)[:max_shared * 3]:
        c = foodb_compounds.get(cid)
        if not c:
            continue
        name = c.get("name", "")
        if not name or len(name) < 3:
            continue
        # Find flavor tags from FlavorDB
        tags = []
        for pid, mol in flavordb_mols.items():
            if mol.get("name") and _norm(mol["name"]) == _norm(name):
                tags = mol.get("flavor_profile") or []
                break
        if tags:
            results.append({"name": name, "tags": tags[:3]})
        if len(results) >= max_shared:
            break
    return results


def explain_cluster(cluster: dict, ingredients_data: dict) -> str:
    """Generate a plain-English sentence about why this cluster exists."""
    top = cluster.get("top_ingredients", [])[:3]
    label = cluster.get("label", "Mixed")
    taste = cluster.get("dominant_taste", "")

    if len(top) >= 2:
        return (f"Ingredients like {top[0]}, {top[1]}, and {top[2] if len(top) > 2 else 'others'} "
                f"cluster here because they appear together in similar recipes. "
                f"This group tends toward {taste} flavors.")
    return f"A {label.lower()} cluster with {taste} flavor tendencies."


def explain_pair(cl_a: dict, cl_b: dict, shared: list[dict]) -> str:
    """Explain the molecular connection between two clusters."""
    if not shared:
        return (f"{cl_a['label']} and {cl_b['label']} are neighbors in recipe space "
                f"but don't share many identified flavor compounds.")

    compound_phrases = []
    for c in shared[:3]:
        tags_str = " and ".join(c["tags"][:2]) if c["tags"] else "flavor"
        compound_phrases.append(f"{c['name']} ({tags_str})")

    return (f"{cl_a['label']} and {cl_b['label']} ingredients share "
            f"{', '.join(compound_phrases)}. "
            f"These shared molecules explain why they pair well in recipes.")


def main() -> int:
    root = _project_root()

    with (root / "public" / "proDataset" / "cluster_labels.json").open("r", encoding="utf-8") as fh:
        cluster_data = json.load(fh)
    clusters = cluster_data.get("clusters", [])
    print(f"[explain] loaded {len(clusters)} clusters")

    with (root / "public" / "proDataset" / "ingredients.json").open("r", encoding="utf-8") as fh:
        ingredients_data = json.load(fh)

    try:
        with (root / "chemDataset" / "processed" / "foodb.json").open("r", encoding="utf-8") as fh:
            foodb = json.load(fh)
    except FileNotFoundError:
        foodb = {"foods": {}, "compounds": {}}

    try:
        with (root / "chemDataset" / "processed" / "flavordb.json").open("r", encoding="utf-8") as fh:
            flavordb = json.load(fh)
        flavordb_mols = flavordb.get("molecules", {})
    except FileNotFoundError:
        flavordb_mols = {}

    # Per-cluster explanations
    cluster_explanations = {}
    for cl in clusters:
        cluster_explanations[cl["id"]] = {
            "label": cl["label"],
            "explanation": explain_cluster(cl, ingredients_data),
            "top_ingredients": cl.get("top_ingredients", [])[:5],
            "dominant_taste": cl.get("dominant_taste", ""),
            "size": cl.get("size", 0),
        }
        print(f"  [{cl['id']}] {cl['label']}: {cluster_explanations[cl['id']]['explanation'][:80]}...")

    # Pair explanations — find adjacent clusters (closest centroids)
    pair_explanations = []
    centroids = np.array([cl["centroid_3d"] for cl in clusters])
    for i, cl_a in enumerate(clusters):
        dists = np.linalg.norm(centroids - centroids[i], axis=1)
        dists[i] = float('inf')
        nearest = int(np.argmin(dists))
        cl_b = clusters[nearest]

        shared = find_shared_compounds(
            cl_a.get("top_ingredients", []),
            cl_b.get("top_ingredients", []),
            foodb, flavordb_mols,
        )
        explanation = explain_pair(cl_a, cl_b, shared)
        pair_explanations.append({
            "cluster_a": cl_a["id"],
            "cluster_b": cl_b["id"],
            "shared_compounds": shared,
            "explanation": explanation,
        })
        print(f"  [{cl_a['id']}↔{cl_b['id']}] {explanation[:80]}...")

    # Ingredient → cluster mapping
    # Load cluster assignments
    ingredient_cluster = {}
    with (root / "public" / "proDataset" / "gnn_positions.json").open("r", encoding="utf-8") as fh:
        pos_data = json.load(fh)
    for name in ingredients_data:
        if name.startswith("_"):
            continue
        pos = pos_data.get(name)
        if not pos or not isinstance(pos, list):
            continue
        # Find nearest cluster centroid
        p = np.array(pos[:3] if len(pos) >= 3 else pos + [0])
        dists = np.linalg.norm(centroids - p, axis=1)
        nearest = int(np.argmin(dists))
        cl = clusters[nearest]
        ingredient_cluster[name] = {
            "cluster_id": cl["id"],
            "cluster_label": cl["label"],
        }

    out = {
        "clusters": cluster_explanations,
        "pairs": pair_explanations,
        "ingredient_clusters": ingredient_cluster,
        "_meta": {"n_clusters": len(clusters), "n_ingredients": len(ingredient_cluster)},
    }
    out_path = root / "public" / "proDataset" / "cluster_explanations.json"
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(out, fh)
    print(f"[explain] wrote {out_path} — {len(ingredient_cluster)} ingredients mapped to clusters")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
