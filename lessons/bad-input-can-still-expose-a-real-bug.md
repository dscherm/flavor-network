<!-- candidate-axes: verification -->
<!-- severity: medium -->
<!-- applies-to: testing, corpora, evaluation, debugging -->
<!-- tags: corpus, methodology, triage, findings, miscalibration -->
<!-- source: hand-authored -->
<!-- created: 2026-08-02 -->
<!-- project: flavor-network -->

# Lesson: Bad input can still expose a real bug — triage, don't discard

## Problem

A third matcher accuracy pass needed a wider corpus, so recipe URLs were
harvested from three sites' listing pages with a regex per site. 348
ingredient lines, 18 pages. Reading the matched rows turned up this:

```
lb.   -> bilberry        cup  -> cupcake
oz.   -> mozzarella      head -> arrowhead
```

Unit fragments confidently matched to foods. Alarming — until checking the
corpus itself showed **205 of the 348 rows came from 3 pages, two of which
were the site homepage and a category index.** The listing regex
`https://www.budgetbytes.com/[a-z0-9-]+/` matched any page, not just
recipes. Those pages have no JSON-LD, fell through to the heuristic parser,
and it emitted nav and table fragments.

So the corpus was substantially junk. The tempting conclusion is that the
findings were junk too.

They were not. Two responses were both wrong:

- **Discard everything** — because `lb. -> bilberry` is a genuine defect.
  Those fragments appear whenever the heuristic parser misfires on any
  non-recipe page, which happens in production, not only in a bad harness.
  Every decoy is a real dictionary entry.
- **Keep everything** — because the *volume* was meaningless. "112 of 348
  unmatched" measured my regex, not the matcher. Quoting that number as an
  accuracy figure would have been fabrication.

The correct move was to separate them: the **existence** of the defect was
independent of the bad data; the **rate** was entirely an artifact of it.

## Root cause

A corpus does two jobs at once and they fail independently. It **surfaces**
behaviours, and it **weights** them. Bad sampling destroys the weighting
while leaving individual observations intact — a garbage page still shows
you truthfully what your code does when handed a garbage page.

Discovering the corpus is bad triggers an all-or-nothing reflex, because
"the data is bad" feels like a single verdict. It is two: *is this finding
real?* and *is this frequency real?* They have different answers and
different evidence.

The compounding risk is in the other direction. A striking finding creates
pressure to keep the methodology that produced it, because throwing out the
corpus feels like throwing out the discovery. That is how a bad harness
survives — laundered by a real bug it happened to catch.

## Mitigation

1. **When you find your test data is bad, re-triage each finding against
   one question: would this still be true on good input?** `lb. -> bilberry`
   would — any misfiring parse produces that fragment. "32% unmatched"
   would not — that number is the regex's, not the matcher's.
2. **Never quote a rate derived from a corpus you have since found faulty.**
   Existence claims survive; frequency claims do not. Say which you are
   making.
3. **Fix the harness AND keep the finding.** They are separate work items.
   Discarding the finding to punish the methodology loses a real defect.
4. **Say in the commit that the corpus was flawed**, and which conclusions
   depend on it. A future reader deciding whether to trust the numbers needs
   that, and it is exactly the detail an author is tempted to omit once the
   fix looks good.
5. **Validate the corpus before reading results, not after.** Distinct page
   count, plausible titles, lines-per-page — three cheap checks that would
   have caught "205 rows from 3 pages" before any conclusions formed.

## Generalization

Sampling errors corrupt aggregates while leaving individual observations
honest. When an instrument turns out miscalibrated, ask of each reading
whether it depended on the calibration — some did, some didn't, and treating
them alike either throws away real signal or preserves a broken method.

Related: [[a-count-is-not-a-judgment]] (reading the rows is what exposed
both the bug and the bad corpus) and
[[diff-a-held-corpus-not-just-the-suite]].
