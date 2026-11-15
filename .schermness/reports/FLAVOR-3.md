# FLAVOR-3: tastes from the curated labels, weighted by amount

Result: the taste half of every in-app chart now comes from each ingredient's curated taste label, weighted by amount, on six axes (sweet, sour, bitter, salty, umami, heat). Default `npm run measure:flavor`: **top taste expected 30/41 (73.2%)**, top two 19/34, forbidden taste leads 8, no chart 0, counted 97.6%. That clears the 70% target but is one item and three forbidden leads worse than the labels-only equal-weight preview (31/41, 5): see "Why amounts are worse than equal weights". Root `npm run gate` passed in the foreground (vitest 78 s, build 115 s); functions tests 248 passed; `npm run audit:data -- --check` passed with no re-baseline.

## 1. The `flavorTaste` API (`src/data/flavorTaste.js`, pure)

- `TASTE_AXES = ['sweet','sour','bitter','salty','umami','heat']`, `POSITION_WEIGHTS = [1, 0.6, 0.35]`, `TASTELESS_WEIGHT = 0.25`.
- `labelWeights(label)` returns `{ axes, rich, neutral, unknown, any }`. `axes` are the six weights (spicy and pungent both feed heat and add; astringent gives half to bitter); `rich` is the weight of the word rich, outside the six axes; `unknown` lists ignored words; `any` is true when at least one known word is present (the ingredient counts as having data).
- `isTasteless(w)`: no weight on any of the six axes (neutral, or rich with nothing after it).
- `tasteProfile(lines, lookup, opts)` with `lines = [{ key, amount? }]` (amount may be a string like "2 oz", a `{qty, unit}` object or grams), `lookup(key)` giving the curated label. Returns `{ scores, counted, uncounted, n, weighted, rich, drivers, charted }`. Amount-weighted mean; equal weights if no amount known; unknown amounts get the mean known weight. `drivers` are by label weight times amount. `charted` is false when every counted ingredient is tasteless (then all scores are 0).
- Also new: `src/data/amountGrams.js` (`amountGrams`, `parseAmountText`; `amountGrams` is re-exported from `recipeProfileAnalysis.js` so existing imports work). It reads free text ("~¾ oz", "1.5 cl", "2 dashes", "1 shot", "2 parts", "Top with soda", "1/4 cup, diced", "5 slices") as well as `{qty, unit}` objects and plain grams. A bare count ("1") is unknown, not a measure.

## 2. Neutral dilution: the rule and the numbers

Rule: an ingredient with no taste of its own counts as data (it is in `counted`) and its amount counts against the rest at 0.25 (`TASTELESS_WEIGHT`). Measured on the 41 test items, same code, only the rate changed:

| Rate | Weighting | Top taste | Top two | Forbidden leads | No chart | Median leader strength |
|---|---|---|---|---|---|---|
| 0 | amounts | 30/41 | 19/34 | 8 | 0 | 0.73 |
| 0.25 | amounts | 30/41 | 19/34 | 8 | 0 | 0.63 |
| 0.5 | amounts | 30/41 | 19/34 | 8 | 0 | 0.58 |
| 1 | amounts | 29/41 | 19/34 | 8 | 1 | 0.53 |
| 0 to 1 | equal | 31/41 | 18/34 | 5 | 0 | 0.50 to 0.52 |

The rate does not change which taste leads (all tastes dilute alike), only how strong the bars read. 1 lets soda wash a highball out (one test item loses its chart); 0 makes a long drink read as loud as a short one. 0.25 was chosen on that reasoning; the numbers do not separate 0 from 0.5. Scores are the weighted mean, capped at 1, with no further scaling (median leading bar 0.63 at 0.25, so no rescale was needed). Dilution is also used by `profileDelta` for a tasteless candidate.

## 3. Unit table for amounts (grams, `UNIT_DENSITY` in `portionParser.js`)

Added: cl 10, shot 44, jigger 44, dash 1 (was already 1), drop 0.05, splash 7, barspoon 5, part 30 (relative; about an ounce), top 60, fill 90, bunch 50, slice 15, wedge 15, leaf 1, stalk 40. Existing: oz 28.35, ml 1, tsp 5, tbsp 15, cup 240, g 1, pinch 1, clove 3, sprig 2, handful 30. A dash (1 g) is far below an ounce (28 g); "top with soda" is 60 g, not zero. The parser used to fail on 1,072 of 1,857 cocktail lines; 517 of 3,079 built-in lines still have no usable amount (mostly bare counts), and those take the mean weight.

## 4. What changed in the six-axis switch (every file)

Logic:
- `src/data/flavorTaste.js` (new), `src/data/amountGrams.js` (new).
- `src/data/recipeProfileAnalysis.js`: `TASTE_AXES` now six (re-exported from flavorTaste); `AXES` has 12; heat colour = the spicy red (`AROMA_COLORS.odor_spicy`); `axisLabel('heat')` is "Heat"; `BALANCING.heat = 'sweet'` (sweetness, and dairy fat which has no axis, tame heat); `nodeProbs` takes taste from `node.taste` (label) and aroma from `gnnProbs` with placeholder rows dropped; one shared `profileOf` now behind `recipeAxisProfile` and `recipeAxisProfileWeighted` (both now return drivers and the draw rule, taste half also needs something to chart); `profileDelta`/`rankByAxisImpact`/`buildAxisEnhancements` rank on the label-derived values; `axisInsight('heat')` reads "Runs hot — balance with sweet."; `describeRecipeProfile` says "has some heat" instead of "leans heat".
- `src/data/inventProfile.js`: `buildFlavorProfile(keys, nodes, { noun, minScore, amounts })` weighted by `amounts` (a key to amount map).
- `src/data/flavorScore.js`: `TASTES` now includes heat so an item expecting heat can score (the scorer could not credit heat before; its test is updated). This is the one scorer change; `data/flavor-truth.json` is untouched.
- `src/data/portionParser.js`: the unit table above.
- `src/data/sharedLoaders.js`: the shared page and card loaders merge `taste_labels.json` (about 20 KB gzipped) with the aroma values; `src/data/shareCardData.js` and `SharedRecipePage.jsx` pass line amounts; the cached-only card loader fetches the labels in the same cached-only mode.
- `src/data/tasteScheme.js`: pungent examples (cumin and sage no longer lead pungent) and rule 6 (herbs no longer carry it); `docs/data-quality.md` regenerated by `npm run audit:data` (the only changes are those two lines and the per-category taste counts).

Components:
- `RecipeFlavorProfilesCard.jsx`: the whole card (overview, per-axis pages, boost/temper, enhance, description) now reads one weighted profile (bowl entries when present, names otherwise); heat appears automatically because every list is `AXES`. Comment says 12 axes.
- `InventCocktail.jsx`, `InventSauce.jsx`, `InventRecipe.jsx`: pass each line's amount to `buildFlavorProfile`.
- `IngredientProfileCard.jsx`: comments only. `InventFlavorProfile.jsx`, `ProfileDeltaRadar.jsx`, `SuggestionCardDeck.jsx`, `SauceSuggestionDeck.jsx` needed no code change: they draw whatever axes the profile holds. `SuggestionCardDeck` and `SauceSuggestionDeck` take names only, so they weight equally (they have no amounts). Places with their own five-taste lists that are NOT chart surfaces and were left: `IngredientPanel.jsx` (suggest by weakest taste), `MoleculeTasteMap.jsx`, the parked Network views (`tastePositioning.js`, `LivingArchView.jsx`, `AxisLabels.js`).

Scripts, data, docs:
- `scripts/buildTasteLabels.mjs` (new, in `prebuild` after `buildFlavorPlaceholders`), `scripts/lib/flavorNodes.mjs` (new, node-side nodes), `public/proDataset/taste_labels.json` (new, committed), root `package.json` prebuild.
- `scripts/measureFlavorProfile.mjs`: `profileFor` is now the app's `buildFlavorProfile` over label nodes with line amounts; `--labels-preview` untouched; the unused `#!` line was removed (vitest could not import a file starting with it).
- `scripts/buildShareIndex.mjs`: uses `loadFlavorNodes` and passes amounts. With `SHARE_CHARTS_ENABLED` false it still emits `bars: []`: re-running it left `share-cards.json`, `share-index.json` and `cardLayout.generated.ts` byte-identical (git shows no change).
- `src/data/curation/tasteOverrides.json`: 103 added lines. `docs/flavor-profile.md`: "After FLAVOR-3" section.

## 5. Label file size

`public/proDataset/taste_labels.json`: 3,674 ingredients, **104,693 bytes raw, 20,568 bytes gzipped** (target under 150 KB gz). A test fails if it is stale (compared with `buildTasteLabels()`), over 150 KB gz, or holds an unknown word. The main app does not load it: labels are already on `node.taste`. `SHARE_CHARTS_ENABLED` is still false.

## 6. Herb relabel (owner-approved default)

103 overrides, each one line with a specific reason ("X is an aromatic herb / a warm aromatic spice, not hot: pungent (and spicy) would chart it as heat (was '...')"). I printed all 640 curated labels containing pungent or spicy and read them. Removed pungent (and spicy where the herb carried it) from names that match parsley, thyme, oregano, basil, cumin, cinnamon, nutmeg, paprika, turmeric, coriander, dill, sage, rosemary, cilantro, bay leaf, laurel, allspice, cardamom, fennel seed, caraway, star anise, anise, tarragon, mint, marjoram, savory, lovage, fenugreek, celery seed, curry and lime leaf, poultry and Italian seasoning, pumpkin and apple pie spice, five-spice, shiso, in the herb, spice and seasoning categories. Example results: cinnamon, nutmeg, basil, coriander: sweet; parsley, thyme, cumin, cilantro, turmeric, bay leaf, rosemary, sage, dill: bitter; allspice and apple pie spice: sweet; mint and marjoram: astringent. More than "about 25" because spelling variants (basil leaf, flat-leaf parsley, cilantro stem, rosemary needle ...) are separate entries. Left with heat: garlic, onion, scallion, shallot, leek, ginger, galangal, horseradish, mustard, wasabi, black and white pepper, all the chilies, hot sauces, radish, watercress, and clove (added by `additions.json` and a name cannot be in both tables). Items I did not touch though they may deserve a look: "pepper" (pungent bitter), "mustard seed", "mustard green", "fennel" (sweet pungent), "truffle oil", "durian", mint candies and licorice (sweet pungent). Audit check passes; no baseline change was needed.

## 7. Measure output, before and after

Baseline (FLAVOR-1): 20/41 top taste, 7/34 top two, 12 forbidden, 0 no chart, 82.6% counted.
After FLAVOR-2: 4/41, 3/34, 6 forbidden, 27 no chart, 37.5% counted; 186 of 599 recipes charted.
After FLAVOR-3 (default, exactly as in `docs/flavor-profile.md`): **30/41 (73.2%), 19/34 (55.9%), 8 forbidden, 0 no chart, 97.6% counted, aroma 0/4.** 598 of 599 built-in recipes now draw a taste chart.
`--labels-preview` now: 31/41, 18/34, 5 forbidden, 97% (it read 32/41 before the herb relabel and before heat counted as a scored taste).

### Why amounts are worse than equal weights (the thing the task said to find out)
Equal weights: top taste 31/41, forbidden 5. With amounts: 30/41, forbidden 8. Cause, read from the per-ingredient breakdown: the biggest pour is the base spirit, and spirits carry one weak word (gin and tequila `bitter`, bourbon and rum `sweet`), so a margarita (2 oz tequila vs 3/4 oz lime) and a gimlet (2.5 oz gin vs 1/2 oz lime) read bitter, which is forbidden. Equal weights hid this by giving the lime the same vote as the spirit. Equal weights had the opposite error: heat led four sauces that are not hot (hollandaise, nuoc cham, sweet-and-sour, black bean) because a pinch of cayenne or a clove of garlic counted as much as the butter; amounts fix those. So amounts are right in principle and need FLAVOR-4's strengths to stop mild-but-large beating strong-but-small. Between the two runs 9 leaders change: margarita, gimlet, bloody Mary lose; hollandaise, nuoc cham, sweet-and-sour, salsa verde, black bean, green curry change leader.

## 8. Misses with causes (FLAVOR-4's worklist)

Top taste not expected (11). Fix is on the FLAVOR-4 scale (0 to 3 per taste, plus potency).

- **Margarita** (bitter 0.58, forbidden): tequila `bitter` 57 g vs lime juice `sour` 21 g. The key expects salty but the salt rim is not an ingredient line, so salty can never appear. Fix: tequila bitter ≤0.5; lime juice sour 3 and high potency; orange liqueur sweet 2.
- **Aperol Spritz** (sour 0.73, forbidden): prosecco `sour` 57 g vs aperol `bitter sweet` 21 g; seltzer does not resolve. Fix: prosecco sour 1, sweet 1, low potency; aperol bitter 2, sweet 2, potency 2.
- **Gimlet** (bitter 0.69, forbidden): gin `bitter` 71 g vs lime juice 14 g and syrup 14 g. Fix: gin bitter 0.3; lime juice sour 3; syrup sweet 3.
- **Bloody Mary** (sweet 0.62, forbidden): tomato juice `sweet sour umami` 90 g leads sweet; Worcestershire, Tabasco (no amount) and pepper are about 1 g each. Fix: tomato umami 2, sour 1, sweet 0.8; Worcestershire umami 3, Tabasco heat 3, both high potency.
- **Marinara** (sweet 0.97): tomato 907 g of about 1,000, label sweet first; salt 3 g. Fix: tomato umami 2, sour 1.5, sweet 0.8; salt salty 3 high potency.
- **Black bean sauce** (sweet 0.53, forbidden): bean paste `sweet umami` 30 g beats soy sauce 15 g; ginger (heat 1.6) is second. Fix: bean paste umami 2, salty 2, sweet 0.3; soy potency 3; ginger heat capped at 1.
- **Beef bolognese** (sweet 0.48, forbidden): tomato as above; beef `umami` 500 g diluted by 400 g pasta; cooked onion charts heat; carrot has no weight. Fix: tomato as above; beef umami 1; cooked onion heat 0.
- **Margherita pizza** (sweet 0.63, forbidden): tomato; flour 300 g neutral; mozzarella `rich` has no salty; salt 5 g. Fix: tomato; mozzarella salty 1, umami 1; salt potency.
- **Thai green curry** (umami 0.51; expects heat): curry paste `spicy pungent` 45 g vs chicken 500 g and coconut milk 400 g. Fix: curry paste heat 3 potency 5; chicken umami 0.5.
- **Tom yum** (umami 0.49, heat 0.45, a near miss): shrimp 300 g and mushroom 150 g vs 3 chilies and 2 limes that are bare counts. Fix: chili heat 3 with potency; typical weights for bare counts (chili 15 g, lime 60 g, egg 50 g, onion 150 g); shrimp umami 1.
- **Pesto genovese** (sweet 0.28, forbidden): 400 g neutral pasta dilutes; basil `sweet` 60 g and pine nut `rich sweet` 30 g lead sweet; parmesan 50 g. Fix: basil sweet 0.3; pine nut sweet 0.2; parmesan umami 2, salty 2, potency 2.

Top taste right, top two not both expected: Old Fashioned (sweet only; bitters 2 g, sugar cube no weight; fix: bitters bitter 3 potency 8, sugar cube 4 g), Manhattan (bourbon sweet swamps vermouth and bitters; fix: bitters potency, vermouth bitter 1, whiskey sweet 0.5), Tom Collins (gin bitter 0.38 beats sour 0.31; fix: gin bitter 0.3, lemon juice sour 3), Hollandaise (only sour 0.16: butter and egg are tasteless; fix: lemon juice sour 3, salt potency), Nuoc cham (sour below sweet at equal grams, heat 0.21 from the chili; fix: lime juice sour 3), Greek salad (tomato sweet first, red onion heat; fix: tomato, raw onion heat 0.5).

Debatable truth lines (not edited): **Nuoc cham** expects sour/salty/sweet and lists no heat, but the dish has a chili. Green curry and mapo tofu expect heat first; mapo tofu now gets it, green curry does not only because the paste is a small weight. Margarita expects salty, which the recipe lines cannot supply (the salt rim is garnish text).

Where the misses come from: (1) no strength per ingredient (nine of eleven); (2) tomato labelled sweet first (five); (3) bare counts with no weight (517 of 3,079 lines); (4) aroma check 0 of 4 (FLAVOR-5).

## 9. What I verified and how

- Unit tests: `flavorTaste.test.js` (one, two and three word labels; heat from spicy and from pungent; astringent; neutral and rich feed no axis; amount weighting 2 oz vs a dash; unknown ingredient uncounted; the dilution rule; all-tasteless), `amountGrams.test.js`, heat cases in `recipeProfileAnalysis.test.js`, and `flavorTaste.realData.test.js` (shipped label file is current, under 150 KB gz, only known words; herbs no longer heat, garlic and chilies still do; at least 90% counted and at least 70% top taste on the 41 real items; Negroni charts bitter and sweet, Daiquiri sweet and sour, mapo tofu heat).
- Component tests: Recipe Notebook card (heat chart labelled Heat in red with its own page; same ingredients chart from labels; all-neutral recipe shows the plain line), `InventCocktail` (gin, sweet vermouth and campari chart bitter then sweet; a jalapeno adds a Heat bar labelled Heat; soda water alone has nothing to chart). `SharedRecipePage.chartsOff` and the share-card tests pass unchanged, so shared pages and cards still show no chart.
- Existing fixtures that fed model taste values were moved to labels (`RecipeFlavorProfilesCard`, `InventRecipe`, `InventSauce`, `ShareImages`, `SuggestionCardDeck`, `suggestable`, `flavorPlaceholders`, `inventProfile`, `recipeProfileAnalysis` tests). One test changed meaning: "a recipe of only placeholder-valued ingredients draws no chart" now means placeholder values and no label; sugar, salt, coffee and lemon with their labels do chart.
- Browser (`npm run dev`, localhost:5173, driven through the DOM because the pane would not paint screenshots under load; stopped afterwards): **Invent a cocktail** with gin, sweet vermouth, campari showed bars "Bitter 89 percent" and "Sweet 39 percent" and the line "On the chart, the strongest signals are bitter and sweet." (no aroma bars: the aroma half does not draw). Adding jalapeno gave "Bitter 67", "Heat 40" (bar colour rgb(255, 68, 68)), "Sweet 29" and "strongest signals are bitter and heat". **Recipe Notebook Flavor Profiles** with tomato, ginger, basil and chili powder: overview bars Heat 45%, Sweet 28%, Sour 17%, Umami 10%; description "This recipe leads with heat from chili powder. Heat and sweet sit in balance."; the Heat page read "Heat 80%", "Driven by: chili powder", "Leans heat — balance with sweet." and Boost: serrano pepper, poblano chilie, red pepper, pepper sauce. I then changed that insight line to "Runs hot — balance with sweet." (in code and tests, not re-checked in the browser). No chart-related console errors (only dev websocket and vibrate noise).

## 10. Not verified

- No screenshot of the charts (pane would not paint); the check above is DOM text, labels and computed colours, not a visual look. 375px layout was not re-checked (no layout code changed; one more bar row and one more axis label in the flavor map radar, which now has 12 spokes: not looked at).
- The Recipe Notebook's amount path was exercised only with no entered amounts (equal weights) in the browser; amount weighting there is covered by unit and component tests.
- `SuggestionCardDeck` and `SauceSuggestionDeck` do not weight by amount (they have names only).
- Shared page and cards are still switched off; their bars were not looked at when on (FLAVOR-6). The label loaders for the shared page are tested only through the existing mocked-loader tests.
- Aroma is untouched (FLAVOR-5).

## Yellow gates
None raised by me.

Commit: see the commit trailer `Bead: FLAVOR-3`.
