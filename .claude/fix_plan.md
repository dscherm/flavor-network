---
mode: bugfix-and-enhance
updated: 2026-04-11T12:30
---

# Flavor Network — Fix Plan (2026-04-11)

## Active Mini-Loops

_None._

## Completed Mini-Loops

- [x] R11-DISCOVER-DEPTH: 9 tasks (9/9 complete) → `r11-discover-depth/plan.md`
  Q2 cluster label fix, Q1 Discover CTA + MoleculeOfTheDay wire-up, Q3 OdorBadge across IngredientPanel/Cocktail/Sauce/SuggestionDrawer, doc drift, R12 retrain filed (TASK-183), gate sidecar tool + npm scripts
- [x] IOS-UX-ROUND2: 8 tasks (8/8 complete) → `plan.md` (Round 2 section)
  Web Worker + binary pairings + pointer events + bloom gating + React.memo + adaptive quality + tap-target fixes
- [x] HARNESS-RALPH: 12 tasks (12/12 complete) → `harness-ralph/plan.md`
  Reconciled with shipped state in Task 17 (commit 0af8095)
- [x] RECIPE-MOBILE-RALPH: 14 tasks (14/14 complete) → `.claude/specs/recipe-lab-mobile.md`
  Mobile Recipe Lab UX redesign: taste wheel + notebook + suggestion drawer
- [x] COCKTAIL-RALPH: 10 tasks (10/10 complete) → `cocktail-ralph/plan.md`
- [x] SAUCE-RALPH: 10 tasks (10/10 complete) → `sauce-ralph/plan.md`
- [x] REFACTOR-RALPH: 8 tasks (8/8 complete) → `refactor-ralph/plan.md`
- [x] CLEANUP-RALPH: 6 tasks (6/6 complete) → `cleanup-ralph/plan.md`
- [x] INGREDIENT-RALPH: 12 tasks (12/12 complete) → `ingredient-ralph/plan.md`

## Completed Tasks

- [x] TASK-173: Task 12 — Fix <44px tap targets (ProfilePanel, FlavorTreeExplorer, GlobalInsights, MobileTabBar, Walkthrough) #mobile
- [x] TASK-172: Task 16 — Binary-packed pairings format (27 MB JSON → 168 KB brotli, 88% reduction) #perf
- [x] TASK-171: Task 17 — Reconcile harness-ralph plan.md with shipped state #chore
- [x] TASK-170: Task 15 — Adaptive quality FPS monitor #perf
- [x] TASK-169: Task 14 — Re-land React.memo on leaf components #perf
- [x] TASK-168: Task 13 — Disable bloom on low-end devices #perf
- [x] TASK-167: Task 11 — Pointer events for 3D canvas touch picking #mobile
- [x] TASK-166: Task 10 — Move pairings.json parse to Web Worker #perf
- [x] TASK-161: Add edge brightness slider to Controls panel #enhance
- [x] TASK-162: Add particle brightness slider to Controls panel #enhance
- [x] TASK-163: Fix particle visibility toggle in LivingArchView #bug
- [x] TASK-153–160: Toggle, label, tree filter, bridge highlight, edge gradient fixes

## Known Follow-Ups

- [x] TASK-174: Fix ~7 remaining 318×32 region-list tap targets — added min-h-[44px] to FlavorTreeExplorer TreeNode #mobile
- [x] TASK-175: Unblock chef.spec.js + cocktail-builder.spec.js — both now finish in 4.8m; 60s measureLoadMetrics default + withTimeout wrappers #test

## Newly Exposed Pain Points (from the now-passing simulation)

- [x] TASK-176: Audit + fix 28 chef tap targets on iPhone 15 Pro — IngredientPanel Top Pairings (20 rows), favorite heart, Details tab, close ×; Share/Clear Selection; tree-filter minimize/close/cards; ProfilePanel + GlobalInsights side tabs #mobile
- [x] TASK-177: Fix 67 cocktail-builder tap targets — CocktailBuilder (search dropdown, matching cocktails, save), CocktailPanel (search results, close ×, tabs), CocktailRecipeCard (ingredient row, alternative row); + TASK-176 IngredientPanel/App fixes also reduce shared violations #mobile
- [x] TASK-178: Add data-testid="recipe-lab" to RecipeLab/RecipeLabMobile — stale selector was ~700ms of the 13.2s, remaining ~11.5s is real mount latency (see TASK-179/180) #test
- [x] TASK-179: Reduce Cocktail Lab mount — replaced O(N²) Phase 4 repulsion in cocktailPositioning with shared spatial-hash helper (4.5× at 1500 nodes, ~13× at 6000) #perf
- [x] TASK-180: Reduce Recipe Lab mount — same root cause, fix shared via spatialRepulsion.js (also applied to saucePositioning) #perf

## Investigated & Rejected

- [~] TASK-181: Pre-bake cocktail subgraph at build time — investigated then reverted. Node microbenchmark showed buildFromLive 3.25ms vs buildFromPrebuilt 0.89ms — ~2.4ms real savings on device. Playwright-reported 1100ms "buildGraph" was main-thread microtask contention from Chromium software WebGL during tab transition, NOT actual JS work. Not worth the maintenance burden of a build script + new static asset + two code paths.

## Future Work

- [ ] TASK-182: Move buildCocktailGraph + computeCocktailPositions off the main thread (Web Worker) — parallel to the pairings parser worker from TASK-166. UX win (main thread stays responsive during Labs→Cocktail transition) even though total wall-clock is similar. Reuse src/workers/pairingsParser.worker.js or add a new cocktailBuild.worker.js. Defer until real-device measurement confirms main-thread contention is actually user-visible; under SwiftShader the measurement is dominated by software WebGL and any worker win will be invisible. See 2026-04-11 session memory note for context on why the prebuild approach (TASK-181) was rejected. #perf
- [ ] TASK-183 (R12): Retrain multi-task GNN head with class-balanced / focal loss to fix odor prediction collapse. Current R10-63 F1 scores: salty 0.18, spicy 0.24, umami 0.25, sour 0.29 (near-random); floral 0.33, fatty 0.38, woody 0.43 (weak); fruity 0.57, green 0.49, bitter 0.78 (usable). Pairwise odor-cosine p50 = 1.000 confirms collapse — model regresses toward class priors on minority classes. Proposed fix: class-balanced BCE or focal loss, oversample minority classes, consider separate head per task instead of single multi-task head. Acceptance: F1 >= 0.5 on at least 4 of 6 odor heads before promoting GNN-derived odor badges to UI (R11 ships bridge_compounds.json badges instead). See r11-discover-depth/prd.md + .claude/.chemdataset-status.md for full analysis. #ml #chemistry
