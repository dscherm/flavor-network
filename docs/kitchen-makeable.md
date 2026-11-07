# "Makeable" that matches how people cook (WEAK-3)

## Checks, written before changing anything (2026-11-07)

Measured by `node scripts/measureKitchenMakeable.mjs` over the 83 Cookbook
recipes (`seedRecipes.js`), with ingredient categories from
`public/proDataset/ingredients.json` (the same `category` the app's graph
nodes carry), assume-basics on, spice rack off unless stated.

Kitchens:
- **K30**: chicken, garlic, lemon, rice, onion, tomato, pasta, parmesan,
  basil, egg, potato, carrot, beef, milk, cheddar, bell pepper, cumin,
  paprika, soy sauce, ginger, cilantro, lime, black beans, tortilla, bread,
  cream, mushroom, spinach, chili, honey.
- **K6**: chicken, garlic, lemon, rice, onion, tomato.
- **K5** (third kitchen, from WEAK-A): beef, onion, potato, carrot, thyme.

- **(a) K30.** "You can make" goes from 0 to a predicted **6** (range 4–9).
  Every listed recipe has all its mains covered, directly or by a swap in the
  table. Checked mechanically by the script (re-derives each recipe's mains
  and checks each against the kitchen + swap table).
- **(b) K6.** Predicted **0** makeable before and after (the Cookbook has no
  dish of only chicken / rice / tomato / onion plus flavourings), but "one
  away" should grow. Same mechanical check. K5: predicted 0 → 0.
- **(c)** A by-eye review of 10 newly makeable recipes (K30, plus K30 with
  the spice rack and wider kitchens if K30 gives fewer than 10), each a
  yes/no on "a cook would agree this is makeable from that kitchen".
- **(d)** No swap crosses roles: a unit test over the whole swap table
  asserts both sides have the same sauce role (`sauceRoleOf`) and the same
  main/supporting class, and that the table never contradicts the Sauce
  Lab's stand-in rule.

Spice rack: it only touches supporting items, so it should not change the
makeable count (except for a spice that a recipe override makes main); it
should shrink the "even better with" lists. Predicted K30 + spice rack: the
same count as K30.

## What was built

- `src/data/recipeMains.js`: main vs supporting, from the ingredient
  graph's `category`. Mains: protein, vegetable, grain, dairy, fruit, baked,
  confection, liquid (stock, coconut milk, espresso; not wine). Everything
  else supports. In order: a per-recipe list of flavourings that are the dish
  (25 recipes, e.g. basil in pesto, curry paste in Thai green curry, red wine
  in coq au vin, peanut + chili in kung pao, garam masala in chana masala),
  then any ingredient the recipe's name names ("Garlic Naan", "Butter
  Chicken"), then a per-ingredient list (onions main, parmesan/pecorino main,
  panko/croutons supporting), then bakes and desserts (sugar, butter, yeast,
  gelatin, nuts become mains), then the category. With no graph loaded, the
  name-based `getGeneralRole` guess stands in.
- **Garlic and onion.** Onion is a **main**: it goes in by the cupful as the
  body of a curry, ragù or soup, and the swap table lets shallot, leek or red
  onion stand in. Garlic is **supporting**: it goes in by the clove and
  seasons rather than bulks. Where garlic is the dish, the name says so and
  the name rule makes it main (Garlic Naan, Garlic Bok Choy).
- `src/data/kitchenSwaps.js`: 65 directed swaps (onion for scallion, shallot,
  leek; parsley ↔ cilantro; lime ↔ lemon; stock for white wine; yogurt ↔ sour
  cream; sour cream / cream for crème fraîche; milk + butter for cream; milk +
  lemon or yogurt for buttermilk; parmesan ↔ pecorino; cheddar ↔ jack; feta ↔
  cotija; butter ↔ oil only where the fat is supporting; honey ↔ sugar /
  maple; vinegars; fresh chilies; pasta shapes; bread for baguette; tortillas).
  Each entry carries a role (the graph category, the same on both sides) and a
  kind. `sauce: false` marks swaps that fail in a sauce; a test checks that
  this never contradicts the Sauce Lab's `sameRoleAndKind`. The Sauce Lab's
  stand-ins are unchanged.
- `myKitchen.js`: the spice rack (`fn-my-kitchen-spices`, default off: cumin,
  paprika, cinnamon, chili flakes, oregano, thyme, black pepper, nutmeg, bay
  leaf, coriander, turmeric, garam masala, curry powder, cayenne, garlic
  powder, onion powder, plus their spellings: ground cumin, red pepper flakes
  …). `coverIngredients` gains a `mainOf` split mode (a missing supporting
  item goes to `better`) and a `swaps` mode. `whatCanICook` gains
  `mainOfItem` and marks `withSwap`. Two kitchen-name fixes found while
  measuring: "bell pepper" was stored as `pepper` (the black-pepper spice
  node) and "vegetable oil" as `vegetable`. They are now `sweet pepper` and
  `vegetable oil`, and a plain `tortilla` covers a corn or flour tortilla.
- UI: the Recipe Lab kitchen panel gets a Spice rack switch under Assume basics. Its "You
  can make" rows read "you have the 3 mains", then "with a swap: your milk and
  lemon for the buttermilk", then "even better with: vanilla". The Cookbook
  card's What do I need? shows "You need" (mains only), "⇄ Use your shallot
  for the onion", "Even better with: …", and the summary "You can make it ✓
  — with a swap". The shopping list gets an "Even better with" section. The
  Sauce Lab pantry gets a Spice rack checkbox. It stays strict: no split,
  no table swaps. Sauce-card What do I need? reads the spice rack.
- Sauce "nearly" ranking: not changed. In a sauce nearly every line is a
  flavouring by category (shallot, wine, herbs, mustard), so the split does
  not separate anything useful.
- `saucePantry.sauceRoleOf`: a vinegar is now an Acid before the Liquid rule
  runs. "Apple cider vinegar" was matching "cider", which made it a wine-kind
  liquid that could stand in for white wine.

## Results (`node scripts/measureKitchenMakeable.mjs`)

| kitchen | before: make / nearly | after: make (with a swap) / one-or-two mains away | prediction | every main covered? |
|---|---|---|---|---|
| K30 | 0 / 21 | **6** (3) / 51 | 6 (4–9) ✓ | yes (mechanical re-check) |
| K30 + spice rack | 0 / 21 | 6 (3) / 51 | same as K30 ✓ | yes |
| K6 | 0 / 1 | **0** / 20 | 0 ✓ | — |
| K5 | 0 / 0 | 0 / 10 | 0 ✓ | — |
| K40 (review only) | 0 / 29 | 14 (5) / 54 | — | yes |

"Before" is the old rule run on the same stored kitchen. (The brief's 20
"nearly" was measured with "bell pepper" stored as `pepper`; it is 21 with
the alias fix.) The spice rack does not change the K30 count, as predicted.
It cuts the "even better with" items on those 6 recipes from 10 to 6.

The first run, before the by-eye review, gave K30 7 and K6 1: Kung Pao
Chicken was "makeable" from chicken + garlic + onion (onion for scallion)
because chicken was its only main. That is wrong: kung pao is chilies and
peanuts. Peanut and chili were added to its per-recipe list, and soy sauce to
bulgogi's (one main, beef + pear, otherwise).

### (c) By-eye review: 15 newly makeable recipes (K30, then K40)

| # | recipe | from | mains / swap | even better with | a cook would agree? |
|---|---|---|---|---|---|
| 1 | Crème Brûlée | K30 | cream, egg (yolks), sugar | vanilla | yes: a plain custard brûlée |
| 2 | Butter Chicken | K30 | chicken, butter, tomato, cream | garam masala, fenugreek | yes, borderline: thin without garam masala; the spice rack covers it |
| 3 | Patatas Bravas | K30 | potato, tomato (+ paprika on hand) | mayonnaise, cayenne | yes |
| 4 | Buttermilk Pancakes | K30 | flour, egg, butter, sugar; milk + lemon for buttermilk; honey for maple syrup | vanilla | yes |
| 5 | Buttermilk Fried Chicken | K30 | chicken, flour; milk + lemon for buttermilk | cayenne | yes |
| 6 | Mac and Cheese | K30 | cheddar, milk, flour; pasta for macaroni | mustard, nutmeg, panko | yes |
| 7 | Beef Bolognese | K40 | beef, tomato, onion, carrot, celery, pasta | red wine | yes |
| 8 | Gazpacho | K40 | tomato, cucumber, sweet pepper, onion, bread | sherry vinegar | yes |
| 9 | Chicken Tikka | K40 | chicken, tomato, yogurt, cream | garam masala | yes, borderline (as 2) |
| 10 | Chana Masala | K40 | chickpea, onion, tomato | garam masala | **no**: the masala is the dish. Fixed: garam masala is now a main of chana masala, so it is makeable only with the spice rack or a jar |
| 11 | Chicken Shawarma | K40 | chicken, yogurt, pita | allspice | yes |
| 12 | Chicken Enchiladas | K40 | corn tortilla (your tortilla), chicken, onion, cheddar, sour cream | chili powder, tomato sauce | yes: the sauce comes from your tomatoes and chili |
| 13 | Falafel | K40 | chickpea, onion, pita (+ cilantro) | parsley, tahini | yes |
| 14 | Spaghetti Carbonara | K40 | pasta, egg, bacon; parmesan for pecorino | — | yes |
| 15 | Greek Salad | K40 | tomato, cucumber, feta; onion for red onion | olives, oregano | yes |

Of the first 10, 9 are yes and 1 is no (Chana Masala, now fixed). Two of
the yeses are borderline. Kung Pao, caught on the first run, is counted
above, not here.

### (d) No swap crosses roles

`src/data/__tests__/kitchenSwaps.test.js` runs over the whole table:
- both sides have the declared ingredient-graph category;
- the Sauce Lab role agrees wherever it knows both sides;
- a swap marked "not in a sauce" is never one the Sauce Lab rule allows;
- butter ↔ oil swaps apply only where the fat is supporting;
- garlic ↔ onion, flour for egg yolk and stock for red wine are absent.

The test passes. Main/supporting class is not required to match, because
it depends on the recipe: onion is a main and scallion a garnish, yet onion
for scallion is the standard swap.

### Swap sanity check against the everyday pairs (weak)

Measure: Jaccard overlap of each side's top-30 partners in the blended
index. The 65 swaps average **0.20** (median 0.20). Eight deliberate
non-swaps average **0.12**. That is a separation, but a weak one: garlic for
onion scores 0.46, higher than any real swap, and carrot for scallion 0.30.
Partner overlap measures "cooked in the same dishes", not "can replace".
Butter ↔ oil (0.07) and sugar ↔ brown sugar (0.03) score low because their
everyday partners split between baking and savoury. The table stays
hand-written and role-checked. The pairs index is not a good test of
substitution.
