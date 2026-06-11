"""3-layer MPNN for taste prediction.

GINEConv-based backbone (message passing with edge features), global mean pool,
2-layer MLP classifier. Supports single-task (M2) and multi-task (M3) via
`num_tasks`.
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F


class MPNN(nn.Module):
    def __init__(self, atom_dim: int, bond_dim: int, hidden: int = 128,
                 num_layers: int = 3, num_tasks: int = 1, readout: str = "mean",
                 backbone: str = "gine", desc_dim: int = 0):
        super().__init__()
        from torch_geometric.nn import (GATv2Conv, GINEConv, global_add_pool,
                                        global_max_pool, global_mean_pool)

        # P1a (GNN-LIFT): readout choice. 'mean' (default) preserves the
        # original architecture and lets existing checkpoints load unchanged.
        # 'mean_max_sum' concatenates mean+max+sum pools so a single strong
        # local motif (e.g. one odorant fragment on a large molecule) is not
        # diluted ~40x by global_mean_pool — the audit's Finding 1.2, and the
        # set2set-style readout the odor literature finds lifts sparse-graph
        # odor heads.
        self.readout = readout
        if readout == "mean_max_sum":
            self._pools = (global_mean_pool, global_max_pool, global_add_pool)
        elif readout == "mean_max":
            # Drops the molecule-size-sensitive sum pool, which degraded the
            # dense sweet head in the mean_max_sum experiment while max-pool
            # kept the odor_spicy motif-preservation win.
            self._pools = (global_mean_pool, global_max_pool)
        elif readout == "mean":
            self._pools = (global_mean_pool,)
        else:
            raise ValueError(f"unknown readout {readout!r}")
        self._pool = global_mean_pool  # back-compat for external callers
        pool_dim = hidden * len(self._pools)

        self.atom_enc = nn.Linear(atom_dim, hidden)
        self.bond_enc = nn.Linear(bond_dim, hidden)

        # Backbone choice. 'gine' (default) = GINEConv message passing (sum
        # aggregation, all neighbours weighted equally). 'gat' = GATv2Conv
        # attention message passing, which learns per-edge attention weights so
        # a salient substructure (e.g. an odorant-binding fragment) can dominate
        # its neighbourhood instead of being averaged in — the inductive bias
        # behind the POM/Osmo odor results. Both consume the encoded 128-d bond
        # features (GATv2 via edge_dim) and share the same forward() call shape.
        self.backbone = backbone
        self.convs = nn.ModuleList()
        self.bns = nn.ModuleList()
        gat_heads = 4
        for _ in range(num_layers):
            if backbone == "gat":
                self.convs.append(GATv2Conv(hidden, hidden // gat_heads,
                                            heads=gat_heads, concat=True,
                                            edge_dim=hidden))
            elif backbone == "gine":
                mlp = nn.Sequential(
                    nn.Linear(hidden, hidden), nn.ReLU(), nn.Linear(hidden, hidden),
                )
                self.convs.append(GINEConv(mlp))
            else:
                raise ValueError(f"unknown backbone {backbone!r}")
            self.bns.append(nn.BatchNorm1d(hidden))

        # Lever #1: 8-dim physchem descriptors concatenated into the head input,
        # normalized by BatchNorm (raw descriptors have wildly different scales).
        self.desc_dim = desc_dim
        self.desc_bn = nn.BatchNorm1d(desc_dim) if desc_dim > 0 else None

        self.head = nn.Sequential(
            nn.Linear(pool_dim + desc_dim, hidden), nn.ReLU(), nn.Dropout(0.2),
            nn.Linear(hidden, num_tasks),
        )

    def _readout(self, x: torch.Tensor, batch) -> torch.Tensor:
        """Pool atom embeddings to a graph vector (concatenated when multi-pool)."""
        return torch.cat([pool(x, batch) for pool in self._pools], dim=1)

    def forward_embedding(self, data) -> torch.Tensor:
        """Return the pooled graph vector before the classifier head
        (shape: G, hidden*len(pools))."""
        x = self.atom_enc(data.x)
        edge_attr = self.bond_enc(data.edge_attr) if data.edge_attr.size(0) else \
                    torch.zeros(0, x.size(1), device=x.device)
        for conv, bn in zip(self.convs, self.bns):
            x = conv(x, data.edge_index, edge_attr)
            x = bn(x)
            x = F.relu(x)
        return self._readout(x, data.batch)

    def forward_trace(self, data):
        """Return per-layer atom activations, pooled graph vector, and logits.

        Returns a dict: { 'atom_enc': (N, H), 'layer_k': (N, H) for k in 1..L,
                          'pool': (G, H), 'logits': (G, T) }
        Used for the MessagePassingDiagram real-activation mode.
        """
        import torch  # local import keeps top of file clean
        trace = {}
        x = self.atom_enc(data.x)
        trace['atom_enc'] = x.detach().clone()
        edge_attr = self.bond_enc(data.edge_attr) if data.edge_attr.size(0) else \
                    torch.zeros(0, x.size(1), device=x.device)
        for i, (conv, bn) in enumerate(zip(self.convs, self.bns)):
            x = conv(x, data.edge_index, edge_attr)
            x = bn(x)
            x = F.relu(x)
            trace[f'layer_{i + 1}'] = x.detach().clone()
        g = self._readout(x, data.batch)
        trace['pool'] = g.detach().clone()
        trace['logits'] = self.head(g).detach().clone()
        return trace

    def forward(self, data) -> torch.Tensor:
        g = self.forward_embedding(data)
        if self.desc_bn is not None:
            desc = data.desc.view(g.size(0), -1)
            g = torch.cat([g, self.desc_bn(desc)], dim=1)
        return self.head(g)
