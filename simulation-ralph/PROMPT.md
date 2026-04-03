# PROMPT.md — iOS Simulation Ralph

## Context

@.ralph/pending_tasks.md
@.ralph/recent_activity.md
@CLAUDE.md

## Your Task

Run the iOS user behavior simulation system. This system has 4 persona agents (Chef, Home Cook, Curious Browser, Cocktail Builder) that run as independent Playwright workers, plus a master agent that aggregates their findings.

### Phase 1: Orient
- Read the simulation plan (simulation-ralph/plan.md)
- Pick the FIRST task that has `"passes": false`

### Phase 2: Execute
- For "Run simulation suite":
  1. Start dev server if not running: `npm run dev &`
  2. Run persona agents: `npx playwright test --config simulation/playwright.config.js`
  3. Run master aggregation: `node simulation/master/aggregate.js`
  4. Read and report on output/scorecard.json + output/recommendations.md

- For "Fix critical pain points":
  1. Read output/recommendations.md
  2. Fix each CRITICAL issue in the source code
  3. Re-run the simulation to measure improvement

### Phase 3: Record
- Mark task `"passes": true` in simulation-ralph/plan.md
- Record results in activity.md

### Phase 4: Commit
- Stage specific files
- Commit with descriptive message

## Rules
- ONE task per iteration
- Expertise focus: frontend, testing, iOS mobile UX
