# Plan Rationale — GNN Weak-Head Lift + Compound-Food Aggregation (2026-06-09)

**Mode:** interactive bridge design (Phase 1 INTAKE + Phase 2 PLAN only).
**Status:** PENDING APPROVAL — no commits, no task loop, no execution.
bridge-state.json deliberately NOT mutated (its current tasks are `done`); these
tasks live in `plan.md` as the source of truth until the user approves execution.

## Inputs
- `.omc/research/gnn-audit-2026-06-09.md` — code audit (596 lines, write-capable
  agent run #3; runs #1–2 were lost to a read-only-agent + empty-transcript bug).
- `.omc/research/deep-research-flavor-gnn-2026-06-09.md` — literature synthesis
  reconstructed from 85 cached claims after the deep-research workflow's synthesis
  step died to a session limit.

## Two specs (Decision 3)
- `deep-interview-gnn-weak-head-lift-2026-06-09.md` → plan tasks `GNN-LIFT-*`
- `deep-interview-compound-food-aggregation-2026-06-09.md` → plan tasks `CF-AGG-*`

Split because they touch different surfaces (`flavor-gnn/` model vs
`src/data/compoundFoods.js` UI gap-fill) with different owners and risk profiles.

## Approach chosen
**P0 measurement gate first (Decision 1).** The audit's three highest-confidence
findings are not feature gaps — they're measurement leaks (no scaffold split,
calibration-on-test, best-epoch-on-test) that inflate every reported F1. Sequencing
feature levers before fixing measurement would mean judging each lever against a
dishonest baseline. So P0 (GNN-LIFT-P0a–d) blocks P1+. priority field encodes phase.

**Feature levers ranked by convergence.** The levers where the code audit AND the
literature independently agree got top P1 priority: readout change (audit 1.2 +
claim 59) and physchem descriptors (audit 1.3 + claims 49/50). Drop-salty is trivial
and mechanistically over-determined (audit 2.5 + claims 1–4).

**noisy_or is already benchmarked in-repo** (+0.091 chef macro-F1) → P2, zero
retraining, but gated behind a recalibration + an explicit 0.4-gate decision so the
headline isn't over-claimed.

**Encoder swap demoted.** Literature shows MoLFormer only matches the graph model on
odor and fine-tuning made odor worse → P3 aux-feature experiment, not a rewrite.

## Alternatives considered & rejected
- **Features-only spec (skip measurement fixes):** rejected per Decision 1 — would
  ship lever deltas measured on an inflated baseline.
- **One combined spec:** rejected per Decision 3 — different surfaces/owners.
- **Exclude non-commercial datasets:** rejected per Decision 2 — included as
  measurement-only, gated NEVER-SHIP pending legal review.
- **3D conformers / classifier-chains / refight salty / DREAM / focal / SMILES-enum:**
  rejected — documented dead-ends (chemdataset-status.md) or low-value per literature
  (claims 33, 54, 57).
- **compoundFoods.js learned aggregator as default:** deferred to Option C (stretch);
  Option A (honest badge) is the floor, Option B (non-linear heuristic) is the real fix.

## Key risks
1. **P0 will lower reported numbers** (umami's 0.731 stacks two leaks). Expected and
   correct — do not revert to random splits to "recover" F1.
2. **noisy_or 0.4-gate** disables spicy/salty — the +0.091 overstates shippable gain.
3. **Non-commercial dataset licensing** (Pyrfume/BitterDB/GoodScents) — measurement
   only until a legal-review gate clears production use.
4. **Readout/descriptor magnitudes are speculative** until measured under P0 scaffold
   split.

## Resume instructions
On approval: execute in priority order P0 → P1 → P2 → P3 for GNN-LIFT; CF-AGG-1
(Option A) is independent and can ship anytime. Run each in the current session as a
bridge task loop (no ralph.sh, no API subprocess). No commits until the user says so.
