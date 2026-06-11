# Deep Interview Spec: Compound-Food Aroma Aggregation Fix

## Metadata
- Interview ID: `compound-food-aggregation-2026-06-09`
- Type: **brownfield** (`src/data/compoundFoods.js`)
- Generated: 2026-06-09
- Mode: **interactive bridge design — DO NOT commit until explicitly approved**
- Status: **PENDING APPROVAL (design — no execution)**
- Derivation: `.omc/research/deep-research-flavor-gnn-2026-06-09.md` Angle 4
  (mixtures/MIL) + direct code read of `compoundFoods.js`.
- Sibling spec: `deep-interview-gnn-weak-head-lift-2026-06-09.md` (molecular GNN).

---

## Goal

The "predicted from components" badge synthesizes a compound food's aroma profile
(mayonnaise, BBQ sauce, vinaigrette, tonkatsu sauce …) from its constituent
ingredients' GNN probabilities. The current method
(`synthesizeCompoundProfile`, `compoundFoods.js:610-648`) is a **weighted linear
mean**: `sumProbs[task] += p * weight` then `out[task] = sum / availableWeight`.

The mixture-olfaction literature is emphatic that **naive linear aggregation of
constituent molecules does not capture mixture odor**:
- Mixture embeddings are NOT linear combinations of constituents — linear regression
  from constituents to blend explained only r² = 0.47 (MPNN) / 0.021 (GIN) [claim 78].
- Mixture odor is **non-linear and emergent**: combining notes produces new qualities
  and can *mute* notes present in individual constituents [claim 27].
- State-of-the-art mixture models (POMMix, AROMMA) use **learned attention
  aggregation** (permutation-invariant, asymmetric interactions), +up to 19.1% AUROC
  over fixed pooling [claims 10,11,44,46].

So the current badge is built on the exact aggregation the literature says fails.
This spec makes the badge defensible — either by improving the aggregation or by
honestly bounding the claim it makes.

---

## Defined options (approval picks the path)

The realistic solution space, cheapest → heaviest:

```
Option A — Honest heuristic labeling (lowest effort)
  Keep weighted-mean math, but the UI badge copy explicitly frames it as a
  rough heuristic ("estimated from components — not a measured profile"), and
  the synthesized profile is visually distinguished from model-predicted ones.
  No aggregation-math change. Removes the over-claim.

Option B — Lightweight non-linear aggregation (medium effort, no model)
  Replace pure linear mean with a non-linear rule that models the two documented
  mixture effects:
    - presence/union:  per-task noisy-OR style boost so a strong single
      constituent isn't washed out by weak others (addresses dilution)
    - muting/saturation: a damping term so co-present competing notes don't
      sum unbounded (addresses emergent muting)
  Still a closed-form heuristic — NO model retraining. Strictly more defensible
  than linear mean; tunable against a small chef-validated set of known compounds.

Option C — Learned attention aggregator (highest effort, stretch)
  Port the POMMix/AROMMA pattern: attention over per-constituent embeddings →
  mixture embedding → profile. Requires an embedding source + a small trained
  aggregator. Likely overkill for a gap-fill badge; recorded as a stretch lever.
```

Recommended on-ramp: **Option A immediately (honesty)** + **Option B as the real
fix**; Option C only if the badge becomes a first-class feature.

---

## Constraints
- **No GNN retraining for this badge** — it is a UI-layer gap-fill over existing
  per-ingredient `gnnProbs`. (Option C's aggregator, if ever pursued, is small and
  separate from the molecular MPNN.)
- **Preserve the ≥50% constituent-coverage gate** (`compoundFoods.js:633`) and the
  alias/substitute resolution (`SUBSTITUTES`, `aliasOf`).
- **Preserve the `source: 'compound'` provenance flag** so the UI can always
  distinguish synthesized from model-predicted profiles.
- **No commits** during design phase.

## Non-Goals
- Touching the molecular GNN or any `flavor-gnn/` artifact (sibling spec owns that).
- Adding mixture *training* data or a new dataset.
- Changing the compound-food catalog (`COMPOUND_FOODS`) membership.

## Acceptance Criteria

### Always (Option A — honesty floor)
- [ ] **CF-AGG-1** UI badge for `source: 'compound'` profiles reads as an explicit
      estimate/heuristic, visually distinct from model-predicted profiles. Copy does
      not imply a measured aroma profile.

### If Option B approved
- [ ] **CF-AGG-2** `synthesizeCompoundProfile` aggregation replaced with a documented
      non-linear rule (noisy-OR-style presence boost + saturation/muting damping)
      replacing the pure `p*weight / availableWeight` mean.
- [ ] **CF-AGG-3** Rule tuned against a chef-validated fixture set of ≥6 known compound
      foods (mayo, BBQ, vinaigrette, tonkatsu, ponzu, +1); fixture asserts the
      synthesized top-N tasks match chef expectation better than linear-mean baseline.
- [ ] Coverage gate + alias/substitute resolution + provenance flag all preserved.

### If Option C approved (stretch)
- [ ] **CF-AGG-4** Prototype attention/Set2Set aggregator over constituent vectors;
      A/B vs Option B on the fixture set; ship only if it beats B by a clear margin.

### Cross-cutting
- [ ] Existing tests pass; `npm run build` succeeds.
- [ ] **NO COMMITS** during design phase.

## Risks / Notes for Executor
1. **Don't over-engineer a badge.** Option A removes the over-claim for near-zero cost
   and is the honesty floor regardless of whether B/C ship.
2. **Option B is a heuristic, not a model** — it will be *more* defensible than linear
   mean but is still an approximation; keep the heuristic framing in the UI.
3. **The noisy-OR here is correct** (presence union across constituents) — distinct
   from the molecular spec's compound→ingredient noisy_or, but the same probabilistic
   intuition. Linear mean is the thing the literature rejects, not noisy-OR.
