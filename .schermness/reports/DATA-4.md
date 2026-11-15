# DATA-4: one consistent category scheme

Result: the scheme is written down (`src/data/categoryScheme.js`, rendered as a table in `docs/data-quality.md`) and applied
through the curation layer: 130 one-line `categoryOverrides.json` entries plus one `categoryRenames.json` entry
(umami to savory seasoning). The audit's category rules, now run over the curated data, report 0 on cheese, juice, flour, wine,
vermouth, beer and spirit, and 0 filed under `umami`. A before/after harness over the real data shows every shortlist, every
My bar result, every recipe role and every Cookbook split identical to before, except 11 listed differences (all explained below).
Root `npm run gate` passed in the foreground (vitest 102.4 s, build 118.2 s); functions tests 248 passed. Nothing deployed.

## 1. Every reader of a category name (found before any table was edited)

Method: grep of `src/`, `scripts/`, `functions/` for category literals and for `.category`, `categoryOf`, `catMap`, `CATEGORY_`, then each hit read.

Changed (a category word is read, or a map is keyed by one):

| Reader | What it reads | Change |
|---|---|---|
| `src/data/curation/applyCuration.js`, `validateCuration.js`, `tables.js`, `scripts/lib/curationTables.mjs` | the layer | new `categoryRenames` table (see 3) |
| `src/data/dataAudit.js`, `scripts/auditData.mjs` | category rules, doc generator | rules now name the target category per family; run on curated data |
| `src/components/chalkArt.jsx` `CATEGORY_GLYPH`, `GLYPH_OF_CATEGORY` | drawing per category | umami renamed; juice, wine, beer added (reuse drop, bottle, bottle); thickener added to the notebook map (reuses wheat; it had no entry and fell to the plain bowl) |
| `src/data/dishSkeletons.js` `KINDS` (stirSauce, dressing, salsa, stock, braiseLiquid, cheese, acid) | name x category tests for dish slots | umami renamed; `wine` added to stirSauce (mirin was condiment), `wine`, `beer`, `juice` to braiseLiquid, `juice` to acid (tamarind juice) so nothing a slot offered is lost |
| `src/data/inventRecipe.js` `recipeRoles` | acidRich list | umami renamed |
| `src/data/recipeMains.js` `MAIN_CATEGORIES`, `SUPPORTING_CATEGORIES` | main or supporting | umami renamed; `juice`, `beer` main (they were `liquid`, a main); `wine` supporting |
| `src/data/dietaryFilters.js` `isAlcohol` | halal | `wine` and `beer` count as alcohol (prosecco, sake were `spirit`) |
| `src/data/structureScoring.js` both role maps | Recipe Lab structure hints | juice, beer, wine mapped like `liquid` (lengthener / liquid) |
| `src/data/winePairing.js` `CATEGORY_HINT` | wine ranking | umami renamed; the seven hard grating cheeses keep their old 'umami' hint instead of the dairy 'cream' hint, so the wine ranking does not move (see 5) |
| `src/ml/kitchenUnits.js` `CATEGORY_DEFAULT_DIMENSION` | measuring dimension | umami renamed; juice, wine, beer volume |
| `src/hooks/useProData.js` `CATEGORY_TO_TASTE` | fallback taste colour | umami renamed; juice, wine, beer, baked, confection, condiment added (baked, confection, condiment had no entry; never used in practice, every ingredient has a taste); now exported for the test |
| `src/data/notebookStarters.js` `STARTER_CATEGORIES` | starter picks | umami renamed |
| `scripts/evalWinePairing.mjs` | read RAW categories | now reads the curated categories the app sees; numbers identical (below) |

Shown NOT affected (and why):

- `inventSauce.js`, `saucePantry.js` (sauce slots, `sauceKind`): use the sauce catalogue's own categories (`sauce_augment.json`: Liquid, Thickener, Acid ...) plus name regexes. The word `citrus` there is a kind derived from the name, not the ingredient category. Roux and starch slots fit `flour`, `wheat flour`, `cornstarch` by name (asserted in the test).
- `cocktailInvent.js`, `cocktailRiff.js`, `myBar.js` (`isBooze`, `barKey`, families), `barScan.js`, `myKitchen.js`: use `cocktail_roles.json` roles and the graph names; no ingredient category is read.
- `cocktailBaseSpirit.js`: its own labels (Gin, Whiskey, Vermouth, Wine ...), not ingredient categories.
- `ingredientRoles.js`, `cookingMethods.js`, `recipeFocus.js`: name regex plus cluster; 'thickener' there is a role word.
- `seasoningRecommendation.js` (spice, herb, aromatic, seasoning): no listed category moved except onion juice.
- `categoricalAxes.js` (family wheel): an unlisted category falls to Other, as `liquid` did; membership moves with the data.
- `IngredientPicker.jsx`, `PairingModeCard.jsx` family filter: compares to the wheel labels.
- `recipeCandidates.js`, `SuggestionCardDeck.jsx`, `IngredientSuggestionsPopout.jsx` (replace-mode candidates are "same category as the focal ingredient"; category pills list whatever categories are present): data driven, so the pool follows the new categories. Its `CATEGORY_COLORS` is keyed by display groups (Produce, Dairy ...) that never matched a lowercase category, so every pill was already the default colour; unchanged. NOT run through the harness (needs the model).
- `MakeRecipeCardsGrid.jsx` `PORTION_BY_CATEGORY`: capitalised keys that never match a lowercase category (existing quirk), unchanged.
- `recipeAnalysis.js` ("Cross between X and Y"): prints the category word, so it can now print "savory seasoning".
- `livingArchConstants.js` `CATEGORY_RADII` (parked 3D): has a default; none of the changed categories are listed.
- `App.jsx`, `SauceLab.jsx`, `CookbookLab.jsx`, `KitchenPanel.jsx`: only hand `nodes.get(n).category` to the readers above.
- `functions/`: no reader (the share card `category` is the recipe's own).
- Scripts: `apply_ingredient_audit.cjs` (VALID_CAT list), `audit_ingredients.cjs`, `apply_additional_fixes.cjs`, `finalize_audit_report.cjs`, `generate_cuisine_map.cjs` are one-off pipeline tools keyed on the raw pipeline words; not run, not changed (DATA-8 territory). The Python in `flavor-gnn/` was not read.

## 2. The scheme and every deviation from the target

29 categories (the 26 minus umami, plus savory seasoning, juice, wine, beer); definitions and three examples each are in `docs/data-quality.md` (generated from `categoryScheme.js`; the test checks that every example really is in its category). Deviations and decisions:

1. **Citrus juices stay in `citrus`; every other juice is `juice`.** Least risk: the cocktail sour slot and the sauce acid slot, the dish `acid` kind, `recipeRoles.acidRich`, `structureScoring` and the wine hint all read `citrus`. Moving lemon and lime juice would have meant editing each. 5 liquid-filed citrus juices (tangerine, yuzu, sour orange, citrus, realemon) moved liquid to citrus so the rule is consistent.
2. **Vermouth stays in `liqueur`** (stated): the bar and the cocktail slots treat it as a liqueur-shelf modifier; moving it into wine bought nothing. The audit enforces this (new rule `category-vermouth`, 0 outside).
3. **Apple cider is a `juice`** (sweet and sparkling apple cider too): in a recipe it is pressed apple juice. Bare `cider` (89 uses) is `beer`, as the task asked. Reason for the deviation: filing 5,770 uses of apple cider as alcohol would have made the halal filter wrong.
4. **Not fruit or vegetable juices, left where they were:** pickle juice, dill pickle juice, sweet pickle juice, olive juice (brines), clam juice (a stock), lemon juice salt; the fragments `juice from`, `with juice`, `reserved juice`.
5. **Wine:** all 50 wines, ports, sherries, madeira, marsala, sake, mirin, cooking wines, champagne, prosecco and the fruit wines. `red wine vinaigrette` is a dressing, not a wine, and stays condiment. The old audit rule excluded `champagne` by accident (its not-wine list matched the letters "ham" inside the word); fixed with word boundaries.
6. **Every flour is `grain`** (16 from thickener, hazelnut flour from nut). Cornstarch, gelatin, cornflour stay `thickener`. `thickener` also still holds `active dry yeast`; not touched, not a flour.
7. **A `categoryRenames` table was added to the layer** rather than 47 override lines (see 3).
8. "Anything else the audit's rule shows as a minority outlier": the audit's category rules showed nothing else. I looked at vinegar (29, all acid), oil (61 fat, 4 `other` essential oils), stock/broth (27 liquid, 3 bouillon in savory seasoning), milk (dairy vs plant milks in liquid), syrup (2 condiment), sugar (2 spice cinnamon sugar). Nothing clear enough to move without a decision about it; left.

## 3. How it is applied

- `src/data/curation/categoryRenames.json`: `{ "umami": { to: "savory seasoning", reason } }`. `applyCuration` renames every ingredient filed under the old word after additions/packaged and before the per-ingredient overrides, which win. `validateCuration` checks: reason present, target declared, no self-rename, no chain, object shape. Tests added in both suites (rename moves all and leaves meta keys, override wins, idempotent, non-mutating; the five validator rejections).
- `categoryOverrides.json`: 130 lines, each with a specific reason, generated from the audit's own family rules (so the table and the audit cannot disagree). `vocabulary.json` declares `savory seasoning`, `juice`, `wine`, `beer`.
- No change to `pairings.bin` (category lines do not touch it; the gate's build step re-ran `build:pairings` and the in-sync test passed).

Moves (curated, counted by name): cheese savory seasoning to dairy 7; juice liquid to juice 45, aromatic to juice 1, liquid to citrus 5; flour thickener to grain 15, nut to grain 1; wine liquid to wine 37, spirit to wine 9, liqueur to wine 2, mixer to wine 1, condiment to wine 1; beer liquid to beer 6; plus the 38 remaining `umami` entries renamed.

## 4. Counts per category, before (DATA-3 curated state, from the harness fixture) and after

| category | before | after | change |
|---|---|---|---|
| protein | 455 | 455 | 0 |
| condiment | 413 | 412 | -1 |
| vegetable | 356 | 356 | 0 |
| grain | 293 | 309 | +16 |
| liquid | 240 | 147 | -93 |
| dairy | 232 | 239 | +7 |
| baked | 205 | 205 | 0 |
| fruit | 205 | 205 | 0 |
| confection | 180 | 180 | 0 |
| spice | 158 | 158 | 0 |
| fat | 121 | 121 | 0 |
| herb | 108 | 108 | 0 |
| sweetener | 98 | 98 | 0 |
| nut | 81 | 80 | -1 |
| citrus | 75 | 80 | +5 |
| chili | 74 | 74 | 0 |
| aromatic | 57 | 56 | -1 |
| liqueur | 57 | 55 | -2 |
| spirit | 45 | 36 | -9 |
| umami | 45 | 0 | -45 |
| other | 43 | 43 | 0 |
| thickener | 43 | 28 | -15 |
| acid | 36 | 36 | 0 |
| seasoning | 35 | 35 | 0 |
| mixer | 8 | 7 | -1 |
| bitters | 4 | 4 | 0 |
| wine | 0 | 50 | +50 |
| juice | 0 | 46 | +46 |
| savory seasoning | 0 | 38 | +38 |
| beer | 0 | 6 | +6 |

(umami had 45 curated entries, 47 in the generated data; 7 cheeses left, 38 renamed.)

## 5. The before/after harness and its diff

`scripts/lib/categoryHarness.mjs` (`computeSnapshot`, `diffSnapshots`) runs, on the real curated data, every path that reads a category. The pre-change result is the committed fixture `src/data/__tests__/fixtures/categoryBehaviour.before.json` (written by `scripts/snapshotCategoryBehaviour.mjs` on the unmodified tree). `src/data/__tests__/categoryScheme.test.js` recomputes it and asserts the diff equals the list below exactly.

Covered, and IDENTICAL after: 183 dish-slot shortlists (8 dish types x slots x 3 builds, top 8); 104 cocktail-slot shortlists (6 families x slots x 4 builds); 168 sauce-slot shortlists (10 styles x slots x 2 builds); `barKey` and `isBooze` for all 553 bottle names in the cocktail roles and `isBooze` for every ingredient (181 booze); `recipeRoles` and the main/supporting split for all 83 Cookbook recipes; every dish KIND over all 3,667 names except braiseLiquid; Recipe Lab structure scoring (12 cases); the top-3 wines for all 83 recipes.
Named guarantees asserted: lemon juice and lime juice are in every cocktail `sour` shortlist and every sauce `acid` shortlist and accepted by the dish `acid` kind; `flour`, `wheat flour`, `white flour` fit the roux slot and `cornstarch` fits the starch slot; the roux shortlist still returns flour; My bar recognises every bottle it did.

The 11 differences, all intended:

| What | Change | Why |
|---|---|---|
| halal filter | now blocks `cider`, `mirin` | they are filed as beer and wine, which are alcohol; the name list never caught them. Prosecco (was `spirit`) is still blocked. Bare `cider` may be non-alcoholic: it errs on the safe side |
| dish kind braiseLiquid | + cream sherry, dry sherry | they were liqueurs; as wines they are braising liquids like every other sherry |
| family wheel Dairy | + 7 cheeses (parmesan, parmesian cheese, parmigiano cheese, parmigiano-reggiano cheese, pecorino cheese, pecorino romano cheese, romano cheese) | cheeses are dairy (were Other) |
| family wheel Grain | + 16 flours | flours are grain (were Other) |
| family wheel Other | - those 23; + onion juice | onion juice is a juice, which has no wheel bucket |
| family wheel Aromatic | - onion juice | same |
| mainNames | - 5 citrus juices (supporting now, like lemon juice); + 16 flours, 6 cheeses (parmesan was already forced main), + onion juice | flours and cheeses are main foods like flour and cheddar; onion juice is a main like every other juice (liquids were mains) |
| seasoning pool | - onion juice | no longer an aromatic |
| notebook starters, slot 7 of 10 | umami:parmesan becomes savory seasoning:worcestershire sauce | parmesan is dairy; the first three starters (the ones normally shown) are unchanged |
| unit dimension | 5 citrus juices volume to count (the citrus tie-break, as lemon juice has); onion juice count to volume | follows the category |

No change in: wine ranking (one recipe, pesto, did change until the hard-cheese hint was kept; now identical for all 83), structure hints, any shortlist, bar recognition, recipe roles or mains.

Wine answer key (`node scripts/evalWinePairing.mjs`, curated categories): identical before and after: tuned on 42 dishes hit@1 25/42, hit@3 33/42, MRR 0.70; concentration cava 15, chenin-blanc 14, assyrtiko 14, rosado 13; coverage 43/53.

## 6. Audit and docs

- `npm run audit:data -- --update-baseline` (after `--check` passed, nothing went up). Category rules, curated data: cheese 0 (was 7), juice 0 (27), flour 0 (17), wine 0 (17), vermouth 0 (new), beer 0 (0), spirit 0, umami 0 (47). All other rules are unchanged from the DATA-3 baseline (for example taste-neutral-sweet 228, taste-outlier 68).
- `docs/data-quality.md` (generated): the scheme table (category, generated-data count, curated count, definition, three examples), the four non-obvious decisions, the split table now on curated data. `data/review/category.tsv` is now empty (header only). `taste.tsv` use_count column changed for a few merged names (it now reads the curated count); no finding changed.
- `npm run measure:flavor`: Items 41. Top taste expected 4/41 (9.8%). Top two both expected 3/34 (8.8%). Forbidden taste leads 6. No chart 27. Ingredients counted 37.5%. Aroma as expected 0/4 (0%). Identical to FLAVOR-2's "after" line, as expected (the chart does not read categories).

## 7. Verified, and how

- Functions: `npm test` in `functions/`, 248 passed.
- Root `npm run gate`, foreground, finished before commit: vitest pass (102.4 s), build pass (118.2 s), sidecar written. New tests: `categoryScheme.test.js` (16: scheme vs data, examples, glyph/dimension/taste coverage, audit zero, the before/after diff and the named guarantees), audit rule tests rewritten for the new API, layer tests for renames.
- Browser (`npm run dev`, port 5173, stopped afterwards): Invent a cocktail, bourbon, style "Sour Family": checklist "A Sour usually has: base spirit (bourbon) ticked, sour, sweetener"; tapping `sour` offered grapefruit juice, lemon, lemon juice, lime juice, lime (identical to the harness list); "goes well with" offered grapefruit juice, honey syrup, lemon, ginger syrup, lemon juice ... Invent a sauce, butter, technique "Roux & milk": "A Roux & milk needs: fat (butter) ticked, flour (for the roux) needed with `flour - have` offered, milk or cream needed, aromatic / cheese / spice optional". Sensible. (The pane's screenshot timed out several times and needed retries; a render glitch tiled one screenshot but the text was readable.)

## 8. Not verified

- Replace-mode candidates in the Recipe Notebook (same-category filter) and the category pills: not exercised in the browser or by the harness (need the model). They follow the category membership: e.g. replacing parmesan now offers cheeses, not soy sauce; replacing wheat flour now draws from grain, not from starches and yeast.
- Share cards, the iOS/archived branch, the Python pipeline and `flavor-gnn/` readers.
- The curated categories were not run through any in-browser view of the parked 3D network.
- `CookbookLab.design3` did not time out this run.

## 9. For DATA-5 (taste labels)

- The audit's taste rules (`taste-neutral-sweet`, `taste-vocab`, `taste-missing`, `taste-outlier`) and the "first taste word per category" table still run over the RAW data, so they still show the old `umami` category and the old juice/wine/flour splits. `taste-outlier` compares a name's first taste word with its category's distribution, so DATA-5 should switch those rules to `cur.ingredients` (`runAudit` already has it) before judging outliers; expect the 68 count to move, and re-baseline deliberately.
- `umami` is also a TASTE word; the category rename touched only the category. `vocabulariesOf` still reads both from the raw data.
- Flours are now `grain` (starch rule: `flour` family); wines, juices and beers are their own categories, which changes what "typical taste for its category" means (juices are sweet or sour; wines and beers bitter or sour).
- I added fallback tastes in `CATEGORY_TO_TASTE` (juice sweet sour, wine sour bitter, beer bitter sweet, baked and confection sweet, condiment salty sour). They only apply when an ingredient has no taste, which the audit says is never.

## 10. Possible DATA-3 follow-ups (listed, not changed)

- Prefix duplicates the audit did not flag: `lemon juice freshly squeezed`, `lime juice freshly squeezed`, `orange juice freshly squeezed`, `lemon juice from concentrate`, `lemon juice only`, `lemon juice from`, `lemons juice`, `key lime juice` (a real variant), `orange juice concentrate`.
- Fragments not hidden: `juice from`, `with juice`, `reserved juice` (all `liquid`).
- `cream of mushroom soup`, `cream of chicken soup`, `tomato soup` sit in `liquid` while flagged packaged; consistent with the scheme (liquid) but they show up in the liquid examples.

## Files

Changed: `D:\Projects\flavor-network\` `src/data/dataAudit.js`, `dataAudit.test.js`, `dishSkeletons.js`, `inventRecipe.js`, `recipeMains.js`, `dietaryFilters.js`, `structureScoring.js`, `winePairing.js`, `notebookStarters.js`, `src/ml/kitchenUnits.js`, `src/hooks/useProData.js`, `src/components/chalkArt.jsx`, `src/data/curation/{applyCuration,validateCuration,tables}.js`, `categoryOverrides.json`, `vocabulary.json`, curation tests, `scripts/auditData.mjs`, `scripts/evalWinePairing.mjs`, `scripts/lib/curationTables.mjs`, `data/review/{baseline.json,category.tsv,taste.tsv}`, `docs/data-quality.md`.
New: `src/data/categoryScheme.js`, `src/data/curation/categoryRenames.json`, `src/data/__tests__/categoryScheme.test.js`, `src/data/__tests__/fixtures/categoryBehaviour.before.json`, `scripts/lib/categoryHarness.mjs`, `scripts/snapshotCategoryBehaviour.mjs`.
