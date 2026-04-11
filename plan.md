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

---

## Round 2 — Gaps from simulation audit (2026-04-10)

Derived from `simulation/output/recommendations.md` (19 pain points, 9 addressed in round 1).
Task 6 (React.memo) was reverted in commit 9277106 due to a black-screen TDZ crash — relanded here as Task 14 with a safer scope. Ordered by leverage on the F-grade TTI/FPS metrics.

### Task 10: Move pairings.json parse to a Web Worker

```json
{
  "category": "performance",
  "priority": 1,
  "description": "useProData.js parses the 27MB pairings.json on the main thread, blocking UI 6.8s on WiFi and 16.9s on LTE. This is the root cause of the F-grade TTI (34s) and FPS (0.9) — compression alone (Task 4) reduces download time but the parse still blocks. Move parsing to a Web Worker and post the structured result back.",
  "steps": [
    "Create src/workers/pairingsParser.worker.js — fetches pairings.json, JSON.parses it, postMessage()s the result",
    "Update src/hooks/useProData.js to instantiate the worker via new Worker(new URL('../workers/pairingsParser.worker.js', import.meta.url), { type: 'module' }) — Vite handles this natively",
    "Wire onmessage to setState; keep the existing loading/error states so consumers don't need to change",
    "Verify Vite dev server serves the worker (npm run dev) and production build emits it (npm run build)",
    "Run: npx vitest run src/ — worker usage should not break existing hook tests (may need to mock Worker)",
    "Re-run simulation: cd simulation && npx playwright test — expect JSON Parse Block metric to drop below 500ms"
  ],
  "passes": true
}
```

### Task 11: Verify 3D canvas touch gestures end-to-end

```json
{
  "category": "bugfix",
  "priority": 2,
  "description": "Simulation reports 'Tap on 3D canvas center did not select a node' on iPhone 12/LTE. OrbitControls are present but node picking via raycaster may not be wired to touch events. Without this, the core interaction is broken on iOS.",
  "steps": [
    "Open src/three/SceneManager.js and src/components/NetworkScene.jsx — find the raycaster/pointer handler",
    "Confirm the handler listens to both 'pointerdown' (unified) OR both 'mousedown' and 'touchstart' — pointer events are preferred",
    "Confirm OrbitControls has enableRotate: true, enableZoom: true, and touches: { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }",
    "Add a Playwright test in simulation/ that taps the canvas center on iPhone 12 viewport and asserts a node-selected state change",
    "Manually test on a real device or iOS simulator if available"
  ],
  "passes": true
}
```

### Task 12: Audit and fix remaining <44px tap targets

```json
{
  "category": "bugfix",
  "priority": 3,
  "description": "Simulation found 89 tap-target violations on cocktail-builder and 29 on iPhone SE (375px). Task 2 only fixed one BottomSheet handle. The remaining ~88 are unaudited and block the 'tap-targets-se' HIGH pain point.",
  "steps": [
    "Run simulation to regenerate the tap-target list: cd simulation && npx playwright test chef.spec.js cocktail-builder.spec.js curious-browser.spec.js",
    "Parse simulation/output/*-tap-targets.json (or equivalent) for elements below 44x44",
    "Group violators by component file. Fix in priority order: Controls, Legend, SearchBar result items, cocktail/sauce builder buttons",
    "Prefer increasing hit area via padding or ::before pseudo-element rather than changing visual size",
    "Re-run simulation — target is <5 violations per spec",
    "Run: npx vitest run src/ to catch any regressions"
  ],
  "passes": false
}
```

### Task 13: Toggle bloom post-processing off on low-end devices

```json
{
  "category": "performance",
  "priority": 4,
  "description": "Cocktail Lab FPS is 1.2 on iPhone 13/WiFi — bloom post-processing is the likely culprit. Add a device-capability check and disable bloom on mobile or low-end GPUs.",
  "steps": [
    "Find the EffectComposer / UnrealBloomPass setup in src/three/ (likely SceneManager.js or a post/ subfolder)",
    "Add a detectLowEnd() helper: check navigator.deviceMemory < 4, or userAgent mobile, or viewport width < 768",
    "When low-end: skip adding UnrealBloomPass to the composer, or set bloomStrength to 0",
    "Expose a localStorage override 'fn.forceBloom' for manual testing",
    "Verify Cocktail Lab renders without bloom on mobile viewport (devtools iPhone preset)",
    "Re-run simulation cocktail-builder spec — expect FPS > 20"
  ],
  "passes": true
}
```

### Task 14: Re-land React.memo safely (post-revert)

```json
{
  "category": "performance",
  "priority": 5,
  "description": "Commit 9277106 reverted React.memo due to a TDZ crash in tasteSelection and a black-screen bug in LivingArchView. Re-land memoization, but scoped only to leaf components (SearchBar, Legend, Controls) — skip NetworkScene and LivingArchView which hold closure state.",
  "steps": [
    "Read git show 9277106 to understand the exact revert reason",
    "Fix the tasteSelection TDZ error first: find the hoisting issue (let/const referenced before declaration) and reorder",
    "Wrap only these with React.memo(): SearchBar.jsx, Legend.jsx, Controls.jsx",
    "Do NOT memo NetworkScene.jsx or LivingArchView.jsx — those were the ones that black-screened",
    "Run: npm run build then open index.html — verify no black screen, network renders, ingredients clickable",
    "Run: npx vitest run src/",
    "Run simulation to confirm no FPS regression"
  ],
  "passes": true
}
```

### Task 15: Add adaptive quality (FPS monitor → auto-reduce detail)

```json
{
  "category": "performance",
  "priority": 6,
  "description": "Even with all Round 1+2 fixes, old iPhones will still struggle. Add a running FPS monitor that reduces quality settings when FPS drops below 25 for >2 seconds.",
  "steps": [
    "Create src/three/AdaptiveQuality.js: exports startMonitor(sceneManager) that samples FPS via rAF delta",
    "On sustained drop (<25 FPS for 2s): halve particle count, drop DPR to 1, disable bloom",
    "On sustained recovery (>45 FPS for 5s): restore one quality tier",
    "Hook into SceneManager init",
    "Expose window.fn.qualityTier for manual testing",
    "Document the tiers in a code comment"
  ],
  "passes": false
}
```

### Task 16: Split pairings.json by ingredient category for lazy-load

```json
{
  "category": "performance",
  "priority": 7,
  "description": "Even after Web Worker offload (Task 10), the 27MB payload still eats LTE users' data budget. Split pairings.json into per-category shards and lazy-load on demand when a user selects from that category. Listed as 'high impact, 1-2 weeks' in recommendations.md.",
  "steps": [
    "Write scripts/splitPairings.cjs — reads public/data/pairings.json, groups by ingredient category, writes public/data/pairings/<category>.json + public/data/pairings/index.json (category manifest)",
    "Update useProData.js (post Task 10) to load the manifest first, then fetch shards on demand via the worker",
    "Add a small in-memory cache keyed by category",
    "Update Vite build to include the split files",
    "Measure: total payload on first paint should drop to <3MB",
    "Re-run simulation — TTI should drop below 8s on LTE"
  ],
  "passes": false
}
```

### Task 17: Reconcile harness-ralph plan.md with already-completed tasks

```json
{
  "category": "chore",
  "priority": 8,
  "description": "harness-ralph/plan.md lists 12 tasks all passes:false, but artifacts for tasks 1, 5, 6, 8, 10 already exist on disk (.ralph/gate_failure.md, metrics.jsonl, prepare_context.cjs, ralph_status.cjs, activity.md). Mark completed tasks done so the loop doesn't re-pick them, and record what's genuinely pending.",
  "steps": [
    "For each task in harness-ralph/plan.md, verify whether the artifact exists or the change is in ralph.sh/gates.sh",
    "Set passes:true for tasks 1, 5, 6, 8, 10 if confirmed complete",
    "Leave tasks 2 (timeout), 3 (dirty-tree/branch checks), 4 (secrets/denylist gates), 7 (PLAN_PROMPT), 9 (consecutive-failure detection), 11 (ralph.ps1 parity verify), 12 (determinism docs) as passes:false",
    "Commit with message 'harness-ralph: reconcile plan with actual state'"
  ],
  "passes": false
}
```
