# FP-OV-5 — Preparation-method inference to tune the profile + description

**Date:** 2026-06-22 · **Type:** research → implement · **Verdict: GO**
(description-layer scope). A follow-up implementation task is therefore
folded into this same change (rule-based, no model).

## Question

FP-OV-5 asks whether we can infer the likely **preparation method** (sauté /
simmer / raw / bake / roast …) from the ingredient set + dish type and use it to
"further tune the quantity-weighting and the flavor description." The plan note
flagged the blocker as *"No prep-method model or data exists today; this is a
separate research effort."*

## Key finding: the inference engine already exists, and it's data-grounded

The blocker is already solved in the repo. `src/ml/directionsRuntime.js` ships:

- `COOKING_METHODS` — 21 canonical methods + detection regexes (sauté, sear,
  roast, bake, grill, broil, braise, simmer, boil, steam, poach, blanch, fry,
  stir-fry, deep-fry, caramelize, toast, marinate, whisk, blend, chill).
- `methodsInSteps(steps)` — methods present in one recipe's directions
  (fry-family collapsed so stir-fry/deep-fry don't double-count plain fry).
- `extractCookingMethods(recipes)` / `retrieveCookingMethods(bowl, index, vocab)`
  — retrieve the top set-similar **real RecipeNLG** recipes (FM-DIR1 index) and
  rank the cooking methods *those* recipes actually use, by recipe frequency.

So inference is **not heuristic hand-waving** — it's grounded in how real cooks
prepared the most set-similar dishes. It's already surfaced as chips in
`src/components/RecipeCookingMethod.jsx` ("🍳 Likely cooking methods"). A second,
lighter per-ingredient role heuristic exists in `src/data/cookingMethods.js`
(used by the affinity/pie wheels) but the directions-grounded one is the right
signal for a recipe-level claim.

**What's missing** is only the wiring from "likely method" → the Flavor
Profiles **Overview** card (the bar chart + the FP-OV-2 description). That's the
deliverable.

## Design decision: narrate the shift, do not mutate the numbers

The spec says "tune the quantity-weighting and the flavor description." Two ways
to read "tune the profile":

1. **Mutate the numeric axis scores** — bump sweet/umami/woody for a roast, etc.,
   and re-render the bar chart as an "as-cooked" profile.
2. **Narrate the shift in prose** — keep the bar chart as the honest
   ingredient-flavor potential; add a sentence describing how the likely method
   moves the flavor.

We take **(2)**, for three reasons:

- **Honesty / trust.** The bar chart is derived from per-ingredient `gnnProbs`;
  it is an *ingredient-potential* signal. Silently bending those numbers by an
  inferred method asserts an "as-cooked" measurement we cannot verify and the
  user may not even be doing (they might eat it raw). The project's standing
  lesson (`project_molecular_model_weak_at_ingredient_level`) is exactly about
  not over-claiming model-derived flavor numbers — applies here.
- **Quantity-weighting is grams, not method.** "Tune the quantity-weighting"
  doesn't literally fit: prep method doesn't change an ingredient's
  gram-equivalent. The real lever the spec is after is the *narrative* of how
  cooking shifts flavor, which is the description.
- **Reversible + cheap.** A prose layer reuses the existing inferrer, adds no
  model bytes, is deterministic + unit-testable, and degrades to "no method
  line" when the directions index is unavailable.

The directional nudges are still encoded (as `axes` metadata on each method
effect) so a future, **opt-in, clearly-labeled** "as-cooked" numeric overlay can
be built on top without re-deriving the culinary mapping — but that is *not*
shipped here.

## Culinary mapping (deterministic rules)

Methods are grouped into families with a shared flavor-effect clause:

| Family | Methods | Flavor effect (Maillard / moisture / no-heat) | Axis nudge |
|---|---|---|---|
| brown | roast, sear, grill, broil, bake, toast | browning → deeper, sweeter, roasted notes | sweet↑ umami↑ woody↑ green↓ |
| fry | fry, deep-fry, stir-fry, sauté | richness + a toasted edge | fatty↑ umami↑ woody↑ |
| caramelize | caramelize | sweeter and richer | sweet↑↑ woody↑ |
| meld | braise, simmer | slow moist heat melds + deepens the savory/umami side | umami↑ green↓ |
| gentle | steam, poach, boil, blanch | gentle moist heat keeps it clean/fresh, eases sharp aromas | green↑ fruity↓ |
| marinate | marinate | works acid + salt deeper in | sour↑ salty↑ |
| raw | chill, whisk, blend (no-cook) | bright, fresh top notes stay forward | green↑ fruity↑ |

These are textbook directions (Maillard reaction + caramelization deepen
sweet/savory/roasty notes; moist heat is flavor-conservative and softens
volatile aromatics; no-cook preserves fresh top notes) — defensible as a
deterministic rule set without claiming numeric precision.

## Implementation (shipped in this change)

1. `src/data/recipeProfileAnalysis.js`
   - `methodFlavorEffect(method)` → `{ method, family, note, axes } | null`
     (pure; unknown/empty method → null).
   - `describeRecipeProfile(profile, { aromaMatch, cookingMethod })` gains a
     `cookingMethod` option; when set + recognized, appends one sentence:
     *"Likely roasted — browning brings out deeper, sweeter, roasted notes."*
2. `src/components/RecipeFlavorProfilesCard.jsx`
   - In the existing directions effect, also call `retrieveCookingMethods`
     (k=8, topN=1) off the same index/vocab and store the dominant method.
   - Pass it into the Overview `describeRecipeProfile` call.
   - Null-safe: index miss → no method → description renders exactly as before.
3. Unit tests in `src/data/recipeProfileAnalysis.test.js` covering
   `methodFlavorEffect` (each family + unknown/null) and the new
   `cookingMethod` sentence in `describeRecipeProfile`.

## Non-goals (deferred)

- No numeric "as-cooked" bar-chart mutation (over-claim risk; see decision).
- No new model / no training data (the directions index already supplies the
  signal).
- No change to `RecipeCookingMethod.jsx` chips or the affinity-wheel method
  heuristic.

## Recommendation — GO (description layer)

Ship the prose layer above. It satisfies the spec's intent (the likely
preparation method now informs the recipe's flavor narrative), reuses the
already-data-grounded inferrer, adds zero model weight, and stays honest about
what the numbers mean. The numeric "as-cooked" overlay remains a documented,
optional follow-up gated behind a clear UI label, not part of this change.
