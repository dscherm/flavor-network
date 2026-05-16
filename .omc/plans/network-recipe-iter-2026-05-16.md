# Network + Recipe iteration plan (2026-05-16)

**Status**: in-progress (Track 1 + Track 2 shipped; Track 3/4 pending)
**Predecessor**: `.omc/plans/briscione-wedge-grid-wheel-plan.md` (shipped as
                 `WedgeGridFlavorWheel` — now retired in Recipe Lab + the 3D
                 corner overlay per user feedback)
**Triggered by**: user multi-item feedback batch on 2026-05-15 / 2026-05-16

---

## Why this plan exists

The Briscione wedge-grid wheel landed (commit `9e5ee90` → `537685e`) but
the user reviewed both surfaces and pivoted:

- **3D Affinity view**: the corner-pinned wheel was unreadable and the
  focal-tracked variant (Phase 4b) drifted oddly. User wants in-scene
  triangle/cone wedges from focal to each accent, color-coded by node
  cluster/filter, with the affinity-tier shape (★★★ bipyramid / ★★
  cylinder / ★ sphere / surprising star) at each apex.
- **Recipe Lab**: the wedge-grid clustered all accents into one cell
  when the focal had sparse metadata (the "salt focal, empty cuisines"
  failure mode generalised to chicken). User wants a single dynamic
  radar with switchable axis (taste / aroma / season / cuisine /
  method) — answers "is this dish leaning summer-y / woody / floral"
  at a glance.

Plus a long cleanup list — bugs (search Enter, filter-color reversion),
deletions (Ingredient Tree tab), UI polish (Guided thought bubbles,
ShapeLegend width), and audits ("How this works" / chemistry-data
unavailable message).

---

## Tracks

### Track 1 — bugs + cleanup ✅ SHIPPED (commit `0b04073`)

| Item | Status | Commit |
|---|---|---|
| Search bar Enter key (stale `isOpen` closure bug) | ✅ | `0b04073` |
| ShapeLegend desktop rail too wide (long uppercase title stretched `w-full` buttons) | ✅ | `0b04073` |
| Ingredient Tree button removed from Network dropdown | ✅ | `0b04073` |
| Pull pairing bar visibility — gate on `morphAxis` not `filterStack.length` | ✅ | `0b04073` |
| Filter-pill color reversion in affinity view (added `affinityModeRef.engaged` guard to R17 visual effect) | ✅ | `0b04073` |
| Filter pill while in affinity view re-shows network (same guard, plus position-lerp effect) | ✅ | `0b04073` |

### Track 2 — affinity triangles + recipe radar ✅ SHIPPED (commits `537685e`, `69b7988`, in-flight)

| Item | Status | Commit |
|---|---|---|
| Remove corner wedge-grid overlay from App.jsx | ✅ | `537685e` |
| Remove Phase 4b CSS-var RAF (no overlay to anchor) | ✅ | `537685e` |
| New `AffinityTriangleOverlay.jsx` — SVG overlay polling a projection ref at ~20Hz | ✅ | `537685e` |
| LivingArchView per-frame projection of focal + accents to viewport pixels, including color (cluster/filter) | ✅ | `537685e` |
| Cap accents to top-8, soft NDC-edge fade, apex circle + label | ✅ | `69b7988` |
| **Pivot to slim ray-aligned cones** (right-triangle iter was rotation-broken) | ✅ | in-flight |
| **Include ALL affinity tiers**, not capped — pull from `AffinityMode.currentAffinities` for tier info | ✅ | in-flight |
| **Apex shape icon matches `AFFINITY_SHAPE_LEGEND`** (bipyramid / cylinder / sphere / star per tier) | ✅ | in-flight |
| New `ProfileAxisRadar.jsx` — single radar with switchable axis (taste/aroma/season/cuisine/method) | ✅ | `537685e` |
| Rewrite `RecipeFlavorWheel.jsx` to mount ProfileAxisRadar, retain "Centered on" anchor UI | ✅ | `537685e` |

**Deferred**: aroma-sector 25%-shaded pie behind the 3D network surface
(needs a flat plane mesh + projected pie arcs — non-trivial 3D work).

### Track 3 — Guided tab makeover ⏸ PENDING

| Item | Plan |
|---|---|
| Thought-bubble outline on "I'm thinking about pairing X..." box | SVG / CSS rounded-bubble border with tail; reuse the bubble shape across screens |
| Thought-bubble outline on selection cards | Same bubble style; vary tail position per card |
| Dietary restrictions category | New filter group with chips: vegetarian / vegan / gluten-free / dairy-free / nut-free / pescatarian / kosher / halal. Filter applied to candidate pool before scoring. |
| Colored thought bubbles (visual polish) | Per-card hue tied to dominant aroma / taste of the option |
| Audit "Chemistry data partially unavailable" message | Investigate FlavorDB API status path; check if chem-bridge scores fall back is shrinking the Guided Discovery candidate pool. Possibly stale message — current pipeline uses ProData not FlavorDB. |
| Guided Discovery results sizing | Reference image `guidedOutcome.png` (re-attach needed). Increase node + text size; show ingredient name only (not full sentence) |

### Track 4 — discovery + brainstorm ⏸ PENDING

| Item | Plan |
|---|---|
| Details tab access (hidden behind other features in iOS + web) | Inventory where Details lives, what occludes it, propose 1-2 access patterns |
| "How this works" content audit | Read current copy, propose updates: new pipeline (ProData), new GNN v3, recipe lab radar, affinity triangles |
| Aroma-sector 25%-shaded pie in network (deferred from Track 2) | 3D plane mesh oriented to camera; projected pie arcs at sector positions |

---

## Files touched in this iteration

### Created
- `src/components/AffinityTriangleOverlay.jsx`
- `src/components/ProfileAxisRadar.jsx`
- `.omc/plans/network-recipe-iter-2026-05-16.md` (this file)

### Modified
- `src/App.jsx` — corner overlay removed, AffinityTriangleOverlay mounted, projection ref + neighbors prop threaded to LivingArchView
- `src/components/LivingArchView.jsx` — per-frame projection RAF, affinity-engage guards on R17 effects, neighbors prop, AffinityMode.currentAffinities consumer
- `src/components/RecipeFlavorWheel.jsx` — rewritten to mount ProfileAxisRadar
- `src/components/SearchBar.jsx` — Enter key stale-closure fix
- `src/components/ShapeLegend.jsx` — desktop rail width + title trim
- `src/three/AffinityMode.js` — public `currentAffinities` getter
- `src/components/WedgeGridFlavorWheel.jsx` — still in IngredientPanel mount; theme="dark" still used (no longer in Recipe Lab or corner overlay)

### Retained (used elsewhere)
- `src/components/WedgeGridFlavorWheel.jsx` — IngredientPanel "Top Pairings" mount (the third surface from the original spec)
- `src/components/AffinityFlavorWheel.jsx` — `@deprecated` kept for one-release rollback

---

## Decision log (since the Briscione plan)

| Date | Decision | Why |
|---|---|---|
| 2026-05-15 | Drop the corner wedge-grid overlay | unreadable at 220px; user x'd it on `revisedAff` image |
| 2026-05-15 | Default-on focal tracking (later: removed entirely for overlay) | too jittery; the overlay was retired anyway |
| 2026-05-16 | Drop the right-triangle axis-aligned wedge | rotation-disconnected from 3D scene (looked like chaos when camera rotated) |
| 2026-05-16 | Slim ray-aligned cones instead | rotation-invariant; legs always point along focal→accent, scales with screen distance |
| 2026-05-16 | Pull accents from `AffinityMode.currentAffinities` not `getNeighbors` | tier info available; all 4 rings (★★★/★★/★/surprising) represented |
| 2026-05-16 | Apex icon mirrors `AFFINITY_SHAPE_LEGEND` | visual continuity with the 3D scene + the desktop affinity legend rail |
| 2026-05-16 | Recipe Lab → single dynamic radar | wedge-grid clustered all accents into one cell when focal had sparse metadata |
| 2026-05-16 | Radar axis = chips at top (taste/aroma/season/cuisine/method) | user said "more like the taste radar but axis can switch" — directly maps |

---

## Follow-up backlog (carried forward)

- **F1**: Delete `AffinityFlavorWheel.jsx` after one-release soak (from original Briscione plan)
- **F2**: Phase 4b focal-screen-tracking — retired (no overlay to anchor)
- **F3**: Animation polish for cell transitions (spec §Non-Goals — deferred)
- **F4**: Briscione complementary-pairings outer ring (spec §Non-Goals — deferred)
- **F5**: 3D aroma-sector 25%-shaded pie behind network (this iteration §Track 4)
- **F6**: Walkthrough copy to document Alt/Meta-click filter shortcut (from original Briscione plan)
- **F7**: Filter pills should also restrict the affinity wedge set (user's "filter the selected affinity ingredients based on the filter pills" — Track 2 follow-up not yet shipped)
