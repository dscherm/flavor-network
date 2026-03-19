import torch
import torch.nn.functional as F
from torch_geometric.nn import GATConv


class FlavorGAT(torch.nn.Module):
    """
    Graph Attention Network for flavor embeddings.

    Each ingredient (node) starts with its flavor profile vector (8 dims — one per taste).
    Each pairing (edge) has 13 features:
      [tradition, chemistry, novelty, balance, bridging, x1..x8]

    Layer 1: 4 attention heads — each reads the edge features to decide
             how much weight to give each neighbor's contribution.
    Layer 2: 1 head — combines into the final 8-dim embedding.
    """
    def __init__(self, node_in=8, edge_in=13, hidden=16, out=8, heads=4):
        super().__init__()
        self.conv1 = GATConv(node_in, hidden, heads=heads,
                             edge_dim=edge_in, concat=True)
        self.conv2 = GATConv(hidden * heads, out, heads=1,
                             edge_dim=edge_in, concat=False)

    def forward(self, x, edge_index, edge_attr):
        x = F.elu(self.conv1(x, edge_index, edge_attr))
        x = self.conv2(x, edge_index, edge_attr)
        return x
