import torch
import torch.nn.functional as F
from torch_geometric.nn import GATConv


class FlavorGAT(torch.nn.Module):
    """Graph Attention Network for flavor embeddings (v3 schema).

    Node features (default 159 dims): concat of
      tier1[5] + tier2[7] + tier3[~15] + leaves[~132] multi-hot from
      ``train.dataset.load_flavor_graph``.
    Edge features (default 8 dims): multi-hot over the 8 canonical
      principles in ``flavor-gnn/curation/principle_vocab.json``.

    Layer 1: ``heads`` attention heads (default 4) — each reads edge
             features to weight neighbor contributions.
    Layer 2: 1 head — projects to the final ``out``-dim embedding.
    """
    def __init__(self, node_in=159, edge_in=8, hidden=32, out=16, heads=4):
        super().__init__()
        self.conv1 = GATConv(node_in, hidden, heads=heads,
                             edge_dim=edge_in, concat=True)
        self.conv2 = GATConv(hidden * heads, out, heads=1,
                             edge_dim=edge_in, concat=False)

    def forward(self, x, edge_index, edge_attr):
        x = F.elu(self.conv1(x, edge_index, edge_attr))
        x = self.conv2(x, edge_index, edge_attr)
        return x


if __name__ == "__main__":
    torch.manual_seed(42)
    n, e = 89, 446
    model = FlavorGAT()
    x = torch.randn(n, 159)
    edge_index = torch.randint(0, n, (2, e), dtype=torch.long)
    edge_attr = (torch.rand(e, 8) > 0.5).float()
    out = model(x, edge_index, edge_attr)
    assert out.shape == (n, 16), f"expected [{n}, 16], got {tuple(out.shape)}"
    print(f"[model] FlavorGAT forward OK: x{tuple(x.shape)} → out{tuple(out.shape)}")
