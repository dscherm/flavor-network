# DATA-3: ingredient merges, removals and packaged flags

Result: every line on the three ingredient review lists (duplicates 219, non-food and fragments 46, packaged 135; 400 findings
in all) was read and decided. The audit now reports **0 unreviewed** on all nine ingredient-hygiene rules. Packaged and hidden
names are never offered by the app, and are still findable by typing and valid in saved recipes. Root `npm run gate` passed in the
foreground (vitest 80.4 s, build 121.4 s); functions tests 248 passed.

## What was decided (counts, by name)

| Decision | Count | Where |
|---|---|---|
| Aliased (merged into the ingredient a cook means) | 210 (5 were DATA-2 seeds) | `src/data/curation/aliases.json` |
| Hidden (not food, bare fragments) | 26 (3 were seeds) | `hidden.json` |
| Flagged packaged (kept, searchable, never suggested) | 123 (2 were seeds) | `packaged.json` |
| Corrected spellings added (see below) | 12 | `additions.json` |
| Kept as they are, with a reason | 34 entries (6 existed; 28 new) | `data/review/keep.json` |
| Of those kept: left misspelt on purpose | 8 | fire tomatoe, o'brien potatoe, cinnamon candie, poblano chilie, additional oil, juniper berrie, saskatoon berrie, lean steak |

Every alias, hidden, packaged and addition line has a specific reason (a test fails on a missing, short or generic reason).
Reasons say what the thing is ("misspelt \"tomatoe\"", "'freshly' is a preparation word left from 'freshly ground'", "canned condensed
soup", "Jell-O gelatin dessert") rather than "duplicate".

How the rules were used: they only proposed. Misspelt names whose corrected spelling exists became aliases. Preparation and state words
(freshly, lean, extra lean, boneless, cooked, ripe, additional, extra, favorite, leftover, mashed) became aliases where the target exists.
Real distinctions went on the keep list: instant rice, instant brown and white rice, instant yeast, instant cocoa, instant onion, instant
lemonade, instant sugar, prepared mustard, extra light olive oil, baking flavourings with no extract entry (peppermint, banana, brandy,
butternut, black walnut), vanilla-flavored soymilk, plus the six earlier entries (new potato, cherry tomato, instant mashed potato, ...).
Instant pudding lines went to packaged, not merged.

**Misspelt names with no correct entry.** The dataset stores most tomatoes and many potatoes only under the misspelt form
("grape tomatoe", "cherry tomatoes" have no correct name at all). For these I used `additions.json` plus an alias (a rename that keeps all
pairings): cherry tomato, grape tomato, roma tomato, heirloom tomato, stewed tomato, purple potato, fingerling potato, hash brown potato,
chicken breast, sausage patty, beef patty, chicken patty. Other rename-only lines went to the nearest existing entry a cook would agree
with (russet/idaho/starchy/floury/brown potato to baking potato; baby/new-red/jersey royal to new potato; red bliss/skin to red potato;
yellow/golden to gold potato; irish/all-purpose/gratin to potato; italian plum to roma tomato). That is 12 new ingredients, which is more
than "a few"; each is a spelling fix of something already present with 50 to 4,000 recipe uses.

Flavourings: vanilla flavoring and flavor alias to `vanilla` (there is no "vanilla extract" entry); lemon, almond, coconut and orange
flavoring/flavor alias to the extract; bare "chicken/beef/butter/chocolate/nacho cheese flavor" and bare adjectives (unsalted, leaf, root,
european, ...) are hidden. Low-confidence flavored products were decided one by one (orange-flavored liqueur, hazelnut-flavored liqueur,
chocolate flavored syrup, chicken-flavored bouillon granule, italian flavored bread crumb, hickory flavored barbecue sauce to their plain
ingredient; gelatin, flavored rice, flavored yogurt to packaged).

## Unsure: for the owner to look at

| Name | What I did | Why I hesitated |
|---|---|---|
| fryer (hidden since DATA-2) | still hidden | 2,496 uses; may be the young chicken, not equipment. "fryer chicken", "broiler-fryer", "chicken fryer" I aliased to chicken. |
| roaster | kept | roasting pan or roasting chicken, 55 uses |
| brown potatoe | to baking potato | brown-skinned usually means russet, not certain |
| baby potatoe, baby new potatoe | to new potato | a baby potato may just be small, not young |
| yellow / golden / yellow-fleshed potatoe | to gold potato | likely Yukon gold, not certain |
| italian plum tomatoe, italian roma tomatoe | to roma tomato | plum and roma are the same in recipes |
| grape tomatoe | own entry "grape tomato", not merged into cherry tomato | a cook would often substitute them |
| mashed potatoe, mashed/cooked sweet potatoe, mashed banana | to the plain ingredient | a prepared state; pairing is the same, a cook might want it kept |
| unsalted cashew, peanut, pistachio, macadamia, margarine; salted spanish peanut | to the plain ingredient | salt level matters in baking |
| plain yogurt | to yogurt | assumes plain is the default |
| instant beef bouillon (granule), instant chicken bouillon | to bouillon | same product, granulated |
| instant dry milk | to milk powder | assumes nonfat dry milk |
| cooked white rice | to rice | no "white rice" entry exists |
| freshly lemon zest, lemon peel, orange zest | to lemon rind, orange rind | zest and rind taken as the same |
| vanilla flavoring / flavor | to vanilla | no extract entry; imitation vs real vanilla is lost |
| lemon, almond, coconut, orange flavor (bare) | to the extract | bare "flavor" may be a flavoured product |
| tabasco sauce, tabasco pepper sauce | packaged | a cook also writes "hot sauce"; never suggested now |
| extra olive oil | to olive oil | may be "extra virgin" cut short |
| hash brown potatoe | own entry "hash brown potato" | frozen shredded product, not raw potato |
| chicken breast (new entry) | boneless skinless chicken breast aliased to it | the cut variants "chicken breast halve/tender/fillet" were NOT touched (not in the review lists) |

Not flagged by the audit and not touched: "jalapeno chile" vs "jalapeno chili" (both exist), "baked potato", "tomato halve", "freshly- black pepper".

## Alias coverage (the DATA-2 gap) - `scripts/checkAliasCoverage.mjs`

`node scripts/checkAliasCoverage.mjs` (or `--json`; reusable, exports `coverageLosses`, unit tested). It checks ten name-keyed files
(`gnn_entropy`, `gnn_entropy_imputed`, `gnn_compounds`, `flavor_positions` and its 2d and v3 forms, `gnn_positions` and `_raw`, `pca_positions`).
Printed: **210 aliases checked; 33 leave the canonical without a row the variant has (298 missing rows in all)**. Per file: gnn_entropy 28,
gnn_entropy_imputed 31, gnn_compounds 32, flavor_positions 32, flavor_positions_v3 24, flavor_positions_2d 32, flavor_positions_2d_v3 26,
gnn_positions 30, gnn_positions_raw 32, pca_positions 31.

The 33, by variant: basket / halved / punnet / quartered / red / yellow cherry tomatoe (to cherry tomato); grape / halved grape / red grape /
yellow grape tomatoe (to grape tomato); roma, italian roma, italian plum tomatoe (to roma tomato); heirloom tomatoe; italian stewed and
italian-style stewed tomatoe (to stewed tomato); sundried tomatoe (to sun-dried tomato); purple potatoe; fingerling potatoe; hash brown
potatoe; beef, chicken, sausage pattie; boneless skinless chicken breast; candlenuts (gnn_entropy only); chicken-flavored ramen noodle;
freshly black pepper, freshly cracked black pepper (to black pepper); freshly pepper, freshly cracked pepper (to pepper); freshly salt;
unsalted macadamia nut; unsalted margarine.

Twenty-three of these are the corrected-spelling additions, which by construction have no rows. The loss only affects what is looked up
**by canonical name**. I accepted it knowingly, with one mitigation: `resolveIngredientName` (`recipePairingMatch.js`) now falls back, when
the name-keyed data has no row under the canonical, to the variant's row (so "grape tomato" typed in a recipe still reaches the old
`gnn_entropy` row). That fallback is tested. The parked 3D views (positions) and `gnn_compounds` are keyed directly by name and do not get it;
I did not check whether any live screen reads those by canonical name.

## Where `isSuggestable` is applied

One predicate, `isSuggestable(name, dataset?)` in `src/data/curation/suggestable.js` (false for a name in `packaged.json`, `hidden.json`,
or a merged variant; also honours a `packaged` flag on the dataset entry). Applied at:

- every "goes with" list: `getNeighbors` and `getNeighborsEnriched` in `src/data/graph.js` (Pairing Lab and its swipe deck, the suggestion
  drawer, Recipe Panel, Make-a-recipe), plus the Flavor Bible partner list in `PairingMode.jsx`;
- invent panels: `rankCocktailSlot`, `rankSauceSlot`, `rankDishSlot`, and the shared `shortlist`, `suggestNext`, `fillRequired` in `inventBuild.js`;
- stand-ins: `swapCandidates` (`cocktailRiff.js`), `sauceReplacements` (`inventSauce.js`), `findSwap` (`kitchenSwaps.js`);
- Recipe Notebook: `rankLogits` in `recipeRuntime.js` (all set-completion suggestions, so `SuggestionCardDeck`, `IngredientSuggestionsPopout`
  and the Flavor Profiles card), `loadSuggestCandidates` / `loadReplaceCandidates`, `rankByAxisImpact` (boost/temper), and the browse list of
  `IngredientPicker.jsx` when nothing has been typed (typing still finds a packaged item).
Hidden entries are already gone from the dataset (DATA-2); the test confirms it (`curated dataset` block).

Tests (`src/data/__tests__/suggestable.test.js`, 20 tests, real data): predicate; curated dataset has every packaged entry flagged and no
hidden/merged name; neighbour lists of the 40 busiest ingredients; all families and slots of the cocktail panel with a bar holding every
packaged name; all 10 sauce styles with a pantry and pool full of packaged names; all 8 dish types with packaged nodes made to look like real
candidates; shared build helpers; cocktail swaps over 80 cocktails; kitchen swap table; boost/temper; `rankLogits` with the real vocabulary and
loud logits on packaged names; typing finds a packaged item; a saved recipe containing one opens. I checked the tests are not vacuous by
neutering the predicate: 11 of 20 failed (and the dish test, once I made packaged nodes eligible).

## Before / after, as printed by `node scripts/auditData.mjs`

| | before | after |
|---|---|---|
| Ingredients (raw -> curated) | 3891 (3883 after the DATA-2 seeds) | 3667 (210 merged, 26 hidden, 12 added; 123 flagged packaged) |
| Pairings | 95992 (95720 after DATA-2) | 92504 (92503 load in the app: one touches a name outside the ingredient list) |
| Unreviewed candidates, nine ingredient rules | 400 | 0 |

Per rule at the first audit: misspelling 94, plural 3, prefix 122, non-food 14, fragment 32, packaged-brand 38, mix 63, soup 14,
flavored 20; all 0 unreviewed now. The category, taste, cocktail, sauce and dish counts are unchanged (DATA-4 to 7). The baseline was
updated with `--update-baseline` only after `--check` passed (no count above its old baseline); the first audit's numbers are kept in
`baseline.json` under `history`. `docs/data-quality.md` has the "After DATA-3" section (generated by the script, so it cannot go stale).

The audit change: `partitionReviewed` (`src/data/dataAudit.js`, 4 unit tests): a duplicate, non-food or packaged candidate that is in a
curation table or on the keep list is *reviewed*, not counted; the headline numbers are unreviewed. Review `.tsv` files now hold only
unreviewed lines (header only today). Category and taste rules are never treated as reviewed.

## `npm run measure:flavor`

Output is **byte-identical before and after** (before = tables as committed at DATA-2): Items 41, top taste expected 4/41 (9.8%), top two both
expected 3/34 (8.8%), forbidden taste leads 6, no chart 27, ingredients counted 37.5%, aroma as expected 0/4. No built-in recipe line
resolves to a merged name, so none changed. (The flavor charts are hidden on shared pages; this is the script's output only.) `functions`
share index regenerated with no diff.

## Code I changed beyond the tables, and why

- **Binary index bug found and fixed.** `pairings.bin` indexed only the raw ingredient order, so a pairing involving an *added* name had no slot
  and was dropped (the renamed tomatoes would have lost all their pairings). The binary now indexes raw order plus the additions table
  (`binaryIndexObject`, used by the builder and the loader; committed `pairings.bin` rebuilt, `npm run build:pairings`). The sync test checks it.
- **Many variants, one canonical with no model id** (`vocabAliases.js`): previously the last variant won; now the first carries the canonical and the
  rest are fed with it and never suggested (cherry tomato has six variants). Tested.
- **Hyphenated variants** (`resolveIngredient.js`): matchers turn hyphens into spaces, so "all-purpose potatoe" never matched; aliases are now also
  looked up with spaces.
- `variantsOf` is now an index lookup (was a scan), used by the name fallback.
- Integration test: the "exactly ten seeds" test became property tests (targets exist or are additions; no chain; no name in two tables; every
  addition used; reasons specific). Model-vocabulary tests now split aliases into "canonical has an id" and "only the variant has one".

## Verified

- `node scripts/auditData.mjs --check` passes; full run rewrites lists and doc; zero unreviewed.
- `npm run build:pairings` run and the binary committed; `curation.integration.test.js` (23) and `pairingsBinary.test.js` (5) pass.
- Full vitest and build through `npm run gate`: first two runs failed only on `CookbookLab.design3` "every tile carries a hidden chalk dish drawing"
  (5 s timeout under load while other agents were running; alone it takes 1.2 s, identical to HEAD at 1.2 s); third run passed. Functions `npm test` 248 passed.
- Browser (`npm run dev`, port 5173, in the Browser pane; server stopped afterwards): Pairing Lab network analysis reads "3667 ingredients connected by
  92503 pairings"; typing "potato" in the Pairing Lab search lists potato, potato chip, flake, gnocchi, roll, soup, starch, water (the dropdown shows
  eight); Sauce Lab search "tomato" matched 18 sauces and "Invent this" opened the invent panel with tomato locked; its "Goes well with what you have"
  offered olive oil, sugar, butter, flour, garlic, onion, cumin, lime juice, no brand or mix.
- Variants that remain after curation (computed from the curated data, packaged excluded). Potato: potato, sweet potato, potato chip/flake/soup/starch/
  water/roll/wedge/gnocchi, instant mashed potato, baking potato, new potato, boiling potato, white potato, red potato, gold potato, fingerling potato,
  hash brown potato, purple potato, baked potato, and o'brien potatoe (left misspelt). Tomato: tomato, cherry, grape, roma, heirloom, stewed, green, yellow,
  red, italian, beefsteak, sun-dried, tinned, plus tomato paste/sauce/juice/soup and the like, and fire tomatoe (left misspelt); ro-tel tomatoe is packaged.

## Not verified

- The Cocktail Lab invent panel, the Recipe Notebook suggestion deck and the Pairing Lab in a browser after the change (covered by tests at the choke
  points, not by eye). The typeahead dropdown in the Pairing Lab showed only the first eight matches, so I did not see the full variant list on screen;
  I read it from the curated data instead.
- Whether any live screen reads `gnn_compounds` or the position files by canonical name (the 298 missing rows).
- `everyday_pairs.json` was not regenerated (the script uses the curated vocabulary now; whether its output would change is unmeasured).
- Nothing deployed.
