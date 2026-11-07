# Weak spots — design and plan (2026-11-07)

Measured weak spots in the kitchen / invent features, their causes, and the
fix order. Owner approved the order: A, then 2, then 4, then 3 and 5; run in
parallel what can be.

## What was measured

| # | Weak spot | Cause (measured) |
|---|---|---|
| A | Invented dishes and sauces are thin and repetitive; "why" lines cite tomato + onion | The shipped pairing data lacks everyday pairs (garlic\|onion, chicken\|garlic, beef\|onion …). The blend step favoured distinctive pairs and kept the top 40,000. The raw counts (381k pairs from 2.2M recipes) are intact. |
| 2 | "Real recipe" matches show wrong methods and repeats | Index builder matched rows by a parse counter, not the CSV's own id: 14.5% of entries carry another recipe's steps; 41% repeat a title; 6.8% name a food they lack. |
| 4 | Amounts like "3.6 each" chicken, "4.54 each" pasta | The amount model uses "each" for mass/volume foods and does not round. |
| 3 | Almost no Cookbook recipe is "makeable" | 30 kitchen items → 0 complete, 20 one-or-two away. The missing items are mostly flavourings (cinnamon, scallion, parsley, thyme, garam masala). |
| 5 | Shuffle runs out; sauces of 3 ingredients | Scoring by mean pair strength favours small sets; deterministic top-k gives the same few dishes. |

## Wave 1 — running in parallel now

- **WEAK-A — everyday-pairs index.** Built from the raw co-occurrence:
  top ~30 partners per ingredient by a lift-aware score, ≤ 1.5 MB. A
  `blendIndex` takes max(curated, everyday) per pair, with the same shape as
  `buildPairingIndex`. Used only by invent and kitchen features. The main
  `pairings.json` (Pairing Lab, Cookbook "goes well with") is unchanged
  (that's option B, later). Checks: the 10 missing pairs present; the share
  of Cookbook ingredient pairs with an edge; invent size and variety on
  fixed kitchens.
- **WEAK-2 — real-recipe index rebuild.** Match by the CSV id and verify the
  title; check that steps mention the recipe's ingredients and that the
  title food is in the list; de-duplicate titles; seeded sample. Re-measure
  the three numbers; a spot-check of 20.
- **WEAK-4 — amounts.** Root-cause "each"; kitchen units per ingredient
  (data first, category tie-break); normalised unit names; rounding to
  kitchen fractions. Checks: 40 common ingredients with acceptable units
  and ranges; the FM-Q2 eval not worse.

## Wave 2 — after WEAK-A merges

These score with the blended pairs, so they wait for A.

- **WEAK-3 — "makeable" that matches how people cook.**
  1. *Main vs supporting ingredients.* Mains are proteins, vegetables,
     grains, dairy and fruit, by ingredient category. Supporting are spices,
     herbs, condiments, sweeteners and acids. A recipe is "you can make" when
     every main is covered. Missing supporting items show as "even better
     with…" in What do I need?.
  2. *Swaps.* A small hand-written table, checked against the blended pairs:
     scallion→onion, parsley↔cilantro, white wine→stock, yogurt↔sour cream,
     shallot→onion, butter↔oil (sautéing), lime↔lemon, honey↔sugar. The
     same rule as the sauce stand-ins: same role and kind, never across.
  3. *A "spice rack" switch* next to "assume basics" (common dried spices).
  - Check, written first: on 3 fixed kitchens, "you can make" counts go up
    while every listed recipe still has all its mains. A by-eye check of 10
    newly makeable recipes.
- **WEAK-5 — invent size and variety.**
  1. *Target size.* Score = pair coherence (blended) + a size term that
     peaks at 5–8 ingredients for a recipe and fills every required
     template role for a sauce; role balance for recipes (protein / veg /
     starch / aromatic / acid / fat / herb).
  2. *Variety.* Pick the next idea by maximal marginal relevance (penalise
     overlap with ideas already shown), so Shuffle keeps finding new dishes.
  3. *Buying.* Allow up to 2 "you'd need" items when they lift coherence a
     lot (already labelled).
  - Check, written first: on the same fixed kitchens, mean size within
    target, distinct dishes over 5 shuffles ≥ 10, and no invented
    emulsion/roux that breaks the chemistry rules (existing tests).

## After that (later)

- **Option B:** rebuild `pairings.json` so every ingredient keeps its most
  common partners. This fixes the Pairing Lab too. Needs a re-run of
  `scripts/evalPairingMatch.mjs` and the GNN-augmented pairs, and a look at
  the 3D map.
