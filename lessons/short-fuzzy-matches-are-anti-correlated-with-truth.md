<!-- candidate-axes: design -->
<!-- severity: high -->
<!-- applies-to: fuzzy-matching, search, entity-resolution, nlp -->
<!-- tags: fuzzy-matching, confidence, entity-resolution, candidate-cascade, fuse -->
<!-- source: hand-authored -->
<!-- created: 2026-08-01 -->
<!-- project: flavor-network -->

# Lesson: A fuzzy score on a short fragment measures length, not truth

## Problem

An ingredient matcher generated a cascade of candidates per line — the full
noun, then progressively generalized fragments (adjectives stripped, form
suffixes stripped, bare last token) — and took the highest-confidence hit.

Against a 3,891-name dictionary, the fragments won constantly, and they were
wrong:

| line | fragment tried | matched | confidence |
|---|---|---|---|
| baking soda | `soda` | soda water | **0.99** |
| packed basil leaves | `leaves` | leaves lettuce | **0.99** |
| bread, cut into cubes | `cubes` | cubed cheese | **0.99** |
| vanilla extract | `extract` | lemon extract | high |
| tomatoes, cut into pieces | `pieces` | allspice | 0.76 |

Neither "baking soda" nor "soda" is in the dictionary. The honest answer was
no match. Instead the system returned a *different food* at 0.99 confidence,
and a recipe imported with soda water in it computes a different flavor
profile than one with baking soda.

## Root cause

Edit-distance and n-gram similarity are normalized by string length, so a
short query needs very little overlap to score near-perfect. `"soda"` inside
`"soda water"` is a total substring match — the metric is behaving exactly
as designed. The defect is treating that number as *confidence about the
entity*, when it is confidence about the *string*.

This inverts precisely where it hurts. The more a candidate is generalized —
the more context stripped away — the higher its fuzzy score climbs and the
less information remains to distinguish the right entity from a neighbour
that merely shares the fragment. Confidence rises as evidence falls.

A second, related failure: matching driven entirely by a shared **modifier**.
`"baby arugula"` → `"baby eggplant"`, `"baking soda"` → `"baking potatoe"`.
English puts the head of a compound last, so a match sharing only the first
word names a different thing almost by construction.

## Mitigation

1. **Let generalized candidates win only on an EXACT hit.** Generalizing is
   a fallback for when the full phrase is unknown, never an upgrade over it.
   Fuzzy scoring is trusted on the full phrase only. This single rule killed
   every 0.99-wrong match above.
2. **Require a fuzzy match to share the phrase's head word** (last content
   token, compared both ways so plural/singular pairs still count). This
   refuses modifier-driven matches — and correctly refuses
   `"chicken thighs"` → `"…chicken breast"`, a different cut.
3. **Never let a shape, unit, or measure word stand as a candidate.**
   `pieces`, `cubes`, `leaves`, `cup` describe form or amount, never the
   entity. If your code already classifies these somewhere (to strip them),
   do not offer them as answers elsewhere.
4. **Prefer no match to a plausible one when the target may be absent.**
   Check whether the right answer even exists in the reference set before
   treating a miss as a matcher failure — often it is honest.
5. **Do not fix this by raising the global threshold.** The bug is candidate
   generation. Raising the floor suppresses good full-phrase matches while
   the 0.99 fragment hits sail through untouched.

## Generalization

In any candidate cascade, ask what a score of 0.99 on a two-token fragment
actually asserts. It asserts the strings are similar. It does not assert the
things are the same — and the shorter the fragment, the wider that gap.
Confidence should fall as context is discarded; if your pipeline lets it
rise, the ranking is inverted at exactly the point where it matters most.

Related: [[a-fallback-layer-needs-a-confidence-floor]] — same problem one
layer up, where a low-confidence extraction strategy was trusted equally
with a declared one.
