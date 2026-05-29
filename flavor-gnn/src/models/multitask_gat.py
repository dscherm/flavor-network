"""multitask_gat.py — N3-GAT-CLUSTERS v3+ multi-task architecture.

Refactored from gat_link.py (which stays for backward-compat with v1/v2
checkpoint loading). The encoder/head split is the structural change:
the same 32d embedding now feeds multiple heads, and the encoder is
shaped by their joint pressure.

Architecture:
  Encoder (2-layer GAT)  →  [32d node embedding]  →  LinkHead       (existing)
                                                  →  TierOneHead    (existing, from v2)
                                                  →  ReconHead      (new in v3, Phase 2)
                                                  →  EdgeTypeHead   (new in v4, Phase 3)
                                                  →  CompoundHead   (new in v5, Phase 5)

Loss in v3: 1.0·L_link + 0.5·L_tier1 + 0.5·L_recon
"""
from __future__ import annotations

import torch
import torch.nn as nn
from torch_geometric.nn import GATConv


class Encoder(nn.Module):
    """Shared 2-layer GAT backbone."""

    def __init__(self, in_dim: int, hidden: int = 64, embed: int = 32,
                 heads: int = 4, dropout: float = 0.5):
        super().__init__()
        if hidden % heads != 0:
            raise ValueError(f"hidden ({hidden}) must be divisible by heads ({heads})")
        self.in_dim = in_dim
        self.embed = embed
        self.conv1 = GATConv(
            in_channels=in_dim, out_channels=hidden // heads,
            heads=heads, dropout=dropout, edge_dim=1, concat=True,
        )
        self.conv2 = GATConv(
            in_channels=hidden, out_channels=embed,
            heads=1, dropout=dropout, edge_dim=1, concat=False,
        )
        self.act = nn.ELU()
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor,
                edge_attr: torch.Tensor) -> torch.Tensor:
        h = self.conv1(x, edge_index, edge_attr=edge_attr)
        h = self.act(h)
        h = self.dropout(h)
        h = self.conv2(h, edge_index, edge_attr=edge_attr)
        return h


class LinkHead(nn.Module):
    """Dot-product link scoring. No parameters."""

    @staticmethod
    def forward(h: torch.Tensor, pairs: torch.Tensor) -> torch.Tensor:
        src, dst = pairs[0], pairs[1]
        return (h[src] * h[dst]).sum(dim=1)


class TierOneHead(nn.Module):
    """Linear classifier over chef tier1 vocabulary (multi-label)."""

    def __init__(self, embed_dim: int, n_classes: int):
        super().__init__()
        self.linear = nn.Linear(embed_dim, n_classes)

    def forward(self, h: torch.Tensor) -> torch.Tensor:
        return self.linear(h)


class ReconHead(nn.Module):
    """Reconstruct the original multi-hot feature vector from embedding.

    Counteracts oversmoothing — the encoder can't fully average away
    feature information because it has to remain retrievable.
    Output is logits; loss is BCE on the original 0/1 multi-hot target.
    """

    def __init__(self, embed_dim: int, in_dim: int, hidden: int = 64):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(embed_dim, hidden),
            nn.ELU(),
            nn.Linear(hidden, in_dim),
        )

    def forward(self, h: torch.Tensor) -> torch.Tensor:
        return self.net(h)


class CompoundHead(nn.Module):
    """Multi-label classifier over top-N compounds per ingredient.

    Per Phase 5: chemistry is real external signal, not self-referential.
    Input = node embedding [N, embed], output = [N, n_compounds] logits.
    Loss is masked BCE — nodes with no compound data are excluded.
    """

    def __init__(self, embed_dim: int, n_compounds: int):
        super().__init__()
        self.linear = nn.Linear(embed_dim, n_compounds)

    def forward(self, h: torch.Tensor) -> torch.Tensor:
        return self.linear(h)


class EdgeTypeHead(nn.Module):
    """Binary classifier on edges: 1=tradition-dominant, 0=chemistry-dominant.

    Forces the embedding pair to encode 'what kind of relationship'.
    Input = concat(h_src, h_dst), output = 1 logit per edge.
    Loss is masked BCE — tied edges (tradition==chemistry) are excluded.
    """

    def __init__(self, embed_dim: int, hidden: int = 64):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(embed_dim * 2, hidden),
            nn.ELU(),
            nn.Linear(hidden, 1),
        )

    def forward(self, h: torch.Tensor, pairs: torch.Tensor) -> torch.Tensor:
        src, dst = pairs[0], pairs[1]
        concat = torch.cat([h[src], h[dst]], dim=1)
        return self.net(concat).squeeze(-1)


class MultiTaskGAT(nn.Module):
    """Encoder + heads. Each head optional; constructor flags toggle them."""

    def __init__(
        self,
        in_dim: int,
        hidden: int = 64,
        embed: int = 32,
        heads: int = 4,
        dropout: float = 0.5,
        n_tier1: int = 0,
        with_recon: bool = False,
        recon_hidden: int = 64,
        with_edge_type: bool = False,
        edge_type_hidden: int = 64,
        n_compounds: int = 0,
    ):
        super().__init__()
        self.in_dim = in_dim
        self.embed = embed
        self.n_tier1 = n_tier1
        self.with_recon = with_recon
        self.with_edge_type = with_edge_type
        self.n_compounds = n_compounds

        self.encoder = Encoder(in_dim, hidden, embed, heads, dropout)
        self.link_head = LinkHead()
        self.tier1_head = TierOneHead(embed, n_tier1) if n_tier1 > 0 else None
        self.recon_head = ReconHead(embed, in_dim, recon_hidden) if with_recon else None
        self.edge_type_head = EdgeTypeHead(embed, edge_type_hidden) if with_edge_type else None
        self.compound_head = CompoundHead(embed, n_compounds) if n_compounds > 0 else None

    def encode(self, x: torch.Tensor, edge_index: torch.Tensor,
               edge_attr: torch.Tensor) -> torch.Tensor:
        return self.encoder(x, edge_index, edge_attr)

    def score_links(self, h: torch.Tensor, pairs: torch.Tensor) -> torch.Tensor:
        return self.link_head.forward(h, pairs)

    # API-parity alias with GATLinkPredictor so eval_link works uniformly.
    def decode(self, h: torch.Tensor, pairs: torch.Tensor) -> torch.Tensor:
        return self.score_links(h, pairs)

    def classify_tier1(self, h: torch.Tensor) -> torch.Tensor:
        if self.tier1_head is None:
            raise RuntimeError("tier1 head disabled")
        return self.tier1_head(h)

    def reconstruct(self, h: torch.Tensor) -> torch.Tensor:
        if self.recon_head is None:
            raise RuntimeError("reconstruction head disabled")
        return self.recon_head(h)

    def classify_edge_type(self, h: torch.Tensor, pairs: torch.Tensor) -> torch.Tensor:
        if self.edge_type_head is None:
            raise RuntimeError("edge_type head disabled")
        return self.edge_type_head(h, pairs)

    def classify_compounds(self, h: torch.Tensor) -> torch.Tensor:
        if self.compound_head is None:
            raise RuntimeError("compound head disabled")
        return self.compound_head(h)
