# flavor-network-C

<!-- unpossible-ralph: auto-injected context -->
@.claude/.chemdataset-status.md


<!-- unpossible-ralph: auto-injected context -->
@.claude/.ralph-lessons.md
@.claude/.ralph-spec.md
@.claude/.ralph-pending-reviews.md


<!-- unpossible-ralph: auto-injected context -->
@.claude/.ralph-handoff.md
@.claude/.ralph-bridge-resume.md


<!-- unpossible-ralph: auto-injected context -->
@.claude/.ralph-bootstrap-needed.md


<!-- unpossible-ralph: auto-injected context -->
@.claude/.ralph-precompact.md
@.claude/.ralph-human-requests.md
@.claude/.ralph-scope.md

---

## Lesson tagging discipline

<!-- ralph-discipline: lesson_applied_tagging -->

This project is enrolled in ralph-universal's cross-project learning
system. The dashboard's `applied_count` metric depends on accurate
`<lesson_applied>` tags in commit bodies. A Day-1 audit (2026-06-02)
across enrolled projects found that ~70% of tags didn't reflect the
actual diff — agents were defaulting to familiar stem names rather
than tagging what the diff actually applied. This section sets the
rule going forward.

### When to emit `<lesson_applied>`

Emit `<lesson_applied stem='X' note='...'/>` in commit bodies **only
when the diff actually contains the pattern, fix, or behavior the
lesson documents**. The test:

> Would this commit's code be measurably different if the lesson
> didn't exist?

If yes → tag it. If no → do not tag.

### When NOT to tag

- **Read but didn't apply** — that is consultation, not application.
  Do not emit `<lesson_applied>`. The day-30 audit explicitly filters
  "consulted but not applicable" out as noise.
- **Familiar-stem default** — never emit a tag just because the stem
  is the one you remember from a prior session. Re-check
  `.claude/.ralph-lessons.md` for the currently-injected set and
  cross-reference against the diff.
- **Stale stems** — only stems with both `lessons/<stem>.md` present
  AND a recent injection record for this project should be tagged.
- **Same tag-block on every commit** — if two consecutive unrelated
  commits emit the same tag set, the second one is almost certainly
  ritual stamping. Stop.

### Optional: track consultations in the audit channel

If you want a paper trail for "I read this lesson and decided it
didn't apply", use the dedicated verb instead of polluting the
application metric:

```bash
python $RALPH_HOME/tools/tag_lesson.py consulted <stem> \
  --source preflight \
  --reason "<one-line reason>"
```

This appends a `consulted` event to `.ralph/lesson-events.jsonl` —
honest audit signal that doesn't inflate the application count.

### Short version

- Diff reflects the lesson → `<lesson_applied stem='X' note='...'/>` ✓
- Read but didn't apply → say nothing, OR use `tag_lesson consulted` ✓
- Same tag-block on every commit → ✗ (ritual stamping; stop)
- "Consulted, decided not applicable" as a `<lesson_applied>` note → ✗

When in doubt, skip the tag. Under-tagging is correctable (the
auto-stamp mechanism catches some real applications via keyword
matching); over-tagging is harder to clean up after.
