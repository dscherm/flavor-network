# Invent: size and variety (WEAK-5)

## Checks, written before changing anything

Measured by `node scripts/measureInvent.mjs` (it reuses the setup of
`scripts/measureEverydayPairs.mjs`: the real set-completion model through
onnxruntime-node, the blended pairing index, the shipped sauce catalogue).
Recipe kitchens, no cuisine, the same 5 seeded shuffles of the kitchen order:

- chicken, garlic, lemon, rice, onion, tomato
- pasta, tomato, basil, parmesan, garlic, olive oil
- beef, onion, potato, carrot, thyme

Sauce pantry: butter, egg yolk, lemon, shallot, white wine, cream, tomato,
garlic, over all 10 techniques, the same 5 shuffles.

| # | Check | Pass |
|---|---|---|
| (a) | Recipe mean size (ingredients listed, "you'd need" included; salt, pepper and oil are not listed) | within 5–8 for each kitchen |
| (b) | Distinct dishes over 5 shuffles: one session in the panel, the first page of 3 and then 5 presses of Shuffle (18 slots) | ≥ 10 for each kitchen, or the exhausted message shown, saying which |
| (c) | The chosen main is in the dish: every pantry item picked as the main, all its dishes. And with "any" main (where the beef-less beef dish came from): dishes with a centre (a protein or legume, a starch, or a non-aromatic vegetable) | 100% and 100%; the share with a protein is reported |
| (d) | No assumed basic (salt, pepper, oils, butter, flour, sugar, water) in the top "why" pair, recipes and sauces | 0 dishes |
| (e) | Sauce mean size, all 10 techniques | ≥ 5, with `inventSauce.test.js` (the chemistry rules) still passing |
| (f) | By eye: 10 invented recipes and 10 sauces, each "would a cook make this?" yes/no | reported as a table; no target set |

(b) is measured as the panel uses it. The old measure (5 runs of the
invent function, 12 dishes each, distinct sets across the runs) is also
reported, for comparison with `docs/everyday-pairs.md`.

## What changed

**Invent a recipe** (`src/data/inventRecipe.js`):
- *More material.* Each seed (the chosen main, or up to five likely
  centres) is grown four ways (1st–4th best first partner), up to 8
  ingredients. The model's fit gate is now logit −3.5 (it was −2.5). Next
  to beef, onion and potato, carrot scored −3.2, so the beef stew never
  formed. Every grown dish gives its last four prefixes, each alone and
  with one or two common outside ingredients (5 tried per prefix, up to 2
  bought). Model calls are memoised: 89–149 per run, 80–125 ms in node.
- *Score* = coherence + size + role balance + fit − buying + kitchen use.
  Coherence leaves basics out and is ¼ mean pair strength + ¾ each
  ingredient's best partner, so a bigger dish is not punished for having
  more pairs. Size is flat at its top for 5–8. Roles: a main (protein,
  legume or the chosen main), a vegetable, a starch (half weight unless
  the cuisine expects one), an aromatic, an acid or richness, a herb or
  spice. Buying costs 0.05 per item while it fills a dish to 5, 0.09
  beyond, so kitchen-only dishes lead.
- *Hard rules.* The chosen main is in every dish. A savoury dish needs a
  centre. If the kitchen has a protein, legume or starch, every dish is
  built on one of them (a pasta kitchen's ideas are pasta dishes). A thin
  dish (under 5) that is a subset of a better one is dropped.
- *Variety.* `src/data/inventVariety.js`: maximal marginal relevance
  (λ 0.6, Jaccard on ingredients) over the whole pool. The panel keeps the
  ideas shown this session and never repeats one. When the pool is done it
  says "That's every idea for this kitchen; add an ingredient for more",
  with Start over. "N of M ideas" sits by Shuffle.
- *Names* are given in session order and kept unique: the lead (a protein,
  else a vegetable or starch) with a different second ingredient, then
  "… with X". Aromatics and plain liquids go last.
- *Why* cites the two strongest non-basic pairs. Two aromatics together
  (onion + garlic) are cited only when nothing else pairs, and the second
  pair names two other ingredients when one does.

**Invent a sauce** (`src/data/inventSauce.js`):
- Basics (butter, oils, flour, sugar, water, pepper) fill their slots but
  never count toward coherence or the "why".
- A pair strength counts up to 0.5 ("a real pairing"), so one very strong
  pair (tomato + garlic, 1.33) cannot beat a fuller sauce.
- A size term peaks at 5–7. An optional ingredient that pairs with nothing
  else in the sauce costs 0.08.
- Tomato and Salsa gained an optional second aromatic (onion and garlic
  both).
- The chemistry slots are unchanged.
- Sauces are shown in MMR order with unique names, thin subsets are
  dropped, and the pantry gets the same exhausted message.

## Results

Same kitchens, no cuisine, 5 seeded shuffles. Raw output:
`node scripts/measureInvent.mjs --json --samples`.

| Check | Kitchen | Before | After | Pass |
|---|---|---|---|---|
| (a) mean size | chicken | 4.43 | 5.67 (5.72 over the 18 shown) | yes |
| | pasta | 5.00 | 5.67 (5.89) | yes |
| | beef | 4.00 | 5.08 (5.22) | yes |
| (b) distinct dishes, first page + 5 Shuffles | chicken | 5–6 | 18 of 18 (pool 71) | yes |
| | pasta | 1 | 18 of 18 (pool 29) | yes |
| | beef | 3 | 18 of 18 (pool 65) | yes |
| | old measure (5 runs × 12) | 6 / 1 / 3 | 12 / 12 / 12 (the runs now agree: kitchen order no longer matters) | |
| (c) chosen main in its dishes | all three | 100% (20 dishes) | 100% (471 dishes) | yes |
| any main: dishes with a centre | chicken / pasta / beef | 20/28, 5/5, 10/15 | 60/60, 60/60, 60/60 | yes |
| any main: dishes with a protein | chicken / pasta / beef | 10/28, 0/5, 10/15 | 60/60, 15/60, 55/60 | (reported) |
| (d) basic in the top "why" pair | recipes | 0 / 48 | 0 / 180 | yes |
| | sauces | 330 / 545 (olive oil + garlic ×160) | 0 / 345 | yes |
| (e) sauce mean size | 10 techniques | 4.41 | 5.97 | yes; `inventSauce.test.js` 22/22 |

None of the three kitchens runs out within 5 Shuffles. A two-item kitchen
(egg, spinach) does: 11 ideas, then the exhausted message. Sauces run out
much sooner, and honestly. With this pantry a Béchamel has 3 ideas, a
Tomato sauce 2 and a Salsa 1 (tomato, garlic, shallot, lemon). Before, the
panel cycled through near-copies.

Per technique, after (before): Béchamel 4 (3.67), Velouté 7 (6), Espagnole 6
(5.42), Hollandaise 5 (4.17), Tomato 5 (3.5), Curry 6 (4.58), Stir-fry 5.45
(3.42), Mole 7 (6.08), Salsa 4 (2.5), Nut sauce 5 (3.33). Béchamel and
Salsa stay under 5 because nothing else in the pantry fits their slots,
and optional slots never send the cook shopping.

### (f) By eye: would a cook make this?

Recipes, the first ideas of a session (no cuisine):

| # | Kitchen | Idea | Ingredients (* = to buy) | Cook would make it? |
|---|---|---|---|---|
| 1 | chicken | Chicken & Tomato Rice | rice, tomato, onion, garlic, chicken | yes |
| 2 | chicken | Chicken & Lemon Rice | rice, tomato, onion, garlic, chicken, lemon | yes |
| 3 | chicken | Chicken & Tomato Skillet | chicken, onion, tomato, garlic, basil* | yes |
| 4 | chicken | Chicken & Parmesan Skillet | chicken, onion, tomato, garlic, parmesan* | yes |
| 5 | pasta | Tomato & Basil Pasta | tomato, parmesan, basil, pasta, garlic | yes |
| 6 | pasta | Tomato & Parmesan Pasta | tomato, parmesan, basil, pasta, onion* | yes, but it buys an onion and leaves out the garlic you have |
| 7 | pasta | Tomato & Basil Pasta with Parmesan | tomato, parmesan, basil, pasta, garlic, onion* | yes |
| 8 | pasta | Egg & Tomato Pasta | tomato, parmesan, basil, pasta, garlic, egg* | no: an egg on a tomato-basil pasta is a stretch |
| 9 | beef | Beef & Potato Skillet | beef, onion, potato, thyme, carrot | yes (a stew, though it is called a skillet) |
| 10 | beef | Beef & Tomato Skillet | beef, onion, potato, thyme, tomato* | yes |

9 of 10 yes. Before, the first ideas included:
- a "Tomato & Parmesan Skillet" in the chicken kitchen, with no chicken
- one pasta dish, five times
- "Thyme & Oregano Skillet" (onion, thyme, parmesan*, oregano*) in the beef kitchen
- "Beef & Cream Of Mushroom Soup Skillet"

Sauces, the first idea per technique:

| # | Technique | Sauce | Ingredients (* = to buy) | Cook would make it? |
|---|---|---|---|---|
| 1 | Roux & milk | Shallot Béchamel | butter, flour, cream, shallot | yes |
| 2 | Roux & stock | Fish Stock & White Wine Velouté | butter, flour, fish stock*, white wine, shallot, cream, lemon | yes (a sauce vin blanc) |
| 3 | Brown reduction | Garlic & White Wine Brown Sauce | butter, flour, chicken stock*, garlic, white wine, tomato | yes |
| 4 | Emulsion | Lemon & Garlic Butter Sauce | butter, egg yolk, lemon, garlic, black pepper | yes |
| 5 | Tomato simmer | Garlic Tomato Sauce | butter, tomato, garlic, shallot, white wine | yes |
| 6 | Curry base | Garlic & Paprika Curry | butter, garlic, paprika*, shallot, cream, lemon | no: a paprika cream sauce, not a curry (the bought spice should be cumin or coriander) |
| 7 | Stir-fry | Fish Sauce & Garlic Stir-fry Sauce | fish sauce*, garlic, shallot, sugar, lemon, vegetable oil | yes |
| 8 | Mole | Ancho Chili & Chocolate Mole | butter, ancho chili*, cumin*, chocolate*, sugar, garlic, tomato | yes |
| 9 | Salsa | Tomato & Garlic Salsa | tomato, garlic, shallot, lemon | yes (no chili or herb in the pantry) |
| 10 | Nut sauce | Tahini & Lemon Nut Sauce | tahini*, lemon, garlic, sugar, water | yes (a tarator) |

9 of 10 yes. Before:
- Béchamel = butter, flour, cream
- Tomato = olive oil, tomato, garlic
- Stir-fry = soy sauce*, garlic
- Salsa = tomato, garlic
- Nut sauce = tahini*, garlic

### Browser, 375 px

Vite on port 5197, Chrome through playwright-core, a fresh context for
each run. No page errors in any of them.
- Chicken kitchen (the cuisine defaulted to Italian), 5 Shuffles: 18
  distinct names, and the counter read "18 of 98 ideas".
- Main = lemon: every card has lemon.
- Egg + spinach: reached the exhausted message, with Start over.
- Sauce pantry: the tomato sauce, then the exhausted message after one
  Shuffle, then the curry with "3 of 15 sauces".

## Weak spots left

- Names say "Skillet" for what is a stew or braise (beef, potato, carrot,
  thyme). `dishTypeOf` has no stew rule from ingredients alone.
- In the chicken kitchen the "why" lines still lean on onion and tomato,
  the strongest non-aromatic pair there.
- The curry base can buy paprika as its only spice (the kind rules allow it).
- Tiny kitchens make thin, odd dishes. Egg + spinach with the Indian
  cuisine default gave "Egg & Creole Seasoning Curry with Romano Cheese":
  3 ingredients, 2 of them bought.
- Some sauces differ only by the basic fat (a butter or an olive oil tomato
  sauce). MMR shows the second one last, but it still counts as its own idea.
- Amounts like "3.6 each" chicken belong to WEAK-4 and are not changed here.
