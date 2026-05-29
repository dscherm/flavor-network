"""leiden_consensus.py — N3-GAT-CLUSTERS phase D3.

Cluster 32d GAT embeddings via Leiden community detection on the
cosine-kNN graph, with stability gating across 10 seeds.

Algorithm:
  1. cosine-normalize embeddings, build kNN graph (k=15)
  2. Run Leiden 10× with different seeds → 10 partitions
  3. Compute pairwise Jaccard on co-membership matrix; gate at ≥ 0.85
  4. Build consensus matrix (per-pair co-cluster fraction across seeds)
  5. Run final Leiden on consensus matrix → partition
  6. Return final membership + jaccard distribution
"""
from __future__ import annotations

import numpy as np
import igraph as ig
import leidenalg


def build_cosine_knn(embeddings: np.ndarray, k: int = 15) -> np.ndarray:
    """Cosine-normalized symmetric kNN weighted adjacency matrix.

    Returns dense [N, N] adjacency with cosine-similarity weights.
    Each node is connected to its top-k cosine neighbors; symmetrized
    by max(weight_ij, weight_ji).
    """
    n = embeddings.shape[0]
    norm = embeddings / (np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-8)
    sim = norm @ norm.T
    np.fill_diagonal(sim, -np.inf)
    topk_idx = np.argpartition(sim, -k, axis=1)[:, -k:]
    adj = np.zeros((n, n), dtype=np.float32)
    for i in range(n):
        for j in topk_idx[i]:
            w = float(max(sim[i, j], 0.0))
            adj[i, j] = w
            if w > adj[j, i]:
                adj[j, i] = w
    return adj


def _leiden_partition(adj: np.ndarray, resolution: float, seed: int) -> list[int]:
    n = adj.shape[0]
    src_list, dst_list, w_list = [], [], []
    for i in range(n):
        for j in range(i + 1, n):
            w = float(adj[i, j])
            if w > 0:
                src_list.append(i)
                dst_list.append(j)
                w_list.append(w)
    g = ig.Graph(n=n, edges=list(zip(src_list, dst_list)), directed=False)
    g.es["weight"] = w_list
    p = leidenalg.find_partition(
        g,
        leidenalg.RBConfigurationVertexPartition,
        weights="weight",
        resolution_parameter=resolution,
        seed=seed,
    )
    return list(p.membership)


def partition_jaccard(p1, p2) -> float:
    """Pair-counting Jaccard between two partitions.

    For each pair (i, j), count whether they're in the same cluster in
    both / either / neither. Jaccard = |both| / |either|.
    """
    n = len(p1)
    p1 = np.asarray(p1)
    p2 = np.asarray(p2)
    same1 = (p1[:, None] == p1[None, :])
    same2 = (p2[:, None] == p2[None, :])
    iu = np.triu_indices(n, k=1)
    both = int((same1[iu] & same2[iu]).sum())
    either = int((same1[iu] | same2[iu]).sum())
    return both / max(either, 1)


def leiden_consensus(
    embeddings: np.ndarray,
    k_neighbors: int = 15,
    n_seeds: int = 10,
    resolution: float = 1.0,
    jaccard_gate: float = 0.85,
    raise_on_gate: bool = True,
):
    """Run Leiden×n_seeds, gate on Jaccard, return final consensus partition.

    Returns:
        membership: list[int] of length N
        info: dict with
            - jaccards: list of pairwise Jaccard scores
            - jaccard_min, jaccard_mean
            - k: auto-discovered cluster count
            - gate_passed: bool
            - seeds_run: int
    """
    adj = build_cosine_knn(embeddings, k=k_neighbors)
    partitions = [
        _leiden_partition(adj, resolution=resolution, seed=s)
        for s in range(n_seeds)
    ]

    jaccs: list[float] = []
    for i in range(n_seeds):
        for j in range(i + 1, n_seeds):
            jaccs.append(partition_jaccard(partitions[i], partitions[j]))
    j_min = float(min(jaccs)) if jaccs else 0.0
    j_mean = float(sum(jaccs) / len(jaccs)) if jaccs else 0.0
    gate_passed = j_min >= jaccard_gate

    if not gate_passed and raise_on_gate:
        raise RuntimeError(
            f"Stability gate FAIL: min Jaccard {j_min:.3f} < {jaccard_gate}. "
            f"Mean {j_mean:.3f}. Distribution: "
            f"min={j_min:.3f}, p25={float(np.percentile(jaccs,25)):.3f}, "
            f"p50={float(np.percentile(jaccs,50)):.3f}, p75={float(np.percentile(jaccs,75)):.3f}"
        )

    n = len(partitions[0])
    consensus = np.zeros((n, n), dtype=np.float32)
    for p in partitions:
        arr = np.asarray(p)
        consensus += (arr[:, None] == arr[None, :]).astype(np.float32)
    consensus /= n_seeds
    np.fill_diagonal(consensus, 0.0)

    final = _leiden_partition(consensus, resolution=resolution, seed=42)
    k_found = len(set(final))

    info = {
        "jaccards": jaccs,
        "jaccard_min": j_min,
        "jaccard_mean": j_mean,
        "k": k_found,
        "gate_passed": gate_passed,
        "seeds_run": n_seeds,
    }
    return final, info


if __name__ == "__main__":
    from pathlib import Path
    ARTIFACTS = Path(__file__).resolve().parents[1] / "artifacts"
    emb = np.load(ARTIFACTS / "gat_link_v1_embeddings.npy")
    print(f"loaded embeddings: shape={emb.shape}")
    membership, info = leiden_consensus(emb, raise_on_gate=False)
    from collections import Counter
    sizes = sorted(Counter(membership).values(), reverse=True)
    print(f"k={info['k']}  jaccard_min={info['jaccard_min']:.3f}  jaccard_mean={info['jaccard_mean']:.3f}")
    print(f"gate_passed={info['gate_passed']}")
    print(f"cluster sizes: {sizes}")
