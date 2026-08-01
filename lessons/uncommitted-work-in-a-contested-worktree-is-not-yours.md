<!-- candidate-axes: procedure -->
<!-- severity: high -->
<!-- applies-to: git, ralph, multi-agent, shared-worktree -->
<!-- tags: git, concurrency, provenance, uncommitted, multi-session -->
<!-- source: hand-authored -->
<!-- created: 2026-08-01 -->
<!-- project: flavor-network -->

# Lesson: Uncommitted work in a contested worktree is not yours to commit

## Problem

Edits were made to `ralph-universal/tools/smart_gate.py` and deliberately
left uncommitted, because that repo sat on a feature branch with 25 modified
tool files — an in-flight refactor — and sweeping someone else's WIP into an
unrelated commit seemed worse than waiting for a decision.

Fifteen minutes later, on the go-ahead to commit:

```
$ git status --short tools/smart_gate.py
(nothing)
$ git diff --stat tools/smart_gate.py
(empty)
```

The file was clean and the diff was empty — but the change was still *in* the
file. A concurrent session had committed it. `git log -S"def pass_banner"`
found it inside:

```
686399e  paths: route config-file resolution through the resolver
```

a commit with no relationship to the change. Nothing was lost, and the code
landed complete. But a gate-banner fix now lives under a paths-refactor
message, and no one reading that history will ever find it.

Two commits from the other session landed during the conversation (22:26 and
22:32), so the window was not unusual — it was the normal cadence of an agent
working the same tree.

## Root cause

`git add -A` / `git commit -a` from any session stages **the whole worktree**,
not that session's changes. Git has no concept of authorship for unstaged
edits; the working tree is shared mutable state with no ownership and no
locking. The moment two agents share a checkout, "I'll leave this uncommitted
and decide later" stops being a deferral and becomes a race.

The instinct to wait was right about one risk (polluting someone's WIP) and
blind to the larger one (losing provenance entirely). Waiting did not avoid
the mixed commit — it just meant the mixing happened under *their* message
instead of a message that explained the change.

## Mitigation

1. **Commit your own change narrowly and immediately** — `git add <specific
   paths>` for the files you touched, never `-A`, and commit as soon as it
   verifies. In a shared tree the exposure window is the whole risk, and it
   is the one thing you control.
2. **Before committing anything you left sitting, re-check that it is still
   uncommitted.** `git status <path>` showing clean does NOT mean your edit
   reverted — check whether the content is still present, then
   `git log -S"<a distinctive string from your change>" -- <path>` to find
   which commit absorbed it. Clean status plus present code means someone
   else committed for you.
3. **When your change has already been absorbed, do not rewrite their
   commit.** It may be pushed, and rewriting shared history to tidy
   attribution risks far more than messy history costs. Instead commit the
   remaining piece (tests, docs) with a HISTORY NOTE naming the absorbing
   commit and what landed there — that restores findability at zero risk.
4. **Detect contention before starting.** `git log --format=%ad --date=...
   -3` plus a dirty tree across many files is the signal that another session
   is live. Say so before doing harness work, rather than discovering it at
   commit time.

## Generalization

Any shared mutable state without ownership will be written by whoever acts
first. In a multi-agent setup the working tree is exactly that, and the
default assumption — "my edits stay mine until I commit them" — is a
single-agent assumption that quietly stops holding.
