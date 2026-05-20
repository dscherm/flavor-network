"""Path B smoke tests — `.omc/plans/ralplan-flavor-model-expansion-v3-pathAB.md` §P-B4.

7 tests. Run from repo root:

    flavor-gnn/.venv/Scripts/python.exe -m pytest train/test_gnn.py -v

Tests #4 + #5 require `public/proDataset/flavor_graph_data.json` from an
earlier `python train/train_gnn.py` run — that artifact ships in repo.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pytest
import torch
import torch.nn.functional as F
from sklearn.cluster import KMeans

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dataset import TIER1_VOCAB, TIER2_VOCAB, load_flavor_graph
from model import FlavorGAT
from train_gnn import EdgeClassifier, derive_edge_labels, class_weights_from

ROOT = Path(__file__).resolve().parent.parent
CSV = ROOT / "flavor-gnn" / "curation" / "top500_flavor_graph.csv"
GRAPH_JSON = ROOT / "public" / "proDataset" / "flavor_graph_data.json"
EXPECTED_NODE_DIM = 159
EXPECTED_EDGE_DIM = 8
EXPECTED_OUT_DIM = 16


@pytest.fixture(scope="module")
def data():
    return load_flavor_graph(CSV)


def test_dataset_shapes(data) -> None:
    """1. dataset.load_flavor_graph returns [N, 159] + [2, E] + [E, 8]."""
    n = len(data.name_to_idx)
    assert data.node_features.shape == (n, EXPECTED_NODE_DIM)
    assert data.edge_index.shape[0] == 2
    e = data.edge_index.shape[1]
    assert data.edge_attr.shape == (e, EXPECTED_EDGE_DIM)
    assert n > 0 and e > 0


def test_gat_forward_random() -> None:
    """2. FlavorGAT() forward pass on random [N, 159] returns [N, 16]."""
    torch.manual_seed(42)
    n, e = 25, 80
    model = FlavorGAT()
    x = torch.randn(n, EXPECTED_NODE_DIM)
    edge_index = torch.randint(0, n, (2, e), dtype=torch.long)
    edge_attr = (torch.rand(e, EXPECTED_EDGE_DIM) > 0.5).float()
    out = model(x, edge_index, edge_attr)
    assert out.shape == (n, EXPECTED_OUT_DIM)


def test_training_step_reduces_loss(data) -> None:
    """3. A handful of training steps reduces total loss vs the initial step."""
    torch.manual_seed(42)
    principles = data.vocabularies["principles"]
    n_classes = len(principles)
    model = FlavorGAT(node_in=data.node_features.shape[1], edge_in=n_classes)
    clf = EdgeClassifier(embed_dim=EXPECTED_OUT_DIM, n_classes=n_classes)
    opt = torch.optim.Adam(list(model.parameters()) + list(clf.parameters()), lr=0.01)
    class_idx, tradition_mask = derive_edge_labels(data.edge_attr, principles)
    aux_mask = ~tradition_mask
    weights = class_weights_from(class_idx, n_classes, aux_mask)

    def step() -> float:
        opt.zero_grad()
        z = model(data.node_features, data.edge_index, data.edge_attr)
        contrastive = (z[data.edge_index[0]] - z[data.edge_index[1]]).pow(2).sum(dim=1).mean()
        logits = clf(z, data.edge_index)
        loss_clf = F.cross_entropy(logits[aux_mask], class_idx[aux_mask], weight=weights)
        total = 0.7 * contrastive + 0.3 * loss_clf
        total.backward()
        opt.step()
        return float(total.item())

    initial = step()
    losses = [step() for _ in range(10)]
    assert min(losses) < initial, f"no descent: initial={initial}, min={min(losses)}"


def test_output_json_schema() -> None:
    """4. Output JSON validates against the §P-B3 schema."""
    if not GRAPH_JSON.exists():
        pytest.skip(f"{GRAPH_JSON} missing — run `python train/train_gnn.py` first")
    g = json.loads(GRAPH_JSON.read_text(encoding="utf-8"))
    assert set(g.keys()) == {"nodes", "edges", "clusters", "_meta"}
    assert len(g["nodes"]) > 0 and len(g["edges"]) > 0 and len(g["clusters"]) > 0
    node = g["nodes"][0]
    assert {"name", "x", "y", "z", "embedding", "cluster", "tier1", "leaves"}.issubset(node.keys())
    edge = g["edges"][0]
    assert {"source", "target"}.issubset(edge.keys())
    assert "principle" in edge or "principles" in edge
    cluster = g["clusters"][0]
    assert {"id", "label", "centroid"}.issubset(cluster.keys())
    meta = g["_meta"]
    assert {"n_nodes", "n_edges", "principle_vocab", "seed",
            "final_aux_classification_accuracy"}.issubset(meta.keys())
    assert meta["seed"] == 42


def test_kmeans_cluster_stability() -> None:
    """5. KMeans cluster IDs are stable across re-runs at random_state=42."""
    if not GRAPH_JSON.exists():
        pytest.skip(f"{GRAPH_JSON} missing — run `python train/train_gnn.py` first")
    g = json.loads(GRAPH_JSON.read_text(encoding="utf-8"))
    emb = np.array([n["embedding"] for n in g["nodes"]])
    k = len(g["clusters"])
    a = KMeans(n_clusters=k, random_state=42, n_init=10).fit_predict(emb)
    b = KMeans(n_clusters=k, random_state=42, n_init=10).fit_predict(emb)
    assert (a == b).all(), "KMeans cluster IDs drifted between runs at random_state=42"


def test_vocab_filters(data) -> None:
    """6. No `salty` in tier2 vocab; no `spicy` in tier1 vocab (Q6/Q7)."""
    assert "salty" not in data.vocabularies["tier2"]
    assert "spicy" not in data.vocabularies["tier1"]
    assert tuple(data.vocabularies["tier1"]) == TIER1_VOCAB
    assert tuple(data.vocabularies["tier2"]) == TIER2_VOCAB


def test_parsley_fixture_substituting_for_mint(data) -> None:
    """7. Replacement for the v2 mint fixture (mint was removed in v3 chef cleanup).

    Picks `parsley`: green herb with phenolic-family leaves. Closest
    spec-intent match — chef-written `thyme` is tier1=`spicy`, which is
    silently dropped per Q7 (Tier-1 spicy is permanently empty in the
    flavor graph), so thyme.tier1=[] end-to-end. Parsley keeps the
    end-to-end fixture meaningful.
    """
    assert "parsley" in data.name_to_idx, "parsley missing from chef CSV"
    if not GRAPH_JSON.exists():
        pytest.skip(f"{GRAPH_JSON} missing — run `python train/train_gnn.py` first")
    g = json.loads(GRAPH_JSON.read_text(encoding="utf-8"))
    parsley = next(n for n in g["nodes"] if n["name"] == "parsley")
    assert parsley["tier1"] == ["green"], f"expected ['green'], got {parsley['tier1']}"
    phenolic_markers = {"phenolic", "thymolic", "carvacrol", "terpenic", "camphoraceous"}
    assert phenolic_markers & set(parsley["leaves"]), (
        f"no phenolic-family marker in parsley leaves: {parsley['leaves']}"
    )
