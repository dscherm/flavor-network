# Deep Interview Spec: GNN Weak-Head Lift + Measurement-Correctness Gate

> **🔴 STATUS BANNER — CAMPAIGN CONCLUDED 2026-06-10 (see
> `flavor-gnn/artifacts/MODEL_INVESTIGATION_SUMMARY_2026-06-10.md`).**
> The campaign this spec scoped ran to completion. Net outcome:
>
> - **P0 (measurement gate) was the valuable part and is DONE.** Scaffold-split
>   CV, held-out calibration, and val-epoch selection were all built and exposed
>   real inflation in the old numbers. The paired-control pattern (`--no-augment-train`)
>   is now the standard measurement tool. Keep this.
> - **The P1/P3 feature-lever premise is SUPERSEDED.** This spec's framing —
>   "the architecture is correct and the label scale is adequate; the bottleneck
>   is readout dilution, missing physchem, noisy labels" — did **not** hold under
>   honest measurement. Readout-beyond-mean_max, physchem descriptors, odor-label
>   de-noise, and external odor data (P3b) all came back flat-to-negative when
>   measured paired. The ONLY architecture win was a GAT backbone (modest, and only
>   a profile-quality gain, not a user-facing one).
> - **Molecular CV F1 is the WRONG OBJECTIVE.** The investigation showed molecular
>   odor F1 does not survive compound→ingredient aggregation (chef ingredient
>   AUROC ≈ 0.5; odor ingredient F1 ≈ 0) and the molecular profile is only ~0.58
>   AUROC vs the Flavor Bible. The real pairing/recommendation lever is the
>   **curated Flavor Bible + RecipeNLG co-occurrence graph**, not the molecular
>   model. **Do NOT resume the P1b/P1c/P3a/P3b levers as a path to user-facing
>   improvement.**

## Metadata
- Interview ID: `gnn-weak-head-lift-2026-06-09`
- Type: **brownfield** (ML pipeline — `flavor-gnn/`)
- Generated: 2026-06-09
- Mode: **interactive bridge design — DO NOT commit until explicitly approved**
- Status: **PENDING APPROVAL (design — no execution)**
- Derivation: Synthesized from two research artifacts, not a 10-round interview
  (ambiguity already low):
  - `.omc/research/gnn-audit-2026-06-09.md` — code audit (596 lines)
  - `.omc/research/deep-research-flavor-gnn-2026-06-09.md` — literature synthesis (85 claims)
  - 3 scope clarifications answered 2026-06-09 (see Decisions).

## Decisions (interactive-bridge intake, 2026-06-09)
| # | Question | Decision |
|---|---|---|
| 1 | Measurement-integrity bugs vs feature levers | **Measurement fixes are a P0 gate.** No feature lever is accepted until its delta is measured under an honest scaffold-split + held-out-calibration baseline. |
| 2 | External odor datasets | **Include ingestion levers normally.** This is a training/research project, not a commercial product — dataset provenance is not a constraint. |
| 3 | Spec split | **Two specs.** This one = molecular GNN. Compound-food aggregation → `deep-interview-compound-food-aggregation-2026-06-09.md`. |

---

## Goal

Lift the molecular taste/odor GNN's weak heads (odor_spicy, odor_floral, and the
rare tastes) above the documented ~0.02–0.07 fold-std noise floor — but FIRST make
the measurement honest, because the audit found three leaks that inflate every
reported F1. The binding insight from both research artifacts: **the architecture
(GINEConv MPNN) is correct and the label scale is adequate (POM hits human-level at
~5,000 molecules); the bottleneck is readout dilution, missing physchem features,
noisy labels, and a measurement harness that can't tell a real gain from noise.**

This is the **B-version / interactive bridge** posture — design now, no commits
until explicitly approved.

---

## Background evidence (traceable)

Convergent findings (both audit code-evidence AND literature) = highest confidence:
- **Readout dilution.** `global_mean_pool` (`mpnn.py:19,47`) averages a fragment's
  signal ~40× away on large molecules (audit Finding 1.2). Literature: set2set
  pooling measurably lifts odor on sparse graphs [research claim 59]; GNNs beat
  fingerprints precisely by *reweighting* fragments [65].
- **Missing physchem.** No pKa/logP/TPSA channel (`featurize.py:25-60`, audit 1.3);
  FP+GNN fusion hit sweet F1 0.852 in literature [49,50].
- **Salty is mechanistically unsolvable from SMILES** — ENaC ion channel, not ligand
  binding; FART + Dutta 2023 both exclude it (audit 2.5 + claims [1,2,3,4,36]).

Audit-only measurement leaks (P0 gate):
- **No scaffold split** anywhere in the compound pipeline (`train_multitask.py:370`,
  `cross_validate.py:155`, `calibrate_thresholds.py:93` all random) → FartDB
  homologous series leak across folds → reported sweet 0.898 / sour 0.830 inflated
  (Finding 2.1).
- **Calibration-on-test** (`calibrate_thresholds.py:139-159`) — thresholds swept and
  reported on the same rows; inverse n_pos↔lift signature (umami +0.219, sweet +0.029)
  (Finding 3.2).
- **Best-epoch-on-test** (`train_multitask.py:358-359`) — max F1 across 15 epochs on
  the test fold; scattered best-epochs confirm it (Finding 2.3).

---

## Phase order (sequential — P0 gates the rest)

| Phase | Tasks | Why this order |
|---|---|---|
| **P0 — Measurement gate** | scaffold-split CV, held-out calibration, val-based epoch selection, delete dead CV | Until measurement is honest, no feature delta is trustworthy. Re-baseline all 11 heads. |
| **P1 — Feature levers** | readout, physchem descriptors, odor-label de-noise, drop salty, LR schedule | Each judged under the P0 honest baseline; must beat the (new, wider) noise floor. |
| **P2 — Aggregation/ship** | noisy_or compound→ingredient + recalibrate + 0.4-gate decision | Already benchmarked in-repo (+0.091 chef macro-F1); zero retraining. |
| **P3 — Speculative** | frozen MoLFormer aux features; Pyrfume odor ingestion | Low-confidence experiments; explicitly optional. |

---

## Constraints

- **P0 is a hard gate.** No P1+ feature lever may be reported as a "win" against the
  old random-split baseline. Every F1 delta must be measured scaffold-split vs
  scaffold-split, calibration on a held-out half.
- **No architecture rewrite.** GINEConv backbone stays. Readout/feature/loss changes
  only. (Encoder swap is demoted to a P3 aux-feature experiment — literature shows
  MoLFormer only *matches* the graph model on odor and fine-tuning made odor worse
  [20,21,22,24].)
- **Do not re-tread documented dead-ends** (chemdataset-status.md): DREAM ingestion,
  focal loss, SMILES enumeration augmentation. The readout change is NOT SMILES
  enumeration (it acts after the permutation-invariant backbone).
- **External odor datasets may be ingested freely** (Decision 2) — training/research
  project, provenance is not a constraint.
- **No data-artifact mutation in P0/P1 without explicit retrain provenance.** New
  artifacts get `_scaffold` / `_heldout` suffixes; R10-63 + v3 baselines preserved.
- **No commits** during design phase.

---

## Non-Goals
- Replacing the GINEConv backbone with a foundation-model encoder (demoted to P3 aux).
- 3D conformer features (literature: marginal for taste/odor *quality*; helps only
  intensity/quantum — claims [54,57]).
- Correlation-aware multi-label heads / classifier chains (did NOT beat binary
  relevance — claim [33]).
- Cracking salty by any structural means (mechanistically impossible — claims [1-4]).
- Touching the `fm_*` recipe models (separate family, not this GNN — audit scope note).
- Modifying app/UI surfaces (this spec is `flavor-gnn/` only).

---

## Acceptance Criteria (per task — full detail in plan.md blocks)

### P0 — Measurement gate
- [ ] **GNN-LIFT-P0a** Scaffold-split CV: `GroupKFold` keyed on `MurckoScaffoldSmiles`
      replaces `StratifiedKFold` in `train_multitask.py:370`; new
      `cv_results_scaffold.json`; per-head F1 delta vs random-split baseline reported.
- [ ] **GNN-LIFT-P0b** Held-out calibration: `calibrate_thresholds.py` sweeps thresholds
      on a 50% split of the test set, reports F1 on the other 50%; new
      `threshold_calibration_heldout.json`.
- [ ] **GNN-LIFT-P0c** Val-based epoch selection: 10% validation split inside
      `_train_one_fold`; select epoch by val loss; report test F1 at that epoch (no
      more best-epoch-on-test).
- [ ] **GNN-LIFT-P0d** Delete `src/eval/cross_validate.py` (unmasked CV trap, Finding 2.2).
- [ ] **Honest baseline table** committed: all 11 heads, scaffold-split + held-out-cal F1.

### P1 — Feature levers (judged under P0 baseline)
- [ ] **GNN-LIFT-P1a** Readout: concat mean+max+sum pooling (or set2set); head input
      128→384 (`mpnn.py:33,47`). Measure odor-head delta.
- [ ] **GNN-LIFT-P1b** 8-dim RDKit physchem vector (MolWt, TPSA, NumHDonors,
      NumHBAcceptors, NumRotatableBonds, MolLogP, FractionCsp3, RingCount), normalized,
      concatenated before head. No new dependency.
- [ ] **GNN-LIFT-P1c** Odor-label de-noise: replace `ODOR_CATEGORIES` substring buckets
      (`build_compounds.py:47-82`) with a curated descriptor→head lookup; ambiguous
      tokens (warm/coconut/nutty/tea/mushroom) → skip. Re-derive labels, retrain.
- [ ] **GNN-LIFT-P1d** Drop salty head: remove "salty" from `TASKS`
      (`train_multitask.py:31`), `num_tasks` 11→10. Ablation delta on remaining heads.
- [ ] **GNN-LIFT-P1e** LR schedule + longer training on rare heads (cosine anneal,
      epochs↑, val early-stop — pairs with P0c). POM used 150 epochs [66].

### P2 — Aggregation / ship
- [ ] **GNN-LIFT-P2a** Ship `noisy_or` compound→ingredient aggregation (already
      benchmarked +0.091 chef macro-F1 in `aggregation_benchmark.json`); re-run
      `recalibrate_ingredient_thresholds.py` on noisy_or outputs FIRST; make an explicit
      documented decision on the 0.4-F1 head-disable gate (it currently suppresses
      spicy/salty — quantify what's gated off).

### P3 — Speculative (optional)
- [ ] **GNN-LIFT-P3a** Aux frozen-MoLFormer embeddings concatenated as extra head
      features (NO fine-tune, NO backbone replacement). Measure; expect small lift.
- [ ] **GNN-LIFT-P3b** External odor-label ingestion. Measure odor-head lift.

### Cross-cutting
- [ ] Every reported F1 delta is scaffold-split vs scaffold-split.
- [ ] No production data artifact overwritten without `_scaffold`/`_heldout` provenance.
- [ ] No re-tread of DREAM / focal / SMILES-enum.
- [ ] **NO COMMITS** during design phase.

---

## Risks / Notes for Executor
1. **P0 will likely LOWER reported numbers.** Scaffold split + honest calibration
   exposes inflation — umami's 0.731 stacks two leaks and its true value is unknown.
   This is expected and correct; do not "fix" it by reverting to random splits.
2. **noisy_or gate interaction.** `recalibrate_ingredient_thresholds.py:39,93-95`
   disables any head with calibrated F1 < 0.4 → currently kills spicy/salty. The +0.091
   headline overstates what reaches the UI; surface the gated-off portion explicitly.
3. **Readout change is cheap but magnitude is speculative until P0.** 3-line model
   change; validate under scaffold split before believing the delta.
4. **External odor datasets may be ingested freely** (Decision 2) — this is a
   training/research project, so dataset provenance is not a constraint.
5. **compoundFoods.js is OUT of scope here** — the mixture-aggregation finding lives in
   the sibling compound-food spec.
