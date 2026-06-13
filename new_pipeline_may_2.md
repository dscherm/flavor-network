1\. Responsive formatting to better fit ux items. In IOS for example, the joystick flywheel bar sits in the middle of the screen with the information (?) button right below it on the right of the screen with a ton of negative space on the left and the 3d/2d view buttons behind the menu tab buttons.  It's a mess. i think on the IOS version the flywheel joystick should be underneath the search bar.  



2\. I want to be able to press enter in the search ingredients bar and select that ingredient that is in the textbox search.  



3\.  I want to create another layer to the suggestions tab. This would be the parent layer where the user could choose to "Add" or "Replace".  (use deep interview if this is too ambiguous). BUt i created a table to describe the architecture for the suggestions feature.  

|Buttons|ADD|Replace|
|-|-|-|
|Buckets|Buckets default to different "Taste" categories like what exists now for replace|Ingredients that can be replaced buckets (if an ingredient can't be replaced or there are no suggestions, just write "No suggestions" in the bucket.  |
|Filters|Taste, Aroma, cuisines|Filters: what ingredient to replace, taste, aroma, cuisines |
|Cocktails Note|No cuisines filter. |No cuisines filter|



One more note: Try to include most likely to pair. Also if an ingredient is already in the recipe, then don't suggest it as a replacement.  For example, if bourbon is the core ingredient, then don't suggest replacing it under the replacements for simple syrup suggestion.  



4\.  All for users to save recipes when they make them.  Let them access their saved recipes in their profile tab and in the recipe lab



5\. Spread apart the nodes in the subclusters in both the sauces and cocktail labs.  they're too hard to see and select 



6\.  Change the animation so that it is rotating around the model so that it positions each cluster label in front of the camera.  

---

## Bridge tasks (machine-readable; consumed by `bridge_state.py refresh --from-plan new_pipeline_may_2.md`)

### Task 1 — iOS responsive layout fix

```json
{
  "id": "R15-1",
  "title": "iOS responsive layout fix — flywheel + info + view-toggle stacking",
  "category": "feature",
  "priority": 1,
  "description": "Current iOS layout is broken: joystick flywheel sits mid-screen with info (?) button below it on the right, leaving huge negative space on the left, and the 3D/2D view-toggle buttons render behind the menu tab buttons. Target layout: on iOS, flywheel sits directly underneath the search bar; info button + view toggles get explicit z-index above the tab bar; left-side negative space is consumed by repositioning the flywheel.",
  "steps": [
    "Audit current iOS layout in LivingArchView.jsx + ClusterJoystick.jsx — capture screenshots of broken state via Capacitor or DevTools mobile emulation at 375x812 (iPhone 13).",
    "Move flywheel container so it docks below SearchBar on viewports < 640px.",
    "Bump z-index of view-toggle buttons (3D/2D/ml/neural mode) above the tab bar.",
    "Visual regression check at 375, 414 (iPhone 14 Pro), 768 (iPad portrait), 1024 (desktop). No regression on desktop layout.",
    "Verify on TestFlight build or Capacitor live-reload."
  ]
}
```

### Task 2 — SearchBar Enter-to-select

```json
{
  "id": "R15-2",
  "title": "SearchBar — Enter key selects current textbox ingredient",
  "category": "feature",
  "priority": 2,
  "description": "Pressing Enter in the search ingredients textbox should select the ingredient currently typed (or the top fuzzy match if not exact). Currently the user has to click the dropdown result.",
  "steps": [
    "Add onKeyDown handler to SearchBar input — Enter triggers selection of the top fuse.js result.",
    "If query exactly matches an ingredient name, prefer that exact match over fuzzy.",
    "Empty/no-match query: Enter is a no-op (don't crash, don't select arbitrary).",
    "Add Vitest coverage: typed exact name -> selects, typed prefix -> selects top fuzzy, typed nonsense -> no-op."
  ]
}
```

### Task 3 — Suggestions ADD/REPLACE parent layer (deep-interview gated)

```json
{
  "id": "R15-3",
  "title": "Suggestions tab — ADD/REPLACE parent layer (DEEP-INTERVIEW)",
  "category": "spec",
  "priority": 3,
  "description": "Add parent toggle in Suggestions tab: ADD vs REPLACE. ADD = current behavior (buckets by taste categories, filters: taste/aroma/cuisines). REPLACE = buckets are 'ingredients in current recipe that can be replaced' (or 'No suggestions' if none), filters: which-ingredient-to-replace + taste/aroma/cuisines. Cocktails get no cuisines filter in either mode. Both modes: include 'most likely to pair' signal. Both modes: never suggest an ingredient that's already in the recipe (e.g., don't suggest replacing bourbon in a simple-syrup REPLACE bucket if bourbon is the core). User-flagged as potentially ambiguous — run /oh-my-claudecode:deep-interview before writing code. Output: a spec at .omc/specs/deep-interview-suggestions-add-replace.md, then split into R15-3a/b/c implementation tasks.",
  "steps": [
    "Run /oh-my-claudecode:deep-interview on the Add/Replace architecture with the user's table as the seed.",
    "Resolve: parent toggle UI placement, 'most likely to pair' ranking math, 'can be replaced' criterion, multi-select interaction, mobile layout.",
    "Land spec at .omc/specs/deep-interview-suggestions-add-replace.md.",
    "Split implementation into sub-tasks (R15-3a..R15-3c) and append to plan."
  ]
}
```

### Task 4 — Save recipes

```json
{
  "id": "R15-4",
  "title": "Save recipes — profile + recipe lab access",
  "category": "feature",
  "priority": 4,
  "description": "Allow users to save recipes they build. Saved recipes accessible from the Profile tab AND from inside Recipe Lab. Storage: localStorage keyed per user (no auth backend exists yet — single-device persistence).",
  "steps": [
    "Add 'Save Recipe' button to RecipeLab.jsx + RecipePanel.jsx surfaces.",
    "Create src/data/savedRecipes.js: localStorage CRUD + schema (id, name, ingredients[], createdAt, updatedAt).",
    "Add 'Saved Recipes' section to ProfilePanel.jsx — list with click-to-load.",
    "Add 'Saved Recipes' tab/section inside RecipeLab — same list, click loads into the canvas.",
    "Vitest coverage on savedRecipes.js (CRUD round-trip, malformed storage gracefully empty)."
  ]
}
```

### Task 5 — Spread subcluster nodes

```json
{
  "id": "R15-5",
  "title": "Spread subcluster nodes in Cocktail Lab + Sauce Lab",
  "category": "feature",
  "priority": 5,
  "description": "Subcluster nodes in both labs are too clumped — hard to see, hard to select. Spread them apart while keeping cluster cohesion (subcluster centers stay where they are; member nodes get more spacing).",
  "steps": [
    "Inspect cocktailGraph.js + sauceGraph.js position-computation: identify the radius/scale knobs that control intra-subcluster spacing.",
    "Increase intra-subcluster spread by ~1.5-2x. Verify cluster boundaries still feel distinct (no two subclusters bleed into each other).",
    "Test selectability — every node must be raycast-pickable on desktop and mobile (touch raycast 44px target).",
    "Visual regression: screenshot before/after for both labs, confirm legibility win."
  ]
}
```

### Task 6 — Camera-anim label-facing-camera

```json
{
  "id": "R15-6",
  "title": "Camera-anim — orient cluster labels to face camera during tour",
  "category": "feature",
  "priority": 6,
  "description": "Cluster tour animation should rotate the camera-or-labels so that the active cluster's label is positioned directly in front of the camera (label-facing-viewer) at the dwell moment. Current behavior places the camera near the centroid but label may be sideways/behind. Pure cosmetic but reads much better in a demo.",
  "steps": [
    "In CameraAnimator.js, during the tour-glide segment, compute the camera's final pose so the cluster-label sprite's normal points toward the camera.",
    "Easiest implementation: place camera on the line from cluster centroid through the label's current position, offset back by ORBIT_DISTANCE.",
    "Verify the label's billboard behavior (sprites always face camera) doesn't conflict — should be reinforcing, not fighting.",
    "Update CameraAnimator.test.js with the new expected pose math.",
    "Visual check: load each of Network / Cocktail / Sauce on desktop, watch one full lap, label should be readable at every dwell."
  ]
}
```
