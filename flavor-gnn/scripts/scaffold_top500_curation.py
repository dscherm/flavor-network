"""Scaffold the top-500 chef-curation CSV for the flavor-model expansion.

P-A0 of the v3 plan (see
`.omc/plans/ralplan-flavor-model-expansion-v3-pathAB.md`). Originally
P0 of v2 (`.omc/plans/ralplan-flavor-model-expansion.md` §2.2 P0).

This script is IDEMPOTENT. Re-running it preserves any row where any
manual column (tier1_aroma, tier2_taste, tier3_mouthfeel, leaves,
key_pairings, pairing_principles, chemistry_notes) is non-empty.
Empty rows are refilled from `ingredients.json`'s top-500 by pairing
count. Manual entries are never overwritten by re-run.

The schema is the v3 9-column shape:
    name, tier1_aroma, tier2_taste, tier3_mouthfeel, leaves, sources,
    key_pairings, pairing_principles, chemistry_notes

`key_pairings` is pipe-separated ingredient names (typically 7 per row).
`pairing_principles` is pipe-separated edge labels (typically 7 per row,
positionally aligned with key_pairings). `chemistry_notes` is free-text
chef annotation. These three columns were added by the chef-user during
the v2→v3 schema pivot (2026-05-19). The scaffold preserves them across
re-runs by including them in MANUAL_COLUMNS — any chef edit to any of
the seven manual columns marks the row as chef-edited.

Pairing-count derivation: ingredients.json has `totalCount` (recipe-coocc
total), NOT `pairingCount`. Per `src/hooks/useProData.js:103-108`,
`pairingCount` is the count of edges per node (how many other ingredients
this one pairs with). We derive it here by counting occurrences of each
name as `ingredientA` or `ingredientB` in `pairings.json`. This matches
the in-app definition exactly.

Inputs:
    public/proDataset/ingredients.json
    public/proDataset/pairings.json

Output:
    flavor-gnn/curation/top500_flavor_graph.csv

The original 5 v2 fixture seeds (mint, vanilla, soy sauce, lemon, garlic)
are still pre-filled IF the rows are otherwise empty. The chef-user in
the v3 pivot re-curated from scratch (alphabetically apple → bacon → …)
and none of the original 5 fixtures survived in their CSV — that's fine;
they may or may not exist in the final file depending on whether the
chef backfills `garlic`/`lemon`/`soy sauce` per the M1 priority list
in `.omc/notepad.md`.

Usage:
    python flavor-gnn/scripts/scaffold_top500_curation.py
"""
from __future__ import annotations

import csv
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Dict, List


# Top-500 size — the delivery contract is hard-coded to 500.
TOP_N = 500

# Manual columns we treat as "chef-edited evidence" for preservation
# across re-runs. Any non-empty value in any of these marks the row as
# chef-edited; the scaffold then preserves the row VERBATIM rather than
# overwriting with a fresh seed. v2 had 4 columns (the tier columns);
# v3 adds key_pairings + pairing_principles + chemistry_notes — also
# chef-edited and equally sacred per the pipeline-rebuild-wipes-manual-
# data-additions lesson (how=1: row-content detection, not name-only).
MANUAL_COLUMNS: tuple[str, ...] = (
    "tier1_aroma",
    "tier2_taste",
    "tier3_mouthfeel",
    "leaves",
    "key_pairings",
    "pairing_principles",
    "chemistry_notes",
)

# Column order for the output CSV (v3 9-column schema).
COLUMNS: tuple[str, ...] = (
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

# Fixture seeds — empty in v3. The v2 plan pre-filled 5 fixture rows
# (mint, vanilla, soy sauce, lemon, garlic) to anchor the §2.4 P0
# canonical-fixture preservation gate. The chef-user in the v3 pivot
# re-curated from scratch (alphabetical from `apple`) and none of the
# v2 fixtures survived in their CSV. Re-emitting them now would create
# rows the chef has explicitly chosen NOT to curate yet — see
# `.omc/notepad.md` §"Fixture-preservation gate adjustment" for the
# rationale. If the chef later backfills `garlic`/`lemon`/`soy sauce`
# from the M1 priority list, they fill them from scratch with the
# v3 9-column schema, not from these stale v2 seeds.
FIXTURE_SEEDS: Dict[str, Dict[str, str]] = {}


def _project_root() -> Path:
    # flavor-gnn/scripts/this_file.py -> repo root
    return Path(__file__).resolve().parents[2]


def _load_ingredients(root: Path) -> Dict[str, dict]:
    p = root / "public" / "proDataset" / "ingredients.json"
    with p.open("r", encoding="utf-8") as f:
        data = json.load(f)
    # Strip meta keys (any starting with "_") to match useProData.js:50.
    return {k: v for k, v in data.items() if not k.startswith("_")}


def _compute_pairing_counts(root: Path, valid_names: set) -> Counter:
    """Count pairing edges per ingredient, mirroring useProData.js:103-108.

    pairings.json is an array of {ingredientA, ingredientB, strength}.
    Each pairing increments the count of BOTH endpoints (so an ingredient
    in N pairings has pairingCount=N, which is its degree in the graph).
    """
    p = root / "public" / "proDataset" / "pairings.json"
    with p.open("r", encoding="utf-8") as f:
        pairings = json.load(f)
    counts: Counter = Counter()
    for pair in pairings:
        a = pair.get("ingredientA")
        b = pair.get("ingredientB")
        # Mirror useProData.js: only count when both endpoints exist as
        # nodes (filters pairings that reference dropped/meta names).
        if a in valid_names and b in valid_names:
            counts[a] += 1
            counts[b] += 1
    return counts


def _row_is_manual(row: Dict[str, str]) -> bool:
    """A row is manual-edited if ANY manual column has non-empty content.

    Per plan §2.2 P0 step 2 and lesson `pipeline-rebuild-wipes-manual-
    data-additions` how=1: row-content detection (not name-only), so
    chef-user edits survive a re-run regardless of whether the name is
    still in the top-500 sort window. v3: a chef edit to key_pairings,
    pairing_principles, or chemistry_notes ALONE (without any tier
    value) also counts as manual evidence and protects the row.
    """
    for col in MANUAL_COLUMNS:
        if (row.get(col) or "").strip():
            return True
    return False


def _read_existing_csv(out_path: Path) -> Dict[str, Dict[str, str]]:
    """Return {name: row_dict} for an existing CSV, or {} if absent."""
    if not out_path.exists():
        return {}
    with out_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        return {row["name"]: row for row in reader}


def _seed_row(name: str) -> Dict[str, str]:
    """Construct a fresh row for `name`. Pre-fills canonical fixtures."""
    base = {col: "" for col in COLUMNS}
    base["name"] = name
    base["sources"] = "manual-top-500"
    if name in FIXTURE_SEEDS:
        base.update(FIXTURE_SEEDS[name])
    return base


def main() -> int:
    root = _project_root()
    out_dir = root / "flavor-gnn" / "curation"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "top500_flavor_graph.csv"

    ingredients = _load_ingredients(root)
    pairing_counts = _compute_pairing_counts(root, set(ingredients.keys()))

    # Top-N by pairingCount desc, tie-break alphabetically for stable
    # ordering across runs (so an idempotent re-run produces byte-equal
    # output when no edits happened in between).
    ranked = sorted(
        ingredients.keys(),
        key=lambda n: (-pairing_counts.get(n, 0), n),
    )
    top_names: List[str] = ranked[:TOP_N]
    top_set = set(top_names)

    existing = _read_existing_csv(out_path)

    rows_out: List[Dict[str, str]] = []
    log_lines: List[str] = []

    # Pass 1: emit one row per name in the new top-500, in rank order.
    for name in top_names:
        if name in existing:
            prev = existing[name]
            if _row_is_manual(prev):
                # Preserve VERBATIM (plan step 2: manual-edited row wins).
                rows_out.append({col: prev.get(col, "") for col in COLUMNS})
                continue
            # Slot exists but is empty — refresh (plan step 4).
            rows_out.append(_seed_row(name))
        else:
            # New top-500 entry — fresh seed row (plan step 3).
            rows_out.append(_seed_row(name))

    # Pass 2: preserve dropped manual rows (plan step 5).
    # Names that USED to be in the top-500 but fell out: if they carry
    # manual edits, keep them in the file. Log to stderr so the chef-user
    # knows the file size has drifted from 500.
    dropped_manual_rows: List[Dict[str, str]] = []
    for name, prev_row in existing.items():
        if name in top_set:
            continue
        if _row_is_manual(prev_row):
            dropped_manual_rows.append(
                {col: prev_row.get(col, "") for col in COLUMNS}
            )
            log_lines.append(
                f"PRESERVED-DROPPED: '{name}' fell out of top-{TOP_N} but "
                f"has manual edits; retained at end of CSV."
            )

    rows_out.extend(dropped_manual_rows)

    # Write with LF newlines for git-diff stability across platforms.
    with out_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(COLUMNS), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows_out)

    n_total = len(rows_out)
    n_dropped = len(dropped_manual_rows)
    print(
        f"scaffold_top500_curation: wrote {n_total} rows "
        f"({TOP_N} top-ranked + {n_dropped} preserved-dropped manual) "
        f"-> {out_path.relative_to(root)}"
    )
    for line in log_lines:
        print(line, file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
