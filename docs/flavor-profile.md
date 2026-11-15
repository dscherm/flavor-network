# Flavor profiles: what the chart is, what is wrong with it, and how we measure it

This page is for the site owner. It records what the flavor chart is, a problem found on 2026-11-15, the test we built to measure it, and the score today's charts get. The score below is the baseline: every later fix is judged by whether it beats these numbers.

## What the chart is

Wherever the app shows a bar chart of "flavor" for a cocktail, sauce or dish, the bars are the recipe's 11 flavor axes: five tastes (sweet, sour, bitter, salty, umami) and six aromas (fruity, floral, green, woody, spicy, fatty). It appears on the Recipe Notebook's Flavor Profiles card, in the three Invent panels, on the shared-recipe page, and on the share-card images and link previews.

Each ingredient has a row of 11 numbers in the file `public/proDataset/gnn_entropy.json` (3,432 ingredients). The chart averages those rows over the recipe's ingredients, so every ingredient counts equally. A dash of bitters weighs the same as two ounces of gin.

## What was found on 2026-11-15

I re-counted this with a few lines of Node over that file. My numbers match the ones the task started from.

- 1,526 of 3,432 ingredients (44%) carry exactly the same five taste numbers: sweet 0.61, sour 0.62, bitter 0.58, salty 0.15, umami 0.14. Sugar, salt, coffee, gin and lemon are all in that group, so the data cannot tell them apart.
- 2,063 ingredients (60%) carry exactly the same six aroma numbers (fruity 0.03, floral 0.00, green 0.05, woody 0.10, spicy 0.10, fatty 0.01).
- The next two most common taste rows cover another 261 and 249 ingredients (all with sour 0.62).
- A chart built from these ingredients is mostly drawn from that one constant row, which is why sour tops the chart for so many cocktails, and why a Negroni charts sweet, then sour, then bitter.

Why the identical rows exist was not traced. The look of it is a default filled in where the model had nothing to say.

## The test set

`data/flavor-truth.json` lists 41 well-known items that exist in the app's built-in data: 20 cocktails, 9 sauces and 12 dishes. For each one it says which tastes a cook would expect to lead (strongest first), which tastes must not lead, and for four items which aroma should be near the top.

Who wrote it, and its limits:

- The answer key was written by the assistant on 2026-11-15 from common culinary knowledge. It was written before the charts were looked at, and was not checked by anyone else. You can correct any line.
- "heat" (chili or pepper heat) is a taste a cook expects but the chart has no axis for. Items such as Thai green curry that expect heat first therefore score as misses today. That is intended: it shows what the chart cannot say.
- It is 41 items, so one item moves a percentage by about 2 points. Treat differences of a few points as noise.
- The scorer asks only about the top of the chart (what leads), not whether every bar is right.

## How to re-run

```
npm run measure:flavor            # the table and overall line
npm run measure:flavor -- --json  # the same, for machines
```

It reads only files in the repository and makes no network call. It stops with an error if the key is malformed or an item is not a real built-in recipe.

The scoring terms:

- top taste expected: the highest of the five taste bars is one of the expected tastes.
- top two both expected: the two highest taste bars are both expected (only asked of items that expect two or more tastes).
- forbidden taste leads: the highest taste bar is one that item must not lead with.
- counted: the share of the item's ingredients that had a row of numbers. Note that the constant rows above count as having data today.

## Baseline (2026-11-15, charts as the app draws them today)

Exactly as printed by `npm run measure:flavor`:

```
cocktail/negroni            expect bitter/sweet not sour  |  sweet 0.72, sour 0.62, bitter 0.46  |  counted 67%  |  top1, not-top2
cocktail/daiquiri           expect sour/sweet not bitter  |  sour 0.64, bitter 0.55, sweet 0.53  |  counted 100%  |  top1, not-top2
cocktail/margarita          expect sour/salty/sweet not bitter  |  sour 0.68, sweet 0.42, bitter 0.40  |  counted 75%  |  top1, top2
cocktail/old-fashioned      expect sweet/bitter not sour  |  sour 0.62, bitter 0.51, sweet 0.46  |  counted 100%  |  miss, not-top2, FORBIDDEN LEADS
cocktail/manhattan          expect sweet/bitter not sour  |  sour 0.54, sweet 0.46, bitter 0.37  |  counted 83%  |  miss, not-top2, FORBIDDEN LEADS
cocktail/whiskey-sour       expect sour/sweet  |  sour 0.62, bitter 0.49, sweet 0.42  |  counted 100%  |  top1, not-top2
cocktail/mojito             expect sour/sweet not bitter  |  sour 0.52, sweet 0.49, bitter 0.45  |  counted 100%  |  top1, top2, aroma miss
cocktail/americano          expect bitter/sweet not sour  |  sweet 0.84, sour 0.62, bitter 0.34  |  counted 33%  |  top1, not-top2
cocktail/aperol-spritz      expect bitter/sweet not sour  |  sour 0.33, sweet 0.22, bitter 0.15  |  counted 33%  |  miss, not-top2, FORBIDDEN LEADS
cocktail/paloma             expect sour/bitter/sweet  |  sour 0.65, sweet 0.55, bitter 0.41  |  counted 67%  |  top1, top2
cocktail/gimlet             expect sour/sweet not bitter  |  sour 0.65, sweet 0.52, bitter 0.47  |  counted 100%  |  top1, top2
cocktail/sidecar            expect sour/sweet not bitter  |  sour 0.46, sweet 0.35, bitter 0.26  |  counted 100%  |  top1, top2
cocktail/boulevardier       expect bitter/sweet not sour  |  sour 0.62, sweet 0.49, bitter 0.21  |  counted 67%  |  miss, not-top2, FORBIDDEN LEADS
cocktail/pina-colada        expect sweet not sour/bitter  |  bitter 0.66, sour 0.62, sweet 0.57  |  counted 100%  |  miss, FORBIDDEN LEADS, aroma miss
cocktail/tom-collins        expect sour/sweet not bitter  |  sour 0.54, sweet 0.53, bitter 0.47  |  counted 83%  |  top1, top2
cocktail/bloody-mary        expect umami/salty/heat not sweet  |  bitter 0.55, sweet 0.54, sour 0.51  |  counted 100%  |  miss, not-top2
cocktail/pisco-sour         expect sour/sweet not bitter  |  sour 0.64, bitter 0.55, sweet 0.53  |  counted 60%  |  top1, not-top2
cocktail/white-russian      expect sweet not sour/salty  |  sweet 0.72, sour 0.62, bitter 0.46  |  counted 67%  |  top1
cocktail/cosmopolitan       expect sour/sweet not bitter/salty  |  sweet 0.63, sour 0.58, bitter 0.33  |  counted 75%  |  top1, top2
cocktail/tequila-sunrise    expect sweet not bitter/salty  |  sour 0.72, sweet 0.39, umami 0.33  |  counted 50%  |  miss
sauce/hollandaise           expect sour/salty not sweet/bitter  |  bitter 0.53, sour 0.52, sweet 0.51  |  counted 100%  |  miss, not-top2, FORBIDDEN LEADS
sauce/teriyaki              expect sweet/salty/umami not sour/bitter  |  bitter 0.60, sweet 0.57, sour 0.56  |  counted 86%  |  miss, not-top2, FORBIDDEN LEADS
sauce/ponzu                 expect sour/salty/umami not sweet  |  sour 0.55, bitter 0.50, sweet 0.42  |  counted 50%  |  top1, not-top2
sauce/nuoc-cham             expect sour/salty/sweet not bitter  |  sour 0.63, bitter 0.60, sweet 0.53  |  counted 100%  |  top1, not-top2
sauce/sweet-and-sour-sauce  expect sweet/sour not bitter/salty  |  sour 0.62, bitter 0.61, sweet 0.60  |  counted 100%  |  top1, not-top2
sauce/salsa-verde           expect sour/heat not sweet  |  sour 0.47, sweet 0.43, bitter 0.35  |  counted 71%  |  top1, not-top2, aroma miss
sauce/buffalo-sauce         expect heat/sour/salty not sweet  |  sweet 0.56, bitter 0.53, sour 0.52  |  counted 100%  |  miss, not-top2, FORBIDDEN LEADS
sauce/marinara              expect umami/sour not bitter  |  bitter 0.56, sweet 0.43, sour 0.43  |  counted 100%  |  miss, not-top2, FORBIDDEN LEADS
sauce/black-bean-sauce      expect salty/umami not sweet/sour  |  sweet 0.57, sour 0.54, bitter 0.54  |  counted 89%  |  miss, not-top2, FORBIDDEN LEADS
dish/beef-bolognese         expect umami not sweet  |  sweet 0.47, sour 0.42, bitter 0.40  |  counted 100%  |  miss, FORBIDDEN LEADS
dish/margherita-pizza       expect umami/salty not sweet  |  sweet 0.43, bitter 0.40, sour 0.30  |  counted 86%  |  miss, not-top2, FORBIDDEN LEADS
dish/caesar-salad           expect salty/umami not sweet  |  bitter 0.44, sour 0.42, sweet 0.38  |  counted 100%  |  miss, not-top2
dish/thai-green-curry       expect heat not sweet  |  sour 0.61, bitter 0.53, sweet 0.49  |  counted 100%  |  miss
dish/tom-yum                expect sour/heat not sweet  |  sour 0.50, bitter 0.47, sweet 0.45  |  counted 75%  |  top1, not-top2
dish/creme-brulee           expect sweet not salty/umami/sour  |  bitter 0.56, sweet 0.49, sour 0.37  |  counted 100%  |  miss
dish/tiramisu               expect sweet/bitter not salty/umami  |  bitter 0.56, sour 0.51, sweet 0.45  |  counted 33%  |  top1, not-top2
dish/apple-pie              expect sweet not salty/umami  |  sweet 0.61, bitter 0.56, sour 0.56  |  counted 100%  |  top1
dish/miso-soup              expect umami/salty not sweet  |  bitter 0.81, sour 0.62, sweet 0.45  |  counted 60%  |  miss, not-top2
dish/greek-salad            expect salty/sour not sweet  |  bitter 0.46, sour 0.44, sweet 0.40  |  counted 100%  |  miss, not-top2
dish/mapo-tofu              expect heat/umami/salty not sweet  |  sour 0.66, bitter 0.59, sweet 0.46  |  counted 75%  |  miss, not-top2
dish/pesto-genovese         expect salty/umami not sweet  |  bitter 0.49, sweet 0.44, sour 0.42  |  counted 100%  |  miss, not-top2, aroma miss

Items 41. Top taste expected: 20/41 (48.8%). Top two both expected: 7/34 items with 2+ expected (20.6%). Forbidden taste leads: 12. No chart: 0. Ingredients counted: 82.6%. Aroma as expected: 0/4 (0%).
```

Headline: the top taste is an expected one for 20 of 41 items (48.8%); the top two are both expected for 7 of 34 (20.6%); a forbidden taste leads on 12 items; no item lacks a chart; 82.6% of ingredients were counted; the aroma check passes on 0 of 4.

By name: the Negroni (expected bitter and sweet, sour must not lead) charts sweet 0.72, sour 0.62, bitter 0.46. Its top bar is expected, but bitter, the defining taste, is last of the three, and sour is second. The Daiquiri (expected sour and sweet, bitter must not lead) charts sour 0.64, bitter 0.55, sweet 0.53, so bitter beats sweet. Old Fashioned, Manhattan, Boulevardier, Aperol Spritz and Piña Colada all have a forbidden taste on top.

## After FLAVOR-2 (2026-11-15, placeholder values no longer drawn)

What changed: an ingredient whose taste numbers are one of the repeated placeholder rows no longer counts toward the taste half of a chart, and one whose aroma numbers are the repeated placeholder row no longer counts toward the aroma half. Taste and aroma are judged separately. A half is drawn only when at least two of the recipe's ingredients, and at least half of them, have real values for it. When neither half draws, the chart is replaced by the line "Not enough flavor data for a chart yet." Which rows count as placeholders is worked out by value from the data file when the site is built (`src/data/flavorPlaceholders.json`): any exact taste row or aroma row shared by more than 150 ingredients. That is the three taste rows (1,526, 261 and 249 ingredients) and the one aroma row (2,062 ingredients).

Exactly as printed by `npm run measure:flavor`:

```
cocktail/negroni            expect bitter/sweet not sour  |  (none)  |  counted 33%  |  NO CHART
cocktail/daiquiri           expect sour/sweet not bitter  |  (none)  |  counted 33%  |  NO CHART
cocktail/margarita          expect sour/salty/sweet not bitter  |  sour 0.72, sweet 0.39, umami 0.33  |  counted 50%  |  top1, top2
cocktail/old-fashioned      expect sweet/bitter not sour  |  sour 0.61, bitter 0.45, sweet 0.32  |  counted 50%  |  miss, not-top2, FORBIDDEN LEADS
cocktail/manhattan          expect sweet/bitter not sour  |  sour 0.54, sweet 0.46, bitter 0.37  |  counted 83%  |  miss, not-top2, FORBIDDEN LEADS
cocktail/whiskey-sour       expect sour/sweet  |  (none)  |  counted 33%  |  NO CHART
cocktail/mojito             expect sour/sweet not bitter  |  (none)  |  counted 40%  |  NO CHART
cocktail/americano          expect bitter/sweet not sour  |  (none)  |  counted 33%  |  NO CHART
cocktail/aperol-spritz      expect bitter/sweet not sour  |  (none)  |  counted 33%  |  NO CHART
cocktail/paloma             expect sour/bitter/sweet  |  (none)  |  counted 33%  |  NO CHART
cocktail/gimlet             expect sour/sweet not bitter  |  sour 0.67, umami 0.55, sweet 0.50  |  counted 50%  |  top1, not-top2
cocktail/sidecar            expect sour/sweet not bitter  |  sour 0.39, sweet 0.22, bitter 0.09  |  counted 67%  |  top1, top2
cocktail/boulevardier       expect bitter/sweet not sour  |  sour 0.62, sweet 0.49, bitter 0.21  |  counted 67%  |  miss, not-top2, FORBIDDEN LEADS
cocktail/pina-colada        expect sweet not sour/bitter  |  (none)  |  counted 0%  |  NO CHART
cocktail/tom-collins        expect sour/sweet not bitter  |  (none)  |  counted 33%  |  NO CHART
cocktail/bloody-mary        expect umami/salty/heat not sweet  |  (none)  |  counted 43%  |  NO CHART
cocktail/pisco-sour         expect sour/sweet not bitter  |  (none)  |  counted 20%  |  NO CHART
cocktail/white-russian      expect sweet not sour/salty  |  (none)  |  counted 33%  |  NO CHART
cocktail/cosmopolitan       expect sour/sweet not bitter/salty  |  sweet 0.63, sour 0.58, bitter 0.33  |  counted 75%  |  top1, top2
cocktail/tequila-sunrise    expect sweet not bitter/salty  |  sour 0.72, sweet 0.39, umami 0.33  |  counted 50%  |  miss
sauce/hollandaise           expect sour/salty not sweet/bitter  |  (none)  |  counted 17%  |  NO CHART
sauce/teriyaki              expect sweet/salty/umami not sour/bitter  |  (none)  |  counted 14%  |  NO CHART
sauce/ponzu                 expect sour/salty/umami not sweet  |  (none)  |  counted 17%  |  NO CHART
sauce/nuoc-cham             expect sour/salty/sweet not bitter  |  (none)  |  counted 17%  |  NO CHART
sauce/sweet-and-sour-sauce  expect sweet/sour not bitter/salty  |  (none)  |  counted 0%  |  NO CHART
sauce/salsa-verde           expect sour/heat not sweet  |  (none)  |  counted 43%  |  NO CHART
sauce/buffalo-sauce         expect heat/sour/salty not sweet  |  (none)  |  counted 17%  |  NO CHART
sauce/marinara              expect umami/sour not bitter  |  bitter 0.47, sweet 0.31, sour 0.23  |  counted 50%  |  miss, not-top2, FORBIDDEN LEADS
sauce/black-bean-sauce      expect salty/umami not sweet/sour  |  (none)  |  counted 22%  |  NO CHART
dish/beef-bolognese         expect umami not sweet  |  sweet 0.38, sour 0.30, bitter 0.29  |  counted 63%  |  miss, FORBIDDEN LEADS
dish/margherita-pizza       expect umami/salty not sweet  |  sweet 0.39, bitter 0.36, sour 0.24  |  counted 71%  |  miss, not-top2, FORBIDDEN LEADS
dish/caesar-salad           expect salty/umami not sweet  |  bitter 0.36, sour 0.30, sweet 0.25  |  counted 63%  |  miss, not-top2
dish/thai-green-curry       expect heat not sweet  |  (none)  |  counted 38%  |  NO CHART
dish/tom-yum                expect sour/heat not sweet  |  (none)  |  counted 38%  |  NO CHART
dish/creme-brulee           expect sweet not salty/umami/sour  |  bitter 0.53, sweet 0.37, sour 0.12  |  counted 50%  |  miss
dish/tiramisu               expect sweet/bitter not salty/umami  |  (none)  |  counted 17%  |  NO CHART
dish/apple-pie              expect sweet not salty/umami  |  (none)  |  counted 25%  |  NO CHART
dish/miso-soup              expect umami/salty not sweet  |  (none)  |  counted 0%  |  NO CHART
dish/greek-salad            expect salty/sour not sweet  |  bitter 0.39, sour 0.32, sweet 0.28  |  counted 63%  |  miss, not-top2
dish/mapo-tofu              expect heat/umami/salty not sweet  |  (none)  |  counted 13%  |  NO CHART
dish/pesto-genovese         expect salty/umami not sweet  |  (none)  |  counted 43%  |  NO CHART

Items 41. Top taste expected: 4/41 (9.8%). Top two both expected: 3/34 items with 2+ expected (8.8%). Forbidden taste leads: 6. No chart: 27. Ingredients counted: 37.5%. Aroma as expected: 0/4 (0%).
```

Read plainly: fewer charts is the intended outcome of this step, and the numbers show it. 27 of the 41 items now have no chart (none before), and only 37.5% of ingredients are counted (82.6% before). The top taste is an expected one on 4 of 41 items (9.8%, was 20 of 41), but that figure now counts every no-chart item as a miss; among the 14 items that still draw a chart it is 4 of 14. A forbidden taste leads on 6 items (was 12): the count halved, but an item with no chart cannot have a wrong leader, so part of that drop is only charts disappearing; all 6 remaining are items that kept a chart and still lead wrongly. The remaining charts are drawn from rows that are not the constant, and they are still not good: that is what the next steps (tastes from the curated labels, then hand-tuned strengths) are for. The Negroni, Daiquiri, Whiskey Sour, Mojito, Americano, Aperol Spritz, Paloma, Piña Colada and Tom Collins now show no chart rather than a wrong one.

Of the 599 built-in recipes, the share cards and link previews draw a chart for 186 (before: 596). By kind: cocktails 140 of 439 (before 436), sauces 16 of 77 (before 77), dishes 30 of 83 (before 83).

## What comes next

- FLAVOR-2 (done, see above) stops drawing a chart from the repeated placeholder rows: ingredients carrying them count as having no flavor data, and a recipe without enough real data shows "not enough flavor data" instead of a chart.
- FLAVOR-3 draws the tastes from the curated taste word each ingredient already has (salt is salty, sugar is sweet, coffee is bitter), weighted by how much of it the recipe uses.
- FLAVOR-4 hand-tunes strengths for the ingredients that matter most, so a dash of bitters and two ounces of gin no longer weigh the same.
- FLAVOR-5 takes aromas from published aroma descriptors instead of the model.
- FLAVOR-6 makes every surface use the same profile, makes the wording honest, and re-measures on this same test set; the aim is to beat the numbers above.

## Shared pages and cards show no chart (2026-11-15, SHARE-8)

After FLAVOR-2, 186 of 599 built-in recipes still drew a chart and most of those led with a wrong taste (`npm run measure:flavor`). So the public share surfaces (the `/r/` page, the share pictures, the link-preview cards, and the bars stored with a user's shared recipe) draw no chart until the charts are rebuilt. The switch is `SHARE_CHARTS_ENABLED` in `src/data/shareTargets.js`; FLAVOR-6 turns it back on. In-app charts are unchanged.

## How neutral and rich are treated (2026-11-15, DATA-5)

The ingredient taste labels now have ten words: the eight old ones plus `neutral` and `rich` (the full rules are in `docs/data-quality.md`, "How taste labels are assigned"). FLAVOR-3 reads them like this:

- **The six chart tastes** are sweet, sour, bitter, salty, umami and heat. First word of a label counts 1.0, second 0.6, third 0.35. `spicy` and `pungent` both feed heat. `astringent` counts half toward bitter.
- **`neutral`** contributes to no taste axis. The ingredient still counts as an ingredient with data (it is counted, not uncounted), so a recipe of flour and water is a recipe with no taste, not a recipe with no data. `neutral` always stands alone in a label.
- **`rich`** is a mouthfeel, not a taste. It contributes to none of the six axes. It may lead a label (`rich sweet` for cream): the word after it still counts at the position it holds, so cream gives sweet 0.6, not 1.0. If a chart shows richness at all it is shown separately from the six tastes.
- Spirits carry no heat word: the burn of alcohol is not charted as heat. Many herbs and warm spices still carry `pungent` from the generated data, so heat is overstated for them until FLAVOR-4's table overrides it.

### What the labels alone give (`node scripts/measureFlavorProfile.mjs --labels-preview`)

The preview scores the same 41 items using only the curated labels, the weights above and equal weight for every ingredient (no amounts, no FLAVOR-4 table, no aroma). It changes no app code; it is the evidence that the label work helps before FLAVOR-3 builds the real function. It is a measurement, not a tuned result: no label was changed to move a test item.

Before the DATA-5 corrections (curated data with no taste overrides):

```
Items 41. Top taste expected: 31/41 (75.6%). Top two both expected: 19/34 items with 2+ expected (55.9%). Forbidden taste leads: 6. No chart: 0. Ingredients counted: 96.6%. Aroma as expected: 0/4 (0%).
```

After the DATA-5 corrections (325 label overrides, 16 added bar and mixer entries, `neutral` and `rich` in use):

```
Items 41. Top taste expected: 32/41 (78%). Top two both expected: 21/34 items with 2+ expected (61.8%). Forbidden taste leads: 6. No chart: 0. Ingredients counted: 97%. Aroma as expected: 0/4 (0%).
```

The gain is real but small (one more top taste, two more top pairs). Labels alone reach the FLAVOR-3 target of 70% at the top taste; the hand-tuned table in FLAVOR-4 is what takes it to 85%. Visible limits of labels alone: no amounts (a dash of bitters weighs as much as two ounces of gin), nuts labelled `rich sweet` put some sweet into pesto, tomato leads sweet in tomato sauces, and heat is not scored here because the scorer has five taste axes.
