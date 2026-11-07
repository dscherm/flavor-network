# Directions index — quality rebuild (WEAK-2, 2026-11-07)

`public/models/directions_index.json` holds the RecipeNLG recipes behind
"What's in my kitchen?" (real-recipe matches) and Invent a recipe ("closest
real recipe" + its method). Built by `flavor-gnn/scripts/fm_dir1_build_index.mjs`;
measured by `flavor-gnn/scripts/fm_dir1_measure.mjs`; checks in
`src/ml/directionsQuality.js`.

## Root cause

The suspected join bug is **not** the cause. Both `recipe_sets.jsonl`'s `r`
and the old builder's counter are csv-parser row counters over the same
file, and on all 2,231,142 CSV rows the counter equals the CSV's own index
column (csv-parser names the blank header `''`); every one of the 1,636,958
corpus rows' titles matches its CSV row. The bad entries are in RecipeNLG
itself: CSV row 38762 really is "Barbecue Wieners" (franks, water, sugar,
catsup, mustard, vinegar) with "Wash turkey thoroughly…" steps. The old
builder made it worse by taking the **first 40,000** sets in file order —
all from the scraped cookbooks.com ("Gathered") rows, which repeat titles
heavily — and trusting them unchecked.

The builder now joins on the index column and re-checks the title anyway
(0 drift, 0 title mismatches on the rebuild).

## What the builder does now

Pass 1 screens every candidate (3–10 mapped ingredients, 1,339,794 of them)
and drops it when:

| filter | dropped |
|---|---|
| steps mention < ⅓ of the raw (NER) ingredients | 241,317 |
| method longer than 1,000 characters (size budget) | 111,856 |
| title names a headline food (meats, fish, beans, potato, chocolate, rice, pasta…) missing from the mapped list — or, for wieners/franks which the vocab cannot represent, from the raw list | 77,476 |
| steps cook a meat neither the list nor the title has ("Wash turkey…") | 16,708 |
| steps mention none of the mapped (shown) ingredients | 1,019 |

891,418 survive under 548,955 distinct normalised titles. Per title the
builder keeps the most complete version (most mapped ingredients, then most
steps capped at 10, then alignment) plus **at most one more** whose mapped set
overlaps it by ≤ 25% Jaccard. Below that threshold the second version is a
different dish under the same name (a soup-based vs a rice-based "Chicken
Casserole"), which helps retrieval match a different kitchen; above it, the
copy only crowds out other dishes. Titles are taken in seeded-hash order
(seed 20261107), a reproducible uniform sample over distinct titles, until
40,000 entries. Pass 2 fetches the chosen rows' steps.

Result: 40,000 entries from 37,178 titles (2,822 second variants);
sources Gathered 27,076 / Recipes1M 12,924 (was 40,000 / 0).

## Before / after

Same measurement script on both files (ingredient names = the vocab names
of `v`, the list the app shows).

| measure | before | after |
|---|---|---|
| steps mention none of their ingredients | 6,198 (15.5%) | 0 (0.0%) |
| repeat an earlier title, exact (case-insensitive) | 16,373 (40.9%) | 2,151 (5.4%) |
| repeat an earlier title, normalised | 17,341 (43.4%) | 2,822 (7.1%) — the deliberate second variants |
| distinct normalised titles / most copies of one title | 22,460 / 198 | 37,178 / 2 |
| title names a vocab-representable food the list lacks | 2,517 (6.3%) | 0 (0.0%) |
| title names a food the vocab cannot represent (wieners/franks) | 85 (0.2%) | 22 (0.1%) — each has franks/wieners in its raw list |
| mean share of ingredients the steps mention | 0.605 | 0.846 |
| steps mention < ⅓ of the shown ingredients | 11,477 (28.7%) | 741 (1.9%) |
| steps cook a meat the shown list and title lack | 717 (1.8%) | 291 (0.7%) |
| size (raw / gzip) | 14.40 MB / 4.47 MB | 24.01 MB / 7.74 MB |

Rows 1 and 3 are enforced by the builder, so their 0% is by construction.
The last three rows are independent of the exact filters (they use the
shown vocab names, not the raw list the build checked against).

## Spot-check (20 entries, seed 7)

All 20 have steps that belong to their title. 15 of 20 are fully coherent
(title, ingredient list and steps agree). The other 5 have correct steps,
but the ingredient list lacks a headline item the vocab didn't map:
Original Plymouth Succotash (beans), Baked Cranberry Pudding (cranberries),
Shrimp Linguini With Pesto (linguine, pesto), Tri Tip Roast (the beef),
Baked Brie (brie). The same eyeball of 20 entries from the old file also found
no wrong-recipe steps (4 lists missing their headline item), so a sample
of 20 is too small to show the ~5% mismatch rate; the table above is the
evidence.

## Known limits

- The index stores only vocab-mapped ingredients, so a list can lack its
  headline food when the vocab has no name for it (the 5 above). The
  kitchen panel's `titleIngredients` still covers that case when the title names a
  vocab food.
- The size grew 14.4 → 24.0 MB raw (4.5 → 7.7 MB gzip): Recipes1M methods
  are longer. The 1,000-character method cap is what keeps 40,000 entries
  under 25 MB; it also excludes long, detailed recipes.
- The title-food list (`MAIN_FOODS`) is short and hand-made; a title
  naming a food outside it ("Cranberry Pudding") is not checked.

## Rebuild

```bash
# inputs are gitignored; from a worktree point at the main checkout
FM_DATA_ROOT=D:/Projects/flavor-network node --max-old-space-size=8192 flavor-gnn/scripts/fm_dir1_build_index.mjs
node flavor-gnn/scripts/fm_dir1_measure.mjs public/models/directions_index.json --sample 20 --seed 7
```

Two passes over the 2.2 GB CSV, about 5 minutes.
