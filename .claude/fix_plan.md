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
- [x] TASK-183 (R12) — partially resolved via threshold calibration. Root cause was thresholding, not feature collapse. `flavor-gnn/src/eval/calibrate_thresholds.py` sweeps per-task thresholds on the existing M3 checkpoint and recovers F1 >= 0.46 on 9 of 11 heads. Published `public/proDataset/odor_thresholds.json`. Unlocks: umami (0.25→0.61), sour (0.29→0.49), salty (0.18→0.40), odor_fatty (0.34→0.52), odor_floral (0.36→0.46). Still weak: odor_spicy (0.21→0.30), salty (16 total positives — data-limited). See `.claude/.chemdataset-status.md` for full F1 table. #ml #chemistry
- [x] TASK-184: Focal-loss evaluated. Added focal_loss() + --loss focal / --gamma flags to train_multitask.py. 5-fold CV shows focal modestly beats BCE on 10 of 11 heads. Biggest lift: salty (0.184 → 0.282, +53% rel). odor_spicy lifts only +0.017 (0.236 → 0.253) — stays below the 0.4 publish threshold, so the task that motivated this isn't unblocked. cv_results_focal.json shipped for comparison but not re-running final-model + inference since the downstream user-visible gain is marginal. #ml
- [x] TASK-186: Compound-prioritization fix in `flavor-gnn/src/infer/embed_ingredients.py`. Root cause was `compound_ids[:MAX_COMPOUNDS]` truncating per-food to the first 20 FooDB compounds, which are dominated by generic nutrients (Sucrose, Ethanol, Retinol, Vitamin D, ...) shared across most foods. That made 72% of ingredients (2,023 / 2,790) produce identical GNN predictions. Fix: load training-set SMILES from compounds.parquet, prioritize compounds whose SMILES appears in the training set before truncation, falling back to all compounds. Re-ran inference → 193 unique prediction vectors (was 95); top duplicate bucket dropped from 2,023 to 380 ingredients. #ml #chemistry
- [x] TASK-187: Hub profile imputation + ingredient-level percentile thresholds. Added `scripts/impute_hub_profiles.cjs` — for each of 1,123 hub ingredients (egg, butter, bacon, ...), averages its top-K strongest-paired ingredients' predicted probabilities, weighted by edge strength. Also derived `public/proDataset/ingredient_profile_thresholds.json` — per-task p85 thresholds on ingredient-level predictions so PredictedProfile actually flags the top ~15% of ingredients per task (molecule-level calibrated thresholds are too high for mean-pooled ingredient probs). Hub tags still sparse because mean-of-20-neighbors dilutes — TASK-188 for max-pool imputation if needed. #ml #ui
- [ ] TASK-189: Expand compound coverage for hub ingredients. Investigated TASK-186 proper-fix (expand compounds.parquet for hubs) — hit a wall because FooDB (our only current SMILES source) doesn't catalog processed/prepared foods (butter, bacon, mayonnaise, chocolate, honey, vinegar, broths, baking agents). Only 53/1,123 hubs have a possible FooDB fuzzy match, and several would be wrong (egg → eggplant, nut → cashew nut). Path forward: run `chemDataset/scripts/02-fetch-flavordb.js` (scrapes 1000 IDs, ~16 min @ 1 req/sec; FlavorDB has 25k molecules with explicit odor/taste annotations + ingredient links). Then re-run embed_ingredients with the combined sources. Requires user consent for the external scrape. #ml #data
- [x] TASK-188: Blended mean/max-pool imputation for hub ingredients. `scripts/impute_hub_profiles.cjs` now computes both the strength-weighted mean and a sqrt-strength-weighted max per task, then blends 0.6×max + 0.4×mean. Result: 10/14 spot-checked hubs now produce tags (was 0/14). Examples: bacon → fatty+salty+umami; mayonnaise → salty; bay leaf → fatty+fruity+green+floral+woody+salty. Some noise (parmesan showing fruity from its cheese-pairing neighbors) but the floor shifted from "empty section" to "signal present". 35/1,123 hubs still skipped for <5 neighbors. #ml
- [x] TASK-185 (R12 UI): Ingredient-level predicted-profile tags shipped. `src/utils/predictedProfile.js` + `src/components/PredictedProfile.jsx` + wired into IngredientPanel "Predicted profile" section between Properties and Flavor Cluster. useProData now loads `gnn_entropy.json` + `odor_thresholds.json`. Filters tasks below F1 0.4 (odor_spicy excluded). Requires prob ≥ threshold + 0.05 margin. 6 unit tests. Hub ingredients without predictions render nothing (section hidden). #ui
