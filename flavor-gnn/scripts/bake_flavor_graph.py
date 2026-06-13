"""bake_flavor_graph.py — bake public/proDataset/flavor_graph.json (N1-D3).

Shape: {ingredients, vocabulary, edges}.
  - ingredients[name] = {tier1, tier2, tier3, leaves, source}  (arrays)
  - vocabulary = {tier1, tier2, tier3, leaves}  (sorted unique terms,
    derived FROM the ingredients so the cross-check is true by construction)
  - edges = []  — the rendered network edges live in flavor_graph_data_v3.json;
    this artifact is the per-ingredient flavor graph + its vocabulary.

Inputs (chef row wins, mirroring derive_long_tail's precedence):
  - flavor-gnn/curation/flavor_graph_full.csv   (base; full corpus coverage)
  - flavor-gnn/curation/top500_flavor_graph.csv (overlay; chef-curated rows)

Because the chef CSV is overlaid at bake time, fixing a chef row (e.g. the
canonical mint fixture) propagates here WITHOUT regenerating
flavor_graph_full.csv — which a full derive_long_tail rebuild would do at the
cost of wiping the v8/botanical/tier-fill patches layered onto it.

Run: python flavor-gnn/scripts/bake_flavor_graph.py
Idempotent: deterministic ordering; re-run on unchanged inputs is byte-identical.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FULL_CSV = ROOT / "flavor-gnn" / "curation" / "flavor_graph_full.csv"
CHEF_CSV = ROOT / "flavor-gnn" / "curation" / "top500_flavor_graph.csv"
OUT = ROOT / "public" / "proDataset" / "flavor_graph.json"

TIERS = ("tier1", "tier2", "tier3", "leaves")
COL = {"tier1": "tier1_aroma", "tier2": "tier2_taste",
       "tier3": "tier3_mouthfeel", "leaves": "leaves"}


def _split(s: str | None) -> list[str]:
    if not s:
        return []
    return [p.strip() for p in s.split("|") if p.strip()]


def _row_to_entry(row: dict[str, str], chef: bool) -> dict:
    sources = (row.get("sources") or "").strip()
    return {
        "tier1": _split(row.get(COL["tier1"])),
        "tier2": _split(row.get(COL["tier2"])),
        "tier3": _split(row.get(COL["tier3"])),
        "leaves": _split(row.get(COL["leaves"])),
        "source": "chef" if chef else (sources.split(";")[0] or "rule-derived"),
    }


def _read(path: Path) -> dict[str, dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as f:
        return {(r.get("name") or "").strip(): r
                for r in csv.DictReader(f) if (r.get("name") or "").strip()}


def build() -> None:
    base = _read(FULL_CSV)
    chef = _read(CHEF_CSV)

    ingredients: dict[str, dict] = {}
    for name, row in base.items():
        ingredients[name] = _row_to_entry(row, chef=False)
    # Overlay chef rows (precedence). A chef row with no tier data still
    # marks provenance but won't blank an existing populated base entry.
    for name, row in chef.items():
        entry = _row_to_entry(row, chef=True)
        if any(entry[t] for t in TIERS):
            ingredients[name] = entry
        else:
            ingredients.setdefault(name, entry)["source"] = "chef"

    # Keep only ingredients that carry at least one tier term — empty
    # hub-fallback rows add nothing to the flavor graph.
    ingredients = {
        n: e for n, e in sorted(ingredients.items())
        if any(e[t] for t in TIERS)
    }

    # Vocabulary derived from the ingredients (cross-check true by build).
    vocabulary = {t: set() for t in TIERS}
    for e in ingredients.values():
        for t in TIERS:
            vocabulary[t].update(e[t])
    vocabulary = {t: sorted(v) for t, v in vocabulary.items()}

    doc = {
        "_meta": {
            "task": "N1-D3",
            "source": "flavor-gnn/scripts/bake_flavor_graph.py",
            "inputs": ["flavor_graph_full.csv", "top500_flavor_graph.csv (overlay)"],
            "ingredient_count": len(ingredients),
            "note": "Rendered network edges live in flavor_graph_data_v3.json; "
                    "this file is the per-ingredient flavor graph + vocabulary.",
        },
        "ingredients": ingredients,
        "vocabulary": vocabulary,
        "edges": [],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n",
                   encoding="utf-8")
    print(f"[bake] wrote {OUT.relative_to(ROOT)}  ingredients={len(ingredients)}")
    print(f"[bake] vocabulary sizes: "
          + ", ".join(f"{t}={len(vocabulary[t])}" for t in TIERS))
    m = ingredients.get("mint")
    print(f"[bake] mint = {m}")


if __name__ == "__main__":
    build()
