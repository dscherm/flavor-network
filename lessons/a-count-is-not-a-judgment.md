<!-- candidate-axes: verification -->
<!-- severity: high -->
<!-- applies-to: verification, testing, data-pipelines, scraping -->
<!-- tags: verification, assertions, shape-vs-semantics, false-confidence -->
<!-- source: hand-authored -->
<!-- created: 2026-08-01 -->
<!-- project: flavor-network -->

# Lesson: A count is not a judgment — assert something a domain expert would recognize

## Problem

A recipe scraper was verified against live sites six separate times over a
session. Every check looked like this:

```
foodnetwork    OK  direct  json-ld  ings:14  Baked Macaroni and Cheese
seriouseats    OK  proxy   json-ld  ings:10  Classic Panzanella Salad
simplyrecipes  OK  proxy   json-ld  ings:25  Homemade Pizza & Pizza Dough
```

Status ok, plausible title, non-zero ingredient count. Reported as verified.
Deployed on that basis.

The counts were correct every time. What no check ever did was **read the
ingredient names**. When they were finally read — in the UI, after
deployment — three of Panzanella's ten were badly wrong: tomatoes had become
allspice, bread had become cubed cheese, basil had become lettuce.

`ings:10` was true. It was also compatible with ten completely wrong
ingredients, and had nothing to say about which.

Reading the ten strings once, at any point in the session, would have
caught it in seconds. The information was always one `console.log` away.

## Root cause

Shape assertions are cheap to write, cheap to read, and stable across
inputs — so they become the default. `status === 'ok'`, `length > 0`,
`title != null`. Each is genuinely informative about *failure*: if the count
were 0, something is broken.

But they are silent about *correctness*. A pipeline that returns exactly the
right number of exactly the wrong things satisfies every one of them. And
because the checks are green and repeated, they accumulate the *feeling* of
verification without ever having tested the property anyone cares about:
is the output right?

The trap is sharpest with data pipelines, where output is a bag of strings
and eyeballing feels unrigorous next to an assertion. It is not. Here the
rigorous-looking assertion was the weak one.

## Mitigation

1. **State the assertion a domain expert would make, then check that.** For
   a recipe: "does this look like a panzanella?" A panzanella has tomatoes
   and bread. That check needs no framework and takes one glance.
2. **Print the payload, not the summary, at least once per surface.** Not
   `ings:10` but the ten strings. Summaries are for regression runs after
   you have read the real thing; they are not a substitute for reading it.
3. **When the output is semantic, verify semantically.** Names, labels,
   categories, generated text — these fail in ways counts cannot see. A test
   that a classifier returned 10 labels tells you nothing about whether they
   are the right 10.
4. **Notice when a check has been green many times without anyone reading
   its output.** Repetition of a shape check builds confidence at a rate
   completely unrelated to the evidence it produces. Six green runs of a
   count assertion is one count assertion, six times.

## Generalization

Verification is only as strong as the strongest thing it would have caught.
Ask that question of every check: *what wrong output would still pass this?*
If the answer includes the failure you actually care about, the check is
decoration — however many times it has gone green.

Related: [[every-layer-green-system-wrong]] — the defect this missed lived in
the seam between two separately-verified components.
