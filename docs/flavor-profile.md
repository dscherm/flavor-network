# Flavor profiles: what the chart is, what is wrong with it, and how we measure it

**The charts were rebuilt in FLAVOR-2 to FLAVOR-6. For where they stand now, read "Where the charts stand" at the end of this page.** The sections between are the record of each step, with the numbers printed at the time; the baseline sections describe the OLD chart.

This page is for the site owner. It records what the flavor chart is, a problem found on 2026-11-15, the test we built to measure it, and the score today's charts get. The score below is the baseline: every later fix is judged by whether it beats these numbers.

## What the chart is

Wherever the app shows a bar chart of "flavor" for a cocktail, sauce or dish, the bars are the recipe's flavor axes: five tastes (sweet, sour, bitter, salty, umami; FLAVOR-3 later added heat as a sixth) and six aromas (fruity, floral, green, woody, spicy, fatty). It appears on the Recipe Notebook's Flavor Profiles card, in the three Invent panels, on the shared-recipe page, and on the share-card images and link previews.

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
npm run measure:flavor -- --aroma  # the aroma half against data/aroma-truth.json (tuning set and hold-out)
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

What changed: an ingredient whose taste numbers are one of the repeated placeholder rows no longer counts toward the taste half of a chart, and one whose aroma numbers are the repeated placeholder row no longer counts toward the aroma half. Taste and aroma are judged separately. A half is drawn only when at least two of the recipe's ingredients, and at least half of them, have real values for it. When neither half draws, the chart is replaced by the line "Not enough flavor data for a chart yet." Which rows count as placeholders is worked out by value from the data file when the site is built (`src/data/flavorPlaceholders.json`, removed in FLAVOR-6 when nothing read the model's values for a recipe chart any more): any exact taste row or aroma row shared by more than 150 ingredients. That is the three taste rows (1,526, 261 and 249 ingredients) and the one aroma row (2,062 ingredients).

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

## After FLAVOR-3 (2026-11-15, tastes from the curated labels, weighted by amount)

What changed: the taste half of every in-app chart (Recipe Notebook Flavor Profiles card, the three Invent panels, and the code the shared page and cards will use when their charts are switched on) is no longer read from the model. Each ingredient's curated taste label is turned into weights on six taste axes (sweet, sour, bitter, salty, umami, **heat**) and averaged over the recipe, each ingredient counting in proportion to how much of it the line holds (`src/data/flavorTaste.js`, `src/data/amountGrams.js`). Heat is new: `spicy` and `pungent` both feed it. The aroma half is unchanged for now (still the model, with placeholder rows dropped, until FLAVOR-5). The chart now has 12 axes: six tastes and six aromas.

The rules (the same ones as "How neutral and rich are treated" above): first word 1.0, second 0.6, third 0.35; `astringent` gives half its weight to bitter; `neutral` and `rich` feed no axis but count as data. A recipe whose every ingredient is neutral or rich has nothing to chart and shows the plain line.

Amounts: a line's weight is its gram-equivalent. Free text such as "~¾ oz", "1.5 cl", "2 dashes", "1 shot", "2 parts", "Top with soda" and "1/4 cup, diced" is read. Before this, 1,072 of 1,857 cocktail lines did not parse; 517 of 3,079 built-in recipe lines still carry no usable amount, mostly bare counts like "1" or "3, smashed", and those get the mean weight of the known lines. Units added to the weight table: cl 10 g, shot and jigger 44 g, dash 1 g, drop 0.05 g, splash 7 g, barspoon 5 g, part 30 g, top 60 g, fill 90 g, and bunch, slice, wedge, leaf and stalk. A dash weighs about a gram, an ounce 28 g, and "top with soda" is 60 g, not zero.

Herb relabel (owner-approved): 103 herbs and warm spices (parsley, thyme, oregano, basil, cumin, cinnamon, nutmeg, paprika, turmeric, coriander, dill, sage, rosemary, cilantro, bay leaf, allspice, cardamom, fennel seed, mint, tarragon and their spelling variants) had `pungent` (a few `spicy`) as a second word meaning merely aromatic. Each now has a one-line override in `tasteOverrides.json` without it, so garlic, onion, mustard, horseradish, ginger, pepper, the chilies and cloves are what carry heat. Clove was left alone: it is added by `additions.json`, and a name cannot be in both tables.

### Neutral and fat ingredients: how much they dilute

An ingredient with no taste of its own (neutral: water, soda, starch, vodka; or rich with nothing after it: butter, oil) has to count as data, but how much of its amount should count against the rest? Four rates, measured on the 41 test recipes (every row is the same code; only the dilution rate changes):

| Dilution rate (share of its amount that counts) | Weighting | Top taste expected | Top two expected | Forbidden taste leads | No chart | Median strength of the leading bar |
|---|---|---|---|---|---|---|
| 0 (ignored entirely) | by amount | 30/41 | 19/34 | 8 | 0 | 0.73 |
| 0.25 (chosen) | by amount | 30/41 | 19/34 | 8 | 0 | 0.63 |
| 0.5 | by amount | 30/41 | 19/34 | 8 | 0 | 0.58 |
| 1 (full dilution) | by amount | 29/41 | 19/34 | 8 | 1 | 0.53 |
| any of the four | equal weights | 31/41 | 18/34 | 5 | 0 | 0.50 to 0.52 |

The rate never changes which taste leads (every taste is diluted alike); it only changes how strong the bars read. Full dilution lets 4 oz of soda wash a highball out until one test recipe loses its chart. Ignoring neutral entirely makes a long drink read as strong as a short one (a gin and soda as loud as neat gin). A quarter keeps a highball tasting of its spirit while a recipe that is mostly water or pasta still reads milder. `TASTELESS_WEIGHT = 0.25` in `flavorTaste.js`.

### Result, as printed by `npm run measure:flavor`

```
cocktail/negroni            expect bitter/sweet not sour  |  bitter 0.89, sweet 0.39  |  counted 100%  |  top1, top2
cocktail/daiquiri           expect sour/sweet not bitter  |  sweet 0.77, sour 0.23  |  counted 100%  |  top1, top2
cocktail/margarita          expect sour/salty/sweet not bitter  |  bitter 0.58, sweet 0.35, sour 0.18  |  counted 100%  |  miss, not-top2, FORBIDDEN LEADS
cocktail/old-fashioned      expect sweet/bitter not sour  |  sweet 0.83  |  counted 100%  |  top1, not-top2
cocktail/manhattan          expect sweet/bitter not sour  |  sweet 0.99, sour 0.12, bitter 0.09  |  counted 83%  |  top1, not-top2
cocktail/whiskey-sour       expect sour/sweet  |  sweet 0.79, sour 0.21  |  counted 100%  |  top1, top2
cocktail/mojito             expect sour/sweet not bitter  |  sweet 0.65, sour 0.21, bitter 0.13  |  counted 100%  |  top1, top2, aroma miss
cocktail/americano          expect bitter/sweet not sour  |  sweet 0.80, bitter 0.80  |  counted 67%  |  top1, top2
cocktail/aperol-spritz      expect bitter/sweet not sour  |  sour 0.73, bitter 0.27, sweet 0.16  |  counted 67%  |  miss, not-top2, FORBIDDEN LEADS
cocktail/paloma             expect sour/bitter/sweet  |  bitter 0.81, sour 0.35, sweet 0.14  |  counted 100%  |  top1, top2
cocktail/gimlet             expect sour/sweet not bitter  |  bitter 0.69, sour 0.36, sweet 0.11  |  counted 100%  |  miss, not-top2, FORBIDDEN LEADS
cocktail/sidecar            expect sour/sweet not bitter  |  sweet 0.79, sour 0.21, bitter 0.13  |  counted 100%  |  top1, top2
cocktail/boulevardier       expect bitter/sweet not sour  |  sweet 0.92, bitter 0.36  |  counted 100%  |  top1, top2
cocktail/pina-colada        expect sweet not sour/bitter  |  sweet 0.87, sour 0.20  |  counted 100%  |  top1, aroma miss
cocktail/tom-collins        expect sour/sweet not bitter  |  sweet 0.43, bitter 0.38, sour 0.31  |  counted 83%  |  top1, not-top2
cocktail/bloody-mary        expect umami/salty/heat not sweet  |  sweet 0.62, sour 0.58, umami 0.23  |  counted 100%  |  miss, not-top2, FORBIDDEN LEADS
cocktail/pisco-sour         expect sour/sweet not bitter  |  sweet 0.61, sour 0.33  |  counted 100%  |  top1, top2
cocktail/white-russian      expect sweet not sour/salty  |  sweet 0.67, bitter 0.25  |  counted 100%  |  top1
cocktail/cosmopolitan       expect sour/sweet not bitter/salty  |  sour 0.81, sweet 0.52, bitter 0.05  |  counted 100%  |  top1, top2
cocktail/tequila-sunrise    expect sweet not bitter/salty  |  sweet 0.50, bitter 0.36, sour 0.35  |  counted 100%  |  top1
sauce/hollandaise           expect sour/salty not sweet/bitter  |  sour 0.16  |  counted 100%  |  top1, not-top2
sauce/teriyaki              expect sweet/salty/umami not sour/bitter  |  sweet 0.54, umami 0.43, salty 0.26  |  counted 100%  |  top1, top2
sauce/ponzu                 expect sour/salty/umami not sweet  |  umami 0.50, sour 0.36, salty 0.26  |  counted 100%  |  top1, top2
sauce/nuoc-cham             expect sour/salty/sweet not bitter  |  salty 0.31, heat 0.21, sweet 0.21  |  counted 100%  |  top1, not-top2
sauce/sweet-and-sour-sauce  expect sweet/sour not bitter/salty  |  sweet 0.47, sour 0.41, umami 0.08  |  counted 100%  |  top1, top2
sauce/salsa-verde           expect sour/heat not sweet  |  sour 0.63, heat 0.38, sweet 0.09  |  counted 100%  |  top1, top2, aroma miss
sauce/buffalo-sauce         expect heat/sour/salty not sweet  |  heat 0.59, sour 0.18, umami 0.06  |  counted 100%  |  top1, top2
sauce/marinara              expect umami/sour not bitter  |  sweet 0.97, sour 0.57, umami 0.34  |  counted 100%  |  miss, not-top2
sauce/black-bean-sauce      expect salty/umami not sweet/sour  |  sweet 0.53, heat 0.45, umami 0.39  |  counted 100%  |  miss, not-top2, FORBIDDEN LEADS
dish/beef-bolognese         expect umami not sweet  |  sweet 0.48, umami 0.38, sour 0.20  |  counted 100%  |  miss, FORBIDDEN LEADS
dish/margherita-pizza       expect umami/salty not sweet  |  sweet 0.63, sour 0.36, umami 0.22  |  counted 100%  |  miss, not-top2, FORBIDDEN LEADS
dish/caesar-salad           expect salty/umami not sweet  |  umami 0.43, salty 0.40, heat 0.24  |  counted 100%  |  top1, top2
dish/thai-green-curry       expect heat not sweet  |  umami 0.51, sweet 0.21, bitter 0.16  |  counted 100%  |  miss
dish/tom-yum                expect sour/heat not sweet  |  umami 0.53, heat 0.39, salty 0.25  |  counted 100%  |  miss, not-top2
dish/creme-brulee           expect sweet not salty/umami/sour  |  sweet 0.71  |  counted 100%  |  top1
dish/tiramisu               expect sweet/bitter not salty/umami  |  sweet 0.41, bitter 0.32, umami 0.10  |  counted 100%  |  top1, top2
dish/apple-pie              expect sweet not salty/umami  |  sweet 0.81, sour 0.18  |  counted 100%  |  top1
dish/miso-soup              expect umami/salty not sweet  |  umami 0.72, salty 0.45, heat 0.23  |  counted 100%  |  top1, top2
dish/greek-salad            expect salty/sour not sweet  |  salty 0.58, sweet 0.24, heat 0.15  |  counted 100%  |  top1, not-top2
dish/mapo-tofu              expect heat/umami/salty not sweet  |  heat 0.45, umami 0.37, sweet 0.13  |  counted 100%  |  top1, top2
dish/pesto-genovese         expect salty/umami not sweet  |  sweet 0.28, umami 0.18, salty 0.11  |  counted 100%  |  miss, not-top2, FORBIDDEN LEADS, aroma miss

Items 41. Top taste expected: 30/41 (73.2%). Top two both expected: 19/34 items with 2+ expected (55.9%). Forbidden taste leads: 8. No chart: 0. Ingredients counted: 97.6%. Aroma as expected: 0/4 (0%).
```

Counted: 97.6% of the test recipes' ingredients have a taste label (it was 37.5% after FLAVOR-2). Across all 599 built-in recipes, 598 now draw a taste chart (FLAVOR-2 left 186): cocktails 438 of 439, sauces 77 of 77, dishes 83 of 83. 94 of 3,079 ingredient lines (3%) did not resolve to a known ingredient.

Against the labels-only preview (`--labels-preview`, equal weights): the preview now reads 31/41 top taste with 5 forbidden leads (it read 32/41 before the herb relabel and before heat counted as a scored taste; heat now competes for the top spot). With amounts the default run is 30/41, **one item below equal weights, and its forbidden-leads count rises from 5 to 8**. Why: amounts push the base spirit, the biggest pour, to the front. Gin and tequila are labelled `bitter`, bourbon and rum `sweet`, so a margarita and a gimlet read bitter (forbidden) because 2 oz of spirit outweighs 3/4 oz of lime. Equal weights hid this by giving the citrus the same vote as the spirit, but it also let a pinch of cayenne lead a hollandaise on heat (equal weights put heat first on four sauces that do not taste hot). Amounts fix those four and break three spirit-led drinks. A one-line strength per ingredient (FLAVOR-4) is what separates "a lot of a mild thing" from "a little of a strong thing".

### The misses, one by one (FLAVOR-4's worklist)

Top taste not an expected one (11 items). "Fix" says what strength or potency would repair it, on the FLAVOR-4 scale of 0 to 3 per taste.

| Item | Leads | Why | Fix in the FLAVOR-4 table |
|---|---|---|---|
| Margarita | bitter 0.58 (forbidden) | Tequila `bitter`, 57 g, against lime juice `sour`, 21 g. The key's `salty` can never show: the salt rim is not an ingredient line. | tequila bitter at most 0.5; lime juice sour 3 with high potency; orange liqueur sweet 2 |
| Aperol Spritz | sour 0.73 (forbidden) | Prosecco `sour`, 57 g, against aperol `bitter sweet`, 21 g. Seltzer does not resolve (the pairing matcher treats it as trivial by design). | prosecco sour 1 and sweet 1, low potency; aperol bitter 2, sweet 2, potency 2 |
| Gimlet | bitter 0.69 (forbidden) | Gin `bitter`, 71 g, against lime juice 14 g and syrup 14 g. The bare "lime [1]" garnish line has no weight. | gin bitter 0.3; lime juice sour 3; syrup sweet 3 |
| Bloody Mary | sweet 0.62 (forbidden) | Tomato juice labelled `sweet sour umami`, 90 g, so sweet leads. The 2 dashes of Worcestershire, the Tabasco (no amount) and the pepper are about 1 g each. | tomato umami 2, sour 1, sweet 0.8; Worcestershire umami 3 and Tabasco heat 3, both high potency so a dash registers |
| Marinara | sweet 0.97 | Tomato, `sweet sour umami`, 907 g of about 1,000. Salt 3 g, garlic 12 g. | tomato umami 2, sour 1.5, sweet 0.8; salt salty 3 with high potency |
| Black bean sauce | sweet 0.53 (forbidden) | Bean paste `sweet umami`, 30 g, outweighs soy sauce 15 g; ginger `spicy pungent` (heat 1.6) 15 g puts heat second. | bean paste umami 2, salty 2, sweet 0.3; soy sauce potency 3; ginger heat capped at 1 |
| Beef bolognese | sweet 0.48 (forbidden) | Tomato `sweet sour umami` 400 g; beef `umami` 500 g is diluted by 400 g of pasta; onion `pungent sweet` adds heat for a cooked onion; carrot has no weight. | tomato as above; beef umami 1; cooked onion heat 0, sweet 0.5 |
| Margherita pizza | sweet 0.63 (forbidden) | Tomato again, plus flour 300 g (neutral) and mozzarella `rich` with no salty. Salt is 5 g. | tomato as above; mozzarella salty 1, umami 1; salt potency |
| Thai green curry | umami 0.51 | Expects heat first. Curry paste `spicy pungent` is 45 g against chicken 500 g and coconut milk 400 g. | curry paste heat 3 with potency 5; chicken umami 0.5 |
| Tom yum | umami 0.49, heat 0.45 | A near miss: heat is 0.04 behind. Shrimp `umami salty sweet` 300 g and mushroom 150 g against 3 chilies and 2 limes that are bare counts with no weight. Expected sour and heat. | chili heat 3 with potency, and a typical weight for a bare count (chili 15 g, lime 60 g, egg 50 g, onion 150 g); shrimp umami 1 |
| Pesto genovese | sweet 0.28 (forbidden) | Pasta, 400 g neutral, dilutes everything; basil `sweet` 60 g and pine nut `rich sweet` 30 g put sweet first; parmesan `umami salty` is only 50 g. The pine-nut and basil sweetness is the DATA-5 borderline. | basil sweet 0.3 (it is an aroma more than a taste); pine nut sweet 0.2; parmesan umami 2, salty 2, potency 2 |

Top taste right, but the top two are not both expected tastes:

| Item | Chart | Why |
|---|---|---|
| Old Fashioned | sweet 0.83 only | Angostura bitters, 2 dashes, is 2 g against bourbon 45 g, and the sugar cube has no weight; "dash Water" does not resolve. Fix: bitters bitter 3 with potency 8; sugar cube 4 g. |
| Manhattan | sweet 0.99, sour 0.12, bitter 0.09 | Bourbon `sweet` 71 g swamps the vermouth and bitters. Fix: bitters potency; vermouth bitter 1; whiskey sweet 0.5. |
| Tom Collins | sweet 0.43, bitter 0.38, sour 0.31 | Gin `bitter` 57 g outweighs lemon juice 28 g. Fix: gin bitter 0.3, lemon juice sour 3. |
| Hollandaise | sour 0.16 only | Butter 240 g and egg are rich (no taste), so one faint sour bar is all there is. Salt is 1 g. Fix: lemon juice sour 3 with potency; salt potency. |
| Nuoc cham | salty 0.31, heat 0.21, sweet 0.21 | Sour is below sweet at equal grams (lime juice 30 g, sugar 30 g, fish sauce 45 g). The chili adds heat, which the key does not list; I think nuoc cham does taste of its chili, so this line of the key is debatable (I did not edit it). Fix: lime juice sour 3. |
| Greek salad | salty 0.58, sweet 0.24, heat 0.15 | Tomato `sweet` first; red onion `pungent sweet` charts heat; lemon juice is 15 g. Fix: tomato; raw onion heat 0.5. |

Reading the key: Nuoc cham (above) is the line I think is debatable. The Thai green curry and mapo tofu lines expect heat; mapo tofu now gets it (heat first, 0.45) and green curry does not, only because the curry paste is a small weight, which is a strength problem and not a label problem. Not changed: `data/flavor-truth.json`.

Where the misses come from, in order: (1) no strength per ingredient, so a large pour of a mild thing beats a small amount of a strong thing (nine of the eleven misses); (2) tomato labelled sweet first (five of them); (3) bare counts with no weight (lime, chili, egg, sugar cube, onion; 517 of 3,079 lines); (4) the aroma check still fails 0 of 4, which is FLAVOR-5's job.

### Where the labels live and what the pages download

The labels ship as a small file, `public/proDataset/taste_labels.json` (name to label, 3,674 ingredients), written by `scripts/buildTasteLabels.mjs` in `prebuild` from the same curated data the app applies on load. **104,693 bytes raw, 20,568 bytes gzipped.** The shared page and the share-card code load this instead of `ingredients.json`. Inside the main app the labels are already on the ingredient nodes (`node.taste`), so nothing is downloaded twice.

## After FLAVOR-4 (2026-11-16, a hand-tuned strength for each ingredient that matters most)

What changed: FLAVOR-3 gave every ingredient a taste label ("sweet bitter") that says WHICH tastes it has but not how STRONG they are, so the biggest pour won: 2 oz of tequila (labelled bitter) beat 3/4 oz of lime juice (sour), and a Margarita charted bitter. `src/data/flavorStrengths.js` is a table with one line for each of 269 ingredients (every base spirit and bar bottle, the 40 most-used cocktail ingredients, the 60 most-used sauce and dish ingredients, and the rest of the common liqueurs, bitters, juices, syrups, mixers, dairy, seasonings, chilies and herbs). It was written by the assistant from common bartending and cooking knowledge on 2026-11-16 and is NOT independently checked.

### How the table works, in plain words

Each line gives, for each of the six tastes, a number from 0 to 3 for how strongly THAT ingredient tastes of it per gram (0 = none, 1 = faint, 2 = clearly there, 3 = what the ingredient is: sugar is sweet 3, lime juice is sour 3). It also gives a **potency**: how much one gram of it counts, compared with an ordinary ingredient at 1.

- A little of something strong has a high potency (bitters 6, hot sauce 10, chili 8, fish sauce 6, soy sauce 4, salt 25, lime and lemon juice 2.5, sugar 2.5, syrups 2, strong liqueurs 1.5).
- A lot of something mild has a low one (base spirits 0.5 to 0.7: mostly ethanol and water with a mild character).
- Soda water, water, oils, butter, flour and pasta have potency 0: no taste worth charting. They still count as ingredients and still water a recipe down a little (their grams count at `TASTELESS_WEIGHT` = 0.25, as in FLAVOR-3), so a long drink reads a little weaker than the same drink neat but does not vanish.

A taste's bar is the average of the strengths of everything in the recipe, each counted in proportion to its **grams x potency**. So two dashes of bitters (2 g x 6) count about as much as 12 g of an ordinary ingredient, not as 2 g, while 57 g of whiskey (57 x 0.6) counts as 34. Every bar stays between 0 and 1. (The brief suggested potencies of 25 to 40 for bitters; once potency is a weight in an average rather than a multiplier on an uncapped sum, those numbers would make two dashes outweigh the whiskey in an Old Fashioned, so 6 is the number that matches a cook's sense that bitters are a note, not the drink.)

**An ingredient with a line REPLACES its label.** Any other ingredient keeps the label from FLAVOR-3, put on the same scale: the first word of a label counts as strength 3, the second 1.8, the third 1.05 (the FLAVOR-3 weights 1.0, 0.6, 0.35 times 3), potency 1, and one ingredient is capped at 3 (a label that says spicy and pungent is 3, not 4.8). So a recipe made only of label-only ingredients charts as it did under FLAVOR-3.

**Lines with no amount.** 517 of 3,079 built-in lines had no usable amount ("1", "to taste", "1 stick") and took the mean weight of the recipe's measured lines. With potency that goes wrong: a Bloody Mary's unmeasured Tabasco became a quarter of the drink and one chili in nuoc cham a third of the sauce. So an ingredient on the table can carry a typical single portion (`DEFAULT_GRAMS`: hot sauce 2 g, a chili 8 g, a lime 20 g, a lemon 25 g, an egg 50 g, a clove of garlic 3 g, the juice of one lime 30 g; 35 entries), a bare count multiplies it ("6" chilies is 48 g, "8 limes" of lime juice is 240 g), and any other table ingredient with potency above 1.5 counts 3 g. These defaults are not treated as measured amounts, so a recipe with no measured amounts is still equal-weighted. Ingredients that are not on the table keep the mean rule. Evidence for doing this: the same table with the mean rule read 38/41 on the main key (it flattered the result by giving a chili a third of a sauce); with the defaults it reads 36/41 and the charts are the more believable ones.

**Rims.** A Margarita's salt rim and a Bloody Mary's salt and pepper live in the recipe's garnish text, not in an ingredient line. `buildFlavorProfile` now takes an optional `garnish` string; a salt rim counts as half a gram of salt, a sugar rim as a gram of sugar, a chili or tajin rim as half a gram of chili powder, and no other garnish counts. The measuring script passes it. The in-app panels (Invent, Recipe Notebook) have no garnish text so nothing changes there; when FLAVOR-6 turns the shared pages and cards back on, `recipe.garnish` is what to pass.

### Result, as printed by `npm run measure:flavor`

Before (the end of FLAVOR-3, the run above): `Items 41. Top taste expected: 30/41 (73.2%). Top two both expected: 19/34 items with 2+ expected (55.9%). Forbidden taste leads: 8. No chart: 0. Ingredients counted: 97.6%. Aroma as expected: 0/4 (0%).`

After:

```
cocktail/negroni            expect bitter/sweet not sour  |  bitter 0.50, sweet 0.39  |  counted 100%  |  top1, top2
cocktail/daiquiri           expect sour/sweet not bitter  |  sour 0.46, sweet 0.30  |  counted 100%  |  top1, top2
cocktail/margarita          expect sour/salty/sweet not bitter  |  sweet 0.40, sour 0.31, bitter 0.08  |  counted 100%  |  top1, top2
cocktail/old-fashioned      expect sweet/bitter not sour  |  sweet 0.27, bitter 0.23  |  counted 100%  |  top1, top2
cocktail/manhattan          expect sweet/bitter not sour  |  sweet 0.49, bitter 0.20, sour 0.14  |  counted 83%  |  top1, top2
cocktail/whiskey-sour       expect sour/sweet  |  sour 0.41, sweet 0.40, bitter 0.05  |  counted 100%  |  top1, top2
cocktail/mojito             expect sour/sweet not bitter  |  sweet 0.33, sour 0.15  |  counted 100%  |  top1, top2, aroma miss
cocktail/americano          expect bitter/sweet not sour  |  bitter 0.67, sweet 0.53  |  counted 100%  |  top1, top2
cocktail/aperol-spritz      expect bitter/sweet not sour  |  sweet 0.38, bitter 0.19, sour 0.18  |  counted 100%  |  top1, top2
cocktail/paloma             expect sour/bitter/sweet  |  sour 0.46, bitter 0.35, sweet 0.14  |  counted 100%  |  top1, top2
cocktail/gimlet             expect sour/sweet not bitter  |  sour 0.39, sweet 0.22, bitter 0.08  |  counted 100%  |  top1, top2
cocktail/sidecar            expect sour/sweet not bitter  |  sour 0.44, sweet 0.29, bitter 0.10  |  counted 100%  |  top1, top2
cocktail/boulevardier       expect bitter/sweet not sour  |  bitter 0.49, sweet 0.48  |  counted 100%  |  top1, top2
cocktail/pina-colada        expect sweet not sour/bitter  |  sweet 0.41, sour 0.19  |  counted 100%  |  top1, aroma miss
cocktail/tom-collins        expect sour/sweet not bitter  |  sour 0.39, sweet 0.33, bitter 0.07  |  counted 100%  |  top1, top2
cocktail/bloody-mary        expect umami/salty/heat not sweet  |  sour 0.45, umami 0.39, sweet 0.17  |  counted 100%  |  miss, not-top2
cocktail/pisco-sour         expect sour/sweet not bitter  |  sour 0.56, sweet 0.25  |  counted 100%  |  top1, top2
cocktail/white-russian      expect sweet not sour/salty  |  sweet 0.45, bitter 0.21  |  counted 100%  |  top1
cocktail/cosmopolitan       expect sour/sweet not bitter/salty  |  sour 0.65, sweet 0.41, bitter 0.12  |  counted 100%  |  top1, top2
cocktail/tequila-sunrise    expect sweet not bitter/salty  |  sour 0.50, sweet 0.42  |  counted 100%  |  miss
sauce/hollandaise           expect sour/salty not sweet/bitter  |  sour 0.19, salty 0.16  |  counted 100%  |  top1, top2
sauce/teriyaki              expect sweet/salty/umami not sour/bitter  |  salty 0.70, umami 0.61, sweet 0.27  |  counted 100%  |  top1, top2
sauce/ponzu                 expect sour/salty/umami not sweet  |  salty 0.57, umami 0.56, sour 0.22  |  counted 100%  |  top1, top2
sauce/nuoc-cham             expect sour/salty/sweet not bitter  |  umami 0.55, salty 0.54, sweet 0.15  |  counted 100%  |  miss, not-top2
sauce/sweet-and-sour-sauce  expect sweet/sour not bitter/salty  |  sweet 0.49, sour 0.30, salty 0.17  |  counted 100%  |  top1, top2
sauce/salsa-verde           expect sour/heat not sweet  |  sour 0.58, heat 0.12, salty 0.07  |  counted 100%  |  top1, top2, aroma miss
sauce/buffalo-sauce         expect heat/sour/salty not sweet  |  sour 0.40, salty 0.30, umami 0.15  |  counted 100%  |  top1, top2
sauce/marinara              expect umami/sour not bitter  |  umami 0.59, sour 0.44, sweet 0.24  |  counted 100%  |  top1, top2
sauce/black-bean-sauce      expect salty/umami not sweet/sour  |  umami 0.41, salty 0.34, sweet 0.32  |  counted 100%  |  top1, top2
dish/beef-bolognese         expect umami not sweet  |  umami 0.29, sweet 0.17, sour 0.16  |  counted 100%  |  top1
dish/margherita-pizza       expect umami/salty not sweet  |  salty 0.29, umami 0.29, sour 0.18  |  counted 100%  |  top1, top2
dish/caesar-salad           expect salty/umami not sweet  |  salty 0.44, umami 0.41, sour 0.20  |  counted 100%  |  top1, top2
dish/thai-green-curry       expect heat not sweet  |  umami 0.22, heat 0.15, salty 0.14  |  counted 100%  |  miss
dish/tom-yum                expect sour/heat not sweet  |  umami 0.40, salty 0.27, heat 0.20  |  counted 100%  |  miss, not-top2
dish/creme-brulee           expect sweet not salty/umami/sour  |  sweet 0.38  |  counted 100%  |  top1
dish/tiramisu               expect sweet/bitter not salty/umami  |  sweet 0.48, bitter 0.30  |  counted 100%  |  top1, top2
dish/apple-pie              expect sweet not salty/umami  |  sweet 0.82, sour 0.14  |  counted 100%  |  top1
dish/miso-soup              expect umami/salty not sweet  |  umami 0.67, salty 0.33  |  counted 100%  |  top1, top2
dish/greek-salad            expect salty/sour not sweet  |  salty 0.55, sour 0.30, bitter 0.08  |  counted 100%  |  top1, top2
dish/mapo-tofu              expect heat/umami/salty not sweet  |  heat 0.25, umami 0.13  |  counted 100%  |  top1, top2
dish/pesto-genovese         expect salty/umami not sweet  |  salty 0.26, umami 0.24, sweet 0.06  |  counted 100%  |  top1, top2, aroma miss

Items 41. Top taste expected: 36/41 (87.8%). Top two both expected: 31/34 items with 2+ expected (91.2%). Forbidden taste leads: 0. No chart: 0. Ingredients counted: 99.6%. Aroma as expected: 0/4 (0%).
```

Main set: top taste expected 30/41 (73.2%) to **36/41 (87.8%)**, top two 19/34 to 31/34 (91.2%), forbidden taste leads 8 to **0**.

### The hold-out: 20 recipes written before the table was tuned

`data/flavor-holdout.json` holds 20 well-known recipes that are NOT in the main answer key (8 cocktails, 6 sauces, 6 dishes, resolved from the built-in data), with the tastes a cook would expect, written by the assistant before any strength was set and never used for tuning. Run it with `node scripts/measureFlavorProfile.mjs --truth data/flavor-holdout.json` (the `--truth` option already existed). The same code, before and after.

Before (the FLAVOR-3 code, labels only):

```
cocktail/moscow-mule         expect sour/sweet/heat not bitter  |  sweet 0.38, sour 0.38, heat 0.23  |  counted 75%  |  top1, top2
cocktail/mai-tai             expect sweet/sour not bitter  |  sweet 0.80, sour 0.18, bitter 0.13  |  counted 100%  |  top1, top2
cocktail/caipirinha          expect sour/sweet not bitter  |  sweet 0.75, bitter 0.37, sour 0.25  |  counted 100%  |  top1, not-top2
cocktail/sazerac             expect bitter/sweet not sour  |  sweet 0.65, bitter 0.52  |  counted 100%  |  top1, top2
cocktail/amaretto-sour       expect sweet/sour not bitter  |  sweet 0.61, sour 0.36, bitter 0.18  |  counted 100%  |  top1, top2
cocktail/bees-knees          expect sour/sweet not bitter  |  bitter 0.57, sweet 0.21, sour 0.21  |  counted 100%  |  miss, not-top2, FORBIDDEN LEADS
cocktail/brandy-alexander    expect sweet not sour/bitter/salty  |  sweet 0.89, bitter 0.17  |  counted 100%  |  top1
cocktail/irish-coffee        expect bitter/sweet not sour/salty  |  bitter 0.67, sweet 0.35  |  counted 100%  |  top1, top2
sauce/tonkatsu-sauce         expect sweet/umami/sour not bitter  |  sweet 0.55, umami 0.41, sour 0.25  |  counted 100%  |  top1, top2
sauce/bbq-sauce              expect sweet/sour/umami not bitter  |  sweet 0.77, sour 0.42, heat 0.16  |  counted 100%  |  top1, top2
sauce/chimichurri            expect sour/salty/heat not sweet  |  bitter 0.74, sour 0.13  |  counted 100%  |  miss, not-top2
sauce/pad-thai-sauce         expect sour/salty/sweet not bitter  |  sour 0.38, sweet 0.28, umami 0.27  |  counted 100%  |  top1, top2
sauce/harissa                expect heat not sweet  |  heat 0.55, sour 0.20, sweet 0.11  |  counted 100%  |  top1
sauce/beurre-blanc           expect sour/salty not sweet/heat/bitter  |  sour 0.60, sweet 0.40, heat 0.13  |  counted 100%  |  top1, not-top2
dish/spaghetti-carbonara     expect salty/umami not sweet/sour  |  salty 0.69, umami 0.35  |  counted 100%  |  top1, top2
dish/shrimp-ceviche          expect sour not sweet/bitter  |  heat 0.40, sweet 0.35, umami 0.34  |  counted 100%  |  miss
dish/guacamole               expect sour/salty/heat not sweet/bitter  |  heat 0.42, bitter 0.31, sweet 0.26  |  counted 100%  |  top1, not-top2
dish/chocolate-chip-cookies  expect sweet not salty/umami/sour/heat  |  sweet 0.52, bitter 0.32, umami 0.11  |  counted 100%  |  top1
dish/pho                     expect umami/salty not sweet  |  sweet 0.39, heat 0.39, sour 0.15  |  counted 100%  |  miss, not-top2, FORBIDDEN LEADS
dish/mac-and-cheese          expect salty/umami not sweet/sour  |  sweet 0.37, salty 0.26, umami 0.16  |  counted 100%  |  miss, not-top2, FORBIDDEN LEADS

Items 20. Top taste expected: 15/20 (75%). Top two both expected: 9/16 items with 2+ expected (56.3%). Forbidden taste leads: 3. No chart: 0. Ingredients counted: 98.8%. Aroma as expected: 0/0 (null%).
```

After:

```
cocktail/moscow-mule         expect sour/sweet/heat not bitter  |  sour 0.45, sweet 0.34, heat 0.10  |  counted 100%  |  top1, top2
cocktail/mai-tai             expect sweet/sour not bitter  |  sweet 0.52, sour 0.30, bitter 0.12  |  counted 100%  |  top1, top2
cocktail/caipirinha          expect sour/sweet not bitter  |  sweet 0.55, sour 0.13, bitter 0.06  |  counted 100%  |  top1, top2
cocktail/sazerac             expect bitter/sweet not sour  |  bitter 0.44, sweet 0.26  |  counted 100%  |  top1, top2
cocktail/amaretto-sour       expect sweet/sour not bitter  |  sweet 0.47, sour 0.41, bitter 0.15  |  counted 100%  |  top1, top2
cocktail/bees-knees          expect sour/sweet not bitter  |  sour 0.41, sweet 0.33, bitter 0.06  |  counted 100%  |  top1, top2
cocktail/brandy-alexander    expect sweet not sour/bitter/salty  |  sweet 0.49, bitter 0.08  |  counted 100%  |  top1
cocktail/irish-coffee        expect bitter/sweet not sour/salty  |  bitter 0.41, sweet 0.15, sour 0.09  |  counted 100%  |  top1, top2
sauce/tonkatsu-sauce         expect sweet/umami/sour not bitter  |  umami 0.63, sweet 0.50, salty 0.48  |  counted 100%  |  top1, top2
sauce/bbq-sauce              expect sweet/sour/umami not bitter  |  sweet 0.56, sour 0.43, umami 0.36  |  counted 100%  |  top1, top2
sauce/chimichurri            expect sour/salty/heat not sweet  |  sour 0.25, salty 0.12, bitter 0.05  |  counted 100%  |  top1, top2
sauce/pad-thai-sauce         expect sour/salty/sweet not bitter  |  sour 0.35, umami 0.33, salty 0.32  |  counted 100%  |  top1, not-top2
sauce/harissa                expect heat not sweet  |  heat 0.72, salty 0.11, sour 0.07  |  counted 100%  |  top1
sauce/beurre-blanc           expect sour/salty not sweet/heat/bitter  |  sour 0.35, salty 0.10, sweet 0.09  |  counted 100%  |  top1, top2
dish/spaghetti-carbonara     expect salty/umami not sweet/sour  |  salty 0.40, umami 0.37  |  counted 100%  |  top1, top2
dish/shrimp-ceviche          expect sour not sweet/bitter  |  sour 0.43, umami 0.20, sweet 0.10  |  counted 100%  |  top1
dish/guacamole               expect sour/salty/heat not sweet/bitter  |  sour 0.44, salty 0.13, heat 0.11  |  counted 100%  |  top1, top2
dish/chocolate-chip-cookies  expect sweet not salty/umami/sour/heat  |  sweet 0.65, bitter 0.22, salty 0.10  |  counted 100%  |  top1
dish/pho                     expect umami/salty not sweet  |  sweet 0.35, umami 0.12  |  counted 100%  |  miss, not-top2, FORBIDDEN LEADS
dish/mac-and-cheese          expect salty/umami not sweet/sour  |  salty 0.15, umami 0.15, sweet 0.12  |  counted 100%  |  top1, top2

Items 20. Top taste expected: 19/20 (95%). Top two both expected: 14/16 items with 2+ expected (87.5%). Forbidden taste leads: 1. No chart: 0. Ingredients counted: 100%. Aroma as expected: 0/0 (null%).
```

Hold-out: top taste expected 15/20 (75%) to **19/20 (95%)**, top two 9/16 to 14/16, forbidden leads 3 to 1. The main set and the hold-out moved the same way (+6 and +4 items). The one forbidden lead left on the hold-out is Beef Pho (below). Honesty note: I read the hold-out's per-recipe output after each run, as the script prints it. The only change I made because of what it showed is the typical-amount rule for fruit juice by count ("8 limes" of lime juice in the ceviche), a general mechanism and not a recipe-specific line. I did not add a line for an ingredient that only the hold-out used (star anise, for instance, is why Beef Pho still misses).

### What is still wrong, by item

Main set (5 recipes whose top taste is not an expected one; the aroma misses on Mojito, Pina Colada, Salsa Verde and Pesto are FLAVOR-5):

| Item | Chart | Why |
|---|---|---|
| Bloody Mary | sour 0.45, umami 0.39, sweet 0.17 (expects umami, salty, heat) | Tomato juice is sour 1 and the lemon juice (15 ml, potency 2.5) adds more; the Tabasco is 2 g. A cook would call a Bloody Mary savory first; the chart calls it tart. Not forced. |
| Tequila Sunrise | sour 0.50, sweet 0.42 (expects sweet) | The codex recipe has lime juice (about 3/4 oz) as well as orange juice and grenadine, and orange juice is sweet 2, sour 1.5. |
| Nuoc cham | umami 0.55, salty 0.54, sweet 0.15 (expects sour, salty, sweet) | Fish sauce, 45 g at potency 6, outweighs the lime juice and sugar (30 g each at 2.5). The key lists no heat although the dish has a chili. |
| Thai green curry (dish) | umami 0.22, heat 0.15 (expects heat) | Chicken 500 g and coconut milk 400 g are most of the weight and the paste is 45 g. Heat is second, a real bar, but not the lead. |
| Tom yum | umami 0.40, salty 0.27, heat 0.20 (expects sour, heat) | Shrimp and mushroom are most of the weight; the lime is a bare count of 20 g. |

Hold-out: Beef Pho (sweet 0.35, forbidden): the 1.5 kg of bones plus 300 g of sirloin is one unparsable amount, the star anise is label-only (label sweet, strength 3, no usable amount so it takes the mean weight of 225 g) and there is no stock line. Pad Thai Sauce: sour leads but umami (fish sauce) beats salty for second.

Two lines of the answer key that I think are debatable, listed for the owner and not edited: **Nuoc cham** expects sour, salty and sweet but no heat although the recipe has a chili; **Margarita** expects salty, but the salt is a rim in the garnish text (now read, but a rim is half a gram of salt, so it shows as a small bar, 0.07).

The Margarita in the codex has 3/4 oz each of orange liqueur, lime juice and simple syrup (those amounts are the app's own suggestions, marked with a tilde), so it charts sweet 0.40, sour 0.31: sour is second, not first. "Margarita (Dry)" (no syrup) charts sour first.

### How to correct a line (no code needed)

1. Open `src/data/flavorStrengths.js` and find the ingredient. The name has to be spelled exactly as the app spells it; a name the app does not know fails the test on purpose.
2. Change the numbers on that one line: the six tastes (0 to 3; leave a taste out for none) and `potency` (the scale is at the top of the file). Ask: would a bartender or a cook agree with this line on its own? Do not change a number only because one recipe came out wrong.
3. To add an ingredient, add one line the same way. To say what one of it weighs when a recipe gives no amount, add it to `DEFAULT_GRAMS`.
4. Run `npm run measure:flavor` (the main key) and `node scripts/measureFlavorProfile.mjs --truth data/flavor-holdout.json` (the hold-out) and look at the recipes you care about; run `npm test -- flavorStrengths` to check the file is well formed.

### Tests

`flavorStrengths.test.js`: the file is well formed; every name is a real ingredient (or on the short `NOT_IN_GRAPH` list of bottles and mixers the graph does not hold, which is itself checked); every base spirit, bar bottle, generic bottle key, the 40 most-used cocktail ingredients and the 60 most-used sauce and dish ingredients have a line; an entry overrides its label; two dashes of bitters register against 2 oz of spirit; soda water does not dilute a chart to nothing; label-only ingredients sit on the same scale; the typical-amount rule; the rim rule. `flavorStrengths.realData.test.js`: top taste at least 85% with no forbidden lead on the main key, the hold-out at least 85%, and the named checks on the real recipes (Negroni bitter then sweet with sour not in the top two; Daiquiri sour and sweet; Old Fashioned sweet and bitter with the bitters registering; Margarita never bitter on top with sour in the top two; Bolognese and marinara not sweet-first; a soy sauce sauce salty and umami; a Thai curry shows heat).

## Aroma data assessment (2026-11-16, FLAVOR-5)

The plan for FLAVOR-5 was to build aromas from the published aroma descriptors in `public/proDataset/gnn_compounds.json` (2.3 MB). Before building on it I measured it with throwaway Node scripts (not committed). All numbers below are from that file.

**What the file holds.** 3,083 ingredients. Each has `total_compounds: 20` and a `top_compounds` list of at most 5 compounds (`name` plus a list of descriptor `tags`): 2,042 ingredients list 5, 805 list 4, 138 list 1. So 15 of an ingredient's 20 compounds are not stored. Across the whole file there are only 242 distinct compounds and 206 distinct tags. The most common tags are `bitter` (6,751 uses), `odorless` (4,603), `sweet` (3,165), `ethereal`, `alcoholic`, `medical`: taste words and lab words, not aroma notes.

**Ubiquity (the constant problem, again).**

- 4 compounds appear in more than half of all ingredients: Ethanol 72%, L-Histidine 70%, Caffeine 68%, Theobromine 68%. (So 4 compounds are above 20% and 4 above 50%; the next most common is 11%.) Sugar, butter, chocolate and 436 other ingredients list exactly those four and nothing else.
- Only 179 distinct compound lists exist among 3,083 ingredients. The biggest group of ingredients sharing one identical list is 439 (Ethanol, L-Histidine, Caffeine, Theobromine); the next are 324, 167, 143 and 137.
- After removing the four ubiquitous compounds, 868 ingredients (28%) have no compound left at all. 698 (23%) have at least 3 compounds that appear in under 5% of ingredients, which is the most generous reading of "genuinely specific".

**Spot checks on 31 well-known ingredients** (after removing the four ubiquitous compounds):

| Ingredient | What is left | Does it describe it? |
|---|---|---|
| mint | menthyl acetate (mint, orange, rose), piperitone (minty), coumarin, methyl benzoate, octanol | Yes, mostly |
| basil | thymol (herbal), coumarin, vanillic acid, a wood/spice compound | Roughly |
| vanilla | menthone (menthol, camphor, peppermint), dodecanol (coconut, wax) | No: peppermint for vanilla |
| lemon | one compound, tridecanal (grapefruit peel, citrus) | Thin but right |
| lime | nonane (gasoline), succinic acid, nonanal (citrus, lime), nonanol | Half |
| orange | methyl anthranilate (neroli), acetic acid (vinegar), hexanal (grass) | Mostly not: vinegar and grass |
| strawberry, banana | menthone (peppermint) | No |
| coconut | succinic acid | No |
| butter, cream, coffee, chocolate | nothing | No data |
| olive oil | apigenin (bitter), phytol (floral) | No |
| cinnamon | menthone, dodecanol, one fruity compound | No |
| cumin | mannitol, terpineol (floral) | No |
| gin, rum | thiamine (mild, sour, bitter) | No |
| ginger | nonane (gasoline) | No |
| garlic | dimethyl trisulfide (sulphur, onion) | Yes |
| onion | a sulphur compound plus coumarin, prune, vanillic acid | Partly |
| tomato | isoamyl butyrate (apricot, whiskey, banana), hexyl hexanoate, coumarin | No: whiskey and banana for tomato |
| mushroom, parmesan | a different fruit-ester list, coumarin | No |
| black pepper, clove, bacon, oak, whiskey, rose water, lavender | not in the file | No data |

11 of the 31 names I checked are absent from the file or have nothing left. Of the other 20, a cook would recognise the aroma for about 5 (mint, lemon, garlic, and partly basil and onion).

**A mechanical cross-check.** I mapped the descriptor tags to the six axes with a crude regular expression and compared the strongest axis it gave with the hand-tuned table below, over the 202 table ingredients that have both. For 75 the tags gave no signal after removing the four common compounds; for the other 127 the strongest axis agreed with the table for 41 (32%). Orange, grapefruit juice, brandy and orange liqueur are among the disagreements (the tags say floral, spicy or fatty; every cook would say fruity). A better tag map would not fix this: the ubiquity and the missing compounds are in the data, not in the map.

**Verdict: not usable**, neither as the main source nor as a secondary source. A fallback would give plausible-looking but wrong aromas to the 700 or so ingredients that have a few specific compounds (tomato smelling of whiskey, vanilla of peppermint) and nothing to the rest, and a wrong bar is worse than no bar. So FLAVOR-5 builds the aroma half from a hand-tuned table only (the way the taste half was finished in FLAVOR-4), skips the planned tag map, build step and generated aroma file, and leaves ingredients outside the table with no aroma data. The file `gnn_compounds.json` is not read by any chart and nothing new loads it.

## After FLAVOR-5 (2026-11-16, aromas from a hand-tuned table, not the model)

### What changed

- `src/data/flavorAromas.js` is a table of about 330 ingredient lines: for each of the six aromas (fruity, floral, green, woody, spicy, fatty) a strength of 0 to 3 per gram, plus an aroma **potency** (how many grams of an ordinary ingredient one gram counts as: mint leaf 10, cloves 8, vanilla 6, rose water 8, saffron 12, bitters 5 to 6, citrus peel 2, base spirits 0.7, water 0). It covers every ingredient the strength table covers, plus fruits, flowers, herbs, spices, nuts, teas and cheeses, and the garnishes that matter in cocktails. Written by the assistant from common culinary knowledge on 2026-11-16; the correction rule is at the top of the file.
- `src/data/flavorAroma.js`: `aromaProfile(lines, lookup, opts)`, shaped like `tasteProfile`: amount-weighted by grams times potency, an ingredient with no aroma of its own (water, sugar, vodka) counted as data that dilutes at a quarter of its amount, an ingredient with no line "not counted", the same 0 to 1 scale, drivers, `charted`.
- The chart's aroma half in `recipeProfileAnalysis.js` (and so the overview bars, per-axis pages, flavor map, boost and temper ranking, and the three invent panels) now comes from `aromaProfile`. The model's per-ingredient aroma values (`gnnProbs`) are no longer read by any recipe chart. The draw rule is unchanged: an aroma half draws only when at least two ingredients, and at least half, have an aroma line.
- A cocktail's garnish text now adds to the aroma half only: a citrus twist, peel or zest is 2 g of that fruit, a wedge or wheel 1 g, a mint sprig or bouquet 2 g mint, rosemary, basil, thyme, sage 2 g, nutmeg 0.5 g, cinnamon 1 g, coffee beans 1 g; any other garnish adds nothing (`garnishAromaLines`). It does not change the taste half.
- A bare count of a whole citrus fruit ("1 orange", the resolved name of "twist orange peel") counts for aroma as its zest (lemon 6 g, lime 5 g, orange 8 g, grapefruit 10 g), because the smell of citrus is in the peel. The taste half still weighs the whole fruit.
- The axis called "spicy" is the smell of aromatic spice (cinnamon, clove, nutmeg, black pepper, ginger, cumin), not chili heat, which is the taste axis Heat. The chart now labels it **Spice** (it said "spicy"). The internal ids (`odor_spicy`) are unchanged.
- **Vanilla and the sweet-woody family** (vanilla, caramel, toast, roast, coffee, cocoa, nuts, smoke, oak) are WOODY. The creamy side of vanilla is a smaller fatty value.
- `scripts/measureFlavorProfile.mjs --aroma` scores the aroma half against `data/aroma-truth.json`; `scripts/buildShareIndex.mjs` passes the garnish so server cards compute the same bars when charts are turned on (they are still off, `bars: []`).

### The aroma test set (`data/aroma-truth.json`)

40 items written by the assistant on 2026-11-16 before the table was tuned, not independently checked: 20 single ingredients (charted through the same aroma function with one line, which skips the two-ingredient draw rule) and 20 built-in recipes. Each lists the aromas that must ALL be among the chart's top two aroma bars, and aromas that must not lead. 30 are the tuning set; 10 are marked `"holdout": true` and were not tuned against (strawberry, lavender, clove, smoked paprika, Chimichurri, Eggnog, Mint Julep, Mole Poblano, White Russian, Apple Pie).

One thing to know about how independent it is: I wrote the table after the key and with the key's items in view, so even the first run was not blind. The hold-out is "not tuned against after the first run", not "never seen".

### Result, as printed

Before (the model's aroma values, which is what the chart drew until now; a throwaway script ran the old chart code before any change):

```
Tuning set: items 30, as expected 4/30 (13.3%), forbidden leads 4, no aroma 22
Hold-out: items 10, as expected 0/10 (0%), forbidden leads 0, no aroma 10
```

(22 of the 30 tuning items and all 10 hold-out items had no aroma bars at all. The four "ok" ones were vanilla, cinnamon, bourbon and Manhattan, from the model's woody lean; mint, basil, olive oil and orange were forbidden leads.)

After (`node scripts/measureFlavorProfile.mjs --aroma`):

```
Tuning set: items 30, as expected 30/30 (100%), forbidden leads 0, no aroma 0
Hold-out: items 10, as expected 8/10 (80%), forbidden leads 0, no aroma 0
```

What took the tuning set from 28 to 30: three general changes made after the first run, listed so nothing is hidden. (1) A bare count of a whole citrus fruit counts as zest (the Manhattan's "twist orange peel: 1" had been weighing 60 g of orange). (2) Tomato lowered to green 1.2, fruity 0.6, potency 0.8 (a cup of tomato puree was out-smelling 2 teaspoons of garam masala in the Tikka Masala). (3) Ground spice potencies raised by 1 to 2 (cumin 5, garam masala 6, cinnamon 5, nutmeg 6, curry paste 4, cardamom 6, turmeric 3, allspice 6, star anise 6, caraway 5, coriander 3): a gram of ground spice is among the most aroma-potent things in a dish. The third change moved the hold-out the wrong way: Apple Pie, which was right before, now misses.

The two hold-out misses:
- **Apple Pie** (fatty 0.24, spice 0.24, fruity 0.24; expected fruity): the recipe's apples are "1.2 kg", and `amountGrams` has no kilogram unit, so the apples get the recipe's mean weight and count for about 30 g instead of 1,200 g. That is a gap in the shared amount reader (it also affects the taste half), not in the aroma table, and I did not change it because it would move the taste numbers this task must not move.
- **Mole Poblano** (woody 0.48, green 0.13, fruity 0.10; expected spice and woody): chocolate (50 g) outweighs the one cinnamon stick and the dried chilies' woody and fruity notes. Left as a miss: a cook might call a mole woody first.

The main key's four aroma expectations (`npm run measure:flavor`, line "Aroma as expected"): **0/4 before, 4/4 now** (Mojito, Pina Colada, Salsa Verde, Pesto). `data/flavor-truth.json` and `data/flavor-holdout.json` were not edited.

The taste half is unchanged, as printed:

```
Items 41. Top taste expected: 36/41 (87.8%). Top two both expected: 31/34 items with 2+ expected (91.2%). Forbidden taste leads: 0. No chart: 0. Ingredients counted: 99.6%. Aroma as expected: 4/4 (100%).
Items 20. Top taste expected: 19/20 (95%). Top two both expected: 14/16 items with 2+ expected (87.5%). Forbidden taste leads: 1. No chart: 0. Ingredients counted: 100%. Aroma as expected: 0/0 (null%).
```

(The second line is the taste hold-out, `--truth data/flavor-holdout.json`; it has no aroma expectations.)

Aroma charts as printed for the four main-key items: Mojito fruity 0.51, green 0.16, woody 0.10; Pina Colada fruity 0.59, fatty 0.29; Salsa Verde green 0.63, fruity 0.10; Pesto green 0.42, fatty 0.25, spice 0.10. Old Fashioned: woody 0.50, spice 0.23, fruity 0.15.

### What is still weak

- **Not every ingredient has a line.** An ingredient outside the table has no aroma data. A recipe still draws an aroma chart when at least two, and half, of its ingredients have a line; the rest are listed as not counted.
- **The six axes are a coarse view of smell.** Fish, shellfish, garlic's sulphur, fermented and sour smells have no axis; those ingredients are written as aroma-less or at a low value on the nearest axis.
- **Cooking changes aroma** (browning, caramelising, reducing). The chart reads raw ingredients.
- **Manhattan** leads fruity (0.41) with woody second (0.38): the cherry and the orange twist outweigh the bourbon. It passes its check (woody in the top two) but a bartender would put woody first.
- **Kilograms.** `amountGrams` did not read "kg" (fixed in FLAVOR-6: it does now, and the Apple Pie hold-out item moved from wrong to right).

### How to correct a line

Edit its numbers in `src/data/flavorAromas.js` (keep the name as spelled), then run `npm run measure:flavor -- --aroma` and `npm test -- flavorAroma`. Do not add a line to make one recipe come out right: ask whether a cook would agree with the line on its own.

### Tests

`flavorAromas.test.js`: the table is well formed (axes on 0..3, potency present, aroma-less entries have potency 0), every name is a real ingredient or on the short `NOT_IN_GRAPH_AROMA` list (itself checked), every strength-table ingredient has an aroma line, potent things are potent and bulk things are not, vanilla is woody, garnish parsing. `flavorAroma.test.js`: `aromaProfile` (scale, counted and uncounted, a mint leaf or a twist against 2 oz of spirit, a dash of bitters is a note, the table overrides a fallback lookup, aroma-less dilution, unmeasured amounts, citrus zest, bad input), `nodeProbs` never reads the model, the draw rule, a spirit, citrus and sugar cocktail draws its citrus aroma, garnish adds to aroma only, `profileDelta`. `flavorAroma.realData.test.js`: spot checks on real data (mint green, lemon fruity, butter fatty, black pepper spice, rose water floral, vanilla woody, a Mojito green and fruity, an Old Fashioned woody, Pesto green, Hollandaise fatty), the aroma key is well formed with a 10-item hold-out, tuning set at least 85%, hold-out at least 70%, the main key still 36 of 41 on taste with its four aroma expectations met.

## What comes next

- FLAVOR-2 (done, see above) stops drawing a chart from the repeated placeholder rows: ingredients carrying them count as having no flavor data, and a recipe without enough real data shows "not enough flavor data" instead of a chart.
- FLAVOR-3 (done, see above) draws the tastes from the curated taste word each ingredient already has (salt is salty, sugar is sweet, coffee is bitter), weighted by how much of it the recipe uses, and adds heat as a sixth taste.
- FLAVOR-4 (done, see above) hand-tunes strengths for the ingredients that matter most, so a dash of bitters and two ounces of gin no longer weigh the same.
- FLAVOR-5 (done, see above) found the published aroma descriptors unusable (see "Aroma data assessment") and draws aromas from a hand-tuned table instead of the model.
- FLAVOR-6 (done, see "Where the charts stand") makes every surface use the same profile, makes the wording honest, turns the public charts back on and re-measures on this same test set.

## Shared pages and cards: hidden, then back (SHARE-8, FLAVOR-6)

After FLAVOR-2, 186 of 599 built-in recipes still drew a chart and most of those led with a wrong taste (`npm run measure:flavor`). So from 2026-11-15 the public share surfaces (the `/r/` page, the share pictures, the link-preview cards, and the bars stored with a user's shared recipe) drew no chart. FLAVOR-6 turned them back on (2026-11-16, in the working tree; the task did not deploy). The switch is still `SHARE_CHARTS_ENABLED` in `src/data/shareTargets.js`: set it to `false` and run `node scripts/buildShareIndex.mjs` to hide the chart on every public surface again.

## How neutral and rich are treated (2026-11-15, DATA-5)

The ingredient taste labels now have ten words: the eight old ones plus `neutral` and `rich` (the full rules are in `docs/data-quality.md`, "How taste labels are assigned"). FLAVOR-3 reads them like this:

- **The six chart tastes** are sweet, sour, bitter, salty, umami and heat. First word of a label counts 1.0, second 0.6, third 0.35. `spicy` and `pungent` both feed heat. `astringent` counts half toward bitter.
- **`neutral`** contributes to no taste axis. The ingredient still counts as an ingredient with data (it is counted, not uncounted), so a recipe of flour and water is a recipe with no taste, not a recipe with no data. `neutral` always stands alone in a label.
- **`rich`** is a mouthfeel, not a taste. It contributes to none of the six axes. It may lead a label (`rich sweet` for cream): the word after it still counts at the position it holds, so cream gives sweet 0.6, not 1.0. If a chart shows richness at all it is shown separately from the six tastes.
- Spirits carry no heat word: the burn of alcohol is not charted as heat. Many herbs and warm spices carried `pungent` from the generated data; FLAVOR-3 removed it from 103 of them (see "After FLAVOR-3").

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

## Where the charts stand (2026-11-16, FLAVOR-6)

### What the chart is now, in plain words

Every chart in the app and on the public pages comes from one function. Each ingredient has a taste label written by hand (sweet, sour, bitter, salty, umami, heat; ten label words in all, see DATA-5) and a hand-tuned strength for the ingredients that matter most, plus a list of aroma notes (fruity, floral, green, woody, spice, creamy). The chart adds these up over the recipe, each ingredient counting in proportion to how much of it the recipe uses, and draws the strongest bars. A salt rim, a twist or a sprig in a cocktail's garnish text counts as a small fixed amount. The model's per-ingredient numbers are not read by any recipe chart.

### The numbers at each stage, as `npm run measure:flavor` printed them

Main set (41 items, `data/flavor-truth.json`):

| Stage | Top taste right | Top two right | Wrong taste leads (forbidden) | Recipes with no chart | Aroma checks |
|---|---|---|---|---|---|
| Baseline (the old chart, 2026-11-15) | 20/41 (48.8%) | 7/34 (20.6%) | 12 | 0 | 0/4 |
| After FLAVOR-2 (placeholders no longer drawn) | 4/41 (9.8%) | 3/34 (8.8%) | 6 | 27 | 0/4 |
| After FLAVOR-3 (labels weighted by amount) | 30/41 (73.2%) | 19/34 (55.9%) | 8 | 0 | 0/4 |
| After FLAVOR-4 (hand-tuned strengths) | 36/41 (87.8%) | 31/34 (91.2%) | 0 | 0 | 0/4 |
| Final (FLAVOR-5 aromas, FLAVOR-6 units and garnish) | 36/41 (87.8%) | 31/34 (91.2%) | 0 | 0 | 4/4 |

Taste hold-out (20 recipes written before the strength table was tuned, `data/flavor-holdout.json`; first measured on the FLAVOR-3 function, so there is no baseline or FLAVOR-2 figure):

| Stage | Top taste right | Top two right | Wrong taste leads |
|---|---|---|---|
| After FLAVOR-3 | 15/20 (75%) | 9/16 (56.3%) | 3 |
| After FLAVOR-4 | 19/20 (95%) | 14/16 (87.5%) | 1 |
| Final | 19/20 (95%) | 14/16 (87.5%) | 1 |

Aroma sets (`data/aroma-truth.json`: 30 tuning items and 10 hold-out items, `npm run measure:flavor -- --aroma`; an item is right when every expected aroma is in the top two aroma bars):

| Stage | Tuning set | Hold-out | Wrong aroma leads |
|---|---|---|---|
| Before FLAVOR-5 (the model's aroma values) | 4/30 (13.3%) | 0/10 (0%) | 4 (tuning) |
| After FLAVOR-5 (hand-tuned table) | 30/30 (100%) | 8/10 (80%) | 0 |
| Final (kilograms now weighed) | 30/30 (100%) | 9/10 (90%) | 0 |

How to read them: the tuning-set aroma figure and the main taste set were both in view when the tables were written, so they flatter the tables. The two hold-outs were written first and are the honest figures. With 10 and 20 items, one item is 10 and 5 points.

### What is still wrong, by item

- **Bloody Mary** charts sour first (0.45) and umami second; a cook would say savory first.
- **Tequila Sunrise** charts sour 0.50 over sweet 0.42 (the codex recipe has lime juice).
- **Nuoc cham** charts umami and salty over sour; fish sauce outweighs the lime.
- **Thai green curry (dish)** charts creamy and umami first; heat and Spice (a separate bar) are third and fourth. The curry paste is 45 g beside 500 g of chicken and 400 ml of coconut milk.
- **Tom yum** charts umami first; sour is not on the chart.
- **Margarita** charts fruity (lime) and sweet over sour. The codex has three-quarters of an ounce each of orange liqueur, lime and syrup, so it is a sweet drink on paper. The salt rim shows as a very small bar.
- **Mojito** charts fruity (lime) first and green (mint) third. The codex line for the mint is "2-4 Mint" and reads as about a dash; a cook would put mint first.
- **Beef Bolognese** charts umami first, as it should, but green second (tomato, onion, carrot and celery all carry some green).
- **Teriyaki** charts salty, umami, woody, then sweet; mirin and brown sugar are in the recipe and sweet is low.
- **Manhattan** charts fruity before woody (cherry and orange outweigh the bourbon).
- **Mole poblano** (aroma hold-out) charts woody first; chocolate outweighs the cinnamon stick.
- **Beef Pho** (taste hold-out) charts sweet first: one amount reads "1.5 kg bones + 300 g sirloin" and cannot be parsed, star anise has no line, and there is no stock line.
- **Pad Thai Sauce**: sour leads, but umami beats salty for second.
- **Not charted at all:** garlic's and onion's sulphur, fish and fermented smells have no aroma axis (they are written as aroma-less or at a low value on the nearest axis); cooking (browning, reducing) is not modelled; amounts are read from the recipe text, so a line with no amount gets a typical portion or the mean of the others.
- **Spice and Heat sit side by side** on a chart that has both (curries). They are different things (aromatic spice versus chili burn) but look alike on a card.

### How to correct a line (one procedure for labels, strengths and aromas)

1. Find the ingredient, spelled exactly as the app spells it (a name the app does not know fails the tests on purpose).
2. Taste label: `src/data/curation/tasteOverrides.json` (one ingredient, a label made of the ten words in `docs/data-quality.md`). Taste strength: one line in `src/data/flavorStrengths.js` (the six tastes, 0 to 3, and `potency`; the scale is at the top of the file). Aroma: one line in `src/data/flavorAromas.js` (the eleven aromas, 0 to 3, and `potency`; the file header says what each axis means). To say what one of the ingredient weighs when a recipe gives no amount, add it to `DEFAULT_GRAMS` in the strengths file.
3. Ask whether a bartender or cook would agree with the line on its own. Do not change a number only because one recipe came out wrong.
4. Run `npm run measure:flavor`, `node scripts/measureFlavorProfile.mjs --truth data/flavor-holdout.json` and `npm run measure:flavor -- --aroma`; for an aroma line also `node scripts/checkAromaAgreement.mjs` (a new disagreement with the second source must be fixed or recorded with a reason in `data/review/aroma-accepted.json`; `npm run audit:data -- --check` fails otherwise) and `node scripts/measureFlavorProfile.mjs --aroma-blind --axes eleven --no-holdout-detail`. Check the recipes you care about. Run `npm test -- flavorStrengths flavorAroma` for the table checks.
5. To make the public cards and pages pick it up, run `node scripts/buildShareIndex.mjs` (it also runs in `npm run build`), commit the regenerated `functions/src/share/share-cards.json`, and deploy (see `docs/sharing.md`).

### What the charts are NOT

- **Not measured chemistry.** No instrument or published compound data sits behind the bars. The molecular model's per-ingredient values are not used by any recipe chart (FLAVOR-5 found the published aroma data unusable; see "Aroma data assessment").
- **Not a taste test.** They say which tastes and smells the ingredients lean toward, weighted by amount; they do not say how the dish will taste once cooked.
- **Hand-written judgement.** The taste labels, the strengths and the aroma lines were written by an AI assistant from common culinary knowledge. A professional has not checked them. The hold-out figures above are the evidence they behave sensibly, not proof they are right.

### What was removed, and what still reads the model (FLAVOR-6)

The placeholder detection from FLAVOR-2 (`flavorPlaceholders.js`, its generated JSON, `scripts/buildFlavorPlaceholders.mjs` and the `prebuild` and predeploy steps) is gone: nothing reads the model's per-ingredient values for a recipe chart any more, so there is nothing to detect. Still reading the model's per-ingredient values, and kept on purpose: the single-ingredient wheels and radars (Ingredient panel, affinity and pairing cards, the distilled profile, suggestion drawers, the aroma filter in the suggestion popout, the odor badge) and the parked 3D Network views. None of these draws a recipe's flavor chart. The app still downloads the model file once for those surfaces; the public shared page and the share images do not.

`recipeAromaSimilarity.computeRecipeAroma` (the fallback that matches a recipe to cocktails and sauces by aroma when no pairing data is loaded, and decides whether the Find buttons are enabled) now uses the new aroma profile. On ten Cookbook recipes the old values returned the same two cocktails (Bloody Mary and Pisco Punch) for every recipe and ties at 100% for most sauces; the new ones vary by recipe.

## Aromas: a blind test (2026-11-16, AROMA-1)

### Why a second key was needed

The first aroma answer key (`data/aroma-truth.json`) was written in the same pass that wrote the aroma table, with the table in view. Its 30 of 30 therefore proves little: the key and the table agree because one author wrote both while looking at each other. This task measures the same charts against two keys that did not see the table.

### How the two new keys were made

- **Blind key, `data/aroma-truth-blind.json`.** Written by the assistant from general culinary knowledge on 2026-11-16 BEFORE the aroma table, the first key or any aroma score was read, and committed alone first (commit 68e4354). Not independently checked; the owner may correct any line. 70 single ingredients and 44 built-in recipes (17 cocktails, 13 sauces, 14 dishes), each with 1 to 3 expected aromas from the eleven-aroma vocabulary (fruity, floral, green, woody, spice, fatty, toasty, nutty, earthy, smoky, savory), chosen to be non-debatable. 38 items (every third of each group, spread across kinds) are marked held back. Because today's charts have only the first six aromas, each item also carries `expect6`, the same expectation restricted to those six; an empty `expect6` means today's chart cannot express the item at all.
- **Outside key, the chef-sourced entries of `public/proDataset/flavor_profiles_distilled.json`.** 304 ingredients whose aroma words were set by a chef rather than distilled by a model. The 17 words are turned into the eleven aromas (and into today's six) by one table, `src/data/aromaWordMap.js`. The word lists carry no order, so an item counts as right when the chart's strongest aroma is anywhere in the list.

### How it is scored

`node scripts/measureFlavorProfile.mjs --aroma-blind [--list]` and `--aroma-chef`, or `npm run measure:aroma`. A single ingredient is charted through the same `aromaProfile` function the app uses, with one line; a recipe through the app's own chart. "Strongest aroma expected" means the highest bar is one of the expected aromas; "one of top two" means either of the two highest is. Items whose six-axis expectation is empty are counted separately and not scored. `--axes eleven` scores against `expect` and the eleven names, for AROMA-3.

### Today's scores, as printed (six axes)

Blind key:

```
All: of the scored items that have aroma data, strongest aroma expected 67/73 (91.8%)
All: items 114; cannot be expressed on six axes 38; scored 76; strongest aroma expected 67/76 (88.2%); one of top two expected 70/76 (92.1%); forbidden leads 0; no aroma data 8
Tuning (not held back): items 76; cannot be expressed on six axes 25; scored 51; strongest aroma expected 43/51 (84.3%); one of top two expected 46/51 (90.2%); forbidden leads 0; no aroma data 7
Held back: items 38; cannot be expressed on six axes 13; scored 25; strongest aroma expected 24/25 (96%); one of top two expected 24/25 (96%); forbidden leads 0; no aroma data 1
```

Chef key:

```
All: of the scored items that have aroma data, strongest aroma expected 113/132 (85.6%)
All: items 304; cannot be expressed on six axes 44; scored 260; strongest aroma expected 113/260 (43.5%); one of top two expected 124/260 (47.7%); forbidden leads 0; no aroma data 153
```

### What it means

- **Of the items the six-axis chart can express and has data for, it does well** (about 88 to 92% on the blind key, 96% on the held-back third). The earlier 30 of 30 was not far off for the six aromas the chart has.
- **A third of what a cook expects cannot be shown at all.** 38 of 114 blind-key items (33%) and 44 of 304 chef-key items (14%) expect only aromas the six axes lack (roasted, nutty, earthy, smoky, savory and the like): fish sauce, anchovy, oyster, miso, soy, cocoa, coffee, caramel, nuts, mushroom, truffle, bacon, smoked paprika, mezcal, and recipes such as French onion soup, miso soup, barbecue ribs, cookies and hummus. Today's chart folds roasted, nutty, earth and smoke into "woody" and meat and cheese into "fatty". That is the case for AROMA-3 (eleven axes), not for tuning the table.
- **The chef key is much lower than the blind key (43.5% of scored; 85.6% of those that have data).** The gap is coverage: 153 of 304 chef-key ingredients have no line in the aroma table, so the chart draws nothing for them. Where the table has a line it agrees with the chefs about as often as it agrees with the blind key.
- **Held-back 96% is the least reliable number**: 25 scored items, one miss. The tuning set was not tuned (the table was never seen by the key's author), so the held-back split matters less here than in FLAVOR-5, but keep it for AROMA-2.
- **Limits.** The blind key is one assistant's judgement, not checked by a cook. Single-ingredient and recipe items are pooled. "No aroma data" includes items that are also inexpressible on six axes, so the two counts overlap.

### Worklist for AROMA-2 and AROMA-3 (nothing was changed here)

Ingredients where the chart has no data, or the wrong lead (ingredient: what the chart says; what the key expects):
- elderflower: no line; floral. orange blossom: no line; floral. curry powder: no line; spice.
- beet, pistachio, prosciutto, anchovy, fish sauce, oyster, espresso: no line (nothing drawn); expect earthy, nutty, savory, savory, savory, savory, toasty (eleven axes needed to say so).
- mezcal: woody 0.67, green 0.33; smoky. coffee liqueur / espresso / cocoa / caramel / brown sugar: woody (or nothing); toasty. amaretto, sherry and the nuts (almond, hazelnut, walnut, tahini, sesame oil): woody with some fatty; nutty. mushroom, truffle: woody; earthy. bacon: woody 0.83, fatty 0.67; smoky then savory. smoked paprika: woody; smoky. soy sauce, miso, parmesan, blue cheese: woody or fatty; savory.
- cardamom (chef key): spicy 0.73 with floral 0.33; chef set says green or woody, which the blind key does not. Check before acting.

Recipes:
- cocktail/white-russian: woody 0.43, fatty 0.24; key fatty first. cocktail/brandy-alexander: woody 0.48, fatty 0.21; fatty first. dish/tiramisu: woody 0.31 tied with fatty 0.31; fatty first. (Coffee and cocoa are read as woody and outweigh the cream; fixed in effect by a toasty axis.)
- sauce/mole-poblano: woody 0.19, fatty 0.16, spicy 0.11; expects toasty then spice. dish/baklava: fatty 0.54, woody 0.20; expects nutty and spice, spice absent. dish/pho: fatty 0.20, woody 0.15, green 0.10; expects spice (star anise, cinnamon) first, spice absent.
- sauce/beurre-noisette (nutty, toasty), sauce/peanut-sauce-thai (nutty), sauce/romesco (nutty, smoky), sauce/bbq-sauce (smoky), dish/hummus (nutty), dish/bbq-ribs (smoky), dish/chocolate-chip-cookies (toasty), dish/french-onion-soup, dish/miso-soup, dish/linguine-vongole (savory), cocktail/irish-coffee (toasty): inexpressible on six axes; they need AROMA-3 first.

The chef key's list of ingredients with no line in the table (153) is the bigger AROMA-2 job; `node scripts/measureFlavorProfile.mjs --aroma-chef --json` lists them.

### Not verified

The blind key has not been checked by a cook. The word map's six-axis column drops words with no home (caramel, earthy, fermented, marine, meaty, nutty, roasted, smoky), so the chef key's six-axis score depends on that choice.

## Aromas: second-opinion check (2026-11-16, AROMA-2)

### What the check is

The app holds two independently produced sets of aroma labels: the hand-tuned table (`src/data/flavorAromas.js`, written by the assistant) and `public/proDataset/flavor_profiles_distilled.json` (3,927 ingredients; 304 set by a chef, the rest by an earlier AI labelling pass). `node scripts/checkAromaAgreement.mjs` compares them line by line. **The second source is a second opinion, not ground truth**: most of it is also AI-written, and it uses 17 words where the chart has six aromas. A disagreement is a prompt to look, never a verdict.

How it works (`src/data/aromaAgreement.js`, pure, with tests):

- Each table line is matched to the second source by name, through the curation layer (accents ignored, merged names followed in both directions). Lines with no aroma of their own (water, sugar, flour) are not compared. Lines with no counterpart are counted.
- The second source's words are mapped to the axes in use by `src/data/aromaWordMap.js`. A line AGREES when its strongest aroma (any axis tied for strongest) is among the mapped aromas. Words with no home on the axis set (roasted, nutty, earthy, smoky, savory ones) are reported as such, not scored; a second source whose words all lack a home is "no aroma that fits these axes" and is not a disagreement. `--axes eleven` judges against the eleven-aroma set for AROMA-3.
- Every disagreement is printed with both sides, the table line's values and whether the second source's entry is chef-sourced. Each one is read and either the table line is corrected, or the disagreement is recorded in `data/review/aroma-accepted.json` with a reason and a kind: `table-right`, `both-defensible`, or `missing-axis` (the right aroma has no axis yet, with the aroma it should become; AROMA-3 re-decides these). `data/review/aroma-disagreements.tsv` lists the unreviewed ones (empty when all are decided).
- `npm run audit:data -- --check` runs it: an unreviewed disagreement, or an accepted entry that no longer disagrees, fails the check (`aroma-disagreement-unreviewed` and `aroma-accepted-stale` in the baseline, both 0). Proved by a temporary edit (mint made woody): the check failed with one unreviewed disagreement, and passed again once the edit was reverted.

### Numbers, as printed

Before (332-line table):

```
strongest aroma agrees: 225/254 (88.6%); chef-sourced 114/127 (89.8%)
one of the top two agrees: 249/254 (98%)
disagreements: 29
```

After (335 lines: elderflower, orange blossom and curry powder added):

```
strongest aroma agrees: 244/257 (94.9%); chef-sourced 124/130 (95.4%)
one of the top two agrees: 254/257 (98.8%)
disagreements: 13 (all 13 recorded; unreviewed 0)
```

26 table lines have no counterpart in the second source (mostly bar bottles: kirsch, aquavit, fernet branca, creme de cassis and so on) and 25 more have a second source whose aromas all lack an axis today (rum, whiskey, peanut, sesame oil, dashi, bonito flakes). Neither group can be checked on six axes.

Of the 29 disagreements: 16 table lines corrected (gin, both vermouths, tomato juice, tomato sauce, chili, red chili, chili flake, chili powder, ancho and guajillo chili, Sichuan peppercorn, fennel, lemongrass, rosemary, sage), 11 recorded as `missing-axis`, 1 `table-right` (clove) and 1 `both-defensible` (cardamom).

Other measures, before and after, as printed:

| Measure | Before | After |
| --- | --- | --- |
| Blind key, all (strongest aroma expected, scored items) | 67/76 (88.2%) | 71/76 (93.4%) |
| Blind key, tuning (not held back) | 43/51 (84.3%) | 47/51 (92.2%) |
| Blind key, held back | 24/25 (96%) | 24/25 (96%) |
| Chef key | 113/260 (43.5%); 153 with no table line | 123/260 (47.3%); 150 with no table line |
| First answer key (`--aroma`), tuning / hold-out | 30/30, 9/10 | 30/30, 9/10 |
| Taste, main set / hold-out | 36/41, 19/20 | 36/41, 19/20 |

Three of the four blind-key gains are the three added lines (elderflower, orange blossom, curry powder), which were "no aroma data"; the fourth is White Russian, once coffee liqueur stopped standing in as strong woody. The held-back third was not looked at item by item while lines were decided (the measure script takes `--no-holdout-detail`), and its score did not move.

### Judgement calls the owner may disagree with

| Line | Now | Was | Why |
| --- | --- | --- | --- |
| gin | woody 1.3, green 1.2, fruity 1.1, spice 0.9, floral 0.5 | green 1.5 first | Juniper is pine resin (woody; the chef entry for juniper berry says green AND woody), with citrus peel and coriander close behind. Reasonable people lead with juniper as green. |
| vermouth, dry | floral 1.2, green 0.8, spice 0.7, fruity 0.4, woody 0.4 | spice 1 first | Chamomile, citrus peel and wormwood read floral and herbal before spice. |
| sweet vermouth | woody 1.1, spice 1, fruity 0.7 | spice 1.2 first | Vanilla and caramel (woody on this chart) lead, then warm spice. |
| cardamom | spice 2, green 1.4, floral 1 | spice 2.2, no green | Kept spice-first (a cook files it with the warm spices) and added the eucalyptus-green freshness the chef entry names. Recorded as both-defensible. |
| clove | unchanged | | The chef entry says woody alone; clove is the archetypal spice aroma. Recorded table-right. |
| chilies | fruity first (chili, red chili, chili flake, ancho, guajillo); chili powder spice first | green or woody first | Dried and red chilies smell of dried fruit; heat is a taste axis, so the second source's "spicy" for a chili does not make the aroma "spice". Chili powder is a blend with cumin and oregano. |
| lemongrass | green 2, fruity 1.8 | fruity 2.2 first | The chef entry says green only; citral is undeniable, so it stays close behind. |
| rosemary, sage | woody first, green close | green first | Rosemary and sage are "woody herbs" with a pine-camphor edge (chef entries say woody). |
| fennel | green 1.8, spice 1.4 | spice 2 first | The only recipe using it (bouillabaisse) means the bulb; the chef entry says green. Fennel seed has no line. |
| coffee liqueur, kahlua, creme de cacao | woody 1 | woody 2.5 | Woody was standing in for roast and cocoa, which have no axis yet; at 2.5 it outweighed cream in a White Russian. 1 keeps only the vanilla and oak. Toasty is AROMA-3's. |
| chocolate | fatty 0.8 added, woody unchanged | | The chef entry names fatty (cocoa butter). |
| tomato juice, tomato sauce | fruity first | green first | Cooked tomato is sweet and fruity; fresh juice keeps a green note beside it. |

### What was left alone, and why

- **Pho and baklava still have little spice on the chart.** Their star anise, cinnamon and ginger lines exist and are at table strength; the spice is small beside the beef (1.5 kg of bones counts as meat) and 450 g of butter, nuts and phyllo. That comes from how amounts weigh in, not from a table line, so it was left for a decision about amounts rather than raising spice potencies to flip two test items.
- **Pistachio, rice noodle and phyllo dough have no line** (pistachio would be nutty, which has no axis; the other two would be aromaless). Left for AROMA-3.
- **Lines whose second source has only words with no axis** are not disagreements and are not in the accepted file; the full list with the aroma each should get is in AROMA-3's worklist (the AROMA-2 report).
- 150 of the 304 chef-key ingredients still have no table line; only the three on the AROMA-1 worklist that six axes can express were added.

### Not verified

The second source has no ground-truth check of its own. A cook has not reviewed the 16 corrections or the 13 recorded decisions; each is a judgement from common culinary knowledge on 2026-11-16.

## Aromas on eleven axes (2026-11-15, AROMA-3)

### What changed and why

The blind key (AROMA-1) showed that **38 of 114 items (a third) expect aromas the six axes could not show**: roasted, nutty, earthy, smoky and savory. The old table used "woody" as a stand-in for roast, nuts, smoke and soil, and gave fish sauce, anchovy, shellfish and most mushrooms no honest home at all. The aroma half of every chart now has **eleven axes**: the six it had (fruity, floral, green, woody, spice, creamy) plus

| Chart id | Label | Means |
| --- | --- | --- |
| `odor_toasty` | Toasty | roasted, caramelised, baked, browned: coffee, cocoa, caramel, brown sugar, maple, malt |
| `odor_nutty` | Nutty | nuts and seeds, almond, sesame, brown butter, sherry, aged cheese |
| `odor_earthy` | Earthy | mushroom, truffle, beet, root vegetables, soil, bitter roots, turmeric and cumin |
| `odor_smoky` | Smoky | mezcal, peated whisky, smoked paprika, bacon, chipotle, liquid smoke |
| `odor_savory` | Savory | meaty, marine, fermented, aged: fish sauce, anchovy, soy, miso, parmesan, stocks, shellfish |

Every one of the 335 lines of `src/data/flavorAromas.js` was re-read. **137 were changed, 198 left as they were, 75 were added (410 lines now).** Of the changed lines, 7 had been "no aroma of their own" and now have one (fish sauce, anchovy, fish stock, shrimp, white fish, clam, mussel). Values that stood in for a missing axis were moved: coffee, coffee liqueur, kahlua and creme de cacao, cocoa, chocolate, caramel, brown sugar, maple and molasses to toasty; almond, almond milk, almond syrup, nuts, tahini, sesame and sherry to nutty; mezcal, smoked paprika, liquid smoke and bacon to smoky; mushroom and truffle to earthy; soy, miso, parmesan, blue cheese and stocks to savory. Added lines: fish and shellfish (oyster, scallop, crab, lobster, squid, sardine, tuna, caviar and more), cured meat (prosciutto, chorizo), the soy family (shoyu, tamari, oyster sauce, hoisin), misos and doenjang, kombu and wakame, stocks, mushrooms (shiitake, portobello, porcini, chanterelle), beet, parsnip, turnip, sweet potato, espresso, black tea, matcha, brown butter, chocolates, nutella, toffee, malt, bread, popcorn, balsamic and sherry vinegar, nuts and nut butters. 212 of the 410 lines now carry at least one of the five new axes. The file header says what each line means; a test fails if an axis name outside the eleven appears.

Stocks were also lowered from potency 0.7-0.8 to 0.4-0.6: they are mostly water, and at the old value a litre of stock outweighed the chocolate in a mole. A line says what the ingredient smells of raw or as bought; cooking-method aromas (browning, frying) are still not modelled. An ingredient with an aroma line but no strength line is simply charted for aroma only: taste and aroma are judged apart.

### Colours

Seventeen colours on the chalk slate (`#1c1c1c`, with `#0a0a0a` behind). The six tastes keep theirs; the five old aromas that clashed were moved and the five new ones chosen with them (CIEDE2000; the closest pair, spice and toasty, is 14.4 apart). **Spice no longer shares Heat's red.** Every colour has at least 3:1 contrast on the slate (a test pins both this and the distance).

| Axis | Colour | Contrast on #1c1c1c |
| --- | --- | --- |
| sweet, sour, bitter, salty, umami, heat (unchanged) | #ff5fa2, #2bd4d4, #a855f7, #5b8def, #e0a93b, #ff4444 | 6.0, 9.3, 4.3, 5.3, 8.0, 5.0 |
| fruity | #fd875a | 7.1 |
| floral | #e0a9d6 | 8.8 |
| green | #7ccc7b | 8.7 |
| woody | #967a51 | 4.2 |
| spice | #c25726 | 3.8 |
| creamy | #efe096 | 12.8 |
| toasty | #cd7e2d | 5.4 |
| nutty | #ceb89b | 8.9 |
| earthy | #9aa373 | 6.4 |
| smoky | #a9aac1 | 7.5 |
| savory | #ba4b65 | 3.5 |

Balancing pairs (for boost and temper): toasty with green; nutty, earthy and smoky with fruity; savory with sour.

### Numbers, as printed (taste measures unchanged: 36/41 with 0 forbidden, hold-out 19/20)

Before = the six-axis table (AROMA-2), scored on eleven axes. After = this task, eleven axes. Counts are "strongest aroma is an expected one".

| Measure | Before (six-axis table) | After |
| --- | --- | --- |
| Blind key, all 114 items, eleven axes | 71/114 (62.3%) | 106/114 (93%), top two 107/114 |
| Blind, tuning (76) | 47/76 | 72/76 (94.7%) |
| Blind, held back (38) | 24/38 | 34/38 (89.5%) |
| Blind, six-axis view (the 76 items six axes can express) | 71/76; held back 24/25 | 71/76; held back 24/25 |
| Chef key, eleven axes (304) | 123/304 (40.5%), no aroma data 150 | 161/304 (53%), top two 170/304, no aroma data 122 |
| Agreement with the second source, eleven axes | 244/282 (86.5%), chef-sourced 124/143 | 355/364 (97.5%), chef-sourced 166/174 (95.4%) |
| Old key (`--aroma`, written for six axes) | tuning 30/30, hold-out 9/10 | tuning 28/30, hold-out 8/10 |
| Main key's four aroma checks | 4/4 | 4/4 |

The held-back third was not looked at item by item and not tuned against. Four of the 114 items were tuned after looking at tuning-set misses only (parmesan and blue cheese lead savory; stock potency lowered). The held-back figure (89.5%) reads lower than the 96% reported for the six-axis chart, but they are not the same set: the six-axis figure scored 25 of the 38 items (the other 13 had no axis to be scored on); the eleven-axis one scores all 38. Restricted to the original 25 the result is unchanged (24/25).

The old key's two new misses are coffee and Irish Coffee, which that key expects as "woody" because it was written when coffee had no axis; both now lead toasty, which is the correct answer. The extra hold-out miss was not inspected (the held-back detail is withheld on purpose).

The agreement rise is partly by construction: lines were re-read with the second source's words in view, and where both readings were defensible a tie was chosen so the line agrees. It is a second opinion from a mostly AI-written source, not ground truth.

### Second-opinion check on eleven axes

`checkAromaAgreement.mjs` and `npm run audit:data` now judge on eleven axes (`--axes six` still works). Of the 13 accepted entries from AROMA-2, the 11 `missing-axis` ones all agree on their own now and were removed from `data/review/aroma-accepted.json`; clove (table-right) and cardamom (both-defensible) stand. Five new decisions are recorded: whiskey and rye (oak and spice lead, with the caramel and grain the second source names just behind), gochujang (fermented soybean and chili over the chef's "woody"), parmesan and blue cheese (savory first; the chef entries say fatty and nutty, creamy and fatty), bread (toasty crust over the chef's "nutty") and balsamic vinegar (the chef's "fermented" is the vinegar's tang, which the savory axis does not mean). Zero unreviewed.

### What is still wrong, by item

- **Brandy Alexander** (tuning set): toasty 0.29 beats creamy 0.21; the creme de cacao and cognac outweigh the cream.
- **Beurre noisette**: expects nutty and toasty; the recipe says "butter", and browning is a cooking-method aroma the chart does not model.
- **Thai peanut sauce**: creamy 0.46 and fruity 0.23 beat nutty 0.17; coconut milk is bulky.
- **Mole poblano**: savory (stock) still leads toasty (chocolate, chilies).
- **BBQ sauce** shows no smoky bar: one teaspoon of smoked paprika against a cup of ketchup.
- **Umami (taste) and Savory (aroma) repeat each other** on soy, miso and fish-sauce recipes (Miso Soup: umami 0.67, savory 0.59): two bars for one idea. A question for CHART-1.
- Potato, rice, tofu and flour remain "no aroma of their own"; the second source calls them earthy or nutty.
- 122 of 304 chef-key ingredients still have no table line.
- The table is an AI assistant's judgement, checked against a second, mostly AI-written source and against two blind keys written by the same assistant. **No cook or professional has reviewed it.**

### Surfaces touched

The Recipe Notebook flavor map (17 spokes) and the ingredient before/after aroma radar (11 spokes) got a slightly smaller disc, a smaller label font and a side margin so the longest labels fit (checked on rendered images with a fallback font, not in a real browser). Cards keep their existing limit of the strongest few bars. The model-era ingredient panel and suggestion drawer still draw the six model aromas. AROMA-4 sets the display rule; CHART-1 is the redesign.

## Aromas, second pass (2026-11-16, AROMA-4)

This section closes the aroma work (AROMA-1 to AROMA-4): where the scores stand stage by stage, what the second source is, what is still wrong, and the interim rule that keeps the charts readable until they are redesigned. Nothing in AROMA-4 changed a table value, a label or a truth file; every measure below was re-run at the end and none moved.

### The scores, stage by stage (as the scripts printed them)

"Strongest aroma expected" means the highest aroma bar is one of the expected aromas. The FLAVOR-5 and AROMA-2 charts had six aromas, so the blind and chef keys could only score the items six axes can express; AROMA-3 and now score everything on eleven.

| Measure | FLAVOR-5 (six axes) | AROMA-2 (six axes, 16 lines corrected) | AROMA-3 (eleven axes) | Now (AROMA-4, unchanged) |
| --- | --- | --- | --- | --- |
| Blind key, all items | 67/76 (88.2%), 38 of 114 not expressible | 71/76 (93.4%) | 106/114 (93%), top two 107/114 | 106/114 (93%), top two 107/114 |
| Blind key, tuning set | 43/51 (84.3%) | 47/51 (92.2%) | 72/76 (94.7%) | 72/76 (94.7%) |
| Blind key, held back third | 24/25 (96%) | 24/25 (96%) | 34/38 (89.5%) | 34/38 (89.5%) |
| Chef key (304 chef-reviewed ingredients) | 113/260 (43.5%), no data 153 | 123/260 (47.3%), no data 150 | 161/304 (53%), top two 170/304, no data 122 | 161/304 (53%), top two 170/304, no data 122 |
| Agreement with the second source | 225/254 (88.6%), 29 disagreements | 244/257 (94.9%), 13 recorded | 355/364 (97.5%), 9 recorded | 355/364 (97.5%), 9 recorded; unreviewed 0 |
| First answer key (`--aroma`), tuning / hold-out | 30/30, 9/10 | 30/30, 9/10 | 28/30, 8/10 | 28/30, 8/10 |
| Taste, main set / hold-out (unchanged throughout) | 36/41, 19/20 | 36/41, 19/20 | 36/41, 19/20 | 36/41 (0 forbidden), 19/20 (1 forbidden) |

The two held-back figures (96% then 89.5%) are not the same set: six axes could score 25 of the 38 held-back items; eleven axes score all 38. On the original 25 the result is unchanged. The first answer key was written for six axes and expects coffee drinks to read "woody"; both now lead toasty, which is right, so those two misses are the key's, not the chart's.

### What the second source is, and is not

`public/proDataset/flavor_profiles_distilled.json` holds aroma words for 3,927 ingredients. **304 entries were reviewed by a chef; the other 3,623 were written by an earlier AI labelling pass** with a consistency check. It is a second opinion on the aroma table, not ground truth: where the table and the second source disagree, either can be wrong, and the high agreement figure is partly by construction (lines were re-read with the second source's words in view, and where both readings were defensible a tie was chosen that agrees).

**The aroma table itself (`src/data/flavorAromas.js`) is an AI assistant's judgement. No cook or professional has checked it.** It was compared with a second, mostly AI-written source and scored against two keys written by the same assistant (one written before the table was read, one drawn from the chef-reviewed entries). Treat every chart as a guide, not a taste test.

### What is still wrong, by item

From AROMA-3 and FLAVOR-6; none was changed in AROMA-4 (table values were out of scope).

- **BBQ sauce** shows no smoky bar: one teaspoon of smoked paprika against a cup of ketchup.
- **Thai peanut sauce** ranks nutty third (creamy 0.46 and fruity 0.23 beat nutty 0.17): coconut milk is bulky.
- **Pho and baklava** show little spice: whole spices perfume a dish far beyond their weight, and the chart weighs by amount.
- **Margarita, Mojito and Thai green curry** (FLAVOR-6): the leading taste or aroma is not what a cook would say first.
- **Brandy Alexander**: toasty 0.29 beats creamy 0.21. **Beurre noisette**: browning is a cooking-method aroma the chart does not model. **Mole poblano**: savory (stock) still leads toasty.
- **Umami (taste) and Savory (aroma) repeat each other** on soy, miso and fish-sauce recipes (Miso Soup: umami 0.67, savory 0.59), and heat (taste) sits beside spice (aroma). The group headings keep them apart; the redesign should decide whether they are one idea.
- Potato, rice, tofu and flour are left "no aroma of their own"; the second source calls them earthy or nutty.
- 122 of the 304 chef-key ingredients still have no table line (see BACKLOG.md).

### The interim display rule (AROMA-4)

With six tastes and eleven aromas a full chart has seventeen bars. Until the owner chooses a redesign (task CHART-1) every surface follows one rule, written once in `src/data/flavorDisplay.js` and tested in `src/data/flavorDisplay.test.js`:

1. Tastes and aromas are two groups, headed **Taste** and **Aroma**, each ordered strongest first. (So Umami under Taste and Savory under Aroma, or Heat and Spice, read as different things.)
2. A bar is drawn only at or above a floor of 0.05.
3. Each group has a maximum that depends on the room: **share cards 3 tastes + 3 aromas; the cover of a set of three 4 + 4; invent panels and the shared page ("compact") 4 + 4 with "show all"; the Recipe Notebook overview ("full") 6 + 6 with "show all".**
4. When bars are hidden one short line says so ("+3 fainter notes"); compact and full surfaces add "show all" (and "show fewer").
5. Ties are broken one way everywhere: scores are compared to three decimals, and a tie goes to the axis that comes first in the canonical order (sweet, sour, bitter, salty, umami, heat, fruity, floral, green, woody, spice, creamy, toasty, nutty, earthy, smoky, savory). The server's stored card bars keep three decimals so they order the same way. A test checks that the Recipe Notebook, an invent panel, the shared page and a server card lead with the same two tastes and the same two aromas for Negroni and Beef Bolognese, with no tolerance for ties.
6. Radars plot only the axes the rule picks, never seventeen: the Recipe Notebook flavor map 4 tastes + 4 aromas at most (3 to 8 spokes); the aroma wheel on the suggestion cards at most 4 aromas plus the ones the candidate moves (the taste wheel keeps its six); the Cookbook card radar (chef vocabulary, with its own axis switcher) the keys the recipe has a signal on, up to 6 for taste and 8 for aroma, never fewer than 3, in the vocabulary's own order. Season, cuisine and method radars are unchanged.
7. The per-axis pages and the Enhance page follow the same selection (6 + 6, or every axis above the floor after "show all"). Every one of the seventeen axes has a page, an insight, a balancing axis and boost and temper candidates (a test covers all seventeen).
8. A user's published copy stores only the compact set (4 + 4 bars), because the database rules allow at most 11 bars and seventeen can fire.

The redesign (CHART-1) is still to come: it will show candidate graphs with real data for the owner to choose from. This rule only keeps today's charts readable.

### Not verified

No cook has reviewed any line. The 375 px check was made on the DOM in the Browser pane (no horizontal overflow, bar counts within the rule, headings present), not by looking at a painted screen. Cards were rendered with the Cloud Function's own renderer to PNG and looked at; nothing was deployed.
