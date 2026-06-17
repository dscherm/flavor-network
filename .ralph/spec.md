# Deep Interview Spec: Recipe Flavor Profiles Card + Card-Format Suggestions

## Metadata
- Type: brownfield (UI — `src/components/`, recipe surface)
- Generated: 2026-06-11 (deep-interview)
- Approved: 2026-06-14 (kicked off in interactive bridge mode)
- Final ambiguity: ~15% (4 design decisions resolved in one round)
- Status: SHIPPED (commit 21f2f6c) — remediation pass active (2026-06-14)

## Remediation (2026-06-14 audit)
The feature shipped in `21f2f6c` and is production-green (1319 tests).
Audit vs the criteria below found these gaps, now tracked in `plan.md`
as RFP-R1..R4:
- **RFP-R1**: Component 2 shipped as a vertical scroll list, not the
  spec's swipeable card deck; no per-card before→after mini-radar
  (one shared before-only radar + text deltas). → rebuild to spec.
- **RFP-R2**: Pairings page uses generic routing buttons, not
  aroma-matched cocktail/sauce names. → surface names.
- **RFP-R3**: Carousel has ◀▶ + counter, no page dots / touch-swipe.
- **RFP-R4**: dead `RecipeFlavorProfileCard.jsx` (singular) cleanup +
  final verify; also add missing deck/radar tests (folded into RFP-R1).

## Topology (confirmed components)
| # | Component | Status | Description |
|---|---|---|---|
| 1 | **Flavor Profiles card** | active | New pop-out carousel: one page per flavor axis with analysis + augment suggestions; final pairings page. |
| 2 | **Card-format suggestions** | active | ✨ Suggest (add) + ✨ Smart swaps (replace) become a swipeable card deck showing each candidate's profile delta. |
| 3 | **Remove old profile display** | active | Delete the existing `RecipeFlavorProfileCard` mount from RecipeLabMobile. |

## Decisions (interview, 2026-06-11)
| # | Question | Decision |
|---|---|---|
| 1 | What is each "flip" page? | **One page per flavor axis** — 5 tastes (sweet/sour/bitter/salty/umami) + 6 aromas (fruity/floral/green/woody/spicy/fatty). |
| 2 | Augment-suggestion source | **Set-completion model ranked by axis impact** — candidate must fit the recipe AND move that axis. |
| 3 | What counts as a pairing | **Cocktails + sauces (existing aroma-match) + similar dishes** (directions index titles). |
| 4 | Card-format scope | **Swipeable deck + profile delta** — replaces the chip popout for both add and replace; each card shows a before→after mini-radar. |

## Background (grounded)
- Current profile UI: `RecipeFlavorProfileCard` mounted at `RecipeLabMobile.jsx:543` → to be removed.
- Profile math: `src/data/recipeScoring.js` — `scoreRecipe(ingredients)` (taste), `scoreRecipeAroma(ingredients)` (aroma), `AROMA_LABELS`, `AROMA_COLORS`. Per-ingredient axis values come from `node.gnnProbs` (11 heads) / `gnn_entropy.json`.
- Card reference: `src/components/PairingModeCard.jsx` (chalk Tinder card) + `PairingMode.jsx` (swipe deck). The α-mode `AlphaModeDetailsCard` is the swipeable-carousel reference.
- Pairing routing already exists: `onFindCocktail(recipeNames, title)` / `onFindSauce(...)` route to Cocktail/Sauce Lab via `computeRecipeAroma` (`recipeAromaSimilarity.js`).
- Dishes: `retrieveDirections(bowlNames, index, vocab)` (FM-DIR1) returns set-similar real recipe titles.
- Set-completion model: `recipeRuntime.suggestIngredients(observed, {cuisine}, model)`; profile-delta computable by re-running `scoreRecipe`/`scoreRecipeAroma` with a candidate added.

## Goal
Replace the static recipe flavor-profile display with an interactive **Flavor Profiles card** (a per-axis swipeable carousel that analyzes the recipe and suggests how to shift each axis), and present **ingredient suggestions (add + replace) as swipeable cards** that visualize how each candidate augments the recipe's flavor profile — turning the recipe surface from "list + chips" into a card-driven, profile-aware experience.

## Design

### Component 1 — Flavor Profiles card (`RecipeFlavorProfilesCard.jsx`)
- New chrome button **"Flavor Profiles"** next to ✨ Suggest / ⚖ Amounts / + Add (RecipeLabMobile chrome). Opens the card as a bottom/overlay pop-out (same overlay pattern as the suggestions popout).
- **Carousel, one page per axis** (11 axes; hide axes the recipe scores ~0 on to avoid dead pages, but keep ≥ the firing ones). Each page shows:
  - Axis name + the recipe's aggregate score on that axis (from `scoreRecipe`/`scoreRecipeAroma`), with the axis color (`AROMA_COLORS`/taste palette).
  - **Driven by:** top 2-3 bowl ingredients by that axis's `gnnProbs` value.
  - **Insight line:** rule-based ("Leans sweet — balance with acid/bitter" / "Well-balanced" / "Faint — boost if you want more").
  - **Boost** chips/cards: model candidates (fit the bowl) with the highest positive delta on this axis. **Temper** chips: candidates that raise the balancing axis (sweet↔sour/bitter, salty↔sour, rich/fatty↔green/acid, etc.). Tapping adds the ingredient (quantity-prefilled).
- **Final "Pairings" page:** 🍸 Cocktails + 🥣 Sauces (aroma-matched names) + 🍽 Dishes (top `retrieveDirections` titles). Cocktail/Sauce entries can deep-link via the existing `onFindCocktail`/`onFindSauce`.
- Swipe / ◀ ▶ arrows to move between pages; page indicator dots.

### Component 2 — Card-format suggestions (add + replace)
- Replace the chip-list presentation in `IngredientSuggestionsPopout` (and/or a new deck) with a **swipeable card deck** styled like `PairingModeCard`:
  - Add-mode (✨ Suggest): deck of candidate ingredients (smart completions + co-occurrence).
  - Replace-mode (✨ Smart swaps / "R"): deck of similar+fitting substitutes.
  - Each card shows the candidate name + a **before→after mini-radar**: the recipe's current profile vs. the profile *with this ingredient added/swapped* (delta arrows on the axes that move most).
  - Swipe to browse; a clear "Add" / "Swap" action commits (quantity-prefilled on add).
- Reuse the swipe mechanics from `PairingMode.jsx`; the radar is a small `ProfileAxisRadar`/`AromaHexWheel` variant with two overlaid series.

### Component 3 — Remove old display
- Remove the `RecipeFlavorProfileCard` import + mount from `RecipeLabMobile.jsx` (the new card supersedes it). Keep `RecipeFlavorProfileCard.jsx` only if still used elsewhere (grep first); otherwise delete.

## Constraints
- Additive + null-safe: if the recipe model / indices fail to load, the card still shows the static profile analysis (scores + drivers + insight); only the model-driven boost/temper and dish pairings degrade gracefully.
- Reuse existing math/runtime (`scoreRecipe`, `scoreRecipeAroma`, `recipeRuntime`, `directionsRuntime`, `recipeAromaSimilarity`) — no new model training.
- Mobile-first (RecipeLabMobile is the live surface); keep within the existing chalk/notebook visual language.
- Quantity prefill (FM-Q2) continues to apply on card "Add".

## Non-Goals
- No new ML model / retraining. No profile-only generation (Flow-B is a documented dead-end).
- No desktop-specific redesign beyond what the shared components render.
- Not touching Cocktail/Sauce Lab internals — only reusing their aroma-match entry points.

## Acceptance Criteria
- [ ] "Flavor Profiles" button appears in the chrome next to ✨/⚖/+ Add when the bowl is non-empty.
- [ ] The card is a swipeable per-axis carousel; each page shows score, driving ingredients, an insight line, and boost/temper suggestions that add on tap.
- [ ] A final Pairings page lists aroma-matched cocktails + sauces + similar-dish titles.
- [ ] ✨ Suggest (add) and ✨ Smart swaps (replace) render as a swipeable card deck; each card shows a before→after profile delta.
- [ ] The old `RecipeFlavorProfileCard` mount is removed from RecipeLabMobile.
- [ ] Graceful degradation when model/index unavailable (static analysis still renders).
- [ ] Unit tests for the new pure logic (axis-driver extraction, profile-delta, boost/temper ranking). Full suite green, build clean.

## Ontology
| Entity | Type | Fields | Relationships |
|---|---|---|---|
| Recipe bowl | core | ingredients[], aggregate taste+aroma profile | has-many Ingredients |
| Flavor axis | core | name, score, color, balancing-axis | profiled-by Recipe |
| Suggestion | core | name, axis-delta, profile-before/after, fit | augments Recipe |
| Pairing | supporting | kind (cocktail/sauce/dish), title | pairs-with Recipe |

---

# Flavor Profile Overview — bar chart + smart description + enhance card (PLANNED)

## Metadata
- Type: brownfield (UI + on-device logic/model) — Recipe → ◆ Flavor Profiles chalkboard card
- Generated: 2026-06-17 (deep-interview, 4 decisions)
- Status: PLANNED — not started. Tasks FP-OV-1..5 in `plan.md`; surfaces via `--what-next`.
- The base "◆ Flavor Profiles" card is already shipped (chalkboard pop-out
  with a flavor-map page, per-axis pages, pairings page). This initiative
  ADDS an Overview page + smart description + an enhance card.

## Decisions (deep-interview 2026-06-17)
| # | Question | Decision |
|---|---|---|
| 1 | Smart-description engine | **Rule-based skeleton NOW**, and **explore a LOCAL on-device model** (ONNX/onnxruntime-web, like the GNN + set-completion models) to generate/score the description. **NOT** Claude or any cloud API. |
| 2 | Quantity + prep tuning | **Quantity-weight** the flavor profile (reuse the quantity-prediction model / entered amounts). **Defer preparation-method inference** — no model/data today (FP-OV-5 stretch). |
| 3 | Enhance card | **Reuse** the existing boost/temper ranking (`rankByAxisImpact`); new visual: **"More {axis}? Try…"** with **Make-a-Recipe-style ingredient mini-card "buckets"**, swipeable, tap-to-add (quantity-prefilled). |
| 4 | Placement | New **"Overview" page first** (page 0) in the chalkboard Flavor Profiles carousel: horizontal flavor **bar chart** + smart **description**. Keep flavor-map, per-axis, pairings pages. Enhance "More X? Try…" is its **own swipeable page/section**. |

## Goal
Make the recipe's ◆ Flavor Profiles card open on an **Overview** that, at a glance,
shows (a) a **horizontal bar chart** of the recipe's flavor percentages
(taste + aroma), **weighted by the likely ingredient quantity ratios**, and
(b) a **smart, on-device description** of the recipe's overall taste, aroma, and
mouthfeel — informed by the ingredients, their pairings, and the aggregate
profile. Add a swipeable **enhance card** ("More Spicy? Try…") that surfaces
ingredient "buckets" to dial each flavor up or balance it, reusing the existing
boost/temper model ranking.

## Design
- **Overview page (FP-OV-1):** horizontal bar chart over the 11 axes; each
  ingredient's contribution weighted by its predicted/entered amount
  (`quantityRuntime`), equal-weight fallback. Chalkboard styling; bars in
  `axisColor`. Carousel re-indexed: Overview → Flavor map → per-axis → Pairings.
- **Smart description (FP-OV-2):** pure, deterministic, on-device generator from
  the quantity-weighted profile + dominant/balancing axes + driving ingredients +
  aroma-match. No network/LLM. Rendered under the bar chart.
- **On-device model spike (FP-OV-4):** assess an ONNX in-app model (browser +
  Capacitor) to produce/upgrade the description — training data, size, latency,
  go/no-go. Explicitly no cloud API.
- **Enhance card (FP-OV-3):** "More {axis}? Try…" per axis using `rankByAxisImpact`
  boost/temper, rendered as Make-a-Recipe-style ingredient buckets; tap adds
  (quantity-prefilled); also a temper/"tone down" row.
- **Prep-method (FP-OV-5):** deferred stretch — infer likely prep to further tune
  weighting + description; needs new data/model.

## Constraints
- On-device only for the description — NO external/cloud LLM API (offline-capable,
  Capacitor-friendly).
- Reuse existing math/runtime: `recipeProfileAnalysis` (scores, drivers,
  `rankByAxisImpact`), `quantityRuntime` (amounts), `recipeAromaSimilarity`.
- Chalkboard visual language; mobile-first; additive + null-safe (static bar chart
  + rule description must render even if the quantity model / on-device model fail).

## Non-Goals
- No cloud LLM. No preparation-method model in the first cut (FP-OV-5 only).
- No change to the shipped flavor-map / per-axis / pairings pages beyond re-indexing.

## Acceptance (summary; per-task in plan.md FP-OV-1..5)
- Overview page: quantity-weighted horizontal flavor bar chart + on-device smart
  description, as page 0 of the chalkboard carousel.
- Swipeable "More {axis}? Try…" enhance card with ingredient buckets (boost/temper),
  tap-to-add quantity-prefilled.
- A written feasibility report for the local on-device description model (go/no-go).
- Unit tests for the pure logic (quantity weighting, description generator); full
  suite green; build clean.
