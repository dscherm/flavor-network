"""impute_hub_embeddings.py — neighbor-average imputation for sparse-feature nodes.

V3c step. The V3b GAT produced 3,390 × 16-d embeddings, but for nodes
with empty or near-empty tier columns the GAT had no chemistry signal
to learn from — its embedding for them is shaped only by message
passing from neighbors. Hub-fallback nodes (no GNN entry at all) get
the worst placement; the 155 weakest rule-derived rows are similar.

For each sparse node we compute the centroid of its top-N pairing
partners' embeddings (weighted by pairings.strength), excluding any
neighbor that's also in the impute set so the imputation doesn't
propagate from one zero-signal node to another.

Inputs
------
- flavor-gnn/artifacts/flavor_embeddings_v3.npy   (3,390 × 16 GAT)
- flavor-gnn/curation/flavor_graph_full.csv       (per-row density / source)
- public/proDataset/pairings.json                 (neighbor topology + strength)
- public/proDataset/flavor_graph_data_v3.json     (name → row-index map)

Output
------
- flavor-gnn/artifacts/flavor_embeddings_v3_imputed.npy   (same shape, imputed)
- flavor-gnn/artifacts/flavor_embeddings_v3_audit.json    (per-node audit trail)

Policy (locked):
- Chef rows (sources=manual-top-500)                → keep GAT (option a)
- Rule-derived rows with density ≥ DENSITY_THRESHOLD → keep GAT (option a)
- Rule-derived rows with density < DENSITY_THRESHOLD → impute
- Hub-fallback rows                                  → impute
- Impute = weighted mean of top-N pairing neighbors (by strength) that
  are themselves NOT in the impute set; weight = pairing strength.
- Fallback when a node has no qualifying neighbors: global centroid
  of the trusted (non-imputed) embeddings.

Why neighbor-averaging over Node2Vec + PCA:
  Both give topology-aware placement; neighbor-averaging stays in the
  GAT's native 16-d space (no projection mixing) and requires no extra
  training. The Node2Vec random-walk advantage (multi-hop reach) is
  modest at corpus average degree ~10 where 1-hop already captures the
  ingredient's pairing neighborhood.
"""
from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]

EMBEDDINGS = ROOT / "flavor-gnn" / "artifacts" / "flavor_embeddings_v3.npy"
CSV = ROOT / "flavor-gnn" / "curation" / "flavor_graph_full.csv"
PAIRINGS = ROOT / "public" / "proDataset" / "pairings.json"
GRAPH_V3 = ROOT / "public" / "proDataset" / "flavor_graph_data_v3.json"

OUT_NPY = ROOT / "flavor-gnn" / "artifacts" / "flavor_embeddings_v3_imputed.npy"
OUT_AUDIT = ROOT / "flavor-gnn" / "artifacts" / "flavor_embeddings_v3_audit.json"

# A row is sparse when its leaves + tier3_mouthfeel + tier2_taste token
# count is below this threshold. 0 or 1 features = sparse; 2+ = trust GAT.
DENSITY_THRESHOLD = 2

# Top-N pairing partners to include in the centroid, by strength.
TOP_N_NEIGHBORS = 20

# Minimum pairing strength for a neighbor to count.
MIN_STRENGTH = 0.3


def _density(row: dict[str, str]) -> int:
    return sum(
        len([p for p in (row.get(c) or "").split("|") if p.strip()])
        for c in ("leaves", "tier3_mouthfeel", "tier2_taste")
    )


def build() -> None:
    emb = np.load(EMBEDDINGS).astype(np.float32)
    n_nodes, n_dim = emb.shape
    print(f"[v3c] loaded {EMBEDDINGS.relative_to(ROOT)} shape=({n_nodes}, {n_dim})")

    # Name → row-index map (from the V3 graph data file — definitive ordering)
    graph = json.loads(GRAPH_V3.read_text(encoding="utf-8"))
    name_to_idx: dict[str, int] = {n["name"]: i for i, n in enumerate(graph["nodes"])}
    assert len(name_to_idx) == n_nodes, (
        f"name-map size {len(name_to_idx)} != embedding rows {n_nodes}"
    )

    # Per-row source + density from the CSV
    rows: dict[str, dict[str, str]] = {}
    with CSV.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            name = (row.get("name") or "").strip()
            if name:
                rows[name] = row

    impute_set: set[str] = set()
    for name in name_to_idx:
        row = rows.get(name)
        if row is None:
            impute_set.add(name)
            continue
        src = row.get("sources", "").split(";")[0]
        if src == "hub-fallback":
            impute_set.add(name)
        elif src == "rule-derived" and _density(row) < DENSITY_THRESHOLD:
            impute_set.add(name)
    print(f"[v3c] impute set: {len(impute_set)} nodes  "
          f"(hub-fallback + rule-derived with density<{DENSITY_THRESHOLD})")

    # Build name → [(neighbor, strength)] from pairings.json, restricted
    # to the universe and meeting MIN_STRENGTH.
    print(f"[v3c] loading pairings.json …")
    pairs = json.loads(PAIRINGS.read_text(encoding="utf-8"))
    neighbors: dict[str, list[tuple[str, float]]] = defaultdict(list)
    skipped_out_of_universe = 0
    skipped_weak = 0
    for p in pairs:
        a = (p.get("ingredientA") or "").strip()
        b = (p.get("ingredientB") or "").strip()
        if not a or not b or a == b:
            continue
        if a not in name_to_idx or b not in name_to_idx:
            skipped_out_of_universe += 1
            continue
        strength = float(p.get("strength", 0.0))
        if strength < MIN_STRENGTH:
            skipped_weak += 1
            continue
        neighbors[a].append((b, strength))
        neighbors[b].append((a, strength))
    print(f"[v3c] pairings: {len(pairs)} total, "
          f"{skipped_out_of_universe} out-of-universe, {skipped_weak} below "
          f"strength {MIN_STRENGTH}")
    print(f"[v3c] nodes with neighbors: {len(neighbors)} / {n_nodes}")

    # Compute global centroid of trusted (non-impute) embeddings — used
    # as fallback for impute-set nodes with no qualifying neighbors.
    trusted_mask = np.array([name not in impute_set for name in name_to_idx])
    trusted_centroid = emb[trusted_mask].mean(axis=0)

    # Impute: weighted average of top-N trusted pairing partners.
    out = emb.copy()
    audit: list[dict] = []
    no_neighbor_fallback = 0
    successful = 0
    for name, idx in name_to_idx.items():
        if name not in impute_set:
            continue
        nbrs = sorted(neighbors.get(name, []), key=lambda t: -t[1])
        trusted_nbrs = [(n, s) for (n, s) in nbrs if n not in impute_set][:TOP_N_NEIGHBORS]
        if not trusted_nbrs:
            out[idx] = trusted_centroid
            no_neighbor_fallback += 1
            audit.append({
                "name": name,
                "method": "trusted-centroid-fallback",
                "n_trusted_neighbors": 0,
                "raw_neighbors_count": len(nbrs),
            })
            continue
        weights = np.array([s for _n, s in trusted_nbrs], dtype=np.float32)
        weights = weights / weights.sum()
        idxs = np.array([name_to_idx[n] for n, _s in trusted_nbrs])
        out[idx] = (emb[idxs] * weights[:, None]).sum(axis=0)
        successful += 1
        audit.append({
            "name": name,
            "method": "neighbor-weighted-mean",
            "n_trusted_neighbors": len(trusted_nbrs),
            "top_neighbors": [n for n, _s in trusted_nbrs[:5]],
        })

    print(f"[v3c] imputed {successful} nodes via weighted neighbor mean")
    print(f"[v3c] {no_neighbor_fallback} nodes fell back to trusted centroid "
          f"(no qualifying neighbors)")

    OUT_NPY.parent.mkdir(parents=True, exist_ok=True)
    np.save(OUT_NPY, out)
    print(f"[v3c] wrote {OUT_NPY.relative_to(ROOT)} shape={out.shape}")

    OUT_AUDIT.write_text(
        json.dumps({
            "impute_set_size": len(impute_set),
            "imputed_via_neighbors": successful,
            "imputed_via_fallback": no_neighbor_fallback,
            "density_threshold": DENSITY_THRESHOLD,
            "top_n_neighbors": TOP_N_NEIGHBORS,
            "min_strength": MIN_STRENGTH,
            "rows": audit,
        }, indent=2),
        encoding="utf-8",
    )
    print(f"[v3c] wrote {OUT_AUDIT.relative_to(ROOT)}")


if __name__ == "__main__":
    build()
