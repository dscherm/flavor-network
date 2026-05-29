"""Unit tests for stratified_edge_split."""
from __future__ import annotations
from collections import defaultdict

import torch

from src.data.build_pyg_data import build_pyg_data
from src.data.stratified_split import (
    stratified_edge_split, to_bidirectional, _directed_unique,
)


def _make_bidirectional(pairs):
    src, dst = [], []
    for a, b in pairs:
        src.extend([a, b])
        dst.extend([b, a])
    return torch.tensor([src, dst], dtype=torch.long)


def test_directed_unique_collapses_bidirectional():
    edge_index = _make_bidirectional([(0, 1), (1, 2), (2, 0)])
    out = _directed_unique(edge_index)
    assert out.size(1) == 3
    pairs = set()
    for i in range(out.size(1)):
        a, b = out[0, i].item(), out[1, i].item()
        pairs.add(tuple(sorted([a, b])))
    assert pairs == {(0, 1), (1, 2), (0, 2)}


def test_split_ratios_within_tolerance():
    pairs = [(i, j) for i in range(20) for j in range(i + 1, 20)]
    edge_index = _make_bidirectional(pairs)
    split = stratified_edge_split(
        edge_index, num_nodes=20, val_ratio=0.10, test_ratio=0.10, seed=0
    )
    total = split.train.size(1) + split.val.size(1) + split.test.size(1)
    assert total == len(pairs)
    assert abs(split.val.size(1) / total - 0.10) < 0.05
    assert abs(split.test.size(1) / total - 0.10) < 0.05


def test_split_disjoint():
    pairs = [(i, j) for i in range(15) for j in range(i + 1, 15)]
    edge_index = _make_bidirectional(pairs)
    split = stratified_edge_split(edge_index, num_nodes=15, seed=1)

    def as_set(t):
        return set(tuple(sorted([t[0, i].item(), t[1, i].item()]))
                   for i in range(t.size(1)))

    s_tr, s_va, s_te = as_set(split.train), as_set(split.val), as_set(split.test)
    assert s_tr.isdisjoint(s_va)
    assert s_tr.isdisjoint(s_te)
    assert s_va.isdisjoint(s_te)


def test_split_seed_reproducible():
    pairs = [(i, j) for i in range(12) for j in range(i + 1, 12)]
    edge_index = _make_bidirectional(pairs)
    a = stratified_edge_split(edge_index, num_nodes=12, seed=42)
    b = stratified_edge_split(edge_index, num_nodes=12, seed=42)
    assert torch.equal(a.train, b.train)
    assert torch.equal(a.val, b.val)
    assert torch.equal(a.test, b.test)


def test_max_node_loss_bound_respected_on_real_graph():
    """No node loses more than 30% of its edges to val+test combined."""
    data, _ = build_pyg_data()
    split = stratified_edge_split(
        data.edge_index, num_nodes=data.num_nodes,
        val_ratio=0.10, test_ratio=0.10, max_node_loss=0.30, seed=42,
    )

    directed = _directed_unique(data.edge_index)
    full_degree = defaultdict(int)
    for i in range(directed.size(1)):
        full_degree[directed[0, i].item()] += 1
        full_degree[directed[1, i].item()] += 1

    holdout_degree = defaultdict(int)
    for tensor in (split.val, split.test):
        for i in range(tensor.size(1)):
            holdout_degree[tensor[0, i].item()] += 1
            holdout_degree[tensor[1, i].item()] += 1

    over_cap = 0
    for n, h in holdout_degree.items():
        cap = int(full_degree[n] * 0.30)
        if h > cap:
            over_cap += 1
    assert over_cap == 0, f"{over_cap} nodes exceeded 30% holdout cap"


def test_split_degree_distribution_preserved():
    """Train degree distribution should track full degree distribution by decile."""
    data, _ = build_pyg_data()
    split = stratified_edge_split(
        data.edge_index, num_nodes=data.num_nodes, seed=42,
    )
    directed = _directed_unique(data.edge_index)

    def degree_of(tensor):
        d = defaultdict(int)
        for i in range(tensor.size(1)):
            d[tensor[0, i].item()] += 1
            d[tensor[1, i].item()] += 1
        return d

    full = degree_of(directed)
    train = degree_of(split.train)

    full_vals = sorted(full.values())
    train_vals = sorted(train.values())

    for q in [0.1, 0.3, 0.5, 0.7, 0.9]:
        fv = full_vals[int(len(full_vals) * q)]
        tv = train_vals[int(len(train_vals) * q)] if train_vals else 0
        if fv == 0:
            continue
        rel = abs(tv - fv * 0.80) / max(fv, 1)
        assert rel < 0.40, f"degree decile {q}: full={fv}, train={tv}, rel-error={rel:.2f}"


def test_to_bidirectional_doubles_edges():
    directed = torch.tensor([[0, 1, 2], [1, 2, 0]], dtype=torch.long)
    bi = to_bidirectional(directed)
    assert bi.size(1) == 6
    assert bi[0].tolist() == [0, 1, 2, 1, 2, 0]
    assert bi[1].tolist() == [1, 2, 0, 0, 1, 2]


def test_split_on_real_graph_smoke():
    data, _ = build_pyg_data()
    split = stratified_edge_split(
        data.edge_index, num_nodes=data.num_nodes, seed=42,
    )
    total = split.train.size(1) + split.val.size(1) + split.test.size(1)
    assert total > 1000
    assert split.train.size(1) > split.val.size(1)
    assert split.train.size(1) > split.test.size(1)
