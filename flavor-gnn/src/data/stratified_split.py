"""stratified_split.py — N3-GAT-CLUSTERS phase D1.

Stratified edge split for link prediction on the ingredient pairing graph.

Standard random edge splits (PyG's RandomLinkSplit) hold out edges
uniformly. On a graph with heavy-tailed degree distribution (a few
hubs with 100s of edges, a long tail with 1-4 edges each), this risks
orphaning low-degree nodes — they lose all edges to val+test and the
GAT can't learn meaningful embeddings for them.

This splitter enforces a per-node retention bound: no node loses more
than `max_node_loss` fraction of its edges to val+test combined.

Algorithm:
  1. Compute the directed edge list (one direction only — caller is
     responsible for converting to bidirectional after split).
  2. Compute each node's degree in the directed edge list.
  3. Shuffle edges deterministically (seeded).
  4. Walk edges; for each, propose moving to val (if val quota not
     full) or test (if test quota not full). Accept only if both
     endpoints would still satisfy `max_node_loss` after the move.
     Else keep in train.
  5. Return three disjoint edge index tensors.

The returned edges are DIRECTED (one direction). The caller (training
loop) should:
  - Use `train_pos_edges` as positive examples for link prediction
  - Pass the bidirectional version into the GAT encoder's message
    passing (negative sampling and decoding work on the directed form)
"""
from __future__ import annotations
from collections import defaultdict
from typing import NamedTuple

import torch


class EdgeSplit(NamedTuple):
    train: torch.Tensor   # [2, E_train]
    val: torch.Tensor     # [2, E_val]
    test: torch.Tensor    # [2, E_test]


def _directed_unique(edge_index: torch.Tensor) -> torch.Tensor:
    """Collapse a bidirectional edge_index to one direction per undirected edge."""
    src, dst = edge_index[0].tolist(), edge_index[1].tolist()
    seen = set()
    keep_src, keep_dst = [], []
    for a, b in zip(src, dst):
        key = (a, b) if a < b else (b, a)
        if key in seen:
            continue
        seen.add(key)
        keep_src.append(key[0]); keep_dst.append(key[1])
    return torch.tensor([keep_src, keep_dst], dtype=torch.long)


def stratified_edge_split(
    edge_index: torch.Tensor,
    num_nodes: int,
    val_ratio: float = 0.10,
    test_ratio: float = 0.10,
    max_node_loss: float = 0.30,
    seed: int = 42,
) -> EdgeSplit:
    """Split directed/bidirectional edge_index into train/val/test.

    Returns EdgeSplit with DIRECTED edge tensors (one direction each).
    """
    if not (0.0 < val_ratio < 1.0 and 0.0 < test_ratio < 1.0):
        raise ValueError("val_ratio and test_ratio must be in (0, 1)")
    if val_ratio + test_ratio >= 1.0:
        raise ValueError("val_ratio + test_ratio must be < 1.0")
    if not (0.0 < max_node_loss < 1.0):
        raise ValueError("max_node_loss must be in (0, 1)")

    directed = _directed_unique(edge_index)
    num_edges = directed.size(1)
    if num_edges == 0:
        empty = torch.empty((2, 0), dtype=torch.long)
        return EdgeSplit(empty, empty.clone(), empty.clone())

    degree = defaultdict(int)
    for i in range(num_edges):
        degree[directed[0, i].item()] += 1
        degree[directed[1, i].item()] += 1

    target_val = int(round(num_edges * val_ratio))
    target_test = int(round(num_edges * test_ratio))

    g = torch.Generator().manual_seed(seed)
    perm = torch.randperm(num_edges, generator=g).tolist()

    holdout_for_node = defaultdict(int)
    train_idx, val_idx, test_idx = [], [], []

    def node_cap(n: int) -> int:
        return int(degree[n] * max_node_loss)

    for ei in perm:
        a = directed[0, ei].item()
        b = directed[1, ei].item()
        can_holdout = (holdout_for_node[a] + 1 <= node_cap(a)
                       and holdout_for_node[b] + 1 <= node_cap(b))
        if len(val_idx) < target_val and can_holdout:
            val_idx.append(ei)
            holdout_for_node[a] += 1
            holdout_for_node[b] += 1
        elif len(test_idx) < target_test and can_holdout:
            test_idx.append(ei)
            holdout_for_node[a] += 1
            holdout_for_node[b] += 1
        else:
            train_idx.append(ei)

    def gather(indices):
        if not indices:
            return torch.empty((2, 0), dtype=torch.long)
        idx_t = torch.tensor(indices, dtype=torch.long)
        return directed[:, idx_t]

    return EdgeSplit(gather(train_idx), gather(val_idx), gather(test_idx))


def to_bidirectional(edge_index: torch.Tensor) -> torch.Tensor:
    """Convert directed edge tensor [2, E] to bidirectional [2, 2E]."""
    if edge_index.numel() == 0:
        return edge_index.clone()
    return torch.cat([edge_index, edge_index.flip(0)], dim=1)


if __name__ == "__main__":
    from src.data.build_pyg_data import build_pyg_data
    data, _ = build_pyg_data()
    print(f"num_nodes = {data.num_nodes}")
    print(f"bidirectional edges in: {data.edge_index.size(1)}")
    split = stratified_edge_split(
        data.edge_index, num_nodes=data.num_nodes, seed=42
    )
    total = sum(t.size(1) for t in split)
    print(f"undirected edges total: {total}")
    print(f"train: {split.train.size(1)} ({split.train.size(1)/total:.1%})")
    print(f"val:   {split.val.size(1)} ({split.val.size(1)/total:.1%})")
    print(f"test:  {split.test.size(1)} ({split.test.size(1)/total:.1%})")
