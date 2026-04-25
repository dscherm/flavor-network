<!--
  Installed by `bootstrap.py` into `<project>/.omc/RALPH_LESSON_SCOPE.md`.
  Purpose: declare which lesson / skill categories ralph's learning pipeline
  owns, so OMC's `learner` hook (and any user hand-authoring skills into
  .omc/skills/) can steer clear of the same taxonomy.

  Background: ralph's `generate_lessons.py` automatically generates lessons
  from observation patterns (mark-phase skip, test coverage gap, repetition
  loop, etc.). OMC's `learner` can extract skills from conversations. If
  both emit entries covering the same behavior, retrieval becomes
  inconsistent and the same lesson gets injected twice or diverges.

  This file is an advisory — nothing blocks OMC. Run
  `python $RALPH_HOME/tools/check_lesson_overlap.py` to find conflicts.
-->

# Ralph Lesson Scope (Do-Not-Duplicate List for OMC Learner)

Ralph's cross-project learning pipeline owns these **behavioral pattern**
categories. Please do not extract OMC skills covering the same ground.

## Tags ralph owns

| Tag | Pattern | Source |
|---|---|---|
| `mark-phase` | Agent commits without setting `passes: true` | `observe.py _detect_mark_phase_skip` |
| `testing`, `test-coverage-gap` | Source files changed without tests | `_detect_test_coverage_gap` |
| `repetition-loop` | Same task attempted 8+ times | `_detect_repetition_loop` |
| `file-failure-rate` | Files with >30% gate failure rate | `_detect_file_failure_rate` |
| `error-cluster` | Same error signature 3+ times | `_detect_error_cluster` |
| `positive-pattern` | Correlations worth reinforcing | `_detect_positive_patterns` |
| `domain-cluster` | Domain-specific failure clusters | `_detect_domain_cluster` |
| `auto-generated` | Any lesson written by `generate_lessons.py` | marker on all generated lessons |

## Categories OMC **should** own

Ralph does not touch these — they're entirely OMC's:

- Conversation-level skills (extracted from dialogue, not gate telemetry)
- Tool-usage shortcuts (frequently-used command sequences)
- Project-specific workflow templates
- User preference memory (tone, formatting, review style)
- Agent orchestration patterns

## Reconciliation

If you find yourself writing an OMC skill that would naturally carry one of
the tags above, prefer one of these instead:

1. **Let ralph generate it.** Run `ralph-learn.sh` — if the pattern is
   real, it'll show up in observations and ralph will emit the lesson.
2. **Retag the OMC skill** with an OMC-native tag so retrieval
   doesn't collide.
3. **If ralph is wrong about a lesson**, edit the generated
   `lessons/*.md` directly — don't duplicate in OMC.

## Check for overlap

```bash
python $RALPH_HOME/tools/check_lesson_overlap.py             # report
python $RALPH_HOME/tools/check_lesson_overlap.py --json      # JSON
python $RALPH_HOME/tools/check_lesson_overlap.py --exit-nonzero  # CI gate
```
