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

## What comes next

- FLAVOR-2 stops drawing a chart from the repeated placeholder rows: ingredients carrying them count as having no flavor data, and a recipe without enough real data shows "not enough flavor data" instead of a chart.
- FLAVOR-3 draws the tastes from the curated taste word each ingredient already has (salt is salty, sugar is sweet, coffee is bitter), weighted by how much of it the recipe uses.
- FLAVOR-4 hand-tunes strengths for the ingredients that matter most, so a dash of bitters and two ounces of gin no longer weigh the same.
- FLAVOR-5 takes aromas from published aroma descriptors instead of the model.
- FLAVOR-6 makes every surface use the same profile, makes the wording honest, and re-measures on this same test set; the aim is to beat the numbers above.
