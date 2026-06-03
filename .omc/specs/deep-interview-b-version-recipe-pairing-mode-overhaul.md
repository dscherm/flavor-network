# Deep Interview Spec: B-Version Recipe + Pairing Mode Overhaul

## Metadata
- Interview ID: `b-version-recipe-pairing-mode-overhaul-2026-06-02`
- Rounds: 10 (+ Round 0 topology gate)
- Final Ambiguity Score: 18.3% (worst-case across components) / 14.6% (mean) — under 20% threshold
- Type: **brownfield**
- Generated: 2026-06-02
- Threshold: 0.20
- Mode: **interactive bridge design / "B version" — DO NOT commit until explicitly approved**
- Status: **PENDING APPROVAL (design — no execution)**

## Clarity Breakdown (per component)
| Component | Goal | Constr | Crit | Ctx | Brownfield Ambiguity |
|---|---|---|---|---|---|
| REVERT-GUIDED-ALPHA | 0.92 | 0.70 | 0.85 | 0.95 | 0.148 |
| INGREDIENT-PICKER | 0.90 | 0.80 | 0.85 | 0.90 | 0.138 |
| RECIPE-NOTEBOOK-CHROME | 0.90 | 0.80 | 0.70 | 0.85 | 0.183 |
| PAIRING-MODE-TINDER | 0.92 | 0.88 | 0.85 | 0.85 | 0.118 |
| MAKE-RECIPE-CARDS | 0.92 | 0.80 | 0.85 | 0.85 | 0.138 |
| LANDING-CHALKBOARD | 0.92 | 0.80 | 0.80 | 0.85 | 0.150 |

## Topology (Round 0 — confirmed all 6 active)

| # | Component | Status | Description |
|---|---|---|---|
| 1 | REVERT-GUIDED-ALPHA | active | Un-embed α-mode panel from GuidedDiscoveryResults Step 3; restore prior radar + filter-pills + StoryPanel composition. Pre-work before the new picker can land. |
| 2 | INGREDIENT-PICKER | active | Shared "top-half radar + filtered ingredient list" component with TWO modes: (a) full picker for Recipe Notebook + MAKE-RECIPE Add/Replace (with dish-type filter + add), (b) read-only picker for Guided Discovery Step 1 (no dish-type, no add, tap-row hands off to PAIRING-MODE-TINDER). |
| 3 | RECIPE-NOTEBOOK-CHROME | active | Replace persistent taste-radar with "Recipe Name" title + dish-type joystick pills + Add/Replace launcher. KEEP suggestion drawer + NotebookCanvas. |
| 4 | PAIRING-MODE-TINDER | active | Replace double-click-to-α with single-tap → Tinder-stack swipe browser. 4 swipes: L=next pairing, R=rotate highlighted spoke within current radar, U/D=cycle radar filter. Back-button exits. α-mode REMOVED from Network mode entirely. |
| 5 | MAKE-RECIPE-CARDS | active | New "Make a Recipe" parent top-level surface (cards-grid for ingredients, cluster-color-coded). Houses Cocktail/Sauce labs as dish-type mode-variants inside its body. Menu: save-to-notebook + tour-recipe-in-network (cluster fly-by). |
| 6 | LANDING-CHALKBOARD | active | Landing card order: Guided → Make-Recipe (pot-with-glowing-balls icon) → Network. Berserkr-style charcoal/ink chrome background applied to all non-notebook chrome; 3D scenes keep #0a0a0f for bloom contrast. |

---

## Goal

Restructure the app around three top-level destinations (Guided Discovery, Make a Recipe, Explore the Network) and introduce two cross-cutting interaction patterns:

1. **A shared ingredient-picker** (top-half radar + filtered list) used both for recipe authoring (Add/Replace flow) and for guided exploration (Step 1's lean-discovery tool).
2. **A Tinder-style Pairing Mode** that replaces double-click-to-α as the way users inspect an ingredient's pairings from the Network. Single-tap a node → swipe-stack browser; back-button to exit. α-mode survives only as Guided Discovery's Step 2 tour view.

The Recipe Notebook keeps its handwritten palette but sheds its persistent taste-radar in favor of a top "ingredient choices" chrome (Recipe Name title + dish-type joystick + Add/Replace launcher). Make-a-Recipe is the new parent surface for all recipe types; Cocktail Lab and Sauce Lab live inside it as dish-type variants. Chrome across non-notebook surfaces gets a hand-drawn charcoal aesthetic (Berserkr-style hero), while 3D scenes preserve their deep-dark base.

This is the **B version** — design now via interactive bridge mode; NO commits until explicitly approved.

---

## Defined Variables / Patterns

### Shared INGREDIENT-PICKER (component #2)

```
Two modes, single component:
  - mode='notebook'  → dish-type filter (Layer 1) + Add/Replace button + ingredient row tap = SELECT (passes back to caller via onSelect)
  - mode='guided'    → no dish-type filter, no add button, ingredient row tap = enters PAIRING-MODE-TINDER for that ingredient

Common UI:
  - Pill row above radar: TASTE / AROMA / SEASON / CUISINE / FAMILY  (selects OUTER filter category)
  - Profile radar:
      - Inner spokes = axes of current filter (Sweet/Sour/... for TASTE; Citrus/Floral/... for AROMA; etc.)
      - User ROTATES the radar; shaded sector points to one inner spoke = "lean X"
      - The lean selection drives the ingredient list below
  - Ingredient list: filtered to ingredients "leaning" the selected inner axis
      - Layer 1 (notebook mode only): pre-filtered by dish-type from joystick
      - Layer 2 (always): post-filtered by current lean axis

mirrors PAIRING-MODE-TINDER's swipe-right (rotate spoke within current radar)
```

### RECIPE-NOTEBOOK-CHROME (component #3)

```
Three zones (zone 1 replaced, zones 2+3 preserved):
  Zone 1 (NEW): Top chrome "ingredient choices" bar
    - Recipe Name title (tappable to rename — content-editable)
    - Dish-type joystick: pill row with arrows
        [main dish] [side] [appetizer] [dessert] [cocktail] [sauce] [other]
    - "Add" / "Replace" button → opens INGREDIENT-PICKER in mode='notebook'
  Zone 2 (kept): NotebookCanvas — handwritten 2D canvas (palette unchanged)
  Zone 3 (kept): RecipePanel suggestion drawer (palette unchanged)

Dish-type selection drives Layer 1 of the picker's ingredient filtering.
Palette stays identical to current notebook (handwriting + paper texture).
```

### PAIRING-MODE-TINDER (component #4)

```
Entry: single-tap on a node in Network mode  → opens Pairing Mode focused on that node
       OR tap on row in Guided Discovery Step 1 picker → opens Pairing Mode for that ingredient

Card stack (Tinder-style):
  - Full-screen card with visible stack of 2-3 cards behind
  - Card content (top→bottom):
      * Ingredient image / avatar
      * Ingredient name
      * Properties (cuisines, weight, season, pairingCount — like IngredientPanel)
      * Flavor graph chip strip (tier1/tier2/tier3 from flavor_graph_data_v3.json)
      * Profile radar with HIGHLIGHTED dot at the spot the ingredient maps to on the active radar
  - Back button top-left (exits Pairing Mode → returns to Network with focal preserved)

Swipe semantics:
  - swipe LEFT  = peel top card → reveal next pairing
  - swipe RIGHT = rotate highlighted spoke within current radar
                  (e.g. Taste: Sweet → Sour → Bitter → ...)
                  triggers stack rebuild (radar-filter-aware ordering)
  - swipe UP / DOWN = cycle radar filter
                  Taste → Aroma → Family → Cuisine → Season → Taste...
                  triggers stack rebuild

Next-card ordering (radar-filter-aware):
  - Stack contains focal's pairings sorted by pairing-strength descending,
    FILTERED to pairings whose target ingredient matches the active radar's
    current inner axis (the rotated spoke).
  - Switching filter (U/D) or rotating spoke (R) rebuilds the stack.

α-mode: REMOVED from Network mode entirely. Only reachable as Guided Discovery Step 2.
```

### MAKE-RECIPE-CARDS (component #5)

```
New top-level surface "Make a Recipe" (3rd landing card).

Body renders based on dish-type joystick:
  - dish-type ∈ {main, side, appetizer, dessert, other}  → renders MAKE-RECIPE-CARDS grid
  - dish-type = 'cocktail'                                → renders existing CocktailLab inside body
  - dish-type = 'sauce'                                   → renders existing SauceLab inside body

MAKE-RECIPE-CARDS grid view:
  - Cards arranged in rows × cols (responsive: 3 cols mobile, 4-5 cols desktop)
  - Each card = one ingredient, color-coded by cluster_id from cluster_labels_v3.json
  - Card content: ingredient image/avatar + name + brief properties
  - Tap card → PAIRING-MODE-TINDER for that ingredient
  - Top chrome: Recipe Name + dish-type joystick + Add (opens INGREDIENT-PICKER mode='notebook')

Menu (header overflow):
  - "Add to Recipe Notebook"  → transitions user to RECIPE-NOTEBOOK with this recipe's
                                ingredients + name + dish-type pre-populated
  - "Examine in Network"       → spawns CLUSTER-FLY-BY tour (see below)

Cluster fly-by tour:
  - Group this recipe's ingredients by cluster_id
  - For each cluster region:
      * Camera flies to cluster centroid_3d (from cluster_labels_v3.json)
      * 2-second hold; annotation panel shows cluster name + which of YOUR
        recipe's ingredients live there + the cluster's signature flavor
  - After all clusters visited: camera pulls back to wide shot
  - Bridge edges between recipe ingredients (across clusters) glow brightly
  - Annotation panel reads: "Your recipe spans {N} flavor neighborhoods.
    Anchored by {strongest pair}."
  - User can tap any node to enter PAIRING-MODE-TINDER from the tour
  - Reuses existing ClusterFocusMode + camera-fly scaffolding
```

### LANDING-CHALKBOARD (component #6)

```
Landing screen card order:
  1. Guided Discovery
  2. Make a Recipe    (icon: pot with glowing balls — restore prior asset)
  3. Explore the Network

Background aesthetic (Berserkr-style charcoal/ink hand-drawn):
  - Applied to ALL non-notebook chrome:
      * LandingScreen
      * Guided Discovery (all 3 screens, including read-only INGREDIENT-PICKER on Step 1)
      * MAKE-RECIPE-CARDS chrome
      * PAIRING-MODE-TINDER card backdrop
      * Network mode CHROME ONLY (Controls, FilterPillRow, IngredientPanel surfaces)
      * Cocktail/Sauce Lab CHROME (when invoked as dish-type variants)
  - 3D scene bodies preserve #0a0a0f for bloom contrast — DO NOT replace
  - Recipe Notebook palette UNCHANGED (handwriting/paper aesthetic stays)
  - Neon node colors + chalk-style fonts remain on top of charcoal
```

---

## Constraints

### Mode-aware INGREDIENT-PICKER (component #2)
- Single component, two modes via prop (`mode: 'notebook' | 'guided'`).
- `mode='notebook'`: dish-type joystick filter present (Layer 1), Add/Replace button present, row-tap = select-back-to-caller via `onSelect(ingredient)`.
- `mode='guided'`: dish-type joystick HIDDEN, Add button HIDDEN, row-tap = navigate to PAIRING-MODE-TINDER for that ingredient.
- Pill row (TASTE/AROMA/SEASON/CUISINE/FAMILY) selects outer category in both modes.
- Radar rotation selects inner axis ("lean X"). Rotation is the same mechanic as PAIRING-MODE swipe-right.
- Ingredient list below filters: notebook=dish-type∩lean, guided=lean.
- Reuses existing GuidedProfileRadar visuals + GuidedResultsFilterPills patterns; do NOT create wholly new radar implementations.

### Recipe Notebook chrome (component #3)
- 3-zone layout preserved: chrome / NotebookCanvas / suggestion drawer.
- Old taste-wheel zone (zone 1 was taste-wheel) is replaced by the new chrome. NotebookCanvas (zone 2) and RecipePanel suggestion drawer (zone 3) UNTOUCHED visually.
- Dish-type joystick has 7 options: main, side, appetizer, dessert, cocktail, sauce, other.
- Recipe Name is content-editable; defaults to "Untitled recipe" for new recipes.
- Palette stays identical to current notebook (paper + handwriting fonts) — chalkboard chrome does NOT apply to Notebook.

### Pairing Mode (component #4)
- Card stack visible (2-3 cards behind top), full-screen.
- Swipe-left = next pairing in stack.
- Swipe-right = rotate active spoke within current radar; triggers stack rebuild.
- Swipe-up/down = cycle radar filter (5 categories); triggers stack rebuild.
- Back button (top-left) = exit → return to Network mode with focal preserved.
- Stack contents = focal's pairings, sorted by strength desc, filtered by current radar's active inner axis.
- α-mode REMOVED from Network mode — single-tap-to-PAIRING-MODE is the ONLY detail path from Network.
- α-mode (AffinityMode.js, GuidedAlphaPanel.jsx, supporting state in App.jsx + LivingArchView.jsx) PRESERVED but only invoked from Guided Discovery Step 2 path.
- AffinityTriangleOverlay multi-focal cones STAY (used by Guided Step 2).

### Make-a-Recipe (component #5)
- New top-level surface, parent for all recipe types.
- Body conditional on dish-type joystick:
  - default (main/side/appetizer/dessert/other) → MAKE-RECIPE-CARDS grid
  - cocktail → existing CocktailLab.jsx rendered inside body
  - sauce → existing SauceLab.jsx rendered inside body
- Cards-grid: responsive (3 cols mobile, 4-5 cols desktop), cluster-color-coded.
- Card tap → PAIRING-MODE-TINDER for that ingredient.
- Menu options: "Add to Recipe Notebook" (transitions to Notebook with state), "Examine in Network" (spawns cluster fly-by tour).
- Cluster fly-by tour uses cluster_labels_v3.json `clusters[].centroid_3d` + ClusterFocusMode camera infra.

### Landing + chalkboard (component #6)
- Landing has 3 cards exactly: Guided Discovery, Make a Recipe (pot icon), Explore the Network.
- Charcoal chrome applied to non-notebook chrome only.
- 3D Network scene background MUST stay #0a0a0f (bloom + neon contrast depends on it).
- Recipe Notebook palette UNCHANGED.
- Chrome treatment includes: textured charcoal/ink ground + faint chalk-streak overlay + neon-color text on top.
- Specific surfaces getting chrome treatment: LandingScreen, GuidedDiscoveryStart/Swipe/Results, GuidedAlphaPanel chrome (preserved but only as Step 2), MakeRecipeView chrome, IngredientPicker chrome, PairingModeCard backdrop, Controls/FilterPillRow/IngredientPanel surfaces (Network mode chrome).

### REVERT-GUIDED-ALPHA (component #1)
- Surgical revert of the GuidedAlphaPanel embed inside GuidedDiscoveryResults — restore prior composition: bubble chip strip + chemistry banner + GuidedResultsFilterPills + GuidedProfileRadar + StoryPanel + ProvenancePanel button.
- Keep GuidedAlphaPanel.jsx + all α-mode plumbing in App.jsx + LivingArchView.jsx (since α-mode is reused for Guided Step 2 — just not as the third-screen embed).
- Restore the 7 radar-mechanics tests that were `.skip()`ed in GuidedDiscoveryResults.test.jsx.

### Performance
- PAIRING-MODE card transitions ≤16ms frame budget (60 FPS swipes).
- Cluster fly-by tour ≤ 2s per cluster hold, total tour ≤ 20s for 10-cluster recipes.
- Picker rotation should feel responsive (no >100ms lag from gesture to list re-filter).
- No memory leak from mounting/unmounting Pairing Mode cards repeatedly during long stack browsing.

---

## Non-Goals (out of scope)

- **Replacing α-mode in Guided Discovery Step 2** — α-mode plumbing stays, only its Network-mode entry path is removed.
- **Modifying the ProData pipeline or any data artifacts** — all data comes from existing files (cluster_labels_v3.json, flavor_graph_data_v3.json, pairings.json, gnn_entropy.json, ingredients.json, cocktail_augment.json, sauce_augment.json).
- **Rewriting CocktailLab.jsx or SauceLab.jsx internals** — they're rendered as-is inside MAKE-RECIPE body.
- **3D Network mode body background changes** — chrome only; #0a0a0f preserved.
- **Recipe Notebook palette changes** — handwriting/paper aesthetic untouched.
- **Re-running v3 morph-targets work or GAT clustering** — these are read-only inputs.
- **Touching iOS / Capacitor wrapping** — pure web changes; iOS picks up via existing `npm run ios:sync`.
- **Add-to-recipe-from-Pairing-Mode** (swipe-up to add) — explicit Add affordance is always via INGREDIENT-PICKER, never via Pairing Mode swipe.
- **Commits** — interactive bridge design mode; no commits until user explicitly approves execution.

---

## Acceptance Criteria

### REVERT-GUIDED-ALPHA (#1)
- [ ] `src/components/GuidedDiscoveryResults.jsx` Step 3 renders prior composition (bubble strip + chemistry banner + filter pills + radar + StoryPanel + ProvenancePanel button) — NO `<GuidedAlphaPanel />`.
- [ ] `src/components/__tests__/GuidedDiscoveryResults.test.jsx` — un-skip the 7 radar-mechanics tests (`.skip()` → enabled).
- [ ] `GuidedAlphaPanel.jsx` retained for Step 2 use; α-mode plumbing in App.jsx + LivingArchView.jsx UNCHANGED.
- [ ] All 1163 unit tests pass (none of the radar tests now broken).

### INGREDIENT-PICKER (#2)
- [ ] `src/components/IngredientPicker.jsx` — new file; supports `mode='notebook' | 'guided'` prop.
- [ ] Pill row, radar (with rotation gesture), and ingredient list all render and respond to gesture.
- [ ] Rotation gesture updates which inner spoke is the active "lean" axis.
- [ ] Ingredient list filters by (Layer 1: dish-type — notebook only) ∩ (Layer 2: lean axis).
- [ ] Row tap behavior: `mode='notebook'` calls `onSelect(ingredient)`; `mode='guided'` triggers nav to PAIRING-MODE.
- [ ] Tests: rotation changes lean, dish-type filters list, mode prop toggles dish-type visibility + tap behavior.

### RECIPE-NOTEBOOK-CHROME (#3)
- [ ] Persistent taste-radar zone is removed from `RecipeLabMobile.jsx`.
- [ ] New top chrome renders: Recipe Name (content-editable), dish-type joystick (7 pills), Add/Replace button.
- [ ] NotebookCanvas (zone 2) + RecipePanel drawer (zone 3) unchanged visually.
- [ ] Add/Replace button opens INGREDIENT-PICKER as a modal sheet with `mode='notebook'` + current dish-type.
- [ ] Notebook palette unchanged (paper + handwriting fonts).
- [ ] Tests: dish-type change re-filters picker's Layer 1; Recipe Name edit persists.

### PAIRING-MODE-TINDER (#4)
- [ ] `src/components/PairingMode.jsx` — new file; Tinder-stack card layout.
- [ ] Network mode single-tap on a node → opens PairingMode for that node (replaces double-click-to-α handler).
- [ ] Card content: image/avatar + name + properties + flavor graph chips + radar with highlighted dot.
- [ ] Swipe-left = next pairing; swipe-right = rotate spoke + rebuild stack; swipe-up/down = cycle filter + rebuild stack.
- [ ] Back button (top-left) exits → returns to Network with focal preserved.
- [ ] Next-card stack = focal's pairings sorted by pairing-strength desc, filtered by active inner axis.
- [ ] α-mode entry from Network is GONE (no more `onDoubleClick` → setAffinityRequested in NetworkScene).
- [ ] α-mode still reachable as Guided Discovery Step 2.
- [ ] Tests: tap-to-open, four swipe directions, back-button exit, focal preservation, stack rebuild on filter change.

### MAKE-RECIPE-CARDS (#5)
- [ ] `src/components/MakeRecipeView.jsx` — new file; parent for cards-grid + Cocktail/Sauce variants.
- [ ] Body conditional on dish-type joystick:
      - cocktail → CocktailLab inside body
      - sauce → SauceLab inside body
      - else → MAKE-RECIPE-CARDS grid
- [ ] Cards-grid: responsive (3 col mobile, 4-5 col desktop), cluster-color-coded from cluster_labels_v3.json.
- [ ] Card tap → PAIRING-MODE-TINDER for that ingredient.
- [ ] Header menu: "Add to Recipe Notebook" (transitions with state) + "Examine in Network" (spawns tour).
- [ ] Cluster fly-by tour visits each unique cluster_id of recipe ingredients, 2s hold each, then wide-shot reveal with bridge edges.
- [ ] Tour reuses ClusterFocusMode + camera-fly scaffolding (no new camera helpers needed).
- [ ] Tests: dish-type swap, card tap nav, menu actions, tour fires cluster fly-by.

### LANDING-CHALKBOARD (#6)
- [ ] LandingScreen card order: Guided Discovery (1), Make a Recipe with pot icon (2), Explore the Network (3).
- [ ] Charcoal chrome CSS class added; applies to all non-notebook chrome listed in constraints.
- [ ] 3D Network scene body background remains `#0a0a0f`.
- [ ] Recipe Notebook palette completely untouched.
- [ ] Visual A/B fixture: 6 screenshot pairs (Landing, Guided×3, MakeRecipe, PairingMode) charcoal-vs-current.
- [ ] Tests: landing card order assertion; chrome class applied to expected surfaces; #0a0a0f preserved in scene canvas.

### Cross-cutting
- [ ] `npm run build` succeeds.
- [ ] All existing tests pass (target: 1170/1170; the 7 currently-skipped radar tests re-enabled = 1170 passing).
- [ ] `__qaPairingMode*`, `__qaIngredientPicker*`, `__qaMakeRecipe*` window-attached harness helpers added under the existing `?af_debug=1` gate.
- [ ] No new dependencies introduced beyond what's already in package.json.
- [ ] **NO COMMITS** during design phase. Working tree changes stay uncommitted until user explicitly approves execution.

---

## Implementation Plan (when approved)

### Phase order (sequential — each blocks the next)

| Phase | Components | Effort | Why this order |
|---|---|---|---|
| **P0** | #1 REVERT-GUIDED-ALPHA | 0.5d | Get back to a clean baseline before adding new features. Surgical revert + re-enable skipped tests. |
| **P1** | #2 INGREDIENT-PICKER | 1.5d | Shared component blocks #3 (Notebook chrome's Add/Replace launcher) + #5 (MakeRecipe Add). Built first so two consumers can wire to a stable API. |
| **P2** | #3 RECIPE-NOTEBOOK-CHROME | 1d | Notebook is well-understood surface. Land chrome change against the new picker. |
| **P3** | #4 PAIRING-MODE-TINDER | 2d | Largest single component. Replaces double-click handler in NetworkScene; needs careful preservation of α-mode for Guided Step 2. |
| **P4** | #5 MAKE-RECIPE-CARDS | 2d | Parent surface; wires PAIRING-MODE (P3) on card tap + INGREDIENT-PICKER (P1) on Add. Cluster fly-by uses existing ClusterFocusMode. |
| **P5** | #6 LANDING-CHALKBOARD | 1d | CSS/asset work; touches many files but each touch is small. Visual A/B at end. |

Total: ~8 days estimated for one focused executor.

### Touched files (planned — NOT YET MODIFIED)

**New files:**
- `src/components/IngredientPicker.jsx`
- `src/components/PairingMode.jsx`
- `src/components/PairingModeCard.jsx`
- `src/components/MakeRecipeView.jsx`
- `src/components/MakeRecipeCardsGrid.jsx`
- `src/components/RecipeNotebookChrome.jsx`
- `src/components/DishTypeJoystick.jsx`
- `src/three/ClusterFlyByTour.js` (recipe-tour orchestrator)
- `src/styles/charcoal-chrome.css` (or Tailwind utility classes)
- `src/components/__tests__/IngredientPicker.test.jsx`
- `src/components/__tests__/PairingMode.test.jsx`
- `src/components/__tests__/MakeRecipeView.test.jsx`
- `src/components/__tests__/RecipeNotebookChrome.test.jsx`
- `scripts/qa-pairing-mode.mjs`
- `scripts/qa-make-recipe.mjs`
- `scripts/qa-landing-chalkboard.mjs`

**Modified files:**
- `src/components/GuidedDiscoveryResults.jsx` — revert α-panel embed
- `src/components/__tests__/GuidedDiscoveryResults.test.jsx` — un-skip 7 tests
- `src/components/RecipeLabMobile.jsx` — remove taste-radar zone; mount RecipeNotebookChrome
- `src/components/NetworkScene.jsx` — single-tap → PairingMode (replaces double-click handler)
- `src/components/LandingScreen.jsx` — card order + icon swap + chalkboard class
- `src/components/LivingArchView.jsx` — remove Network-mode α-mode entry plumbing (preserve Guided-Step-2 path)
- `src/App.jsx` — top-level routing: Make-a-Recipe parent surface; reduce 4 tabs → 3 cards on landing
- `src/components/IngredientPanel.jsx` — chalkboard chrome class
- `src/components/Controls.jsx` — chalkboard chrome class
- `src/components/FilterPillRow.jsx` — chalkboard chrome class

**Untouched (read-only consumers / pipeline outputs):**
- All ProData artifacts: `public/proDataset/*.json`
- `flavor-gnn/**` — entire molecular MPNN + GAT pipeline
- `src/three/AffinityMode.js` — α-mode preserved for Guided Step 2
- `src/components/GuidedAlphaPanel.jsx` — preserved for Step 2
- `src/components/CocktailLab.jsx` + `SauceLab.jsx` — rendered inside MakeRecipeView body unchanged
- `src/components/NotebookCanvas.jsx` + `RecipePanel.jsx` — zones 2+3 of Notebook

---

## Ontology (11 entities, converged)

| Entity | Type | Fields | Relationships |
|---|---|---|---|
| Recipe Notebook | surface | name, dish-type, ingredients[], notebook palette | reached from MakeRecipeView menu; hosts NotebookCanvas + RecipePanel drawer |
| Make-a-Recipe View | surface | recipe state, dish-type, current body variant | parent for cards-grid + Cocktail/Sauce variants; landing card #2 |
| Ingredient Cards Grid | surface | cards[], cluster-color | rendered inside MakeRecipeView when dish-type ∈ {main,side,app,dessert,other} |
| Ingredient Picker | shared component | mode, dish-type filter, lean axis, ingredient list | used by RecipeNotebookChrome + MakeRecipeView Add/Replace AND by GuidedDiscoveryStep1 (read-only) |
| Dish-Type Joystick | UI control | 7 options (main/side/app/dessert/cocktail/sauce/other) | drives Layer 1 picker filter + MakeRecipeView body variant selection |
| Profile Radar | UI primitive | 5 filters (Taste/Aroma/Season/Cuisine/Family), inner axes per filter, rotation gesture | used inside Ingredient Picker AND Pairing Mode card |
| Pairing Mode Card | UI component | image, name, properties, flavor graph chips, radar with highlight dot | item in Pairing Mode Card Stack |
| Pairing Mode Card Stack | interaction | next-card order (radar-filter-aware), 4-swipe semantics, back exit | replaces double-click-to-α; entered from Network single-tap + Guided Step 1 row tap |
| Cluster Fly-By Tour | network mode interaction | recipe ingredients grouped by cluster_id, camera path, annotation panel | reuses ClusterFocusMode + cluster_labels_v3 centroids; spawned by MakeRecipeView menu "Examine in Network" |
| Charcoal Chrome Background | aesthetic layer | textured charcoal ground + chalk-streak overlay | applied to non-notebook chrome only; 3D scene bodies excluded |
| Landing Card Set | navigation surface | 3 cards (Guided, Make-Recipe with pot icon, Network) | entry point; reduces prior 4-tab nav to 3 cards |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability |
|---|---|---|---|---|---|
| 0 (topology) | 6 | 6 | 0 | 0 | N/A |
| 1 | 7 | 1 (Recipe Notebook split from Notebook Chrome) | 1 (MakeRecipe entry-vs-write-up clarified) | 5 | 71% |
| 2 | 8 | 1 (Pairing Mode Card Stack semantics) | 0 | 7 | 88% |
| 3 | 9 | 1 (Profile Radar rotation mechanic) | 1 (Picker rotation = inner axis) | 7 | 78% |
| 4 | 9 | 0 | 1 (α-mode removed from Network) | 8 | 89% |
| 5 | 10 | 1 (Recipe Notebook 3-zone preservation) | 0 | 9 | 90% |
| 6 | 11 | 1 (Cluster Fly-By Tour) | 0 | 10 | 91% |
| 7 | 11 | 0 | 1 (Charcoal Chrome scope = chrome only) | 10 | 91% |
| 8 | 11 | 0 | 1 (Picker mode='guided' → tap = handoff to Pairing Mode) | 10 | 91% |
| 9 | 11 | 0 | 1 (Make-Recipe = parent of Cocktail/Sauce) | 10 | 91% |
| 10 | 11 | 0 | 1 (Pairing Mode = Tinder-stack radar-filter-aware) | 10 | 91% |
| Final | 11 | 0 | 0 | 11 | 100% (converged) |

---

## Assumptions Exposed & Resolved

| Assumption | Round | Resolution |
|---|---|---|
| MAKE-RECIPE and NOTEBOOK might be toggle-views of the same recipe | R1 | False — MAKE-RECIPE is entry, NOTEBOOK is write-up. One-way menu transition. |
| Adding ingredients happens via Pairing Mode swipe-up | R1 | False — picker is the sole add affordance. |
| swipe-right in Pairing Mode might mean "previous pairing" or "confirm" | R2 | False — swipe-right rotates highlighted spoke within current radar. |
| Picker rotation might pick the outer category (replacing pills) | R3 | False — rotation picks INNER axis; pills stay for outer category. |
| α-mode might remain reachable from Network via a secondary affordance | R4 | False — α-mode is GONE from Network entirely. Survives only in Guided Step 2. |
| Notebook might drop the suggestion drawer in the cleanup | R5 | False — drawer stays. Only the taste-radar zone is replaced. |
| Recipe-network tour might be sequential ingredient pulse OR strongest-edge traversal | R6 | False — cluster fly-by then full reveal chosen. |
| Chalkboard might mean literal slate-green texture | R7 | False — Berserkr-style charcoal/ink, hand-drawn aesthetic. |
| Chalkboard might replace 3D scene background too | R7 | False — chrome only; 3D scenes stay #0a0a0f for bloom. |
| Guided Step 1 picker row tap might be no-op or details-sheet | R8 | False — tap hands off to Pairing Mode for that ingredient. |
| MAKE-RECIPE might replace only RecipeLab; Cocktail/Sauce stay separate top-tabs | R9 | False — Make-a-Recipe is parent; Cocktail/Sauce render as dish-type body variants. |
| Pairing Mode might use single-card replace OR bottom-sheet | R10 | False — full-screen Tinder-stack with radar-filter-aware ordering. |

---

## Technical Context

### Brownfield surfaces touched (only when approved)

- `src/components/` — multiple new files + 6 modified
- `src/three/` — one new file (ClusterFlyByTour orchestrator); existing AffinityMode/ClusterFocusMode preserved
- `src/styles/` — chalkboard chrome treatment
- `src/App.jsx` — top-level nav reshape (4 tabs → 3 cards)

### Brownfield surfaces NOT touched

- `flavor-gnn/**` — entire ML pipeline, including N3-GAT-CLUSTERS work
- `public/proDataset/**` — all ProData artifacts (cluster_labels_v3.json, etc.) read-only
- `src/three/AffinityMode.js` — preserved for Guided Step 2 reuse
- `src/components/GuidedAlphaPanel.jsx` — preserved for Step 2
- `src/components/CocktailLab.jsx` + `SauceLab.jsx` — embedded as dish-type variants unchanged
- `src/components/NotebookCanvas.jsx` + `RecipePanel.jsx` — zones 2+3 of Notebook untouched
- iOS / Capacitor wrapping — pure web change picks up via `npm run ios:sync`

---

## Risks / Notes for Executor

1. **REVERT-GUIDED-ALPHA must preserve GuidedAlphaPanel.jsx + α-mode plumbing.** The component exists at `src/components/GuidedAlphaPanel.jsx` and was integrated into GuidedDiscoveryResults at commits `6c9b7ed` + `521910a`. The revert is SURGICAL — undo the `<GuidedAlphaPanel />` render in GuidedDiscoveryResults Step 3 and restore the prior `<GuidedProfileRadar />` + `<GuidedResultsFilterPills />` composition, BUT keep the file + the App.jsx affinity state machinery + LivingArchView.jsx α-mode driver intact. Step 2 of the guided tour will still mount α-mode (just no longer as Step 3).

2. **Single-tap vs. existing handlers in NetworkScene.** The 3D node click handler currently routes to (a) selection, (b) α-mode enter (on double-click). New design: single-tap → PAIRING-MODE. Two coupling concerns: (i) avoid breaking cluster-pill click handlers (those operate on cluster regions, not nodes), (ii) preserve the empty-tap-double-click clear-selection behavior the user shipped recently. Network selection state should still update on tap so PAIRING-MODE knows the focal.

3. **Pairing Mode card stack rebuild on filter change.** When user swipes right (rotate spoke) or up/down (cycle filter), the next-card stack must rebuild to contain only pairings matching the new active inner axis. Naive implementation would discard cards already shown — preserve "seen" history if you want the back-of-stack scrolling to feel coherent. Simpler: rebuild stack from current position based on focal + new filter; don't try to dedupe against history.

4. **Charcoal aesthetic must not contaminate 3D scenes.** The Three.js renderer clearColor is set to #0a0a0f for bloom contrast. Adding charcoal background to the Network mode CHROME (around the canvas) without leaking into the canvas itself: the canvas element renders its own GL clear; only the wrapping div + adjacent UI elements get the charcoal treatment.

5. **Make-a-Recipe body variant switching must preserve state.** When user toggles dish-type from main → cocktail, the existing recipe state (name, ingredients added so far) should NOT vaporize. Either (a) hold recipe state at the MakeRecipeView level and pass to the body variant, or (b) accept that switching to cocktail re-mounts and is an explicit "switch context" action — but document which.

6. **Cluster fly-by tour reuses ClusterFocusMode camera but for multiple sequential targets.** The existing ClusterFocusMode flies to a single cluster centroid. The recipe tour needs a sequence: cluster 1 → cluster 2 → ... → wide shot. Either compose multiple ClusterFocusMode invocations with a setTimeout chain, or factor out the camera-fly primitive and call it N times. Don't write a brand-new camera helper if the existing one composes.

7. **No commits during design.** Per the user's "B version that doesn't commit": as the executor lands changes, the working tree stays uncommitted until the user explicitly says "commit this." Use interactive bridge mode where each phase is reviewable but not auto-committed.

8. **Image search note.** The user's screenshot file `menu ingredient choices.paint` is actually HEIF-encoded; the sibling `ingredient card.png` shows the picker layout. Use the PNG as the visual reference for INGREDIENT-PICKER layout.

9. **Tests for 7-pill dish-type joystick.** The current 4-item nav (Network/Cocktail/Sauce/Recipe) has tests in `App.handoff.test.jsx`. New 3-card landing + dish-type-driven body variant breaks some of these tests — update the handoff tests to the new model rather than skip them.

10. **Schema preservation for cluster data.** Cluster fly-by tour reads `cluster_labels_v3.json` `clusters[].centroid_3d`. This field is current (per `project_n3_gat_clusters_ship` memory). DO NOT touch the JSON. Just read it.

---

## Pipeline next step

This is a **PENDING APPROVAL** design spec. The user's explicit instruction was:

> "this is a huge overhaul, so use the deep interview mode for clarification" + "In interactive bridge mode, I want to try to design a 'B' version that doesn't commit"

So execution does NOT auto-launch. When you (the user) want to proceed, the options are:

1. **`/oh-my-claudecode:omc-plan --consensus --direct`** — Planner/Architect/Critic consensus before any code lands.
2. **`/oh-my-claudecode:autopilot`** — direct execution (will pause for chef sign-off on chalkboard A/B + landing card order; phases auto-advance with verifier-gated commits, but you said no commits — so use only with explicit "this approval = commit OK").
3. **`/oh-my-claudecode:ralph`** — persistence loop (overkill for an 8-day single-executor scope).
4. **Manual phased execution** — pick one component, implement it on an uncommitted working tree, A/B with the user, then move to the next. Best fit for "B version that doesn't commit."

Given the size (6 components, ~8 days, multi-surface) and the explicit no-commit constraint, **manual phased execution starting with P0 REVERT-GUIDED-ALPHA** is the lowest-risk on-ramp. Each phase can stay uncommitted in the working tree; user reviews via running the dev server; merge to master only when you approve the whole bundle.

When ready, say "start P0" or "approve all + execute autopilot" (etc.) and I'll proceed.
