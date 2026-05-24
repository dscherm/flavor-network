"""fill_empty_tiers.py — rule-derive tier1/2/3 for rows with empty tier columns.

The flavor_graph_full.csv has 4173 rows, but ~1570 (38%) have empty
tier1_aroma + tier2_taste + tier3_mouthfeel columns. These are the
rule-derived rows from derive_long_tail.py that the chef hasn't
hand-curated yet. With no tier data, downstream layout / GNN /
clustering cannot differentiate them.

This script fills the empty tier cells from two chef-curated sources
already present in ingredients.json:

  - category field (26 buckets: chili, dairy, fruit, citrus, herb, ...)
    → maps to tier1 (aroma) + tier3 (mouthfeel) via the rule table below
  - taste field (multi-taste blend string)
    → maps to tier2 (taste) directly (sweet sour bitter salty umami pungent astringent spicy)

**The 191 chef-curated rows are not touched** — only rows where the
specific tier column is empty get filled. A `derivation` source tag is
appended to the `sources` column so chef can later identify rule-derived
tier data and override if needed.

Source-of-truth for category → tier1/tier3 mapping was chosen by reading
the existing chef-curated rows in the CSV (e.g. mint = tier1 green,
tier3 cooling) and replicating that intent at the category level.

Usage:
    python flavor-gnn/scripts/fill_empty_tiers.py [--dry-run]
"""
from __future__ import annotations

import argparse
import csv
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = ROOT / "flavor-gnn" / "curation" / "flavor_graph_full.csv"
INGREDIENTS = ROOT / "public" / "proDataset" / "ingredients.json"

# Rule table: category -> (tier1 tokens, tier3 tokens).
# tier1 = aroma class (fruity, floral, green, woody, fatty, spicy, ...).
# tier3 = mouthfeel (creamy, oily, cooling, pungent, crispy, tender, ...).
CATEGORY_TIERS: dict[str, tuple[list[str], list[str]]] = {
    "chili":      (["spicy"],            ["pungent", "warming"]),
    "spice":      (["spicy", "woody"],   ["warming", "pungent"]),
    "herb":       (["green"],            ["cooling", "tender"]),
    "aromatic":   (["green", "woody"],   ["pungent"]),
    "seasoning":  (["spicy"],            ["pungent"]),
    "citrus":     (["fruity"],           ["cooling"]),
    "fruit":      (["fruity"],           ["juicy"]),
    "vegetable":  (["green"],            ["crispy"]),
    "dairy":      (["fatty"],            ["creamy"]),
    "fat":        (["fatty"],            ["oily"]),
    "nut":        (["fatty", "woody"],   ["crunchy"]),
    "grain":      (["woody"],            ["chewy"]),
    "protein":    (["meaty"],            ["tender", "chewy"]),
    "sweetener":  (["sweet"],            ["sticky"]),
    "thickener":  (["sweet"],            ["creamy"]),
    "condiment":  (["pungent"],          ["sticky"]),
    "umami":      (["meaty"],            ["chewy"]),
    "liquid":     ([],                   ["watery"]),
    "acid":       ([],                   ["pungent"]),
    "liqueur":    (["sweet", "fruity"],  ["warming"]),
    "spirit":     (["woody"],            ["warming"]),
    "bitters":    (["woody"],            ["pungent"]),
    "mixer":      (["fruity"],           ["watery"]),
    "baked":      (["woody"],            ["chewy"]),
    "confection": (["sweet"],            ["sticky"]),
    "other":      ([],                   []),  # no signal — leave empty
}

# Tier2 vocab from chef-curated rows we want to honor when echoing the
# ingredients.json.taste field (the encoded variant uses these directly).
TIER2_TOKENS = {"sweet", "sour", "bitter", "salty", "umami",
                "pungent", "astringent", "spicy"}


def split_pipe(s: str | None) -> list[str]:
    if not isinstance(s, str) or not s.strip():
        return []
    return [t.strip() for t in s.split("|") if t.strip()]


def main(dry_run: bool) -> None:
    # Load ingredients.json for category + taste lookup
    ing = json.loads(INGREDIENTS.read_text(encoding="utf-8"))

    # Read CSV
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fields = list(reader.fieldnames or [])
        rows = list(reader)

    n = len(rows)
    print(f"[fill] loaded {n} rows from {CSV_PATH.name}")

    # Pre-count empty tiers
    empty_t1 = sum(1 for r in rows if not (r.get("tier1_aroma") or "").strip())
    empty_t2 = sum(1 for r in rows if not (r.get("tier2_taste") or "").strip())
    empty_t3 = sum(1 for r in rows if not (r.get("tier3_mouthfeel") or "").strip())
    print(f"[fill] before — empty tier1: {empty_t1}, tier2: {empty_t2}, tier3: {empty_t3}")

    # Fill
    filled_t1 = filled_t2 = filled_t3 = 0
    for r in rows:
        name = (r.get("name") or "").strip()
        info = ing.get(name) if isinstance(ing, dict) else None
        cat = (info.get("category") if isinstance(info, dict) else None) or None
        taste = (info.get("taste") if isinstance(info, dict) else None) or None

        t1_existing = (r.get("tier1_aroma") or "").strip()
        t2_existing = (r.get("tier2_taste") or "").strip()
        t3_existing = (r.get("tier3_mouthfeel") or "").strip()

        if not t1_existing and cat in CATEGORY_TIERS:
            tier1_tokens = CATEGORY_TIERS[cat][0]
            if tier1_tokens:
                r["tier1_aroma"] = "|".join(tier1_tokens)
                filled_t1 += 1

        if not t2_existing and isinstance(taste, str) and taste.strip():
            toks = [t.lower() for t in taste.split() if t.lower() in TIER2_TOKENS]
            toks = list(dict.fromkeys(toks))  # dedup, preserve order
            if toks:
                r["tier2_taste"] = "|".join(toks)
                filled_t2 += 1

        if not t3_existing and cat in CATEGORY_TIERS:
            tier3_tokens = CATEGORY_TIERS[cat][1]
            if tier3_tokens:
                r["tier3_mouthfeel"] = "|".join(tier3_tokens)
                filled_t3 += 1

        # Tag the source so chef can find rule-filled rows later
        if filled_t1 or filled_t2 or filled_t3:
            existing_sources = (r.get("sources") or "").strip()
            if "tier-fill-2026-05-24" not in existing_sources:
                if existing_sources:
                    r["sources"] = existing_sources + ";tier-fill-2026-05-24"
                else:
                    r["sources"] = "tier-fill-2026-05-24"

    # Post-count
    after_t1 = sum(1 for r in rows if not (r.get("tier1_aroma") or "").strip())
    after_t2 = sum(1 for r in rows if not (r.get("tier2_taste") or "").strip())
    after_t3 = sum(1 for r in rows if not (r.get("tier3_mouthfeel") or "").strip())
    print(f"[fill] filled  — tier1: +{filled_t1}, tier2: +{filled_t2}, tier3: +{filled_t3}")
    print(f"[fill] after   — empty tier1: {after_t1}, tier2: {after_t2}, tier3: {after_t3}")

    if dry_run:
        print("[fill] dry-run — no files written")
        return

    bak = CSV_PATH.with_suffix(".csv.pre-tier-fill.bak")
    if not bak.exists():
        shutil.copy2(CSV_PATH, bak)

    with CSV_PATH.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        w.writerows(rows)
    print(f"[fill] wrote {CSV_PATH.relative_to(ROOT)}  (backup: {bak.name})")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    main(dry_run=args.dry_run)
