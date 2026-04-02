# Recipe Mobile Ralph — Plan

Spec: `.claude/specs/recipe-lab-mobile.md`

## Tasks

```json
{
  "id": "TASK-200",
  "title": "Scaffold RecipeLabMobile.jsx + isMobile gate",
  "status": "done",
  "description": "Create RecipeLabMobile.jsx container with 3-zone layout (TasteWheel top, RecipeNotebook middle, SuggestionDrawer bottom). Modify RecipeLab.jsx to render RecipeLabMobile when isMobile=true, passing all existing props (fullData, initialIngredient, isMobile). Desktop path unchanged.",
  "spec_ref": "recipe-lab-mobile.md#three-zone-mobile-layout",
  "tags": ["scaffold", "mobile"]
}
```

```json
{
  "id": "TASK-201",
  "title": "Build TasteWheel.jsx — canvas octagon with axis lines",
  "status": "done",
  "description": "Canvas 2D component: regular octagon outline (wobbly hand-drawn lines), 8 axis lines (dashed, pencil gray #3a3428), axis labels at vertices (Caveat font). Sized to viewport width - 32px, square aspect ratio. Background: #fefae0. No shading yet — just the wireframe structure. Use TASTE_COLORS from src/utils/color.js for label dot colors.",
  "spec_ref": "recipe-lab-mobile.md#zone-1-taste-wheel",
  "tags": ["canvas", "visual"]
}
```

```json
{
  "id": "TASK-202",
  "title": "Pencil-shading renderer for TasteWheel octants",
  "status": "done",
  "description": "Implement the colored-pencil scribble fill algorithm. For each octant: compute fill intensity (0-1), generate N=ceil(intensity*8) overlapping strokes from near-center to near-edge. Stroke color from TASTE_COLORS at 30-60% opacity, width 2-4px with jitter, angle ±15deg random. Memoize stroke geometry — only regenerate on ingredient changes, not every frame. This creates the hand-drawn colored-pencil shading effect that darkens as more of that flavor is represented.",
  "spec_ref": "recipe-lab-mobile.md#pencil-shaded-fill",
  "tags": ["canvas", "visual", "core"]
}
```

```json
{
  "id": "TASK-203",
  "title": "Implement tasteScoring.js — aggregate recipe taste scoring",
  "status": "done",
  "description": "New file src/data/tasteScoring.js. Export aggregateRecipeTastes(ingredients, nodes) — sums scoreIngredient() across all recipe ingredients per axis, returns {totals, normalized, max}. Export findWeakestAxis(normalized) — returns [axisName, value] of least-represented taste. Uses scoreIngredient from tastePositioning.js. No new dependencies.",
  "spec_ref": "recipe-lab-mobile.md#taste-scoring-aggregation",
  "tags": ["data", "core"]
}
```

```json
{
  "id": "TASK-204",
  "title": "Wire TasteWheel to live recipe data + animate",
  "status": "done",
  "depends_on": ["TASK-201", "TASK-202", "TASK-203"],
  "description": "Connect TasteWheel to recipeIngredients state via aggregateRecipeTastes(). On ingredient add/remove, recompute normalized taste scores and re-render octant shading. Add draw-in animation: new pencil strokes animate over ~400ms when an ingredient is added (staggered stroke drawing). Add long-press handler on octants showing tooltip: '{Taste}: {percentage}% — contributed by {ingredients}'.",
  "spec_ref": "recipe-lab-mobile.md#animation",
  "tags": ["integration", "animation"]
}
```

```json
{
  "id": "TASK-205",
  "title": "Build RecipeNotebook.jsx — scrollable ingredient list",
  "status": "done",
  "description": "Notebook-styled scrollable ingredient list. Ruled lines every 28px (#c9b99a), red margin (#e07070). Caveat font. Center ingredient: diamond icon, bold, taste-colored left border. Others: circle icon, match %, taste-colored left border. Each row has recenter and remove buttons. Swipe-left-to-delete (iOS-style). Empty state: 'Start your recipe... Search for an ingredient above to build around' in italic pencil gray. Compatibility score shown when >= 2 ingredients.",
  "spec_ref": "recipe-lab-mobile.md#zone-2-recipe-notebook-page",
  "tags": ["ui", "mobile"]
}
```

```json
{
  "id": "TASK-206",
  "title": "Build SuggestionDrawer.jsx — bottom sheet with 3 snap states",
  "status": "done",
  "description": "Gesture-driven bottom sheet. Three snap points: peek (56px), half (40vh), full (75vh). CSS transform: translateY() for positioning. Touch start/move/end for drag. Spring or ease-out transition for snapping. Drag handle: centered pill 40x4px rounded #c9b99a. Internal overflow-y: auto scroll. Collapsed shows 'Suggestions' label + count badge. Does NOT scroll the page — sheet contains its own scroll context.",
  "spec_ref": "recipe-lab-mobile.md#suggestion-drawer-bottom-sheet",
  "tags": ["ui", "gesture", "mobile"]
}
```

```json
{
  "id": "TASK-207",
  "title": "Taste tab bar in SuggestionDrawer",
  "status": "done",
  "depends_on": ["TASK-206"],
  "description": "Horizontal scrollable row of tabs inside SuggestionDrawer. Tabs: 'All' (default), 'Best' (gap-filling), then 8 taste tabs (sweet, salty, sour, bitter, umami, spicy, pungent, astringent). Each taste tab has colored dot from TASTE_COLORS. Active tab: filled background at 20% opacity of taste color. 'Best' tab filters to ingredients that fill the weakest taste axis (uses findWeakestAxis from tasteScoring.js).",
  "spec_ref": "recipe-lab-mobile.md#taste-tab-bar",
  "tags": ["ui", "mobile"]
}
```

```json
{
  "id": "TASK-208",
  "title": "Ingredient chips grid in SuggestionDrawer",
  "status": "done",
  "depends_on": ["TASK-206", "TASK-207"],
  "description": "2-column scrollable grid of ingredient chips. Each chip: taste-colored left accent, ingredient name (Caveat), match % (strength to center or avg to all recipe ingredients), small taste tags, tap-to-add. Sorted by avg pairing strength to current recipe. Filtered by active taste tab. Already-in-recipe ingredients grayed out at bottom. Chips populated from centerIngredient's neighbors (getNeighbors from graph data).",
  "spec_ref": "recipe-lab-mobile.md#ingredient-chips",
  "tags": ["ui", "data", "mobile"]
}
```

```json
{
  "id": "TASK-209",
  "title": "Give me a suggestion feature",
  "status": "done",
  "depends_on": ["TASK-203", "TASK-208"],
  "description": "Button at bottom of full-expanded drawer, hand-drawn notebook style. On tap: calls analyzeRecipe().suggestions.add, cross-references with findWeakestAxis() to prioritize gap-filling. Shows top suggestion as highlighted chip with explanation: 'Pairs well with N of your ingredients' or 'Your recipe is missing {taste} — try {ingredient}'. User taps to accept (adds to recipe) or dismiss. Requires >= 2 ingredients to activate.",
  "spec_ref": "recipe-lab-mobile.md#give-me-a-suggestion-feature",
  "tags": ["feature", "analysis"]
}
```

```json
{
  "id": "TASK-210",
  "title": "Tap-octant-to-filter interaction",
  "status": "done",
  "depends_on": ["TASK-204", "TASK-207"],
  "description": "When user taps a taste wheel octant, the SuggestionDrawer activates the corresponding taste tab and auto-expands to half state if collapsed. Hit detection: point-in-triangle test for each octant (8 triangles from center to adjacent vertices). Visual feedback: brief flash/pulse on tapped octant.",
  "spec_ref": "recipe-lab-mobile.md#interaction",
  "tags": ["interaction", "integration"]
}
```

```json
{
  "id": "TASK-211",
  "title": "Polish — animations, empty states, mode switching, save/clear",
  "status": "done",
  "depends_on": ["TASK-200", "TASK-204", "TASK-205", "TASK-206", "TASK-209", "TASK-210"],
  "description": "Final integration pass. Verify: search bar works with keyboard (taste wheel compresses). Mode switching (taste/cocktail/sauce tabs) updates wheel labels and drawer sorting. Save button in RecipeNotebook calls userProfile.addRecipe(). Clear resets all state. Empty state transitions are smooth. Test on 375px and 414px viewports. Ensure no regressions on desktop path.",
  "spec_ref": "recipe-lab-mobile.md#flow-step-by-step",
  "tags": ["polish", "integration"]
}
```

```json
{
  "id": "TASK-212",
  "title": "Test infrastructure — tasteScoring.js + aggregation logic",
  "status": "done",
  "depends_on": ["TASK-203"],
  "description": "Add unit tests for tasteScoring.js: aggregateRecipeTastes() returns correct totals/normalized values for known ingredient sets, findWeakestAxis() identifies the correct gap. Test edge cases: empty recipe, single ingredient, all-same-taste ingredients. Use vitest (already in devDeps) or add it. Lesson: ui-projects-need-test-infrastructure — flavor-network has 84% test gap, don't repeat it.",
  "spec_ref": "recipe-lab-mobile.md#taste-scoring-aggregation",
  "tags": ["test", "core"]
}
```

```json
{
  "id": "TASK-213",
  "title": "Test infrastructure — SuggestionDrawer snap states + TasteWheel hit detection",
  "status": "done",
  "depends_on": ["TASK-206", "TASK-210"],
  "description": "Component tests for: SuggestionDrawer snap state transitions (peek/half/full), drag gesture thresholds, and TasteWheel octant hit detection (point-in-triangle). Test that tapping an octant activates the correct taste tab. Use @testing-library/react for component mounting + simulated touch events. Lesson: test-coverage-gaps — untested canvas/gesture code breaks silently on device.",
  "spec_ref": "recipe-lab-mobile.md#interaction",
  "tags": ["test", "gesture", "canvas"]
}
```
