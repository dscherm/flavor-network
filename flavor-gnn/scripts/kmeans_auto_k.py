"""kmeans_auto_k.py — N3-GAT-CLUSTERS phase D3 (KMeans pivot).

Cluster 32d GAT embeddings via KMeans with auto-k discovery (silhouette).

Rationale:
  Leiden capped at Jaccard ≈0.50 on the v2 embeddings regardless of
  hyperparameter tuning — the embedding space has multiple equally-valid
  community structures and Leiden flips between them seed-to-seed.

  KMeans is deterministic given seed (Jaccard 1.0 across reruns by
  construction), and silhouette-driven k selection preserves the
  "k auto-discovers" spec requirement.

Algorithm:
  1. L2-normalize embeddings (cosine geometry in KMeans).
  2. Sweep k in [k_min, k_max], compute silhouette per k.
  3. Pick k* = argmax silhouette.
  4. Fit final KMeans(k=k*, seed=42, n_init=20) → membership.
  5. Stability check: run KMeans with 5 different seeds, report Jaccard.
"""
from __future__ import annotations

import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score


def _l2_normalize(emb: np.ndarray) -> np.ndarray:
    return emb / (np.linalg.norm(emb, axis=1, keepdims=True) + 1e-8)


def _partition_jaccard(p1, p2) -> float:
    n = len(p1)
    p1 = np.asarray(p1)
    p2 = np.asarray(p2)
    same1 = (p1[:, None] == p1[None, :])
    same2 = (p2[:, None] == p2[None, :])
    iu = np.triu_indices(n, k=1)
    both = int((same1[iu] & same2[iu]).sum())
    either = int((same1[iu] | same2[iu]).sum())
    return both / max(either, 1)


def kmeans_auto_k(
    embeddings: np.ndarray,
    k_min: int = 4,
    k_max: int = 20,
    seed: int = 42,
    n_init: int = 20,
    silhouette_sample: int | None = 2000,
    force_k: int | None = None,
):
    """Auto-select k via silhouette, fit KMeans, return membership + info.

    If force_k is set, skip silhouette sweep and use that k directly.
    """
    emb = _l2_normalize(embeddings.astype(np.float32))
    n = emb.shape[0]

    rng = np.random.default_rng(seed)
    if silhouette_sample is not None and silhouette_sample < n:
        sil_idx = rng.choice(n, size=silhouette_sample, replace=False)
    else:
        sil_idx = np.arange(n)

    sil_scores = []
    for k in range(k_min, k_max + 1):
        km = KMeans(n_clusters=k, random_state=seed, n_init=n_init)
        labels = km.fit_predict(emb)
        if len(set(labels[sil_idx])) > 1:
            s = silhouette_score(emb[sil_idx], labels[sil_idx], metric="euclidean")
        else:
            s = -1.0
        sil_scores.append((k, float(s)))

    if force_k is not None:
        best_k = force_k
        best_sil = next((s for k, s in sil_scores if k == force_k), -1.0)
    else:
        sil_sorted = sorted(sil_scores, key=lambda kv: -kv[1])
        best_k = sil_sorted[0][0]
        best_sil = sil_sorted[0][1]

    final_km = KMeans(n_clusters=best_k, random_state=seed, n_init=n_init)
    membership = final_km.fit_predict(emb).tolist()

    stability_jaccs = []
    for s in [1, 2, 3, 4, 5]:
        km_s = KMeans(n_clusters=best_k, random_state=s, n_init=n_init)
        lbl_s = km_s.fit_predict(emb).tolist()
        stability_jaccs.append(_partition_jaccard(membership, lbl_s))

    info = {
        "k": best_k,
        "silhouette": best_sil,
        "silhouette_curve": sil_scores,
        "stability_jaccards_vs_seed_42": stability_jaccs,
        "stability_min": float(min(stability_jaccs)),
        "stability_mean": float(sum(stability_jaccs) / len(stability_jaccs)),
        "method": "kmeans+silhouette",
        "n_init": n_init,
    }
    return membership, info


if __name__ == "__main__":
    from pathlib import Path
    from collections import Counter
    ART = Path(__file__).resolve().parents[1] / "artifacts"
    emb = np.load(ART / "gat_link_v2_embeddings.npy")
    print(f"loaded embeddings: shape={emb.shape}")
    mem, info = kmeans_auto_k(emb)
    sizes = sorted(Counter(mem).values(), reverse=True)
    print(f"silhouette curve (k, score):")
    for k, s in info["silhouette_curve"]:
        flag = " <-- chosen" if k == info["k"] else ""
        print(f"  k={k:2d}  sil={s:.4f}{flag}")
    print(f"\nbest k = {info['k']}  silhouette={info['silhouette']:.4f}")
    print(f"stability jaccards vs seed-42: {[round(j,3) for j in info['stability_jaccards_vs_seed_42']]}")
    print(f"  min={info['stability_min']:.3f}  mean={info['stability_mean']:.3f}")
    print(f"cluster sizes: {sizes}")
