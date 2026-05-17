"""Experiment: cluster ingredients on GNN flavor vectors (taste + aroma).

Read-only — writes nothing. Reports per-cluster contents + mean flavor profile
so we can decide whether a flavor-pure cluster layer is worth investing in.

Run: .venv/Scripts/python.exe scripts/flavor_cluster_experiment.py
"""
import json
from collections import Counter
from pathlib import Path

import numpy as np
from sklearn.cluster import KMeans

ROOT = Path(__file__).resolve().parents[2]
ENTROPY = ROOT / "public" / "proDataset" / "gnn_entropy.json"
INGREDIENTS = ROOT / "public" / "proDataset" / "ingredients.json"

TASTE_AXES = ["sweet", "bitter", "umami", "salty", "sour"]
ODOR_AXES = [
    "odor_fruity", "odor_floral", "odor_green",
    "odor_woody", "odor_spicy", "odor_fatty",
]
ALL_AXES = TASTE_AXES + ODOR_AXES


def load_features():
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


def main(k: int = 16):
    names, X = load_features()
    ingredients = json.loads(INGREDIENTS.read_text(encoding="utf-8"))
    print(f"[exp] Feature matrix: {X.shape} | k={k}")

    # z-score normalize per dimension so no axis dominates
    mean = X.mean(axis=0)
    std = X.std(axis=0)
    X_norm = (X - mean) / (std + 1e-8)

    print(f"[exp] Global mean per axis:")
    for ax, m in zip(ALL_AXES, mean):
        print(f"    {ax:14s} mean={m*100:5.1f}%  std={std[ALL_AXES.index(ax)]*100:5.1f}%")

    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = km.fit_predict(X_norm)

    # Per-cluster report
    for cid in range(k):
        mask = labels == cid
        member_idx = np.where(mask)[0]
        if len(member_idx) == 0:
            continue
        # Order members by closeness to centroid in normalized space
        centroid_norm = km.cluster_centers_[cid]
        dists = np.linalg.norm(X_norm[mask] - centroid_norm, axis=1)
        order = dists.argsort()
        sorted_members = [names[member_idx[i]] for i in order]

        # Mean profile in *raw probability* space
        cluster_X = X[mask]
        mean_profile = cluster_X.mean(axis=0)
        # Differential: how this cluster deviates from global mean
        delta = mean_profile - mean
        # Top axes by deviation
        ax_order = (-np.abs(delta)).argsort()
        top_axes = [(ALL_AXES[i], mean_profile[i], delta[i]) for i in ax_order[:5]]

        # Curated taste + category of top-20 members for sanity
        tastes, cats = Counter(), Counter()
        for m in sorted_members[:20]:
            node = ingredients.get(m) or {}
            for t in (node.get("taste") or "").lower().split(","):
                t = t.strip()
                if t:
                    tastes[t] += 1
            cat = (node.get("category") or "").lower().strip()
            if cat:
                cats[cat] += 1

        print(f"\n=== c{cid} n={len(member_idx)} ===")
        print(f"  top 10: {', '.join(sorted_members[:10])}")
        print(f"  profile (raw): " + " | ".join(
            f"{ax}={v*100:.0f}% (Δ{d*100:+.1f})" for ax, v, d in top_axes
        ))
        print(f"  curated taste (top-20 members): "
              + ", ".join(f"{k_}={v_}" for k_, v_ in tastes.most_common(4)))
        print(f"  categories  (top-20 members): "
              + ", ".join(f"{k_}={v_}" for k_, v_ in cats.most_common(4)))


if __name__ == "__main__":
    import sys
    k = int(sys.argv[1]) if len(sys.argv) > 1 else 16
    main(k)
