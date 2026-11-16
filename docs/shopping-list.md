# The shopping list

What it is, where it is kept, how two copies agree, how amounts add up, and what it cannot do. Every claim names the file
that does it. Nothing here is deployed yet (see `CLOSEOUT.md`, UNRELEASED).

## What it is

A list of things to buy, opened from the Labs menu (`?path=shopping` also opens it). Rows are grouped by aisle (produce,
dairy, meat and fish, dry goods, spices, drinks, other) and can be ticked off. You can type an item, add a whole recipe's
ingredients, ask for an alternative when the store does not have something, and put the ticked items into My kitchen or My bar.
Screen: `src/components/ShoppingList.jsx`. The list logic is pure functions in `src/data/shoppingList.js`; aisles are
`AISLE_OF_CATEGORY` in the same file.

## Where it is kept

| Place | What | Code |
|---|---|---|
| This device | `localStorage` key `fn-shopping-v1`, value `{ v: 1, list: { items, recipes }, removed: { itemId: removedAtMs } }`. A missing, corrupt or other-version value is read as an empty list; if storage refuses (a private window) the list lives in memory for the session. | `SHOPPING_KEY`, `loadShopping`, `saveShopping` in `src/data/shoppingStore.js` |
| The account | The `shopping` field of the profile document `profiles/{uid}` (the same `{ list, removed }` object), written only when signed in. | `src/hooks/useUserProfile.js` (`shopping` in `DEFAULT_PROFILE`, the cloud load, `mergeProfiles`, the save effect) |
| Not in the profile blob | The device copy of the profile (`flavor-user-profile-v2`) does not hold it; `saveLocalProfile` splits it off. | `saveLocalProfile` in `useUserProfile.js` |

`firestore.rules` was not changed: the profile rule is "the owner may read and write", with no per-field check. The list is
not public and has no share link. Clear profile and Import profile keep the shopping list (it is not taste data).

## Two copies, one list: the per-item merge and tombstones

At sign-in, and again just before every save that changed the list, the device copy and the account copy are merged item by
item (`mergeShopping` in `src/data/shoppingStore.js`). The save reads the account document first, so a tick made on another
device since sign-in is not overwritten; this costs one document read per shopping change while signed in.

- An item on both sides: the one with the later `updatedAt` wins (an exact tie is broken by comparing the items, so both
  devices choose the same one).
- An item on one side only: kept, unless the other side has a removal note ("tombstone") that is not older than the item's
  last change. An edit made after the removal brings the item back; at an exact tie the removal wins.
- Removal notes are made for you by comparing the list before and after any change (`commitList`), so Remove, Clear checked,
  Clear all, Put in my kitchen and a row folded into another all count.
- Removal notes are dropped after 30 days (`TOMBSTONE_MAX_AGE_MS`) and held to 300 (`TOMBSTONE_CAP`, newest kept). The limit
  that follows: a removed item from a device that was offline for more than 30 days can reappear when it syncs.
- Order: this device's items first, then the other copy's new ones.

## What "pantry" means here

There is no separate pantry. The Sauce Lab's "pantry" is the same saved list as My kitchen (`fn-my-kitchen`), so the screens
say "My kitchen" (`stockNow` in `ShoppingList.jsx`, which passes `pantry: []`; `makeHas` in `shoppingList.js` accepts a pantry
list for tests). "Do I have it?" asks one question across My kitchen, My bar and, if switched on, the spice rack
(`makeHas`, which uses `haveIngredient` in `src/data/myKitchen.js`, including its equivalents such as lemon covering lemon
juice). Put checked items in my kitchen sends drinks (`isBooze` in `src/data/myBar.js`) to My bar and everything else to My
kitchen (`ShoppingList.jsx`).

## How amounts add up (the merge rule)

An ingredient already on the list is never listed twice. Two lines are one ingredient when their names agree after the
curation aliases plus a short list of shopper synonyms (scallion / green onion / spring onion, a few plurals):
`canonicalKey` and `LIST_SYNONYMS` in `src/data/shoppingList.js`. Quantities are added only when both sides have a specific
one in a unit whose conversion is exact. What is STORED follows that rule; what is SHOWN also adds metric to US (next section).

Results below were run through `addLine` / `itemAmountText` on 2026-11-16 (the first amount is already on the list, the
second is being added):

| On the list | Adding | Result | Why |
|---|---|---|---|
| (no amount) | 2 cloves | no amount | an existing line without a quantity stays without one |
| 2 cloves | (no amount) | 2 cloves | nothing to add |
| 200 g | 300 g | 500 g | same ladder, summed |
| 500 g | 1 kg | 1 kg 500 g | written in the largest unit that fits whole, the rest in the next |
| 1 cup | 2 tbsp | 1 cup 2 tbsp | US volume ladder (tsp, tbsp, cup) |
| 100 ml | 2 cl | 12 cl | metric volume ladder (ml, cl, l) |
| 1 tbsp | 3 tsp | 2 tbsp | |
| 1 oz | 1 lb | 1 lb 1 oz | US mass ladder (oz, lb) |
| 200 g | 8 oz | stored as 200 g + 8 oz; shown as one part: about 15 oz (US) or about 425 g (metric) | metric and US are never converted in storage, only in the display |
| 250 ml | 1 cup | stored as 250 ml + 1 cup; shown as about 2 cups (US) or about 485 ml (metric) | same |
| 2 cloves | 1 tbsp | 2 cloves + 1 tbsp | a count is never turned into a volume or a weight |
| 2 cloves | 3 cloves | 5 cloves | any other unit (clove, can, bunch, dash) adds only to the same unit |
| 1 can | 2 cans | 3 cans | |
| 3 | 2 | 5 | a bare number is a count with no unit word |
| 1 cup | a pinch | 1 cup | vague amounts never add |
| 2 cups | 1 to 2 cups | 2 cups | a range is not a quantity |
| 2-3 oz | 1 oz | no amount | an existing range or vague amount is no quantity, so the line has none |

Also:

- Vague wording (a range, "a pinch", "to taste", "top with soda") is dropped, not kept as a note: the list is what to buy,
  not the recipe (`parseAmountText` in `src/data/amountGrams.js`, used by `partFromAmount`). An amount the parser cannot read
  at all (for example "1 jar") is dropped the same way.
- A ticked (checked) row does not count as being on the list: adding the same ingredient again makes a new unticked row
  (probe: a ticked "2 cloves" plus a new "3 cloves" gave `x2 cloves` and `-3 cloves`). Unticking a row whose ingredient is on
  the list again folds it into that line (`toggle` in `shoppingList.js`).
- Free text merges only on identical text: "Chili Crisp" and "chili crisp" are one line, "chili crisp (hot)" is another.
  Typed text that matches an ingredient in the app's list is resolved to it (`resolveIngredientName`), so "tomatoes" and
  "tomato" are one.
- The list holds up to 200 items, ticked ones included (`MAX_ITEMS`). At the limit a quantity can still merge, a new row is
  refused with a message (`CAP_MESSAGE`).

## US and metric (SHOP-6)

The list shows amounts in US units by default, with a "US | Metric" switch under the count. The choice is kept on this
device only (localStorage key `fn-shopping-units-v1`); it does not sync with the account. It changes every row, the
Copy list text and the "now ..." wording of the add summaries (`src/data/shoppingUnits.js`, `formatAmount`).

What is stored never changes: a line's parts stay exactly as entered (200 g and 8 oz are two stored parts). Only the
shown total is worked out, a weight with a weight and a volume with a volume, across both systems. A weight is never
turned into a volume; counts (cloves, sprigs, dashes) are untouched; unlike kinds still show as two parts
("2 cloves + 1 tbsp", "200 g + about 235 ml").

Factors: 1 oz = 28.3495 g; 1 lb = 16 oz; 1 US cup = 236.588 ml; 1 tbsp = 14.787 ml; 1 tsp = 4.929 ml; 1 fl oz = 29.574 ml;
cl and l as usual.

"about" appears only when the number on screen is not exact: a line whose parts are all in the system shown is written as
before (no "about"); a line that had to be converted is "about" unless the rounded number equals the true total.

| Shown in | Range | Step |
|---|---|---|
| US weight | under 1 oz | quarters, down to 1/8 oz |
| | 1 to 4 oz | halves |
| | 4 to 16 oz | whole ounces |
| | 16 oz and over | "1 lb 3 oz"; from 3 lb, quarter pounds |
| US volume | under 13 ml | tsp in quarters, down to 1/8 tsp |
| | 13 to 28 ml | tbsp in halves |
| | 28 to 57 ml | fl oz in halves (30 ml reads 1 fl oz) |
| | 57 ml and over | cups in 1/4, 1/3, 1/2, 2/3, 3/4 |
| Metric g, ml | under 20 | 1 |
| | 20 up to 1000 | 5 |
| | 1000 and over | kg or l in steps of 0.05 |

No value rounds to 0, and US text never has more than one fraction or a decimal. Recipe cards elsewhere in the app print
their own amounts and are not changed by this.

## Adding a recipe: two doors, and how they differ (SHOP-7)

| | "Add from a recipe" on the list | "Add to shopping list" on a What do I need? panel |
|---|---|---|
| Code | `src/components/ShoppingRecipeAdd.jsx`, `src/data/shoppingRecipes.js` | `src/components/AddToShoppingList.jsx` |
| Finds the recipe by | name (built-in cocktails, sauces, dishes and the cook's own saved ones) | it is the recipe already open |
| What it offers | every line the cook lacks, in a tick list: "You need" (ticked), for a dish "Flavourings, tap to add" (UNTICKED: the lines the Cookbook split calls flavourings, `recipeMains.mainsOf`), "Basics" (salt, oil, water...; shown after Include basics), "You have" (greyed, unticked). Cocktails and sauces have no flavourings group. | exactly the lines Copy shopping list copies: the missing "You need" lines AND "Even better with" and "Nice to have" (`needs.missing`, `needs.better`, `needs.optional`). The summary says how many were optional ("1 of those is optional."). |
| Already on the list? | asks first: "Add it again?" Cancel adds nothing; adding again adds to the quantities | same |

So for the same dish the two doors do not add the same rows by default, by the owner's two rulings of 2026-11-16 ("Adds optional items. flavourings start unticked."): the panel adds the dish's flavourings, the list's door lists them and leaves them for a tap. One more difference: the panel counts a kitchen swap (onion for scallion) as had, the list's door does not know swaps and lists the line. The flavourings split needs the ingredient table; if it has not loaded there is no split and every missing line is ticked.

Both go through `addTicked` -> `addRecipe` with the same merge rule, and both record the recipe in `list.recipes`, so a row
shows "for Beef Bolognese, Negroni". A recipe counts as already on the list while any unticked row still lists it.
What it fetches: `/proDataset/ingredients.json` when the list opens (about 0.6 MB), and the cocktail codex, sauce file and
dish list when Add from a recipe is first opened; never the pairing data or a model (`ShoppingList.jsx`,
`loadRecipeSources` in `shoppingRecipes.js`).

## Store doesn't have it? (alternatives)

Every unticked row has the button (`src/components/StoreAlternatives.jsx`, logic in `src/data/shoppingAlternatives.js`).
Up to three alternatives, from two sources only, and only on a tap:

1. The hand-written table (`standInsFor` in `src/data/kitchenSwaps.js`; its bar half is `src/data/barStandIns.js`), four kinds of answer: use instead, another form,
   make it, and an honest "nothing really replaces it" (see `docs/stand-ins.md`). The same table feeds the cocktail builder's "Don't have it?", through the same function. A swap that holds only for a supporting item
   (butter -> oil for the pan) is offered when the row came from a dish in which it is not a main, and withheld, with the reason,
   when it is a main or the row has no recipe.
2. For base spirits only: another plain bottle of the same family from `swapCandidates` in `src/data/cocktailRiff.js`
   (bourbon -> scotch, rye whiskey, tennessee whiskey). Never a flavoured bottle, never another family.

Two names for one ingredient (rye and rye whiskey) are one alternative; the fuller name is kept. If the alternative needs a
second ingredient the table names (buttermilk -> milk and lemon), that ingredient is put on the list too, by the same
no-doubling-up rule, unless the cook already has it; Undo takes back what the swap added. "Use what I have" appears on an
alternative the cook owns and takes the row off without changing My kitchen or My bar. No amount is ever invented: a numeric
ratio in the table scales a single-number row; an entry that converts by a note ("1 tsp dried for 1 tbsp fresh") drops the row's number
and carries the note; otherwise the original quantity is kept and the usage sentence becomes the row's note. Coverage and the
kinds are in `docs/stand-ins.md`.

Coverage, measured on 2026-11-16 over the 602 built-in recipes by `npm run measure:standins` (an ingredient line is answered when the sheet
would offer a stand-in or say honestly that nothing replaces it): cocktails 87.1% (69.3% a real stand-in, 17.9% an honest none), sauces 83.6%
(75.1% / 8.5%), dishes 83.8% (72.6% / 11.2%). Garlic and ginger offer forms with amounts, eggs and flour say nothing replaces them and why, simple
syrup, grenadine and half and half say how to make them, a triple sec offers the other orange liqueurs, Campari offers Aperol with what changes,
Chartreuse and maraschino liqueur say nothing replaces them, gin and vodka say nothing replaces them (a base spirit never crosses families). Soda water, club soda,
seltzer and sparkling water are one ingredient on the list (`LIST_SYNONYMS`), so none is offered for another; tonic is not. Butter, olive oil and cream in a
sauce still have almost no answer (BACKLOG, STANDIN-SAUCE-FATS). A row with no entry at all says "No stand-in I'd trust for X."

## Limits, stated

- 200 items; 300 removal notes; removal notes forgotten after 30 days.
- Metric and US amounts are stored side by side and summed only for display. Weight is never turned into volume. An "oz" is always a weight: the amount parser has no "fl oz", so a recipe line such as "2 oz gin" stays a weight and does not add to a volume in ml.
- No prices, no stores, no aisle order per store, no online ordering, no barcode scanning, no list shared between people.
- Signed-in sync is covered by tests with a mocked Firestore and the emulator rules; it has not been tried on a real account.

## What is counted about it

Three usage events, only after the analytics Yes, counts and labels only (`shop_opened`, `shop_recipe_added`,
`shop_alternative_used`): see `docs/usage-data.md`.
