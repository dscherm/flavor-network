# Data quality audit

This page is written for the site owner, not for a developer. It says what the data audit
checks, how far to trust it, and where the numbers stood on the day it was first run.

## What the audit is

The audit is a script, `npm run audit:data`, that reads the app's own data files and
looks for things that are probably wrong: the same ingredient spelt two ways, things that are
not food, boxed or branded products, ingredients filed under an odd category, odd taste
labels, cocktails filed under the wrong family, and so on. It makes no network call and changes
no data. It writes this page and one list per kind of finding under `data/review/`.

Each list has one line per finding with: the item, the rule that flagged it, a confidence
(HIGH means very likely a real problem; LOW means it is often a real distinction a cook would
care about), how many recipes the item appears in (`use_count`, so the busiest items can be
reviewed first), a plain description, and a suggested action.

## The limits you should know about

* **The lists are candidates for review, not verdicts.** The rules match patterns in names. A
  pattern cannot tell that "ground beef" really is a different thing from "beef", or that
  "peanut butter" is not a plain fat. A person decides every line.
* **Reviewed non-merges are remembered.** `data/review/keep.json` holds names a person has
  decided are different ingredients, with a reason. The audit skips those and reports how many it
  skipped, so the skipping stays visible. (In the latest run: 31 candidates kept as they are, by 34 keep-list entries; 210 merged, 26 hidden and 123 flagged packaged through the curation tables.)
* **The cocktail "cream or egg" rule** counts a drink if any line is cream, milk, half and half,
  ice cream, eggnog, Irish cream, or a whole egg or yolk. Egg white alone does not count, because
  it is the foam of a sour. Coconut cream and milk are not counted either.
* **The branded list** is a list in the code (`BRANDS` in `src/data/dataAudit.js`) that a person
  can extend. Brands missing from it are not found.
* **The taste "first word" check** only compares the first word of each label. Labels hold up to
  three words in no particular order, so this finds oddities, not errors.
* **"Ginger beer", "root beer" and "ginger ale"** are treated as soft drinks, not beer.
* The audit does not look at pairings, positions, models or any other generated file.

## Baseline, 2026-11-15

These are the numbers of the last accepted run, as printed (stored in
`data/review/baseline.json`, which also keeps the first audit's numbers under `history`). The audit run with `--check` fails if any count goes above its baseline,
so later clean-up tasks can show the numbers going down and nothing can quietly go up.

| Check | Rule id | Baseline total | Now (this run) |
| --- | --- | --- | --- |
| Ingredient: misspelt name of another ingredient | `duplicate-misspelling` | 0 | 0 |
| Ingredient: plural of another ingredient | `duplicate-plural` | 0 | 0 |
| Ingredient: another ingredient plus a preparation word | `duplicate-prefix` | 0 | 0 |
| Ingredient: kitchen equipment or supply | `non-food` | 0 | 0 |
| Ingredient: a fragment, not a food | `fragment` | 0 | 0 |
| Ingredient: brand name | `packaged-brand` | 0 | 0 |
| Ingredient: boxed mix | `packaged-mix` | 0 | 0 |
| Ingredient: canned condensed soup | `packaged-soup` | 0 | 0 |
| Ingredient: 'flavored' product | `packaged-flavored` | 0 | 0 |
| Category: a cheese outside dairy | `category-cheese` | 0 | 0 |
| Category: a juice outside juice (citrus juices belong to citrus) | `category-juice` | 0 | 0 |
| Category: a flour outside grain | `category-flour` | 0 | 0 |
| Category: a wine outside wine | `category-wine` | 0 | 0 |
| Category: a vermouth outside liqueur | `category-vermouth` | 0 | 0 |
| Category: a beer or hard cider outside beer | `category-beer` | 0 | 0 |
| Category: a spirit outside spirit | `category-spirit` | 0 | 0 |
| Category: still filed under 'umami' (a taste; the category is 'savory seasoning') | `category-umami` | 0 | 0 |
| Taste: starch, plain fat, water or neutral spirit labelled 'sweet' | `taste-neutral-sweet` | 228 | 228 |
| Taste: word outside the known vocabulary | `taste-vocab` | 0 | 0 |
| Taste: no label | `taste-missing` | 0 | 0 |
| Taste: first word rare for its category | `taste-outlier` | 68 | 68 |
| Cocktail: cream or egg drink (no family of its own) | `cocktail-cream-egg` | 45 | 45 |
| Cocktail: lemon or lime in a stirred or 'boozy' family | `cocktail-citrus-stirred` | 11 | 11 |
| Cocktail: no amount on any ingredient line | `cocktail-no-amounts` | 148 | 148 |
| Cocktail: same name twice | `cocktail-duplicate` | 4 | 4 |
| Cocktail: sub-group with no name | `cocktail-subgroup-unnamed` | 15 | 15 |
| Cocktail: classic that is missing | `cocktail-missing-classic` | 3 | 3 |
| Sauce: filed under the catch-all 'Independent' | `sauce-independent` | 27 | 27 |
| Dish: Cookbook type with a single dish | `dish-singleton` | 6 | 6 |
| Dish: Cookbook type with no Invent equivalent | `dish-no-invent-equivalent` | 15 | 15 |

### Where the first audit differed from the by-hand critique

* Duplicate ingredients: the by-hand critique said at least 151 duplicates plus 74 misnamed (about 225). This audit finds 219 candidates (199 HIGH, 20 LOW) in three rules (misspellings, plurals, preparation words). The two are close; the audit counts each name once and keeps LOW candidates (such as ripe olive and mashed banana) separate, so the numbers are not expected to match exactly.
* Boxed mixes: the critique counted 24 cake and pudding mixes. This audit counts 63 because it also counts soup, dressing, gravy, biscuit, pancake, stuffing and other mixes, and instant puddings.
* Brands: 38 found against about 39 in the critique; the brand list lives in src/data/dataAudit.js and can be extended.
* Cream and egg cocktails: the critique counted 59 (42 in Sour Family, 17 in Highballs and Fizzes). This audit counts 45 because it does not count a drink whose only egg is egg white (the foam of a sour) or whose only cream is coconut cream or cream of coconut. Counting those too would raise the number toward the critique.
* Lemon or lime in the stirred families: the critique said 14 in each of Boozy Sippers and Aromatic Stirred (28). This audit finds 11 in total, because it only counts a line that is lemon or lime juice or a bare lemon or lime, not a twist, wedge or peel.
* Cocktails with no amounts: the critique said 105 of 441. This audit counts 148: a drink is counted when no line has either a millilitre amount or a measure containing a digit. I cannot tell how the 105 was counted.
* Duplicate cocktail names: 4 here (Corpse Reviver 2 and Pina Colada, as in the critique, plus Old Fashioned spelt with and without a hyphen, and Southside spelt with and without a space), against 2 in the critique.
* Categories: juice has 82 members here (24 citrus, 55 liquid, 3 other) against 62 (16 and 46) in the critique, because the audit matches the word juice anywhere in the name. Flour is 30 grain and 16 thickener here against 30 and 17.

Data sizes at baseline: 3891 ingredients, 441 cocktails,
77 sauces, 83 Cookbook dishes.

## After DATA-3: ingredient merges, removals and packaged flags

Every candidate on the three ingredient review lists (duplicates, non-food and fragments, packaged)
was read and decided. A decision is one of: **aliased** (merged into the ingredient a cook means,
`src/data/curation/aliases.json`), **hidden** (not food, `hidden.json`), **flagged packaged**
(kept, searchable, never suggested, `packaged.json`), or **kept as it is** with a reason
(`data/review/keep.json`). The audit now counts only the candidates nobody has decided; a decided one
is reported as reviewed. The target is zero unreviewed.

| Check | Rule id | Candidates at the first audit (2026-11-15) | Unreviewed now |
| --- | --- | --- | --- |
| Ingredient: misspelt name of another ingredient | `duplicate-misspelling` | 94 | 0 |
| Ingredient: plural of another ingredient | `duplicate-plural` | 3 | 0 |
| Ingredient: another ingredient plus a preparation word | `duplicate-prefix` | 122 | 0 |
| Ingredient: kitchen equipment or supply | `non-food` | 14 | 0 |
| Ingredient: a fragment, not a food | `fragment` | 32 | 0 |
| Ingredient: brand name | `packaged-brand` | 38 | 0 |
| Ingredient: boxed mix | `packaged-mix` | 63 | 0 |
| Ingredient: canned condensed soup | `packaged-soup` | 14 | 0 |
| Ingredient: 'flavored' product | `packaged-flavored` | 20 | 0 |
| **All of the above** |  | **400** | **0** |

Decided, counted by name: 210 aliased, 26 hidden, 123 flagged packaged, 31 kept as they are
(the keep list has 34 entries; a few are protections for names that are not in the data today).

### Counts, as the audit prints them

| What | Before (raw generated data) | After (curated, what the app loads) |
| --- | --- | --- |
| Ingredients | 3891 | 3667 (210 merged away, 26 hidden, 12 corrected spellings added) |
| Pairings | 95992 | 92504 |
| Ingredients flagged packaged | 0 | 123 |

Merging a variant moves its pairings onto the ingredient it was merged into (the stronger score is kept,
a pairing between the two is dropped), so the pairing count falls by the pairings that collapsed together
and the pairings of the hidden names.

### Packaged and hidden entries are never offered

Packaged ingredients stay findable by typing and stay valid in saved recipes. The app never puts one in
front of a cook as a suggestion, a stand-in, a checklist pick or a "goes with" partner. One predicate,
`isSuggestable(name, dataset)` in `src/data/curation/suggestable.js`, is applied at these places:

* every "goes with" list (Pairing Lab, the suggestion drawer, the Make-a-recipe suggestions): `getNeighbors` and `getNeighborsEnriched` in `src/data/graph.js`, plus the Flavor Bible partner list in `PairingMode.jsx`;
* the invent panels' shortlists, checklist picks and suggestions: `rankCocktailSlot`, `rankSauceSlot`, `rankDishSlot`, and the shared `shortlist`, `suggestNext` and `fillRequired` in `inventBuild.js`;
* stand-ins and replacements: `swapCandidates` (`cocktailRiff.js`), `sauceReplacements` (`inventSauce.js`), `findSwap` (`kitchenSwaps.js`);
* Recipe Notebook suggestions, boost and temper: `rankLogits` in `recipeRuntime.js` (every set-completion suggestion), `loadSuggestCandidates` and `loadReplaceCandidates` (`recipeCandidates.js`), `rankByAxisImpact` (`recipeProfileAnalysis.js`), and the browse list of the ingredient picker when nothing has been typed.

Hidden names and merged variants are already gone from the curated dataset (DATA-2), so the predicate is a second guard for them.

## After DATA-4: one category scheme

Every ingredient has exactly one category, and the list below is the whole scheme. The generated data
(`public/proDataset/ingredients.json`) is not edited: the scheme is applied on load by the curation layer
(`categoryRenames.json` renames the old `umami` category to `savory seasoning`, and `categoryOverrides.json`
has one line, with a reason, for each ingredient moved). The category rules below are run over the curated data
and must report zero outside the scheme. Old category words in the generated data that the scheme dropped: `umami` (47).

| Category | Ingredients in the generated data | Ingredients now (curated) | What it holds | Three examples |
| --- | --- | --- | --- | --- |
| `protein` | 490 | 455 | meat, poultry, fish and shellfish, eggs, tofu and other protein foods | egg, chicken, beef |
| `vegetable` | 406 | 356 | vegetables, mushrooms and legumes eaten as the body of a dish | tomato, carrot, potato |
| `fruit` | 223 | 205 | fruit other than citrus, fresh or dried | apple, banana, peach |
| `citrus` | 86 | 80 | citrus fruit, its zest and its juice (the sour of a drink or a sauce) | lemon, lime juice, orange juice |
| `dairy` | 245 | 239 | milk, cream, butter-fat dairy, yogurt and every cheese | milk, cream cheese, parmesan |
| `grain` | 299 | 309 | grains, rice, pasta, bread crumb and every flour | rice, flour, bread |
| `baked` | 206 | 205 | finished bakery goods and crackers | cake, graham cracker, vanilla wafer |
| `confection` | 182 | 180 | chocolate, candy, puddings and ice cream | chocolate, vanilla ice cream, butterscotch chip |
| `sweetener` | 103 | 98 | sugars, syrups and honey | sugar, honey, maple syrup |
| `fat` | 124 | 121 | cooking oils and fats | butter, olive oil, sesame oil |
| `nut` | 87 | 80 | nuts, seeds and nut butters | pecan, walnut, almond |
| `herb` | 111 | 108 | leafy herbs, fresh or dried | parsley, basil, thyme |
| `spice` | 173 | 158 | dried spices and spice blends | cinnamon, cumin, paprika |
| `seasoning` | 36 | 35 | salts and salt-and-spice seasonings | garlic salt, lemon pepper, celery salt |
| `aromatic` | 58 | 56 | onions, garlic, ginger and their kin, the flavor base of a dish | onion, garlic, ginger |
| `chili` | 84 | 74 | fresh and dried chili peppers | cayenne pepper, jalapeño, chili |
| `condiment` | 422 | 412 | prepared sauces, pastes, pickles and spreads | mustard, mayonnaise, soy sauce |
| `savory seasoning` | 0 | 38 | concentrated umami seasonings: fish sauce, worcestershire, bouillon, miso, anchovy (the old "umami" category) | fish sauce, worcestershire sauce, chicken bouillon |
| `acid` | 37 | 36 | vinegars and other cooking sours | vinegar, balsamic vinegar, rice vinegar |
| `thickener` | 44 | 28 | starches and setting agents (not flour) | cornstarch, gelatin, cornflour |
| `liquid` | 241 | 147 | stocks, soups, plant milks and other cooking liquids that are not a juice, wine or beer | chicken stock, coconut milk, tomato soup |
| `juice` | 0 | 46 | fruit and vegetable juices and nectars (citrus juices are in citrus) | pineapple juice, tomato juice, apple cider |
| `wine` | 0 | 50 | still, sparkling and fortified wine, sake, mirin and cooking wine (vermouth is in liqueur) | white wine, sake, port wine |
| `beer` | 0 | 6 | beer, ale, stout, lager and hard cider | beer, stout beer, lager beer |
| `spirit` | 45 | 36 | distilled spirits | rum, bourbon, tequila |
| `liqueur` | 59 | 55 | liqueurs, cordials and vermouth | triple sec, kahlua, sweet vermouth |
| `mixer` | 8 | 7 | sodas and other non-alcoholic bar mixers | ginger ale, tonic water, ginger beer |
| `bitters` | 4 | 4 | cocktail bitters | angostura bitters, orange bitters, gentian |
| `other` | 71 | 43 | anything that fits nowhere else (yeast, powders, non-food leftovers) | yeast, protein powder, corn husk |

Four decisions that are not obvious from the names:

* **Citrus juices stay with citrus.** Lemon, lime, orange, grapefruit and yuzu juice are filed under `citrus`, and every other juice under `juice`. The cocktail sour slot and the sauce acid slot read the `citrus` category, and lemon and lime juice must keep working as the sour; moving them would have meant changing those slot rules.
* **Vermouth stays in `liqueur`.** It is an aromatised wine, but My bar and the cocktail slots treat it as a liqueur-shelf modifier, so it is not moved into `wine`. The audit checks this too (rule `category-vermouth`).
* **Every flour is `grain`.** Cornstarch, gelatin and other setting agents stay `thickener`; a roux or thickener slot finds flour and cornstarch by name.
* **Apple cider is a `juice`.** In a recipe it is pressed apple juice. Bare "cider" is filed under `beer`.

## Detail from the latest run

Sizes now: 3891 ingredients, 441 cocktails, 77 sauces, 83 dishes.

### Categories: how each family is split (curated data, what the app loads)

| Family | Members | Split by category (most common first) | Category the scheme gives it | Outside it |
| --- | --- | --- | --- | --- |
| cheese | 138 | dairy 138 | dairy | 0 |
| juice | 71 | juice 46, citrus 25 | citrus / juice | 0 |
| flour | 46 | grain 46 | grain | 0 |
| wine | 50 | wine 50 | wine | 0 |
| vermouth | 4 | liqueur 4 | liqueur | 0 |
| beer | 6 | beer 6 | beer | 0 |
| spirit | 12 | spirit 12 | spirit | 0 |

### Cocktail families

| Cocktail family | Drinks | Cream or egg drinks |
| --- | --- | --- |
| Tropical Sours | 23 | 4 |
| Highballs & Fizzes | 78 | 12 |
| Sour Family | 149 | 27 |
| Boozy Sippers | 66 | 2 |
| Aromatic Stirred | 80 | 0 |
| Aperitivos | 45 | 0 |

### Sauces

27 of 77 sauces are under the catch-all mother sauce "Independent".
Mother sauces: Independent 27, Stir-fry 8, Curry 7, Espagnole 6, Béchamel 5, Tomato 5, Hollandaise 5, Salsa 5, Velouté 4, Nut Sauce 3, Mole 2. Most common cuisines: French 21, Mexican 9, Indian 8, Italian 5, American 5, Japanese 5, Chinese 4, Thai 4.

### Dish types: the Cookbook's list beside Invent a recipe's list

| Cookbook type (what a recipe is called in the Cookbook) | Dishes of that type | Invent a recipe type that makes it |
| --- | --- | --- |
| Soup (`soup`) | 8 | Soup |
| Noodles (`noodles`) | 4 | none |
| Pasta (`pasta`) | 6 | Pasta |
| Rice (`rice`) | 6 | Grain bowl |
| Curry (`curry`) | 7 | none |
| Stew & braise (`stew`) | 5 | Braise / stew |
| Grill & skewers (`grill`) | 6 | Roast |
| Fish & shellfish (`fish`) | 3 | none |
| Salad (`salad`) | 6 | Salad |
| Stir-fry (`wok`) | 3 | Stir-fry |
| Taco (`taco`) | 1 | Tacos |
| Wrap (`wrap`) | 3 | none |
| Baguette sandwich (`baguette`) | 1 | none |
| Sandwich & burger (`sandwich`) | 1 | none |
| Dumplings (`dumpling`) | 2 | none |
| Dip (`dip`) | 2 | none |
| Small plates (`tapas`) | 1 | none |
| Skillet (`skillet`) | 1 | none |
| Pizza (`pizza`) | 1 | none |
| Bread & bakes (`bake`) | 5 | none |
| Dessert (`dessert`) | 9 | none |
| Vegetables (`veg`) | 2 | none |
| Dish (`plate`) | 0 | none |

### Taste labels: which first word each category uses most

Computed on the generated data, before the curation layer, so it still shows the old category names (DATA-5 moves it onto the curated data).

The known vocabulary is: sweet, sour, bitter, salty, umami, spicy, pungent, astringent.

| Category | Most used first taste words |
| --- | --- |
| acid | sour 37 |
| aromatic | pungent 39, sweet 13, spicy 4, sour 2 |
| baked | sweet 185, salty 10, sour 5, pungent 4 |
| bitters | bitter 4 |
| chili | spicy 79, sweet 5 |
| citrus | sour 56, sweet 23, bitter 7 |
| condiment | sweet 158, spicy 72, salty 60, sour 56 |
| confection | sweet 149, bitter 27, sour 6 |
| dairy | salty 103, sweet 80, sour 40, umami 20 |
| fat | sweet 81, bitter 21, umami 10, pungent 6 |
| fruit | sweet 185, sour 36, astringent 2 |
| grain | sweet 259, bitter 14, umami 13, salty 13 |
| herb | bitter 37, pungent 34, sweet 21, astringent 12 |
| liqueur | sweet 52, bitter 6, sour 1 |
| liquid | sweet 95, salty 51, sour 37, bitter 27 |
| mixer | sweet 5, sour 1, spicy 1, bitter 1 |
| nut | sweet 61, bitter 19, umami 5, salty 2 |
| other | sweet 37, bitter 16, pungent 10, salty 5 |
| protein | umami 347, salty 106, sweet 31, spicy 4 |
| seasoning | salty 29, pungent 4, sour 2, spicy 1 |
| spice | spicy 61, sweet 46, pungent 45, bitter 15 |
| spirit | sweet 33, bitter 9, spicy 2, sour 1 |
| sweetener | sweet 101, sour 2 |
| thickener | sweet 34, bitter 5, umami 4, astringent 1 |
| umami | umami 30, salty 17 |
| vegetable | sweet 192, bitter 121, umami 58, sour 21 |
