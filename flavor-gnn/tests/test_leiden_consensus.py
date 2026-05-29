"""Unit tests for Leiden consensus + Jaccard math."""
from __future__ import annotations

import numpy as np

from scripts.leiden_consensus import (
    build_cosine_knn, partition_jaccard, leiden_consensus, _leiden_partition,
)


def test_partition_jaccard_identical():
    p = [0, 0, 1, 1, 2, 2]
    assert partition_jaccard(p, p) == 1.0


def test_partition_jaccard_disjoint():
    p1 = [0, 0, 0, 0]
    p2 = [0, 1, 2, 3]
    assert partition_jaccard(p1, p2) == 0.0


def test_partition_jaccard_partial():
    p1 = [0, 0, 1, 1]
    p2 = [0, 0, 0, 1]
    # i<j pairs: (0,1):T+T=both | (0,2):F+T=only-p2 | (0,3):F+F=neither
    #            (1,2):F+T=only-p2 | (1,3):F+F=neither | (2,3):T+F=only-p1
    # both=1, either=4 → 0.25
    assert partition_jaccard(p1, p2) == 0.25


def test_build_cosine_knn_symmetric_and_within_unit():
    np.random.seed(0)
    emb = np.random.randn(20, 8).astype(np.float32)
    adj = build_cosine_knn(emb, k=4)
    assert adj.shape == (20, 20)
    assert (adj.diagonal() == 0).all()
    # Symmetry is by max() — adj[i,j] is the max of (i->j) and (j->i) edge weights
    # but they're equal because the underlying sim matrix is symmetric
    assert np.allclose(adj, adj.T)
    assert (adj <= 1.0 + 1e-6).all()
    assert (adj >= 0.0).all()


def test_leiden_partition_runs_on_two_cliques():
    """A graph with two clear cliques should produce 2 clusters."""
    n = 20
    adj = np.zeros((n, n), dtype=np.float32)
    for i in range(10):
        for j in range(i + 1, 10):
            adj[i, j] = adj[j, i] = 1.0
    for i in range(10, 20):
        for j in range(i + 1, 20):
            adj[i, j] = adj[j, i] = 1.0
    p = _leiden_partition(adj, resolution=1.0, seed=0)
    assert len(p) == n
    assert len(set(p)) == 2
    assert len(set(p[:10])) == 1
    assert len(set(p[10:])) == 1


def test_leiden_consensus_passes_gate_on_two_cliques():
    """Two well-separated cliques should produce stable partitions across seeds."""
    np.random.seed(0)
    emb_a = np.random.randn(15, 32).astype(np.float32) * 0.1 + 5.0
    emb_b = np.random.randn(15, 32).astype(np.float32) * 0.1 - 5.0
    emb = np.concatenate([emb_a, emb_b], axis=0)
    final, info = leiden_consensus(
        emb, k_neighbors=4, n_seeds=5, resolution=1.0,
        jaccard_gate=0.85, raise_on_gate=False,
    )
    assert len(final) == 30
    assert info["k"] == 2
    assert info["gate_passed"] is True
    assert info["jaccard_min"] >= 0.85
