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
cayenne pepper, tomato; for dishes garlic, tomato, flour, chicken, ginger, cumin, salt, soy sauce. STANDIN-2 (food) and STANDIN-3 (bar) write those entries.

## Notes for the entries still to be written

- A form's `use` must be a name `canonicalKey` keeps in the list's vocabulary. "dried thyme", "garlic powder", "ground ginger" and "canned tomatoes" all
  resolve to the ingredient itself (`thyme`, `garlic`, `ginger`, `tomato`), which is handled (the row keeps its key and takes the form as its label), so
  nothing needs to be added to the curated names for them.
- The existing test "each alternative traces to swapsFor or to swapCandidates" (`shoppingAlternatives.test.js`) reads `swapsFor`, which lists swaps
  only. The first real form or make entry will need that test to read `standInsFor` too.
