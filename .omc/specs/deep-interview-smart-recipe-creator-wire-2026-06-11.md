# Spec: Wire the Smart Recipe Creator (set-completion + quantity)

> Interactive-bridge design. Direction + key decisions approved 2026-06-11.
> Implementation follows; no commit until requested.

## Metadata
- ID: `smart-recipe-creator-wire-2026-06-11`
- Type: brownfield (UI + ML serving — `src/`)
- Derivation: `.omc/plans/flavor-model-suite-feasibility.md` §10 (FM-P2 trained,
  ONNX-exported, parity-proven, **built but unwired**). This spec wires it.

## Decisions (intake 2026-06-11)
| # | Q | Decision |
|---|---|---|
| 1 | Surfacing | **Distinct "✨ Smart completions" group** above the existing co-occurrence list in `IngredientSuggestionsPopout` add-mode. Additive, attributed, low-risk. |
| 2 | Quantity | **Auto-fill the amount (editable)** on add via the FM-Q2 quantity model. |
| 3 | Cuisine | **Auto-derive** the dominant cuisine from the bowl; zero new UI. |

## Background (grounded)
- Model runtime: `src/ml/recipeRuntime.js` — `loadRecipeModel()` +
  `suggestIngredients(observedNames, {cuisine, season, profile, k}, model)`.
  Artifacts already shipped: `public/models/recipe-setcompletion.onnx` (4MB) +
  `public/models/recipe_vocab.json` (vocab 3891, `cuisine_vocab` 52 title-case,
  `season_vocab` 13, `maxlen` 32, `cuisine_null`/`season_null`).
- Quantity runtime: `src/ml/quantityModel.js` — `predictQuantity(name, {artifact,
  vocabIndex})`. Artifact `flavor-gnn/data/quantity_model.json` is **NOT in
  public/** yet. Its integer keys index the SAME vocab as `recipe_vocab.json`
  (verified byte-identical, 3891) — so it can reuse that vocab; only the
  `quantity_model.json` file needs shipping.
- Seam: `IngredientSuggestionsPopout` add-mode (mounted by `RecipeLabMobile` and
  `SuggestionDrawer`/desktop). Current add-mode ranks via co-occurrence
  (`rankSuggestions`). FM-P2 beat the popularity baseline (recon hit@10 0.866 vs
  0.799), so it earns a labeled group here — unlike the pairing model, which lost
  to co-occurrence and is NOT used for ranking.
- Bowl add: `src/data/bowlEntry.js` `bowlAddIngredient(bowl, name, amount=null)` →
  `makeBowlEntry(name, amount)`; amount shape `{raw, qty, unit, inferred}`.

## Design
### SR-0 — Ship quantity artifact
Copy `flavor-gnn/data/quantity_model.json` → `public/models/quantity_model.json`
(static, like the onnx). No new build step; committed artifact. Quantity index is
built from the already-shipped `recipe_vocab.json.vocab` (identical ordering).

### SR-1 — Bowl → cuisine derivation
`src/data/deriveBowlCuisine.js`: tally `node.cuisines` across the bowl (strip
`" cuisine"` suffix, case-insensitive), pick the dominant, match against the
model's `cuisine_vocab`; return the matched title-case name or `null` (→ model
uses `cuisine_null`). Pure + unit-tested.

### SR-2 — "✨ Smart completions" in the popout (add-mode)
In `IngredientSuggestionsPopout`, add-mode only, behind flag `FN_RECIPE_MODEL`
(default ON; `localStorage.FN_RECIPE_MODEL='false'` escape):
- Lazily `loadRecipeModel()` once (module-level singleton promise; mirrors
  `flavorGnnRuntime` lazy pattern). Loading + error states are silent: on failure
  the smart group simply doesn't render — the co-occurrence list is untouched.
- Compute `suggestIngredients(bowlNames, {cuisine: derived, k: 8})`, drop names not
  in `nodes`, drop names already in the bowl, apply `scopeFilter`.
- Render a distinct group **above** the existing list: header "✨ Smart
  completions", subtitle the derived cuisine when present. Tapping a chip calls the
  same add path.

### SR-3 — Quantity auto-fill on add
- `src/ml/quantityRuntime.js`: lazy singleton that fetches
  `/models/quantity_model.json` + builds the vocab index from `recipe_vocab.json`;
  `predictAmount(name) → {raw, qty, unit, inferred:true} | null` (wraps
  `predictQuantity`, formats `raw` like `"1 cup"`).
- The popout's add handler (both groups) predicts the amount and calls
  `onAdd(name, amount)`. `onAdd`/`onAddIngredient`/`bowlAddIngredient` already accept
  an optional `amount` — thread it through where the popout mounts. `inferred:true`
  distinguishes model-filled amounts; user edit overwrites (existing AmountInput).
- Null prediction → `onAdd(name)` unchanged (no amount).

### SR-4 — Flag, tests, build
- Flag helper local to the popout (mirrors `flavorV3Enabled`).
- Tests: deriveBowlCuisine (dominant/strip/no-match/empty); quantityRuntime format
  (model vs global vs null); the existing recipeRuntime input/rank tests already
  cover the model path. Popout smart-group gated render (flag off → no group; model
  fail → no group; co-occurrence list always present).
- `npm test` green + `npm run build` clean.

## Constraints
- **Purely additive.** Flag off / model load fail / no vocab match → every surface
  behaves exactly as today. Co-occurrence ranking is never removed.
- No retraining; serve the existing committed ONNX. No new runtime deps
  (`onnxruntime-web` already present).
- Quantity amounts are marked `inferred` and fully user-editable.
- Cocktail/sauce scope respected via `scopeFilter` (the food model's vocab is
  food-centric; non-matching names already drop out).

## Non-Goals
- Flow B (generate-from-profile-alone) — documented weak; not wired.
- Directions generation (FM-DIR*), cocktail/sauce generators (FM-CS*).
- Replacing co-occurrence ranking (it stays as the primary/!flag list).
- A standalone "generate a whole recipe" button (this pass augments the bowl-build
  loop; full generation is a follow-up).

## Implementation note (2026-06-11) — orphaned popout discovered
`IngredientSuggestionsPopout` turned out to be **mounted nowhere in production**
— the B-version refactor (2026-06-03) removed its mount but left RecipeNotebook's
"Suggestions…" button wired to `onRequestSuggestions` → `suggestionsMode=true`,
which rendered nothing (a dead button). Rather than wire the feature into a dead
component, I **re-mounted the (now smart-enhanced) popout on `suggestionsMode`** in
`RecipeLabMobile` — this both ships the feature on the live surface and fixes the
dead button. `handleAddIngredient` now threads the predicted `amount` into
`bowlAddIngredient`. Quantity prediction was made **synchronous** (preload the
FM-Q2 artifact on mount, predict from cache in the click handler) so `onAdd` still
fires immediately — preserving the existing add contract and all prior popout
tests. The `amount` 2nd arg is only passed when a prediction exists (single-arg
otherwise), so no existing `toHaveBeenCalledWith(name)` assertion breaks.

## Acceptance
- [ ] SR-0 `public/models/quantity_model.json` present; loads client-side.
- [ ] SR-1 deriveBowlCuisine returns a `cuisine_vocab` member or null; tested.
- [ ] SR-2 add-mode shows "✨ Smart completions" (flag ON, model OK); hidden on
      flag-off / load-fail; names are graph-valid + bowl-excluded + scope-filtered.
- [ ] SR-3 adding a suggested ingredient prefills an editable amount; null-safe.
- [ ] SR-4 tests green; build clean. No commit until requested.
