# Aroma tagging — instructions (identical for every batch)

You are tagging culinary ingredients with their AROMA and FLAVOUR character, as a trained sensory panelist or chef would describe the ingredient itself.

## Input
A JSON array of ingredient names (lower-case, as they appear in a recipe database). Some names are generic ("cheese", "fish"), some specific ("smoked paprika", "star anise").

## Vocabulary — use ONLY these 32 tags
citrus, berry, stone-fruit, tropical-fruit, apple-pear, dried-fruit, floral, green-grassy, herbal, mint, anise, earthy, mushroom, woody, smoky, roasted, nutty, caramel, chocolate, coffee, vanilla, warm-spice, peppery, pungent-allium, sulfurous-brassica, buttery-creamy, cheesy, meaty, briny-marine, fermented-funky, sour-tangy, sweet

Notes:
- warm-spice = cinnamon/clove/nutmeg/cumin/curry-type warmth; peppery = black pepper, chili heat, mustard/horseradish bite.
- pungent-allium = onion/garlic/leek; sulfurous-brassica = cabbage/broccoli/egg-sulfur notes.
- sour-tangy and sweet describe taste impressions that shape aroma perception; use them when they dominate.
- Describe the ingredient as it is typically used in cooking (e.g. "beef" = cooked beef: meaty, roasted; "vanilla" = vanilla bean/extract).

## Output per ingredient
1 to 5 tags, each with an intensity 1 (noticeable), 2 (clear), 3 (dominant). At least one tag must be 2 or 3. Do not pad: a simple ingredient may have one or two tags.

## Hard rules
- Describe each ingredient ON ITS OWN. Do NOT think about what it pairs with, and do not use pairing books or lists as a source. The point of the experiment is to test whether aroma descriptions alone predict good pairings; leaking pairing knowledge into the tags would invalidate it.
- Every input name must appear in the output exactly once, spelled exactly as given.
- If a name is ambiguous, tag its most common culinary meaning.

## Output format
Write ONE JSON object to the output path you are given, mapping each name to an object of tag -> intensity, e.g.
{"basil": {"herbal": 3, "anise": 1, "mint": 1}, "bacon": {"smoky": 3, "meaty": 2, "sweet": 1}}
No other keys, no comments. Then verify the file parses as JSON and contains every input name, and reply with the count written.
