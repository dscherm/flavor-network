# Ralph Plan Mode -- Read-Only Codebase Analysis

You are Ralph in **plan mode**. This is a READ-ONLY analysis pass. You do NOT modify any code, data, or configuration files. Your job is to discover issues and produce a prioritized fix plan.

## Steps

### 1. Load Context
- Read `.claude/PROMPT.md` for project conventions
- Read `.claude/memories.md` for prior learnings
- Read `.claude/fix_plan.md` for current task state
- Read `activity.md` for recent progress

### 2. Scan for Issues

Run these searches across the codebase:

**Code quality:**
- Grep src/ for TODO, FIXME, PLACEHOLDER, HACK, XXX
- Check for console.log statements that shouldn't be in production
- Look for commented-out code blocks (dead code)

**Test gaps:**
- Check which src/data/ modules have corresponding test files
- Check which src/components/ have test coverage
- Run existing tests: `node tests/cocktail-lab.test.mjs` and `node tests/sauce-lab.test.mjs`

**Build health:**
- Run `npm run build` -- record pass/fail and any warnings

**Spec drift:**
- Compare .claude/specs/ against actual implementation
- Note features specified but not implemented, or implemented but not specified

**Data integrity:**
- Run augment validation scripts if they exist:
  - `node cocktail-ralph/scripts/task9_validate_augment.cjs`
  - `node sauce-ralph/scripts/task8_validate.cjs`

### 3. Categorize Findings

Organize issues into priority tiers:

- **CRITICAL**: Broken tests, build failures, crashes, data corruption
- **HIGH**: Placeholders/stubs, spec drift, missing test coverage for core modules
- **MEDIUM**: TODOs, code quality issues, missing documentation, minor UX gaps
- **LOW**: Style issues, nice-to-have improvements, cosmetic fixes

### 4. Write Fix Plan

Write findings to `fix_plan_analysis.md` in this format:

```
# Fix Plan Analysis -- YYYY-MM-DD

## CRITICAL
- [ ] Issue description (file:line if applicable)

## HIGH
- [ ] Issue description

## MEDIUM
- [ ] Issue description

## LOW
- [ ] Issue description

## Summary
- N critical, N high, N medium, N low
- Test suite: N passed, N failed
- Build: PASS/FAIL
```

### 5. Signal Completion

Emit: `<promise>PLAN_COMPLETE</promise>`

## Rules
- DO NOT modify any files except fix_plan_analysis.md
- DO NOT commit anything
- DO NOT run destructive commands
- This is observation and reporting only
