# Plan: Briscione Wedge-Grid Affinity Wheel (RALPLAN-DR · short mode)

**Source spec:** `.omc/specs/deep-interview-briscione-wedge-grid-wheel.md`
**Pipeline:** `/ralplan --consensus --direct` (Planner stage, iteration 3)
**Baseline:** 462/462 tests passing at `5658ca1`
**Mode:** SHORT (no `--deliberate` flag; surface area is contained — one new component + algorithm + 2 mount sites)

---

## Iteration 3 changes (Critic ITERATE response)

- **(M1) Filter wiring is App.jsx-rooted, not IngredientPanel-rooted.** Verified `App.jsx:152` declares `const [filterStack, setFilterStack] = useState([])`; the real reducer is `toggleFilter(key)` at `App.jsx:230` (single-key toggler), with `clearFilters` at `:251`. `FilterPillRow` is mounted at `App.jsx:1397`, NOT inside `IngredientPanel`. `IngredientPanel`'s prop list at line 205 contains no filter setter. **Wiring contract corrected:** App.jsx defines `onFilterBucketFromWheel = useCallback((axis, bucketKey) => toggleFilter(bucketKey), [toggleFilter])` (one-line adapter — `toggleFilter` already takes a bucket key like `'sweet'` or `'fruity'`; the `axis` argument is documentation-only and reserved for future per-axis routing). The callback is threaded through `<IngredientPanel onFilterBucket={onFilterBucketFromWheel} />` (new prop, added to mounts at `App.jsx:1036` and `:1616`). `IngredientPanel` adds `onFilterBucket` to its prop destructure at line 205 and forwards it to `<WedgeGridFlavorWheel onFilterBucket={onFilterBucket} />`. There is NO new reducer; this is a thin callback adapter. Phase 3 effort bumped 0.25d → 0.5d.
- **(m1) Acceptance criterion added** for filter activation (Alt/Meta-click + legend chip) — appended to both plan and spec acceptance lists.
- **(m2) iOS Safari compact-mode QA** added to Visual regression section.
- **(m3) Alt/Meta-click discoverability** captured as Risk #15 with `title` attribute mitigation.
- **Rollback procedure** named explicitly in Phase 3.
- **Compact-mode geometry** numbers specified in Phase 2 (`rInner = hubR + ringInsetPx`, `rOuter = outerR - 8`).
- **Phase 4b promotion criteria** specified (corner-pinned shipped ≥1 release + manual QA pass on iOS Safari + desktop Chrome with no `framePerfBudget` regression).
- **Line thickness encoding** confirmed identical across modes: `1 + count(eligible categories where neighbor adds ≥1 key beyond focal)`, capped at 4 (desktop) / 3 (mobile), used both as ring-placement annotation (full mode) AND accent-strength annotation (compact mode). No divergent semantics.

---

## Iteration 2 changes (Architect REVISE response)

- **(1) Focal-empty-category guard in `accentPlacement.js`** — chose option (a): a category is **ineligible** for distinctive-ring assignment when `|focal_set[cat]| === 0`. Rationale: 3,587 of 3,913 ingredients have empty `cuisines` per session memory; normalization (option b) still lets a 1-cuisine neighbor pip a 4-method-overlap neighbor by a near-infinite gain ratio, so the cleaner fix is to exclude the ring entirely from `argmax` when the focal contributes no signal. Ineligible rings still render with neighbor presence (line thickness contribution preserved); they just can't *win* the distinctive-ring slot. Tiebreaker order shifts to next eligible ring.
- **(2) Compact mode prop on `WedgeGridFlavorWheel`** — chose Architect-recommended option (b). Same component, new `compact` boolean prop. When `compact === true`: 6 sectors retained, all 4 rings collapsed into a single radial band, max 3 named-accent cells per activated sector, line thickness encodes accent strength instead of ring placement, font scaled to `size * 0.038` (legible at 220px). 3D overlay in Phase 4a uses `compact={true}`; IngredientPanel mount uses `compact={false}` (full 6×4 grid).
- **(3) Filter pill interaction contract** — chose option (a): wheel accepts an optional `onFilterBucket: (axis, bucketKey) => void` prop. Tapping a cell with Alt/Meta calls `onFilterBucket(ringAxis, dominantBucketKeyForCell)`; tapping the aroma-swatch legend chip below the wheel calls `onFilterBucket('aroma', sectorKey)`. Wiring lives in `App.jsx` (see iter-3 M1): the adapter `onFilterBucketFromWheel = (axis, bucketKey) => toggleFilter(bucketKey)` calls the existing `toggleFilter` reducer (`App.jsx:230`) — the same reducer `FilterPillRow` calls — so wheel and pill row drive ONE state surface. If `onFilterBucket` is omitted, cells fall back to firing `onSelectIngredient` only (3D-overlay use case). No standalone pill row is added inside the wheel — pills remain in `FilterPillRow` upstream, and the wheel rings ARE the visual representation of the 4 filter axes.

---

## Principles

1. **Pure-function algorithm, dumb-render component.** Cell assignment + line thickness live in `src/data/accentPlacement.js` with no React or SVG dependency. The component only consumes the precomputed cell map. This is the unit-testable seam (Risk #8: keeps the 462 baseline green and adds coverage cheaply).
2. **Reuse the FlavorPieWheel SVG conventions, do not fork them.** Match its angle convention (`-π/2` = 12 o'clock, clockwise), its `arcPath(cx, cy, rInner, rOuter, θ0, θ1)` shape primitive, its `bucketColor(axis, key)` lookup, and its hub/label sizing constants. Wedge cells = arc paths with a sector arc-span and a per-ring radial slice.
3. **Briscione palette is already shipped — surface, don't redefine.** `BRISCIONE_AROMA`, `BRISCIONE_TASTE`, `BRISCIONE_SEASON`, `BRISCIONE_METHOD`, and `axisOrder()` all exist in `src/data/briscionePalette.js`. No new palette files; no color literals in the new component.
4. **Replace the IngredientPanel mount cleanly; keep `AffinityFlavorWheel.jsx` on disk for one release as a rollback safety net.** Spec §"Files to delete" explicitly says delete on the next major version, not now. Add a top-of-file `// @deprecated do-not-edit until {release+1}` block with an `/* eslint-disable */` directive — this is the cheap CI guard the Architect flagged (no new infra needed).
5. **Ship corner-pinned first, focal-screen-tracked second behind a flag.** The 3D overlay is the only architecturally risky piece. Treat it as two distinct phases gated by `featureFlags.affinityWheelTracking` so corner-pinned ships on day 2 and tracking is a fast-follow that can be reverted without touching the IngredientPanel surface.

---

## Decision Drivers (top 3)

1. **Zero regression in IngredientPanel** — the wheel is mounted inside `<CollapsibleSection title="Top Pairings">` at line 595. The replacement must accept the same `focalNode / neighbors / graphNodes / size` props (or be wrapped to do so) so the surrounding panel logic is untouched.
2. **Performance: ≤16ms render for ≤24 cells, asserted in jsdom** — must `useMemo` the placement map keyed on `(focal.name, neighbors.length, viewport-bucket, compact)`, not per camera tick. The 3D-overlay must NOT re-run placement on every camera move; only screen position updates. Per Architect nice-to-have: assertion (not just log) lives in `WedgeGridFlavorWheel.test.jsx`.
3. **Visual parity with Briscione print reference** — typography (serif category labels, sans cell text), thin dark ring borders (`rgba(10,10,18,0.55)` to match existing FlavorPieWheel), activated-only sector shading at 0.55 opacity. Verifiable by a dedicated screenshot test path (not a binary diff — a structural snapshot).

---

## Highest-Risk Decision: 3D Overlay Positioning (Spec Risk #1)

### Option A — Corner-Pinned Overlay in `compact` mode (DEFAULT, ship in P4a)
**Approach:** Absolute-position `WedgeGridFlavorWheel` to bottom-right of LivingArchView viewport via Tailwind (`absolute bottom-4 right-4 z-30 pointer-events-auto`). Size = 220px, `compact={true}` (no concentric rings, ≤3 named accents per activated sector, line thickness encodes accent strength). Wires `onSelectIngredient` to the existing `setSelectedNodes` callback path. `onFilterBucket` omitted (overlay is selection-only, not filtering surface).

**Pros:**
- Zero per-frame camera math. Wheel re-renders only when focal/neighbors change.
- Trivially testable in jsdom (no canvas, no WebGL, no projection matrix).
- Matches the "control surface" mental model — wheel reads as a HUD widget, not a 3D-anchored billboard.
- Compact mode keeps font ≥ `220 * 0.038 ≈ 8.4px` — legible without bumping size.

**Cons:**
- Loses spatial coupling with the 3D focal node. Spec §Goal calls this "less spatially meaningful."
- Compact mode shows less information than the IngredientPanel mount — by design, but worth noting.

### Option B — Focal-Screen-Space-Tracked Overlay (FAST-FOLLOW, P4b)
**Approach:** Lift the screen-projection pattern already in `LivingArchView.jsx:2483-2522` (the `v.set(px,py,pz).project(st.camera)` block used by the bridge-pulse overlay). Expose focal screen-xy via CSS variables `--affinity-wheel-x`/`--affinity-wheel-y` on the viewport container, updated on each `requestAnimationFrame` from the render loop. Component positions itself via `style={{ left: 'var(--affinity-wheel-x)', top: 'var(--affinity-wheel-y)' }}`. Still `compact={true}`.

**Pros:**
- Strong spatial coupling — wheel "belongs to" the focal sphere visually.
- Reuses an existing projection path; no new Three.js code.
- CSS-variable bridge avoids React re-render on every camera tick.

**Cons:**
- Edge cases: focal behind camera (`v.z > 1`), off-screen, in motion during cluster transitions. Each needs a clamp/hide rule.
- 220px compact wheel may still occlude meaningful 3D content near the viewport edge.

### Verdict
**Ship A in Phase 4a. Treat B as a Phase 4b fast-follow** behind `window.__omc?.affinityWheelTracking === true`. Spec explicitly recommends this sequencing.

---

## Phased Implementation

### Phase 1 — Pure algorithm module (0.5d)
**Create:** `src/data/accentPlacement.js`

```js
export function computeAccentPlacement(focalNode, neighbors, graphNodes, {
  isMobile = false,
  compact = false,
  maxK = 20,
  perCellCap = 4,
} = {}) { /* returns { cells, dropped, activatedAromas, ineligibleRings } */ }

// Internal helpers (exported for tests):
export function categorySignal(node, axis);
export function distinctiveRing(neighborSig, focalSig, { ineligibleRings });
export function lineThickness(neighborSig, focalSig, distinctiveRingKey);
export function activatedAromas(focalNode, odorThresholds);
export function computeIneligibleRings(focalNode); // returns Set<'taste'|'season'|'cuisine'|'method'>
```

**Algorithm contract:**
- For each neighbor in top-K (K=20 default), compute `dominantAroma = argmax(odor_*)`. If no GNN probs → drop, count in `dropped`.
- Compute 4 category sets via `categorySignal()`. Reuse `dominantMethodFor` from `cookingMethods.js`.
- **Ineligible-ring guard (iter-2 fix #1):** for each axis ∈ {taste, season, cuisine, method}, if `|categorySignal(focal, axis)| === 0`, add to `ineligibleRings`. `distinctiveRing` excludes these from `argmax`. Tiebreaker order on remaining eligible rings: `taste > cuisine > season > method`. If ALL 4 rings ineligible (extremely rare — focal has no taste/season/cuisine/method metadata at all), neighbor lands on its dominantAroma sector's innermost eligible ring with `lineThickness=1` and `distinctiveRing=null` (flagged in `cell.fallback=true`).
- `lineThickness` = `1 + count(eligible categories where neighbor adds ≥1 key beyond focal)`. Range: desktop 1..4, mobile 1..3.
- Cell collision: cap at `perCellCap=4` per `(sector, ring)`, sorted by line thickness desc. Overflow → `cell.overflow = N` for "+N more" chip.
- Mobile: drop `method` ring (added to `ineligibleRings`); method-distinctive neighbors fall through tiebreaker.
- **Compact mode (iter-2 fix #2):** when `compact === true`, collapse all rings into one (`ring='compact'`). Cap to 3 cells per activated sector. `lineThickness` is preserved and used by component as the accent-strength encoding.

### Phase 2 — `WedgeGridFlavorWheel.jsx` component (0.5d)
**Create:** `src/components/WedgeGridFlavorWheel.jsx`

Props (drop-in compatible with `AffinityFlavorWheel`, plus iter-2 additions):
```js
{
  focalNode, neighbors, graphNodes, odorThresholds,
  size = 280,
  compact = false,                    // iter-2 fix #2
  onSelectIngredient = null,
  onFilterBucket = null,              // iter-2 fix #3: (axis, bucketKey) => void
  className = '',
}
```

Geometry constants:
- `hubR = size * 0.13`, `outerR = size * 0.46`, `ringInsetPx = 6`.
- `compact === false`: rings span `[hubR + ringInsetPx, outerR]` divided into 4 equal radial slabs (3 on mobile). Cell centroid radius = midpoint of slab.
- `compact === true`: single radial band, `rInner = hubR + ringInsetPx`, `rOuter = outerR - 8` (8px buffer reserves space for the always-shown aroma label band). Cell centroid radius = `(rInner + rOuter) / 2`. No internal ring borders.

Structure (pure SVG):
- **Background sectors:** 6 aroma arcs at outer radius. Activated sectors: `BRISCIONE_AROMA[sector]` at 0.55; others at `rgba(255,255,255,0.04)`.
- **Ring borders:** 4 (desktop, `compact=false`) / 3 (mobile, `compact=false`) / 0 (any `compact=true`) concentric `<circle>` with `stroke="rgba(10,10,18,0.55)" strokeWidth=0.6`.
- **Sector dividers:** 6 radial lines from hub to outer edge.
- **Cell text:** `<text>` per cell member; sans; fontSize = `size * (compact ? 0.038 : 0.028)`. Anchored at cell centroid `(cx + r*cos(θ), cy + r*sin(θ))`.
- **Accent lines:** `<line>` from hub to centroid; strokeWidth = `thickness * 1.2`; stroke = `BRISCIONE_AROMA[sector]` at 0.7; `aria-hidden="true"`.
- **Category labels** (skipped when `compact=true`): TASTE/SEASON/CUISINE/METHOD at outer ring edges, serif, uppercase, `letter-spacing=0.08em`.
- **Aroma labels:** outermost-edge angular positions, serif uppercase. Always shown.
- **Hub:** focal name centered, `<circle r=hubR fill="rgba(10,10,18,0.85)">` + text.
- **Cell interaction (iter-2 fix #3, iter-3 m3):** onClick handler chooses based on prop wiring:
  - If `onFilterBucket && (event.altKey || event.metaKey)` → `onFilterBucket(cell.ring, cell.distinctiveBucketKey)`.
  - Else if `onSelectIngredient` → `onSelectIngredient(cell.ingredientName)`.
  - Aroma-swatch legend chips (below wheel, P5) wire to `onFilterBucket('aroma', sectorKey)` when present.
  - **Discoverability (iter-3 m3):** when `compact === false` AND `onFilterBucket != null`, each cell `<g>` gets `title={`Click to pivot; Alt-click to filter by ${cell.ring}`}` (native browser tooltip). Compact-mode cells omit the title (220px overlay leaves no room and the legend chips are the primary filter affordance there). Primary discoverability path remains the aroma-swatch legend chips.
- **A11y:** cells wrapped in `<g role="button" tabIndex={0} aria-label="{ingredient} — {aroma} aroma{ring, ' accent' if not compact}">`. Dividers + accent lines `aria-hidden="true"`. Wheel root `role="img" aria-label="...wheel for {focal}{ ' (compact)' if compact}"`.

Mobile detection: `useIsMobile()` from `src/hooks/useIsMobile.js`.

### Phase 3 — Mount in IngredientPanel + thread `onFilterBucket` from App.jsx (0.5d)
**Modify:** `src/App.jsx` AND `src/components/IngredientPanel.jsx`

`FilterPillRow` lives in `App.jsx:1397` (NOT in `IngredientPanel`), and the real reducer is `toggleFilter(key)` (`App.jsx:230`) — a single-key toggler that appends/removes from `filterStack` state at `App.jsx:152`. The wheel-to-filter wire crosses the App→IngredientPanel→WedgeGridFlavorWheel boundary.

**(A) App.jsx changes:**
1. Define adapter near the other filter callbacks (around line 253, after `clearFilters`):
   ```js
   // iter-3 M1: thin adapter — the wheel calls (axis, bucketKey); toggleFilter
   // takes a single bucket key (same surface FilterPillRow uses). `axis` is
   // documentation-only for now; reserved for future per-axis routing.
   const onFilterBucketFromWheel = useCallback((axis, bucketKey) => {
     toggleFilter(bucketKey);
   }, [toggleFilter]);
   ```
2. Thread `onFilterBucket={onFilterBucketFromWheel}` into BOTH `<IngredientPanel ... />` mounts (verified at `App.jsx:1036` and `App.jsx:1616`).

**(B) IngredientPanel.jsx changes:**
1. Add `onFilterBucket` to the prop destructure at line 205 (one prop added to the existing param list).
2. Keep `import AffinityFlavorWheel` (one-release rollback) + add `import WedgeGridFlavorWheel from './WedgeGridFlavorWheel.jsx'`.
3. Swap the 5-line mount at `IngredientPanel.jsx:595–600` (current: `<AffinityFlavorWheel focalNode={node} neighbors={sortedNeighbors} graphNodes={graphNodes} size={260} />`) to:
   ```jsx
   <WedgeGridFlavorWheel
     focalNode={node}
     neighbors={sortedNeighbors}
     graphNodes={graphNodes}
     odorThresholds={odorThresholds}
     size={260}
     compact={false}
     onSelectIngredient={onSelectIngredient}
     onFilterBucket={onFilterBucket}
   />
   ```
4. `odorThresholds` already flows from App.jsx → IngredientPanel line 205. No new data wiring.

**Rollback procedure (one-line revert):** Re-import `AffinityFlavorWheel` (still on disk under `@deprecated`) and swap the JSX block at `IngredientPanel.jsx:595–605` back to the original 5-line `<AffinityFlavorWheel ... />` form. No data migration needed; `onFilterBucket` prop becomes inert if WedgeGridFlavorWheel isn't mounted. App.jsx adapter can stay (dead) or be removed — both safe.

### Phase 4a — Corner-pinned overlay in LivingArchView, compact mode (0.5d)
**Modify:** `src/components/LivingArchView.jsx`

- Import `WedgeGridFlavorWheel`.
- Absolute-positioned overlay div inside the AffinityMode-engaged conditional. `className="absolute bottom-4 right-4 z-30 pointer-events-auto w-[220px] h-[220px]"`. Component receives `compact={true}`, `onSelectIngredient={existingNodeSelectCallback}`, `onFilterBucket={null}` (overlay does not drive filter state).
- Hide when `affinityEnabled === false` || `selectedCount !== 1`.

### Phase 4b — Focal-tracked overlay (0.25d, flag-gated)
- In the per-frame loop near LivingArchView.jsx:2511, write `--affinity-wheel-x`/`--affinity-wheel-y` CSS vars on the viewport parent.
- Wheel container reads `style={{ left: 'var(--affinity-wheel-x, calc(100% - 240px))', top: 'var(--affinity-wheel-y, calc(100% - 240px))' }}`.
- Clamp `v.z > 1 || v.z < -1` → fall back to corner defaults.
- Gate: `window.__omc?.affinityWheelTracking === true`. Still `compact={true}`.

**Promotion criteria (flag → default):** Phase 4b promotes to default when (a) corner-pinned (4a) has shipped for **≥1 release cycle** with no regression reports, (b) `window.__omc.affinityWheelTracking = true` has been manually exercised on iOS Safari (TestFlight or Capacitor preview) AND desktop Chrome with the focal-tracked overlay engaged for ≥30s of camera motion, AND (c) `AffinityMode.perf.test.js` `framePerfBudget` instrumentation shows no regression vs the 4a corner-pinned baseline (median frame time within 1ms; no dropped frames > 33ms). All three must hold before the flag default flips.

### Phase 5 — Visual polish to Briscione parity (0.5d)
- Typography pin: serif (`Georgia, "Times New Roman", serif`) for category + aroma labels; sans for ingredient cells.
- Sector dividers: 0.8px, `rgba(10,10,18,0.55)`.
- Cell hover: stroke `rgba(255,255,255,0.8)` strokeWidth 1.2 (matches FlavorPieWheel).
- Overflow chip: `<g><rect rx=4 fill="rgba(10,10,18,0.7)"><text>+{n} more</text>` at outer cell edge.
- **Aroma-swatch legend** below wheel — 6 aroma colors at 0.55. Tappable when `onFilterBucket` provided (iter-2 fix #3). Always shown for legibility (Risk #7 mitigation).

### Phase 6 — Mobile + a11y polish (0.25d)
- Verify `useIsMobile()` switches to 18-cell mode under 480px.
- Tab order: hub → 6 sectors clockwise from 12 → cells (innermost ring first per sector).
- `aria-live="polite"` announces activated-sector changes.
- Keyboard: Enter/Space fires `onSelectIngredient`; Alt+Enter fires `onFilterBucket` when wired.

**Total: ~3.0d** (Phase 3 bumped 0.25d → 0.5d to reflect App.jsx ↔ IngredientPanel ↔ WedgeGridFlavorWheel cross-component thread per iter-3 M1).

---

## Test Plan

### Unit (Vitest, jsdom)
**Create:** `src/data/__tests__/accentPlacement.test.js`
- `categorySignal()` returns Set difference correctly for taste/season/cuisine/method.
- `distinctiveRing()` picks max-gain ring; tiebreaker honored (2-way tie taste vs cuisine → taste).
- **Iter-2 fix #1 coverage:** `computeIneligibleRings()` returns `{cuisine}` when focal has `cuisines=[]`; `distinctiveRing()` skips ineligible rings entirely (assert: a neighbor with 4 cuisines and 1 taste-overlap, focal with 0 cuisines and 2 tastes, gets `distinctiveRing='taste'` not `'cuisine'`).
- Fallback: focal with no taste/season/cuisine/method → all rings ineligible → cell flagged `fallback=true`, `distinctiveRing=null`, `lineThickness=1`.
- `lineThickness()` returns 1 when only distinctive ring contributes; 4 when all 4 contribute (3 mobile).
- `activatedAromas()` returns only keys where `focal.gnnProbs[odor_X] >= odorThresholds[X]`.
- `computeAccentPlacement()` drops no-GNN neighbors, honors `perCellCap=4`, records overflow, mobile mode ≤18 cells.
- **Iter-2 fix #2 coverage:** `compact=true` produces ≤3 cells per sector, single ring `'compact'`, total ≤18 cells across 6 sectors.

**Create:** `src/components/__tests__/WedgeGridFlavorWheel.test.jsx`
- Renders 6 sector arcs always.
- Renders 4 ring borders (desktop), 3 (mobile), 0 (compact).
- Activated sectors get `BRISCIONE_AROMA[sector]`; others get faint background.
- Cell click fires `onSelectIngredient(name)`.
- **Iter-2 fix #3 / iter-3 m1 coverage:** new tests
  - `it('Alt-click on cell calls onFilterBucket with (ring, bucketKey)')` — provided callback receives `('cuisine', 'french')` style args.
  - `it('Meta-click on cell calls onFilterBucket with (ring, bucketKey)')` — mac-keyboard parity.
  - `it('plain click on cell calls onSelectIngredient when onFilterBucket present')` — confirms modifier-key gating.
  - `it('falls back to onSelectIngredient when onFilterBucket is null')` — 3D-overlay contract.
  - `it('aroma-swatch legend chip click fires onFilterBucket(\'aroma\', sectorKey)')` — legend wiring.
  - `it('cell title attribute is present and references the ring axis in full mode only')` — iter-3 m3 discoverability.
- Each cell has `role="button"` + accessible name.
- Snapshot of slice/line counts for fixture focal ("apple", 12 mock neighbors), separately for `compact=true` and `compact=false`.
- **Perf assertion (Architect nice-to-have):** `performance.now()` around a synchronous render of 24-cell desktop wheel must be **< 16ms** — asserted via `expect(elapsed).toBeLessThan(16)`. Test wrapped in `it.runIf(typeof performance !== 'undefined')` for environment safety. Tolerance band: re-run 3x, take median, to absorb CI jitter.

### Integration
- Existing `IngredientPanel.test.jsx` must still pass after mount swap; add assertion that `WedgeGridFlavorWheel` renders when `sortedNeighbors.length > 0`.

### Performance (manual + perf test)
- Extend `AffinityMode.perf.test.js`: render wheel 50× with same focal; assert no retained-heap growth beyond noise band.
- Above assertion replaces the previous "log-only" stopwatch.

### Visual regression
- Playwright/manual on `localhost:5173`: focal=apple (full), focal=salmon (full), focal=mayonnaise (no GNN data → "+12 not shown" footnote), focal=salt (empty cuisines → cuisine ring inert per iter-2 fix #1, taste ring picks up the load).
- **iOS Safari compact-mode QA (iter-3 m2):** manually render the corner-pinned overlay at 220px on iOS Safari (TestFlight or Capacitor preview build); confirm all 6 sector labels and ≥1 cell label per activated sector are readable at native pixel density (Retina). Acceptance: a user holding the device at normal phone reading distance can identify the sector name AND at least one accent ingredient without zooming.

### Baseline preservation
- `npm test` reports ≥462 passing after Phase 3; full suite + `npm run build` clean after Phase 6.

---

## Plan-level acceptance addendum (extends spec §Acceptance Criteria)

- [ ] **(iter-3 m1)** Alt-click or Meta-click on a cell, when `onFilterBucket` is provided, activates the matching filter bucket — verifiable by observing `FilterPillRow` reflect the new pill state (asserted in `WedgeGridFlavorWheel.test.jsx`, integration-asserted in `IngredientPanel.test.jsx`).
- [ ] **(iter-3 m1)** Aroma-swatch legend chip click activates the aroma-axis filter for that sector (`onFilterBucket('aroma', sectorKey)` fired; pill row reflects it).
- [ ] **(iter-3 m3)** Full-mode cells expose a `title` attribute referencing the ring axis (`'Click to pivot; Alt-click to filter by {ring}'`); compact-mode cells omit the title.

---

## Risk Register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | 3D overlay positioning complexity | HIGH | Ship corner-pinned (4a) first; focal-tracked (4b) flag-gated fast-follow reusing projection at LivingArchView.jsx:2511. |
| 2 | Cell collisions (>4 per cell) | MED | `perCellCap=4` with `+N more` chip in pure algorithm; tested. |
| 3 | `odorThresholds` not surfaced by hook | LOW | Already surfaced via useProData.js:411 → App.jsx:1067 → IngredientPanel:205. No new wiring. |
| 4 | **Focal-empty-category monoculture (iter-2 fix #1)** | **MED-HIGH** | **`computeIneligibleRings()` excludes any axis where `|focal_set[axis]| === 0` from `argmax`. Verified by unit test (focal=salt → cuisine ring inert, neighbors distribute across taste/season/method rings). Documented in algorithm contract.** |
| 5 | Neighbors with no GNN probs (1,123 hub ingredients) | MED | Drop + report `dropped`; render "{n} neighbors not shown (no aroma data)" footnote. |
| 6 | Color contrast on dark IngredientPanel vs black 3D canvas | MED | Both dark; `rgba(10,10,18,0.55)` borders already proven in FlavorPieWheel. Verify P5. |
| 7 | `BRISCIONE_AROMA.spicy` (#ea580c) vs `BRISCIONE_TASTE.pungent` (#f97316) confusion | MED | Aroma-only swatch legend below wheel in P5; pungent never appears as a sector (taste is on a ring only). |
| 8 | 462-test baseline regression | LOW | Algorithm in pure module → pure tests; 5-line IngredientPanel mount swap; existing IngredientPanel test must pass. |
| 9 | `AffinityFlavorWheel.jsx` becoming orphan dead code | LOW | Add `// @deprecated do-not-edit` + `/* eslint-disable */` block at top of file (Architect nice-to-have); remove in follow-up after one-release soak. |
| 10 | 3D overlay re-running placement on every camera tick | MED-HIGH | `useMemo` keyed on `(focal.name, neighbors.length, isMobile, compact)`; CSS-variable bridge in 4b avoids React re-render. |
| 11 | Tiebreaker non-determinism breaks snapshot tests | LOW | Spec defines explicit tiebreaker order; implement as `for...break`, not `sort()`. |
| 12 (new) | **Compact mode looks unrelated to full mode (iter-2 fix #2)** | LOW | Same component, same palette, same hub/sector geometry — only ring count + cell cap + font scale differ. Side-by-side snapshot test in `WedgeGridFlavorWheel.test.jsx` documents visual lineage. |
| 13 (new) | **Wheel render perf budget regresses silently (Architect nice-to-have)** | LOW | `expect(elapsed).toBeLessThan(16)` assertion in jsdom test; median of 3 runs; replaces prior log-only stopwatch. |
| 14 (new) | **`onFilterBucket` wiring duplicates `FilterPillRow` state (iter-2 fix #3)** | LOW | Both call the SAME `toggleFilter(key)` reducer (`App.jsx:230`) — wheel goes via the `onFilterBucketFromWheel` adapter at App.jsx (iter-3 M1); `FilterPillRow` calls `toggleFilter` directly. Single source of truth = `filterStack` state at `App.jsx:152`. Integration test asserts `FilterPillRow` pill state reflects a wheel-driven `onFilterBucket` call. |
| 15 (new) | **Alt/Meta-click affordance is invisible to users without docs (iter-3 m3)** | LOW | Cells render with `title` attribute when `compact === false` AND `onFilterBucket` provided: `'Click to pivot; Alt-click to filter by {ring}'`. Primary discoverability path is the always-shown aroma-swatch legend chips (plain click activates filter), so power-user Alt/Meta-click is a shortcut, not the sole path. Walkthrough copy update is a follow-up (F6). |

---

## ADR

- **Decision:** Replace `AffinityFlavorWheel` with `WedgeGridFlavorWheel` — a pure-SVG component with a `compact` boolean prop — backed by a pure `accentPlacement.js` algorithm module that enforces focal-eligibility on ring assignment and exposes an optional `onFilterBucket` callback for filter-state integration. **Filter wiring lives in `App.jsx`, not `IngredientPanel`** (iter-3 M1): a thin `onFilterBucketFromWheel = (axis, bucketKey) => toggleFilter(bucketKey)` adapter calls the same `toggleFilter` reducer (`App.jsx:230`) that `FilterPillRow` uses; the callback is threaded through `<IngredientPanel onFilterBucket={...} />` to `<WedgeGridFlavorWheel onFilterBucket={...} />`. Mount in IngredientPanel (`compact=false`, full 6×4 grid, filter-wired); mount as corner-pinned overlay in LivingArchView (`compact=true`, ringless, selection-only). Ship focal-screen-tracking behind a flag.
- **Drivers:** (1) zero IngredientPanel regression, (2) ≤16ms render perf asserted in jsdom, (3) Briscione visual parity, (4) avoid monoculture-wheel failure when focal lacks category metadata (iter-2), (5) avoid sub-legible 220px overlay (iter-2), (6) avoid silent filter-pill desync (iter-2), (7) **respect the App.jsx-rooted filter-state boundary** (iter-3 M1).
- **Alternatives considered:**
  - *Single-component monolith with embedded algorithm.* Rejected — kills testability of edge cases.
  - *Focal-tracked overlay as default.* Rejected for v1 — complexity per Risk #1; flag-gated fast-follow wins the tradeoff.
  - *In-place refactor of `AffinityFlavorWheel.jsx` to add wedge-grid mode.* Rejected — different prop contracts; fork is cleaner.
  - *(Iter-2) Normalize ring gain by `max(|focal_set|, 1)` instead of excluding ineligible rings.* Rejected — still lets a neighbor with a single cuisine token outrank a neighbor with 4-method overlap when focal has empty cuisines; produces near-infinite gain ratios on a degenerate denominator. Eligibility-exclusion is cleaner and deterministic.
  - *(Iter-2) Bump 3D overlay to ≥320px to fit full grid.* Rejected — occludes 3D content; spec explicitly calls overlay an aid, not a primary surface.
  - *(Iter-2) Make overlay decorative-only (non-interactive at 220px).* Rejected — interaction is the whole point of the corner-pinned wheel; without it the overlay is just a swatch.
  - *(Iter-2) Drop filter pills entirely now that the wheel encodes 4 axes.* Rejected — pills are the discoverable text affordance; the wheel is the visual map. Both surfaces drive one reducer.
  - *(Iter-3) Define `onFilterBucketFromWheel` inside `IngredientPanel` and have IngredientPanel own the adapter.* Rejected — `filterStack`/`toggleFilter` live in `App.jsx:152/230` (verified); IngredientPanel doesn't receive them today and dragging filter state down one level would either pierce the component boundary (props drilling for state) or duplicate state in IngredientPanel (the exact two-way-binding bug the Decision avoids). Adapter belongs at the same scope as the state it reads.
  - *(Iter-3) Add a new dedicated reducer like `setActiveFilters({axis, bucket})` to give the wheel a more semantic API.* Rejected — `toggleFilter(key)` already accepts the bucket key directly (`'sweet'`, `'fruity'`, `'french'`, …) and is what `FilterPillRow` uses. Introducing a parallel reducer would create a second filter-state path; the adapter pattern keeps one reducer.
  - *(Iter-3) Make Alt/Meta-click the only filter-activation gesture.* Rejected — invisible affordance (iter-3 m3); legend chips provide a plain-click discoverable path. Alt/Meta-click is the power-user shortcut layered on top.
- **Why chosen:** Pure algorithm + dumb component = best testability and lowest regression risk. Eligibility-guard + compact-mode prop + `onFilterBucket` callback resolve the Architect's three blocking tensions without growing the component count or duplicating state. Two-phase 3D overlay matches spec recommendation. Honors brownfield reuse — no new palettes, no parallel filter system.
- **Consequences:**
  - +4 new files (component, algorithm, 2 test files), modifications to: (a) `App.jsx` (~6 lines: adapter callback + threading into both IngredientPanel mounts at `:1036` and `:1616`), (b) `IngredientPanel.jsx` (~7 lines: add `onFilterBucket` to prop destructure at `:205`, import WedgeGridFlavorWheel, swap 5-line mount at `:595-600`), (c) focused additions to `LivingArchView.jsx` for Phase 4a/4b.
  - `AffinityFlavorWheel.jsx` becomes dead code under a `@deprecated` comment + `eslint-disable` block; deleted after one-release soak.
  - Mobile drops the method ring; method-distinctive neighbors fall through tiebreaker. Documented.
  - **(Iter-2)** Empty-focal-category rings render but cannot win distinctive-ring slot — wheel degrades gracefully on metadata-sparse focals (e.g., salt) instead of producing a single dominant ring.
  - **(Iter-2)** Compact mode is a documented second rendering shape of the same component, with snapshot coverage proving visual lineage.
  - **(Iter-2)** Filter state flows in one direction (wheel → reducer → FilterPillRow + wheel), avoiding two-way binding bugs.
- **Follow-ups:**
  - F1: Delete `AffinityFlavorWheel.jsx` + orphaned tests after one-release soak.
  - F2: Phase 4b focal-tracking — promote from flag to default once iOS Safari + desktop Chrome visual QA passes.
  - F3: Animation polish for cell transitions (spec §Non-Goals — deferred).
  - F4: Briscione complementary-pairings outer ring (spec §Non-Goals — deferred).
  - F5: (Iter-2) If `onFilterBucket` proves popular, consider promoting `compact` mode to also accept filter-bucket taps via an explicit toggle.
  - F6: (Iter-3 m3) Update `Walkthrough.jsx` to document Alt/Meta-click as the wheel's power-user filter shortcut once usage telemetry confirms it's worth surfacing.
