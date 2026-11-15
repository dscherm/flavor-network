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
  skipped, so the skipping stays visible. (In the latest run: 3 candidates suppressed by 6 keep-list entries.)
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

These are the numbers exactly as the first run printed them (stored in
`data/review/baseline.json`). The audit run with `--check` fails if any count goes above its baseline,
so later clean-up tasks can show the numbers going down and nothing can quietly go up.

| Check | Rule id | Baseline total | Now (this run) |
| --- | --- | --- | --- |
| Ingredient: misspelt name of another ingredient | `duplicate-misspelling` | 94 | 94 |
| Ingredient: plural of another ingredient | `duplicate-plural` | 3 | 3 |
| Ingredient: another ingredient plus a preparation word | `duplicate-prefix` | 122 | 122 |
| Ingredient: kitchen equipment or supply | `non-food` | 14 | 14 |
| Ingredient: a fragment, not a food | `fragment` | 32 | 32 |
| Ingredient: brand name | `packaged-brand` | 38 | 38 |
| Ingredient: boxed mix | `packaged-mix` | 63 | 63 |
| Ingredient: canned condensed soup | `packaged-soup` | 14 | 14 |
| Ingredient: 'flavored' product | `packaged-flavored` | 20 | 20 |
| Category: a cheese outside the usual cheese category | `category-cheese` | 7 | 7 |
| Category: a juice outside the usual juice category | `category-juice` | 27 | 27 |
| Category: a flour outside the usual flour category | `category-flour` | 17 | 17 |
| Category: a wine outside the usual wine category | `category-wine` | 17 | 17 |
| Category: a beer or cider outside the usual category | `category-beer` | 0 | 0 |
| Category: a spirit outside the usual spirit category | `category-spirit` | 0 | 0 |
| Category: filed under 'umami' (a taste, not a kind of food) | `category-umami` | 47 | 47 |
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

### Where these differ from the first, by-hand critique

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

## Detail from the latest run

Sizes now: 3891 ingredients, 441 cocktails, 77 sauces, 83 dishes.

### Categories: how each family is split

| Family | Members | Split by category (most common first) | Outside the most common |
| --- | --- | --- | --- |
| cheese | 146 | dairy 139, umami 7 | 7 |
| juice | 82 | liquid 55, citrus 24, acid 2, aromatic 1 | 27 |
| flour | 47 | grain 30, thickener 16, nut 1 | 17 |
| wine | 54 | liquid 37, spirit 9, liqueur 6, condiment 2 | 17 |
| beer | 9 | liquid 9 | 0 |
| spirit | 12 | spirit 12 | 0 |

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
