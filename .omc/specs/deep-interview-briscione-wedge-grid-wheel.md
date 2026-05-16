# Deep Interview Spec: Briscione Wedge-Grid Affinity Wheel

## Metadata
- Interview ID: `briscione-wedge-grid-wheel-2026-05-15`
- Rounds: 7
- Final Ambiguity Score: **18.7%** (under 20% threshold)
- Type: **brownfield**
- Generated: 2026-05-15
- Threshold: 0.20
- Initial Context Summarized: no
- Status: **PASSED**

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.88 | 0.35 | 0.308 |
| Constraint Clarity | 0.75 | 0.25 | 0.188 |
| Success Criteria | 0.85 | 0.25 | 0.213 |
| Context Clarity (brownfield) | 0.70 | 0.15 | 0.105 |
| **Total Clarity** | | | **0.813** |
| **Ambiguity** | | | **0.187 (18.7%)** |

---

## Goal

Replace the current 2-ring `AffinityFlavorWheel` (and its 3D-scene absence) with a **Briscione-pure wedge-cell grid wheel** that visually matches the reference Flavor Matrix wheel (Briscione, 2018). The wheel surfaces the focal ingredient's named accent ingredients in spatially-meaningful cells where:

- **6 vertical aroma sectors** (fruity / floral / green / woody / spicy / fatty) form the angular axis
- **4 concentric filter rings** (taste / season / cuisine / cooking-method) form the radial axis
- **24 cells** total = aroma sector × filter ring
- **Only activated aroma sectors shaded** — sectors where the focal's GNN probability exceeds the per-axis calibrated threshold get their Briscione bucket color filled; unactivated sectors are background
- **Each accent ingredient placed in exactly ONE cell** at `(dominant_aroma_sector, distinctive_accent_ring)`
- **Lines from focal (center) to each cell** with thickness encoding how many OTHER filter categories the accent ingredient also adds beyond the focal
- **Mobile**: drop the `method` ring below 480px viewport → 18-cell grid (6 sectors × 3 rings)
- **Mounts**: replaces the current `AffinityFlavorWheel` mount in `IngredientPanel` AND surfaces as a CSS overlay on the 3D `AffinityMode` scene

The goal is **full Briscione visual parity**: print-quality typography, ring border treatment, slice fills, and label placement — not just functional re-skin.

---

## Defined Variables

### Algorithm

```
// For each top-K (K=20) neighbor of the focal:
function placeNeighbor(neighbor, focal):
    dominantAroma     = argmax(neighbor.gnnProbs[odor_*])              // 6-way
    accentByCategory  = { cat: neighbor.signal[cat] − focal.signal[cat]
                          for cat in [taste, season, cuisine, method] }
    distinctiveRing   = argmax(accentByCategory)                       // 4-way (3 on mobile)
    otherAccents      = count(cat for cat in accentByCategory
                              if cat != distinctiveRing AND accentByCategory[cat] > 0)
    lineThickness     = 1 + otherAccents                               // 1..4

    return {
        sector: dominantAroma,
        ring:   distinctiveRing,
        thickness: lineThickness,
    }

// Activation threshold for aroma sector shading:
function isAromaActivated(focal, axis):
    return focal.gnnProbs[`odor_${axis}`] >= odorThresholds[axis]
    // Uses public/proDataset/odor_thresholds.json (already shipped from
    // GNN calibration pass; per-axis values 0.45-0.90)
```

### Filter-category signal computation (per neighbor / focal)

| Category | Signal source | Score scale |
|---|---|---|
| `taste` | `node.taste` string tokenization → 8-D presence vector | per-key 0 or 1 |
| `season` | `node.season` string tokenization → 4-D vector | per-key 0 or 1 |
| `cuisine` | `node.cuisines[]` array → presence over CulinaryDB cuisine set | per-key 0 or 1 |
| `method` | `dominantMethodFor(name, node)` → 13-D one-hot from `cookingMethods.js` | per-key 0 or 1 |

The "accent" of a neighbor against the focal in a category = number of keys where neighbor=1 AND focal=0 (set difference, treated as a count).

### Ring placement (Distinctive Accent rule)

```
ringFor(neighbor, focal) = argmax over {taste, season, cuisine, method} of
                          |neighbor[cat]_set − focal[cat]_set|
```

Tiebreaker order: taste > cuisine > season > method (when two categories tie at the max).

### Line thickness encoding

```
thickness = 1 + (count of OTHER categories where neighbor adds at least one key beyond focal)
            // Range 1..4 on desktop, 1..3 on mobile
            // Visual: stroke-width = thickness * 1.2 px (caps at 4.8px desktop)
```

### Activated aroma sector shading

```
For each aroma sector s in {fruity, floral, green, woody, spicy, fatty}:
    if focal.gnnProbs[`odor_${s}`] >= odorThresholds[s]:
        shade sector with BRISCIONE_AROMA[s], opacity 0.55
    else:
        leave background (rgba(255,255,255,0.04))
```

### Cell occupancy + collision handling

```
// Multiple neighbors may target the same (sector, ring). Pack them
// radially within the cell (a "slot stack") sorted by line thickness
// descending — thickest accent gets the cell anchor, others stack
// outward radially. Cap at 4 per cell; overflow → "+N more" chip.
```

---

## Constraints

### Visual
- **Briscione visual parity**: typography (serif for category labels, sans for cells), ring border treatment (thin dark separators), slice fills matching `BRISCIONE_AROMA` palette already shipped in `briscionePalette.js`
- **Activated-only shading**: unactivated aroma sectors must NOT carry the Briscione fill color (background tint only)
- **Line origin**: all lines start at focal center (0,0) and terminate at the centroid of the destination cell; no curves, straight radial+tangential bends as needed for readability

### Layout
- Desktop (≥480px): 6 sectors × 4 rings = 24 cells
- Mobile (<480px): 6 sectors × 3 rings (method ring dropped) = 18 cells
- Outer radius scales to `min(width, height) * 0.42` (matches `RadialAffinityWheelGeometry` convention)
- Inner hub: focal name, radius `outerR * 0.10`

### Brownfield integration
- Replace the current `<AffinityFlavorWheel>` mount in `IngredientPanel.jsx` (Top Pairings section) — DO NOT keep the 2-ring pie
- ALSO render as a CSS-positioned overlay in `LivingArchView.jsx` when AffinityMode is engaged (focal screen-space tracking required, see Risk #1)
- Reuse existing `BRISCIONE_AROMA`, `BRISCIONE_TASTE`, `BRISCIONE_SEASON`, `BRISCIONE_METHOD` palettes from `briscionePalette.js`
- Reuse `dominantMethodFor` and `methodsFor` from `cookingMethods.js`
- The activation threshold reads from `public/proDataset/odor_thresholds.json` (already shipped)

### A11y
- Each cell has `role="button"` + accessible name `"{ingredient} — {aroma} aroma, {ring} accent"`
- Cell click fires `onSelectIngredient(name)` (parent state, same wiring as current 2-ring pie)
- Activated-aroma shading announces via `aria-live="polite"` when focal changes
- Lines are decorative (`aria-hidden="true"`) — the cells carry the semantic load
- Tab order: focal hub → sectors clockwise from 12 o'clock → cells (innermost ring first)

### Performance
- Wheel render ≤16ms for ≤24 neighbor placements (one frame)
- Re-render only when focal or filter axis changes — not per camera tick

---

## Non-Goals

- **NOT replacing `RecipeFlavorWheel`** — Recipe Lab keeps its current 2-ring pie wheel; this refresh is scoped to AffinityFlavorWheel
- **NOT changing the GNN aroma model or odor thresholds** — uses the shipped per-axis calibrated thresholds
- **NOT building a new filter-category data source** — uses existing taste / season / cuisine / method signals on nodes
- **NOT animating cell placement transitions** at first ship; static layout per render
- **NOT building Briscione's outer "complementary pairings" ring** (the printed reference has an extra outer ring of suggested chefs / recipes — out of scope)
- **NOT changing IngredientPanel layout structure** — only swap the wheel component

---

## Acceptance Criteria

### Functional (must pass to ship)
- [ ] `WedgeGridFlavorWheel.jsx` component renders 6 aroma sectors × 4 filter rings (3 on mobile)
- [ ] When focal = "apple", the wheel shows ONLY sectors where apple's odor probability exceeds threshold shaded; unactivated sectors are background tint
- [ ] At least 5 named accent ingredients render in cells for a focal with ≥10 top pairings
- [ ] Each ingredient appears in exactly ONE cell (sector × ring)
- [ ] Lines from focal hub to each cell with stroke-width varying based on `1 + other-accent count` (visually distinguishable thickness range)
- [ ] Mobile viewport (<480px) drops the method ring → 3 rings rendered
- [ ] Cell click fires `onSelectIngredient(name)` to pivot the IngredientPanel
- [ ] Alt/Meta-click on a cell (when `onFilterBucket` provided) activates the matching filter bucket in `FilterPillRow`; aroma-swatch legend chip click activates the aroma filter for that sector (added by plan iter-3 m1)
- [ ] Old `AffinityFlavorWheel` is removed from IngredientPanel mount (no longer renders)
- [ ] 3D overlay version mounts in `LivingArchView` when AffinityMode is engaged, positioned at the focal's screen-space coordinates

### Visual parity (subjective, but checkable)
- [ ] Aroma sectors use `BRISCIONE_AROMA` colors at 0.55 opacity for activated, ~0.04 for inactive
- [ ] Ring borders are thin dark separators (e.g., rgba(10,10,18,0.55))
- [ ] Category labels (TASTE / SEASON / CUISINE / METHOD) appear at ring outer edges
- [ ] Aroma sector labels (FRUITY / FLORAL / ...) appear at outermost-edge angular positions
- [ ] Typography: serif for category/aroma labels, sans for ingredient cells

### Performance + a11y
- [ ] Wheel renders ≤16ms for ≤24 neighbors
- [ ] Tab order: hub → sectors clockwise → cells innermost-first
- [ ] Cells have accessible names `"{ingredient} — {aroma} aroma, {ring} accent"`
- [ ] All existing IngredientPanel tests still pass (no regressions in `src/components/__tests__/`)

---

## Implementation Plan

### Phasing
| Phase | Scope | Effort |
|---|---|---|
| **P1** | `WedgeGridFlavorWheel.jsx` component (pure SVG; no integration) | 0.5d |
| **P2** | Algorithm helpers (`computeAccentPlacement(focal, neighbors)`) — pure module + tests | 0.5d |
| **P3** | Mount in IngredientPanel (replace AffinityFlavorWheel) | 0.25d |
| **P4** | 3D overlay in LivingArchView (focal screen-space tracking) | 0.75d |
| **P5** | Visual polish to Briscione parity (typography, borders, padding) | 0.5d |
| **P6** | Mobile fallback (3-ring layout under 480px) + a11y polish | 0.25d |

**Total: ~2.75 days.**

### Files to create
| File | Purpose |
|---|---|
| `src/components/WedgeGridFlavorWheel.jsx` | New wheel component |
| `src/data/accentPlacement.js` | Pure algorithm: focal + neighbors → cell assignments |
| `src/data/__tests__/accentPlacement.test.js` | Unit tests for the algorithm |
| `src/components/__tests__/WedgeGridFlavorWheel.test.jsx` | Render tests |

### Files to modify
| File | Change |
|---|---|
| `src/components/IngredientPanel.jsx` | Remove `AffinityFlavorWheel` mount; mount `WedgeGridFlavorWheel` |
| `src/components/LivingArchView.jsx` | Add CSS overlay of `WedgeGridFlavorWheel` when AffinityMode is engaged |
| `src/components/AffinityFlavorWheel.jsx` | Mark deprecated (keep file for one release cycle in case rollback needed) |

### Files to delete (after one release cycle of soak)
| File | Reason |
|---|---|
| `src/components/AffinityFlavorWheel.jsx` | Replaced by WedgeGridFlavorWheel; remove on next major version |

---

## Risks / Notes for Executor

1. **3D overlay screen-space tracking** — positioning the wheel on the 3D canvas requires projecting the focal's world-space position to screen pixels every frame the camera moves. This is the highest-risk piece. Approaches:
   - Compute screen pos in LivingArchView per-frame and pass to React via CSS variables (cheap)
   - Pin the wheel to a corner of the viewport instead of focal-tracking (simpler, less spatially meaningful)
   - Recommend starting with corner-pinned; upgrade to focal-tracked if time permits

2. **Cell collision** — multiple neighbors may target the same (sector, ring). Pack up to 4 per cell; overflow into `"+N more"` chip on hover/tap. Pure algorithm responsibility.

3. **Activation threshold availability** — `public/proDataset/odor_thresholds.json` is loaded by `useProData` (need to verify the hook surfaces it). If not surfaced yet, add the load.

4. **Filter-category coverage gaps** — many ingredients lack `cuisines[]` data (326 of 3,913 have cuisines per session memory). Their cuisine accent count will be 0, and they'll be pushed to other rings. This is correct behavior; no special handling required.

5. **Tiebreaker on dominant aroma** — neighbors with no GNN prediction (1,123 of 3,913 hub ingredients) can't be placed. Drop them OR use a fallback "Other" sector. Recommend drop with a footnote count: "12 neighbors not shown (no aroma data)".

6. **Color contrast on light Recipe Lab background** — IngredientPanel background is dark, but the 3D overlay sits on a black canvas. Ring borders need different contrast in both contexts. Test on both surfaces.

7. **Briscione palette overlap risk** — `BRISCIONE_AROMA.spicy` is `#ea580c` (burnt orange) and `BRISCIONE_TASTE.pungent` is also `#f97316` (orange). When both are visible on the same wheel, viewers may confuse them. Add a small swatch legend next to filter pills.

8. **Existing tests** — 462 passing right now. New component + algorithm get their own tests; removing AffinityFlavorWheel may require removing/migrating its consuming tests (if any exist).

---

## Ontology (Final Entities)

| Entity | Type | Fields | Relationships |
|---|---|---|---|
| WedgeGridFlavorWheel | UI component (NEW) | sectors, rings, cells | replaces AffinityFlavorWheel |
| FocalIngredient | data | name, gnnProbs, taste, season, cuisines, dominantMethod | center of wheel |
| AccentIngredient | data | name, strength, gnnProbs, taste, season, cuisines, dominantMethod | placed in cell |
| AromaSector | layout | key (fruity/floral/green/woody/spicy/fatty), angleStart, angleEnd, activated | one of 6 angular wedges |
| FilterRing | layout | key (taste/season/cuisine/method), rInner, rOuter, label | one of 4 (3 on mobile) concentric rings |
| WheelCell | layout | sector, ring, members[], anchor | sector × ring intersection |
| AccentLine | layout | from (focal hub), to (cell anchor), thickness | one per accent ingredient |
| LineThickness | scalar | value (1..4 desktop, 1..3 mobile) | encodes other-accent count |
| ActivationThreshold | data | per-axis values from odor_thresholds.json | gates sector shading |
| DistinctiveAccent | computed | category, gain | drives ring placement |
| FilterMatchCount | computed | count (0..3 other categories) | drives line thickness |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability |
|---|---|---|---|---|---|
| 1 | 7 | 7 | — | — | N/A |
| 2 | 11 | 4 | 0 | 7 | 100% |
| 3 | 11 | 0 | 0 | 11 | 100% |
| 4 | 11 | 0 | 0 | 11 | 100% |
| 5 | 11 | 0 | 0 | 11 | 100% |
| 6 | 11 | 0 | 0 | 11 | 100% |
| 7 | 11 | 0 | 0 | 11 | 100% |

Converged at round 2; stable across rounds 3-7. Strong evidence the core ontology was captured early.

---

## Assumptions Exposed & Resolved
| Assumption | Round | Resolution |
|---|---|---|
| User wants pentagon (5-axis) like Briscione | 1 | False — keep our 6-axis hexagon (GNN-aligned) |
| Accent ingredients in single ring with line thickness | 4 | True (contrarian-tested vs multi-ring placement) |
| All 24 cells must render everywhere | 6 | False — drop method ring on mobile |
| Filter pill choice determines ring | 5 | False — distinctive-accent algorithm determines ring; filter pills are interactive secondary |
| Single layer (aroma only) | 2 | False — Briscione-pure multi-ring grid is the user's intent |
| Functional rendering = success | 7 | False — full visual parity required |

---

## Interview Transcript

<details>
<summary>7 rounds of Q&A</summary>

### Round 1 — Goal Clarity
**Q:** Pentagon (5-axis Briscione) or hexagon (6-axis GNN)?
**A:** Keep our 6-axis hexagon.

### Round 2 — Goal Clarity (geometry)
**Q:** How are accent ingredients placed — single wheel + tags, aroma-only with ring badges, or wedge-cell grid?
**A:** Wedge-cell grid (Briscione-pure) — 6 sectors × 4 rings.

### Round 3 — Constraint Clarity (surface)
**Q:** Where does this live; replace or augment?
**A:** Replace AffinityFlavorWheel in IngredientPanel + surface on 3D affinity view.

### Round 4 — Contrarian — Goal Clarity (placement)
**Q:** One cell or one-per-matching-ring?
**A:** One cell, line thickness encodes rest.

### Round 5 — Goal Clarity (dominance rule)
**Q:** How to pick the ring an ingredient lands on?
**A:** Distinctive accent (relative to focal) — argmax(neighbor − focal).

### Round 6 — Simplifier — Constraint (mobile)
**Q:** How to fit 24 cells on mobile?
**A:** Drop method ring on viewports < 480px → 18 cells.

### Round 7 — Success Criteria
**Q:** What's the "done" signal?
**A:** Full Briscione visual parity (cumulative: functional + filter pills + 3D overlay + visual styling).

</details>

---

## Pipeline next step

Per the deep-interview skill chain, this spec is ready for:

- **`/oh-my-claudecode:omc-plan --consensus --direct`** — Planner/Architect/Critic refinement before execution. Recommended for the 3D-overlay engineering question (Risk #1) which has architectural choice tradeoffs.
- **`/oh-my-claudecode:autopilot`** — direct execution if you'd rather move now.
- **`/oh-my-claudecode:ralph`** — persistence loop with verifier until acceptance criteria pass.
