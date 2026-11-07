# Everyday pairs (WEAK-A)

## Checks, written before measuring

Measured by `node scripts/measureEverydayPairs.mjs`. "Curated" is the index the
invent and kitchen features use today (`buildPairingIndex` over the observed
edges of `pairings.json`); "blended" is `blendIndex(curated, everyday)`.
The invent code is not changed, only the index handed to it, so each run
measures both sides in one process.

- **(a) Common pairs present.** The 8 pairs named in the brief (chicken|garlic,
  chicken|lemon, chicken|onion, rice|chicken, garlic|onion, garlic|olive oil,
  beef|onion, lemon|garlic) plus two picked here before looking (potato|onion,
  butter|garlic). Pass: all 10 have a blended strength > 0.
- **(b) Cookbook coverage.** For the 83 Cookbook recipes (`seedRecipes.js`),
  each ingredient resolved to a graph name (`resolveIngredientName`, trivial
  ones dropped), every unordered pair within a recipe: the share with any
  edge (strength > 0). Expectation: blended at least 10 points above curated.
- **(c) Invent a recipe** on three fixed kitchens, real set-completion model
  (`public/models/recipe-setcompletion.onnx` via onnxruntime-node, the same
  graph the browser runs), no cuisine, 5 seeded shuffles of the kitchen order:
  mean ingredient count of the returned dishes, distinct dishes (ingredient
  sets) across the 5 runs, and which pairs the "why" lines cite.
  Expectation: no target. The model builds the sets and the index only
  ranks them and gates the "you'd need" extras, so this measures what the
  swap alone does. Making dishes a sensible size is the next bead.
- **(d) Invent a sauce** on the pantry butter, egg yolk, lemon, shallot,
  white wine, cream, tomato, garlic: every style, 5 shuffles. Same measures.
  Expectation: none beyond "still works". Sauces are built from fixed
  technique skeletons.

## The artifact

`public/proDataset/everyday_pairs.json`: 488 KB (145 KB gzipped), 35,701
pairs over 2,906 ingredients. Built by `node scripts/build_everyday_pairs.mjs`
(byte-identical on re-run) from `proDataset/processed/recipenlg-cooccurrence.json`.

- **Rule** (`src/data/everydayPairsSelect.js`): count ≥ 30 recipes, PMI > 0
  (log2, recomputed from counts), score = log10(count)³ · ∛min(PMI, 3), each
  ingredient keeps its top 32 partners, and a pair stays if either side keeps
  it. Count does most of the work and lift breaks ties. A softer lift weight
  (score √PMI · log10(count)²) put chicken|lemon at rank 94 for chicken; with
  this one it ranks 29.
- **Excluded**: `TRIVIAL` (recipePairingMatch.js) plus `SUGGESTION_EXCLUDE`
  (recipeRuntime.js): water, salt, pepper, sugar, flour, ice, sodas …
- **Strength**: the pair's score percentile, quantile-mapped onto the curated
  observed-pair strengths (`tradition`, which is what `buildPairingIndex` reads),
  so max(curated, everyday) compares values on one scale. garlic|olive oil 0.99,
  garlic|onion 0.92, beef|onion 0.74, chicken|garlic 0.69, chicken|lemon 0.52.
- **Name mapping**: 3,353 of the 4,017 co-occurrence names match a vocab name
  exactly. Another 136 map through spelling variants: plural or singular,
  hyphens and joined words, a leading light/fresh/low-fat/nonfat …, and a short
  alias table (aubergine→eggplant, philadelphia cream cheese→cream cheese …).
  Their counts are summed into the vocab name. 528 stay unmapped and are dropped
  (baking powder, vegetable oil, chile, sauce …: names the vocab has no node for).
  Of the 3,891 vocab names, 3,357 (86%) have RecipeNLG counts and 2,906 (75%)
  have at least one everyday partner. The rest are mostly FlavorDB or cocktail
  names that RecipeNLG's parser never produced: saffron, coffee, oyster,
  artichoke, sherry, squid and prawn are absent from the co-occurrence file itself.

## Results

### (a) Common pairs: 9 of 10

| pair | curated | blended |
|---|---|---|
| chicken\|garlic | — | 0.69 |
| chicken\|lemon | — | 0.52 |
| chicken\|onion | — | 0.65 |
| rice\|chicken | — | 0.62 |
| garlic\|onion | — | 0.92 |
| garlic\|olive oil | — | 0.99 |
| beef\|onion | — | 0.74 |
| lemon\|garlic | — | 0.61 |
| potato\|onion | 0.44 | 0.71 |
| butter\|garlic | — | **—** |

butter|garlic fails, and that is the rule working as written. In RecipeNLG,
butter sits mostly in baking: 76,394 recipes have both, but the PMI is −0.54,
fewer than chance. butter|onion is −0.44 for the same reason. Getting these
pairs would need a cuisine- or course-conditioned PMI (savoury recipes only),
not a looser floor.

### (b) Cookbook coverage: 29% → 68%

The 83 recipes contain 599 resolved ingredients (none unresolved) and 1,946
within-recipe pairs.

| | pairs with an edge | share | recipes with every pair linked |
|---|---|---|---|
| curated | 566 | 29.1% | 0 |
| blended | 1,320 | 67.8% | 9 |

This passes the expectation of at least 10 points (+38.7).

### (c) Invent a recipe

Real model (onnxruntime-node, `recipe-setcompletion.onnx`), cuisine none,
5 seeded shuffles, `limit` 12.

| kitchen | index | dishes returned | mean ingredients | distinct dishes | "why" cites most |
|---|---|---|---|---|---|
| chicken, garlic, lemon, rice, onion, tomato | curated | 28 | 4.43 | 6 | tomato+garlic ×20, tomato+onion ×15 |
| | blended | 28 | 4.43 | 6 | onion+garlic ×20, tomato+onion ×15 |
| pasta, tomato, basil, parmesan, garlic, olive oil | curated | 5 | 5.00 | 1 | tomato+garlic, tomato+basil |
| | blended | 5 | 5.00 | 1 | tomato+garlic, basil+garlic |
| beef, onion, potato, carrot, thyme | curated | 20 | 4.00 | 4 | onion+potato ×12, onion+cream of mushroom soup |
| | blended | 15 | 4.00 | 3 | beef+onion, onion+potato, thyme+onion, carrot+onion |

As expected, size and variety did not move: the model builds the sets, and
the index only ranks them and gates the "you'd need" extras. What changed:
- **Ranking.** The chicken kitchen's first page now holds chicken + garlic +
  lemon + onion + tomato in place of milk + onion + potato. The beef kitchen
  drops "milk + onion + red kidney bean + thyme", but now shows
  "onion + oregano + parmesan + thyme", which has no beef either.
- **"Why" lines** now name the dish's real backbone (beef+onion, carrot+onion,
  basil+garlic), not only tomato and onion.
- **Fewer beef dishes (20 → 15).** More sets now get the same name, and the
  invent code keeps one dish per name. The size and variety bead should own this.

### (d) Invent a sauce

Pantry: butter, egg yolk, lemon, shallot, white wine, cream, tomato, garlic.
All 10 styles, 5 shuffles.

| index | styles that build | sauces | mean ingredients | distinct sauces | "why" cites most |
|---|---|---|---|---|---|
| curated | 10 / 10 | 545 | 4.46 | 106 | garlic+tomato ×125, butter+flour ×120, butter+cream ×90 |
| blended | 10 / 10 | 545 | 4.41 | 105 | olive oil+garlic ×160, garlic+tomato ×115, butter+cream ×80 |

The first picks change in sensible ways. The Velouté uses shallot, not garlic.
The emulsion becomes "Lemon Butter Sauce = butter, egg yolk, lemon" (it was the
same plus garlic and black pepper). The stir-fry uses soy sauce, not fish sauce.
The brown sauce adds tomato. Weak spot: olive oil+garlic is now the most-cited
pair. Olive oil is an assumed basic, so the "why" lines lean on it, much as
they leaned on tomato+garlic before.

### (e) Invent a cocktail: not wired

Bar of 16 (gin, vodka, rum, tequila, bourbon, lime and lemon juice, simple
syrup, triple sec, sweet vermouth, Campari, Angostura, mint, soda, ginger beer,
prosecco), every family:

| index | drink pairs with an edge | distinct drinks |
|---|---|---|
| curated | 73.0% | 52 |
| blended | 82.4% | 52 |

More pairs get linked, but the top picks do not get better. The Sour family's
first drink goes from tequila + lime + triple sec (a Margarita) to a rum sour,
and the Highball goes from a Gin Highball to a rum fizz. RecipeNLG holds few
drinks, and the curated graph already blends TheCocktailDB co-occurrence. The
cocktail lab's one index also drives Riff on a classic and My bar. So Invent a
cocktail, My bar and Riff keep the curated index.

## What is wired

- `src/components/InventRecipe.jsx`: `blendIndex(buildPairingIndex(...), useEverydayPairs())`.
- `src/components/SauceLab.jsx` `pantryCtx.pairingIndex`: the same blend. It
  feeds Invent a sauce and My pantry's stand-in choice (`saucePantry.standInFor`).
  The curated sauce index (`sauceIndex`) is unchanged.
- Untouched: `pairings.json`/`.bin`, the Pairing Lab, the Cookbook "goes well
  with" ranking (`App.jsx` / `RecipeFlavorProfilesCard` still call
  `buildPairingIndex` alone), `scripts/evalPairingMatch.mjs`, the cocktail lab.
- If `everyday_pairs.json` fails to load, the hook stays null and `blendIndex`
  returns the curated index unchanged.
