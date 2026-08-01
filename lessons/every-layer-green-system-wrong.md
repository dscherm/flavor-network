<!-- candidate-axes: verification -->
<!-- severity: high -->
<!-- applies-to: testing, integration, verification, pipelines -->
<!-- tags: integration, end-to-end, composition, seams, verification -->
<!-- source: hand-authored -->
<!-- created: 2026-08-01 -->
<!-- project: flavor-network -->

# Lesson: Every layer green does not mean the system works — test the seam

## Problem

A recipe-URL import was verified thoroughly, layer by layer:

- **Scraper** — run live against six real recipe sites, correct titles and
  ingredient counts on every one
- **Parser** — 75 passing tests covering JSON-LD, microdata, heuristics,
  entity decoding, confidence floors
- **Client** — 47 passing tests covering the auth gate, the deck, the
  matcher's edit/reset behaviour
- **Deployed function** — clean cold start, correct callable registration,
  401 on unauthenticated

Everything green. Shipped to production.

Then a single end-to-end run through the actual UI, importing Serious Eats'
*Classic Panzanella Salad (Tuscan-Style Tomato and Bread Salad)*:

| actual ingredient | landed in the bowl |
|---|---|
| mixed ripe **tomatoes** | allspice |
| ciabatta/sourdough **bread**, cubed | **cubed cheese** |
| **basil** leaves | **leaves lettuce** |

The dish is named "Tomato and Bread Salad". The bowl contained neither
tomato nor bread, and did contain allspice and cheese.

Nothing was broken in any layer. The scraper returned all ten raw lines
perfectly. The matcher did what it was built to do. The defect lived
entirely in the **seam**: `parseIngredientLine` emitted a `noun` still
carrying a leading metric parenthetical and trailing prep text —
`"(340g) ciabatta or rustic sourdough bread, cut into 1 1/2-inch cubes"` —
and the fuzzy matcher, handed that, picked something plausible and wrong.

Neither side's tests could have caught it. The parser's tests assert the
parser's contract. The matcher's tests feed it clean nouns. The contract
between them was never asserted by anyone, because it belonged to neither.

## Root cause

Component verification does not compose. Each test suite is written against
its own module's contract, using inputs its own author chose — and authors
choose inputs their module handles. The interface between two modules is
owned by neither test suite, so it is the one surface with no coverage,
and it is exactly where mismatched assumptions live.

The seam here was an implicit format agreement: the parser believed `noun`
meant "the ingredient line minus quantity and unit"; the matcher believed
`noun` meant "a clean ingredient name". Both are reasonable readings. Nobody
wrote it down, and no test forced the question.

Verifying the deployed function did not help either, because that verified
the same layer from a different angle — a real fetch, still checked at the
scraper's boundary.

## Mitigation

1. **Run the real user path end to end before the deploy, not after.** One
   pass through the actual UI, on real input, judged the way a user would
   judge it. It cost two minutes and found what four verified layers missed.
2. **When you build a pipeline, write at least one test that spans the whole
   chain** with a realistic input, asserting the FINAL output. Not each
   stage in isolation — the composition.
3. **Name the seam contracts explicitly.** If one module emits `noun` and
   another consumes it, write down what `noun` guarantees (stripped of
   quantity, unit, parentheticals, prep clauses?) and test that guarantee on
   both sides. An implicit format agreement between two modules is a defect
   waiting for a real input.
4. **Treat "each component verified" as a prompt, not a conclusion.** The
   next question is always "and what have I checked about them *together*?"

## Generalization

The more carefully each layer is verified in isolation, the more confident
everyone becomes about a system nobody has actually run. Thorough
component testing can raise confidence faster than it raises correctness —
and the gap between those two is exactly the size of the untested seam.

Related: [[a-fallback-layer-needs-a-confidence-floor]] (the matcher accepting
a weak match instead of declining is the same confidence problem, one layer
over), and [[a-count-is-not-a-judgment]] (how the bad output survived six
verification passes without being read).
