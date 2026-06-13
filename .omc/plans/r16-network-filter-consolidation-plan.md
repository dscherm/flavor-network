# R16 — Network Filter Consolidation + Hub-Gap Predictor

**Spec input:** `.omc/specs/deep-interview-network-filter-consolidation.md`
**Pipeline phase:** ralplan consensus → architect REVISE → critic ITERATE → **planner revision (this doc)** → architect/critic re-review → autopilot
**Budget:** 3.5 days (Phase 1: 1d, Phase 2: 1d, Phase 3: 1d, Phase 4: 0.5d)
**Mode:** SHORT consensus (no `--deliberate` flag observed in invocation)
**Revision iteration:** 1 (addresses Architect A1-A3, Critic C1-C7)

---

## RALPLAN-DR Summary

### Principles
1. **Preserve existing wheel rendering machinery.** `categoricalAxes.js`, `categoricalWheelPositions.js`, per-bucket color caches, label sprite builders, and the morph transition animator inside `LivingArchView.jsx` keep their current shape. Wheels are demoted from "siblings" to "morph overlays" — their *invocation surface* changes, their *rendering surface* does not.
2. **Filter state is owned by App.jsx.** `filterStack` and `mode` are co-located with `livingMode` today; the consolidation keeps that locality. LivingArchView remains a controlled component that consumes `(mode, filterStack)` rather than internalizing it.
3. **Single source of truth for the filter stack.** The breadcrumb, the active-filter morph driver, the visibility predicate, and the joystick pill source all derive from one ordered `filterStack` array plus one optional `focusedCluster` (the joystick-picked bucket leaf). No mirrored Map of per-filter bucket selections.
4. **Compound-food predictor runs at build time, then loads as a sidecar.** Build-time precompute via a `chemDataset/` script produces `public/proDataset/compound_food_predictions.json`. `useProData.js` merges this sidecar into the data store BEFORE `categoricalWheelPositions` is computed. No per-frame cost, no startup-time pressure.
5. **AND-only filter semantics.** No OR, no NOT, no nested groups. Empty intersection FREEZES the previous layout and overlays a message — never animates to an empty wheel (centroid of 0 nodes is NaN).

### Decision Drivers
1. **Ship inside the 3.5-day budget.** The spec is concrete; phasing assumes no refactor of the wheel renderer. Any architecture that *requires* touching `categoricalWheelPositions.js` internals jeopardizes the budget.
2. **Zero regression on Cocktail Lab + Sauce Lab.** They are independent tabs with their own scenes. The filter stack lives inside the Network tab's surface only.
3. **Hub-gap coverage target with measured baseline.** Phase 3 hour-1 measures actual `compoundFoods.js` constituent-map breadth against the canonical `chemDataset/data/hub_ingredients.json` (1,123 hubs). If coverage ≥800/1,123 (~71%) is unreachable, downscope to "best effort, target ≥40% of mapped hubs, report measured coverage in the test output."

### Viable Options

#### Option A — Filter stack in `App.jsx`, threaded as props to `LivingArchView` **(CHOSEN)**
- **Where state lives:** `App.jsx` adds `[filterStack, setFilterStack]` next to existing `livingMode` state. `LivingArchView` receives `filterStack` as a prop. `FilterPillRow` is a sibling of `LivingArchView`; its `onToggle` updates App-level state.
- **Visibility predicate:** computed inside `LivingArchView` (or a small `useMemo` near it) by intersecting `bucketOf(f, node)` for each filter in the stack.
- **Pros:**
  - Matches the existing `livingMode` ownership pattern — minimal refactor.
  - No new context provider — straightforward prop flow that React DevTools can trace.
  - Joystick + breadcrumb + LivingArchView all read from the same `App.jsx` state, so re-renders are naturally coordinated.
  - Easy to swap `useState` for `useReducer` later if multi-step undo is wanted (v2).
- **Cons:**
  - Prop drilling 2 levels deep (App → ScenePanel → LivingArchView).
  - `App.jsx` keeps growing; future Network-tab features add more state there.

#### Option B — `FilterContext` provider wrapping the Network tab
- **Where state lives:** new `FilterContext.jsx` exporting `<FilterProvider>` and `useFilterStack()`. `FilterPillRow`, `FilterBreadcrumb`, `ClusterJoystick`, and `LivingArchView` all `useContext` to read/write.
- **Pros (steelman, per C6):**
  - Decouples App.jsx from filter mechanics — App.jsx stops accreting state.
  - Future filter consumers (e.g., an analytics overlay, a "share this view" link encoder) plug in without prop threading.
  - The standard split-state/split-setter context pattern (two providers) avoids fan-out re-renders cleanly. At 7 pills there is no realistic perf issue with this pattern. The previous draft's "context re-render perf" rejection rationale was not honest.
- **Cons:**
  - Adds Provider boilerplate and an extra layer of indirection for state that is consumed only inside the Network tab. Cocktail Lab and Sauce Lab explicitly do not subscribe.
  - Splitting state/setter into two contexts (the actual perf-correct pattern) is two providers, a custom hook, and two `useContext` calls per consumer — the simplification claim doesn't hold once you build it right.
  - The "future consumers outside the Network tab" justification is hypothetical; the spec explicitly forbids absorbing the Labs.

#### Recommendation: **Option A** (honest rationale)
- **Why Option A wins on scope, not on perf:** Option B's perf concerns are NOT load-bearing at 7 pills with a split-context pattern. The real reason to choose Option A is **scope**: filter state is consumed only inside the Network tab's component subtree, mode flip state already lives in App.jsx, and the Provider boilerplate buys nothing the prop thread doesn't already deliver. Adding a context layer for state that has exactly one logical owner and one logical subtree of consumers is gratuitous indirection.
- If a *second* Network-tab consumer (e.g., share-link encoder) emerges in v2, extracting a `useNetworkFilterState` hook (or promoting to context then) is a 30-minute refactor that doesn't alter the public contract of LivingArchView.

#### Viability check
Two viable options present (A and B). Both are defensible designs; the choice is scope-driven, not capability-driven.

---

## ADR — R16 Network Filter Consolidation

- **Decision:** Implement a two-tier control surface (Mode picker `[3D/2D]` + Filter pill row) with `filterStack` state living in `App.jsx`, threaded as props to `LivingArchView`. Reuse existing wheel rendering machinery. Add a **build-time** compound-food predictor whose output ships as a sidecar JSON merged at data-load.
- **Drivers:**
  1. 3.5-day budget binding.
  2. Zero regression on existing wheel rendering + Cocktail/Sauce Labs.
  3. Hub-gap coverage measured against a canonical hub list, with a documented fallback target if the constituent map can't meet ≥71%.
- **Alternatives considered:**
  - **Option B (FilterContext provider):** Rejected for scope (single-tab, single-subtree consumer set) and boilerplate cost. Not rejected on perf grounds — the split-context pattern would have been fine.
  - **Runtime-overlay compound-food prediction (in-app at startup):** Rejected per A3. Adding 1,123 predicted hubs after `categoricalWheelPositions` is computed forces either a re-bake (flash) or a runtime overlay map (violates Principle 1's "wheels keep their current shape"). Build-time sidecar is the clean path.
  - **Lazy compound-food prediction (on-demand per panel open):** Rejected because filter pills must honor predicted profiles before the first filter toggle (e.g., mayonnaise must appear in `Fatty` aroma bucket the moment Aroma is toggled).
  - **Keep the 8-entry dropdown, just rename items:** Rejected — spec explicitly cuts the dropdown to 2 entries and adds the pill row.
- **Why chosen:**
  - Option A is the lowest-disruption path that satisfies all hard constraints inside scope.
  - Build-time sidecar prediction is the only timing that satisfies the "compound foods participate in filter buckets" acceptance criterion WITHOUT either a flash-rebuild or a runtime-overlay branch in `bucketOf`.
- **Consequences:**
  - `App.jsx` grows by ~50 lines of filter-stack management. Acceptable; can be extracted to a hook later.
  - `chemDataset/` gains a new pipeline script (`09-predict-compound-foods.mjs`) and a new artifact (`public/proDataset/compound_food_predictions.json`). The pipeline must be re-run when constituent maps change.
  - `useProData.js` merges the sidecar into the GNN entropy map before any downstream consumer (including `categoricalWheelPositions`) reads it. Single merge point, no scattered overlay logic.
  - `MODE_IS_CATEGORICAL` set is replaced by `HAS_ACTIVE_FILTER(filterStack)` (function form); all call sites need a sweep.
  - The legacy 6 categorical mode keys (`taste2d`, `aromas2d`, `cuisine2d`, `season2d`, `family2d`, `neural`) are no longer reachable via UI. Keep them in `posForMode` as data (indexed by **axis** key — see `FILTER_TO_AXIS` table below) so the existing position cache continues to serve morphs.
- **Follow-ups (v2, out of scope):**
  - Saved filter presets ("My Italian summer night" → restore stack).
  - OR / NOT logical operators between filters.
  - Encoder swap for the weak heads (odor_spicy, odor_floral) — deferred per chemDataset notes.
  - Hub-gap predictor for ingredients with **partial** GNN prediction (currently the predictor only fires when GNN is null; an enrichment pass on weak-head ingredients is a v2 idea).

---

## Resolved: `FILTER_TO_AXIS` mapping (addresses A1)

The spec's `FILTER_KEYS` use singular form (`aroma`, `cuisine`, …) while `categoricalWheelPositions.js` indexes by axis keys (`taste`, `aromas` plural, `cuisine`, `season`, `family`). The scope filters (`cocktail-scope`, `sauce-scope`) have **no wheel data**. Phase 1 introduces an explicit mapping table in `networkModes.js`:

```js
// src/data/networkModes.js
export const FILTER_TO_AXIS = {
  'aroma':          'aromas',       // singular filter key → plural axis key
  'cuisine':        'cuisine',
  'season':         'season',
  'family':         'family',
  'taste':          'taste',
  'cocktail-scope': null,           // no wheel — visibility-only filter
  'sauce-scope':    null,           // no wheel — visibility-only filter
};

// Morph-driver resolution: pick the most recent NON-NULL-axis filter.
export function morphAxisForStack(filterStack) {
  for (let i = filterStack.length - 1; i >= 0; i--) {
    const axis = FILTER_TO_AXIS[filterStack[i]];
    if (axis !== null && axis !== undefined) return axis;
  }
  return null; // no axis → cooccurrence layout
}
```

**Scope-filter behavior (codified):**
- `cocktail-scope` and `sauce-scope` compose AND on `isVisible(node)` exactly like other filters.
- They do **not** drive the morph layout. Adding `cocktail-scope` on top of an active `cuisine` filter keeps the cuisine wheel layout; toggling `cuisine` off while `cocktail-scope` is still on falls back to **the previous non-null-axis filter, or cooccurrence if none**.
- Phase 1 acceptance test: stack `['cocktail-scope']` (scope only) renders cooccurrence layout with a reduced visible set. Stack `['cuisine', 'cocktail-scope']` renders cuisine wheel with cocktail-scope-restricted visibility.

This replaces the previous Open Question #5 ("scope filters skip the morph and reuse cooccurrence positions") with a concrete codified rule.

---

## Resolved: Empty-intersection morph behavior (addresses A2)

When `filterStack` AND-intersection reduces the visible set to **0 nodes**, the centroid of 0 nodes is NaN and animating to an empty wheel produces broken camera state.

**Codified behavior:**
- Detect empty intersection inside `LivingArchView` before kicking off morph: `if (visibleNodeCount === 0) { freezeLayout(); showEmptyOverlay(); return; }`
- `freezeLayout()` cancels any in-flight morph and holds positions at their current frame.
- `showEmptyOverlay()` renders a centered overlay reading `"No ingredients match these filters"` with a `Clear filters` button that calls `clearFilters()`.
- Camera does not animate; OrbitControls remain interactive (user can rotate the frozen layout).
- When the user reduces filters and the intersection becomes non-empty again, the morph proceeds normally **from the frozen positions** to the new layout.

This replaces the spec's "morph still runs to the empty wheel" with the corrected "freeze + overlay" behavior. **This is a deliberate spec amendment** flagged in the spec-amendment section below.

---

## Resolved: Breadcrumb leaf state is derived view-state, not a parallel Map (addresses C1)

**Chosen resolution: Option 2 from the critic's prompt** — treat the joystick-picked bucket leaf as derived view-state stored alongside the existing `focusedCluster`, not as a parallel `Map<filterKey, bucketName>`.

**State model (codified, replaces Risk #7):**
```js
// App.jsx state — exactly these for the filter system:
const [mode, setMode] = useState('3D');                // 3D | 2D
const [filterStack, setFilterStack] = useState([]);    // ordered, deduped filter keys
const [focusedCluster, setFocusedCluster] = useState(null);
// focusedCluster already exists today (commit 8749a3f). It carries the
// joystick-picked bucket pseudo-ID (e.g., -105 for "European"). It is
// reset on activeFilter change (existing useEffect).

// Derived (no new state):
const activeFilter = filterStack.at(-1) ?? null;
const morphAxis = morphAxisForStack(filterStack);
const focusedBucketLabel = focusedCluster != null
  ? bucketLabelFor(morphAxis, focusedCluster)
  : null;

// Breadcrumb segments derive from filterStack + the single focusedBucketLabel:
function breadcrumbSegments(filterStack, focusedBucketLabel) {
  const tailSegments = filterStack.map((f, i) => {
    const isTail = i === filterStack.length - 1;
    // Only the tail (active) filter can carry a picked-bucket leaf.
    if (isTail && focusedBucketLabel) return focusedBucketLabel;
    return FILTER_LABELS[f]; // e.g., 'Cuisine', 'Season'
  });
  return ['All', ...tailSegments];
}
```

**Why this honors Principle 3:** the breadcrumb has exactly one source of truth (`filterStack` + `focusedCluster`); there is no parallel `Map<filterKey, bucketName>` to keep in sync. The joystick already drives `focusedCluster`; the breadcrumb reads the same value through a label lookup.

**Trade-off acknowledged:** non-tail bucket labels (`All › European › Summer`) are NOT shown — only the tail filter shows the picked-bucket label, because `focusedCluster` is single-valued. The spec's example `All › European › Summer › Fruity` is a 4-segment chain where each segment is the **filter name** for non-tail and the **picked bucket** for tail. We document this clearly in the breadcrumb component:
- Stack `['cuisine', 'season', 'aroma']` + `focusedCluster='Fruity'` → `All › Cuisine › Season › Fruity`
- If the user wants `All › European › Summer › Fruity`, they must keep re-picking buckets as they drill, AND we'd need persisted per-filter bucket selections — which we explicitly rejected.

**This is the second deliberate spec amendment** flagged below. The simpler model wins on Principle 3 compliance.

---

## Resolved: Build-time predictor + sidecar (addresses A3, supersedes Risk #5)

**Replaces the previous Phase 3 "in-app one-shot at startup" approach.**

### New pipeline artifact
- **`public/proDataset/compound_food_predictions.json`** — produced by `chemDataset/scripts/09-predict-compound-foods.mjs`.
- Schema:
  ```json
  {
    "version": 1,
    "generated_at": "2026-05-11T...",
    "hub_set_source": "chemDataset/data/hub_ingredients.json",
    "predictions": {
      "mayonnaise": {
        "probs": { "odor_fatty": 0.71, "odor_green": 0.12, ... },
        "constituents": [
          { "name": "egg yolk", "mass_fraction": 0.10 },
          { "name": "vegetable oil", "mass_fraction": 0.80 },
          { "name": "lemon juice", "mass_fraction": 0.05 },
          { "name": "mustard", "mass_fraction": 0.05 }
        ],
        "max_prob": 0.71,
        "above_threshold": true
      },
      ...
    },
    "stats": {
      "hub_count": 1123,
      "mapped_count": 947,
      "above_threshold_count": 812,
      "coverage_pct": 72.3
    }
  }
  ```

### Build-time script
- `chemDataset/scripts/09-predict-compound-foods.mjs` reads:
  - `public/proDataset/gnn_entropy.json` (per-ingredient probs)
  - `src/data/compoundFoods.js` (constituent map, imported as ESM)
  - `chemDataset/data/hub_ingredients.json` (canonical 1,123-hub list — created Phase 3 hour 1 if absent)
- For each hub with a constituent map: weighted-average constituent GNN probs by mass-fraction, exclude `mass_fraction < 0.05`, require aggregated max prob > 0.3 to mark `above_threshold: true`.
- Emits the JSON sidecar above.
- Coverage stats are written to the JSON and printed to stdout.

### Runtime merge
- `src/hooks/useProData.js` fetches `gnn_entropy.json` AND `compound_food_predictions.json` in parallel.
- After both load: merge predicted entries into a **new combined map** `gnnEntropyAugmented` where each predicted entry is flagged `{ predictedFromComponents: true, constituents: [...] }`.
- **Crucially:** the merge happens BEFORE `categoricalWheelPositions` is built. Downstream `bucketOf` calls see the augmented map and never need a runtime-overlay branch.
- If `compound_food_predictions.json` is absent (dev mode without sidecar built), log a warning and continue with only direct GNN entries (predictor badges simply don't appear).

### Coverage assertion
- Phase 3 test asserts `predictions.stats.coverage_pct >= 71.0` when the canonical hub set has constituent mappings for ≥800 hubs.
- If hour-1 measurement shows `mapped_count < 500`, scope-cut: target becomes `coverage_pct >= 40.0` AND the executor must extend `compoundFoods.js` for the highest-pairing-count hubs until either ≥40% is reached or the day budget runs out. Measured coverage is reported in the test name (e.g., `compound_food_predictions covers 47.2% of hubs (downscoped)`).

This collapses the previous "in-app + requestIdleCallback + sidecar fallback" two-fallback structure into a single committed path.

---

## Implementation Plan

### Dependency order
1. **Data layer first** — build-time predictor + sidecar + `useProData` merge + `bucketOf` extension to honor predicted profiles (transparently, via the augmented map).
2. **Mode/filter state in App.jsx** — collapse `livingMode` to `(mode, filterStack)`. This unblocks the renderer changes.
3. **Renderer changes** — `LivingArchView.jsx` consumes `filterStack`, computes visibility predicate, routes position lookup via `morphAxisForStack`. Joystick reads `activeFilter`.
4. **UI surfaces** — `FilterPillRow`, `FilterBreadcrumb`, `HowItWorks` chip + copy, `IngredientPanel` badge.
5. **A11y + perf polish + E2E coverage.**

### Phase 1 — Mode picker collapse + filter pill row + AND-intersection (1 day)

| File | Change | New exports | Tests |
|------|--------|-------------|-------|
| `src/data/networkModes.js` | Collapse `MODE_CYCLE` to `['3D', '2D']`. Add `FILTER_KEYS = ['aroma', 'cuisine', 'season', 'family', 'taste', 'cocktail-scope', 'sauce-scope']`. Add `FILTER_LABELS` map. **Add `FILTER_TO_AXIS` table mapping singular filter keys to plural axis keys, scope filters to `null` (see "Resolved A1" above).** **Add `morphAxisForStack(filterStack)` helper.** Rename `MODE_IS_CATEGORICAL` → `HAS_ACTIVE_FILTER` (function form: `(filterStack) => filterStack.length > 0`). Keep legacy mode→filter mapping internally as `LEGACY_MODE_TO_FILTER` so `posForMode` (indexed by axis key) stays addressable. | `MODE_CYCLE`, `FILTER_KEYS`, `FILTER_LABELS`, `FILTER_TO_AXIS`, `morphAxisForStack`, `HAS_ACTIVE_FILTER`, `bucketOf(filterKey, node)` | unit: `FILTER_KEYS` length + ordering; `FILTER_TO_AXIS['aroma'] === 'aromas'`; `FILTER_TO_AXIS['cocktail-scope'] === null`; `morphAxisForStack(['cuisine', 'cocktail-scope']) === 'cuisine'`; `morphAxisForStack(['cocktail-scope']) === null`; `bucketOf` returns null for unscoped node on `cocktail-scope`. |
| `src/App.jsx` | Replace `[livingMode, setLivingMode]` with `[mode, setMode]` and `[filterStack, setFilterStack]`. Add `toggleFilter(key)` and `clearFilters()` callbacks. Derive `activeFilter = filterStack.at(-1) ?? null` and `morphAxis = morphAxisForStack(filterStack)`. Reset `focusedCluster` when `morphAxis` changes (preserve commit `8749a3f` behavior; key on axis, not raw filter key). Pass `filterStack`, `activeFilter`, `morphAxis`, `mode` down to LivingArchView. | none (component-internal) | smoke: mode flip preserves `filterStack`; **non-tail toggle test (see C2): removing `'cuisine'` from `['aroma','cuisine','season']` produces `['aroma','season']` and `morphAxis` stays `'season'` — no morph dispatched.** |
| `src/components/FilterPillRow.jsx` **(new)** | Presentational pill strip. Props: `{ filterStack, onToggle, onClear, mode, bowlSize? }`. Renders `[None, Aroma, Cuisine, Season, Family, Taste, Cocktail Scope, Sauce Scope]`. Active pill = cyan background + border. `role="group"` with `aria-label="Filter by"`, each pill `role="checkbox"` with `aria-checked`. Touch target ≥44px. | default export | unit: clicking `None` clears; clicking active pill toggles off; `aria-checked` reflects state. |
| `src/components/LivingArchView.jsx` | Accept `filterStack`, `activeFilter`, `morphAxis` props. Visibility predicate becomes `filterStack.every(f => bucketOf(f, node) !== null)`. Position lookup: if `morphAxis == null`, use cooccurrence; else `categoricalWheelPositions[morphAxis][node.name]`. Edge/particle hide condition becomes `HAS_ACTIVE_FILTER(filterStack)`. **Empty-intersection guard: before initiating morph, count visible nodes; if 0, freeze current layout and show overlay (see "Resolved A2" above).** | unchanged | snapshot: 0 filters → cooccurrence positions; 1 axis filter → wheel positions for that axis; scope-only stack → cooccurrence + reduced visible set. |

**Phase 1 acceptance gates (subset of spec):**
- Mode dropdown shows exactly `[3D, 2D]`.
- Pill row appears below mode picker; 8 pills present.
- Multi-select pills intersect node visibility.
- Morph still uses existing transition machinery (≤1.6s, 30fps mobile).
- `FILTER_TO_AXIS` correctly routes singular filter keys to plural axis keys.
- **C2 acceptance: removing a non-tail filter does NOT dispatch a morph.** Test: starting at `['aroma','cuisine','season']` with `morphAxis='season'`, calling `toggleFilter('cuisine')` produces `filterStack=['aroma','season']`, `morphAxis` still `'season'`, no `morphStart` event fired (verify via spy).

### Phase 2 — Breadcrumb + scope pills + joystick wiring + empty-intersection UX (1 day)

| File | Change | New exports | Tests |
|------|--------|-------------|-------|
| `src/components/FilterBreadcrumb.jsx` **(new)** | Presentational. Props: `{ filterStack, focusedBucketLabel, onPop }`. Renders `All › <segment1> › … › <segmentN>` per the derived-view-state model in "Resolved C1." Tail segment uses `focusedBucketLabel` when set; non-tail segments use `FILTER_LABELS[f]`. Truncates with `…` after 4 levels on mobile (`useIsMobile`), 6 on desktop. Each segment is a click target that calls `onPop(index)`. | default export | unit: pop at index 2 leaves stack length 2; mobile truncation kicks in at 5 segments; tail-only bucket label rendering. |
| `src/App.jsx` | Add `onPopBreadcrumb(index)` that slices `filterStack` to `[0, index)`. Pass to `FilterBreadcrumb`. Derive `focusedBucketLabel` from `focusedCluster` + `morphAxis` (no parallel Map). | none | integration: clicking breadcrumb segment 1 trims stack to length 1; **3D→2D flip preserves filterStack + focusedBucketLabel (C3 acceptance)**; **non-tail pop preserves morphAxis when tail filter unchanged (C2 reinforcement at the breadcrumb level)**. |
| `src/data/networkModes.js` | Add `cocktail-scope` and `sauce-scope` to `bucketOf`: returns `'in-cocktail'` or null based on existing cocktail-scope set; same for sauce. Confirm `morphAxisForStack` correctly skips these. | extend `bucketOf` | unit: `bucketOf('cocktail-scope', { name: 'lime' })` returns non-null; for `'flour'` returns null; `morphAxisForStack(['cocktail-scope'])` returns `null` → cooccurrence path. |
| `src/components/ClusterJoystick.jsx` | Extend to read `morphAxis` (NOT `activeFilter` directly — scope filters yield `morphAxis=null` and joystick reverts to ML clusters). When `morphAxis == null`, render the 10 ML cluster pills. When set, render the buckets of that axis (existing `8749a3f` work — confirm wiring still holds with renamed prop). | unchanged | smoke: switching `morphAxis` from null → 'cuisine' swaps pill source; scope-only stack keeps ML cluster pills. |
| `src/components/LivingArchView.jsx` | Render `"No ingredients match these filters"` overlay when intersection is empty. **DO NOT morph** — freeze previous layout, hold positions, keep camera interactive. Overlay includes a `Clear filters` button bound to `clearFilters()`. | unchanged | integration: combining 3 unrelated buckets → overlay visible, no morph dispatched, camera does not animate; **5-filter empty intersection (Playwright E2E, see C7)**. |
| `src/components/HUDAnnouncer.jsx` **(new, or extend existing)** | `aria-live="polite"` region that announces filter changes: `"Filter cuisine applied. 412 ingredients matching."` Fires on `filterStack` change AND on `visibleNodeCount` change. | default export | **Playwright accessibility-tree query asserts announcement fires on toggle (see C7)**. |

**Phase 2 acceptance gates:**
- Breadcrumb reads `All › Cuisine › Season › Fruity` (tail label from `focusedCluster`) for a 3-filter stack with a picked bucket on the tail.
- Cocktail Scope + Sauce Scope pills work as AND-filters; do NOT drive morph.
- Joystick pill source follows `morphAxis` (not raw `activeFilter`).
- **Empty intersection FREEZES layout (no morph) and shows overlay with `Clear filters` button (A2 acceptance).**
- **3D ↔ 2D flip preserves `filterStack` AND the breadcrumb (including `focusedBucketLabel`) — C3 acceptance.**
- **Removing a non-tail filter does NOT trigger morph (C2 acceptance, reinforced at breadcrumb-pop level).**
- **`aria-live` announcement fires on filter toggle (verified via Playwright accessibility tree query — C7).**

### Phase 3 — Build-time compound-food predictor + IngredientPanel badge + HowItWorks rewrite (1 day)

**Hour-1 measurement step (precondition):**
- Run a measurement script (or one-shot REPL) that loads `src/data/compoundFoods.js` and `chemDataset/data/hub_ingredients.json` (creating the latter from the chemDataset notes' 1,123-hub list if absent).
- Compute `mapped_count = sum(hub has constituents in compoundFoods.js)`.
- **Decision gate:**
  - If `mapped_count >= 800`: proceed with the ≥71% coverage target as written.
  - If `500 <= mapped_count < 800`: downscope to ≥40% target; extend `compoundFoods.js` opportunistically within the day.
  - If `mapped_count < 500`: hard-downscope to "best effort, measured coverage reported in test output." Phase 3 still ships the sidecar + badge + HowItWorks rewrite; only the coverage assertion threshold changes.

| File | Change | New exports | Tests |
|------|--------|-------------|-------|
| `chemDataset/data/hub_ingredients.json` **(new if absent)** | Canonical list of the 1,123 hub-ingredient names (the ones with no GNN prediction). Cite source in a top-level `_source` field referencing the chemDataset notes. | data file | none directly; consumed by script + test. |
| `chemDataset/scripts/09-predict-compound-foods.mjs` **(new)** | Build-time script per the schema in "Resolved A3." Reads `gnn_entropy.json` + `compoundFoods.js` (ESM import) + `hub_ingredients.json`. Emits `public/proDataset/compound_food_predictions.json`. Prints coverage stats. | CLI script | unit (Node test): script run on a fixture produces deterministic output; coverage stats math is correct. |
| `src/data/compoundFoodPredictor.js` **(new)** | Pure helpers used by the build-time script: `predictFromComponents(name, gnnEntropy, compoundFoodsMap)` → `ProbVector \| null`. Excludes constituents below `mass-fraction < 0.05`. Aggregates by mass-weighted mean. Multi-taste tiebreak via space-delimited string convention. Aggregated max prob must exceed 0.3 to surface; below threshold, return null. | `predictFromComponents`, `aggregateProbs` | unit: mayonnaise → fatty-dominant; honey-mustard → sweet + pungent multi-taste; ingredient with no constituents → null; constituent below threshold excluded; max prob ≤ 0.3 → null. |
| `src/data/compoundFoods.js` | Audit constituent map against `hub_ingredients.json`. Extend opportunistically per the hour-1 decision gate. Export `getCompoundFoodMap()`. **Document the hub-set citation (`hub_ingredients.json`) in a header comment.** | `getCompoundFoodMap` | unit: coverage assertion tracks the decision-gate threshold (≥71% OR ≥40% OR best-effort-with-report). The test name embeds the measured coverage percentage so it's visible in CI output. |
| `src/hooks/useProData.js` | Fetch `gnn_entropy.json` AND `compound_food_predictions.json` in parallel. Merge predicted entries into `gnnEntropyAugmented` BEFORE `categoricalWheelPositions` is computed. Flag merged entries `{ predictedFromComponents: true, constituents: [...] }`. Log a warning + continue if the sidecar is absent (dev mode). | `gnnEntropyAugmented` | integration: with sidecar present, `gnnEntropyAugmented.mayonnaise.predictedFromComponents === true`; with sidecar absent, no augmentation, no crash. |
| `src/data/networkModes.js` | `bucketOf(filter, node)` for aroma/taste filters honors predicted profiles **transparently** via the augmented map. No new branch — the sidecar is just more data in the same lookup. | unchanged | integration: mayonnaise passes `bucketOf('aroma', mayoNode)` for `Fatty`. |
| `src/components/IngredientPanel.jsx` | Add `PredictedFromComponentsBadge` next to existing odor row. Show when `node.predictedFromComponents === true`. Tooltip lists constituent ingredients + mass fractions. | none | snapshot: panel for mayonnaise shows badge + tooltip with 3+ constituents. |
| `src/components/HowItWorks.jsx` | Replace `Colors show taste profiles:` line with mode-aware copy from spec. Render a contextual chip `Colors: clusters` / `Colors: aroma buckets` / etc. in scene header (top-left, same row as mode picker). Chip is reactive to `morphAxis` (not raw `activeFilter`). | none | snapshot: chip text changes when `morphAxis` flips; chip says `Colors: clusters` for scope-only stack. |

**Phase 3 acceptance gates:**
- `compound_food_predictions.json` artifact present in `public/proDataset/`.
- Hub coverage meets the decision-gate threshold AND measured coverage is reported in test output.
- Badge appears on `IngredientPanel` for compound foods (with `predictedFromComponents: true`).
- HowItWorks copy mentions both cluster-color and filter-color modes.
- Chip in scene header updates with `morphAxis`.
- Compound foods appear in correct buckets when aroma/taste filters active (mayonnaise → `Fatty` aroma bucket).

### Phase 4 — A11y polish + perf measurement + E2E + manual QA (0.5 day)

- Mode picker → `role="radiogroup"`, each option `role="radio"`.
- `aria-live="polite"` region announces filter changes (already added in Phase 2 — verify wiring).
- `performance.mark` instrumentation around pill toggle, morph start/end, sidecar fetch+merge.
- **Playwright E2E suite (addresses C7):**
  - **E2E test 1:** 3-filter breadcrumb chain `Cuisine → Season → Aroma` shows 4 breadcrumb segments (`All › Cuisine › Season › Aroma`); 3 morph events fire (one per axis-filter activation in order); intermediate snapshots capture each morph axis.
  - **E2E test 2:** Empty-intersection overlay appears when 5 filters reduce visible set to 0. Asserts: overlay text present, `Clear filters` button present and functional, no morph dispatched between the 4th and 5th filter toggles (positions stay frozen).
  - **E2E test 3:** `aria-live` announcement fires on filter toggle. Asserts via Playwright's accessibility tree (`page.locator('[aria-live=polite]')`) that the announcement text updates after each toggle.
- Manual QA matrix: `{3D, 2D}` × `{0, 1, 2, 3, 5}-filter` stacks × `{desktop, mobile}` viewports.
- Memory leak check: 50 sequential filter toggles, retained heap delta ≤ noise floor (mirror `AffinityMode.perf.test.js`).
- Keyboard nav: pills are independently focusable via Tab, toggled with Space (no arrow nav between checkbox pills — that's a radiogroup pattern); confirmed with architect via Open Question #1 default.

**Phase 4 acceptance gates:**
- All a11y items in spec pass.
- All 3 Playwright E2E tests green.
- Perf budgets met: pill toggle ≤16ms, morph ≤1.6s + ≥30fps mobile, sidecar fetch+merge ≤50ms (network-cached) and ≤200ms (cold).
- No retained-heap growth after 50 toggle cycles.

---

## Testable Acceptance Criteria (restated from spec + revisions for executor)

### Mode picker
- Network mode dropdown shows exactly `3D` and `2D`.
- Mode flip is instant (no morph animation).
- Fresh page load: `3D` selected, cooccurrence layout renders.

### Filter pill row
- 8 pills present: `None, Aroma, Cuisine, Season, Family, Taste, Cocktail Scope, Sauce Scope`.
- Pills are independently toggleable.
- `None` clears stack in one click.
- Active pill has visible selected state (background + border).
- ≥1 filter active → edges + particles hidden.

### Filter combination
- 2+ pills → visible nodes are strict AND-intersection.
- Non-matching nodes are hidden (alpha 0), not dimmed.
- Empty intersection FREEZES layout (no morph) and shows overlay `"No ingredients match these filters"` + `Clear filters` button.
- Most-recently-activated **axis** filter drives morph layout (scope filters do NOT drive morph).
- Deactivating most-recent axis filter morphs back to previous axis filter's layout, or cooccurrence if none.
- **Removing a non-tail filter does NOT trigger a morph; visible set updates without layout change.**

### Breadcrumb
- Reads `All › <segment1> › <segment2> › …` from filter stack.
- Tail segment uses joystick-picked bucket label when set; non-tail segments use filter name.
- Clicking segment N pops stack back to length N.
- Truncates with `…` after 4 levels mobile, 6 desktop.
- **Breadcrumb persists across 3D ↔ 2D flip (filterStack AND focusedBucketLabel survive).**

### Compound-food predictor
- `compound_food_predictions.json` shipped as a build-time sidecar.
- `IngredientPanel` shows `Predicted from components` badge for ingredients with `predictedFromComponents === true`.
- Badge tooltip lists constituents + mass fractions.
- Compound foods appear in correct aroma/taste buckets.
- Coverage meets decision-gate threshold (≥71% ideal, ≥40% downscoped, or best-effort-reported).

### HowItWorks copy
- Legacy `Colors show taste profiles:` line removed.
- New copy mentions both cluster-color and filter-color modes.
- `Colors: …` chip in scene header tracks `morphAxis`.

### Cross-platform & a11y
- Touch + click both toggle pills on single tap.
- Filter activation announces via `aria-live` (verified via Playwright accessibility tree).
- 50 sequential toggles → no retained heap growth.

### Performance
- Pill toggle ≤16ms.
- Morph ≤1.6s and ≥30fps on 2020 laptop.
- Sidecar fetch+merge ≤50ms (network-cached), ≤200ms (cold).

### E2E (Playwright, addresses C7)
- 3-filter breadcrumb chain test green.
- Empty-intersection overlay test green.
- `aria-live` announcement test green.

---

## Spec Amendments (deliberate deviations from the spec, flagged for visibility)

Two places where this plan deliberately diverges from the literal spec text:

1. **Empty-intersection behavior** (spec §"Filter combination": "Empty intersection shows an overlay; the morph still runs to the empty wheel."). **Plan deviates:** the morph does NOT run to the empty wheel; layout freezes. Reason: NaN centroid causes broken camera state (A2). The overlay + frozen layout is the correct UX. Architect/critic re-review should confirm.
2. **Breadcrumb leaf semantics** (spec example: `All › European › Summer › Fruity`). **Plan deviates:** only the tail filter shows a picked-bucket label; non-tail segments show filter names. Stack `['cuisine', 'season', 'aroma']` + `focusedCluster='Fruity'` renders `All › Cuisine › Season › Fruity`. Reason: Principle 3 (single source of truth) forbids a parallel `Map<filterKey, bucketName>` (C1). The literal spec example would require persisted per-filter bucket selections.

If the architect rejects either amendment on re-review, fallback options:
- Amendment 1: implement a "zero-node safe morph" by anchoring the empty-wheel target to a stable hidden centroid. Adds complexity; we don't recommend it.
- Amendment 2: introduce `bucketSelection: Map<filterKey, bucketName>` after all, and document explicitly that it's *derived* view-state synced from joystick clicks (Option 1 from C1's prompt). Adds state-sync surface area; we don't recommend it.

---

## Risks + Mitigations

1. **Compound-food aggregation math (multi-taste tiebreaks, "no confident profile" threshold).**
   - *Risk:* Honey-mustard collapses to one taste; pure-water-like aggregates produce false-positive profiles.
   - *Mitigation:* Use space-delimited multi-taste string convention; require aggregated max prob > 0.3 to surface; below threshold, return null (no badge). Unit tests for honey-mustard, mayonnaise, vinaigrette, BBQ sauce.

2. **Stale `focusedCluster` pseudo-IDs across filter switches.**
   - *Risk:* `-100 - i` IDs collide between axes; switching axes carries the wrong bucket reference.
   - *Mitigation:* Reset `focusedCluster` in a `useEffect` on `morphAxis` change (not raw `activeFilter` change — scope filter toggles must not clear the bucket). Commit `8749a3f` already does this for `activeFilter`; update the key to `morphAxis`.

3. **Performance regression with many filters active.**
   - *Risk:* Intersection over 3,913 nodes × 5 filters per frame = 19,565 ops; if any filter does an O(M) lookup instead of O(1), the morph drops below 30fps.
   - *Mitigation:* Every `bucketOf(filter, node)` backed by a precomputed `Map`. Memoize visibility predicate by filter-stack identity. Perf test measures rebuild time with 5 filters active.

4. **Mobile touch ergonomics for 8-pill row.**
   - *Risk:* 8 pills × 44px min width = 352px minimum, but viewport can be 320px (iPhone SE).
   - *Mitigation:* Horizontally scrollable container with `overflow-x: auto` + scroll-snap. `useIsMobile()` switches to 2-row stacked layout if viewport <360px.

5. **Sidecar artifact freshness.**
   - *Risk:* Engineers extend `compoundFoods.js` without re-running the predictor script — sidecar drifts from current constituent map.
   - *Mitigation:* CI runs `npm run predict-compounds` (added to `package.json` scripts) and diffs the output against the committed sidecar; CI fails on drift. Build-time precompute is THE path (no in-app fallback per A3).

6. **`MODE_IS_CATEGORICAL` rename sweep.**
   - *Risk:* Call sites scattered; missing one leaves a dead reference at runtime.
   - *Mitigation:* `grep -r MODE_IS_CATEGORICAL src/` before Phase 1 commit; replace all with `HAS_ACTIVE_FILTER(filterStack)` or `filterStack.length > 0`. No deprecated alias — clean rename.

7. **Hub coverage falls short of ≥71%.**
   - *Risk:* `compoundFoods.js` doesn't have constituent maps for enough hubs.
   - *Mitigation:* Phase 3 hour-1 decision gate (see Phase 3 above). Three-tier fallback: ≥71% ideal → ≥40% downscoped → best-effort with measured coverage in test output.

---

## Open Questions for Critic Re-Review

(Five from the previous iteration's "Open Questions for Architect Review" have been resolved by this revision. Two remain genuinely open and one new question surfaces from the amendments.)

1. **Spec amendment 1 — empty-intersection freeze vs. morph-to-empty-wheel.** Does the architect endorse the freeze-and-overlay interpretation, or insist on the literal spec text (morph still runs)? See "Spec Amendments" section.

2. **Spec amendment 2 — tail-only bucket label in breadcrumb.** Does the architect endorse the simpler derived-view-state model (tail-only label) or require the literal spec example (`All › European › Summer › Fruity` with persisted per-filter bucket labels)? See "Spec Amendments" section.

3. **CI gate for sidecar freshness.** New `npm run predict-compounds` script that CI runs to detect drift between `compoundFoods.js` and `compound_food_predictions.json`. Does CI fail-hard on drift, or just warn? Recommend fail-hard; confirm.

---

## Open for Critic Re-review (Open Questions That Cannot Be Resolved Here)

None. All 10 points (A1-A3, C1-C7) from the revision brief are addressed in this iteration. The 3 questions above are genuinely new (or escalated) and require architect/critic judgment on the spec amendments.

---

## Budget Risk Flags

- **Phase 3 is the highest-risk phase.** Build-time predictor script + sidecar + hour-1 coverage measurement + `compoundFoods.js` audit + IngredientPanel badge + HowItWorks rewrite is genuinely 1 day. Hour-1 decision gate prevents catastrophic overrun: if coverage is unreachable, scope cuts immediately rather than burning the whole day on `compoundFoods.js` extension.
- **Phase 1 + Phase 2 are tightly scoped.** Renderer changes are additive; the filter-stack thread is mechanical. C2's "non-tail toggle doesn't morph" requires a small reducer test that's already accounted for in the Phase 1 test column.
- **Phase 4's 0.5 day is tight, especially with 3 new Playwright E2E tests added (C7).** Each E2E is ~30 min to write + run; that's 1.5 hours of the 4 available. If Phase 3 spills, Phase 4 is the first to compress: Playwright tests stay, manual QA matrix shrinks to `{3D} × {0,1,3-filter}` smoke.

---

## Handoff

Next pipeline step: **Architect re-review of this revision**, then **Critic re-review**, then **autopilot execution**. The plan is concrete enough to execute as-written; the three new Open Questions above (spec amendments + CI gate) are decisions the architect/critic should weigh in on, but each has a recommended default that doesn't block execution if endorsed.
