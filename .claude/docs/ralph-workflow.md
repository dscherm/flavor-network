# Ralph Workflow — Delegation Matrix

## When to delegate vs. work directly

| Task Type | Action | Agent |
|-----------|--------|-------|
| Three.js scene, shaders, 3D rendering | Delegate | scene-architect |
| Data parsing, ML training, API | Delegate | data-engineer |
| React components, search UI, panels | Delegate | ui-builder |
| Walkthrough/demo feature | Delegate | tour-guide |
| Config, scaffold, wiring, small fixes | Work directly | (main loop) |
| Build/gate validation | Work directly | (main loop) |

## Agent budget rules
- **Search/explore agents**: Unlimited parallel (read-only, cheap)
- **Writer agents**: Maximum 1 per file at a time
- **Build/validation**: Maximum 1 total (prevents backpressure)

## Commit conventions
- Format: `TASK-N: short description`
- One task per commit
- Only commit files you changed (never `git add .`)

## Task status markers
- `[ ]` — Pending (ready to work)
- `[>]` — In progress (current iteration)
- `[x]` — Done (committed)
- `[~]` — Blocked (reason required)
- `[s]` — Skipped (reason required)

## Context window management
- Never read large data files (graph.json, pairings.json) directly
- Use subagents to search/grep data files
- Keep main loop lean: read plan → pick task → delegate → validate → commit
