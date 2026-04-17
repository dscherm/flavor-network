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
                 num_layers: int = 3, num_tasks: int = 1):
        super().__init__()
        from torch_geometric.nn import GINEConv, global_mean_pool
        self._pool = global_mean_pool

        self.atom_enc = nn.Linear(atom_dim, hidden)
        self.bond_enc = nn.Linear(bond_dim, hidden)

        self.convs = nn.ModuleList()
        self.bns = nn.ModuleList()
        for _ in range(num_layers):
            mlp = nn.Sequential(
                nn.Linear(hidden, hidden), nn.ReLU(), nn.Linear(hidden, hidden),
            )
            self.convs.append(GINEConv(mlp))
            self.bns.append(nn.BatchNorm1d(hidden))

        self.head = nn.Sequential(
            nn.Linear(hidden, hidden), nn.ReLU(), nn.Dropout(0.2),
            nn.Linear(hidden, num_tasks),
        )

    def forward_embedding(self, data) -> torch.Tensor:
        """Return the pooled graph vector before the classifier head (shape: G, hidden)."""
        x = self.atom_enc(data.x)
        edge_attr = self.bond_enc(data.edge_attr) if data.edge_attr.size(0) else \
                    torch.zeros(0, x.size(1), device=x.device)
        for conv, bn in zip(self.convs, self.bns):
            x = conv(x, data.edge_index, edge_attr)
            x = bn(x)
            x = F.relu(x)
        return self._pool(x, data.batch)

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
        g = self._pool(x, data.batch)
        trace['pool'] = g.detach().clone()
        trace['logits'] = self.head(g).detach().clone()
        return trace

    def forward(self, data) -> torch.Tensor:
        return self.head(self.forward_embedding(data))
