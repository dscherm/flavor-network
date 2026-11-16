# Stand-ins

What the shopping sheet ("Store doesn't have it?") offers when the store lacks something, how the table is shaped, who may read
which kind of entry, and how much of what recipes ask for has an answer. The table is `src/data/kitchenSwaps.js`; the sheet is
`src/components/StoreAlternatives.jsx` with its logic in `src/data/shoppingAlternatives.js`. Nothing here is deployed yet.
Entries are the assistant's judgement from common cooking knowledge, not tested recipes; the owner reads and corrects them.

## Four kinds of answer

An entry may carry `type`. Without one it is a swap (every entry written before STANDIN-1).

| Kind | Sheet label | What it is | Example | Built with |
|---|---|---|---|---|
| `swap` | Use instead | Another ingredient | shallot for onion | `S(...)`, `both(...)` |
| `form` | Another form | The same thing in another form | dried thyme for fresh | `FORM(for, use, role, kind, extra)` |
| `make` | Make it | Made from things; `use` is the first part, `plus` the rest | simple syrup from sugar and water | `MAKE(for, [parts], role, kind, extra)` |
| `none` | "Nothing really replaces X" and the reason | Nothing replaces it | an egg in a custard | `NONE(for, reason, role?, kind?)` |

Any kind may carry `ratio` (one numeric factor, applied to a row with exactly one number), `amountNote` (a conversion that is not
one factor, "1 tsp dried for 1 tbsp fresh"; "1/8 tsp powder per clove") and `note`. `sauce: false` and `supportingOnly` work as
before. A `none` wins over any other entry for the same ingredient and lists no alternatives. An ingredient with no entry at all
still says "No stand-in I'd trust for X."

On the list:

- **swap** replaces the row (as before); a swap with `plus` helpers (cream from milk and butter) adds the helpers beside it.
- **form** keeps the row's key and changes its label (`shoppingList.reformItem`): the list resolves "dried thyme" to `thyme`, so
  the same ingredient stays one row and never doubles. If the form resolves to a different key it replaces the row like a swap.
  The row's number is dropped when the entry converts by `amountNote` alone (3 tbsp fresh is not 3 tbsp dried); the note carries
  the amount. A numeric `ratio` scales a single-number row instead. The kitchen stores one name for fresh and dried, so a form is
  never marked "you have this".
- **make** replaces the row with its parts by the merge rule: the first part the cook lacks takes the row's place, the other parts
  the cook lacks are added beside it (an existing line is merged into, never doubled), the row keeps no quantity (the syrup's 250 ml
  is not 250 ml of sugar) and the amounts go in its note. Undo puts the original row back and takes off what the make added.
  When the cook has every part the sheet offers "Use what I have".

## Who may use which

The shopping sheet reads every kind (`standInsFor`, `STAND_INS`). The recipe side reads **swaps only** (`swapsFor`, `SWAPS`, `findSwap`),
exactly as before, so a recipe is never counted as makeable through a dried herb for a fresh one, a syrup made from sugar, or a `none`.
The table is split by `type` once, at load, so a new form, make or none cannot leak into a recipe-side caller.

| Caller | Reads | Before | After | Test |
|---|---|---|---|---|
| Shopping sheet (`shoppingAlternatives.alternativesFor`) | `standInsFor` | swaps only, "No stand-in I'd trust" | all four kinds, labelled; none says why | `standIns.test.js`, `StoreAlternatives.kinds.test.jsx` |
| What do I need? (`whatDoINeed.needsFromKitchen`, via `findSwap`) | `swapsFor` | swaps | unchanged | `standIns.test.js` "needsFromKitchen" |
| What can I cook, Cookbook "you can make" (`myKitchen.coverIngredients`, `kitchenRecipes`) | `findSwap` | swaps | unchanged | `standIns.test.js` "coverIngredients" |
| Invent a recipe replacements (`InventRecipe.replaceOptions`) | `swapsFor` | swaps, supportingOnly dropped for a main | unchanged | table split (no non-swap entry reaches `swapsFor`) |
| Invent sauce replacements (`inventSauce.sauceReplacements`) | `swapsFor` | swaps that hold in a sauce | unchanged | `standIns.test.js` "Sauce Lab replacements" |
| Sauce Lab strictness (`saucePantry.sameRoleAndKind` vs `sauce:false`) | `SWAPS` | swaps | unchanged, still checked over swap entries | `kitchenSwaps.test.js`, `standIns.test.js` |
| `scripts/measureKitchenMakeable.mjs` | `SWAPS`, `findSwap` | swaps | unchanged | run by hand |

Not decided for the recipe side (and why): a `form` for the recipe side would need an amount rule the recipe side does not have
(it only asks "is this item covered"), and a `make` needs the parts counted as the item; both would make a recipe look makeable when
the cook would have to change the dish. They stay shopping-sheet answers until a caller is shown to be right for them.

## The row's recipe: supporting-only swaps

A swap flagged `supportingOnly` (butter and olive oil for the pan) is offered only when the row came from a recipe in which the
ingredient is **not a main**, and withheld, with the reason shown, when it is a main or when the row has no recipe
(`shoppingAlternatives.rowMain`).

- A row records the recipes it came from (`item.from`, ids such as `dish:risotto-saffron`; `list.recipes` holds each id's kind and name).
- **A dish** is judged by the Cookbook's own rule (`recipeMains.mainsOf`): the dish's name ("Garlic Naan" names garlic), the hand-listed
  mains for a few dishes, then the ingredient's category. It is a main if it is a main of **any** dish the row came from.
- **A cocktail or a sauce** has no main/supporting split, so the row is treated as a main (withheld): butter in a hot buttered rum is the drink.
  Butter and oil swaps are also `sauce: false`.
- **No recipe** (typed by hand), or a recipe id the list no longer holds: withheld, and the sheet says it could not check.
- What the sheet loads to know it: nothing extra. `item.from` and `list.recipes` are already in the list, and the ingredient category table is the one
  the screen loaded for the aisles. No recipe data is fetched.
- Shown when offered: "Fine for frying; not if butter is the point of the dish." Shown when withheld: "Olive oil for butter only works where butter is not the point of
  the dish, and here it is." (or "...and this row did not come from a recipe I can check.").

## Coverage: `npm run measure:standins`

`scripts/measureStandIns.mjs` takes every ingredient line of the 439 built-in cocktails, 77 sauces and 83 dishes by the **canonical name the shopping
list stores** (`shoppingList.canonicalKey` over the curated names, the name a cook sees on a row, not the printed label), asks the sheet's own function
what it would offer, and counts a line once per recipe. A line is judged as the sheet judges the row: a dish line knows whether the ingredient is a main of
that dish, a sauce line is a sauce row, a cocktail line carries the bar's role table (so a base spirit counts when a same-family bottle exists).
It assumes the cook owns nothing. `--json` prints the numbers; `--target N` sets the share it counts the gap against (default 80); `--swaps-only` reads
only the swap-kind entries (the table as it was before the four kinds).

### Baseline, 2026-11-16 (before STANDIN-1: swap entries only)

| | cocktail | sauce | dish |
|---|---|---|---|
| recipes | 439 | 77 | 83 |
| distinct ingredients | 243 | 120 | 190 |
| lines | 1809 | 598 | 624 |
| lines with a stand-in | 512 | 119 | 181 |
| share with a stand-in | 28.3% | 19.9% | 29.0% |
| ingredients with no answer | 221 | 101 | 148 |
| more ingredients needed for 80% | 48 | 37 | 53 |

### After STANDIN-1 (one real entry added: an honest "none" for egg)

| | cocktail | sauce | dish |
|---|---|---|---|
| lines with a stand-in | 512 | 119 | 181 |
| lines with "nothing replaces it" | 9 | 0 | 13 |
| share with a stand-in | 28.3% | 19.9% | 29.0% |
| share answered (stand-in or honest none) | 28.8% | 19.9% | 31.1% |
| ingredients with no answer | 220 | 101 | 147 |
| more ingredients needed for 80% | 47 | 37 | 52 |

Stand-in lines are unchanged: STANDIN-1 adds no form or make entry to the real table and only the egg none. The tests build form and make entries
with `FORM` and `MAKE`.

These figures differ from the 21%, 25% and 22% quoted when this work was filed. That count used the names printed on recipe cards, with no bar
spirit family and no supporting-only rule; this one counts by the name on the row and as the sheet answers. The most used ingredients with no answer are,
for cocktails gin, vodka, dry vermouth, angostura bitters, orange juice, sweet vermouth, syrup, grenadine; for sauces salt, garlic, butter, ginger, cumin, olive oil,
cayenne pepper, tomato; for dishes garlic, tomato, flour, chicken, ginger, cumin, salt, soy sauce. STANDIN-2 (food) wrote the food entries below; STANDIN-3 writes the bar's.

### After STANDIN-2 (food entries written, 2026-11-16)

148 entries added (71 swaps, 41 forms, 17 makes, 19 nones), 214 in all. `npm run measure:standins`:

| | cocktail | sauce | dish |
|---|---|---|---|
| lines | 1809 | 598 | 624 |
| lines with a real stand-in (swap, form or make) | 565 | 448 | 452 |
| lines with "nothing really replaces it" | 14 | 51 | 70 |
| share with a real stand-in | 31.2% | 74.9% | 72.4% |
| share with an honest none | 0.8% | 8.5% | 11.2% |
| **share answered (either)** | 32.0% | **83.4%** | **83.7%** |
| ingredients with no answer | 200 | 35 | 68 |
| ingredients with a real stand-in / with a none | 40 / 3 | 72 / 13 | 104 / 18 |

Before this task (after STANDIN-1): sauces 19.9% real, 0% none; dishes 29.0% real, 2.1% none. The 80% target is met for dishes and
sauces counting both answers; the real stand-ins alone are 74.9% and 72.4%, and the rest of the answered lines are honest nones (mostly
flour, egg yolk, saffron, yeast, sesame oil, fish sauce, bay leaf). Cocktails are STANDIN-3's.

What is still unanswered, most used first: sauces butter (20 lines), olive oil (14), cream (9), water (7), vegetable (4), caper, clove, meat, scotch bonnet;
dishes butter (7), mushroom, potato, mayonnaise, mozzarella, pita bread, tofu, anchovy, clam. On purpose: butter and olive oil have only the pan swaps, which are
withheld for a main and for a sauce, and the existing Sauce Lab and sheet tests pin those entries (butter forms such as salted and unsalted, and ghee for butter, were
tried and dropped because they would have changed those pinned cases); cream has only milk (not in a sauce) for the same reason, and `half and half` cannot be an
entry (see below). Generic words ("vegetable", "meat", "fruit") are not one ingredient and get no answer.

### The second check: `npm run check:standins`

`scripts/checkStandIns.mjs` is a second opinion, never a source. For every swap-kind entry it takes the top 30 everyday partners of each side
(the blended index `measureKitchenMakeable.mjs` uses) and the overlap of the two sets, then lists the weakest tenth and every swap the index
cannot score. It also checks that every name in the table is a name the app stores (`for` resolves to itself, every `use` and `plus` is a
curated, suggestable name; a form may resolve to the row's own key). A high overlap proves nothing (garlic for onion scores 0.46 and is no swap);
a low one only says look again. Flagged on 2026-11-16 (14 weakest of 133 scored, 3 unscored; 136 swaps) and how each was resolved:

| Flagged swap | Overlap | Resolution |
|---|---|---|
| butter for ghee, brown sugar for palm sugar, broth for vegetable broth, cream for creme fraiche, sour cream for yogurt, yogurt for sour cream, vegetable broth for white wine, chicken stock for vegetable broth, vegetable broth for chicken stock, stock for vegetable broth, sugar for brown sugar | 0.00 to 0.03 | Pre-existing entries, kept. The index is a count of co-occurring partners over recipes, and an ingredient that appears in only a few hundred recipes (ghee, palm sugar) or is interchangeable in the same dishes (the stocks) shares few partners with its stand-in precisely because they are not used together. Same role and kind, same reason as before. |
| nutmeg for mace, mace for nutmeg (0.03) | 0.03 | New, kept. Mace is the husk of the nutmeg seed, the classic stand-in; the two almost never appear in one recipe, which is what a stand-in looks like in this index. Note says mace is more delicate. |
| vegetable oil for butter, spaghetti for linguine pasta, spaghetti for pasta | unscored | Pre-existing; the graph has no node for these names (the existing test lists them). Kept. |
| pak choy for chinese cabbage, chinese cabbage for pak choy | unscored | New, **removed**: napa cabbage is firm and sweet, pak choy is tender and mild, and the index could not support the pair. |
| shaoxing wine for dry sherry, chili flake for red pepper, cayenne pepper for red pepper | n/a | New, **removed** before commit: the existing role tests (the raw graph calls shaoxing wine "liquid"; the Sauce Lab calls "red pepper" a seasoning) disagree with the pairing, so the table does not assert it. |

Ties at 0.03 run past the tenth line (for example almond for pine nut 0.05, arrowroot and cornstarch 0.05, thai basil and basil 0.05, tamari and
soy sauce 0.09, marjoram and oregano 0.09, parsnip and carrot 0.09, ghee and clarified butter 0.07). These were all judged on the cooking, not on the
number: same role, same kind, and each carries a note that says what changes. If you disagree with any, the table below is where to say so.

### Recipe-side makeability, before and after (`node scripts/measureKitchenMakeable.mjs`)

The recipe side reads swap-kind entries only, so the 71 new swaps are the only ones that can change it. K30: make 6 (3 with a swap) before and after,
"one or two mains away" 51 to 52. K30 plus a spice rack: 6 and 6, 51 to 52. K6 (six items): make 0, nearly 1 to nearly 1 (unchanged). K5: unchanged. K40: make 14
(5 with a swap) before and after, one or two mains away 54 to 55. One more recipe in each of those kitchens moved into "one or two mains away"; no recipe became makeable through a new swap, and no form, make or none is read at all. Swap overlap: 65 swaps at mean 0.20
before, 136 at 0.22 now.

An earlier draft added `half and half` as a stand-in for cream and as a part of a milk make. It made butter chicken "makeable" in a six-item kitchen with no
cream at all, because `recipePairingMatch.resolveIngredientName` drops "half and half" as nothing but stop words and so `has('half and half')` is true for any
kitchen. That is an existing quirk (not touched here); the entries were removed rather than ship a false answer. Evaporated milk is the only milk make.

### Cream and buttermilk

The two old `plus` entries (cream from milk and butter, buttermilk from milk and lemon) were **left untyped**. Retyping them as `make` would remove them from the
recipe side, and "What can I cook" counts buttermilk pancakes and fried chicken as makeable through milk and lemon today; those two recipes would stop being counted.
The sheet shows them as before.

### Tests changed (and why)

- `shoppingAlternatives.test.js`, "each alternative traces to swapsFor or to swapCandidates": reads `standInsFor` now, so forms and makes trace too (STANDIN-1's named change).
- Same file, "nothing known": the fixtures saffron and basil (which had no entry) are now quince and sorrel; saffron and basil have answers.
- Same file, "a free-text neighbour is never invented": basil and cumin now have real answers, so it asserts they never get mint or coriander (the point of the test) instead of being empty.
- `ShoppingList.alternatives.test.jsx` and `StoreAlternatives.kinds.test.jsx`: the "no stand-in I would trust" fixture saffron became quince.
- Nothing else was loosened. `ratio` is unused in the real table (amounts are `amountNote`), so "no real table entry carries a ratio" holds.
- New: `src/data/__tests__/standIns.food.test.js` (12 tests: the named cases, names stored and suggestable, none/make/form shape, no duplicates, role per swap).

### Names

Every `for` is a name the list stores. A form's `use` resolves to the row's own key ("dried thyme", "garlic powder", "ground cumin") or is itself a stored
name (tomato paste, chicken thigh). Two things the brief expected that the app has no stored name for, so they are mentioned in a note instead of
being entries: coconut aminos (under soy sauce) and whole cumin seed (the list resolves "cumin seed" to "seed"; a ground form is offered instead).

### The table, every line

Everything below is the assistant's judgement from common cooking knowledge, not a tested recipe. Read it and correct any line; each is one line in
`src/data/kitchenSwaps.js`. Swaps are two-way only where two lines appear.

#### Chilies and heat

| For | Kind | Offer | Amount and note |
|---|---|---|---|
| jalapeno chile | swap | serrano pepper |  |
| serrano pepper | swap | jalapeno chile |  |
| green chili pepper | swap | jalapeno chile |  |
| green chili pepper | swap | serrano pepper |  |
| red chili | swap | serrano pepper | note: green and grassier, about the same heat |
| red chili | swap | jalapeno chile | note: milder |
| chili | swap | jalapeno chile | note: milder |
| chili | swap | serrano pepper | note: hotter |
| red chili | form | chili flake | amount: 1/4 tsp chili flakes for each small fresh chili; note: gives heat but not the fresh flavor |
| chili | form | chili flake | amount: 1/4 tsp chili flakes for each small fresh chili; note: gives heat but not the fresh flavor |
| cayenne pepper | swap | chili flake | amount: 1/2 tsp chili flakes for each 1/4 tsp cayenne; note: coarser, so it will not disappear into a smooth sauce |
| chili flake | swap | cayenne pepper | amount: 1/4 tsp cayenne for each 1/2 tsp chili flakes; note: hotter and finer |
| ancho chili | swap | guajillo chili |  |
| guajillo chili | swap | ancho chili |  |

#### Fats and oils

| For | Kind | Offer | Amount and note |
|---|---|---|---|
| butter | swap | olive oil | only where it is not the point of the dish; not in a sauce |
| olive oil | swap | butter | only where it is not the point of the dish; not in a sauce |
| butter | swap | vegetable oil | only where it is not the point of the dish; not in a sauce |
| ghee | swap | butter |  |
| ghee | swap | clarified butter | note: the same thing under another name |
| clarified butter | swap | ghee | note: the same thing under another name |
| lard | swap | shortening | note: shortening has no pork flavor |
| shortening | swap | lard | note: shortening has no pork flavor |
| sesame oil | none | nothing replaces it: toasted sesame oil is a flavoring, not a cooking fat: another oil gives none of its taste |  |

#### Garlic, ginger and aromatics

| For | Kind | Offer | Amount and note |
|---|---|---|---|
| scallion | swap | onion |  |
| shallot | swap | onion |  |
| leek | swap | onion |  |
| onion | swap | purple onion |  |
| purple onion | swap | onion |  |
| pearl onion | swap | onion |  |
| onion | swap | shallot |  |
| scallion | swap | leek |  |
| garlic | form | jarred garlic | amount: 1/2 tsp jarred minced garlic for each fresh clove; note: a little flatter than fresh |
| garlic | form | garlic powder | amount: 1/8 tsp garlic powder for each fresh clove; note: fine in a rub, a sauce or a soup; it will not brown or sizzle like fresh |
| ginger | form | ground ginger | amount: 1/4 tsp ground ginger for each 1 tbsp fresh grated; note: warmer and duller; fine in baking, a rub or a spiced sauce, a poor fit for a stir-fry |
| ginger | form | jarred ginger | amount: 1 tsp jarred ginger paste for each 1 tbsp fresh grated |
| galangal | swap | ginger | note: milder and less piney; fine in a Thai soup or paste |

#### Herbs

| For | Kind | Offer | Amount and note |
|---|---|---|---|
| parsley | swap | cilantro |  |
| cilantro | swap | parsley |  |
| thyme | form | dried thyme | amount: 1 tsp dried for 1 tbsp fresh |
| thyme | form | fresh thyme | amount: 1 tbsp fresh for 1 tsp dried |
| oregano | form | dried oregano | amount: 1 tsp dried for each 1 tbsp fresh |
| oregano | form | fresh oregano | amount: 1 tbsp fresh for each 1 tsp dried |
| basil | form | dried basil | amount: 1 tsp dried for each 1 tbsp fresh; stir it in early; note: no good for pesto, caprese or a garnish |
| rosemary | form | dried rosemary | amount: 1 tsp dried for each 1 tbsp fresh needles; note: crumble it so the needles are not sharp |
| dill | form | dried dill | amount: 1 tsp dried for each 1 tbsp fresh; note: much weaker; fine in a cooked sauce or a dip, poor as a garnish |
| mint | form | dried mint | amount: 1 tsp dried for each 1 tbsp fresh; note: fine in a cooked dish or a yogurt sauce, no good as a garnish |
| rosemary | swap | thyme | note: milder than rosemary: use a little more |
| thyme | swap | rosemary | amount: about half as much rosemary as thyme; note: a stronger flavor than thyme |
| thai basil | swap | basil | note: sweeter, without the anise note |
| basil | swap | thai basil | note: with an anise note; best in a stir-fry or a curry |
| oregano | swap | marjoram | note: marjoram is sweeter and milder |
| marjoram | swap | oregano | note: marjoram is sweeter and milder |
| bay leaf | none | nothing replaces it: it adds a quiet background note that no other herb copies; leaving it out loses little, and thyme is a different flavor |  |
| tarragon | none | nothing replaces it: its sweet anise note is the point of a bearnaise or a chicken dish; no common herb matches it |  |

#### Meat, fish, eggs and beans

| For | Kind | Offer | Amount and note |
|---|---|---|---|
| egg | none | nothing replaces it: an egg sets and binds a custard, a quiche or a hollandaise; nothing else does both |  |
| egg yolk | none | nothing replaces it: a yolk emulsifies and thickens at once, in a hollandaise or a custard; nothing else does both |  |
| chicken | form | chicken thigh | note: juicier than breast: give it a few more minutes |
| chicken | form | chicken breast | note: leaner: cook it a little less so it stays moist |
| pork | form | pork shoulder | note: for a stew, a braise or pulled pork: it needs slow cooking |
| pork | form | pork loin | note: for a quick roast or a chop: leaner, so it dries out if braised |
| beef | form | beef chuck | note: for a stew or a braise: it needs slow cooking |
| beef | form | ground beef | note: for a sauce, a patty or a filling |
| shrimp | swap | prawn |  |
| prawn | swap | shrimp |  |
| salmon | swap | trout | note: trout is milder and a little leaner |
| trout | swap | salmon | note: trout is milder and a little leaner |
| white fish | swap | cod | note: firm and mild |
| bacon | form | pancetta | note: cured but not smoked; add a pinch of smoked paprika for the smoke |
| lamb | none | nothing replaces it: its flavor is the point of a lamb dish; beef or pork would change the dish rather than stand in |  |
| chickpea | swap | cannellini bean | note: fine in a stew or a salad; not in falafel or hummus |
| cannellini bean | swap | chickpea | note: fine in a stew or a salad; not in falafel or hummus |

#### Milk, cream and cheese

| For | Kind | Offer | Amount and note |
|---|---|---|---|
| yogurt | swap | sour cream |  |
| sour cream | swap | yogurt |  |
| creme fraiche | swap | sour cream | not in a sauce |
| creme fraiche | swap | cream |  |
| cream | swap | milk and butter | not in a sauce |
| buttermilk | swap | milk and lemon | not in a sauce |
| buttermilk | swap | yogurt |  |
| parmesan | swap | pecorino |  |
| cheddar | swap | monterey jack cheese |  |
| monterey jack cheese | swap | cheddar |  |
| feta | swap | cotija cheese |  |
| cotija cheese | swap | feta |  |
| milk | make | evaporated milk + water | amount: 1/2 cup evaporated milk and 1/2 cup water for each cup of milk |
| gruyere | swap | swiss cheese | note: milder and less nutty |
| swiss cheese | swap | gruyere | note: milder and less nutty |
| ricotta | swap | cottage cheese | note: drain it, and blend it smooth for a baked dish |

#### Nuts and seeds

| For | Kind | Offer | Amount and note |
|---|---|---|---|
| sesame seed | none | nothing replaces it: its toasty, nutty taste is the point of the garnish; other seeds add crunch but taste different |  |
| peanut | swap | cashew | note: milder and creamier, less roasty |
| peanut | swap | almond | note: milder, less roasty |
| walnut | swap | pecan | note: pecan is sweeter |
| pecan | swap | walnut | note: pecan is sweeter |
| pine nut | swap | walnut | note: more bitter: toast it lightly |
| pine nut | swap | almond | note: blanched almonds are the milder choice |
| almond | swap | cashew | note: softer and creamier |
| cashew | swap | almond | note: softer and creamier |

#### Other

| For | Kind | Offer | Amount and note |
|---|---|---|---|
| lime | swap | lemon |  |
| lemon | swap | lime |  |
| lime juice | swap | lemon juice |  |
| lemon juice | swap | lime juice |  |

#### Rice, noodles and flour

| For | Kind | Offer | Amount and note |
|---|---|---|---|
| bread baguette | swap | bread |  |
| linguine pasta | swap | pasta |  |
| linguine pasta | swap | spaghetti |  |
| pasta | swap | spaghetti |  |
| macaroni | swap | pasta |  |
| corn tortilla | swap | tortilla |  |
| corn tortilla | swap | flour tortilla |  |
| flour | none | nothing replaces it: flour thickens a roux and gives structure to a dough or batter; no one ingredient does both, and cornstarch only thickens |  |
| rice | form | basmati rice | note: long grain: for a pilaf, a curry or fried rice, not for a risotto or sushi |
| rice | form | jasmine rice | note: long grain, a little sticky: for a stir-fry or a curry, not for a risotto or sushi |
| rice | form | arborio rice | note: short grain and creamy: right for a risotto, too soft for a pilaf |
| rice noodle | swap | rice vermicelli | note: thinner: soak it for less time |
| rice vermicelli | swap | rice noodle | note: thinner: soak it for less time |

#### Salt and seasonings

| For | Kind | Offer | Amount and note |
|---|---|---|---|
| salt | form | kosher salt | amount: about 1 1/2 times as much kosher salt by volume as table salt; note: the grains are coarser, so a spoon holds less salt |
| salt | form | table salt | amount: about two thirds as much table salt by volume as kosher salt |
| salt | form | sea salt | amount: fine sea salt measures like table salt; flaky sea salt, use about twice as much by volume |

#### Sauces, condiments and seasonings

| For | Kind | Offer | Amount and note |
|---|---|---|---|
| pecorino | swap | parmesan |  |
| tomato paste | form | tomato sauce | amount: 3 tbsp tomato sauce, cooked down, for each 1 tbsp paste |
| tomato sauce | make | tomato paste + water | amount: 1 part tomato paste to 3 parts water, and a pinch of salt and sugar |
| ketchup | make | tomato paste + sugar + vinegar | amount: 2 tbsp tomato paste, 1 tbsp sugar, 1 tbsp vinegar and 2 tbsp water, with a pinch of salt, for about 1/4 cup |
| soy sauce | swap | tamari | note: rounder and usually wheat-free; coconut aminos are sweeter and much less salty |
| tamari | swap | soy sauce | note: a little sharper, and it contains wheat |
| fish sauce | none | nothing replaces it: its salty, fermented-fish depth is the whole point; soy sauce is sweeter and has none of that funk |  |
| oyster sauce | make | soy sauce + sugar + cornstarch | amount: 1 tbsp soy sauce, 1/2 tsp sugar and a pinch of cornstarch for each 1 tbsp oyster sauce; note: no oyster flavor |
| worcestershire sauce | make | soy sauce + vinegar + sugar | amount: 1 tbsp soy sauce, 1 tsp vinegar and a pinch of sugar for each 1 tbsp |
| dashi | make | kombu + bonito flakes | amount: steep a 4 inch (10 cm) piece of kombu and a handful of bonito flakes in 4 cups hot water for 10 minutes, then strain |
| gochujang | none | nothing replaces it: a fermented chili, rice and soybean paste: miso with chili is only a rough cousin |  |
| doubanjiang | none | nothing replaces it: a fermented broad bean and chili paste: nothing common has its saltiness and depth |  |
| curry paste | none | nothing replaces it: a Thai paste is fresh lemongrass, galangal and chilies pounded together; curry powder is a different dish |  |
| mustard | form | mustard powder | amount: 1 tsp mustard powder mixed with 2 tsp water for each 1 tbsp prepared mustard |
| mustard | form | dijon mustard | note: sharper than yellow mustard; use a little less |

#### Spices and spice blends

| For | Kind | Offer | Amount and note |
|---|---|---|---|
| black pepper | swap | white pepper | note: hotter and earthier, with no black specks |
| white pepper | swap | black pepper | note: the black specks will show in a pale sauce |
| chili powder | make | paprika + cumin + cayenne pepper + oregano | amount: for 1 tbsp: 2 tsp paprika, 1 tsp cumin, 1/2 tsp cayenne and 1/2 tsp oregano, plus a pinch of garlic powder |
| paprika | swap | smoked paprika | amount: about half as much smoked paprika as paprika; note: smoky |
| smoked paprika | swap | paprika | note: no smoke |
| cumin | form | ground cumin | amount: 1 tsp ground for each 1 tsp whole seeds; note: toast whole seeds first to wake them up |
| coriander | form | ground coriander | amount: 1 tsp ground for each 1 tsp whole seeds |
| coriander | swap | coriander seed | note: crush the seeds first |
| cinnamon | form | ground cinnamon | amount: about 1/2 tsp ground for each 3 inch stick |
| cinnamon | form | cinnamon stick | amount: one 3 inch stick for about 1/2 tsp ground; note: simmer it in a liquid, then take it out |
| nutmeg | form | ground nutmeg | amount: 1/4 tsp ground for each 1/2 whole nutmeg |
| nutmeg | swap | mace | note: mace is a little more delicate |
| mace | swap | nutmeg | note: mace is a little more delicate |
| cardamom | form | ground cardamom | amount: about 1/8 tsp ground for each pod |
| allspice | make | cinnamon + nutmeg + clove | amount: for 1 tsp: 1/2 tsp cinnamon, 1/4 tsp nutmeg and 1/4 tsp ground cloves |
| garam masala | make | cumin + coriander + cinnamon + cardamom | amount: for 1 tsp: 1/2 tsp cumin, 1/4 tsp coriander and 1/8 tsp each of cinnamon and cardamom, with a pinch of black pepper |
| curry powder | make | turmeric + cumin + coriander + cayenne pepper | amount: for 1 tbsp: 1 tsp each of turmeric, cumin and coriander, and 1/4 tsp cayenne |
| saffron | none | nothing replaces it: nothing matches its flavor; turmeric gives only the yellow color |  |
| turmeric | none | nothing replaces it: its earthy color and flavor are the job; paprika gives red, not the same taste |  |
| fenugreek | none | nothing replaces it: its bitter, maple-like note has no common stand-in |  |
| sichuan peppercorn | none | nothing replaces it: its numbing tingle is not heat, and black pepper does not do it |  |
| vanilla | form | vanilla extract | amount: 1 tbsp vanilla extract for each vanilla bean |

#### Stocks and liquids

| For | Kind | Offer | Amount and note |
|---|---|---|---|
| beef stock | swap | chicken stock |  |
| chicken stock | swap | beef stock |  |
| vegetable broth | swap | chicken stock |  |
| chicken stock | swap | vegetable broth |  |
| beef stock | swap | stock |  |
| vegetable broth | swap | stock |  |
| beef stock | swap | broth |  |
| vegetable broth | swap | broth |  |
| veal stock | swap | beef stock | note: less gelatin, so a sauce will be thinner: reduce it a little more |
| veal stock | swap | chicken stock | note: lighter and less gelatin: reduce it a little more |
| chicken stock | form | chicken bouillon | amount: 1 cube or 1 tsp bouillon in 1 cup hot water for each cup of stock; note: saltier: go easy on the salt |
| coconut milk | swap | coconut cream | amount: thin it with an equal amount of water; note: richer |

#### Sweeteners and chocolate

| For | Kind | Offer | Amount and note |
|---|---|---|---|
| honey | swap | sugar |  |
| sugar | swap | honey |  |
| honey | swap | maple syrup |  |
| maple syrup | swap | honey |  |
| brown sugar | swap | sugar |  |
| palm sugar | swap | brown sugar |  |
| palm sugar | swap | sugar |  |
| sugar | swap | brown sugar | note: a little molasses flavor, and moister |
| brown sugar | make | sugar + molasses | amount: 1 tbsp molasses for each 1 cup of sugar |
| chocolate | make | cocoa + butter | amount: 3 tbsp cocoa and 1 tbsp butter for each 1 oz unsweetened chocolate; add 1 tbsp sugar for semisweet |

#### Thickeners and baking

| For | Kind | Offer | Amount and note |
|---|---|---|---|
| cornstarch | swap | arrowroot | note: stir it in at the end: arrowroot goes thin if it boils long or is reheated |
| arrowroot | swap | cornstarch | note: stir it in at the end: arrowroot goes thin if it boils long or is reheated |
| cornstarch | swap | potato starch | note: add it off the boil so it does not clump |
| potato starch | swap | cornstarch | note: add it off the boil so it does not clump |
| baking powder | make | baking soda + cream of tartar | amount: 1/4 tsp baking soda and 1/2 tsp cream of tartar for each 1 tsp baking powder |
| yeast | none | nothing replaces it: it is what makes bread dough rise and ferment; baking powder cannot do that |  |

#### Vegetables and fruit

| For | Kind | Offer | Amount and note |
|---|---|---|---|
| tomato | form | canned tomatoes | amount: one 14 oz (400 g) can for about 4 medium fresh tomatoes; note: for a cooked dish or a sauce, not for a salad or a sandwich |
| tomato | form | tomato paste | amount: 1 tbsp paste stirred into 1/4 cup water for each medium tomato; note: for a cooked dish only |
| carrot | swap | parsnip | note: parsnip is sweeter and nuttier |
| parsnip | swap | carrot | note: parsnip is sweeter and nuttier |
| celery | form | celery seed | amount: 1/4 tsp celery seed for each stalk; note: gives the flavor but not the crunch |
| spinach | swap | chard | note: sturdier: cook it a little longer |
| chard | swap | spinach | note: more tender: it needs less time |
| spinach | swap | kale | note: tougher: strip the stems and cook it longer |
| eggplant | swap | zucchini | note: less creamy and quicker to cook |
| sweet pepper | swap | green pepper | note: green is more bitter |
| green pepper | swap | sweet pepper | note: green is more bitter |
| apple | swap | pear | note: pear is softer and cooks faster |
| pear | swap | apple | note: pear is softer and cooks faster |
| cucumber | none | nothing replaces it: its cool, watery crunch is the job, and nothing common matches it |  |
| avocado | none | nothing replaces it: its creamy, mild fat is the point; nothing else mashes or slices like it |  |
| bean sprout | none | nothing replaces it: a crisp, watery crunch: cabbage or carrot gives crunch but not the same |  |

#### Vinegars and acids

| For | Kind | Offer | Amount and note |
|---|---|---|---|
| rice vinegar | swap | apple cider vinegar |  |
| sherry vinegar | swap | red wine vinegar |  |
| apple cider vinegar | swap | white wine vinegar |  |
| white wine vinegar | swap | apple cider vinegar |  |
| tamarind | make | lime juice + brown sugar | amount: 1 tbsp lime juice and 1 tsp brown sugar for each 1 tbsp tamarind paste |
| red wine vinegar | swap | white wine vinegar |  |
| white wine vinegar | swap | red wine vinegar |  |
| white wine vinegar | swap | rice vinegar | note: milder and a little sweeter |
| vinegar | swap | white wine vinegar |  |
| vinegar | swap | apple cider vinegar |  |

#### Wine in cooking

| For | Kind | Offer | Amount and note |
|---|---|---|---|
| white wine | swap | chicken stock | not in a sauce |
| white wine | swap | vegetable broth | not in a sauce |
| white wine | swap | stock | not in a sauce |
| white wine | swap | broth | not in a sauce |
| mirin | make | white wine + sugar | amount: 1 tbsp white wine and 1/2 tsp sugar for each 1 tbsp mirin |
| white wine | make | chicken stock + white wine vinegar | amount: 1/2 cup stock and 1 tsp white wine vinegar for each 1/2 cup wine; note: in a pan sauce or a risotto; not in a drink |
| red wine | make | grape juice + red wine vinegar | amount: 1 cup red grape juice and 1 tbsp red wine vinegar for each cup of wine; note: sweeter and with no tannin: fine for a quick pan sauce, thin in a long braise |

## Notes for later entries

- A form's `use` must be a name `canonicalKey` keeps in the list's vocabulary, or resolve to the row's own key (handled by `reformItem`).
- A swap's `use` must not be only stop words ("half and half"): the recipe side's `has` is true for it in any kitchen.
- Forms and makes are not offered to recipe-side callers; a new `swap` is, so each must hold in "you can make this with what you have".
