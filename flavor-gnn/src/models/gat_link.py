"""gat_link.py — N3-GAT-CLUSTERS phase D2.

2-layer GATConv link-prediction model on the ingredient pairing graph.

Architecture:
  - GATConv layer 1: in_dim → hidden // heads per head, heads=4, concat → hidden
  - ELU + dropout
  - GATConv layer 2: hidden → embed, heads=1, no concat
  - Dot-product link predictor: <h_src, h_dst> → logit

Output of encode() = 32d node embeddings used downstream by Leiden.
"""
from __future__ import annotations

import torch
import torch.nn as nn
from torch_geometric.nn import GATConv


class GATLinkPredictor(nn.Module):
    def __init__(
        self,
        in_dim: int,
        hidden: int = 64,
        embed: int = 32,
        heads: int = 4,
        dropout: float = 0.5,
        n_tier1: int = 0,
    ):
        super().__init__()
        if hidden % heads != 0:
            raise ValueError(f"hidden ({hidden}) must be divisible by heads ({heads})")
        self.in_dim = in_dim
        self.hidden = hidden
        self.embed = embed
        self.heads = heads
        self.n_tier1 = n_tier1
        self.conv1 = GATConv(
            in_channels=in_dim,
            out_channels=hidden // heads,
            heads=heads,
            dropout=dropout,
            edge_dim=1,
            concat=True,
        )
        self.conv2 = GATConv(
            in_channels=hidden,
            out_channels=embed,
            heads=1,
            dropout=dropout,
            edge_dim=1,
            concat=False,
        )
        self.act = nn.ELU()
        self.dropout = nn.Dropout(dropout)
        self.classifier = nn.Linear(embed, n_tier1) if n_tier1 > 0 else None

    def classify(self, h: torch.Tensor) -> torch.Tensor:
        """Returns [N, n_tier1] logits over the chef tier1 vocabulary."""
        if self.classifier is None:
            raise RuntimeError("classifier head disabled (n_tier1=0)")
        return self.classifier(h)

    def encode(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        edge_attr: torch.Tensor,
    ) -> torch.Tensor:
        h = self.conv1(x, edge_index, edge_attr=edge_attr)
        h = self.act(h)
        h = self.dropout(h)
        h = self.conv2(h, edge_index, edge_attr=edge_attr)
        return h

    @staticmethod
    def decode(h: torch.Tensor, edge_pairs: torch.Tensor) -> torch.Tensor:
        """Dot-product link score. Returns logits (no sigmoid)."""
        src, dst = edge_pairs[0], edge_pairs[1]
        return (h[src] * h[dst]).sum(dim=1)

    def forward(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        edge_attr: torch.Tensor,
        edge_pairs: torch.Tensor,
    ) -> torch.Tensor:
        h = self.encode(x, edge_index, edge_attr)
        return self.decode(h, edge_pairs)
