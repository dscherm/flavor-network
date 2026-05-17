# RALPLAN: Flavor Space Primary + Notebook Polish (iteration 2 — revised)

**Source spec:** `.omc/specs/deep-interview-flavor-space-primary-and-notebook-polish.md` (13.4% ambiguity, 2-track must-ship — **spec patched in this iteration** for `centroid_3d` field name, file renames, AC#4 formula, matchesContext schema)
**Mode:** `--consensus --direct` (SHORT — not `--deliberate`; no pre-mortem required)
**Iteration:** 2 of consensus loop. Round 1 was rejected by Architect, iterated by Critic. This revision addresses 3 concurred concerns + 4 Critic gaps + 1 bonus reconciliation.

> Phase numbers (P0–P8) refer to this plan's revised phasing. Risk numbers
> (R1–R8) refer to the spec's Risks/Notes section. Two new artifacts in this
> iteration: **P0 data-fix phase** (resolves duplicate "Sour Fruit" cluster
> label) and a **Risk → Phase mitigation table**.

---

## RALPLAN-DR Summary

### Principles (non-negotiable)

1. **Legacy mode stays mounted and byte-identical.** Recipe-coocc 3D layout is
   demoted to "Recipe Network (legacy)" but every code path that serves it
   must keep working unchanged. `CameraAnimator` for legacy modes receives
   `pivotAdvanceMs: null` and executes the exact same v2 continuous-orbit
   instructions it does today — verified by a dedicated regression test.
2. **Pure-module algorithms ship with unit tests before any UI wires them.**
   `recipeAromaSimilarity.js` MUST have passing vitest coverage before P7
   consumes it. Pure functions are the cheapest test surface in the codebase.
3. **Brownfield reuse over new component creation.** Pill buttons reuse
   `FilterPillRow` styling. Matches-mode header chip reuses the project's
   chip pattern. Match cards reuse the existing card component — only the
   badge slot is new.
4. **No GNN retraining, no schema additions.** Data deltas are limited to
   (a) one cluster label re-name in `flavor_cluster_labels.json` and (b) a
   12-entry `color` backfill — both into existing schema. The GNN artifact
   at `flavor-gnn/artifacts/m3_multitask.pt` is untouched.
5. **Acceptance criteria are the contract.** All 16 spec ACs + 2 new ACs
   added in this iteration (P0 dedupe AC, legacy-regression AC) must hold
   before declaring done.

### Decision Drivers (top 3)

1. **Zero regression on the 462 passing tests.** Every change is verified
   against `npx vitest run`. Legacy-mode coverage in particular
   (`uxPipelinePlaythrough.test.jsx`, `CameraAnimator.test.js`,
   `CameraAnimator.perf.test.js`, `networkModes.test.js`) must stay green.
2. **Perceived handoff latency < 100ms.** Notebook pill click → Lab matches
   render must feel instant. Cosine ranker over ≤500 cocktails is the
   bottleneck; memoization per `(recipeName, ingredient-set-hash)` is the
   mitigation (Risk #5).
3. **Visual coherence across the Network sidebar + 3D scene.** Cluster
   sidebar chip color and 3D label sprite tint must agree per cluster.
   Drives the cluster-color hand-pick decision (ADR-1).

### Viable Options Per Major Decision (revised)

#### Decision A — Cluster-color assignment strategy → HAND-PICK ADOPTED

Iteration 1 recommended auto-blend + override (Option A3). The Critic flagged
muddy-color risk: 6 aroma × 8 taste anchors with 0.6/0.4 blend was assessed
likely to collide on ≥3 of 12 clusters. Hand-pick now adopted as primary.

| Option | Verdict | Rationale |
|---|---|---|
| **A1 — Pure auto-blend** | Rejected | Muddy-color risk on ≥3 clusters; no escape hatch. |
| **A2 — Hand-pick 12 colors (now adopted)** | **CHOSEN** | Guaranteed pairwise distinctness (ΔE > 15 enforced). Zero algorithm to maintain. 12 colors documented in this plan (see P2). |
| **A3 — Auto-blend + override field** | Deferred | Useful if cluster count grows (k=12 → k=16 has happened — commit `24d61d8`). Document the override field as a follow-up, not a deliverable. |

**Chosen palette (12 hex codes from `BRISCIONE_AROMA` ∪ `BRISCIONE_TASTE`):**
Documented in P2 below. Executor writes these directly into
`flavor_cluster_labels.json` after P0 dedupe.

#### Decision B — `matchesContext` lifecycle → CLEAR ON TAB-LEAVE

Unchanged from iteration 1. Architect and Critic both concurred.

| Option | Verdict | Rationale |
|---|---|---|
| **B1 — Clear on tab-leave (chosen)** | **CHOSEN** | Predictable, parent-owned, simplest. Spec-aligned (Risk #3). |
| **B2 — Persist across navigation** | Rejected | Stale-state requires explicit invalidation on recipe change. |
| **B3 — Explicit toggle only** | Deferred | Same staleness risk as B2 unless we invalidate on recipe change. One-line refactor if user feedback indicates accidental loss is a real friction point. |

#### Decision C — Fly-through dwell control → V2 PARAMETERIZATION (single path)

Iteration 1 proposed mode-gated v1 resurrection. Architect rejected:
`CameraAnimator.js:13-21` documents v2 was a deliberate user-feedback rewrite.
Revised approach: **parameterize v2 with a `pivotAdvanceMs` knob — null for
legacy, 3500 for flavor3D. Single code path. No v1 resurrection.**

| Option | Verdict | Rationale |
|---|---|---|
| **C1 — Mode-gated v1 branch (iteration 1)** | **REJECTED** | Resurrects v1 ("just shifts the camera a little bit"). Two code paths to maintain. Regresses the user-feedback fix that motivated v2. |
| **C2 — Single-path v2 + `pivotAdvanceMs` knob (chosen)** | **CHOSEN** | Continuous-orbit math preserved. Legacy modes pass `null` → byte-identical to today. flavor3D passes `3500` → every 3.5s the orbit pivot advances to the next cluster centroid via `easeInOutCubic`. One code path, one mental model. |
| **C3 — User-facing settings slider** | Deferred (out of scope) | Significantly more code (UI + persistence + a11y). Out of scope for 0.5d phase. |

The `pivotAdvanceMs` value lives as a single named constant
`FLAVOR3D_PIVOT_ADVANCE_MS = 3500` in `livingArchConstants.js` so the value
remains tunable from one place without scattered edits.

---

## Brownfield Divergences From Spec (resolved this iteration)

### Divergence #1 — CameraAnimator v2 preservation → resolved via ADR-3

Resolved by adopting Option C2 (parameterize v2 with `pivotAdvanceMs`). v1 is
NOT resurrected. Legacy modes get byte-identical behavior. See ADR-3.

### Divergence #2 — File name corrections → spec patched

Spec referenced `CocktailLab.jsx` / `RecipeLab.jsx`. Actual files:
**`CocktailLabV2.jsx`** and **`RecipesLab.jsx`** (`SauceLab.jsx` correct).
Spec is patched this iteration; plan uses correct names throughout.

### Divergence #3 — Field name is `centroid_3d`, NOT `centroid` → spec patched

Verified across `useProData.js:270-272`, `App.jsx:642/1942/1949`,
`LivingArchView.jsx:715/741/1370`, and `flavor_cluster_labels.json`. A bare
`centroid` access reads undefined and aims the camera at origin. Spec
pseudocode is patched this iteration; plan instructs executor to reuse the
exact field-access pattern established in `App.jsx` — no rename, no alias.

### Divergence #4 — Duplicate "Sour Fruit" cluster label → P0 added

`flavor_cluster_labels.json` has cluster IDs 3 and 10 both labeled
"Sour Fruit". The AC "Cluster chip sidebar renders the Flavor Space cluster
labels" is unmeetable as-is (two identical chips). **New P0 phase** added
before P2 to resolve the collision. AC #5 is now contingent on P0 completing.

---

## Dependency-Ordered Implementation Plan (revised — now 9 phases)

### Phase ordering rationale

```
   P0 (data-fix) ──► P1 ─┐
                          │
                    P2 ───┼──► P4 ──► (visual QA)
                          │
                    P3 ───┘    (P3 lane-independent of P2/P4 except
                                via final LivingArchView wiring)

   P5 (Notebook centering) — lane-independent quick win

   P6 (pure module + tests) ──► P7 (Lab matches mode) ──► P8 (Notebook pills + routing)
```

**Parallel-eligible lanes:**
- **Lane A (Network track):** P0 → P1 → {P2, P3 in parallel} → P4
- **Lane B (Notebook centering):** P5 — independent of everything, can ship first
- **Lane C (Handoff track):** P6 → P7 → P8

**Strict sequential dependencies:**
- **P0 → P2** — P2 writes the 12 colors keyed by cluster id; P0 must resolve
  the duplicate label before colors are assigned (so cluster 10's color is
  motivated by its actual contents, not by the wrong name).
- **P0 → P4 (via AC #5)** — sidebar chips must show 12 unique labels.
- **P2 → P4** — P4 reads the backfilled `color` field; without P2 there's
  nothing to read.
- **P6 → P7** — P7 consumes `rankByAromaSimilarity`; P7's matchesContext
  schema is defined by P6's output shape.
- **P7 → P8** — P8 navigates INTO a Lab that knows how to render
  matchesContext.

### Phase detail (revised — 9 phases including new P0)

| # | Phase | Files touched | ~LOC | Tests produced | Risks touched | Lane |
|---|---|---|---|---|---|---|
| **P0 (new)** | Resolve duplicate "Sour Fruit" cluster label collision | `public/proDataset/flavor_cluster_labels.json` (rename cluster 10's label based on its centroid composition and `top_ingredients`); optional: re-run labeler with uniqueness constraint | +0/−0 LOC, data delta only | Snapshot test: assert all 12 cluster labels in JSON are pairwise distinct strings | (new — addresses concurred concern #2) | A |
| **P1** | Reorder `MODE_CYCLE`, set `DEFAULT_MODE='flavor3D'`, rename labels | `src/data/networkModes.js`, `src/data/__tests__/networkModes.test.js` | +15/−5 | Update existing `MODE_CYCLE has 3 entries` test to assert flavor3D-first order; add `DEFAULT_MODE === 'flavor3D'` assertion | R6 (legacy regression) | A |
| **P2 (revised)** | Hand-pick 12 cluster colors → write into JSON | `public/proDataset/flavor_cluster_labels.json` (data delta — 12 hex codes written into existing `color` field per cluster) | +0 LOC (data only) | Snapshot test: assert every cluster has `color: <hex>` and the 12 hex codes are pairwise CIE-Lab ΔE > 15 | R2 (muddy colors — now eliminated by hand-pick) | A |
| **P5** | Notebook wedge wheel centering (flex/grid) | `src/components/NotebookCanvas.jsx` (or wedge wheel parent) | +5/−2 | Snapshot: wedge wheel's containing element has `justify-content: center` (or computed centering). Manual QA at 1024px + 768px | R7 (layout primitive) | B |
| **P6** | Pure recipe-aroma similarity module + tests | `src/data/recipeAromaSimilarity.js` (new), `src/data/__tests__/recipeAromaSimilarity.test.js` (new) | +180 (incl. tests) | See expanded test plan below — includes the new formula-format test (`0.823 → "82% match"`) and the new `matchesContext.items[].item` schema assertions | R4 (no-GNN edge case), Critic gaps #4, #8 | C |
| **P3 (revised)** | Add `pivotAdvanceMs` param to `CameraAnimator` v2 (single code path) | `src/three/CameraAnimator.js`, `src/three/CameraAnimator.test.js`, `src/components/livingArchConstants.js` | +60/−0 | Test: `pivotAdvanceMs === null` → orbit pivot stays on `controls.target` (byte-identical regression assertion). `pivotAdvanceMs === 3500` → after 3500ms, pivot advances to `labels[next].centroid_3d`. Field-name regression test: assert `.centroid_3d` access (NOT `.centroid`). | R1 (dwell tuning), R6 (legacy regression), Divergence #1 | A |
| **P4 (revised)** | Sidebar chips + 3D label sprite tints from cluster color; pass `pivotAdvanceMs` to CameraAnimator | `src/components/LivingArchView.jsx`; cluster sidebar chip component | +60/−10 | Snapshot: `mode === 'flavor3D'` → sidebar renders 12 chips with 12 distinct background colors; sprite materials carry per-cluster `color` uniform. **New legacy-regression test:** switching to `mode === '3D'` mounts sidebar with recipe-coocc cluster chips (NOT flavorClusterLabels chips), AND CameraAnimator is invoked with `pivotAdvanceMs: null` | R2, R6 (Critic gap #7) | A |
| **P7** | `matchesContext` prop wiring in both Labs + matches-mode UI | `src/components/CocktailLabV2.jsx`, `src/components/SauceLab.jsx` | +180/−5 | RTL tests: `matchesContext=null` → full browse (regression); non-null → ONLY items, header chip, per-card similarity badge with exact `${Math.round(similarity*100)}% match` text, matched-aroma chips, "Show all" button. Schema test: render with a fixture item that includes `name`, `ingredients`, `image` and assert all three render | R3 (lifecycle), R5 (perf), Critic gaps #4, #8 | C |
| **P8** | Notebook pill buttons + handoff routing + a11y | `src/components/NotebookCanvas.jsx`, `src/App.jsx` | +120/−0 | RTL: pill click → `computeRecipeAroma` runs → `matchesContext` lifts to App state → navigates to target Lab; pill disabled with tooltip when no GNN coverage; aria-live announcement on Lab side; tab-leave clears `matchesContext` (per ADR-2) | R4 (disable state), R7 (Notebook layout), Critic gap #5 (lifecycle wiring) | C |

**Total LOC estimate (delta, all phases):** **~620 LOC added / ~22 LOC removed** + JSON data deltas (P0 + P2). Net additions ~600 LOC. Down from iteration 1's ~770 (hand-pick eliminates the 120-LOC backfill script).

### P2 — the 12 hand-picked colors (executor writes into `flavor_cluster_labels.json`)

Drawn from `BRISCIONE_AROMA` and `BRISCIONE_TASTE`. Pairwise CIE-Lab ΔE >
15 — verified by a vitest assertion. Cluster id ↔ color assignment is at
the executor's discretion based on each cluster's centroid composition
and `top_ingredients` — the constraint is that the 12 hex codes themselves
are this palette:

```js
// Source: src/data/briscionePalette.js (BRISCIONE_AROMA + BRISCIONE_TASTE).
// Verify exact hex values against the live palette file before commit.
const CLUSTER_COLOR_PALETTE = [
  '#dc2626',  // BRISCIONE_TASTE.spicy        — red
  '#ea580c',  // BRISCIONE_AROMA.spicy        — burnt orange
  '#f59e0b',  // BRISCIONE_AROMA.fatty        — amber
  '#facc15',  // BRISCIONE_TASTE.sour         — yellow
  '#84cc16',  // BRISCIONE_AROMA.green        — lime
  '#10b981',  // BRISCIONE_AROMA.fruity-green — emerald
  '#06b6d4',  // BRISCIONE_TASTE.umami        — cyan
  '#3b82f6',  // BRISCIONE_TASTE.salty        — blue
  '#8b5cf6',  // BRISCIONE_AROMA.floral       — violet
  '#ec4899',  // BRISCIONE_TASTE.sweet        — pink
  '#a16207',  // BRISCIONE_AROMA.woody        — sienna
  '#525252',  // BRISCIONE_TASTE.bitter       — neutral dark (last-resort distinctness anchor)
];
```

> **Executor note:** Verify each hex against `briscionePalette.js`. If a value
> differs, prefer the palette source (these are placeholders sourced from
> session memory; final values come from the palette module). The ΔE > 15
> assertion in the snapshot test gates the final set.

### Suggested commit sequence

```
1.  P0    fix(data): resolve duplicate Sour Fruit cluster label collision
2.  P1    feat(network): promote flavor3D to default mode, demote legacy
3.  P5    style(notebook): center wedge wheel at desktop + tablet breakpoints
4.  P2    feat(clusters): hand-pick 12 distinct cluster colors (BRISCIONE palette)
5.  P6    feat(notebook): pure recipe-aroma similarity module + tests
6.  P3    feat(camera): pivotAdvanceMs param on v2 (single path, legacy byte-identical)
7.  P4    feat(network): per-cluster colors in sidebar + 3D sprites; pass pivotAdvanceMs
8.  P7    feat(labs): matchesContext mode in CocktailLabV2 + SauceLab
9.  P8    feat(notebook): cocktail/sauce handoff pills + routing
10. chore: AC checklist verification + visual QA pass
```

Each commit is independently revert-able. P0 is the highest-risk because it
touches data and the dedupe choice is partly editorial — Critic should review
the rename decision.

---

## Risk → Phase Mitigation Table (NEW, addresses Critic gap #5)

| Risk | Description | Mitigated by | Verification artifact |
|---|---|---|---|
| **R1** | Cluster fly-through dwell tuning (3.5s may be wrong) | P3 — `FLAVOR3D_PIVOT_ADVANCE_MS` named constant in one file | Post-deploy analytics + 30-min visual QA; in-file constant is one-edit-to-tune |
| **R2** | Cluster color backfill — muddy auto-blend | **Eliminated** by ADR-1 (hand-pick); P2 + snapshot test enforce ΔE > 15 | `flavor_cluster_labels.test.js` ΔE assertion |
| **R3** | `matchesContext` lifecycle ambiguity | P8 (tab-leave clear in `App.jsx`); ADR-2 documents the choice | RTL test in P8: tab-leave clears state |
| **R4** | Aroma-vector edge cases (no-GNN ingredients) | P6 (`computeRecipeAroma` returns null on empty); P8 (pill disabled state + tooltip) | P6 unit tests for empty/all-no-GNN; P8 RTL test for disabled-state |
| **R5** | Performance — Cocktail Lab match scan on mobile | P6 includes a memoization layer keyed on `(recipeName, ingredient-set-hash)` | P6 perf assertion: 500 cocktails ranked < 50ms uncached, < 1ms memoized |
| **R6** | Legacy mode regression (sidebar, fly-through, chip pattern) | P3 byte-identical assertion (`pivotAdvanceMs: null` path); P4 legacy-regression integration test (chip set + animator call); P1 keeps legacy mode in `MODE_CYCLE` | Three tests: CameraAnimator regression, LivingArchView mode-switch integration, MODE_CYCLE entries |
| **R7** | Notebook centering — flex vs grid uncertainty | P5 — verify existing layout primitive first; smallest viable change | Manual visual QA at 1024px + 768px; snapshot test on container |
| **R8** | Visual QA scheduling | Manual QA checklist at end of merge sequence | 30-min visual QA session post-merge; checklist enumerated below |

---

## Test Plan (revised — adds Critic-gap tests)

### Unit tests (pure functions; cheapest surface)

| Module | Coverage |
|---|---|
| `recipeAromaSimilarity.js` | `computeRecipeAroma`: empty → null; 1-ingredient; 20-ingredient happy path; all-no-GNN → null; partial coverage filters missing keys. `rankByAromaSimilarity`: cosine math validated against numpy reference vectors; descending sort; top-N=8 slice; items with no usable vector filtered; `matchedAromas` returns top-2 overlapping axes. **New (Critic gap #4):** `expect(formatSimilarityBadge(0.823)).toMatch(/^82% match$/)`; boundary cases `formatSimilarityBadge(0.0)`, `formatSimilarityBadge(1.0)`. **New (Critic gap #8):** fixture cocktail with full augment-row keys (`name`, `ingredients`, `image`); assert `result[0].item.name === fixture.name`, `Array.isArray(result[0].item.ingredients)`, `result[0].item.image === fixture.image`. |
| `networkModes.test.js` (extend) | `MODE_CYCLE[0] === 'flavor3D'`; `MODE_LABELS['3D'].includes('legacy')`; `effectiveLegacyMode('flavor3D', null) === 'mlflavor'`. |
| `CameraAnimator.test.js` (extend) | `pivotAdvanceMs === null` → orbit pivot stays on `controls.target` (byte-identical regression assertion against a recorded transform sequence). `pivotAdvanceMs === 3500` → after 3500ms simulated time, pivot advances to `labels[next].centroid_3d`. Field-name regression test: source-code grep asserts `centroid_3d` appears in the new branch and `\.centroid[^_]` does NOT. |
| `flavor_cluster_labels.test.js` (new) | All 12 cluster labels are pairwise distinct strings (P0 verification). All 12 `color` fields are valid hex AND pairwise CIE-Lab ΔE > 15 (P2 verification). |

### Integration tests (component-level, vitest + RTL)

| Surface | Assertion |
|---|---|
| `LivingArchView` mode switch | Mount in `flavor3D` (default), switch to `3D`, switch back. No console errors. Sidebar chip set differs per mode. 3D scene re-mounts both layouts without throwing. |
| **Legacy regression (Critic gap #7)** | Switching from `flavor3D` (default) to `3D` mounts the sidebar with recipe-coocc cluster chips (NOT flavorClusterLabels chips). CameraAnimator is invoked with `pivotAdvanceMs: null`. Assert via a spy on the animator constructor / setter. |
| `CocktailLabV2` with `matchesContext=null` | Renders full browse view exactly as before (regression). |
| `CocktailLabV2` with non-null `matchesContext` | Renders ONLY the items. Each card has similarity badge matching `/^\d{1,3}% match$/`. ≥1 matched-aroma chip per card. Header chip shows "Matches for {recipeName}". "Show all" button present with accessible label. |
| **Schema test (Critic gap #8)** | Render `CocktailLabV2` with `matchesContext.items[0].item` containing `name`, `ingredients`, `image`. Assert all three render via existing card component. |
| `SauceLab` parity | Same 3 assertions as CocktailLabV2. |
| `NotebookCanvas` pill rendering | Pills render below Suggestions section. Disabled state activates when recipe ingredients have zero GNN coverage. Tooltip text matches AC. |
| `App.jsx` handoff flow | Simulated pill click: `computeRecipeAroma` runs, `matchesContext` lifts to App state, navigation to target Lab tab fires. Tab leave clears matchesContext (per ADR-2). |

### Manual visual QA checklist (post-merge, pre-ship)

- [ ] Land on `https://neuralflavor.web.app` → confirm `flavor3D` is default
- [ ] Network dropdown order: `Flavor Network`, `Recipe Network (legacy)`, `2D Pairings`
- [ ] Switch to legacy → confirm old recipe-coocc layout renders, old sidebar chips render, camera orbit is the v2 continuous-orbit behavior (NOT a fly-through — that's the legacy path; pivot stays on `controls.target`)
- [ ] Engage cluster tour in `flavor3D` → confirm camera orbit pivot advances between 12 cluster centroids every ~3.5s, while continuing the v2 continuous-orbit motion (NOT a glide-and-dwell, NOT v1 behavior)
- [ ] All 12 cluster sidebar chips render with visually-distinct colors
- [ ] All 12 cluster sidebar chips have unique labels (P0 verification — no "Sour Fruit ×2")
- [ ] 3D cluster label sprites carry their assigned color
- [ ] Notebook: open a recipe → wedge wheel centered at 1440px, 1024px, 768px
- [ ] Notebook: two pills render below Suggestions; cocktail-pill click → Cocktail Lab matches mode
- [ ] Lab matches mode: 5–8 cocktails ranked; each card shows badge matching `/^\d{1,3}% match$/`; ≥1 aroma chip per card; "Matches for {recipeName}" header; "Show all" exits cleanly
- [ ] Same flow for Sauce Lab
- [ ] Edge case: `salt + water + flour` recipe → pills disabled with tooltip
- [ ] iOS: `npm run ios:sync` succeeds; spot-check Capacitor build runs default mode + handoff flow

### Performance gates

- `computeRecipeAroma` for 20 ingredients: < 5ms (spec: < 50ms)
- `rankByAromaSimilarity` over 500 cocktails: < 50ms uncached, < 1ms memoized
- Initial Network render in `flavor3D` mode: no regression vs current `3D` initial render (within 10% on mobile Capacitor build)

---

## ADRs (revised this iteration)

### ADR-1 — Cluster color assignment: HAND-PICK 12 colors (revised)

- **Decision:** Hand-pick 12 hex colors from `BRISCIONE_AROMA` ∪
  `BRISCIONE_TASTE` with pairwise CIE-Lab ΔE > 15 enforced via test.
  Documented in plan P2. Executor writes them directly into
  `flavor_cluster_labels.json`. No backfill script.
- **Drivers:**
  1. Guaranteed visual distinctness (12 unique chips + 12 unique sprite
     tints in one Network view).
  2. Zero algorithm to maintain. Reproducibility = the JSON file itself.
  3. The 6 aroma × 8 taste auto-blend was assessed likely to produce ≥3
     muddy or near-duplicate hex outputs out of 12.
- **Alternatives considered:** A1 (pure auto-blend — rejected: muddy-color
  risk); A3 (auto-blend + override — deferred: optional `color` override
  field becomes a follow-up note for future k > 12 case, NOT a deliverable
  this round).
- **Why chosen:** k = 12 is small enough for human curation. Auto-blend at
  this scale optimizes for the wrong thing (algorithmic elegance over
  visible distinctness). Hand-pick is also strictly cheaper to ship.
- **Consequences:** Dropped `flavor-gnn/scripts/assign-cluster-colors.mjs`
  from Files-to-create. Iteration LOC drops by ~120. Adding a 13th cluster
  in the future requires another human pass — accepted, with the optional
  `color` override field noted as the migration path.
- **Follow-ups:** If/when k grows past 12, revisit auto-blend with a
  curator-override escape hatch.

### ADR-2 — `matchesContext` lifecycle: clear on tab-leave (unchanged)

- **Decision:** Option B1 — leaving the Lab tab clears `matchesContext`.
  Returning shows browse-all. User re-clicks the pill to re-enter.
- **Drivers:** Predictability; parent (`App.jsx`) ownership; spec alignment
  (Risk #3).
- **Alternatives considered:** B2 (persist — rejected: staleness needs
  invalidation); B3 (explicit toggle only — same staleness risk).
- **Why chosen:** The pill is one tap away; re-trigger cost is minimal.
  Predictability beats cleverness.
- **Consequences:** Accidental tab-bounce loses matches view. If feedback
  flags this as friction, B3 is a one-line state-lifting refactor.
- **Follow-ups:** Analytics event on pill re-click within < 5s of last
  matches-mode exit (validates the friction hypothesis).

### ADR-3 — CameraAnimator: parameterize v2 with `pivotAdvanceMs`; NO v1 resurrection (revised)

- **Decision:** Single code path. v2 continuous-orbit gains a single
  `pivotAdvanceMs` parameter:
  - `null` → byte-identical to current v2 (legacy 3D/2D pass null)
  - `3500` → every 3.5s the orbit pivot advances to
    `labels[next].centroid_3d` via `easeInOutCubic`; the continuous-orbit
    motion otherwise unchanged
  - flavor3D passes `3500`. Value is a named constant
    `FLAVOR3D_PIVOT_ADVANCE_MS` in `livingArchConstants.js`.
- **Drivers:**
  1. **Preserve the v2 user-feedback fix.** v1 was rejected because it
     "just shifts the camera a little bit rather than rotating around the
     model" (`CameraAnimator.js:13-21`). Architect blocked iteration 1's
     mode-gated v1 branch on this basis.
  2. **One code path.** Two branches double test surface and double the
     places where future bugs hide.
  3. **Field-name correctness.** Uses `centroid_3d` (verified against
     `useProData.js:270-272`, `App.jsx:642/1942/1949`). Bare `centroid`
     would aim camera at origin.
- **Alternatives considered:**
  - **Iteration 1's mode-gated v1 branch** — REJECTED. Resurrected
    explicitly-replaced behavior; doubled CameraAnimator's code path count;
    legacy-mode regression risk.
  - **Single-path v2 + `pivotAdvanceMs` (chosen).**
  - **User-facing slider** — out of scope (0.5d budget).
- **Why chosen:** Parameter knob preserves v2 fully, adds the flavor3D
  variant cleanly, keeps a single state machine, and is testable as a
  byte-identical regression for the null case.
- **Consequences:** CameraAnimator gains one parameter and one
  pivot-advance branch. Both legacy and flavor3D run through the same
  ticker. Test surface increases by exactly one new assertion (the
  pivot-advance behavior) plus one regression assertion (the null path).
- **Follow-ups:** Post-deploy instrumentation on tour engagement — if
  users pause within 1s of a pivot, advance is too fast; if they manually
  advance, too slow. Tune `FLAVOR3D_PIVOT_ADVANCE_MS` accordingly.

---

## Open Questions for Architect / Critic (round 3 — if applicable)

Three items to pressure-test in the next review pass (or close out if the
revisions are accepted):

1. **P0 dedupe decision — rename or re-cluster?** Cluster IDs 3 and 10 are
   both "Sour Fruit". The plan defers the editorial choice to the executor
   based on each cluster's `top_ingredients` composition. The Critic may
   prefer pre-specifying the rename in this plan (e.g., "cluster 10
   becomes 'Sour Tropical' because its centroid is mango/passionfruit-
   heavy"). **Pressure test:** is editorial discretion at executor-time
   OK, or do we want the new label nailed down now?
2. **Should `pivotAdvanceMs` be a render-prop on `<LivingArchView>` or
   live as a constant?** ADR-3 places it as a constant in
   `livingArchConstants.js`. An alternative is to make it a prop so A/B
   testing in the future is easier. The constant choice is cheaper today;
   the prop choice is cheaper tomorrow. **Pressure test:** is "easier A/B
   testing" actually a near-term need?
3. **Should the legacy-regression integration test (Critic gap #7) live
   in `LivingArchView.test.jsx` or in a new `legacyModeRegression.test.jsx`
   file?** The former colocates with the component; the latter signals
   intent that this is a regression-gate test that future agents must not
   delete. **Pressure test:** which location maximizes the chance future
   agents see it?

---

## Final Checklist (gates the next consensus iteration, if any)

- [x] Architect's brownfield divergence ruling adopted (ADR-3 revised: v2 parameterization, no v1 branch)
- [x] Critic's 4 gaps addressed: formula in P6 + spec; risk → phase table; ADR-1 flipped to hand-pick; legacy-regression AC + test added
- [x] Concurred concerns addressed: `centroid_3d` field name patched in spec; duplicate "Sour Fruit" label resolved by new P0 phase; ADR-3 follows Architect's synthesis
- [x] File renames reconciled: `CocktailLabV2.jsx`, `RecipesLab.jsx`, `SauceLab.jsx`
- [x] `matchesContext.items[].item` schema documented in spec and plan
- [x] LOC estimate updated: ~620 added / ~22 removed (down from iteration 1's ~770; hand-pick eliminated the backfill script)
- [x] Plan fits the spec's 3.75d budget (P0 + P2 are now data-only; P3 simpler)
- [ ] Open Questions #1, #2, #3 are answered or explicitly deferred (next iteration)
- [ ] Open questions appended to `.omc/plans/open-questions.md`

---

*Plan revised for Architect + Critic round 2. Next stage: another
architect+critic pass if any open questions remain blocking; otherwise this
plan proceeds to executor (`/oh-my-claudecode:start-work
ralplan-flavor-space-primary-and-notebook-polish`).*
