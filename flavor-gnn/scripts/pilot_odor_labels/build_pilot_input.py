"""Step-1 calibration pilot — build BLIND labeling input from the chef gold CSV.

Companion to artifacts/INGREDIENT_ODOR_LABEL_SOURCING_2026-06-13.md.

Goal: measure whether an LLM, given ONLY an ingredient name + the chef's
controlled vocabulary (no gold labels), reproduces the chef's tier1_aroma /
tier2_taste judgments well enough to scale ingredient-level labels 304 -> 3,913.

This script splits the chef CSV into:
  - pilot/names.json   : ingredient names ONLY (the blind labeling input)
  - pilot/gold.json    : the held-out chef labels (consumed ONLY by score_pilot.py)
  - pilot/PROMPT.md     : exact labeling instructions + both vocabularies

Keeping names and gold in separate files is what makes the labeling "blind":
a labeler (human or LLM subagent) is handed names.json + PROMPT.md and never
sees gold.json. score_pilot.py rejoins them after predictions land.

Usage:
    python flavor-gnn/scripts/pilot_odor_labels/build_pilot_input.py
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CHEF_CSV = ROOT / "flavor-gnn" / "curation" / "top500_flavor_graph.csv"
OUT_DIR = Path(__file__).resolve().parent / "pilot"

# Chef-native controlled vocabularies, derived from the gold CSV distribution.
# tier1_aroma is a SINGLE primary per ingredient; tier2_taste is multi-label.
AROMA_VOCAB = [
    "fruity", "floral", "green", "woody", "spicy", "fatty", "earthy",
    "fermented", "smoky", "nutty", "creamy", "caramel", "meaty", "marine",
    "citrusy", "roasted", "alliaceous green",
]
TASTE_VOCAB = [
    "sweet", "sour", "bitter", "salty", "umami", "spicy", "pungent",
    "astringent",
]

PROMPT_TEMPLATE = """# Ingredient aroma/taste labeling — calibration pilot

You are a culinary flavor expert. For each ingredient name you are given,
assign flavor labels using ONLY the controlled vocabularies below. Judge the
ingredient as a whole culinary item (not a single chemical).

## Output (per ingredient)
A JSON object: {{"name": <name>, "primary_aroma": <one aroma term>,
"tastes": [<zero or more taste terms>]}}

- `primary_aroma`: EXACTLY ONE term from the AROMA vocabulary — the single most
  characteristic aroma class of the ingredient.
- `tastes`: zero or more terms from the TASTE vocabulary that the ingredient
  clearly carries. Omit weak/incidental tastes.

Return a JSON array of these objects, in the same order as the input, and
nothing else.

## AROMA vocabulary (pick ONE for primary_aroma)
{aroma}

## TASTE vocabulary (pick ZERO OR MORE for tastes)
{taste}

## Rules
- Use ONLY terms from the vocabularies above; never invent a term.
- Do not look up or reason about specific molecules — label the ingredient as a
  cook/chef perceives it.
- Be decisive: every ingredient gets exactly one primary_aroma.
"""


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    names: list[str] = []
    gold: dict[str, dict] = {}

    with CHEF_CSV.open("r", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            name = (row.get("name") or "").strip().lower()
            if not name:
                continue
            aroma = (row.get("tier1_aroma") or "").strip().lower()
            tastes = [
                t.strip().lower()
                for t in (row.get("tier2_taste") or "").split("|")
                if t.strip()
            ]
            names.append(name)
            gold[name] = {"primary_aroma": aroma, "tastes": tastes}

    (OUT_DIR / "names.json").write_text(
        json.dumps(names, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (OUT_DIR / "gold.json").write_text(
        json.dumps(gold, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (OUT_DIR / "PROMPT.md").write_text(
        PROMPT_TEMPLATE.format(
            aroma=", ".join(AROMA_VOCAB), taste=", ".join(TASTE_VOCAB)
        ),
        encoding="utf-8",
    )

    print(f"[build] {len(names)} ingredients -> {OUT_DIR}/names.json")
    print(f"[build] gold labels        -> {OUT_DIR}/gold.json (scorer only)")
    print(f"[build] labeling prompt    -> {OUT_DIR}/PROMPT.md")
    print(f"[build] AROMA vocab: {len(AROMA_VOCAB)} terms | "
          f"TASTE vocab: {len(TASTE_VOCAB)} terms")


if __name__ == "__main__":
    main()
