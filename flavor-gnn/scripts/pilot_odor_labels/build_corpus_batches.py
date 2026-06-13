"""Full-corpus distillation — build blind labeling batches for all ingredients.

Scales the v2-validated pilot (11-head macro-F1 0.710 vs molecular 0.101) from
304 chef ingredients to the full proDataset universe.

- Reads public/proDataset/ingredients.json (the ~3,891 app ingredients).
- Separates the chef-gold names (top500_flavor_graph.csv) into an OVERLAY set:
  these are NOT re-labeled — chef rows win by precedence (the N1-D3 bake pattern).
- Chunks the remaining "to-label" names into blind batch files (names only).
- Emits the v2 multi-label + boundary-rubric prompt and a run manifest.

Outputs under flavor-gnn/scripts/pilot_odor_labels/corpus/:
  batches/_batch_000.json ...   blind name-only batches
  chef_overlay.json             chef gold (multi-aroma + taste), for precedence
  PROMPT.md                      labeling instructions (v2)
  manifest.json                  {num_batches, batch_size, to_label, overlay, samples}

Usage:
    python flavor-gnn/scripts/pilot_odor_labels/build_corpus_batches.py --batch-size 65 --samples 2
"""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
INGREDIENTS = ROOT / "public" / "proDataset" / "ingredients.json"
CHEF_CSV = ROOT / "flavor-gnn" / "curation" / "top500_flavor_graph.csv"
OUT = Path(__file__).resolve().parent / "corpus"

AROMA_VOCAB = [
    "fruity", "floral", "green", "woody", "spicy", "fatty", "earthy",
    "fermented", "smoky", "nutty", "creamy", "caramel", "meaty", "marine",
    "citrusy", "roasted", "alliaceous green",
]
TASTE_VOCAB = ["sweet", "sour", "bitter", "salty", "umami", "spicy", "pungent",
               "astringent"]

# Reuse the v2 prompt verbatim (kept in sync with build_pilot_input_v2.py).
PROMPT_TEMPLATE = """# Ingredient aroma/taste labeling — full-corpus distillation

You are a culinary flavor expert. For each ingredient name, assign flavor labels
using ONLY the controlled vocabularies below. Judge the ingredient as a whole
culinary item as a cook/chef perceives it — do NOT reason about single molecules.

## Output (per ingredient)
{{"name": <name>, "aromas": [<1-3 aroma terms, most characteristic first>],
"tastes": [<zero or more taste terms>]}}

- `aromas`: 1 to 3 terms from the AROMA vocabulary, most-characteristic first.
  Include a secondary/tertiary aroma when genuinely present (almond = nutty AND
  fatty AND woody; butter = creamy AND fatty).
- `tastes`: zero or more terms from the TASTE vocabulary the ingredient clearly
  carries. Omit weak/incidental tastes.

Return a JSON array in input order, nothing else.

## AROMA vocabulary (choose 1-3 for `aromas`)
{aroma}

## TASTE vocabulary (choose 0+ for `tastes`)
{taste}

## Boundary rubric
- **salty vs umami**: `salty` ONLY for ingredients tasting of sodium chloride
  directly (table salt, soy sauce, brined/cured items eaten for their salt).
  Glutamate-rich savory items (anchovy, parmesan, miso, cured meats, dashi,
  tomato paste) are `umami` — add `salty` only if also distinctly salt-forward.
- **spicy vs pungent** (TASTE): `spicy` = chili/capsaicin heat; `pungent` =
  sharp/biting nose-pungency (raw garlic/onion, mustard, horseradish, wasabi,
  fresh ginger).
- `spicy` also exists as an AROMA = warm baking-spice (cinnamon, clove,
  cardamom, allspice). An ingredient can be aroma-spicy without being taste-spicy.

## Rules
- Use ONLY vocab terms; never invent one. `aromas` needs at least one term.
- Many corpus ingredients are obscure, branded, or compound foods. If a name is
  ambiguous, label your best culinary interpretation; never leave aromas empty.
- Do not look up molecules — label as a cook/chef perceives the ingredient.
"""


def chef_names_and_gold() -> dict[str, dict]:
    aroma_set = set(AROMA_VOCAB)
    gold = {}
    with CHEF_CSV.open("r", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            name = (row.get("name") or "").strip().lower()
            if not name:
                continue
            t1_terms = {x.strip().lower()
                        for x in (row.get("tier1_aroma") or "").split("|") if x.strip()}
            leaves = {x.strip().lower()
                      for x in (row.get("leaves") or "").split("|") if x.strip()}
            aromas = sorted((leaves | t1_terms) & aroma_set)
            tastes = [t.strip().lower()
                      for t in (row.get("tier2_taste") or "").split("|") if t.strip()]
            gold[name] = {"aromas": aromas, "tastes": tastes, "source": "chef"}
    return gold


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--batch-size", type=int, default=65)
    ap.add_argument("--samples", type=int, default=2)
    args = ap.parse_args()

    (OUT / "batches").mkdir(parents=True, exist_ok=True)
    (OUT / "preds").mkdir(parents=True, exist_ok=True)

    all_names = sorted(json.loads(INGREDIENTS.read_text(encoding="utf-8")).keys())
    overlay = chef_names_and_gold()
    overlay_names = set(overlay)
    to_label = [n for n in all_names if n.lower() not in overlay_names]

    batches = [to_label[i:i + args.batch_size]
               for i in range(0, len(to_label), args.batch_size)]
    for i, b in enumerate(batches):
        (OUT / "batches" / f"_batch_{i:03d}.json").write_text(
            json.dumps(b, ensure_ascii=False), encoding="utf-8")

    (OUT / "chef_overlay.json").write_text(
        json.dumps(overlay, indent=2, ensure_ascii=False), encoding="utf-8")
    (OUT / "PROMPT.md").write_text(
        PROMPT_TEMPLATE.format(aroma=", ".join(AROMA_VOCAB),
                               taste=", ".join(TASTE_VOCAB)), encoding="utf-8")
    manifest = {
        "total_ingredients": len(all_names),
        "overlay_chef": len(overlay),
        "to_label": len(to_label),
        "batch_size": args.batch_size,
        "num_batches": len(batches),
        "samples": args.samples,
        "batch_dir": str((OUT / "batches").resolve()),
        "pred_dir": str((OUT / "preds").resolve()),
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(json.dumps(manifest, indent=2))
    print(f"\n[build-corpus] {len(batches)} batches x {args.samples} samples "
          f"= {len(batches) * args.samples} labeling jobs")


if __name__ == "__main__":
    main()
