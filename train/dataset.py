"""CSV → torch tensors for the Path B GAT.

Loads `flavor-gnn/curation/top500_flavor_graph.csv` (9-col v3 schema) and
the principle collapse table from `flavor-gnn/curation/principle_vocab.json`,
then emits a `FlavorGraphData` bundle of node features, edge index, edge
attributes, name lookup, and vocabularies.

Honored binding constraints (per `.omc/plans/ralplan-flavor-model-expansion-v3-pathAB.md`
§P-B1 and `.omc/notepad.md` Q6/Q7):
  * tier1 vocabulary is the 5-term Q7 set {fruity, floral, green, woody, fatty}.
    Any chef tier1 token outside that set is silently dropped (counter logged).
  * tier2 vocabulary excludes `salty` per Q6 (7 terms total).
  * Principle collapse is read from `principle_vocab.json` — never hardcoded.
  * Edges are kept only when target ∈ name column (mirrors train_v1.py FILTER).
  * Multi-principle pairs (same source/target appearing in multiple rows with
    different principles) get multi-hot edge_attr.
"""
from __future__ import annotations

import json
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

import pandas as pd
import torch


TIER1_VOCAB: tuple[str, ...] = ("fruity", "floral", "green", "woody", "fatty")
TIER2_VOCAB: tuple[str, ...] = (
    "sweet", "sour", "bitter", "umami", "pungent", "astringent", "spicy",
)

DEFAULT_VOCAB_PATH = (
    Path(__file__).resolve().parent.parent
    / "flavor-gnn" / "curation" / "principle_vocab.json"
)


@dataclass
class FlavorGraphData:
    node_features: torch.Tensor          # [N, D]
    edge_index:    torch.Tensor          # [2, E]   long
    edge_attr:     torch.Tensor          # [E, P]   float multi-hot
    name_to_idx:   dict[str, int]
    vocabularies:  dict[str, list[str]]  # 'tier1', 'tier2', 'tier3', 'leaves', 'principles'
    stats:         dict[str, int | float]


def _split_pipe(value: object) -> list[str]:
    if not isinstance(value, str):
        return []
    return [t.strip() for t in value.split("|") if t.strip()]


def _multi_hot(tokens: list[str], vocab_idx: dict[str, int]) -> list[float]:
    vec = [0.0] * len(vocab_idx)
    for tok in tokens:
        i = vocab_idx.get(tok)
        if i is not None:
            vec[i] = 1.0
    return vec


def _load_principle_vocab(vocab_path: Path) -> tuple[list[str], dict[str, str]]:
    payload = json.loads(vocab_path.read_text(encoding="utf-8"))
    canonical = list(payload["canonical"])
    collapse = dict(payload.get("collapse", {}))
    if payload.get("maillard_collapse_default") is True:
        collapse["maillard-bridge"] = "shared-volatile"
        canonical = [c for c in canonical if c != "maillard-bridge"]
    return canonical, collapse


def load_flavor_graph(
    csv_path: str | Path,
    vocab_path: str | Path | None = None,
    *,
    require_leaves: bool = True,
    extra_edges_path: str | Path | None = None,
    extra_edges_min_strength: float = 0.0,
) -> FlavorGraphData:
    """Load a flavor-graph CSV into tensors.

    Parameters
    ----------
    require_leaves : bool, default True
        When True (Path B v1 fixture behavior), drop rows with empty
        `leaves`. When False (N+1 v3 V3b corpus-wide mode), keep every
        row — rule-derived and hub-fallback rows with empty leaves
        still contribute to message passing via their tier columns + topology.
    extra_edges_path : str | Path | None, default None
        When provided, supplement the chef `key_pairings` edges with
        edges from a pairings JSON file (list of {ingredientA, ingredientB}).
        Supplemental edges carry empty edge_attr (no principle); train_gnn
        must mask them out of the aux classification loss. Used by V3b to
        give rule-derived nodes a topology to learn from.
    """
    csv_path = Path(csv_path)
    vocab_path = Path(vocab_path) if vocab_path else DEFAULT_VOCAB_PATH

    df = pd.read_csv(csv_path).fillna("")
    df["name"] = df["name"].astype(str).str.strip()
    df = df[df["name"] != ""]
    if require_leaves:
        df = df[df["leaves"].astype(str).str.strip() != ""]
    df = df.reset_index(drop=True)

    principle_canonical, collapse = _load_principle_vocab(vocab_path)
    principle_idx = {p: i for i, p in enumerate(principle_canonical)}

    names = sorted(df["name"].unique())
    name_to_idx = {n: i for i, n in enumerate(names)}

    tier1_idx = {t: i for i, t in enumerate(TIER1_VOCAB)}
    tier2_idx = {t: i for i, t in enumerate(TIER2_VOCAB)}

    dropped_counts: Counter[str] = Counter()
    tier1_per_node: dict[str, list[str]] = {}
    tier2_per_node: dict[str, list[str]] = {}
    tier3_per_node: dict[str, list[str]] = {}
    leaves_per_node: dict[str, list[str]] = {}

    tier3_seen: set[str] = set()
    leaves_seen: set[str] = set()

    for _, row in df.iterrows():
        name = str(row["name"]).strip()
        if not name:
            continue

        raw_t1 = _split_pipe(row.get("tier1_aroma", ""))
        t1 = [t for t in raw_t1 if t in tier1_idx]
        dropped_counts["tier1"] += len(raw_t1) - len(t1)

        raw_t2 = _split_pipe(row.get("tier2_taste", ""))
        t2 = [t for t in raw_t2 if t in tier2_idx]
        dropped_counts["tier2"] += len(raw_t2) - len(t2)
        dropped_counts["tier2_salty"] += sum(1 for t in raw_t2 if t == "salty")

        t3 = _split_pipe(row.get("tier3_mouthfeel", ""))
        leaves = _split_pipe(row.get("leaves", ""))

        tier1_per_node[name] = t1
        tier2_per_node[name] = t2
        tier3_per_node[name] = t3
        leaves_per_node[name] = leaves
        tier3_seen.update(t3)
        leaves_seen.update(leaves)

    tier3_vocab = sorted(tier3_seen)
    leaves_vocab = sorted(leaves_seen)
    tier3_idx = {t: i for i, t in enumerate(tier3_vocab)}
    leaves_idx = {t: i for i, t in enumerate(leaves_vocab)}

    node_rows: list[list[float]] = []
    for name in names:
        row = (
            _multi_hot(tier1_per_node.get(name, []), tier1_idx)
            + _multi_hot(tier2_per_node.get(name, []), tier2_idx)
            + _multi_hot(tier3_per_node.get(name, []), tier3_idx)
            + _multi_hot(leaves_per_node.get(name, []), leaves_idx)
        )
        node_rows.append(row)
    node_features = torch.tensor(node_rows, dtype=torch.float32)

    name_set = set(names)
    raw_pair_count = 0
    skipped_unknown_principle = 0
    edge_multi: dict[tuple[int, int], set[int]] = defaultdict(set)

    for _, row in df.iterrows():
        src = str(row["name"]).strip()
        if src not in name_to_idx:
            continue
        kps = _split_pipe(row.get("key_pairings", ""))
        pps = _split_pipe(row.get("pairing_principles", ""))
        if not kps or not pps or len(kps) != len(pps):
            continue
        for tgt, principle in zip(kps, pps):
            raw_pair_count += 1
            if tgt not in name_set:
                continue
            collapsed = collapse.get(principle, principle)
            p_i = principle_idx.get(collapsed)
            if p_i is None:
                skipped_unknown_principle += 1
                continue
            edge_multi[(name_to_idx[src], name_to_idx[tgt])].add(p_i)

    extra_edge_count = 0
    extra_edge_dropped = 0
    if extra_edges_path is not None:
        extra_edges_path = Path(extra_edges_path)
        extra_pairs = json.loads(extra_edges_path.read_text(encoding="utf-8"))
        for pair in extra_pairs:
            a = (pair.get("ingredientA") or pair.get("source") or "").strip()
            b = (pair.get("ingredientB") or pair.get("target") or "").strip()
            if not a or not b or a == b:
                continue
            if a not in name_to_idx or b not in name_to_idx:
                continue
            strength = float(pair.get("strength", 1.0))
            if strength < extra_edges_min_strength:
                extra_edge_dropped += 1
                continue
            key = (name_to_idx[a], name_to_idx[b])
            if key in edge_multi:
                continue
            edge_multi[key] = set()
            extra_edge_count += 1

    if edge_multi:
        edge_index = torch.tensor(
            [[s for (s, _t) in edge_multi.keys()],
             [t for (_s, t) in edge_multi.keys()]],
            dtype=torch.long,
        )
        edge_attr = torch.zeros(
            (len(edge_multi), len(principle_canonical)), dtype=torch.float32,
        )
        for row_i, principles in enumerate(edge_multi.values()):
            for p_i in principles:
                edge_attr[row_i, p_i] = 1.0
    else:
        edge_index = torch.zeros((2, 0), dtype=torch.long)
        edge_attr = torch.zeros((0, len(principle_canonical)), dtype=torch.float32)

    vocabularies: dict[str, list[str]] = {
        "tier1":      list(TIER1_VOCAB),
        "tier2":      list(TIER2_VOCAB),
        "tier3":      tier3_vocab,
        "leaves":     leaves_vocab,
        "principles": principle_canonical,
    }
    stats: dict[str, int | float] = {
        "n_nodes":                 len(names),
        "n_edges":                 edge_index.shape[1],
        "raw_pairs":               raw_pair_count,
        "filter_rate":             (edge_index.shape[1] / raw_pair_count) if raw_pair_count else 0.0,
        "skipped_unknown_principle": skipped_unknown_principle,
        "dropped_tier1_tokens":    int(dropped_counts["tier1"]),
        "dropped_tier2_tokens":    int(dropped_counts["tier2"]),
        "dropped_tier2_salty":     int(dropped_counts["tier2_salty"]),
        "node_feature_dim":        node_features.shape[1],
        "extra_edges_added":       extra_edge_count,
    }

    return FlavorGraphData(
        node_features=node_features,
        edge_index=edge_index,
        edge_attr=edge_attr,
        name_to_idx=name_to_idx,
        vocabularies=vocabularies,
        stats=stats,
    )


def main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "csv",
        type=Path,
        nargs="?",
        default=Path(__file__).resolve().parent.parent
        / "flavor-gnn" / "curation" / "top500_flavor_graph.csv",
    )
    args = parser.parse_args(argv)

    data = load_flavor_graph(args.csv)
    print(f"[dataset] csv: {args.csv}")
    print(f"[dataset] node_features: {tuple(data.node_features.shape)}")
    print(f"[dataset] edge_index:    {tuple(data.edge_index.shape)}")
    print(f"[dataset] edge_attr:     {tuple(data.edge_attr.shape)}")
    print(f"[dataset] vocab sizes: " + ", ".join(
        f"{k}={len(v)}" for k, v in data.vocabularies.items()
    ))
    print("[dataset] stats:")
    for k, v in data.stats.items():
        if isinstance(v, float):
            print(f"  {k:>30} = {v:.3f}")
        else:
            print(f"  {k:>30} = {v}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
