# Ralph Workflow — Delegation Matrix

## When to delegate vs. work directly

| Task Type | Action | Agent |
|-----------|--------|-------|
| Three.js scene, shaders, 3D rendering | Delegate | scene-architect |
| Data parsing, API | Delegate | data-engineer |
| React components, search UI, panels | Delegate | ui-builder |
| Walkthrough/demo feature | Delegate | tour-guide |
| Ingredient/pairing data quality | Mini-loop | ingredient-ralph |
| Dead code, unused deps, stale files | Mini-loop | cleanup-ralph |
| Component decomposition, extraction | Mini-loop | refactor-ralph |
| Config, scaffold, wiring, small fixes | Work directly | (main loop) |
| Build/gate validation | Work directly | (main loop) |

## Mini-Ralph Loops

Specialized autonomous loops for domain-specific work. Each has its own plan.md, prompt.md, prd.md, and memories.md.

| Preset | Directory | Domain | Run Command |
|--------|-----------|--------|-------------|
| ingredient | `ingredient-ralph/` | Data quality: ingredients, pairings, augments | `bash ralph.sh --preset ingredient` |
| cleanup | `cleanup-ralph/` | Dead code, unused deps, stale docs | `bash ralph.sh --preset cleanup` |
| refactor | `refactor-ralph/` | Component decomposition (LivingArchView) | `bash ralph.sh --preset refactor` |
| cocktail | `cocktail-ralph/` | Cocktail Lab data, scoring, features | `bash ralph.sh --preset cocktail` |
| sauce | `sauce-ralph/` | Sauce Lab data, recipes, features | `bash ralph.sh --preset sauce` |
| harness | `harness-ralph/` | Loop infrastructure, gates, safety, metrics | `bash ralph.sh --preset harness` |

### Orchestration commands
```bash
bash ralph.sh --status              # Progress dashboard across all loops
bash ralph.sh --list-presets        # List available presets
bash ralph.sh --preset ingredient   # Run ingredient loop
bash ralph.sh --preset ingredient --max 5  # Cap at 5 iterations
bash ralph.sh --chain ingredient    # Chain presets sequentially
```

## Agent budget rules
- **Search/explore agents**: Unlimited parallel (read-only, cheap)
- **Writer agents**: Maximum 1 per file at a time
- **Build/validation**: Maximum 1 total (prevents backpressure)

## Commit conventions
- Main loop: `TASK-N: short description`
- Mini-loops: `INGREDIENT-N: short description` (prefix matches loop name)
- One task per commit
- Only commit files you changed (never `git add .`)

## Task status markers (fix_plan.md)
- `[ ]` — Pending (ready to work)
- `[>]` — In progress (current iteration)
- `[x]` — Done (committed)
- `[~]` — Blocked (reason required)
- `[s]` — Skipped (reason required)

## Mini-loop task format (plan.md)
JSON-per-line: `{"task": N, "category": "...", "description": "...", "steps": [...], "passes": false}`

## Context window management
- Never read large data files (graph.json, pairings.json) directly
- Use subagents to search/grep data files
- Keep main loop lean: read plan → pick task → delegate → validate → commit
- Mini-loops should write Node.js scripts for complex transformations
