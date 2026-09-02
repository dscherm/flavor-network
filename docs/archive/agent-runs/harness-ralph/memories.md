## Patterns

## Decisions

## Fixes

## Context

### mem-20260325-c01
> Ralph Loop audit against RALPH_LOOP_SPEC.md (2026-03-25): 8 PASS, 8 PARTIAL, 27 MISSING of 45 items (18% pass rate). Strongest: 8-step protocol, memory system, commit discipline, lock file, mini-ralph pattern. Weakest: no activity.md, no context prep, no gate failure feedback, no plan mode, no timeout, no metrics, no startup safety, no secrets scan.
<!-- tags: audit, spec-compliance | created: 2026-03-25 -->

### mem-20260325-c02
> Platform: Windows 11, Git Bash. ralph.sh must use bash syntax compatible with Git Bash (no zsh, no bash 5+ features). Node.js tools preferred over Python (project uses Node.js). CRLF issues: always tr -d '\r\n' when parsing command output for arithmetic.
<!-- tags: platform, windows | created: 2026-03-25 -->
