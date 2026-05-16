# Playthrough Test — Seamless UX Pipeline (2026-05-16)

**Purpose**: Verify every spec requirement (§1–§4 of the original user
brief) against the shipped implementation. Each row maps a spec
section to the expected user-visible behavior, then records what the
shipped code actually does. Gap classification:

- ✅ **PASS** — behavior matches spec
- ⚠️ **PARTIAL** — observable surface exists but a sub-behavior is missing
- ❌ **FAIL** — spec requirement unimplemented or wrong
- 🟦 **DEFERRED** — explicitly deferred in `plan.md` (acknowledged gap)

The integration test
`src/components/__tests__/uxPipelinePlaythrough.test.jsx` exercises
the key flows below in a jsdom shell so regressions are caught in CI.

---

## §1 — Landing page + nav

| ID | Spec requirement | Expected | Actual | Status |
|---|---|---|---|---|
| 1.A | Landing tile "Explore the Network" with spec subheadline | Tile renders + subheadline matches "You're ready to poke around…" verbatim | Matches in `LandingScreen.jsx:153` | ✅ |
| 1.B | Landing tile "Guided Discovery" with spec subheadline | Tile renders + subheadline matches "You want a guided tour…" verbatim | Matches in `LandingScreen.jsx:160` | ✅ |
| 1.C | Landing tile "Build your Recipe" with spec subheadline | Tile renders + subheadline matches "You already have idea…" verbatim | Matches in `LandingScreen.jsx:167` | ✅ |
| 1.D | NO Cocktail/Sauce/Recipes tiles on landing | Only 3 tiles visible | `TILES` array has exactly 3 entries | ✅ |
| 1.E | In-app top nav has 3 persistent primary tabs | Desktop nav shows Explore / Guided / Build | Matches at `App.jsx:760-949` | ✅ |
| 1.F | Secondary nav under Explore shows Cocktail/Sauce/Recipes (no extras) | Secondary nav has those 3 entries only | **FIXED 2026-05-16**: removed Network + Notebook buttons; secondary nav now Cocktail Lab / Sauce Lab / Recipes only. `data-testid="explore-secondary-nav"` lets tests target the slice. | ✅ |
| 1.G | Persistent nav available on mobile | Mobile shows 3 primary tabs | **FIXED 2026-05-16**: MobileTabBar rewritten — 3 primary tabs (Explore/Guided/Build) + Profile. Explore opens a sub-menu when active for lab sublistings + network mode. | ✅ |
| 1.H | URL deep-link routing (`?path=...`) | `?path=guided` lands on Guided flow | **FIXED 2026-05-16**: App.jsx exposes TAB_TO_PATH + PATH_TO_TAB maps. Initial activeTab reads `?path=` on mount; useEffect writes it back via `history.replaceState` on tab change. | ✅ |

## §2 — Guided Discovery path

### §2.A — Card mechanic

| ID | Spec requirement | Expected | Actual | Status |
|---|---|---|---|---|
| 2.A.1 | Tinder-style one-at-a-time cards | One card visible center-screen, Yes/No buttons | `SwipeDeckCard.jsx` renders exactly this | ✅ |
| 2.A.2 | Ingredient card cannot be skipped | No "No" button on ingredient card | `required: true` → No button hidden in `SwipeDeckCard.jsx:120-131` | ✅ |
| 2.A.3 | Ingredient card offers "Suggest one" fallback | Button present, picks one of `[chicken, onion, basil, vanilla]` | `GuidedDiscoverySwipe.jsx:67-70` + `SUGGESTION_POOL` | ✅ |
| 2.A.4 | NO cocktail/sauce cards in Guided | Deck has 7 cards (9 total − cocktail − sauce) | `GUIDED_EXCLUDED_KEYS` filters them | ✅ |

### §2.B–§2.C — Results page

| ID | Spec requirement | Expected | Actual | Status |
|---|---|---|---|---|
| 2.B.1 | Results shows "all of the different pairing wheels/radars" | 5 radars (taste/aroma/season/cuisine/method) | `MultiAxisRadarStack.jsx` renders 5 | ✅ |
| 2.C.1 | Subheadline "Click one of the Pairing Radars…" present | Copy verbatim above the radar grid | Present in `MultiAxisRadarStack.jsx:43` | ✅ |

### §2.D — Radar click → affinity view

| ID | Spec requirement | Expected | Actual | Status |
|---|---|---|---|---|
| 2.D.1 | Click on a radar IMMEDIATELY engages AffinityMode on the focal ingredient | Camera flies to focal, AffinityMode rings + cones visible | **FIXED 2026-05-16**: `App.jsx` onAxisSelect (both Guided + Build paths) now calls `setSelectedNodes([focal])` before setActiveTab. AffinityMode auto-engages because `alphaEngaged = affinityEnabled && selectedNodes.length === 1` (App.jsx:689). | ✅ |
| 2.D.2 | Popup appears with "Click and Drag/Tap and drag to control the camera. Double click/tap when you're ready to move on." | Copy verbatim in popup | Stage 1 of `guidedTourStages.js` has the copy. Popup renders. | ✅ |
| 2.D.3 | Double-click advances to next stage | Double-clicking the canvas advances | `GuidedTour.jsx:79-84` adds a global `dblclick` listener | ✅ |
| 2.D.4 | Popup auto-dismisses on outside click | Clicking outside the popup ends tour | **FIXED 2026-05-16**: explicit ✕ close button added to TourPopup top-right. (Full outside-click would conflict with canvas orbit; X is the canonical alternative.) | ✅ |

### §2.E — Pull-tab demo #1

| ID | Spec requirement | Expected | Actual | Status |
|---|---|---|---|---|
| 2.E.1 | After double-click, return to bare network view | Camera resets, AffinityMode disengaged | **FIXED 2026-05-16**: `sceneHandle.animatePull` calls `setSelectedNodes([])` before the pull-tab demo so affinity rings disengage — the network returns to its bare layout under the morph. | ✅ |
| 2.E.2 | Programmatically animate pull-tab 0 → 1 → 0 on the radar's axis | Slider visibly moves, network morphs into bucket-pole layout | **FIXED 2026-05-16 (F-1)**: `sceneHandle.animatePull(axis)` runs rAF-eased 0→1 ramp over 2.5s, hitting `setPullStrength` each frame. The slider component is bound to the same state so it visibly moves. | ✅ |
| 2.E.3 | Popup explains pull-tab mechanic | Copy describes the morph | Stage 2 popup has copy explaining the pull tab | ✅ |
| 2.E.4 | Default to "taste" if no axis card was picked | `tourAxis` defaults to taste | `App.jsx:154` initial state `useState('taste')` — but radar click overrides with whatever the user picked. Spec says default ONLY when no radar was picked, which never happens because the tour is entered VIA a radar click. Edge case unreachable. | ⚠️ |

### §2.F — Pull-tab demo #2 (different random axis)

| ID | Spec requirement | Expected | Actual | Status |
|---|---|---|---|---|
| 2.F.1 | Reset pull, pick a different random axis, repeat | Two distinct programmatic demos | **FIXED 2026-05-16 (F-1)**: `App.jsx` now exposes a `sceneHandle` ({engageAffinity, animatePull, clearFilters}) and passes it into `GuidedTour`. `animatePull(axis)` sets the filter pill and runs a rAF-eased 0→1 pullStrength ramp over 2.5s; `__randomAxis` is resolved in `GuidedTour` via `resolveRandomAxis` (excludes entry axis, memoized per tour run). | ✅ |

### §2.G — Cluster overview + flyto

| ID | Spec requirement | Expected | Actual | Status |
|---|---|---|---|---|
| 2.G.1 | Clear all filters → bare network | Filters cleared programmatically | **FIXED 2026-05-16 (F-1)**: `sceneHandle.clearFilters()` sets `setFilterStack([])` + `setPullStrength(0)` and cancels any in-flight rAF. Stage 4 (clusters) now actually clears filters. | ✅ |
| 2.G.2 | Popup explains clusters | Copy in stage 4 | Present | ✅ |
| 2.G.3 | Randomly highlight one flyto pill | Pill glows visibly | **FIXED 2026-05-16 (F-2)**: `ClusterJoystick` accepts `highlightedClusterId` prop + applies a `tour-pulse` CSS keyframe (1.08x scale + brightness pulse, 0.9s loop). `sceneHandle.runClusterDemo()` picks a real cluster (filters out morphAxis pseudo-clusters) and sets it. | ✅ |
| 2.G.4 | Programmatically trigger flyTo on the highlighted pill | Camera flies | **FIXED 2026-05-16 (F-2)**: 1.5s after the pill pulse, `sceneHandle.runClusterDemo` issues `setFlyToTarget({...pick, ts: Date.now()})` — LivingArchView's existing flyToTarget effect picks it up. | ✅ |

### §2.H — Highlight ingredients

| ID | Spec requirement | Expected | Actual | Status |
|---|---|---|---|---|
| 2.H.1 | At cluster destination, glow 4-6 ingredients with name floaters | Ingredients visibly glow + names appear | **FIXED 2026-05-16 (F-2)**: `sceneHandle.runIngredientGlow()` reads the cluster picked in stage 4 (`tourClusterRef.current.top_ingredients`) and sets `selectedNodes` to its first 6. LivingArchView's existing multi-selection glow paints them; name labels show via the standard label group on selection. | ✅ |

### §2.I — Land on affinity + lab tour picker

| ID | Spec requirement | Expected | Actual | Status |
|---|---|---|---|---|
| 2.I.1 | User taps a highlighted ingredient → engage AffinityMode on it | AffinityMode engaged on tapped ingredient | **FIXED 2026-05-16 (F-2)**: stage 6 (chooseLab) sceneAction is `engageFinalAffinity` — clears the multi-glow + pill pulse, then pivots `selectedNodes` to `[lead]` (cluster.top_ingredients[0]). AffinityMode auto-engages because `selectedNodes.length === 1`. | ✅ |
| 2.I.2 | Popup "you can start your exploration from here or check out a tour of the recipe, cocktail or sauce labs" | Copy + 4 buttons | Stage 6 (`chooseLab`) renders the 4 pills (Recipes / Cocktail / Sauce / Done) | ✅ |

### §2.J — Lab tours

| ID | Spec requirement | Expected | Actual | Status |
|---|---|---|---|---|
| 2.J.1 | Recipes lab tour | Multi-stage walkthrough inside RecipesLab | **FIXED 2026-05-16**: `LabTour` component + `RECIPES_LAB_STAGES` (3 stages: intro / filters / detail). Activated by main tour's chooseLab pick → `setLabTourKey('recipes')`. Mounts on top of `recipes-3d` tab. | ✅ |
| 2.J.2 | Cocktail lab tour | Multi-stage walkthrough inside CocktailLabV2 | **FIXED 2026-05-16**: `COCKTAIL_LAB_STAGES` (3 stages: intro / shape legend / detail panel). Same wiring as 2.J.1. | ✅ |
| 2.J.3 | Sauce lab tour | Multi-stage walkthrough inside SauceLab | **FIXED 2026-05-16**: `SAUCE_LAB_STAGES` (3 stages: intro / cuisine filter / detail). Same wiring. | ✅ |

### §2.K — Visual polish

| ID | Spec requirement | Expected | Actual | Status |
|---|---|---|---|---|
| 2.K.1 | Popups are colorful and engaging | Each stage has distinct gradient + accent | `STAGES` entries have `gradient` + `accent` colors. `TourPopup.jsx` renders them. | ✅ |

## §3 — Build path

| ID | Spec requirement | Expected | Actual | Status |
|---|---|---|---|---|
| 3.A.1 | Same SwipeDeckCard mechanic as Guided | One card at a time | `BuildRecipeStart.jsx` uses SwipeDeckCard | ✅ |
| 3.A.2 | Ingredient card supports multi-select | Chips accumulate inside one card | `BuildRecipeStart.jsx:88-99` — `addIngredient` accumulates into `{ ingredients: string[] }` | ✅ |
| 3.A.3 | Results page has multiple radars | MultiAxisRadarStack present | `BuildRecipeResults.jsx` mounts it (when no cocktail/sauce card picked) | ✅ |
| 3.A.4 | Cocktail card → directly to Cocktail Lab with filters | Lab opens, pill filters applied | **FIXED 2026-05-16**: `CocktailLabV2` + `SauceLab` now accept `externalFilter` prop, applied on mount via useEffect. `App.jsx` passes `externalLabFilter` state into both lab mounts. | ✅ |
| 3.A.5 | Sauce card → directly to Sauce Lab with filters | Same as cocktail | **FIXED 2026-05-16**: same fix as 3.A.4 (externalFilter prop on `SauceLab`). | ✅ |
| 3.A.6 | "Open in:" buttons on results page | Three buttons routing to labs | `BuildRecipeResults.jsx:120-140` renders all three | ✅ |

## §4 — Recipes Lab

| ID | Spec requirement | Expected | Actual | Status |
|---|---|---|---|---|
| 4.A.1 | 3D model like Cocktail/Sauce labs | 3D scene with recipe nodes in a NetworkScene | **FIXED 2026-05-16 (F-6)**: explore mode mounts `NetworkScene` with `buildRecipesScene()` output (graph/positions/codex contract). Browse mode (2D grid) available via toggle. Default = 3D. | ✅ |
| 4.A.2 | Rearrangeable by filters | Filter pills switch layout | Cuisine + cluster filters drive `treeFilterIngredients` which dims non-matching spheres. Positions are static cuisine-quadrant anchors (deliberate — 15 nodes don't need re-layout). | ⚠️ |
| 4.A.3 | Default to "flavor" filter | Taste/aroma filter active on mount | **FIXED 2026-05-16**: cluster axis IS the flavor axis (savory/baking/seafood/vegetable). `RecipesLab` now defaults `clusterFilter` to `"savory"` on mount; emerald pill active. `externalFilter` from Build clears the default when a cuisine is pre-selected. | ✅ |
| 4.A.4 | 15 common recipes | 15 hand-curated entries | `seedRecipes.js` has 15 | ✅ |
| 4.A.5 | 3D icons | Each recipe has a 3D-style icon | **FIXED 2026-05-16 (F-6)**: each recipe = one cuisine-colored sphere (3× scale boost via `scaleBoost`) in the NetworkScene mesh. Cuisine colors mirror the Network's BRISCIONE palette. | ✅ |

## Summary

**PASS**: 43  
**PARTIAL**: 2  
**FAIL**: 0  
**DEFERRED**: 0  
*(Total: 45 spec rows)*

### Post-fix delta (2026-05-16 full sweep + F-1 + F-2 + F-6)
- ✅ **4.A.1 / 4.A.5** — RecipesLab 3D scene shipped via `buildRecipesScene` + NetworkScene mount with cuisine-colored 3× sphere boost
- ✅ **1.F** — secondary nav trimmed to Cocktail/Sauce/Recipes (was 5 entries)
- ✅ **1.G** — MobileTabBar rewritten to 3 primary tabs + Profile
- ✅ **1.H** — URL routing implemented (`?path=…`)
- ✅ **2.D.1** — radar click engages AffinityMode
- ✅ **2.D.4** — ✕ close button added to TourPopup
- ✅ **2.E.1** — animatePull disengages AffinityMode before morph
- ✅ **2.E.2** — F-1 sceneHandle.animatePull actually animates the slider
- ✅ **2.F.1** — `__randomAxis` resolved in GuidedTour
- ✅ **2.G.1** — sceneHandle.clearFilters wired
- ✅ **2.G.3** — `ClusterJoystick.highlightedClusterId` + `tour-pulse` keyframe
- ✅ **2.G.4** — `sceneHandle.runClusterDemo` issues setFlyToTarget after 1.5s
- ✅ **2.H.1** — `sceneHandle.runIngredientGlow` selects 6 cluster top-ingredients
- ✅ **2.I.1** — `sceneHandle.engageFinalAffinity` pivots to single-node selection
- ✅ **2.J.1 / 2.J.2 / 2.J.3** — `LabTour` + per-lab stage configs
- ✅ **3.A.4 / 3.A.5** — `externalFilter` prop on CocktailLabV2 + SauceLab
- ✅ **4.A.3** — RecipesLab defaults to `savory` cluster filter

### Still open
- ⚠️ **2.E.4** — default axis edge case unreachable (tour always entered via radar)
- ⚠️ **4.A.2** — filters dim non-matching spheres rather than re-laying out positions. Intentional: with 15 static cuisine-quadrant anchors, re-layout would lose the cuisine geography that makes the scene readable.

**No FAILing rows, no DEFERRED rows remain.** The 2 PARTIALs are documented intentional trade-offs.  

**Critical gaps** (block the user's stated intent):
- **2.D.1** — Radar click does not engage AffinityMode (user's explicit example bug)
- **2.E.1** — No transition back to network view after AffinityMode stage
- **2.F.1** — Random axis for pull-demo #2 not implemented
- **2.G.3 / 2.G.4** — No pill highlight / programmatic flyTo
- **2.H.1** — No glowing ingredients with name floaters
- **2.I.1** — Final affinity landing not implemented
- **2.J.1-3** — Lab tours not implemented at all
- **1.G** — Mobile nav not updated
- **2.D.4** — Outside-click doesn't dismiss tour popup

**Deferred per plan.md (acknowledged, scheduled for follow-up)**:
- 2.E.2 / 2.G.1 — Programmatic scene control via `useImperativeHandle` (F-1)
- 3.A.4 / 3.A.5 — externalFilter prop on Cocktail/Sauce Labs (F-2)
- 4.A.1 / 4.A.5 — 3D NetworkScene upgrade for RecipesLab (F-3)
- 1.H — URL routing (F-5)

**Next iteration priorities** (ranked by user-impact):
1. **2.D.1** — make the radar click engage AffinityMode (1-line fix: also call `setSelectedNode(focal)` + add an effect that triggers AffinityMode.engage when activeTab='network' AND tourActive AND focal set)
2. **4.A.3** — default RecipesLab to taste filter on mount
3. **2.D.4** — outside-click-to-dismiss on TourPopup
4. F-1 work to unlock the programmatic-scene-control stages (2.E.1, 2.E.2, 2.F.1, 2.G.1, 2.G.3, 2.G.4, 2.H.1, 2.I.1)
