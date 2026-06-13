"""backfill_top500_tier3.py — fill empty Tier-3 mouthfeel in the chef top-500.

N1-D2 acceptance #1: top500_flavor_graph.csv must have tier3_mouthfeel
populated for >=80% of rows. The chef left 114 of 304 empty. This script
fills *only empty* tier3 cells (chef-authored cells are never touched) from
two sources, in priority order:

  1. CURATED_T3 — a hand-assigned mouthfeel for well-known ingredients that
     carry no molecular mouthfeel signal (no gnn_compounds entry, or only
     aroma/taste tags). Uses the chef's own Tier-3 vocabulary observed in
     the CSV (smooth/tender/juicy/crisp/crunchy/warming/viscous/chewy/
     starchy/oily/pungent/astringent/cooling/...). Tagged `t3-curated`.
  2. Rule-derivation — top-K Tier-3 terms from the ingredient's
     gnn_compounds tags via descriptor_lookup.json. Tagged `t3-derived`.

Provenance is appended to the `sources` column (";"-delimited) so the chef
can find and override every machine-supplied cell. The original file is
backed up to *.pre-n1d2-t3.bak before writing.

Genuinely ambiguous ingredients (aroma-only florals, thin sauces) are left
empty rather than guessed — honest gaps the chef can fill later.

Run: python flavor-gnn/scripts/backfill_top500_tier3.py [--dry-run]
"""
from __future__ import annotations

import argparse
import csv
import json
import shutil
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = ROOT / "flavor-gnn" / "curation" / "top500_flavor_graph.csv"
GNN_COMPOUNDS = ROOT / "public" / "proDataset" / "gnn_compounds.json"
DESCRIPTOR_LOOKUP = ROOT / "flavor-gnn" / "curation" / "descriptor_lookup.json"

K_T3 = 3

# Hand-assigned mouthfeel for well-known ingredients with no molecular
# mouthfeel signal. Chef-overridable (tagged t3-curated). Terms drawn from
# the chef's own Tier-3 vocabulary already in the CSV.
CURATED_T3: dict[str, str] = {
    "anchovy": "oily",
    "artichoke": "tender|astringent",
    "asparagus": "tender|crisp",
    "beet": "tender|juicy",
    "bergamot": "juicy",
    "black lime": "dry|astringent",
    "black tea": "astringent",
    "blackberry": "juicy",
    "blackcurrant": "juicy|astringent",
    "blueberry": "juicy",
    "bonito": "dry",
    "broccoli": "tender|crisp",
    "brown butter": "oily|smooth",
    "caramel": "viscous|smooth",
    "chervil": "tender",
    "cilantro": "tender",
    "clove": "warming|pungent",
    "coconut": "creamy|oily",
    "coffee": "astringent",
    "dill": "tender",
    "egg": "smooth",
    "eggplant": "tender|smooth",
    "epazote": "tender",
    "fig": "tender|juicy",
    "galangal": "pungent",
    "garlic": "pungent",
    "gentian": "astringent",
    "grains of paradise": "warming|pungent",
    "guava": "juicy",
    "hibiscus": "astringent",
    "hops": "astringent",
    "horseradish": "pungent",
    "juniper berry": "astringent",
    "long pepper": "warming|pungent",
    "lovage": "tender",
    "mace": "warming|pungent",
    "mastic": "chewy",
    "mushroom": "tender|chewy",
    "nori": "crisp|dry",
    "olive": "oily|tender",
    "parsley": "tender|crisp",
    "parsnip": "starchy|tender",
    "pea": "tender|juicy",
    "potato": "starchy",
    "prune": "chewy|moist",
    "quince": "astringent",
    "rice": "starchy|tender",
    "savory": "tender",
    "scallion": "crisp|pungent",
    "shiso": "tender",
    "spinach": "tender",
    "sun-dried tomato": "chewy",
    "tamarind": "viscous",
    "tomato": "juicy",
    "turnip": "crisp|tender",
    "wasabi": "pungent",
    "wintergreen": "cooling",
    "yuzu": "juicy",
    "zucchini": "tender|moist",
}


def _load_t3_lookup() -> dict[str, str]:
    doc = json.loads(DESCRIPTOR_LOOKUP.read_text(encoding="utf-8"))
    return {
        tag.strip().lower(): d["t3"]
        for tag, d in doc.get("descriptors", {}).items()
        if d.get("t3")
    }


def _derive_t3(entry: dict | None, t3_lookup: dict[str, str]) -> str:
    if not entry:
        return ""
    counter: Counter[str] = Counter()
    for comp in entry.get("top_compounds", []):
        for tag in comp.get("tags", []):
            t3 = t3_lookup.get((tag or "").strip().lower())
            if t3:
                counter[t3] += 1
    ranked = sorted(counter.items(), key=lambda x: (-x[1], x[0]))
    return "|".join(t for t, _ in ranked[:K_T3])


def _append_source(row: dict[str, str], tag: str) -> None:
    existing = (row.get("sources") or "").strip()
    if tag in existing:
        return
    row["sources"] = f"{existing};{tag}" if existing else tag


def main(dry_run: bool) -> None:
    t3_lookup = _load_t3_lookup()
    gc = json.loads(GNN_COMPOUNDS.read_text(encoding="utf-8"))
    gck = {k.lower(): k for k in gc}

    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fields = list(reader.fieldnames or [])
        rows = list(reader)

    n = len(rows)
    before = sum(1 for r in rows if (r.get("tier3_mouthfeel") or "").strip())
    curated = derived = 0

    for r in rows:
        if (r.get("tier3_mouthfeel") or "").strip():
            continue  # never overwrite a chef-authored cell
        name = (r.get("name") or "").strip()
        hand = CURATED_T3.get(name.lower())
        if hand:
            r["tier3_mouthfeel"] = hand
            _append_source(r, "t3-curated")
            curated += 1
            continue
        entry = gc.get(gck.get(name.lower(), ""))
        val = _derive_t3(entry, t3_lookup)
        if val:
            r["tier3_mouthfeel"] = val
            _append_source(r, "t3-derived")
            derived += 1

    after = sum(1 for r in rows if (r.get("tier3_mouthfeel") or "").strip())
    leaves = sum(1 for r in rows if (r.get("leaves") or "").strip())
    print(f"[t3-fill] rows={n}")
    print(f"[t3-fill] tier3 before={before} ({before/n:.0%}) "
          f"+curated={curated} +derived={derived} after={after} ({after/n:.0%})")
    print(f"[t3-fill] leaves populated={leaves} ({leaves/n:.0%})")
    print(f"[t3-fill] still empty tier3={n - after}")

    if dry_run:
        print("[t3-fill] dry-run — no files written")
        return

    bak = CSV_PATH.with_suffix(".csv.pre-n1d2-t3.bak")
    if not bak.exists():
        shutil.copy2(CSV_PATH, bak)
    with CSV_PATH.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        w.writerows(rows)
    print(f"[t3-fill] wrote {CSV_PATH.relative_to(ROOT)}  (backup: {bak.name})")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    main(dry_run=args.dry_run)
