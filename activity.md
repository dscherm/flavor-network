# Flavor Network — Activity Log

**Last updated:** 2026-04-10
**Status:** Round 2 iOS UX fixes in progress (1/8 tasks)

---

## 2026-04-10 — Task 17: Reconcile harness-ralph plan.md

**Goal:** harness-ralph/plan.md listed all 12 tasks as `passes: false` but the implementations were already shipped on disk across several earlier sessions. Sync the plan with reality so prepare_context doesn't keep re-picking them.

**Verified present on disk:**
- Task 1 (gate failure loop): `.ralph/gate_failure.md` exists + PROMPT.md Phase 1 reads it
- Task 2 (per-iteration timeout): `--timeout` flag in ralph.sh lines 12, 109, 244
- Task 3 (startup safety checks): `--force` flag + dirty-tree/main-branch guards
- Task 4 (secrets + denylist gates): Gate 5 + Gate 6 in `.claude/scripts/gates.sh`
- Task 5 (activity.md structured format): this file
- Task 6 (metrics.jsonl): written in ralph.sh iteration loop
- Task 7 (PLAN_PROMPT.md): `D:/Projects/flavor-network/PLAN_PROMPT.md`
- Task 8 (prepare_context script): `tools/prepare_context.cjs`
- Task 9 (consecutive failure detection): `CONSECUTIVE_FAILURES` counter in ralph.sh
- Task 10 (ralph_status dashboard): `tools/ralph_status.cjs`
- Task 11 (ralph.ps1 PowerShell variant): `ralph.ps1` at project root
- Task 12 (determinism docs): `.claude/docs/mini-ralph-reference.md`

**Changes Made:**
- `harness-ralph/plan.md`: flipped all 12 `passes: false` → `passes: true`.

**Verification:**
- Grepped each claimed artifact; all present.
- No code changes to flavor-network itself — this is a metadata reconciliation.

**Status:** COMPLETE

---

## 2026-04-10 — Task 15: Adaptive quality FPS monitor

**Goal:** Even after Tasks 5, 7, 10, 13 etc., older iPhones may still struggle. Add a running FPS monitor that automatically degrades quality tiers when FPS drops below 25 for ≥2s and restores when back above 45 for ≥5s.

**Changes Made:**
- `src/three/SceneManager.js`:
  - New state: `_qualityTier`, `_fpsSampleSum`, streak counters, thresholds (25/45 fps, 2000/5000 ms).
  - New `_sampleFps(delta)` — accumulates samples over 1-second windows, evaluates streak, degrades or restores by one tier. Middle-band decays both streaks.
  - New `_applyQualityTier()` — Tier 1 halves DPR to 1.0, Tier 2 also disables bloom via `_bloomPass.enabled = false`, Tier 3 dispatches `fn:quality-tier` CustomEvent so ParticleSystem can self-reduce.
  - Exposes `window.fn.qualityTier` and `window.fn.lastAvgFps` for manual inspection.
  - Wired into `_animate()` via `this._sampleFps(delta)` after `_tick()`.

**Verification:**
- `npx vitest run src/` — 17 passed, 0 failed
- `npm run build` — PASS (bundle unchanged size)

**Status:** COMPLETE

---

## 2026-04-10 — Task 14: Re-land React.memo on leaf components

**Goal:** Memoize the 3 leaf components that were reverted in commit 9277106. The revert ALSO fixed the tasteSelection TDZ bug via a ref indirection; the underlying cause is resolved, so memoizing leaf components (no refs, no hoisting complexity) is safe now.

**Changes Made:**
- `src/components/SearchBar.jsx`: re-imported `memo`, wrapped export in `memo(SearchBar)`.
- `src/components/Legend.jsx`: wrapped export in `React.memo(Legend)`.
- `src/components/Controls.jsx`: wrapped export in `React.memo(Controls)`.
- Deliberately skipped NetworkScene.jsx and LivingArchView.jsx — these were the two that caused the production black-screen (they hold closure state over animate loops and the hoisting order matters).

**Verification:**
- `npx vitest run src/` — 17 passed, 0 failed
- `npm run build` — PASS, bundle still 415 kB (no regression)

**Status:** COMPLETE

---

## 2026-04-10 — Task 13: Disable bloom on low-end devices

**Goal:** Cocktail Lab FPS is 1.2 on iPhone 13/WiFi — UnrealBloomPass is the dominant cost. Add device-capability detection and skip bloom on low-end devices.

**Changes Made:**
- `src/three/SceneManager.js`: new `isLowEndForBloom()` helper at module scope. Checks localStorage override (`fn.forceBloom` / `fn.disableBloom`), then `navigator.deviceMemory < 4`, then `pointer: coarse + viewport < 768`, then mobile UA + narrow viewport.
- In `init()`, only instantiate and add `UnrealBloomPass` when `isLowEndForBloom()` returns false. Tracked as `this._bloomEnabled`.
- `setBloomParams` already guards on `this._bloomPass` existence so it no-ops safely.

**Verification:**
- `npx vitest run src/` — 17 passed, 0 failed
- `npm run build` — PASS

**Status:** COMPLETE

---

## 2026-04-10 — Task 11: Verify 3D canvas touch picking

**Goal:** Fix the simulation finding 'tap on 3D canvas center did not select a node' on iPhone 12/LTE. SceneManager.js was bound to `click` and `mousemove`, which do not reliably fire on iOS touch and do not distinguish tap from OrbitControls drag.

**Changes Made:**
- `src/three/SceneManager.js`: replaced `click`/`mousemove` listeners with `pointerdown`/`pointerup`/`pointermove`. Pointer events work uniformly across mouse, touch, and pen on iOS Safari 13+.
- Added a tap-vs-drag discriminator: `pointerdown` records start position, `pointerup` only fires the node-click handler if cumulative movement stayed under 10px (otherwise OrbitControls would log a drag as a tap at the drop point).
- `pointermove` hover handler filters to `pointerType === 'mouse'` so touch gestures don't trigger hover raycasts during pinch/rotate.
- Matching dispose cleanup for all three new listeners.

**Verification:**
- `npx vitest run src/` — 17 passed, 0 failed
- `npm run build` — PASS

**Status:** COMPLETE

---

## 2026-04-10 — Task 10: Move pairings.json parse to Web Worker

**Goal:** Offload the 27MB JSON fetch+parse from the main thread. Simulation reported JSON parse blocking for 6.8s on WiFi and 16.9s on LTE — root cause of F-grade TTI and FPS.

**Changes Made:**
- `src/workers/pairingsParser.worker.js` (NEW): fetches ingredients.json, pairings.json, season_region.json, cuisine_map.json and parses them in a dedicated worker thread. Emits progress events per stage.
- `src/hooks/useProData.js`: instantiate Worker via `new URL('../workers/pairingsParser.worker.js', import.meta.url), { type: 'module' }`. Wire `onmessage` to a `finish()` helper that still runs buildProGraph + computeTastePositions on the main thread (cheap compared to the parse). Fall back to main-thread loading when Worker construction fails (jsdom/older browsers).
- Cleanup in useEffect terminates the worker on unmount.

**Verification:**
- `npx vitest run src/` — 17 passed, 0 failed (useProData has no direct tests; fallback path keeps it jsdom-compatible)
- `npm run build` — PASS, worker emitted as `assets/pairingsParser.worker-*.js` (1.19 kB raw / 0.43 kB gzip)

**Status:** COMPLETE

---

## Entry Format

Each entry follows this structure:
- Date + Task reference
- Goal
- Changes Made (specific files)
- Verification (commands + results)
- Status (COMPLETE or BLOCKED with reason)

---

## 2026-03-25 — Audit: Ralph Loop Spec Compliance

**Goal:** Audit the Ralph Loop against RALPH_LOOP_SPEC.md (45 items)

**Changes Made:**
- Created `harness-ralph/` mini-loop (12 tasks) to close gaps
- Scored 8 PASS, 8 PARTIAL, 27 MISSING (18% compliance)

**Verification:**
- Reviewed all 45 checklist items against existing files
- Documented in conversation, scorecard produced

**Status:** COMPLETE — fix plan created as harness-ralph

---

## 2026-03-24 — Cocktail-Ralph + Sauce-Ralph Complete

**Goal:** Improve Cocktail Lab and Sauce Lab via mini-ralph loops

**Changes Made:**
- `cocktail-ralph/`: 10 tasks — adjacency map, 23 new spirits, symmetry, quantity persistence, technique tags, roundRect fix, compound notes, validation, tests
- `sauce-ralph/`: 10 tasks — adjacency map, symmetry, swap UI, My Sauces tab, technique tags, 8 new recipes, validation, tests
- New agents: cocktail-agent.md, sauce-agent.md

**Verification:**
- `npm run build` — PASS
- `node tests/cocktail-lab.test.mjs` — 165 passed, 0 failed
- `node tests/sauce-lab.test.mjs` — 120 passed, 0 failed

**Status:** COMPLETE

---

## 2026-03-24 — Cleanup-Ralph + Refactor-Ralph Complete

**Goal:** Remove dead code, decompose LivingArchView

**Changes Made:**
- `cleanup-ralph/`: 6 tasks — removed src/ml/, TensorFlow.js, tesseract.js, legacy CSVs, dead hooks, stale docs
- `refactor-ralph/`: 8 tasks — extracted utilities, constants, shaders, taste selection, animate sub-functions, raycasting

**Verification:**
- `npm run build` — PASS
- LivingArchView: 1284 → 900 lines

**Status:** COMPLETE

---

## 2026-03-24 — Ingredient-Ralph Complete

**Goal:** Deep data audit and cleanup of ingredient/pairing datasets

**Changes Made:**
- `ingredient-ralph/`: 12 tasks — purged anomalies, garbage names, orphans, duplicates, filled tastes, rescaled strengths, deduped augments, reclassified categories

**Verification:**
- `npm run build` — PASS
- Before: 4,488 ingredients, 50,512 pairings
- After: 3,913 ingredients, 48,588 pairings

**Status:** COMPLETE
