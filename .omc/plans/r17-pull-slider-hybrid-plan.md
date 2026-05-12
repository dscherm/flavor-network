# R17 — Plan (executed)

**Spec:** `.omc/specs/r17-pull-slider-hybrid.md`
**Mode:** Ralph PRD-driven (`.omc/state/sessions/<sid>/prd.json`, 6 user stories)

## Approach

A → D as one bundled implementation. The math was cheap once the bucket-pole arrays existed, so per-phase commits would have churned files repeatedly. Shipping as a single coherent change is lower-risk and easier to revert.

## US execution log

| ID | Story | Status | Notes |
|---|---|---|---|
| US-01 | Bucket-pole position arrays (3D Fibonacci + 2D ring) | ✅ | `src/data/bucketPoles.js`. 6 unit tests pass. |
| US-02 | Pull slider UI + global `pullStrength` state | ✅ | `FilterPullSlider.jsx` + `handlePullChange` in App.jsx with `performance.mark`. |
| US-03 | Renderer continuous lerp; remove `effectiveLegacyMode` | ✅ | LivingArchView visibility-predicate effect doubles as position-lerp; mode prop in App.jsx now maps directly to `'ml'`/`'ml2d'`. |
| US-04 | Multi-filter mean-of-poles composition | ✅ | Same effect; scope filters excluded via `FILTER_TO_AXIS[f]` null guard. 5 vitest pass. |
| US-05 | A11y + snap + E2E + perf | ✅ | Slider has `role="slider"`, `aria-valuenow`, keyboard nav. `verify-r17-pull-slider.mjs` covers 8 acceptance checks; all R16 verify scripts still pass. |
| US-06 | Spec + plan + commit | ✅ | This doc + spec. Commits land below. |

## Risk vs. plan

- **3D color/edge/label treatment** — original plan didn't account for the renderer's color/edge/label logic being gated on legacy mode keys (`aromas2d`, etc.). With R17 always sending `'ml'`/`'ml2d'` as the mode, that machinery never fires for active filters. Mitigated with a new visual-state useEffect in LivingArchView that re-applies bucket colors + hides edges/cluster-labels whenever `filterStack.length > 0`. Added during US-03.
- **Default pull 70%** ships as is. Could feel too aggressive on first load with a filter; easy to tune by changing one literal.
- **Phyllotaxis re-spread inside bucket at pull=100** is the only obvious follow-up. Members of the same bucket collapse to a single pole at full snap. Pull <100% looks great because cooccurrence base anchors them apart.

## Commit shape

One R17 commit on top of `b7b81cd` (last R16). No rebase, no force-push.
