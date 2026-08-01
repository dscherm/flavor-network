<!-- candidate-axes: design -->
<!-- severity: medium -->
<!-- applies-to: parsing, scraping, fallback-chains, heuristics -->
<!-- tags: fallback, heuristics, false-positive, confidence, graceful-degradation -->
<!-- source: hand-authored -->
<!-- created: 2026-08-01 -->
<!-- project: flavor-network -->

# Lesson: A lower-confidence fallback needs a floor, or it manufactures confident garbage

## Problem

A recipe-URL importer understood JSON-LD only, so pages without schema.org
markup failed outright. The fix added an ordered fallback chain:

```
JSON-LD  ->  microdata (itemprop)  ->  class-name heuristics
```

Clean improvement, fully unit-tested, all green. Then a live run against
`101cookbooks.com`:

```
101cookbooks  OK  proxy  heuristic  ings:1  Page not found - 101 Cookbooks
```

The URL was a 404. A reader proxy had served the not-found page as HTTP 200.
The heuristic layer matched exactly one element with `ingredient` in its
class name — site navigation, most likely "browse recipes by ingredient" —
and the pipeline reported **`status: ok`, a successful recipe import titled
"Page not found"**.

Before the fallback existed, this URL produced an honest error. After it, it
produced a confident lie. The new layer made one case better and one case
categorically worse, and only the live run showed it — every unit test used a
fixture that was actually a recipe.

## Root cause

The chain treated all three strategies as equivalent evidence, gated on the
same condition: `ingredients.length > 0`. But they are not equivalent.

- **JSON-LD and microdata are declarations.** The site is explicitly saying
  "this is a recipe ingredient." One is legitimate — a one-ingredient recipe
  exists.
- **The heuristic is an inference** over presentation markup. It pattern
  matches `class="...ingredient..."`, which appears in navigation, teasers,
  tag clouds, and related-links widgets on pages that are not recipes at all.

Applying a declaration's evidentiary threshold to an inference is what turns
"couldn't find it" into "found it" — the failure mode a fallback is supposed
to prevent, inverted. Worse, this fires precisely when the page is
degenerate, because degenerate pages are the ones with no real content and
plenty of chrome.

## Mitigation

1. **Give each strategy a threshold matched to its confidence**, not one
   shared threshold. Here: microdata accepts 1 ingredient, the heuristic
   requires 3, since a real recipe essentially always lists three or more
   while stray class matches come in ones and twos.
2. **Ask what the layer does on a page of the WRONG KIND**, not just on a
   page it handles badly. Test fixtures are drawn from the happy domain; the
   dangerous input is a 404, a login wall, a category index, a paywall
   interstitial — pages that are structurally page-shaped and semantically
   empty.
3. **When a fixture of yours starts failing after adding a floor, raise the
   fixture, not the floor** — if the floor is right on principle. A
   two-ingredient fixture failed here; it was made three-ingredient rather
   than dropping the threshold to 2, because rejecting a rare real
   two-ingredient recipe (user adds it by hand) is a better failure than
   accepting a confidently bogus one.
4. **Report which strategy fired, and watch the mix.** Emitting
   `parseStrategy` per request makes "the guessiest layer is carrying more
   weight than it should" a measurable trend instead of a surprise.

## Generalization

Every fallback chain is a confidence gradient, and each rung needs an
acceptance bar proportional to its evidence. A fallback added without one
does not degrade gracefully — it upgrades a clean failure into a plausible
wrong answer, which costs the user more than the error it replaced.
