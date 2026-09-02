# Harness Improvement — Requirements

## Overview
Audit against RALPH_LOOP_SPEC.md scored 8 PASS, 8 PARTIAL, 27 MISSING out of 45 items (18% pass rate). This mini-ralph closes the highest-impact gaps to bring the harness to spec compliance. Focuses on the top 10 gaps identified in the audit, prioritized by impact and effort.

## Current State
- ralph.sh: preset system, --status, --chain, --dry, lock file, COMPLETE/BLOCKED signals
- gates.sh: build check, console.log check, staged file check — no targeted tests, no secrets scan
- PROMPT.md: 8-step protocol, well-structured — no gate failure feedback, no context prep
- No: activity.md, plan mode, context preparation, metrics, timeout, startup safety, PowerShell, secrets scan

## Target State (Spec Compliance)
- Gate failure feedback loop (gate_failure.md → agent context)
- Per-iteration timeout (30min default)
- Startup safety checks (dirty tree, main branch warning)
- Secrets scan in gate
- Staged-file denylist
- activity.md with structured entries
- metrics.jsonl per-iteration tracking
- Context preparation (slim pending_tasks + recent_activity)
- PLAN_PROMPT.md for read-only analysis mode
- Consecutive gate failure detection

## Acceptance Criteria
1. Gate failures written to .ralph/gate_failure.md and fed to next iteration
2. Per-iteration timeout of 1800s (configurable)
3. Startup checks: dirty tree abort, main/master warning
4. Secrets scan blocks commits containing AWS keys, API keys, private keys, .env files
5. Staged-file denylist blocks .env*, *.pem, *.key, credentials.*
6. activity.md exists with structured entry format
7. metrics.jsonl appended per iteration (duration, task, gate result, files changed)
8. PROMPT.md references slim context files via @-include pattern
9. PLAN_PROMPT.md exists for read-only codebase analysis
10. Consecutive gate failures tracked and warned at threshold (3)
