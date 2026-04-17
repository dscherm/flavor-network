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
  "passes": true
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
  "passes": true
}
```

### Task 16: Binary-packed pairings format (PIVOTED from category-split)

```json
{
  "category": "performance",
  "priority": 7,
  "description": "Reduce the pairings payload. Analysis of the data found 96% of pairings cross ingredient categories, making category-split useless as a lazy-load axis. Pivoted to a minimal binary format after discovering only 3 of the ~12 per-pairing fields are actually consumed. Result: 1.35 MB brotli → 168 KB brotli (88% reduction).",
  "steps": [
    "Grep src/ to confirm only ingredientA/ingredientB/strength are read from pairings",
    "Write scripts/buildPairingsBinary.cjs — packs into 8-byte records (u16 idxA, u16 idxB, f32 strength) with FNPR header",
    "Update worker to prefer pairings.bin via DataView decode, fall back to pairings.json on error",
    "Widen vite-plugin-compression filter to include .bin so sidecars are emitted",
    "Add build:pairings script + prebuild hook in package.json",
    "Run: npx vitest run src/ + npm run build — verify all emitted"
  ],
  "passes": true
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
  "passes": true
}
```

---

## Round 3 — chemDataset scrapers for flavor-gnn (2026-04-15)

Three chemDataset fetchers (`02-flavordb`, `04-bitterdb`, `05-supersweetdb`) are TODO
stubs that only write empty JSON. Without real data the GNN cannot progress past M0.
Tasks ordered by ML signal value: FlavorDB (odor tags + 25k molecules) is highest
leverage; BitterDB and SuperSweetDB sharpen per-task labels.

All three share conventions: RATE_MS=1000 rate limit, cache raw responses under
`chemDataset/raw/<source>/`, idempotent re-runs, output schemas documented in each
script's header comment. Use `node-fetch` (already in deps) and honor robots.txt.

### Task 18: Implement FlavorDB scraper (02-fetch-flavordb.js)

```json
{
  "id": "R3-18",
  "title": "Implement FlavorDB scraper",
  "category": "data-pipeline",
  "priority": 1,
  "passes": true,
  "description": "Replace stub in chemDataset/scripts/02-fetch-flavordb.js with a real scrape of cosylab.iiitd.edu.in/flavordb2. Produces processed/flavordb.json with {entities: {<name>: {id, category, molecules: [<pubchem_id>]}}, molecules: {<pubchem_id>: {name, smiles, flavor_profile: [<tag>], ...}}}. Highest leverage source: 25,595 molecules with taste + odor tags — required for the GNN's odor_class head.",
  "steps": [
    "Read chemDataset/scripts/02-fetch-flavordb.js and chemDataset/scripts/common.js for helpers (RAW, PROCESSED, ensureDir, writeJson, sleep)",
    "Page through GET https://cosylab.iiitd.edu.in/flavordb2/entities_json?start=<N>&count=30 until {entities: []} empty. Cache each page to raw/flavordb/entities_<N>.json",
    "For each entity, GET /entity_details?id=<entity_id>. Cache to raw/flavordb/entity_<id>.json. Skip if file already exists (idempotent)",
    "Sleep RATE_MS (1000ms) between requests. Retry on transient 5xx with exponential backoff; skip on 404",
    "Aggregate into processed/flavordb.json with the exact schema in the header comment. Include _fetched_at ISO timestamp, drop _stub flag",
    "Add per-page/per-entity progress logs ([flavordb] page N, entity ID)",
    "Run: cd chemDataset && npm run flavordb. Verify processed/flavordb.json has entities/molecules populated and raw/flavordb/ has cached JSON",
    "Run: npm run blend. Verify public/chemDataset/pairings.json strength scores now incorporate flavordb compound overlaps (diff byte count vs current 34961 KB)"
  ]
}
```

### Task 19: Implement BitterDB scraper (04-fetch-bitterdb.js)

```json
{
  "id": "R3-19",
  "title": "Implement BitterDB scraper",
  "category": "data-pipeline",
  "priority": 2,
  "passes": true,
  "description": "Replace stub in chemDataset/scripts/04-fetch-bitterdb.js with a real scrape of bitterdb.agri.huji.ac.il/dbbitter.php. Produces processed/bitterdb.json with {compounds: {<id>: {name, smiles, sources: []}}}. ~1041 bitter molecules — improves the GNN's bitter-taste head precision.",
  "steps": [
    "Read chemDataset/scripts/04-fetch-bitterdb.js header comment for output schema",
    "GET https://bitterdb.agri.huji.ac.il/dbbitter.php — the page renders compound list in HTML. Parse with a lightweight regex or add cheerio (add to package.json deps if needed — prefer regex to avoid new deps)",
    "For each compound, follow the detail link to extract name, SMILES, and any listed natural sources. Cache each detail page under raw/bitterdb/compound_<id>.html",
    "Sleep 1000ms between requests. Idempotent: skip if raw/bitterdb/compound_<id>.html exists",
    "Aggregate into processed/bitterdb.json. Include _fetched_at, drop _stub",
    "Run: cd chemDataset && npm run bitterdb. Verify processed/bitterdb.json has ~1000 compounds",
    "Run: npm run blend. Confirm no errors"
  ]
}
```

### Task 20: Implement SuperSweetDB scraper (05-fetch-supersweetdb.js)

```json
{
  "id": "R3-20",
  "title": "Implement SuperSweetDB scraper",
  "category": "data-pipeline",
  "priority": 3,
  "passes": true,
  "description": "Replace stub in chemDataset/scripts/05-fetch-supersweetdb.js. Original host (webdocs.cs.ualberta.ca/SuperSweetDB) is offline — either locate an archived mirror or fall back to extracting the sweet subset from already-fetched ChemTasteDB (processed/chemtastedb.json). Produces processed/supersweetdb.json with {compounds: {<id>: {name, smiles, intensity}}}.",
  "steps": [
    "Check Wayback Machine for the original SuperSweetDB mirror (https://web.archive.org/web/*/webdocs.cs.ualberta.ca/SuperSweetDB). If reachable, scrape with 1 req/sec",
    "If no mirror works, implement the documented fallback: read processed/chemtastedb.json, filter to compounds where taste_class == 'sweet', map intensity from the ChemTasteDB relative-sweetness field",
    "Log which path was taken ([supersweetdb] using mirror=... or using chemtastedb fallback)",
    "Aggregate into processed/supersweetdb.json. Include _fetched_at and _source: 'mirror'|'chemtastedb-fallback', drop _stub",
    "Run: cd chemDataset && npm run supersweetdb. Verify non-empty compounds output",
    "Run: npm run blend. Confirm no errors"
  ]
}
```

### Task 21: Wire chemDataset compounds into flavor-gnn M0 data join

```json
{
  "id": "R3-21",
  "title": "Wire chemDataset into flavor-gnn M0 data join",
  "category": "ml",
  "priority": 4,
  "passes": true,
  "description": "Once Tasks 18-20 land, produce the M0 artifact described in flavor-gnn/README.md: a unified compounds.parquet with SMILES + multi-label taste + odor class, joined across all five chemDataset sources. This is the prerequisite for the M1 Random Forest baseline.",
  "steps": [
    "Check flavor-gnn/src/ for any existing data-join scaffold",
    "Write flavor-gnn/src/data/build_compounds.py: reads ../chemDataset/processed/{foodb,flavordb,chemtastedb,bitterdb,supersweetdb}.json, joins on pubchem_id or InChIKey, emits compounds.parquet with columns [pubchem_id, smiles, sweet, bitter, umami, salty, sour, odor_class, intensity]",
    "Handle label conflicts: if a compound is labeled sweet in ChemTasteDB and bitter in BitterDB, keep both (multi-label)",
    "Log row counts per source and after join. Expect ~10-30k rows after SMILES-available filter",
    "Run: cd flavor-gnn && python -m src.data.build_compounds. Verify compounds.parquet written",
    "Update flavor-gnn/README.md Milestone M0 status from 'scaffold' to 'done' once verified"
  ]
}
```

---

## Round 4 — flavor-gnn M1→M4 (2026-04-15)

Builds on the M0 artifact (flavor-gnn/data/compounds.parquet, 4176 compounds with
multi-label taste + odor class). Goal: end-to-end pipeline from SMILES to ONNX
model consumed by a build-time rescoring step for pairings.json.

### Task 22: M1 Random Forest baseline on Morgan fingerprints

```json
{
  "id": "R4-22",
  "title": "M1 RF baseline on Morgan fingerprints",
  "category": "ml",
  "priority": 1,
  "description": "Establish per-task F1 targets for the GNN to beat. Morgan fingerprint (radius=2, 2048 bits) + scikit-learn RandomForestClassifier per binary label (sweet/bitter/umami/salty/sour). Stratified 80/20 train/test split, seed=42. Report macro-F1 and per-class precision/recall. Artifact: flavor-gnn/artifacts/m1_baseline.json with metrics + top feature importances per task.",
  "steps": [
    "pip install rdkit-pypi scikit-learn",
    "Write flavor-gnn/src/baselines/morgan_rf.py: reads data/compounds.parquet, computes Morgan fingerprints via rdkit, trains one RF per taste label, reports per-task F1, writes artifacts/m1_baseline.json",
    "Skip rows whose smiles fails rdkit parsing; log the drop count",
    "Run: python -m src.baselines.morgan_rf. Verify artifacts/m1_baseline.json exists",
    "Record per-task macro-F1 as the M2 target to beat"
  ]
}
```

### Task 23: M2 MPNN baseline (3-layer message passing on bitter + sweet)

```json
{
  "id": "R4-23",
  "title": "M2 MPNN baseline on bitter/sweet",
  "category": "ml",
  "priority": 2,
  "description": "Small 3-layer message-passing GNN trained on the two best-populated labels (bitter=2068, sweet=596). Goal: beat M1 RF on both. Atom features: element one-hot, degree, formal charge, hybridization, aromaticity. Bond features: bond type, conjugation, in-ring. Artifact: flavor-gnn/artifacts/m2_mpnn_bitter.pt and m2_mpnn_sweet.pt with per-task F1.",
  "steps": [
    "pip install torch torch-geometric (Windows cpu wheels; fall back to PyG Lightning install docs if scatter/sparse fails)",
    "Write flavor-gnn/src/models/mpnn.py: featurizer (smiles -> Data), 3-layer GINConv backbone, global_mean_pool, 2-layer MLP head",
    "Write flavor-gnn/src/train/train_single.py: 80/20 split, Adam(1e-3), 50 epochs, early-stop on val F1, save best checkpoint",
    "Train bitter and sweet models separately",
    "Compare per-task F1 to M1. If MPNN < RF by >5 points, diagnose: too-small data, featurizer bug, or depth issue",
    "Record results in artifacts/m2_results.json"
  ]
}
```

### Task 24: M3 multi-task joint training

```json
{
  "id": "R4-24",
  "title": "M3 multi-task joint training",
  "category": "ml",
  "priority": 3,
  "description": "Shared GNN backbone + per-task heads for all five tastes + odor class. Trained jointly with masked BCE loss (a compound without a label for a head contributes 0 to that head's loss). Expect gains from shared representation, especially on the sparse labels (salty=16, umami=52, sour=50). Artifact: flavor-gnn/artifacts/m3_multitask.pt.",
  "steps": [
    "Extend src/models/mpnn.py with a multi-head variant: shared backbone, one linear head per task",
    "Write src/train/train_multitask.py with per-task masking (label=None -> loss_mask=0)",
    "Use the same 80/20 split as M2 for fair comparison",
    "Compare per-task F1 to M2 single-task baselines. Expect multi-task to match or beat on common tasks and improve on sparse ones",
    "Record in artifacts/m3_multitask.json"
  ]
}
```

### Task 25: M4 ONNX export + browser wrapper + pairings rescoring

```json
{
  "id": "R4-25",
  "title": "M4 ONNX export + pairings rescoring",
  "category": "ml",
  "priority": 4,
  "description": "Export the M3 multi-task model to ONNX, run it offline on all 70k FooDB compounds to produce taste/odor predictions, and feed those predictions back into 10-blend.js's scoring formula. Net effect: pairings.json strength scores now benefit from predicted labels on the 68k currently-unlabeled compounds.",
  "steps": [
    "Write flavor-gnn/src/export/to_onnx.py: torch.onnx.export of the multi-task model with a dynamic axis on node/edge counts, dummy input via a small featurized graph",
    "Write flavor-gnn/src/infer/score_all.py: reads foodb.json compounds, featurizes each SMILES, runs ONNX inference via onnxruntime (python), writes chemDataset/processed/predictions.json { pubchem_id: {sweet, bitter, umami, salty, sour, odor_class, intensity} }",
    "Update chemDataset/scripts/10-blend.js to read predictions.json and use predicted intensity + taste when ground-truth labels are missing. Gate behind a flag so the old behavior stays available",
    "Run: cd chemDataset && npm run blend. Compare before/after pairings.json byte size and spot-check 10 ingredient pairings",
    "(Optional web deployment) public/models/flavor-gnn.onnx + src/ml/flavorGnn.js wrapper for onnxruntime-web. Skip if build-time rescoring is enough"
  ]
}
```

---

## Round 5 — Make version C visibly demonstrate the GNN (2026-04-15)

Until these ship, version C renders identically to A/B — the chemDataset and
GNN artifacts exist on disk but no UI surface consumes them. These five tasks
turn the trained model into a visible, interactive feature.

**Bias awareness carried across all 5 tasks:** BitterDB and ChemTasteDB
contributed positives-only training sets, so the classifier head overpredicts
bitter/sweet on out-of-distribution FooDB compounds (see /docs bias table).
Prefer the GNN's penultimate 128-d representation (less biased, encodes
structure) over the output sigmoids for geometry/embedding purposes. Output
sigmoids are fine for classification demos (R5-28) as long as uncertainty is
also surfaced (R5-29).

### Task 26: R5-26 — GNN embedding layout (replace taste axes with learned representation)

```json
{
  "id": "R5-26",
  "title": "GNN-learned embedding as 3D layout",
  "category": "ml-viz",
  "priority": 1,
  "description": "Extract the MPNN's penultimate 128-d graph embedding for every proDataset ingredient (via SMILES-of-representative-compound lookup), reduce to 3D with UMAP, and use that as the positions map instead of computeTastePositions. Ingredients cluster by what the network learned, not by 8 hand-coded taste channels.",
  "steps": [
    "Add a forward_embedding() method on MPNN that returns the pooled graph vector before the classifier head",
    "Write flavor-gnn/src/infer/embed_ingredients.py: for each proDataset ingredient, find its best representative SMILES via name→chemtastedb/flavordb/foodb lookup (fall back to the single most-connected compound). Run embedding forward pass, stack into (N, 128) matrix.",
    "Reduce to 3D with umap-learn (n_neighbors=15, min_dist=0.1, random_state=42). Renormalize so 95th-percentile distance = 50 to match the existing camera framing.",
    "Write output to public/proDataset/gnn_positions.json: { ingredient_name: [x,y,z] }",
    "Add a toggle in useProData (prefers gnn_positions.json when present, falls back to computeTastePositions). Default ON so the feature is visible without user action.",
    "Document in flavor-gnn/README the caveat that ingredients without a SMILES lookup fall back to taste axes"
  ]
}
```

### Task 27: R5-27 — Animate message passing on the selected molecule

```json
{
  "id": "R5-27",
  "title": "Message-passing animation overlay",
  "category": "ml-viz",
  "priority": 2,
  "description": "When a user selects an ingredient with a representative SMILES, show a small molecular graph overlay in the drilldown panel where the 3 MPNN layers play out as an animation: atoms light up at t=0, neighbors activate at t=1, etc., ending with the pooled signal and the predicted taste bars. Uses Three.js for the overlay (atoms as instanced spheres, bonds as lines, Gaussian glow on activation).",
  "steps": [
    "Add src/ml/flavorGnnRuntime.js — wraps onnxruntime-web (public/models/flavor-gnn.onnx copied from flavor-gnn/artifacts)",
    "Export intermediate layer activations from the ONNX model. Since the current ONNX graph only emits final logits, re-export with multiple output nodes (one per GINEConv layer) — update flavor-gnn/src/export/to_onnx.py to register additional output_names",
    "Add src/components/MessagePassingOverlay.jsx — renders molecule graph + activation animation on a small canvas inside IngredientPanel",
    "Hook into IngredientPanel.jsx — mount the overlay when a representative SMILES exists",
    "Animation timing: 800ms per layer, 2400ms total, loop with a 500ms pause"
  ]
}
```

### Task 28: R5-28 — SMILES sketch → real-time prediction panel

```json
{
  "id": "R5-28",
  "title": "SMILES input with live taste prediction",
  "category": "ml-viz",
  "priority": 3,
  "description": "New tab or modal: SMILES text field (copy-paste or manually typed) runs through the ONNX GNN on every change and renders a 5-bar sweet/bitter/umami/salty/sour chart + top-3 odor tokens from the FlavorDB vocabulary. Also shows a small 2D depiction of the parsed molecule via rdkit-js (or a WASM alternative) for feedback.",
  "steps": [
    "Add rdkit-js as a dependency and confirm it works in a Vite browser bundle",
    "Create src/components/MoleculeLab.jsx — text input + debounced validation (300ms), calls flavorGnnRuntime.predict(smiles)",
    "Render prediction bars with Tailwind + simple CSS animation when values change",
    "Add a small preset picker (caffeine, vanillin, capsaicin, aspartame, MSG) so first-time users get immediate results",
    "Wire into App.jsx navigation as a new 'Lab' tab (lazy-loaded to avoid pulling rdkit-js into the main bundle)"
  ]
}
```

### Task 29: R5-29 — Uncertainty coloring (prediction entropy as node saturation)

```json
{
  "id": "R5-29",
  "title": "Color nodes by prediction entropy",
  "category": "ml-viz",
  "priority": 4,
  "description": "For every ingredient that has a representative SMILES with GNN predictions, compute entropy = -Σ p*log(p) across the 5 taste channels. High entropy ⇒ model uncertain ⇒ node rendered desaturated/pink-tinted. Low entropy ⇒ confident ⇒ solid saturated color. This lets users see where the network is guessing vs. confident.",
  "steps": [
    "Extend embed_ingredients.py to also emit per-ingredient prediction probabilities + entropy to public/proDataset/gnn_entropy.json",
    "Modify src/utils/color.js to accept an entropy value and desaturate/shift the base color (lerp toward gray or toward a 'uncertainty pink')",
    "Wire into NodeMesh.js color assignment path — read entropy from node and apply the shift",
    "Add a legend blurb explaining uncertainty coloring (goes in Legend.jsx)",
    "Sanity-check: nodes with lots of ground-truth labels (ChemTasteDB/BitterDB matches) should have low entropy; FooDB-only compounds should have higher entropy"
  ]
}
```

### Task 30: R5-30 — Training-progress visualization (stream loss + ingredient re-embedding)

```json
{
  "id": "R5-30",
  "title": "Training tab showing loss curve + live re-embedding",
  "category": "ml-viz",
  "priority": 5,
  "description": "Retrain the M3 multi-task GNN while periodically snapshotting (every 2 epochs) both the loss value and the 2D PCA projection of 30 representative compounds' embeddings. Save all snapshots to artifacts/m3_training_trace.json. The app reads that file and plays back the trajectory: loss curve animates left-to-right while compound dots migrate across a 2D view, converging toward their true taste clusters. This is the clearest visual 'this is a neural network' signal.",
  "steps": [
    "Modify src/train/train_multitask.py to add a --trace flag that dumps per-epoch { loss, val_f1_per_task, embeddings_30: {<smiles>: [x,y]} } to artifacts/m3_training_trace.json",
    "Choose the 30 compounds: 6 per taste class, selected as the most-central positives (pick medoids via simple mean distance on Morgan fingerprints)",
    "Retrain with --trace and verify the trace file covers all 40 epochs",
    "Copy the trace to public/models/training_trace.json",
    "Add src/components/TrainingProgress.jsx — reads trace, uses recharts (already in deps?) or a hand-rolled SVG for the loss curve, uses Canvas 2D for the migrating dots. Play control: play/pause/speed",
    "Mount under a new 'Training' sub-tab inside the Lab area (same tab as R5-28's MoleculeLab). Lazy-load both."
  ]
}
```

---

## Round 6 — Brainstormed follow-ups (2026-04-15)

Not scheduled for execution yet. These are concrete solutions to the five open
problems identified after Round 5. Each task is scoped and ready for the
interactive bridge on a future run.

### Task 31: R6-31 — Coverage: Node2Vec positions on proData edges + synonym dictionary

```json
{
  "id": "R6-31",
  "title": "Node2Vec positions for full proDataset coverage",
  "category": "ml-viz",
  "priority": 1,
  "description": "Replace the 216/3913 GNN-overlay with a two-layer layout: (1) Node2Vec embedding on proDataset's pairing graph covers all 3913 ingredients, (2) GNN-derived positions attract the 216 matches so GNN-labeled nodes act as anchors for their recipe neighbors. Bonus: curate 50-100 synonyms (scallion→green onion, cilantro→coriander) to raise direct matches to ~400.",
  "steps": [
    "pip install node2vec. Build edge list from proDataset/pairings.json (weight = strength)",
    "Fit Node2Vec(d=64, walks=20, p=1, q=1). Reduce to 3D with UMAP",
    "Blend: for each ingredient, position = 0.7 * node2vec_pos + 0.3 * gnn_pos (when gnn_pos exists)",
    "Create chemDataset/data/ingredient_synonyms.json and thread through build_compounds / embed_ingredients",
    "Target: >3500/3913 ingredients (>90%) have some structured position (node2vec or gnn-blended)"
  ]
}
```

### Task 32: R6-32 — Bias fix: real negatives + distribution shift

```json
{
  "id": "R6-32",
  "title": "Debiased training via FlavorDB negatives + logit shift",
  "category": "ml",
  "priority": 2,
  "description": "Two fixes stacked: (a) mine FlavorDB molecules WITHOUT each taste token as soft negatives for that task (adds ~20k rows of y=0 signal); (b) apply a logit shift at inference so prediction rates match an expected prior. Expected: umami F1 rises from 0.18 toward 0.45, bitter prediction rate drops from 17% to 5%.",
  "steps": [
    "Extend src/data/build_compounds.py: for each molecule in FlavorDB with a flavor_profile, emit y=0 for tastes not listed (currently only y=1 positives are added)",
    "Retrain M3 with the new compounds.parquet, log before/after class balance",
    "Add src/infer/calibrate.py: compute train_prior from the parquet, accept a target_prior per task, output a logit shift vector",
    "Bake the shift into score_all.py and preset_predictions.py",
    "Validate on the 10 preset molecules — caffeine should stay >0.9 bitter; MSG should stay ~1.0 umami"
  ]
}
```

### Task 33: R6-33 — Real per-layer activations in MessagePassingDiagram

```json
{
  "id": "R6-33",
  "title": "Real GNN activations replace schematic diagram",
  "category": "ml-viz",
  "priority": 3,
  "description": "Two-stage delivery: (a) re-export M3 ONNX with intermediate layer outputs named layer1/layer2/layer3/pool/logits; (b) for each of the 10 presets, precompute per-layer activation dumps and play them back in MessagePassingDiagram. Shows real data flowing through the network rather than abstract circles.",
  "steps": [
    "Modify flavor-gnn/src/export/to_onnx.py to register intermediate outputs at each GINEConv layer",
    "Write flavor-gnn/src/infer/preset_activations.py: run each preset SMILES through the extended model, save {preset_name: {layer_k: [atom_activations]}} to public/models/preset_activations.json",
    "Update MessagePassingDiagram.jsx: swap the schematic atoms for real atom positions (pull from a simple rdkit-js 2D depiction) and color circles by actual activation magnitude",
    "Animate through layers at 500ms intervals with the real per-atom values"
  ]
}
```

### Task 34: R6-34 — Arbitrary SMILES input for Molecule Lab

```json
{
  "id": "R6-34",
  "title": "rdkit-js + onnxruntime-web for live SMILES prediction",
  "category": "ml-viz",
  "priority": 4,
  "description": "Add a SMILES text field to MoleculeLab that runs live inference on arbitrary input. rdkit-js parses/validates the SMILES and generates atom/bond features; onnxruntime-web runs the M3 ONNX model (already exported). Fallback: if rdkit-js bundle fails to load, degrade to a Python /api/predict endpoint called from the UI.",
  "steps": [
    "npm install @rdkit/rdkit (WASM build). Verify it loads in a Vite-built bundle without SSR issues",
    "Write src/ml/flavorGnnRuntime.js: loadModel() once, predict(smiles) -> {taste probs}",
    "Extend MoleculeLab: SMILES input + debounced validate + live prediction bars. Reuse MessagePassingDiagram for feedback",
    "Handle errors gracefully — invalid SMILES, atoms outside the training featurizer vocab (report 'out of domain')",
    "Bundle budget: lazy-load rdkit-js only when the user opens Molecule Lab, target <6MB gzip addition"
  ]
}
```

### Task 35: R6-35 — GNN-powered recipe compatibility scoring

```json
{
  "id": "R6-35",
  "title": "Recipe scoring using GNN taste predictions",
  "category": "feature",
  "priority": 5,
  "description": "Finally close the loop: when users build a multi-ingredient selection, score compatibility using predicted taste profiles instead of (or alongside) raw pairing edge strength. Specifically: the score rewards complementary taste profiles (sweet + sour + salty = well-balanced) and penalizes monotone combinations (5 bitter ingredients).",
  "steps": [
    "Compute per-ingredient taste vectors from proDataset/gnn_entropy.json probs (fall back to node.taste string for unmatched ingredients)",
    "Write src/data/recipeScoring.js: takes a list of ingredient names, aggregates their 5-D taste vectors, returns a 'balance' score (low variance = balanced, plus a 'coverage' term for number of tastes >0.3)",
    "Wire into the existing CocktailLab / SauceLab / RecipeLab — add a 'GNN balance' widget next to the current pairing score",
    "A/B visible only via the Molecule Lab's settings for now — ship invisible by default, validate the scoring feels right before surfacing",
    "Document in README that recipe scoring is experimental and depends on the ML pipeline"
  ]
}
```

### Task 36: R6-36 — Mobile particle/bloom performance pass

```json
{
  "id": "R6-36",
  "title": "ParticleSystem + bloom mobile performance",
  "category": "performance",
  "priority": 6,
  "description": "Particles still render full-intensity on mobile; bloom post-processing drags A-series iPhones to <20 FPS. Target 30 FPS on iPhone 12 baseline.",
  "steps": [
    "Profile the main-thread frame with Safari remote devtools on a real iPhone 12 LTE + WiFi",
    "ParticleSystem: drop to 1 particle per edge on mobile, raise strength threshold to 0.6, clamp per-frame update budget to 2ms",
    "Bloom: disable on devices with navigator.deviceMemory < 4 OR userAgent mobile AND viewport width < 900",
    "Add window.fn.forceMobileQuality localStorage override for testing",
    "Re-run simulation cocktail-builder spec — target FPS > 25"
  ]
}
```

### Task 37: R6-37 — Accessibility baseline (keyboard + ARIA)

```json
{
  "id": "R6-37",
  "title": "Keyboard navigation + ARIA labels",
  "category": "accessibility",
  "priority": 7,
  "description": "Currently no keyboard nav, no screen-reader labels, and selectable nodes aren't discoverable without mouse. Ship a baseline: tab reaches all interactive controls, arrow keys cycle through focused ingredient's pairings, Enter selects, Escape deselects.",
  "steps": [
    "Audit SearchBar, Controls, Legend, IngredientPanel, Lab tabs for tabIndex and aria-label",
    "Add a keyboard listener in NetworkScene: tab cycles focus through the top-N pairing-count nodes, Enter selects",
    "aria-live region that announces the selected ingredient and its top 3 pairings",
    "Focus outline (2px cyan) on focused nodes — hook into NodeMesh",
    "Target: Lighthouse accessibility score ≥ 90"
  ]
}
```

### Task 38: R6-38 — Molecule of the Day

```json
{
  "id": "R6-38",
  "title": "Molecule of the Day landing card",
  "category": "feature",
  "priority": 8,
  "description": "On app load, pick a stable-per-day random preset, show a dismissible card at the top of the Network view with the molecule name, predicted taste, and a one-line intuition. Gives returning users a reason to come back and new users a narrative hook.",
  "steps": [
    "Seed a PRNG with new Date().toISOString().slice(0, 10) so the pick is stable within a calendar day",
    "Add src/components/MoleculeOfTheDay.jsx — reads preset_predictions.json, renders a small card with taste bars",
    "Mount it as an overlay in App.jsx; dismissible via localStorage flag (remembers for 24h)",
    "On click, open Molecule Lab with that preset pre-selected"
  ]
}
```

### Task 39: R6-39 — Side-by-side molecule comparison

```json
{
  "id": "R6-39",
  "title": "Compare two molecules in Molecule Lab",
  "category": "feature",
  "priority": 9,
  "description": "Add a comparison mode to Molecule Lab: select two presets (or SMILES after R6-34) and see their taste bars side-by-side with diffs highlighted. Demonstrates the GNN distinguishing structural isomers and near-variants (aspartame vs neotame, caffeine vs theobromine).",
  "steps": [
    "Extend MoleculeLab with a 'Compare' toggle; swap the single-column prediction layout for a two-column side-by-side",
    "Add preset pairs with an 'interesting contrast' flag: (caffeine, theobromine), (aspartame, stevioside), (glucose, fructose), (citric acid, malic acid)",
    "Highlight per-taste diffs with color + magnitude indicator",
    "Share-link support — URL query params encode the two selected molecule names"
  ]
}
```

---

---

## Round 7 — Network tab multi-select + labeling UX (2026-04-16)

### Task 40: R7-40 — Hover/touch tooltip showing ingredient name

```json
{
  "id": "R7-40",
  "title": "Hover tooltip with ingredient name",
  "category": "ux",
  "priority": 1,
  "description": "Show a floating label when hovering over a node (mouse) or long-pressing (iOS touch). Uses the existing onNodeHover callback from SceneManager. Renders a positioned div overlay on NetworkScene."
}
```

### Task 41: R7-41 — Always show labels on selected nodes

```json
{
  "id": "R7-41",
  "title": "Always label selected nodes",
  "category": "ux",
  "priority": 2,
  "description": "Ensure showNodeLabels is always true when any node is selected. Labels should persist as user adds more selections, not just flash on click."
}
```

### Task 42: R7-42 — Click Top Pairings to highlight + label on network

```json
{
  "id": "R7-42",
  "title": "Top Pairings click to highlight/label on network",
  "category": "ux",
  "priority": 3,
  "description": "In IngredientPanel: (a) clicking an individual pairing ingredient adds it to selectedNodes; (b) clicking the 'Top Pairings' heading highlights and labels ALL top pairings on the 3D network via labelNodeNames."
}
```

### Task 43: R7-43 — Multi-select common pairings + taste radar

```json
{
  "id": "R7-43",
  "title": "Common pairings filter + taste radar for multi-select",
  "category": "ux",
  "priority": 4,
  "description": "When 2+ ingredients are selected, compute their shared pairings (ingredients paired with ALL selected), show in IngredientPanel as a 'Common Pairings' section, and display a taste radar chart summarizing the combined taste profile."
}
```

---

## Round 8 — Information Architecture + Training Improvements (2026-04-16)

### IA improvements: collapse features into the natural flow

### Task 44: R8-44 — Molecular Profile card inline in IngredientPanel

```json
{
  "id": "R8-44",
  "title": "Molecular Profile card in IngredientPanel",
  "category": "ia",
  "priority": 1,
  "description": "Move GNN taste prediction bars from the separate Molecule Lab tab into IngredientPanel as a 'Molecular Profile' collapsible section. When an ingredient has GNN predictions (via gnn_entropy.json), show the 5 taste bars inline. Falls back gracefully to just showing the taste string when no GNN data exists. This makes the GNN visible in the natural ingredient-discovery flow."
}
```

### Task 45: R8-45 — Balance score + taste gap suggestion in multi-select

```json
{
  "id": "R8-45",
  "title": "Balance score and taste gap suggestion",
  "category": "ia",
  "priority": 2,
  "description": "When 2+ ingredients are selected, show a balance score (from recipeScoring.js) with a human-readable verdict and a taste-gap suggestion: 'Your selection is 60% sweet — try adding something umami like parmesan.' Uses GNN probs when available, falls back to taste strings."
}
```

### Task 46: R8-46 — 'Build a recipe' button carries selection into Recipe Lab

```json
{
  "id": "R8-46",
  "title": "Build a recipe carries selection",
  "category": "ia",
  "priority": 3,
  "description": "Add a 'Build a recipe →' button at the bottom of IngredientPanel. Clicking it switches to Recipe Lab with all currently-selected ingredients pre-loaded. No more re-selecting when switching tabs."
}
```

### Task 47: R8-47 — Absorb Flavor Bridge into multi-select flow

```json
{
  "id": "R8-47",
  "title": "Flavor Bridge as auto-path in multi-select",
  "category": "ia",
  "priority": 4,
  "description": "When exactly 2 ingredients are selected, auto-compute the strongest path between them (using FlavorBridge's findStrongestPath) and show it as a 'Flavor Path' card in IngredientPanel. Remove Flavor Bridge from the Explore dropdown — it's now contextual."
}
```

### Task 48: R8-48 — Collapse Network Insights into Legend area

```json
{
  "id": "R8-48",
  "title": "Network Insights as legend stat cards",
  "category": "ia",
  "priority": 5,
  "description": "Move the 5 GlobalInsights computations into small stat cards below the Legend. Always visible, no dropdown needed. Remove 'Network Insights' from the Explore dropdown."
}
```

### Task 49: R8-49 — Training Trace becomes onboarding 'How it works' modal

```json
{
  "id": "R8-49",
  "title": "Training Trace as onboarding modal",
  "category": "ia",
  "priority": 6,
  "description": "Replace the Training Trace tab with a '?' button that opens a modal showing a condensed 10-second autoplay of the training animation + a brief explanation. Accessible anytime but not a primary navigation destination. Remove 'Training Trace' from Labs dropdown."
}
```

### Task 50: R8-50 — Simplify navigation to Search | Filter | Build | Profile

```json
{
  "id": "R8-50",
  "title": "Simplify top nav to 4 actions",
  "category": "ia",
  "priority": 7,
  "description": "Replace the current 'Network | Labs (5) | Explore (3) | Profile' with 'Search | Filter | Build | Profile'. Search focuses the search bar. Filter opens taste/cuisine/tree filter overlay. Build opens the unified recipe builder (Recipe Lab with mode selector for Recipe/Cocktail/Sauce). Profile unchanged. Molecule Lab and Training Trace absorbed into other surfaces per R8-44 and R8-49."
}
```

### Training improvements

### Task 51: R8-51 — Mine FlavorDB for real negatives

```json
{
  "id": "R8-51",
  "title": "FlavorDB real negatives in build_compounds",
  "category": "ml",
  "priority": 8,
  "description": "Extend build_compounds.py: for each FlavorDB molecule with a non-empty flavor_profile, emit y=0 for tastes NOT listed. A molecule tagged 'fruity,floral' without 'bitter' → bitter=0 (soft negative). Retrain M3 and compare calibration curves before/after."
}
```

### Task 52: R8-52 — Add odor prediction head

```json
{
  "id": "R8-52",
  "title": "Odor classification head on M3",
  "category": "ml",
  "priority": 9,
  "description": "Add a 6th head to the multi-task model: odor_class from FlavorDB's odor descriptors (fruity, woody, floral, herbal, spicy, chemical — top-6 categories). This makes the model predict flavor, not just taste. Retrain with the expanded label set."
}
```

### Task 53: R8-53 — Integrate BitterSweet published balanced dataset

```json
{
  "id": "R8-53",
  "title": "BitterSweet dataset integration",
  "category": "ml",
  "priority": 10,
  "description": "Download BitterSweet (Tuwani et al. 2019) balanced bitter/sweet dataset. Merge into build_compounds.py. Adds ~2-3k properly balanced rows with real negatives. Retrain and report per-task F1 improvement."
}
```

### Task 54: R8-54 — 5-fold cross-validation + calibration curves

```json
{
  "id": "R8-54",
  "title": "Proper evaluation with CV and calibration",
  "category": "ml",
  "priority": 11,
  "description": "Replace single 80/20 split with 5-fold stratified CV. Report mean±std F1 per task. Add calibration curve plots (predicted probability vs actual frequency) to artifacts/. If variance >10% F1, flag as data-limited."
}
```

---

## Round 9 — Fix plan (2026-04-17)

### Task 55: R9-55 — Cluster labels for ML network views

```json
{
  "id": "R9-55",
  "title": "Categorical cluster labels for 3D and 2D ML views",
  "category": "viz",
  "priority": 1,
  "description": "The ML views need discovered cluster labels rendered in the same style as the taste axis labels (floating 3D sprites in 3D mode, edge-positioned text in 2D mode). Use k-means (k=8-12) on the Node2Vec embeddings to find clusters, then auto-label each cluster by the dominant category/cuisine/taste of its members (e.g., 'Baking', 'Asian Aromatics', 'Mediterranean Herbs'). Labels positioned at cluster centroids in 3D; at convex hull edges in 2D.",
  "steps": [
    "Run k-means(k=10) on the 64-dim Node2Vec embeddings in a new script flavor-gnn/src/infer/cluster_labels.py",
    "For each cluster, compute: dominant category, dominant cuisine, dominant taste, top 5 ingredients by pairing count",
    "Auto-generate a 1-2 word label per cluster from the dominant features (e.g., cluster with 80% dairy + baking → 'Baking & Dairy')",
    "Output public/proDataset/cluster_labels.json: { clusters: [ {id, label, centroid_3d: [x,y,z], centroid_2d: [x,y], color, top_ingredients} ] }",
    "In LivingArchView: load cluster_labels.json, render as THREE.Sprite labels at centroids (same style as taste labels) when in ml/ml2d mode",
    "For 2D mode: position labels at cluster centroid x,z coordinates with y=2",
    "Labels should fade in/out during mode transitions just like taste labels do"
  ]
}
```

### Task 56: R9-56 — Molecular explanation linked to ingredients and clusters

```json
{
  "id": "R9-56",
  "title": "Contextual molecular explanation in layman terms",
  "category": "ia",
  "priority": 2,
  "description": "Redesign how molecular info is presented. Instead of abstract compound names + SMILES, explain WHY ingredients are positioned where they are using shared molecular patterns. Replace 'Molecular Profile' with 'Why this is here' — a plain-English explanation linking the ingredient's chemistry to its cluster neighbors. Replace Molecule of the Day with 'Shared Molecular Patterns' — an interactive feature that shows what compounds two nearby clusters have in common.",
  "steps": [
    "Write flavor-gnn/src/infer/explain_clusters.py: for each cluster pair that's adjacent in the layout, find shared compounds (FooDB compound overlap via Jaccard), emit plain-English explanations like 'Mediterranean Herbs and Citrus share linalool (floral) and limonene (citrus) — that's why lemon works with basil'",
    "Output public/proDataset/cluster_explanations.json with per-cluster and per-pair explanations",
    "Rewrite IngredientPanel 'Why it tastes this way' section: lead with the cluster membership ('This ingredient is in the Baking & Dairy cluster'), explain position via shared molecules with nearest neighbors ('Butter is near vanilla because they share diacetyl, which creates a rich creamy flavor')",
    "Replace MoleculeOfTheDay with a 'Discover Patterns' card that shows a random cluster-pair molecular overlap with ingredients from both sides",
    "Add an interactive mode: click two clusters on the network to see their molecular overlap explained",
    "Use recipeScoring.js taste balance in the explanation when relevant ('This cluster tends toward sweet + fatty — pairing with something from the Citrus cluster adds sour balance')"
  ]
}
```

### Task 57: R9-57 — Remove Training Trace

```json
{
  "id": "R9-57",
  "title": "Remove Training Trace tab and component",
  "category": "cleanup",
  "priority": 3,
  "description": "Remove the Training Trace feature — it served as a demo during development but doesn't fit the production app. Remove the tab from Labs dropdown, the lazy import, the component file, and the public/models/training_trace.json data file.",
  "steps": [
    "Remove TrainingProgress lazy import from App.jsx",
    "Remove 'training' from Labs dropdown menu items",
    "Remove trainingMounted state and the TrainingProgress mount block",
    "Delete src/components/TrainingProgress.jsx",
    "Delete public/models/training_trace.json",
    "Remove 'Training Trace' from MobileTabBar if referenced"
  ]
}
```

### Task 58.5: R9-58B — Interactive Molecule Lab (PhET-inspired)

```json
{
  "id": "R9-58B",
  "title": "Interactive molecular viewer for Molecule Lab",
  "category": "viz",
  "priority": 4,
  "description": "Redesign Molecule Lab from a static preset picker into an interactive molecular experience inspired by PhET (phet.colorado.edu/en/simulations/build-a-molecule and molecule-shapes). Core idea: when a user selects an ingredient, show its key flavor compound as a rotatable 3D ball-and-stick model where atoms are colored by element and functional groups are highlighted with taste/odor annotations. Users can rotate the molecule, tap atoms to see their role, and see how molecular shape creates flavor. For presets, show the molecule and explain 'this bond arrangement is why caffeine tastes bitter — the nitrogen ring activates bitter receptors.' Uses Three.js for 3D rendering (already in deps) with atom coordinates derived from SMILES via a simple 2D→3D coordinate generator or precomputed.",
  "steps": [
    "Precompute 3D atom coordinates for the 10 presets using RDKit's AllChem.EmbedMolecule (Python side). Output public/models/preset_molecules.json with {name, atoms: [{element, x, y, z}], bonds: [{from, to, order}], functional_groups: [{atoms: [idx], label, taste_relevance}]}",
    "Create src/components/MoleculeViewer3D.jsx — Three.js scene with: spheres for atoms (colored by element: C=gray, N=blue, O=red, S=yellow, H=white), cylinders for bonds, OrbitControls for rotation",
    "Add tap/hover on atoms: show tooltip with element name + any functional group membership ('This nitrogen is part of a purine ring — common in bitter alkaloids')",
    "Highlight functional groups: when user taps a group annotation, pulse-glow those atoms and show the taste/odor connection",
    "Integrate into MoleculeLab: replace the static SMILES code display with the interactive 3D viewer. Keep the taste/odor bars alongside",
    "For ingredients (not just presets): show the top compound's 3D structure when the user clicks 'See molecule' in the ingredient panel's 'Why it tastes this way' section"
  ]
}
```

### Task 59: R9-59 — Training data expansion plan + implementation

```json
{
  "id": "R9-58",
  "title": "Expand training data for better model quality",
  "category": "ml",
  "priority": 4,
  "description": "Systematically increase the training set from 4,176 to 10,000+ compounds. Three sources: (1) FlavorDB full molecule scrape — the current scraper only fetches per-entity molecules (1,788); scraping the molecule endpoint directly could yield 25k+. (2) FlavorNet (flavornet.org) — 738 aroma compounds with odor descriptors, freely downloadable. (3) Leffingwell PMP — published list of 3,500+ aroma chemicals with CAS numbers (convertible to SMILES via PubChem API). Each new source adds both positives AND negatives for the odor heads, directly addressing the sparse-label problem.",
  "steps": [
    "Write chemDataset/scripts/06-fetch-flavornet.js: scrape flavornet.org compound list (738 rows, CAS + odor descriptor). Map odor descriptors to our 6 odor categories",
    "Write chemDataset/scripts/07-fetch-pubchem-smiles.js: given a list of CAS numbers, batch-query PubChem API for canonical SMILES. Use for FlavorNet + any CAS-only sources",
    "Extend 02-fetch-flavordb.js: add a molecule-index endpoint scrape (/flavordb2/molecules?page=N) to capture molecules not linked to any entity. This could add 5-10k molecules beyond the 1,788 entity-linked ones",
    "Update build_compounds.py to incorporate FlavorNet data",
    "Retrain M3 with expanded dataset, report before/after CV metrics",
    "Regenerate all downstream artifacts (positions, entropy, presets, compound info)"
  ]
}
```

## Round 6 scope confirmations (2026-04-15)

- R6-33: user chose option **D** — full browser inference via rdkit-js + onnxruntime-web for per-layer activations.
- R6-34: user chose option **C** — hybrid: rdkit-js parses/validates in the browser, Python API endpoint runs inference.
