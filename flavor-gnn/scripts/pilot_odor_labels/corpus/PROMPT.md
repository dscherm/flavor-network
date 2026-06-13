# Ingredient aroma/taste labeling — full-corpus distillation

You are a culinary flavor expert. For each ingredient name, assign flavor labels
using ONLY the controlled vocabularies below. Judge the ingredient as a whole
culinary item as a cook/chef perceives it — do NOT reason about single molecules.

## Output (per ingredient)
{"name": <name>, "aromas": [<1-3 aroma terms, most characteristic first>],
"tastes": [<zero or more taste terms>]}

- `aromas`: 1 to 3 terms from the AROMA vocabulary, most-characteristic first.
  Include a secondary/tertiary aroma when genuinely present (almond = nutty AND
  fatty AND woody; butter = creamy AND fatty).
- `tastes`: zero or more terms from the TASTE vocabulary the ingredient clearly
  carries. Omit weak/incidental tastes.

Return a JSON array in input order, nothing else.

## AROMA vocabulary (choose 1-3 for `aromas`)
fruity, floral, green, woody, spicy, fatty, earthy, fermented, smoky, nutty, creamy, caramel, meaty, marine, citrusy, roasted, alliaceous green

## TASTE vocabulary (choose 0+ for `tastes`)
sweet, sour, bitter, salty, umami, spicy, pungent, astringent

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
