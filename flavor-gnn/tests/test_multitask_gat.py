"""Unit tests for MultiTaskGAT (Encoder + heads)."""
from __future__ import annotations

import torch
import torch.nn.functional as F
from torch_geometric.utils import negative_sampling

from src.models.multitask_gat import (
    Encoder, LinkHead, TierOneHead, ReconHead, MultiTaskGAT,
)


def _toy_graph():
    torch.manual_seed(0)
    n_per = 10
    fa = torch.randn(n_per, 32) * 0.3 + 2.0
    fb = torch.randn(n_per, 32) * 0.3 - 2.0
    x = torch.cat([fa, fb], dim=0)
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


def test_encoder_shape():
    x, ei, ea, _ = _toy_graph()
    enc = Encoder(in_dim=32, hidden=64, embed=32, heads=4, dropout=0.0)
    h = enc(x, ei, ea)
    assert h.shape == (x.size(0), 32)


def test_link_head_no_params():
    h = torch.randn(10, 32)
    pairs = torch.tensor([[0, 1, 2], [3, 4, 5]])
    out = LinkHead.forward(h, pairs)
    assert out.shape == (3,)


def test_tier1_head_shape():
    head = TierOneHead(embed_dim=32, n_classes=13)
    h = torch.randn(10, 32)
    out = head(h)
    assert out.shape == (10, 13)


def test_recon_head_shape():
    head = ReconHead(embed_dim=32, in_dim=32, hidden=64)
    h = torch.randn(10, 32)
    out = head(h)
    assert out.shape == (10, 32)


def test_multitask_default_link_only():
    model = MultiTaskGAT(in_dim=32, n_tier1=0, with_recon=False)
    assert model.tier1_head is None
    assert model.recon_head is None


def test_multitask_all_heads():
    model = MultiTaskGAT(in_dim=32, n_tier1=13, with_recon=True)
    assert model.tier1_head is not None
    assert model.recon_head is not None
    x, ei, ea, pairs = _toy_graph()
    h = model.encode(x, ei, ea)
    assert h.shape == (x.size(0), 32)
    assert model.score_links(h, pairs).shape == (pairs.size(1),)
    assert model.classify_tier1(h).shape == (x.size(0), 13)
    assert model.reconstruct(h).shape == (x.size(0), 32)


def test_multitask_training_step_runs():
    """Combined loss backward + step doesn't blow up."""
    x, ei, ea, pairs = _toy_graph()
    model = MultiTaskGAT(in_dim=32, n_tier1=13, with_recon=True, dropout=0.0)
    tier1_targets = torch.zeros(x.size(0), 13)
    tier1_targets[:10, 0] = 1.0
    tier1_targets[10:, 1] = 1.0
    opt = torch.optim.Adam(model.parameters(), lr=1e-2)
    for _ in range(5):
        opt.zero_grad()
        h = model.encode(x, ei, ea)
        pos = model.score_links(h, pairs)
        neg_pairs = negative_sampling(edge_index=pairs, num_nodes=x.size(0),
                                      num_neg_samples=pairs.size(1))
        neg = model.score_links(h, neg_pairs)
        link_loss = F.binary_cross_entropy_with_logits(
            torch.cat([pos, neg]),
            torch.cat([torch.ones_like(pos), torch.zeros_like(neg)]),
        )
        class_loss = F.binary_cross_entropy_with_logits(
            model.classify_tier1(h), tier1_targets,
        )
        recon_loss = F.binary_cross_entropy_with_logits(
            model.reconstruct(h), x,
        )
        loss = 1.0 * link_loss + 0.5 * class_loss + 0.5 * recon_loss
        loss.backward()
        opt.step()
    assert torch.isfinite(loss).item()


def test_recon_head_disabled_raises():
    model = MultiTaskGAT(in_dim=32, n_tier1=0, with_recon=False)
    h = torch.randn(5, 32)
    import pytest
    with pytest.raises(RuntimeError):
        model.reconstruct(h)
    with pytest.raises(RuntimeError):
        model.classify_tier1(h)
