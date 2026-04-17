"""Blend Node2Vec positions with GNN-learned positions for full coverage.

The GNN-based embedder (embed_ingredients.py) only matches ~216 of 3913
proDataset ingredients because FooDB food names are a strict subset. Running
Node2Vec on the proDataset pairing graph gives every ingredient a position
derived from its recipe-neighbor topology. We blend the two:

    position = 0.7 * node2vec_umap  +  0.3 * gnn_umap   (when both exist)
    position = node2vec_umap                            (otherwise)

GNN-matched ingredients still anchor their neighborhoods, but every node is
placed meaningfully. Distances are renormalized so p95 == 50.

Output: overwrites public/proDataset/gnn_positions.json with the blended set.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import networkx as nx
import numpy as np
from node2vec import Node2Vec
import umap


TARGET_RADIUS = 50.0


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def load_pairings(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def build_graph(pairings: list[dict]) -> nx.Graph:
    G = nx.Graph()
    for p in pairings:
        a = p.get("ingredientA")
        b = p.get("ingredientB")
        s = float(p.get("strength") or 0.0)
        if not a or not b or s <= 0:
            continue
        G.add_edge(a, b, weight=s)
    return G


def run_node2vec(G: nx.Graph, dim: int = 64, walk_length: int = 20, num_walks: int = 40,
                 p: float = 1.0, q: float = 1.0, workers: int = 1) -> dict[str, np.ndarray]:
    n2v = Node2Vec(G, dimensions=dim, walk_length=walk_length, num_walks=num_walks,
                   p=p, q=q, workers=workers, quiet=True, seed=42)
    model = n2v.fit(window=10, min_count=1, batch_words=4, seed=42, workers=workers)
    return {n: np.asarray(model.wv[n]) for n in G.nodes()}


def reduce_3d(embeddings: dict[str, np.ndarray], seed: int = 42) -> dict[str, np.ndarray]:
    names = list(embeddings.keys())
    X = np.stack([embeddings[n] for n in names])
    reducer = umap.UMAP(n_components=3, n_neighbors=min(15, max(2, len(names) - 1)),
                        min_dist=0.1, random_state=seed, metric="cosine")
    Y = reducer.fit_transform(X)
    return {n: Y[i] for i, n in enumerate(names)}


def normalize(positions: dict[str, np.ndarray]) -> dict[str, np.ndarray]:
    names = list(positions.keys())
    if not names:
        return positions
    Y = np.stack([positions[n] for n in names])
    Y = Y - Y.mean(axis=0, keepdims=True)
    d = np.linalg.norm(Y, axis=1)
    p95 = float(np.percentile(d, 95)) if len(d) else 1.0
    scale = (TARGET_RADIUS / p95) if p95 > 0 else 1.0
    Y = Y * scale
    return {n: Y[i] for i, n in enumerate(names)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pairings", default=str(_project_root() / "public" / "proDataset" / "pairings.json"))
    parser.add_argument("--gnn", default=str(_project_root() / "public" / "proDataset" / "gnn_positions.json"),
                        help="Existing GNN positions to blend with (produced by embed_ingredients.py)")
    parser.add_argument("--out", default=str(_project_root() / "public" / "proDataset" / "gnn_positions.json"))
    parser.add_argument("--gnn-weight", type=float, default=0.3,
                        help="Blend weight for the GNN position (the rest comes from Node2Vec)")
    args = parser.parse_args()

    pairings = load_pairings(Path(args.pairings))
    print(f"[node2vec] loaded {len(pairings)} pairings")

    G = build_graph(pairings)
    print(f"[node2vec] graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

    if G.number_of_nodes() == 0:
        print("[node2vec] empty graph — nothing to embed")
        return 1

    emb = run_node2vec(G)
    print(f"[node2vec] embedded {len(emb)} ingredients -> {next(iter(emb.values())).shape[0]}-dim")

    n2v_pos = reduce_3d(emb)
    n2v_pos = normalize(n2v_pos)
    print(f"[node2vec] projected to 3D and normalized (p95 radius = {TARGET_RADIUS})")

    # Load existing GNN positions for blending
    gnn_positions: dict[str, list[float]] = {}
    gnn_path = Path(args.gnn)
    if gnn_path.exists():
        with gnn_path.open("r", encoding="utf-8") as fh:
            raw = json.load(fh)
        for k, v in raw.items():
            if k.startswith("_"):
                continue
            if isinstance(v, list) and len(v) == 3:
                gnn_positions[k] = v
        print(f"[node2vec] will blend against {len(gnn_positions)} GNN-anchored ingredients (weight={args.gnn_weight})")

    out = {}
    blended = 0
    pure = 0
    for name, pos in n2v_pos.items():
        gnn = gnn_positions.get(name)
        if gnn is not None:
            p = (1 - args.gnn_weight) * pos + args.gnn_weight * np.array(gnn)
            blended += 1
        else:
            p = pos
            pure += 1
        out[name] = [float(round(x, 3)) for x in p.tolist()]

    out["_meta"] = {
        "source": "node2vec(proDataset.pairings) + gnn-anchor blend",
        "n": len(n2v_pos),
        "blended_anchors": blended,
        "pure_n2v": pure,
        "target_radius": TARGET_RADIUS,
        "gnn_weight": args.gnn_weight,
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(out, fh)
    print(f"[node2vec] wrote {out_path} — {len(n2v_pos)} positions ({blended} blended, {pure} pure Node2Vec)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
