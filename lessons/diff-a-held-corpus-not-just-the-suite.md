<!-- candidate-axes: verification -->
<!-- severity: high -->
<!-- applies-to: ranking, heuristics, matching, ml, search -->
<!-- tags: verification, regression, corpus, ranking, differential-testing -->
<!-- source: hand-authored -->
<!-- created: 2026-08-01 -->
<!-- project: flavor-network -->

# Lesson: For ranking and heuristic changes, diff a held corpus — the suite won't catch it

## Problem

Two accuracy passes on an ingredient matcher (WEBLINK-6, WEBLINK-7). Both
had a growing unit-test suite. Both times a fix **silently regressed a line
no test covered**, and both times the suite stayed green:

1. Introducing "generalized candidates may only win on an exact hit" turned
   `"2 large egg yolks"` from a correct `egg yolk` into **no match**. Cause:
   singular forms were generated from the raw tokens but not from the
   adjective-stripped ones, so `"egg yolk"` was never a candidate. Nothing
   asserted that line.
2. Teaching the parser that `"2 tsp. vanilla extract"` has a unit fixed
   vanilla — and simultaneously turned `"baking soda"` from an honest
   **no match** into a confident `baking potatoe`. The cleaner noun gave the
   fuzzy matcher a better foothold on the wrong answer.

Neither appeared as a red test. Both appeared immediately in a before/after
diff of a 102-line corpus scraped from seven real recipes.

## Root cause

Unit tests pin the cases you thought of. A ranking or heuristic change moves
the cases you *didn't* — that is the whole nature of the change. Every edit
to a scoring function, candidate generator, threshold, or tokenizer
redistributes outcomes across the entire input space, and a test suite
samples that space at exactly the points someone already understood.

The asymmetry is what makes it dangerous: a fix aimed at input class A
improves A (visible, celebrated) and quietly shifts B and C (invisible, no
assertion). The suite going green after the change carries almost no
information about B and C, yet it *feels* like clearance.

## Mitigation

1. **Hold a fixed corpus of real inputs and diff every row before and after
   each change.** Not a sample — the whole thing. Here: 102 lines from seven
   live recipes, dumped to JSON before the edit and compared after.
2. **Read the changed rows individually and classify each** as improvement,
   regression, or neutral. "20 rows changed" is not a result; "15 corrected,
   5 correctly declined, 0 regressed" is.
3. **Re-diff after EVERY sub-change, not once at the end.** Both regressions
   above were introduced by a later fix and would have been invisible in a
   single end-to-end comparison — the wins would have masked them in the
   aggregate.
4. **Promote the rows a change was aimed at into permanent fixtures**, so
   the next edit has a test. The corpus finds regressions; the fixtures stop
   them coming back.
5. **Expect the corpus to disagree with your model of the fix.** If a
   diff shows only what you predicted, suspect the corpus is too small or
   too close to your fixtures.

## Generalization

Any change that redistributes outcomes — ranking, fuzzy matching, scoring,
classification thresholds, tokenization, retrieval — needs differential
evaluation over held data, not just example-based tests. The tests answer
"did I break what I understood?" Only the corpus answers "what did I move
that I wasn't thinking about?"

Related: [[a-count-is-not-a-judgment]] (read the corpus rows, don't count
them) and [[every-layer-green-system-wrong]] (a green suite measuring the
wrong thing).
