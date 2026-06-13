# Consensus Plan: Pairing Audit + Guided Discovery + Radial Wheel

**Source spec:** `.omc/specs/deep-interview-pairing-audit-and-guided-discovery.md` (ambiguity 11.3%)
**Plan revision:** v2 (Planner revised after v1 ITERATE)
**Consensus iterations:** 2 (Planner v1 → Architect → Critic ITERATE → Planner v2 → Architect re-review → Critic **APPROVE**)
**Total effort:** **5.5 days** across 6 phases (1 + 1.5 + 2 + 3 + 4 + 5)

---

## RALPLAN-DR Summary

### Principles (5)
1. **Shared geometry, separate presentations.** Wheel layout math is pure; mode-specific concerns (story, citation, tier coloring, handoff) live in thin shells around the same geometry.
2. **The audit grades the model the user sees.** Validation harness consumes shipped artifacts; never recomputes pairing strength inline.
3. **Reuse primitives over re-implementation.** New surfaces wrap existing components (`SearchBar`, `FilterPillRow`, `surprisingAffinities`) rather than re-skinning them.
4. **Causal honesty in copy.** Engine-attributed sentences are first-class; annotative chemistry is labeled as such; disclaimers appear when the bridge wasn't used in ranking.
5. **Gate phases on data sufficiency.** Verdicts and training runs require `n ≥ 15 per axis`; below threshold, surfaces render stubs.

### Decision Drivers (top 3)
1. **Divergence risk.** Plan v1's recompute-in-audit kernel and one-component-two-modes wheel both invited silent drift.
2. **New-code budget.** Plan v1's 7 sub-pickers + dual-mode wheel inflated scope; reuse-first cuts ~40%.
3. **Story integrity.** Spec demands the curated panel narrate why a pair ranks; if narration cites compounds the engine ignored, the product lies.

### Options Considered (selected highlighted)

| Axis | Options | Selected | Rationale |
|---|---|---|---|
| A. Audit cadence | one-shot vs. rolling | **rolling (CI)** | catches regressions on every dataset rebuild |
| B. Wheel placement engine | radial vs. radial+force | **radial-only** | force layout obscures tier semantics |
| C. Bubble navigation | wizard vs. canvas vs. card grid | **card grid** | spec calls for "thoughts" not "steps" |
| D. Story copy source | LLM-generated vs. template+data | **template+data** | reproducible, auditable |
| E. Citation surfacing | inline chip vs. footnote | **inline chip** | one tap discoverable |
| F. Audit scope | recompute strength vs. **consume shipped artifacts** | **consume shipped** | eliminates silent kernel divergence (MUST FIX #1) |
| G. Wheel composition | one component two modes vs. **three artifacts (Geometry+Curated+Full)** | **three artifacts** | placement math AND label rendering AND click semantics diverge by mode (MUST FIX #3) |
| H. Bubble sub-pickers | custom-per-bubble vs. **disclosure wrappers around existing primitives** | **disclosure wrappers** | 7 one-off interactions collapse to 2 components (MUST FIX #4) |

---

## Phase 1 — Rolling Audit Harness (1d)

**Boundary (hard rule):** Phase 1 NEVER recomputes pairing strength. Reads `public/proDataset/pairings.json` + `public/proDataset/metadata.json` + `chemDataset/validation/ground_truth.json` only.

### New files
- `chemDataset/validation/score_pairings.js`
- `chemDataset/validation/lib/metrics.js` — `precisionAt(k)`, `recallAt(k)`, `axisDistribution()`, `verdictGate(perAxisCounts, threshold=15)`
- `chemDataset/validation/reports/audit-{YYYY-MM-DD}.md` (output, gitignored)
- `chemDataset/validation/ground_truth.json` (seed ≥30; ~10 FB + 10 Matrix + 10 chef-cite/curated)
- `chemDataset/validation/__tests__/score_pairings.test.js`
- `chemDataset/validation/__tests__/metrics.test.js`

### Removed from v1
- ~~`chemDataset/validation/lib/score.js`~~ — no scoring kernel

### Hash gate
On startup, `score_pairings.js` reads `metadata.generatedAt` + computes sha256 over canonical-JSON of `07-blend-v2.js` `weights[]` + `training_status`. Records both in report header. Refuses to overwrite an existing report unless `audit.scoredAgainst === metadata.generatedAt` AND `audit.weightsHash === current_weights_hash` OR `--allow-stale` is passed.

### Metrics produced
- `precisionAt{5,10,20}` (per axis: aroma, cuisine, taste, season, all)
- `recallAt20`
- `perAxisSampleCounts`
- `verdict ∈ {pass, warn, fail, insufficient}` (per axis)
- `curatedStoryCompoundOverlapRate` (live or N/A if Phase 4 fixture absent)
- `fixture_staleness_seconds` (when fixture present)

### Acceptance Criteria
- **AC-1.1:** report includes precisionAt{5,10,20}, recallAt20, perAxisSampleCounts, curatedStoryCompoundOverlapRate.
- **AC-1.2:** report shows markdown table of axis × sample count.
- **AC-1.3 (per-axis verdict gating):** for each axis where `n < 15`, emit `"insufficient (n=Y, target ≥15)"`; healthy axes still report verdict. NOT a global gate.
- **AC-1.4:** `npm run validate:pairings` exits non-zero on hash mismatch without `--allow-stale`.
- **AC-1.5:** report under 200 lines.

### npm script
```json
"validate:pairings": "node chemDataset/validation/score_pairings.js"
```

---

## Phase 1.5 — Perceptron Ablation Tool (0.5d, NEW)

**Goal:** Isolate all weight-training/SGD work. Hard-gated on ground-truth sufficiency. READ-ONLY against shipped weights.

### New files
- `chemDataset/validation/ablate_perceptron.js`
- `chemDataset/validation/lib/sgd.js`
- `chemDataset/validation/reports/ablation-{YYYY-MM-DD}.md`
- `chemDataset/validation/ablation/run-{YYYY-MM-DD}.json` (machine-readable)
- `chemDataset/validation/__tests__/ablate_perceptron.test.js`
- `chemDataset/validation/__tests__/sgd.test.js`

### Behavior
1. Refuses to run if `min(perAxisSampleCounts) < 15`.
2. Loads `proDataset/processed/pair-features.json` + `ground_truth.json`; runs SGD (lr=0.01, 100 epochs, L2=0.001).
3. Reports per-feature pre/post weights, loss curve, Top-5 |Δw|.

### npm script
```json
"validate:ablate": "node chemDataset/validation/ablate_perceptron.js"
```

### Acceptance
- **AC-1.5.1:** runs end-to-end only when n ≥ 15 per axis; else exits with gate message.
- **AC-1.5.2:** report includes pre/post weights, loss curve, Δw ranking.
- **AC-1.5.3:** no production code imports from `lib/sgd.js`.

---

## Phase 2 — Shared Wheel Geometry + Two Presentation Shells (1.5d)

### New files
- `src/components/RadialAffinityWheelGeometry.jsx` — pure layout. Exports `computeLayout({pairings, mode, filterStack, viewport}) → {wedges, dots, labels}`. Consumed via render-props (`renderWedge`, `renderDot`, `renderLabel`).
- `src/components/CuratedWheel.jsx` — composes geometry + story sub-component + citation chip + fuchsia stroke for surprising-tier matches. Reads `surprisingAffinities()` (ringIdx=0).
- `src/components/FullWheel.jsx` — composes geometry + tier-color dots + `IngredientPanel` click handoff. Reads `topAffinities()` (ringIdx ∈ {1,2,3}).

### Consumers
- `IngredientPanel.jsx` imports `FullWheel` (View as wheel toggle).
- `GuidedDiscoveryResults` imports `CuratedWheel`.
- Neither shell imports the other.

### Tests (1:1)
- `RadialAffinityWheelGeometry.test.jsx`
- `CuratedWheel.test.jsx`
- `FullWheel.test.jsx`

### Acceptance
- **AC-2.1:** all three components compile and render in isolation.
- **AC-2.2:** `RadialAffinityWheelGeometry` has zero imports from `data/`, `hooks/`, `IngredientPanel`.
- **AC-2.3:** `FullWheel` placement-test snapshot matches v1 dual-mode "full" branch within 1px on 10 samples.
- **AC-2.4:** `CuratedWheel` snapshot: all surprising hits land on innermost ring.
- **AC-2.5:** no `mode` prop exists anywhere.

---

## Phase 3 — Guided Discovery Screen 1 (1d)

### New files (3 total)
- `src/components/GuidedDiscoveryStart.jsx` — grid + LOCAL `bubbleFilterStack` (component-scoped).
- `src/components/ThoughtBubbleCard.jsx` — `<details>`-style disclosure wrapper.
- `src/data/guidedDiscovery.js` — BUBBLE_REGISTRY.

### Removed from v1
- ~~`SeasonPicker`, `CuisinePicker`, `MeatPicker`, `DessertFlag`, `AromaPicker`, `CocktailToggle`, `SauceToggle`~~ — all 7 deleted from the new-files list.

### Bubble-to-primitive mapping (in `guidedDiscovery.js`)
| bubbleKey | Primitive |
|---|---|
| `ingredient` | existing `SearchBar` (single-ingredient autocomplete) |
| `season` | 4 inline chip buttons |
| `cuisine` | existing `FilterPillRow` (filterStack=bubbleFilterStack subset for cuisine axis) |
| `meat` | 6 inline chip buttons |
| `aroma` | existing `FilterPillRow` (filterStack=bubbleFilterStack subset for aroma axis) |
| `cocktail` / `sauce` / `dessert` | boolean toggle buttons |

### Acceptance
- **AC-3.1:** renders 7 bubbles in responsive grid.
- **AC-3.2:** each bubble's expanded state shows the EXISTING primitive.
- **AC-3.3:** none of `{Season,Cuisine,Meat,Dessert,Aroma}Picker.jsx` exist in `src/components/`.
- **AC-3.4:** closing a bubble preserves its selection.
- **AC-3.5:** "Show me pairings" CTA navigates to Phase 4 with current selections.

---

## Phase 4 — Guided Discovery Screen 2 (1d)

### New files
- `src/components/GuidedDiscoveryResults.jsx`
- `src/components/StoryPanel.jsx`
- `src/data/whyThisWorks.js`
- `src/data/__fixtures__/curated_stories.json` — generated by `npm run snapshot:curated-stories`; embeds `generatedAt` timestamp.
- `src/data/__tests__/whyThisWorks.test.js`

### `whyThisWorks(pair, runtime)` output
```js
{
  causalSentence: "Our pairing engine ranked this from recipe co-occurrence in 48,588 pairings.",
  annotativeSentence: bridge ? `Both share ${bridge.compound} (${bridge.descriptor}).` : null,
  isAnnotativeCompoundUsedByRuntime: boolean,  // compound ∈ runtime.sharedCompounds
  citationsIfAny: Citation[],
  surpriseAxesMatched: string[]
}
```

### Rendering
- `causalSentence` prominent.
- `annotativeSentence` muted, prefixed "supporting context".
- Single banner at wheel top (NOT per-pairing chip): `"Chemistry data partially unavailable (FlavorDB API down); chem-bridge scores fall back to a constant. See validation/reports/LATEST.md."` — shown whenever ANY wheel pairing has `x3_chemical === 0.5`.
- Citation chip preserved when `citationsIfAny.length > 0`.

### Audit-hook fixture
- `curated_stories.json` snapshot of top-50 stories.
- Loader asserts `generatedAt >= mtime(public/proDataset/bridge_compounds.json)`; falls back to live compute if stale.
- Phase 1's audit reads this fixture for `curatedStoryCompoundOverlapRate`. Flags red if < 30%.

### Acceptance
- **AC-4.1:** `GuidedDiscoveryResults` renders `CuratedWheel` + `StoryPanel`.
- **AC-4.2:** `whyThisWorks` output matches schema for every (source, target) in pairings.json.
- **AC-4.3:** banner renders when any pairing has `x3_chemical === 0.5` (verified at component-test level).
- **AC-4.4:** `npm run snapshot:curated-stories` regenerates fixture; audit reports non-N/A overlap rate.
- **AC-4.5:** if `curatedStoryCompoundOverlapRate < 30%`, audit report flags it.

---

## Phase 5 — Landing + Walkthrough + a11y + Manual QA (0.5d)

- `LandingScreen.jsx`: rename `'Network'` → `'Explore the NeuFlavor Network'`; add 5th tile `'Guided Discovery'`.
- `App.jsx`: handle `onModeSelect('guided') → setActiveTab('guided')`; mount `GuidedDiscoveryStart` / `GuidedDiscoveryResults`.
- `Walkthrough.jsx`: update Network step copy; add Guided Discovery step. **Verify current step count first** (R7-42 onboarding modal commit may have changed the file).
- a11y pass + manual QA matrix (3 bubble combos × 2 toggles × desktop+mobile = 12 paths).

### Acceptance
- **AC-5.1:** landing tile visible; navigation flows end-to-end.
- **AC-5.2:** first-visit walkthrough triggers once (localStorage gate).
- **AC-5.3:** `aria-expanded` correct on all bubbles; `aria-live` announces story changes.
- **AC-5.4:** 12-path manual QA checklist signed off.

---

## Per-Phase Test Summary

| Phase | Test files |
|---|---|
| 1 | `score_pairings.test.js`, `metrics.test.js` |
| 1.5 | `ablate_perceptron.test.js`, `sgd.test.js` |
| 2 | `RadialAffinityWheelGeometry.test.jsx`, `CuratedWheel.test.jsx`, `FullWheel.test.jsx` |
| 3 | `GuidedDiscoveryStart.test.jsx`, `ThoughtBubbleCard.test.jsx` |
| 4 | `whyThisWorks.test.js`, `StoryPanel.test.jsx` |
| 5 | Manual QA matrix |

---

## Risks / Dependencies

| # | Risk | Mitigation | Status |
|---|------|-----------|--------|
| 1 | Audit-kernel divergence | Phase 1 boundary + hash gate | **MITIGATED** |
| 2 | Wheel-mode divergence | Three-artifact decomposition | **MITIGATED** |
| 3 | Bubble UX inflation | Disclosure wrapper + existing primitives | **MITIGATED** |
| 4 | Ground-truth seed too small | Per-axis verdict gating at n≥15 | Accepted |
| 5 | Citation chip clutter on mobile | <480px fallback in geometry layer | Accepted |
| 6 | Story copy templating breaks on new languages | i18n deferred | Deferred |
| 17 | Phase 1.5 no-op until ground truth grows | Hard gate in `ablate_perceptron.js` | Accepted |
| 18 | Story honesty drift over time | `curatedStoryCompoundOverlapRate` + 30% flag threshold | **NEW** |

---

## ADR-001 — Audit Harness Boundaries, Wheel Decomposition, Bubble Reuse

**Status:** Accepted (Plan v2, Critic APPROVE iteration 2)

**Decision:**
1. Validation harness reads only shipped `pairings.json` + `metadata.json` + `ground_truth.json`. Training/ablation isolated to Phase 1.5.
2. Radial affinity wheel split into `RadialAffinityWheelGeometry` (pure layout), `CuratedWheel`, `FullWheel`.
3. `ThoughtBubbleCard` is a `<details>`-style disclosure wrapper; children slot mounts existing primitives.

**Drivers:** divergence risk, new-code budget, story integrity.

**Alternatives Rejected:**
- Audit recomputes pairing strength (silent divergence risk).
- Wheel one component two modes (modes diverge in placement math + label rendering + click semantics).
- Bubble custom sub-pickers (7 vs. 2; ~40% new-code reduction with no UX cost).
- Bundle SGD/ablation into Phase 1 (collapses the boundary).
- Single-sentence `whyThisWorks` (conflates causal with annotative).

**Consequences (positive):**
- Audit grades the model the user sees; hash gate makes the link script-verifiable.
- Wheel divergence isolated to two thin presentation shells.
- Bubble UX new code reduced ~40%.
- Story honesty becomes a CI-measurable metric.

**Consequences (negative):**
- Phase 1.5 gating defers training until n ≥ 15 per axis.
- Three wheel components add one layer of indirection.
- Disclosure wrappers introduce one extra tap to expand a bubble.

**Follow-ups (deferred):**
- Merge geometry math into `src/data/wheelGeometry.js` if a third wheel surface appears.
- Grow `ground_truth.json` toward 50 entries per axis.
- Set CI threshold on `curatedStoryCompoundOverlapRate` once 3 audit runs stabilize.
- i18n for story templates.
- flavorpair.me competitive scope (Appendix A.1 of spec).
- Underrepresented cuisines expansion (Appendix A.2 of spec).
- Perceptron training (gated on Phase 1.5 verdict).
- Encoder swap (ChemBERTa / MolFormer).
- FlavorDB chemistry feature restoration.

---

## Executor Handoff Constraints (Critic-imposed)

**Autopilot MUST treat these as acceptance criteria of equal standing to the spec's ACs.** Any PR violating a constraint is a gate failure even if all spec ACs pass.

1. **Hash gate composition.** Audit-kernel hash = `sha256` over canonical-JSON of `proDataset/scripts/07-blend-v2.js` `weights[]` + `training_status` field, sorted by key, no whitespace. Hash recorded in each report header; mismatch → exit 1. `chemDataset/validation/lib/metrics.js` must carry a top-of-file comment: `// PURE: set/rank arithmetic only. No perceptron inference, no weight reads beyond the hash-gate header.`

2. **AC-1.3 per-axis gating.** `score_pairings.js` emits `"insufficient (n=Y, target ≥15)"` per axis where `n < 15`. Healthy axes still report a verdict. NOT a global gate.

3. **Wheel geometry export shape.** `RadialAffinityWheelGeometry` exports a data API: `computeLayout({pairings, mode, filterStack, viewport}) → {wedges[], dots[], labels[]}`. Consumed via render-props slots (`renderWedge`, `renderDot`, `renderLabel`). NO mode-conditional `{mode==='curated' ? ... : ...}` JSX permitted in the geometry layer. Mode-specific styling lives in slot implementations.

4. **Local `bubbleFilterStack`.** `GuidedDiscoveryStart.jsx` and `GuidedDiscoveryResults.jsx` own a LOCAL `bubbleFilterStack` (component-scoped `useState` or context confined to the `'guided'` activeTab subtree). MUST NOT import, call, or pass-through `setFilterStack` from `App.jsx` except inside the explicit `"Explore in the network"` CTA handler. Verifier: grep `setFilterStack` in `GuidedDiscovery*.jsx` → must return zero hits outside that one handler.

5. **`whyThisWorks` honesty + fixture freshness.** (a) `curated_stories.json` MUST embed a `generatedAt` ISO timestamp; loader asserts `generatedAt >= mtime(public/proDataset/bridge_compounds.json)` and falls back to live compute if stale. (b) Per-pairing "chemistry data unavailable" chip is COLLAPSED into a single banner at wheel top: `"Chemistry data partially unavailable (FlavorDB API down); chem-bridge scores fall back to a constant. See validation/reports/LATEST.md."` shown whenever ANY wheel pairing has `x3_chemical === 0.5`.

6. **Fixture-staleness axis.** Audit harness emits a `fixture_staleness_seconds` field in the report whenever the curated-stories fixture is present. Covered by Constraint 5(a).

7. **Ablation write-protection.** `ablate_perceptron.js` is READ-ONLY against shipped weights. It MUST write ONLY to `chemDataset/validation/ablation/run-{YYYY-MM-DD}.json`. It MUST NOT write to any path matching `proDataset/scripts/**` or `proDataset/output/**`. Pre-commit guard: any change to `proDataset/scripts/07-blend-v2.js` `weights` or `training_status` requires either a co-located `chemDataset/validation/ablation/audit-pass-{date}.json` artifact in the same commit OR an explicit `<perceptron_retrain stem='...' />` tag in the commit message.

---

## Open Questions (for autopilot)

1. **Ablation script directory placement.** Spec puts validation under `chemDataset/validation/`; `proDataset/scripts/07-blend-v2.js` is where the perceptron lives. Either path is defensible — autopilot should keep ground-truth + reports under `chemDataset/validation/` per spec, and may relocate `ablate_perceptron.js` to `proDataset/validation/` if the philosophical fit dominates. Flag to user if ambiguous.

2. **Walkthrough.jsx step count.** Spec says 7; R7-42 commit may have changed it. Autopilot reads the file before adding the Guided Discovery step.

3. **Banner debouncing.** When user navigates between focals, banner appearance/disappearance should be debounced (avoid flicker). Operational, not structural.

4. **Hash-gate `--allow-weight-change` flag.** Autopilot implements `--allow-stale` and `--allow-weight-change` CLI flags; either writes a new baseline hash to the report.

5. **Lessons-applied stamping.** Per `.claude/.ralph-lessons.md`, autopilot commits MUST include `<lesson_applied stem='...' how='N' />` tags. Apply: `mark-phase-skipped`, `lesson-application-default-stamping`, `ui-projects-need-test-infrastructure`.

---

Approved-By: Critic iteration 2
Architect verdict: ITERATE-needed (one-line amendments → encoded as Executor Handoff Constraints)
Critic verdict: **APPROVE-with-handoff-notes**
Base commit: `a76bb70`
