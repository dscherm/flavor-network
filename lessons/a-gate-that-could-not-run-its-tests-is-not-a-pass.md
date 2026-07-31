<!-- candidate-axes: procedure -->
<!-- severity: high -->
<!-- applies-to: javascript, typescript, ralph, gate, ci -->
<!-- tags: gate, false-signal, test-infrastructure, node_modules, yellow-queue -->
<!-- source: hand-authored -->
<!-- created: 2026-07-31 -->
<!-- project: flavor-network -->

# Lesson: A gate that could not run its tests is not a pass

## Problem

`smart_gate.py` ended a run with:

```
[gate] Test runner could not execute — the suite did NOT run.
       node: test runner 'npx.CMD vitest run' is not invocable (--version exited 1)
==================================================
GATE PASSED
==================================================
[gate] yellow queued: yq-... (tier 2, needs_human)
```

Both statements are in the same output. The banner is the part that gets
read; the line saying no test ever executed scrolls past. Observed on
**flavor-network 2026-07-31** — the repo-root `node_modules/` was
completely empty (0 entries), so `vite` was unresolvable and *no test had
run under the gate for an unknown number of iterations*. The suite was
fine: once `npm install` completed, 125 files / 1367 tests passed on the
first try. The gate had been reporting green over a silent void.

This is worse than a red gate. A failing gate blocks; a gate that
cannot run reassures.

## Root cause

Two structural facts compound:

1. **The harness distinguishes "environment problem" from "test failure"
   and deliberately declines to record the former as the latter** — which
   is correct, and is why it emits yellow rather than red. But the
   terminal banner is shared between "ran and passed" and "could not run",
   so the distinction dies before it reaches a human.
2. **An empty `node_modules/` is invisible to every check that isn't the
   test runner itself.** Lint, typecheck-in-subpackage, and doc-lint all
   pass; nothing else in the gate depends on the root install. The one
   check that would have caught it is the one that couldn't start.

The yellow queue is the designed escape valve, but a yellow only works if
someone drains it. An agent reading `GATE PASSED` and moving on never does.

## Mitigation

1. **Treat "runner not invocable" as red for your own purposes, whatever
   colour the harness assigns it.** The harness is right that it isn't a
   test failure; you are still forbidden from claiming the suite passed.
   Never write "tests green" in a commit body or a status report on the
   strength of a gate banner alone.
2. **Require counts, not banners.** Before trusting green on a JS/TS
   project, confirm the output contains an actual tally — `Test Files N
   passed` / `Tests N passed`. No counts means no evidence. This is a
   two-second check and it is the whole lesson.
3. **When the runner won't start, check `ls node_modules | wc -l` first.**
   An empty or missing root install is the cheapest and most common cause,
   and `npm install` resolves it. Sub-package installs (`functions/`,
   `packages/*`) can be present while the root is empty, which makes the
   project *look* installed.
4. **Drain the yellow queue in the same session that filled it, with
   evidence.** `yellow_queue.py resolve <id> --note "..."` where the note
   records what you actually ran and what it returned — not "looks fine".
   A yellow resolved without evidence is the same false signal one step
   further down the pipe.

## Generalization

Any check that can report both "I ran and found nothing wrong" and "I
could not run" through the same success channel will eventually be read as
the former. When you own such a check, split the exit states. When you
only consume it, read past the banner to the evidence — and if there is no
evidence, there is no pass.
