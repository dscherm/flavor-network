"""Unit tests for build_pyg_data."""
from __future__ import annotations
import json
from pathlib import Path

import torch

from src.data.build_pyg_data import (
    build_pyg_data,
    AROMA_KEYS, TASTE_KEYS, LEAVES_K, EXCLUDED_LEAVES,
    _multi_hot, _select_top_leaves,
)


def test_multi_hot_basic():
    vocab = ["a", "b", "c"]
    assert _multi_hot(["a", "c"], vocab) == [1.0, 0.0, 1.0]
    assert _multi_hot([], vocab) == [0.0, 0.0, 0.0]
    assert _multi_hot(None, vocab) == [0.0, 0.0, 0.0]
    assert _multi_hot(["A", "B"], vocab) == [1.0, 1.0, 0.0]


def test_select_top_leaves_excludes_overfrequent_and_overlap():
    fg_nodes = [
        {"leaves": ["alcoholic"] * 100 + ["ethereal"] * 100 + ["camphor", "coconut"]},
        {"leaves": ["camphor", "menthol", "fruity", "pungent"]},
        {"leaves": ["menthol", "cocoa"]},
    ] + [{"leaves": ["camphor"]} for _ in range(50)]
    picked = _select_top_leaves(fg_nodes, k=5)
    for x in EXCLUDED_LEAVES:
        assert x not in picked
    for k in AROMA_KEYS + TASTE_KEYS:
        assert k not in picked
    assert "camphor" in picked
    assert "menthol" in picked


def test_select_top_leaves_respects_k():
    fg_nodes = [{"leaves": [f"unique_{i}"]} for i in range(20)]
    picked = _select_top_leaves(fg_nodes, k=5)
    assert len(picked) == 5


def test_build_pyg_data_shapes_and_invariants():
    data, name_to_idx = build_pyg_data()
    m = data._meta

    assert m["feature_dim"] == 32, f"expected 32d features, got {m['feature_dim']}"
    assert m["feature_dim"] == len(AROMA_KEYS) + len(TASTE_KEYS) + LEAVES_K

    assert m["node_count"] > 0
    assert m["node_count"] == len(name_to_idx)
    assert m["node_count"] == data.x.size(0)

    assert data.x.shape == (m["node_count"], m["feature_dim"])
    assert data.x.dtype == torch.float32

    assert data.edge_index.dtype == torch.long
    assert data.edge_index.shape[0] == 2
    assert data.edge_index.size(1) == data.edge_attr.size(0)
    assert data.edge_attr.size(1) == 1

    assert data.edge_index.size(1) % 2 == 0, "directed pairs must come in (a,b)+(b,a)"

    assert data.edge_index.min() >= 0
    assert data.edge_index.max() < m["node_count"]


def test_build_pyg_data_features_are_binary():
    data, _ = build_pyg_data()
    unique_vals = torch.unique(data.x).tolist()
    assert set(unique_vals).issubset({0.0, 1.0}), \
        f"features must be 0/1 multi-hot, found {unique_vals[:10]}"


def test_build_pyg_data_edge_attr_in_unit_range():
    data, _ = build_pyg_data()
    assert data.edge_attr.min().item() >= 0.0
    assert data.edge_attr.max().item() <= 1.0


def test_build_pyg_data_no_self_loops():
    data, _ = build_pyg_data()
    src, dst = data.edge_index
    self_loops = (src == dst).sum().item()
    assert self_loops == 0, f"unexpected {self_loops} self-loops"


def test_build_pyg_data_canonical_universe_is_intersection():
    data, name_to_idx = build_pyg_data()
    repo = Path(__file__).resolve().parents[2]
    pro = repo / "public" / "proDataset"
    fg = json.loads((pro / "flavor_graph_data_v3.json").read_text(encoding="utf-8"))
    ing = json.loads((pro / "ingredients.json").read_text(encoding="utf-8"))
    pairings = json.loads((pro / "pairings.json").read_text(encoding="utf-8"))

    fg_names = set(n["name"] for n in fg.get("nodes", []))
    ing_names = set(ing)
    endpoints = set()
    for e in pairings:
        endpoints.add(e.get("ingredientA"))
        endpoints.add(e.get("ingredientB"))
    expected = fg_names & ing_names & endpoints

    assert set(name_to_idx.keys()) == expected, \
        f"name universe mismatch: in-mapping {len(name_to_idx)} vs expected {len(expected)}"


def test_leaves_vocab_disjoint_from_aroma_and_taste():
    data, _ = build_pyg_data()
    leaves_vocab = data._meta["leaves_vocab"]  # noqa: F841 — read via _meta below
    assert len(leaves_vocab) == LEAVES_K
    assert set(leaves_vocab).isdisjoint(AROMA_KEYS)
    assert set(leaves_vocab).isdisjoint(TASTE_KEYS)
    assert set(leaves_vocab).isdisjoint(EXCLUDED_LEAVES)
