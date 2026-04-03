# plan.md — iOS User Behavior Simulation

Task queue for simulation system development. Ralph Loop processes these sequentially.

---

### Task 1: Run simulation suite

```json
{
  "category": "simulation",
  "priority": 1,
  "description": "Run all 4 persona agents via Playwright, then aggregate results with master agent",
  "steps": [
    "Ensure dev server is running (npm run dev)",
    "Run: npx playwright test --config simulation/playwright.config.js",
    "Run: node simulation/master/aggregate.js",
    "Verify output/scorecard.json and output/recommendations.md are generated",
    "Review pain point rankings and heuristic score"
  ],
  "passes": false
}
```

### Task 2: Fix critical pain points

```json
{
  "category": "fix",
  "priority": 2,
  "description": "Address all CRITICAL severity pain points identified by the simulation",
  "steps": [
    "Read output/recommendations.md",
    "Fix each critical issue (compression, SearchBar touch, BottomSheet handle)",
    "Re-run simulation to verify improvement",
    "Update activity.md with before/after metrics"
  ],
  "passes": false
}
```
