# R17 — Continuous Pull-Slider Hybrid

**Status:** Implemented + verified.
**Predecessor:** R16 (commits 84ddd9f, 41fee4f, c4103ca, b7b81cd).
**Trigger:** User pushback on R16 — categorical filters silently flattened the 3D mode and the binary "no filter / wheel mode" switch hid the exploratory midpoint where cluster structure + bucket stratification both read.

## Goal

Make filter dimensions (aroma, cuisine, season, family, taste) **orthogonal** to geometry mode (3D vs 2D). The user can activate any filter in any mode without the layout silently flattening. A single global `pullStrength` slider blends continuously between the cooccurrence base (recipe-pairing positions) and the bucket-pole snap (categorical wheel positions).

## Math

For each node, position is computed per-frame as a vector lerp:

```
position(node) = (1 - pullStrength) * cooccurrenceBase + pullStrength * bucketPole
```

- `cooccurrenceBase` = the renderer's existing `posA` (3D) or `posB` (2D) Float32Array for that node.
- `bucketPole` = the **mean of poles** across active axis filters (scope filters contribute visibility only, never to pull).
- `pullStrength` ∈ [0, 1], single global value, snap stops at 0 / 0.25 / 0.5 / 0.75 / 1.

## Multi-filter composition

When N axis filters are active, the bucket-pole target for a node is the mean of its per-filter poles:

```
meanPole(node) = (1/k) * sum over axis-filters of polePositions[axis][bucketOf(axis, node)]
```

Scope filters (`cocktail-scope`, `sauce-scope`) are visibility-only. They don't contribute to the mean. Nodes missing a bucket assignment under one filter still contribute via the other filters' poles — no NaN positions.

## 3D vs 2D bucket-pole layout

- **3D mode** (`mode === 'ml'`): bucket poles distributed on a Fibonacci sphere of radius 90 around the origin. Any N buckets → roughly uniform angular spacing. Camera stays in orbit-mode at the user's existing zoom; the wheel structure becomes a "sphere of poles" the user can rotate to inspect.
- **2D mode** (`mode === 'ml2d'`): bucket poles sit on a flat ring at y=0, matching the existing `categoricalWheelPositions.js` `RING_RADIUS=90` layout. Pull=1 visually matches R16's flat wheel.

## UI

- **`FilterPullSlider`** (`src/components/FilterPullSlider.jsx`) mounted at top-center, just below the FilterBreadcrumb. Visible only when `filterStack.length > 0`.
- Range input with snap stops on release; live drag feedback during interaction.
- Keyboard: ←/→ ±5%, Shift+←/→ ±25%, Home/End to 0/100.
- ARIA: `role="slider"` with `aria-valuenow`, `aria-valuetext`, `aria-valuemin/max`.

## Files

### New
- `src/data/bucketPoles.js` — Fibonacci sphere (3D) + flat ring (2D) per-axis pole tables.
- `src/components/FilterPullSlider.jsx` — slider component.
- `src/data/__tests__/bucketPoles.test.js` — 6 unit tests.
- `src/data/__tests__/multiFilterMean.test.js` — 5 multi-filter mean tests.
- `scripts/verify-r17-pull-slider.mjs` — Playwright headless verify covering default 70%, snap stops, keyboard nav, mode-flip persistence.

### Modified
- `src/App.jsx` — `pullStrength` state, `handlePullChange` (with `performance.mark`), removed the `effectiveLegacyMode` translation shim, mounts `FilterPullSlider` below the breadcrumb. Mode prop reverts to `mode === '3D' ? 'ml' : 'ml2d'`.
- `src/components/LivingArchView.jsx` — accepts `pullStrength`; builds `polesByAxis2D` + `polesByAxis3D` alongside the existing categorical-wheel outputs; visibility-predicate useEffect now also computes the mean-pole lerp and writes it into the instance matrix; **new** filter-stack visual-state useEffect re-applies bucket colors + hides edges/particles/cluster-labels whenever `filterStack.length > 0`, regardless of mode key.

## Acceptance — observed

- Slider hidden default → ✅
- Default pull 70% → ✅
- Home/End → 0/100 → ✅
- ArrowLeft → 95 → ✅
- Shift+ArrowLeft → 70 → ✅
- Persists across 3D ↔ 2D flip → ✅
- Hidden after None click → ✅
- R16 P1/P2/P3/P4 regression scripts: 4/4 PASS → ✅
- 54/54 vitest pass across 6 data tests → ✅
- 0 console errors → ✅

## Visual evidence (in `.playwright-shots/`)

- `r17-3d-aroma-pull100.png`: 6 distinct Fibonacci-sphere poles, one per aroma bucket, fully snapped.
- `r17-3d-aroma-pull70.png`: 6 distinct color-coded clouds with internal cluster structure preserved — the exploratory midpoint.
- `r17-3d-aroma-pull0.png`: untouched cooccurrence layout (pure ML cluster blob).
- `r17-2d-aroma-pull70.png`: same midpoint experience in 2D mode (post-flip).

## What R17 leaves for v2

- **Phyllotaxis re-spread inside bucket** at pull=100 (Phase A collapses every member onto its pole, so members overlap at full snap).
- **Per-filter pull dials** (Option E2 from the brainstorm) — single global slider is the v1 default; per-filter intensity is a follow-up.
- **Camera auto-adjust on pull change** — at high pull in 3D, a slight zoom-out reveals the full sphere; currently camera stays put.
