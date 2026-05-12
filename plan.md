# plan.md — Flavor Affinity Mode (α-mode) + Cluster Relabel

Implementation queue derived from `.omc/plans/ralplan-flavor-affinity-mode.md`
(consensus-approved iteration 4, U1 + U4a user decisions resolved).

Tasks ordered by phase. Phase 0.5 (calibration) → Phase 2.1 (pure
math) → Phase 2.2 (data hookup) → Phase 2.3-2.8 (3D wiring) → Phase 3
(mobile β-mode) → Phase 1 (cluster relabel, deferred — needs LLM
wiring investigation).

---

### Task 1: Phase 0.5 — Quantile threshold calibration

```json
{
  "id": "R13-1",
  "title": "Phase 0.5 — affinityThresholds.js + Vitest",
  "category": "feature",
  "priority": 1,
  "description": "Pure-JS helper that computes ★★★/★★/★ strength thresholds from actual pairing distribution at session start. Replaces spec's literal 0.7/0.4/0.2 with data quantiles per User Decision U1.",
  "steps": [
    "Create src/data/affinityThresholds.js exporting `computeAffinityThresholds(edges)` that returns {star3, star2, star1} at top-1%/top-10%/top-50% quantiles.",
    "Handle edge cases: empty edges array, fewer than ~100 edges, identical strengths.",
    "Create src/data/__tests__/affinityThresholds.test.js with Vitest coverage: happy path, empty array, short array, all-identical strengths, strength sort ordering verification.",
    "Run: npx vitest run src/data/affinityThresholds.test.js — all tests pass."
  ],
  "passes": true
}
```

### Task 2: Phase 2.1 — affinityTiers.js pure math + tests

```json
{
  "id": "R13-2",
  "title": "Phase 2.1 — affinityTiers.js + Vitest",
  "category": "feature",
  "priority": 2,
  "description": "Pure tier math: tierFor(a,b,ctx) returns native tier (3/2/1/null) based on bridge_compounds.json + GNN top5 + quantile thresholds. topAffinities(focal,ctx) returns 30 ranked candidates assigned to rings by strength rank (U4a — edge color reflects native tier).",
  "steps": [
    "Create src/data/affinityTiers.js exporting tierFor(a,b,ctx) and topAffinities(focal,ctx,opts).",
    "tierFor: strict branch (both have GNN top5) requires bridge_compounds.json[a|b].bridges[0].name to appear in BOTH top5 for ★★★. Lenient branch (≥1 side missing GNN) skips bridge check.",
    "topAffinities: collect candidates with non-null tier, sort by strength descending, slice into rings [0:5]/[5:15]/[15:30]. Each result carries its ringIdx + native tier (so edge color is correctly assigned at draw time).",
    "Create src/data/__tests__/affinityTiers.test.js with Vitest coverage:",
    "  - tierFor 4 cases: both-have-GNN (strict), a-has (lenient), b-has (lenient), neither (lenient)",
    "  - tierFor with verified ★★★ pair (peel + tangerine juice, bridge=(2E,4E)-deca-2,4-dienal)",
    "  - tierFor with verified ★★ pair (tomato + basil — no bridge_compounds entry, falls through)",
    "  - tierFor empty bridgeCompoundIndex → lenient",
    "  - topAffinities returns ≤30 elements partitioned 5/10/15",
    "  - topAffinities ringIdx == strength rank, NOT tier (U4a contract)",
    "Run: npx vitest run src/data/affinityTiers.test.js — all tests pass."
  ],
  "passes": true
}
```

### Task 3: Phase 2.2 — useProData hookup

```json
{
  "id": "R13-3",
  "title": "Phase 2.2 — useProData hookup",
  "category": "feature",
  "priority": 3,
  "description": "Build O(1) lookup maps in useProData for tier computation: pairingStrength, top5, bridgeCompoundIndex, affinityThresholds. Pass through setData.",
  "steps": [
    "Open src/hooks/useProData.js. After all dataset fetches succeed, before line ~399 setData call, build:",
    "  - pairingStrength: Map<\"a|b\", number> from pairs array, both directions ('a|b' AND 'b|a')",
    "  - top5: Map<ingredientName, string[]> sliced from node.gnnCompounds.top_compounds[].name",
    "  - bridgeCompoundIndex: Map<\"a|b\", entry> from bridgeCompounds (skip _meta key)",
    "  - affinityThresholds: result of computeAffinityThresholds(pairs)",
    "Pass through setData: setData({...existing, pairingStrength, top5, bridgeCompoundIndex, affinityThresholds}).",
    "Verify: npm run dev — no console errors, app loads normally."
  ],
  "passes": true
}
```

### Task 4: Phase 2.3 — AffinityMode controller class

```json
{
  "id": "R13-4",
  "title": "Phase 2.3 — AffinityMode controller",
  "category": "feature",
  "priority": 4,
  "description": "Three.js scene controller managing α-mode visual layer: 30-instance affinity InstancedMesh, edge LineSegments, ring math, fade animation, color-write contract. Owns engage/pivot/exit/suspend/resume/dispose.",
  "steps": [
    "Create src/three/AffinityMode.js (~320 lines).",
    "Constructor: new AffinityMode(stateRef, affinityCtx). stateRef is the LivingArchView stateRef.current handoff object.",
    "Public API: engage(focal), pivot(newFocal), exit({immediate}), suspend(), resume(), tickAnimation(deltaSec), dispose(), get engaged().",
    "Internal state: affinityMesh (InstancedMesh, count=30), edgeGeo (BufferGeometry, 60 vertices), edgeMaterial (LineBasicMaterial, vertexColors), currentFocal, fadeProgress, savedSelectionMask.",
    "Ring math: RADII={3:12, 2:22, 1:35}; PHI=Math.PI*(3-Math.sqrt(5)); placeOnRing(ringIdx, slotIdx) returns Vector3.",
    "engage(focal): performance.mark('alpha-engage-start'); compute topAffinities(focal); place affinity sphere positions; write edge buffer with tier-color (gold/silver/bronze/dim-gray); snapshot mesh.instanceColor; dim non-affinity instances; updateClusterLabelOpacity (ghost mode); request camera flyToPoint; performance.mark('alpha-engage-end'); console.warn if measure.duration > 200.",
    "pivot(newFocal): re-write dimColor to ALL non-affinity instances; re-place affinity spheres; update edges; mesh.instanceColor.needsUpdate=true.",
    "exit({immediate}): re-stamp defaultColors[i] (or clusterColors[i] per mode) onto mesh; updateClusterLabelOpacity (post-α); restore clusterLabelGroup.visible per current mode (true if 'ml'/'ml2d', false otherwise); reset edge buffer; clear currentFocal; engaged=false.",
    "tickAnimation: lerp fadeProgress for cluster-ghost fade-in/out smoothness.",
    "dispose: edgeGeo.dispose(); edgeMaterial.dispose(); scene.remove(affinityMesh); affinityMesh.dispose().",
    "Edge colors: ★★★=#facc15 op0.9, ★★=#a3a3a3 op0.7, ★=#a16207 op0.5, untiered=#444 op0.3."
  ],
  "passes": true
}
```

### Task 5: Phase 2.4 — LivingArchView wiring

```json
{
  "id": "R13-5",
  "title": "Phase 2.4 — LivingArchView wiring",
  "category": "feature",
  "priority": 5,
  "description": "Wire AffinityMode into LivingArchView: ref declaration, instantiation after stateRef build, dispose at cleanup, animation tick, selection-change effect, engage-guards on 6 mutators, opacity authority helper, mode-transition exit.",
  "steps": [
    "Open src/components/LivingArchView.jsx (1637 lines).",
    "Declare affinityModeRef = useRef(null) alongside refs at lines 63-66.",
    "After stateRef.current = {...} is built (around line 1128), instantiate: affinityModeRef.current = new AffinityMode(stateRef.current, {pairingStrength, top5, bridgeCompoundIndex, affinityThresholds, graph: data.graph});",
    "In cleanup (line ~1141), call affinityModeRef.current?.dispose() before existing cleanup.",
    "In animate function (line ~1033), add affinityModeRef.current?.tickAnimation(delta) alongside other per-frame updates.",
    "Add NEW useEffect keyed [selectedNodes, isMobile, affinityEnabled] after line 1563. If !affinityEnabled || isMobile: skip. If selectedNodes.length === 0: exit. If length === 1: engage or pivot. If length >= 2: suspend.",
    "Add `if (affinityModeRef.current?.engaged) return;` early-return guards at top of effects: 1169 (selection tint), 1371 (taste filter), 1389 (tree filter), 1440 (bridge path), 1503 (per-mode color), 1526 (cluster focus).",
    "Add updateClusterLabelOpacity(state) helper that reads affinityModeRef.engaged + focusedClusterIdRef.current + mode and computes target opacity (α-mode 0.45 > focused 0.95/0.22 > default 0.95). Route the focus useEffect's existing opacity writes (lines 1549-1554) through this helper.",
    "Modify handleModeSwitch (line 1573): call affinityModeRef.current?.exit({immediate:true}) BEFORE stateRef.current.triggerTransition(target).",
    "Cluster fly-to handler (line 1257-1310): if affinityModeRef.current?.engaged, call exit({immediate:true}) before flyToTarget dispatch.",
    "Verify: npm run dev — no console errors, default scene works."
  ],
  "passes": true
}
```

### Task 6: Phase 2.5 — App.jsx kill-switch + Escape

```json
{
  "id": "R13-6",
  "title": "Phase 2.5 — App.jsx kill-switch + Escape",
  "category": "feature",
  "priority": 6,
  "description": "Add ?affinity=v0 URL kill-switch and forward Escape from App.jsx to AffinityMode.exit. Scopes kill-switch to α/β-mode only — Phase 1 cluster relabel ships unconditionally.",
  "steps": [
    "Open src/App.jsx. Add at top of App component: const affinityEnabled = useMemo(() => new URLSearchParams(window.location.search).get('affinity') !== 'v0', []);",
    "Pass affinityEnabled prop to LivingArchView (already accepts isMobile; add this alongside).",
    "Modify Escape handler at line 309-315: BEFORE setSelectedNodes([]), call onAffinityExit() prop callback (forwarded from LivingArchView via ref).",
    "Add onAffinityExit prop to LivingArchView; LivingArchView wires it to affinityModeRef.current?.exit({immediate:true}).",
    "Test: localhost:5173?affinity=v0 — clicking ingredient does NOT engage α-mode (existing single-select behavior preserved)."
  ],
  "passes": true
}
```

### Task 7: Phase 2.6 — Arrow-key α-mode navigation

```json
{
  "id": "R13-7",
  "title": "Phase 2.6 — Arrow-key α-mode navigation",
  "category": "feature",
  "priority": 7,
  "description": "When α-mode engaged, ArrowDown pivots to strongest unvisited ★★★ affinity (native tier 3 only) instead of strongest neighbor. ArrowUp unchanged (history pop).",
  "steps": [
    "Open src/App.jsx, find ArrowDown handler at line 324-339.",
    "Branch on whether α-mode is engaged: when engaged, replace getNeighbors(current) with topAffinities(current, data).filter(a => a.tier === 3) (native ★★★, not ring index).",
    "If filtered list is empty, fall back to ring-2 candidates, then ring-1.",
    "Apply same unvisited-history filter as existing handler.",
    "Verify: select an ingredient, ArrowDown walks to strongest ★★★ neighbor; ArrowUp pops history."
  ],
  "passes": true
}
```

### Task 8: Phase 2.7 — Performance probe + leak test

```json
{
  "id": "R13-8",
  "title": "Phase 2.7 — Performance probe + leak test",
  "category": "test",
  "priority": 8,
  "description": "Verify <200ms engage budget and zero GPU memory growth across 100 pivots. Shipped: src/three/AffinityMode.perf.test.js — 2 tests against a synthetic 3,000-node / 90,000-edge graph. Test 1 asserts engage() < 200ms; test 2 asserts 100 pivots add zero scene children (mesh/edges/labels reused). makeLabel mocked + requestAnimationFrame shimmed for node test env.\n\nManual leak test (run in browser dev tools, α-mode active):\n  const before = JSON.parse(JSON.stringify(renderer.info.memory));\n  // search-pivot 100 different ingredients rapidly\n  const after = JSON.parse(JSON.stringify(renderer.info.memory));\n  // Expect: after.geometries === before.geometries, after.textures - before.textures <= 31 (label canvas textures rebuilt per pivot but disposed on next pivot — should stabilize).",
  "steps": [
    "Add Vitest performance test: mock Three.js scene, mock renderer.info, call engage() and assert performance.measure('alpha-engage').duration < 200.",
    "Document manual leak test in plan: dev tools console: const before = JSON.parse(JSON.stringify(renderer.info.memory)); click 100 ingredients via search rapid-fire; const after = ...; assert delta in geometries+textures == 0.",
    "Run: npx vitest run — all green."
  ],
  "passes": true
}
```

### Task 9: Phase 3 — β-mode mobile AffinityPanel

```json
{
  "id": "R13-9",
  "title": "Phase 3 — β-mode mobile AffinityPanel",
  "category": "feature",
  "priority": 9,
  "description": "Mobile fallback panel (< 640px) with three-column ★★★/★★/★ chip layout. Capture-phase tap-outside dismiss. Shipped: src/components/AffinityPanel.jsx with two render modes — embedded (no onClose, used inline inside the mobile BottomSheet IngredientPanel) and overlay (onClose triggers ESC + capture-phase pointerdown dismiss + X button). App.jsx adds a `mobileAffinities` useMemo gated on `isMobile && affinityEnabled && selectedNodes.length === 1`. AffinityPanel renders only when affinities is non-empty so it stays inert when the kill-switch is on or the focal has no neighbors. 10 Vitest cases cover both render modes.",
  "steps": [
    "Create src/components/AffinityPanel.jsx (~150 lines). Props: {focal, affinities, onPivot, onClose}.",
    "Render three column sections (★★★ / ★★ / ★) with chip count headers. Each chip is a Tailwind-styled button calling onPivot(name).",
    "Close X button. Capture-phase document pointerdown listener: if !panelRef.current?.contains(e.target), call onClose. Register with {capture: true}.",
    "Modify src/App.jsx: mount <AffinityPanel> when isMobile && selectedNodes.length === 1 && affinityEnabled. Compute affinities via topAffinities(focal, ctx).",
    "Vitest snapshot tests for AffinityPanel: chip rendering, chip click, capture-phase outside click, ESC dismisses.",
    "Verify on iOS sim viewport: tap ingredient → panel slides in; tap chip → re-pivots; tap X or outside → dismisses."
  ],
  "passes": true
}
```

### Task 10: Phase 1 — Cluster relabel pipeline (deferred)

```json
{
  "id": "R13-10",
  "title": "Phase 1 — Cluster relabel pipeline",
  "category": "feature",
  "priority": 10,
  "description": "Re-derive cluster labels so they describe what each cluster actually cooks. Shipped via Option B (heuristic, no LLM): cluster_labels.py now reads cuisine_map.json, picks the dominant cuisine via count + 15% presence floor + 1.5 lift floor, rejects generic single-category labels, and falls back to a top-2 ingredient pair. New labels: American / Onion & Tomato / Italian / Mexican / Chinese / Moroccan / Italian (olive) / Honey & Buttermilk / American (baking) / American (sugar). Ships unconditionally (not gated by ?affinity=v0).",
  "steps": [
    "INVESTIGATE FIRST: read flavor-gnn/src/infer/explain_clusters.py to confirm LLM client wiring. Check whether the existing pipeline calls an LLM (Anthropic/OpenAI) or generates labels heuristically.",
    "If LLM wired: extend explain_clusters.py with second prompt for 1-2 word category-style label_v2. Mine top-20 RecipeNLG recipe titles per cluster from proDataset/processed/recipenlg-cooccurrence.json.",
    "If LLM NOT wired: report to user; this task may need API key configuration before proceeding.",
    "Modify flavor-gnn/src/infer/cluster_labels.py: bump top_ingredients emission from 5 → 20 so cluster_labels_v2 has enough signal.",
    "Create flavor-gnn/src/infer/verify_cluster_labels.py: assert ≥7/10 top members semantically match new label_v2 (case-insensitive substring OR sentence-transformer cosine ≥ 0.5). Optional override: read flavor-gnn/data/cluster_labels_override.json. Exit 1 on failure.",
    "Modify src/components/ClusterJoystick.jsx:65 to prefer cl.label_v2.",
    "Modify in-3D cluster sprite creation in LivingArchView.jsx:443-459 to prefer cluster.label_v2.",
    "Run pipeline + verifier; commit JSON diffs only on success."
  ],
  "passes": true
}
```

### Task 11: R19 Phase 1A — Insight chip (filter + pull narrative)

```json
{
  "id": "R19-1",
  "title": "Phase 1A — Insight chip below breadcrumb",
  "category": "feature",
  "priority": 11,
  "description": "Single-line floating chip surfaced below the FilterBreadcrumb, narrating what the current (filterStack, pullStrength, visibleCount) layout means. Pure derived state — no LLM, no new data. Sentence templates rotate by pull range: 0-30% (cooccurrence-dominant), 30-70% (tension), 70-100% (bucket-dominant). Multi-filter case surfaces intersection cardinality + densest bucket. Brainstorm: .omc/drafts/r19-narrative-insights-brainstorm.md (Tier A).",
  "steps": [
    "Create src/components/InsightChip.jsx (~80 lines). Props: {filterStack, pullStrength, visibleCount, morphAxis, bucketCounts}.",
    "Sentence templates: (a) filter on + pull<0.30 → 'Layout shows cooccurrence pairings within {axis} buckets. {bucketCount} buckets, {visibleCount} ingredients.' (b) filter on + 0.30≤pull≤0.70 → 'Tension layout — strong pairings resist the pull.' (c) filter on + pull>0.70 → 'Layout shows {axis} bucket structure. Largest: {topBucket} ({topCount}).' (d) multi-filter → '{visibleCount} ingredients match {f1} × {f2} × ...'.",
    "Compute bucketCounts in App.jsx via useMemo on (morphAxis, bucketOfMap). Pass to InsightChip.",
    "Mount InsightChip below FilterBreadcrumb in App.jsx. Hidden when filterStack is empty.",
    "Tailwind styling matches existing FilterBreadcrumb chip aesthetic — small, semi-transparent, cyan accent.",
    "Vitest in src/components/__tests__/InsightChip.test.jsx: render with each template branch and snapshot the rendered text."
  ],
  "passes": true
}
```

### Task 12: R19 Phase 1B — Pull-thumb annotation

```json
{
  "id": "R19-2",
  "title": "Phase 1B — Pull-slider thumb annotation",
  "category": "feature",
  "priority": 12,
  "description": "Static label above the pull slider thumb that maps the current percentage to plain-language meaning. Five anchor labels at 0/25/50/75/100% (Pairings only / Pairings, gently grouped / Balanced / Buckets, gently bridged / Buckets only). Reads the existing pullStrength state — no new data. Brainstorm: .omc/drafts/r19-narrative-insights-brainstorm.md (Tier C).",
  "steps": [
    "Modify src/components/FilterPullSlider.jsx: derive a label from pullStrength via a pure function pullLabel(pull) that returns one of 5 strings based on the nearest anchor.",
    "Render the label as a small absolute-positioned span above the slider thumb. Use the slider's percent value to compute left offset.",
    "Anchor labels: 0% 'Pairings only', 25% 'Pairings, gently grouped', 50% 'Balanced', 75% 'Buckets, gently bridged', 100% 'Buckets only'.",
    "Hidden when slider is disabled (filterStack empty).",
    "Vitest: pullLabel returns the correct anchor string for each of (0.0, 0.12, 0.24, 0.5, 0.74, 1.0).",
    "Manual QA: drag slider end-to-end — label transitions feel smooth, no overlap with the % readout to the right."
  ],
  "passes": true
}
```

---

## Verification Strategy

After each task: run `npx vitest run` for affected unit tests. Run
`npm run dev` and exercise the feature manually before marking
`passes: true`. Phase 2 complete: run leak test (Task 8). Phase 3
complete: TestFlight build for iOS β-mode verification.

## Rollback

`?affinity=v0` URL param disables α/β-mode. Phase 1 rollback: delete
`label_v2` field from JSON files + redeploy.
