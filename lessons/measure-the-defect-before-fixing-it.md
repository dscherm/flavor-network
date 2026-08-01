<!-- candidate-axes: debugging -->
<!-- severity: medium -->
<!-- applies-to: debugging, diagnosis, reporting -->
<!-- tags: debugging, diagnosis, premature-cause, reporting, false-defect -->
<!-- source: hand-authored -->
<!-- created: 2026-08-01 -->
<!-- project: flavor-network -->

# Lesson: Measure the defect before naming its cause — and before reporting it as one

## Problem

Two mistakes in one session, both from asserting a cause before measuring.

**1. A confident wrong diagnosis.** A recipe imported tomatoes as "allspice"
and bread as "cubed cheese". The scraper's output showed nouns carrying
leading metric parentheticals — `"(340g) ciabatta or rustic sourdough
bread…"` — so the cause was announced as: the parser leaves parentheticals
in, and the matcher chokes on them. Plausible, specific, and wrong. The
client re-parses the raw line and `preprocessLine` had stripped
parentheticals all along. The real cause was a bare last-token candidate
(`cubes`, `leaves`) fuzzy-matching unrelated entries at 0.99 — visible in
ten seconds by printing the candidate cascade, which had not been done.

**2. Reporting a non-defect.** The same work was summarized with a caveat:
ricotta/mozzarella/parmesan "collapse to the bare cheese name, losing the
'cheese' qualifier — correct ingredient, coarser than ideal." That reads as
a known limitation. It isn't one. The dictionary stores those five cheeses
bare and 159 others with the word "cheese", and the matcher correctly
returns whichever form exists. The caveat sent the user to ask for a fix to
working code, and the only change that would satisfy it — renaming
dictionary entries — would break join keys across 48,588 pairings to fix
nothing.

## Root cause

Both come from the same move: a *plausible* mechanism was available, and it
was promoted to *the* mechanism without a measurement that could have
falsified it. Plausibility is cheap in a system with several layers — there
is always a nearby story that fits the symptom.

The second is the more insidious form, because nothing ever contradicts it.
A wrong cause gets falsified when the fix doesn't work. A wrongly-reported
limitation just sits in the summary, spending someone else's attention. And
caveats are *trusted more* than claims, because they read as candour — so an
unverified one does more damage than an unverified boast.

## Mitigation

1. **Print the intermediate state before naming a cause.** Here: the
   candidate list the matcher actually generated. One `console.log` between
   the input and the output would have falsified the parenthetical story
   immediately.
2. **State a diagnosis as a hypothesis until a measurement separates it from
   the alternatives.** "The noun still has a parenthetical" and "the last
   token is a shape word" both fit the symptom; only instrumentation
   distinguishes them.
3. **Apply the same standard to limitations as to claims.** Before writing
   "known issue: X is coarser than ideal", check that X is wrong. Verify
   what the correct output would even be — here, whether `ricotta cheese`
   existed as an entry at all. It did not.
4. **When a caveat survives into a summary, it must have evidence behind
   it**, exactly like a completion claim. "I didn't verify this" is a fine
   thing to say; "this is a limitation" is not, unless it is.

## Generalization

The discipline that applies to declaring success applies equally to
declaring failure. Reporting a defect that isn't one wastes the same trust
as reporting a fix that isn't done — and it is easier to get away with,
because nobody audits a confession.

Related: [[a-count-is-not-a-judgment]] and
[[diff-a-held-corpus-not-just-the-suite]] — both about looking at real
output instead of reasoning about what it probably is.
