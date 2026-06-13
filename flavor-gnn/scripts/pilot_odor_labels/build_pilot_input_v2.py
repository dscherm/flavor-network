"""Step-1 calibration pilot v2 — multi-label aroma + boundary-guided prompt.

Fixes the two false-negative artifacts found in v1
(artifacts/INGREDIENT_ODOR_LABEL_SOURCING_2026-06-13.md, "Calibration pilot
RESULT"):

  1. v1 forced a SINGLE primary_aroma, crushing woody/fatty recall when the LLM
     picked an arguably-better secondary term. v2 lets the LLM emit a ranked
     LIST of aromas, and derives MULTI-aroma gold from the chef `leaves` column
     (AROMA-vocab terms found in leaves) UNION tier1_aroma.
  2. v1 had no guidance on the salty<->umami and spicy<->pungent boundaries,
     the two taste-vocab disputes. v2 adds explicit rubric lines.

Splits the chef CSV into:
  - pilot_v2/names.json   : ingredient names ONLY (blind input)
  - pilot_v2/gold.json    : multi-aroma + taste gold (scorer only)
  - pilot_v2/PROMPT.md     : labeling instructions + vocabs + boundary rubric

Usage:
    python flavor-gnn/scripts/pilot_odor_labels/build_pilot_input_v2.py
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CHEF_CSV = ROOT / "flavor-gnn" / "curation" / "top500_flavor_graph.csv"
OUT_DIR = Path(__file__).resolve().parent / "pilot_v2"

AROMA_VOCAB = [
    "fruity", "floral", "green", "woody", "spicy", "fatty", "earthy",
    "fermented", "smoky", "nutty", "creamy", "caramel", "meaty", "marine",
    "citrusy", "roasted", "alliaceous green",
]
TASTE_VOCAB = [
    "sweet", "sour", "bitter", "salty", "umami", "spicy", "pungent",
    "astringent",
]

PROMPT_TEMPLATE = """# Ingredient aroma/taste labeling — calibration pilot v2

You are a culinary flavor expert. For each ingredient name, assign flavor labels
using ONLY the controlled vocabularies below. Judge the ingredient as a whole
culinary item as a cook/chef perceives it — do NOT reason about single molecules.

## Output (per ingredient)
{{"name": <name>, "aromas": [<1-3 aroma terms, most characteristic first>],
"tastes": [<zero or more taste terms>]}}

- `aromas`: 1 to 3 terms from the AROMA vocabulary, ordered most-characteristic
  first. Include a secondary/tertiary aroma when the ingredient genuinely carries
  it (e.g. almond is nutty AND fatty AND woody; butter is creamy AND fatty).
- `tastes`: zero or more terms from the TASTE vocabulary the ingredient clearly
  carries. Omit weak/incidental tastes.

Return a JSON array of these objects in input order, and nothing else.

## AROMA vocabulary (choose 1-3 for `aromas`)
{aroma}

## TASTE vocabulary (choose 0+ for `tastes`)
{taste}

## Boundary rubric (apply carefully)
- **salty vs umami**: use `salty` ONLY for ingredients that taste of sodium
  chloride directly (table salt, soy sauce, brined/cured items eaten for their
  salt). Savory glutamate/inosinate-rich items (anchovy, parmesan, miso, cured
  meats, dashi, tomato paste) are `umami` — add `salty` only if they are also
  distinctly salt-forward.
- **spicy vs pungent** (TASTE terms): `spicy` = chili/capsaicin heat (chili,
  cayenne, black pepper heat). `pungent` = sharp/biting nose-pungency (raw
  garlic, raw onion, mustard, horseradish, wasabi, fresh ginger).
- **spicy** also exists in the AROMA vocab = warm baking-spice aroma (cinnamon,
  clove, cardamom, allspice). An ingredient can be aroma-spicy without being
  taste-spicy.

## Rules
- Use ONLY vocab terms; never invent one. `aromas` must have at least one term.
- Do not look up molecules — label as a cook/chef perceives the ingredient.
"""


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    aroma_set = set(AROMA_VOCAB)
    names: list[str] = []
    gold: dict[str, dict] = {}

    with CHEF_CSV.open("r", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            name = (row.get("name") or "").strip().lower()
            if not name:
                continue
            t1_terms = {x.strip().lower()
                        for x in (row.get("tier1_aroma") or "").split("|") if x.strip()}
            leaves = {x.strip().lower()
                      for x in (row.get("leaves") or "").split("|") if x.strip()}
            # Multi-aroma gold: AROMA-vocab terms in leaves UNION the primary terms.
            aromas = sorted((leaves | t1_terms) & aroma_set)
            tastes = [t.strip().lower()
                      for t in (row.get("tier2_taste") or "").split("|") if t.strip()]
            names.append(name)
            gold[name] = {"aromas": aromas, "tastes": tastes}

    (OUT_DIR / "names.json").write_text(
        json.dumps(names, indent=2, ensure_ascii=False), encoding="utf-8")
    (OUT_DIR / "gold.json").write_text(
        json.dumps(gold, indent=2, ensure_ascii=False), encoding="utf-8")
    (OUT_DIR / "PROMPT.md").write_text(
        PROMPT_TEMPLATE.format(aroma=", ".join(AROMA_VOCAB),
                               taste=", ".join(TASTE_VOCAB)), encoding="utf-8")

    multi = sum(1 for g in gold.values() if len(g["aromas"]) > 1)
    print(f"[build-v2] {len(names)} ingredients -> {OUT_DIR}/names.json")
    print(f"[build-v2] multi-aroma gold: {multi}/{len(names)} have >=2 aromas")
    print(f"[build-v2] gold -> {OUT_DIR}/gold.json | prompt -> {OUT_DIR}/PROMPT.md")


if __name__ == "__main__":
    main()
