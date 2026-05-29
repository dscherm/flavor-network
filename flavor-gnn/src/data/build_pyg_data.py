"""build_pyg_data.py — N3-GAT-CLUSTERS phase D1.

Builds a PyTorch Geometric `Data` object from the v8 ingredient pairing
graph + chef-curated v3 flavor labels.

Node features (32d total):
  - 13d aroma multi-hot (tier1 from flavor_graph_data_v3.json)
  - 9d  taste multi-hot (taste tokens from ingredients.json)
  - 10d leaves multi-hot (top-10 chemistry descriptors, deduped against
        aroma+taste keys, excluding the over-frequent 'alcoholic' and
        'ethereal' which apply to >50% of nodes)

Edges:
  - Bidirectional (each pair contributes (a,b) and (b,a))
  - edge_attr = pairings[].strength (already in [0,1], no normalization)

Node universe:
  - Intersection: flavor_graph_v3 nodes ∩ ingredients.json keys ∩
    pairing endpoints. ~3,587 nodes.
  - Rationale: need features (tier1+taste+leaves) AND at least one
    edge to be embeddable by the GAT.

Returns:
  Data(x=[N, 32], edge_index=[2, 2E], edge_attr=[2E, 1]),
  name_to_idx: dict[str, int]
"""
from __future__ import annotations
import json
from collections import Counter
from pathlib import Path

import torch
from torch_geometric.data import Data

REPO_ROOT = Path(__file__).resolve().parents[3]
PRO = REPO_ROOT / "public" / "proDataset"

AROMA_KEYS = [
    "citrus", "fruity", "floral", "herbal", "green", "creamy",
    "woody", "earthy", "roasted", "caramel", "fermented",
    "marine", "pungent",
]
TASTE_KEYS = [
    "sweet", "pungent", "sour", "salty", "bitter",
    "astringent", "spicy", "umami", "fatty",
]
EXCLUDED_LEAVES = {"alcoholic", "ethereal"}
LEAVES_K = 10


def _multi_hot(tokens, vocab):
    """Return [len(vocab)]-shaped 0/1 list for the given vocabulary order."""
    vec = [0.0] * len(vocab)
    if not tokens:
        return vec
    s = set(t.lower() for t in tokens if t)
    for i, k in enumerate(vocab):
        if k in s:
            vec[i] = 1.0
    return vec


def _select_top_leaves(fg_nodes, k=LEAVES_K):
    """Top-k leaves by frequency, excluding over-frequent + aroma/taste overlap."""
    counts = Counter()
    for n in fg_nodes:
        for leaf in (n.get("leaves") or []):
            l = str(leaf).lower()
            if l in EXCLUDED_LEAVES:
                continue
            if l in AROMA_KEYS or l in TASTE_KEYS:
                continue
            counts[l] += 1
    return [leaf for leaf, _ in counts.most_common(k)]


def build_pyg_data(
    pairings_path: Path = PRO / "pairings.json",
    fg_path: Path = PRO / "flavor_graph_data_v3.json",
    ing_path: Path = PRO / "ingredients.json",
):
    """Build a PyG Data object + name_to_idx mapping.

    Pure function: reads from disk, returns artifacts; writes nothing.
    """
    pairings = json.loads(Path(pairings_path).read_text(encoding="utf-8"))
    fg = json.loads(Path(fg_path).read_text(encoding="utf-8"))
    ingredients = json.loads(Path(ing_path).read_text(encoding="utf-8"))

    fg_nodes_by_name = {n["name"]: n for n in fg.get("nodes", [])}
    fg_names = set(fg_nodes_by_name)
    ing_names = set(ingredients)

    edge_endpoints = set()
    for e in pairings:
        edge_endpoints.add(e.get("ingredientA"))
        edge_endpoints.add(e.get("ingredientB"))

    canonical_names = sorted(fg_names & ing_names & edge_endpoints)
    name_to_idx = {name: i for i, name in enumerate(canonical_names)}

    leaves_vocab = _select_top_leaves(fg.get("nodes", []), k=LEAVES_K)

    features = []
    for name in canonical_names:
        fg_node = fg_nodes_by_name[name]
        ing_node = ingredients.get(name, {})
        aroma_vec = _multi_hot(fg_node.get("tier1"), AROMA_KEYS)
        taste_str = str(ing_node.get("taste") or "").lower()
        taste_tokens = taste_str.split() if taste_str else []
        taste_vec = _multi_hot(taste_tokens, TASTE_KEYS)
        leaves_vec = _multi_hot(fg_node.get("leaves"), leaves_vocab)
        features.append(aroma_vec + taste_vec + leaves_vec)

    x = torch.tensor(features, dtype=torch.float)

    src_list, dst_list, w_list = [], [], []
    skipped = 0
    for e in pairings:
        a, b = e.get("ingredientA"), e.get("ingredientB")
        if a not in name_to_idx or b not in name_to_idx:
            skipped += 1
            continue
        ia, ib = name_to_idx[a], name_to_idx[b]
        s = float(e.get("strength", 0.0))
        src_list.append(ia); dst_list.append(ib); w_list.append(s)
        src_list.append(ib); dst_list.append(ia); w_list.append(s)

    edge_index = torch.tensor([src_list, dst_list], dtype=torch.long)
    edge_attr = torch.tensor(w_list, dtype=torch.float).unsqueeze(1)

    data = Data(x=x, edge_index=edge_index, edge_attr=edge_attr)
    data.num_nodes = len(canonical_names)
    data._meta = {
        "aroma_vocab": AROMA_KEYS,
        "taste_vocab": TASTE_KEYS,
        "leaves_vocab": leaves_vocab,
        "feature_dim": len(AROMA_KEYS) + len(TASTE_KEYS) + len(leaves_vocab),
        "node_count": len(canonical_names),
        "edges_dropped_no_node": skipped,
        "edges_kept_directed": len(w_list),
    }
    return data, name_to_idx


if __name__ == "__main__":
    data, n2i = build_pyg_data()
    m = data._meta
    print(f"build_pyg_data: {m['node_count']} nodes, "
          f"{m['edges_kept_directed']} directed edges "
          f"(skipped {m['edges_dropped_no_node']} edges with off-universe endpoint)")
    print(f"feature dim: {m['feature_dim']} = "
          f"{len(m['aroma_vocab'])} aroma + {len(m['taste_vocab'])} taste + "
          f"{len(m['leaves_vocab'])} leaves")
    print(f"leaves vocab: {m['leaves_vocab']}")
    print(f"x shape: {tuple(data.x.shape)}, edge_index shape: {tuple(data.edge_index.shape)}, "
          f"edge_attr shape: {tuple(data.edge_attr.shape)}")
    print(f"x sum per slot: aroma={data.x[:, :13].sum().item():.0f}, "
          f"taste={data.x[:, 13:22].sum().item():.0f}, "
          f"leaves={data.x[:, 22:32].sum().item():.0f}")
    print(f"edge_attr stats: min={data.edge_attr.min():.3f}, "
          f"max={data.edge_attr.max():.3f}, mean={data.edge_attr.mean():.3f}")
