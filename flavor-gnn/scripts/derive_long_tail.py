"""derive_long_tail.py — build flavor_graph_full.csv from chef + GNN signals.

Single-root data step for the N+1 v3 corpus-wide stage (N1-V3a). Produces
a unified 9-column CSV in the same schema as the chef curation file,
covering every ingredient the app currently visualizes.

Inputs
------
- flavor-gnn/curation/top500_flavor_graph.csv     (chef rows; 89 populated)
- flavor-gnn/artifacts/threshold_calibration_v3.json (calibrated per-task thresholds)
- public/proDataset/gnn_entropy.json              (11-head probs per ingredient)
- public/proDataset/gnn_compounds.json            (top compound tags per ingredient)
- public/proDataset/flavor_positions.json         (universe of visible ingredients)

Output
------
- flavor-gnn/curation/flavor_graph_full.csv       (3,390 rows; 9-col schema)

Per-row policy
--------------
- Chef row with tier1_aroma populated: K-cap and pass through (sources=manual-top-500)
- Else with GNN entropy: rule-derive tier1/tier2 from probs above v3 thresholds,
  leaves from gnn_compounds tag counts (sources=rule-derived)
- Else: hub-fallback row with empty tier columns (sources=hub-fallback)

Locked vocabulary (per N+1 v3 Q6/Q7)
-----------------------------------
- TIER1_VOCAB = {fruity, floral, green, woody, fatty}    — spicy dropped (Q7)
- TIER2_VOCAB = {sweet, sour, bitter, umami}              — salty dropped (Q6)
- K_T1=1 (primary only), K_T2=3, K_T3=3, K_LEAVES=5

Idempotency: deterministic ordering at every step (lexical for ties).
Re-running on unchanged inputs produces byte-identical output.
"""
from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# ── Inputs ──────────────────────────────────────────────────────────
CHEF_CSV = ROOT / "flavor-gnn" / "curation" / "top500_flavor_graph.csv"
THRESHOLDS = ROOT / "flavor-gnn" / "artifacts" / "threshold_calibration_v3.json"
GNN_ENTROPY = ROOT / "public" / "proDataset" / "gnn_entropy.json"
GNN_COMPOUNDS = ROOT / "public" / "proDataset" / "gnn_compounds.json"
POSITIONS = ROOT / "public" / "proDataset" / "flavor_positions.json"
INGREDIENTS = ROOT / "public" / "proDataset" / "ingredients.json"
ALIAS_MAP = ROOT / "flavor-gnn" / "curation" / "v3_alias_map.json"

# ── Output ──────────────────────────────────────────────────────────
OUT_CSV = ROOT / "flavor-gnn" / "curation" / "flavor_graph_full.csv"

# ── Vocabulary / caps ───────────────────────────────────────────────
TIER1_VOCAB = ("fruity", "floral", "green", "woody", "fatty")
TIER2_VOCAB = ("sweet", "sour", "bitter", "umami")

# Heuristic mapping for ingredients.json `category` → tier1 aroma when
# we have no chemistry signal (no GNN entry, no chef row). Conservative —
# only maps categories with an unambiguous aroma family. Categories
# without a clear aroma fit (protein, liquid, condiment, etc.) get no
# tier1; the row still gets tier2 from the curated `taste` field.
CATEGORY_TO_TIER1: dict[str, str] = {
    "fruit":      "fruity",
    "citrus":     "fruity",
    "berry":      "fruity",
    "vegetable":  "green",
    "leafy":      "green",
    "herb":       "green",
    "aromatic":   "green",
    "nut":        "woody",
    "seed":       "woody",
    "grain":      "woody",
    "baked":      "woody",
    "dairy":      "fatty",
    "fat":        "fatty",
    "cheese":     "fatty",
}

# Heuristic vocab for parsing ingredients.json's `taste` field (space-
# separated). Includes the 7 v3 tier2 terms (salty dropped per Q6).
INGREDIENTS_TIER2_VOCAB = frozenset({
    "sweet", "sour", "bitter", "umami", "pungent", "astringent", "spicy",
})

# Garbage filter for the heuristic-only ingest: ingredients.json entries
# with category=='other' AND totalCount below this threshold are dropped.
# 745 'other' entries exist; ~300-400 with count<10 are typos / one-off
# anomalies (walru, ymer, roasting pan, etc.).
GARBAGE_OTHER_COUNT_FLOOR = 10
K_T1, K_T2, K_T3, K_LEAVES = 1, 3, 3, 5

# Compound-descriptor tags that map to Tier-3 mouthfeel terms. Used to
# enrich rule-derived rows so their feature density matches chef rows
# (V3a acceptance gate: chef/derived median ratio ≤ 1.5×).
TAG_TO_T3: dict[str, str] = {
    "waxy": "waxy",
    "wax": "waxy",
    "fat": "oily",
    "fatty": "oily",
    "oily": "oily",
    "pungent": "pungent",
    "camphor": "cooling",
    "menthol": "cooling",
    "peppermint": "cooling",
    "wintergreen": "cooling",
    "mint": "cooling",
    "fresh": "cooling",
    "powdery": "powdery",
    "creamy": "creamy",
    "buttery": "creamy",
    "milky": "creamy",
    "astringent": "astringent",
    "sticky": "sticky",
    "alkane": "waxy",
}

# Compound-descriptor tags too generic to be leaves; the taste signal
# is already represented in tier2, so we don't double-count.
DESCRIPTOR_BLOCKLIST = frozenset({
    "odorless",
    "sweet",
    "bitter",
    "sour",
    "salty",
    "umami",
    "medical",
    "tasteless",
})

COLUMNS = (
    "name",
    "tier1_aroma",
    "tier2_taste",
    "tier3_mouthfeel",
    "leaves",
    "sources",
    "key_pairings",
    "pairing_principles",
    "chemistry_notes",
)


def _load_thresholds(path: Path) -> dict[str, float]:
    """Map task name → calibrated threshold from threshold_calibration_v3.json."""
    doc = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, float] = {}
    for entry in doc.get("per_task", []):
        task = entry.get("task")
        thr = entry.get("calibrated_threshold")
        if task and thr is not None:
            out[task] = float(thr)
    return out


def _load_chef_rows(path: Path) -> dict[str, dict[str, str]]:
    """Read chef CSV into {name: row_dict}. Empty rows kept; cleaner downstream."""
    out: dict[str, dict[str, str]] = {}
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            name = (row.get("name") or "").strip()
            if name:
                out[name] = {k: (v or "").strip() for k, v in row.items()}
    return out


def _cap_pipe_list(s: str, k: int) -> str:
    """K-cap a pipe-separated multi-value string while preserving order."""
    if not s:
        return ""
    parts = [p.strip() for p in s.split("|") if p.strip()]
    return "|".join(parts[:k])


def _cap_chef_row(row: dict[str, str]) -> dict[str, str]:
    """Pass-through with K-caps applied to multi-value columns.

    Chef rows keep their authored text but get density-normalized so the
    GAT sees comparable feature counts across chef and derived rows.
    """
    return {
        "name": row["name"],
        "tier1_aroma": _cap_pipe_list(row.get("tier1_aroma", ""), K_T1),
        "tier2_taste": _cap_pipe_list(row.get("tier2_taste", ""), K_T2),
        "tier3_mouthfeel": _cap_pipe_list(row.get("tier3_mouthfeel", ""), K_T3),
        "leaves": _cap_pipe_list(row.get("leaves", ""), K_LEAVES),
        "sources": row.get("sources") or "manual-top-500",
        "key_pairings": row.get("key_pairings", ""),
        "pairing_principles": row.get("pairing_principles", ""),
        "chemistry_notes": row.get("chemistry_notes", ""),
    }


def _derive_tier1(probs: dict[str, float], thresholds: dict[str, float]) -> list[str]:
    """Top K_T1 aroma terms above v3 calibrated threshold, in TIER1_VOCAB only."""
    candidates: list[tuple[str, float]] = []
    for term in TIER1_VOCAB:
        key = f"odor_{term}"
        p = float(probs.get(key, 0.0))
        thr = thresholds.get(key, 1.0)
        if p >= thr:
            candidates.append((term, p))
    candidates.sort(key=lambda x: (-x[1], x[0]))
    return [t for t, _ in candidates[:K_T1]]


def _derive_tier2(probs: dict[str, float], thresholds: dict[str, float]) -> list[str]:
    """Top K_T2 taste terms above v3 calibrated threshold, in TIER2_VOCAB only."""
    candidates: list[tuple[str, float]] = []
    for term in TIER2_VOCAB:
        p = float(probs.get(term, 0.0))
        thr = thresholds.get(term, 1.0)
        if p >= thr:
            candidates.append((term, p))
    candidates.sort(key=lambda x: (-x[1], x[0]))
    return [t for t, _ in candidates[:K_T2]]


def _derive_tier3(compounds_entry: dict | None) -> list[str]:
    """Top K_T3 mouthfeel terms from compound descriptor tags via TAG_TO_T3."""
    if not compounds_entry:
        return []
    counter: Counter[str] = Counter()
    for compound in compounds_entry.get("top_compounds", []):
        for tag in compound.get("tags", []):
            t3 = TAG_TO_T3.get((tag or "").strip().lower())
            if t3:
                counter[t3] += 1
    ranked = sorted(counter.items(), key=lambda x: (-x[1], x[0]))
    return [t for t, _ in ranked[:K_T3]]


def _derive_leaves(compounds_entry: dict | None) -> list[str]:
    """Top K_LEAVES descriptor tags by frequency across top_compounds, blocklist-filtered."""
    if not compounds_entry:
        return []
    counter: Counter[str] = Counter()
    for compound in compounds_entry.get("top_compounds", []):
        for tag in compound.get("tags", []):
            tag = (tag or "").strip().lower()
            if not tag or tag in DESCRIPTOR_BLOCKLIST:
                continue
            counter[tag] += 1
    ranked = sorted(counter.items(), key=lambda x: (-x[1], x[0]))
    return [tag for tag, _ in ranked[:K_LEAVES]]


def _derive_heuristic_row(name: str, info: dict) -> dict[str, str]:
    """Category-heuristic row for ingredients.json entries with no
    GNN signal and no chef curation. Tier1 from category map, tier2
    from the curated `taste` string, tier3/leaves empty."""
    category = (info.get("category") or "").strip().lower()
    taste = (info.get("taste") or "").strip().lower()
    tier1 = []
    t1_match = CATEGORY_TO_TIER1.get(category)
    if t1_match:
        tier1 = [t1_match]
    tier2 = []
    for tok in taste.split():
        tok = tok.strip()
        if tok in INGREDIENTS_TIER2_VOCAB:
            tier2.append(tok)
    return {
        "name": name,
        "tier1_aroma": "|".join(tier1[:K_T1]),
        "tier2_taste": "|".join(tier2[:K_T2]),
        "tier3_mouthfeel": "",
        "leaves": "",
        "sources": "category-heuristic",
        "key_pairings": "",
        "pairing_principles": "",
        "chemistry_notes": "",
    }


def _derive_row(
    name: str,
    entropy: dict[str, dict] | None,
    compounds: dict | None,
    thresholds: dict[str, float],
) -> dict[str, str]:
    """Build a derived row. Returns hub-fallback shape if no GNN signal exists."""
    if entropy is None:
        return {
            "name": name,
            "tier1_aroma": "",
            "tier2_taste": "",
            "tier3_mouthfeel": "",
            "leaves": "",
            "sources": "hub-fallback",
            "key_pairings": "",
            "pairing_principles": "",
            "chemistry_notes": "",
        }
    probs = entropy.get("probs", {})
    return {
        "name": name,
        "tier1_aroma": "|".join(_derive_tier1(probs, thresholds)),
        "tier2_taste": "|".join(_derive_tier2(probs, thresholds)),
        "tier3_mouthfeel": "|".join(_derive_tier3(compounds)),
        "leaves": "|".join(_derive_leaves(compounds)),
        "sources": "rule-derived",
        "key_pairings": "",
        "pairing_principles": "",
        "chemistry_notes": "",
    }


def _density(row: dict[str, str]) -> int:
    """Total feature count across leaves + T3 + T2 columns (for the chef-vs-derived audit)."""
    return sum(
        len([p for p in (row.get(col) or "").split("|") if p.strip()])
        for col in ("leaves", "tier3_mouthfeel", "tier2_taste")
    )


def build() -> None:
    thresholds = _load_thresholds(THRESHOLDS)
    chef_rows = _load_chef_rows(CHEF_CSV)
    entropy = json.loads(GNN_ENTROPY.read_text(encoding="utf-8"))
    compounds = json.loads(GNN_COMPOUNDS.read_text(encoding="utf-8"))
    universe = json.loads(POSITIONS.read_text(encoding="utf-8"))
    ingredients = json.loads(INGREDIENTS.read_text(encoding="utf-8"))

    # 2026-05-23: load the v3 alias map so variant spellings ("absolut
    # citron", "raw shrimp") get folded into their canonical v3 entry
    # (vodka, shrimp). Aliased outside-v3 names are dropped from the
    # heuristic-candidates set so they don't produce duplicate rows.
    alias_map: dict[str, str] = {}
    if ALIAS_MAP.exists():
        doc = json.loads(ALIAS_MAP.read_text(encoding="utf-8"))
        alias_map = dict(doc.get("auto_high_confidence", {}))

    # Universe: union of (a) flavor_positions_v3 names (the chemistry-
    # backed core, 3,390 nodes) and (b) ingredients.json names with the
    # garbage filter (drop category='other' with totalCount<floor) and
    # the alias filter (drop names that fold into a canonical v3 entry).
    chemistry_universe = set(universe.keys())
    heuristic_candidates: set[str] = set()
    dropped_garbage = 0
    dropped_aliased = 0
    for name, info in ingredients.items():
        if name.startswith("_"):
            continue
        if name in chemistry_universe:
            continue
        # Skip if this name has an alias into the v3 universe — its
        # signal already exists under the canonical name. (Aliases
        # pointing outside v3 are ignored here; canonical absorbs no
        # signal that isn't already represented.)
        if name in alias_map and alias_map[name] in chemistry_universe:
            dropped_aliased += 1
            continue
        category = (info.get("category") or "").strip().lower()
        count = int(info.get("totalCount", 0))
        if category == "other" and count < GARBAGE_OTHER_COUNT_FLOOR:
            dropped_garbage += 1
            continue
        heuristic_candidates.add(name)

    names = sorted(chemistry_universe | heuristic_candidates)
    print(f"[v3a] universe: {len(chemistry_universe)} chemistry + "
          f"{len(heuristic_candidates)} heuristic = {len(names)} total "
          f"(dropped {dropped_garbage} garbage, {dropped_aliased} aliased)")

    out_rows: list[dict[str, str]] = []
    densities: dict[str, list[int]] = {
        "manual-top-500": [], "rule-derived": [], "hub-fallback": [],
        "category-heuristic": [],
    }

    for name in names:
        chef = chef_rows.get(name)
        if chef and (chef.get("tier1_aroma") or "").strip():
            row = _cap_chef_row(chef)
        elif name in chemistry_universe:
            row = _derive_row(name, entropy.get(name), compounds.get(name), thresholds)
        else:
            row = _derive_heuristic_row(name, ingredients.get(name, {}))
        out_rows.append(row)
        densities[row["sources"].split(";")[0]].append(_density(row))

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(COLUMNS)
        for row in out_rows:
            writer.writerow([row[c] for c in COLUMNS])

    # ── Audit summary ─────────────────────────────────────────────
    counts = Counter(r["sources"].split(";")[0] for r in out_rows)
    print(f"[v3a] wrote {len(out_rows)} rows → {OUT_CSV.relative_to(ROOT)}")
    print(f"[v3a] source breakdown: {dict(counts)}")
    print("[v3a] median feature density (leaves+T3+T2):")
    for src, vals in densities.items():
        if not vals:
            continue
        vs = sorted(vals)
        median = vs[len(vs) // 2]
        mean = sum(vs) / len(vs)
        print(f"  {src:<18} n={len(vs):>5}  median={median:>2}  mean={mean:.2f}")

    if densities["manual-top-500"] and densities["rule-derived"]:
        m = sorted(densities["manual-top-500"])[len(densities["manual-top-500"]) // 2]
        d = sorted(densities["rule-derived"])[len(densities["rule-derived"]) // 2]
        ratio = (m / d) if d else float("inf")
        gate = ratio <= 1.5
        print(f"[v3a] chef/derived median density ratio: {ratio:.2f}  "
              f"{'PASS' if gate else 'WARN'} (AC: ≤ 1.5)")


if __name__ == "__main__":
    build()
