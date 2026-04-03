# plan.md — flavor-network iOS UX Fixes

Fix queue derived from the iOS user behavior simulation (simulation/output/recommendations.md).
19 pain points found, heuristic score 20/100. Tasks ordered by impact.

---

### Task 1: Fix SearchBar click-outside missing touchstart

```json
{
  "category": "bugfix",
  "priority": 1,
  "description": "SearchBar.jsx binds mousedown for click-outside but not touchstart — dropdown won't dismiss on iOS touch",
  "steps": [
    "Open src/components/SearchBar.jsx",
    "Find the useEffect that adds the mousedown listener for click-outside",
    "Add a parallel touchstart listener with the same handler",
    "Clean up both listeners in the useEffect return",
    "Run: npx vitest run src/ to verify no regressions"
  ],
  "passes": true
}
```

### Task 2: Fix BottomSheet drag handle below 44px iOS minimum

```json
{
  "category": "bugfix",
  "priority": 2,
  "description": "BottomSheet drag handle is h-1 (4px) — below iOS 44px minimum tap target. Users struggle to grab it.",
  "steps": [
    "Open src/components/BottomSheet.jsx",
    "Find the drag handle div (h-1 class on the grab cursor element)",
    "Increase the touch target area to at least 44px while keeping the visual indicator small (use padding or a larger transparent hit area)",
    "Also check SuggestionDrawer.jsx for the same issue and fix if present",
    "Verify the fix doesn't break the snap-point logic"
  ],
  "passes": true
}
```

### Task 3: Fix Clear Selection bar overlapping search dropdown

```json
{
  "category": "bugfix",
  "priority": 3,
  "description": "Clear Selection bar (fixed top-[100px] z-50) physically overlaps search results dropdown, blocking clicks on results after first ingredient selection",
  "steps": [
    "Open src/App.jsx, find the Clear Selection + Share buttons div (fixed top-[100px])",
    "The search dropdown in SearchBar.jsx uses z-50, same layer as the Clear Selection bar",
    "Fix by either: (a) increasing search dropdown z-index above z-50, or (b) repositioning Clear Selection bar to not overlap the dropdown area, or (c) making Clear Selection bar pointer-events-none when search is focused",
    "Test on mobile viewport (< 640px) to verify no overlap"
  ],
  "passes": true
}
```

### Task 4: Add gzip/brotli compression to Vite build

```json
{
  "category": "performance",
  "priority": 4,
  "description": "No compression configured — 27MB pairings.json could be ~3-5MB with gzip. TTI on LTE measured at 34s.",
  "steps": [
    "Install vite-plugin-compression: npm install --save-dev vite-plugin-compression",
    "Add the plugin to vite.config.js with gzip and optionally brotli",
    "Run npm run build and verify compressed output sizes",
    "Verify dev server still works: npm run dev"
  ],
  "passes": true
}
```

### Task 5: Cap devicePixelRatio on mobile

```json
{
  "category": "performance",
  "priority": 5,
  "description": "Uses raw devicePixelRatio (3x on iPhone 12/13/15 = 9x pixel count). Cap to 2 on mobile for significant GPU savings.",
  "steps": [
    "Open src/three/SceneManager.js",
    "Find where setPixelRatio is called with window.devicePixelRatio",
    "Change to setPixelRatio(Math.min(2, window.devicePixelRatio))",
    "Run: npx vitest run src/ to verify no regressions"
  ],
  "passes": true
}
```

### Task 6: Add React.memo to heavy components

```json
{
  "category": "performance",
  "priority": 6,
  "description": "Missing React.memo on 5 heavy components: NetworkScene, LivingArchView, SearchBar, Legend, Controls",
  "steps": [
    "Wrap each component's default export with React.memo()",
    "For SearchBar.jsx: wrap the function component with memo",
    "For Legend.jsx: wrap with memo",
    "For Controls.jsx: wrap with memo",
    "For NetworkScene.jsx: wrap with memo",
    "For LivingArchView.jsx: if it's already large and complex, only memo if it doesn't break internal state",
    "Run: npx vitest run src/ to verify no regressions"
  ],
  "passes": true
}
```

### Task 7: Reduce particle count on mobile

```json
{
  "category": "performance",
  "priority": 7,
  "description": "No mobile detection in ParticleSystem — 108K particles render on all devices. Reduce by 50-70% on mobile.",
  "steps": [
    "Open src/three/ParticleSystem.js",
    "Add a mobile detection check (check viewport width < 640 or accept a param)",
    "On mobile: reduce particles per edge from 2 to 1, and increase the strength threshold for which edges get particles (e.g., 0.3 -> 0.5)",
    "Verify the visual effect is still visible but less dense on mobile viewports"
  ],
  "passes": true
}
```

### Task 8: Fix Chef and Cocktail Builder simulation specs

```json
{
  "category": "testing",
  "priority": 8,
  "description": "Chef and Cocktail Builder Playwright specs time out due to Clear Selection z-overlap (Task 3) and heavy page.evaluate during animation loop. Fix specs to complete within 5 min.",
  "steps": [
    "After Task 3 fixes the z-overlap, revert the keyboard workaround in chef.spec.js and cocktail-builder.spec.js to direct click",
    "Add timeouts to page.evaluate calls in metrics.js (wrap in Promise.race with 10s timeout)",
    "Run: cd simulation && npx playwright test --config playwright.config.js to verify all 4 specs pass",
    "Run: node simulation/master/aggregate.js to verify improved scorecard"
  ],
  "passes": true
}
```

### Task 9: Add mobile shader precision hints

```json
{
  "category": "performance",
  "priority": 9,
  "description": "EdgeMesh.js uses highp float precision — lowp/mediump would be faster on older mobile GPUs (A9/A10)",
  "steps": [
    "Open src/three/EdgeMesh.js",
    "Find the custom ShaderMaterial vertex and fragment shaders",
    "Change 'precision highp float' to 'precision mediump float' for color and opacity varyings",
    "Keep highp for position calculations if needed",
    "Verify edges still render correctly"
  ],
  "passes": true
}
```
