---
mode: bugfix-and-enhance
updated: 2026-04-11T11:40
---

# Flavor Network — Fix Plan (2026-04-11)

## Active Mini-Loops

_None._

## Completed Mini-Loops

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

- [ ] TASK-176: Audit + fix 28 chef tap targets on iPhone 15 Pro (393px) — different UI path than curious-browser #mobile
- [ ] TASK-177: Audit + fix 67 cocktail-builder tap targets — CocktailPanel/CocktailBuilder components #mobile
- [ ] TASK-178: Investigate chef slow-tab-switch (13.2s) — likely stale waitForSelector hitting full 10s timeout #test
- [ ] TASK-179: Reduce Cocktail Lab mount time (10.5s) — heavy graph build #perf
