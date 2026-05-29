"""Unit tests for GATLinkPredictor + short training-converges sanity."""
from __future__ import annotations

import torch
import torch.nn.functional as F
from torch_geometric.utils import negative_sampling

from src.models.gat_link import GATLinkPredictor


def _toy_graph():
    """Two communities of 10 nodes each. Features differ by community
    (so the GAT can actually learn). Edges only within community."""
    torch.manual_seed(0)
    n_per = 10
    feat_a = torch.randn(n_per, 32) * 0.3 + 2.0
    feat_b = torch.randn(n_per, 32) * 0.3 - 2.0
    x = torch.cat([feat_a, feat_b], dim=0)
    edges = []
    for i in range(n_per):
        for j in range(i + 1, n_per):
            edges.append((i, j))
            edges.append((i + n_per, j + n_per))
    src = torch.tensor([e[0] for e in edges])
    dst = torch.tensor([e[1] for e in edges])
    edge_index = torch.stack([torch.cat([src, dst]), torch.cat([dst, src])])
    edge_attr = torch.ones(edge_index.size(1), 1)
    pairs = torch.stack([src, dst])
    return x, edge_index, edge_attr, pairs


def test_encode_shape():
    x, ei, ea, _ = _toy_graph()
    model = GATLinkPredictor(in_dim=32, hidden=64, embed=32, heads=4, dropout=0.0)
    h = model.encode(x, ei, ea)
    assert h.shape == (x.size(0), 32)


def test_decode_shape_and_values():
    x, ei, ea, pairs = _toy_graph()
    model = GATLinkPredictor(in_dim=32, hidden=64, embed=32, heads=4, dropout=0.0)
    h = model.encode(x, ei, ea)
    logits = model.decode(h, pairs)
    assert logits.shape == (pairs.size(1),)
    assert torch.isfinite(logits).all()


def test_forward_equiv_to_encode_decode():
    x, ei, ea, pairs = _toy_graph()
    torch.manual_seed(123)
    model = GATLinkPredictor(in_dim=32, hidden=64, embed=32, heads=4, dropout=0.0)
    model.eval()
    with torch.no_grad():
        a = model(x, ei, ea, pairs)
        b = model.decode(model.encode(x, ei, ea), pairs)
    assert torch.allclose(a, b)


def test_hidden_divisibility_validated():
    import pytest
    with pytest.raises(ValueError):
        GATLinkPredictor(in_dim=32, hidden=65, embed=32, heads=4)


def test_training_step_reduces_loss_on_toy_graph():
    """One-shot sanity: 50 epochs of training should reduce loss substantially."""
    x, ei, ea, pairs = _toy_graph()
    model = GATLinkPredictor(in_dim=32, hidden=64, embed=32, heads=4, dropout=0.0)
    opt = torch.optim.Adam(model.parameters(), lr=1e-2)
    losses = []
    for _ in range(50):
        model.train()
        opt.zero_grad()
        h = model.encode(x, ei, ea)
        pos_logits = model.decode(h, pairs)
        neg = negative_sampling(
            edge_index=pairs, num_nodes=x.size(0), num_neg_samples=pairs.size(1)
        )
        neg_logits = model.decode(h, neg)
        logits = torch.cat([pos_logits, neg_logits])
        labels = torch.cat([
            torch.ones(pos_logits.size(0)),
            torch.zeros(neg_logits.size(0)),
        ])
        loss = F.binary_cross_entropy_with_logits(logits, labels)
        loss.backward()
        opt.step()
        losses.append(loss.item())
    assert losses[-1] < losses[0] * 0.7, \
        f"loss did not reduce: start={losses[0]:.4f}, end={losses[-1]:.4f}"
