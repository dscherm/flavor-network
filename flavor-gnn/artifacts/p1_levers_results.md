# P1 Feature Lever Results (measured vs DeepChem scaffold baseline)

> **⚠️ READ THIS FIRST (banner added 2026-06-10). This document contains a
> resolved internal contradiction — do not stop reading at the optimistic
> middle sections.**
>
> - The **"P3b — external-set odor-data ingestion — WORKS"** section below (and
>   its "+0.12 floral / +0.14 fatty" claim) is **STALE / WRONG**. It compared runs
>   on DIFFERENT test sets. The **"DEFINITIVE PAIRED CONTROL"** section near the
>   bottom overturns it: with an identical fixed test set, external odor data is
>   **flat-to-negative (mean odor Δ ≈ −0.01)**. The "FINAL VERDICT (corrected)"
>   section is the authoritative conclusion within this file.
> - The woody-fix discussion early on references `LEFFINGWELL_EXCLUDE = {"woody"}`.
>   That was a stopgap; the campaign later split out an `odor_nutty` head and the
>   final code excludes `{"woody", "nutty"}`. Treat the early single-element form
>   as superseded.
> - The single source of truth for the whole campaign (including the downstream
>   finding that molecular F1 barely reaches the user) is
>   `flavor-gnn/artifacts/MODEL_INVESTIGATION_SUMMARY_2026-06-10.md`. The net
>   banked result is: **GAT backbone + mean_max + 12 heads** is the only real
>   model gain, and it is a profile-quality (visualization) improvement, not a
>   pairing/recommendation one.

All levers measured by PAIRED per-seed comparison (5 seeds, SEED+s) against the
canonical baseline `cv_results_scaffold_baseline.json` (readout=mean). Paired
differencing cancels seed-difficulty variance.

## P1a — Readout change

| variant | net paired Δ (all heads) | odor heads | key per-head | decision |
|---|---|---|---|---|
| `mean_max_sum` | -0.011 | +0.001 | sweet -0.072 (sum-pool hurts dense head); odor_spicy +0.040 | **REJECTED** (net negative) |
| **`mean_max`** | **+0.006** | -0.000 | **sour +0.035 (4/5)**; sweet 0.833 (recovered/stable); no head damaged | **BANKED** |

**Mechanism resolved:** the size-sensitive `sum` pool degraded sweet but carried the
odor_spicy signal; `mean+max` recovers sweet and picks up a durable sour win, at the
cost of the spicy lift. Net safe-positive.

**Honest strategic finding:** the readout lever does NOT lift the weak odor heads
(floral/spicy/fatty stay flat under both variants). The audit's Finding 1.2
dilution-hypothesis does not bear out as an odor fix on this data. The only durable
wins are on already-strong heads (sour). Weak-odor-head lift must come from label
quality (P1c) or features (P1b), not readout aggregation.

**Banked decision:** adopt `readout='mean_max'` as the model default going forward.
`cv_results_scaffold_p1a_meanmax.json` is now the reference baseline for subsequent
levers (P1b/P1c measured on top of mean_max).

## P1c — Odor-label de-noise — REJECTED
De-noised odor labels (word-boundary + removed 8 ambiguous tokens; odor_woody
-33% positives). Paired vs mean_max baseline: mean odor Δ ≈ -0.003 (flat-to-neg).
**odor_woody got WORSE (-0.019) despite removing a third of its "noise"** — the
removed tokens (nutty/mushroom) carried real signal, and shrinking the positive
set raised variance. Keyword-removal de-noising does not lift the weak heads.

## P3b — external-set odor-data ingestion — **WORKS**

Ingested the external-set odor set (3,522 molecules, 113 binary odor descriptors
mapped to our 6 heads). Odor-observed molecules 1,383 → 4,645; weak heads 2.6–4x positives.
Two measurements, both `mean_max` readout, 5 seeds:

**(1) Combined** (external-odor labels OR'd + net-new molecules, augmented test):
floral +0.095, fatty +0.106, fruity +0.045, green +0.039, spicy -0.010, woody -0.081.
Suggestive but the test set changed (confound).

**(2) Train-only confirmation** (external odor data forced 100% into TRAIN, test = pure
ORIGINAL molecules + ORIGINAL labels — verified 0 augment leak):

| odor head | baseline | +external(train) | Δ | verdict |
|---|---|---|---|---|
| **odor_fatty** | 0.517 | 0.659 | **+0.142** | real lift |
| **odor_floral** | 0.382 | 0.504 | **+0.122** | real lift |
| odor_spicy | 0.298 | 0.338 | +0.040 | mild lift |
| odor_green | 0.581 | 0.605 | +0.024 | mild |
| odor_fruity | 0.717 | 0.739 | +0.022 | mild |
| **odor_woody** | 0.519 | 0.362 | **-0.157** | CONFLICT |

**5 of 6 odor heads improve on the rigorous pure-original test** — floral and fatty
substantially. The lifts are consistent across both measurements (1) and (2), across
different test compositions → real training signal, not a test-set artifact.

**EXCEPTION — odor_woody regresses hard (-0.157), consistent across both runs.**
external-set's woody distribution (earthy/pine/smoky/woody) conflicts with our
FlavorDB woody (which still includes nutty/mushroom in the ORIGINAL labels).
Fix: exclude external-set's woody mapping, or reconcile the woody vocab.

### Woody conflict — diagnosed + fixed (exclude woody from the external-set merge)

Root cause, three compounding factors confirmed on the data:
1. **Vocabulary disagreement.** external-set maps only {earthy, pine, smoky,
   woody} → odor_woody. Our FlavorDB woody was built with a broader set that
   counts nutty + mushroom. Of 432 original woody positives, 121 (28%) carry a
   nutty/mushroom tag and **81 (19%) are woody ONLY because of nutty/mushroom** —
   labels external-set explicitly calls NOT woody.
2. **Prior shift.** Woody positive rate is **31% in our data vs 11% in the
   external-set augment** (224/1980). Mixing in 1,980 low-woody molecules pulls
   the model's woody prior down → recall collapses on the 31%-prevalence test set.
3. **Exact-match mapping gap.** Ingest maps descriptors with exact `dl in kws`,
   so external-set's `balsamic` descriptor never reaches woody (our keyword is
   `balsam`), making the augment woody set even sparser than intended.

(1) and (2) push the same direction (systematic woody false-negatives) and are
the dominant cause; (3) worsens (2). De-noising the *original* woody labels was
already shown not to help (P1c: odor_woody -0.019).

**Fix applied:** `LEFFINGWELL_EXCLUDE = {"woody"}` in both ingest scripts —
woody keeps its ORIGINAL labels untouched (existing rows) and is left
*unobserved* (mask=0) on net-new augment rows, so external-set contributes zero
woody signal. The other 5 odor heads still merge and keep their lifts.
Regenerated `compounds_p3b.parquet` + `compounds_p3b_trainonly.parquet` confirm:
augment woody = 0 pos / 0 obs; original woody = 432 / 1383 unchanged.
Expected effect: odor_woody returns to its ~0.517 baseline while floral/fatty/
fruity/green/spicy retain their gains. **Pending: re-run the 5-seed train-only
scaffold eval to confirm the F1 numbers.**

**Caveat:** taste heads wobbled (sweet +0.05, sour -0.11) because the train-only
test set (1,273 pure-original) differs in size/composition from the baseline split
(~1,991). external-set adds no taste signal, so that wobble is test-set noise — the
ODOR comparison is the valid one, and even there the consistency across two runs is
the evidence, not any single number.

### VERDICT — SUPERSEDED (was an artifact, see PAIRED CONTROL below)
~~Scraping molecular odor data is the lever the model-side experiments weren't.
external-set lifts floral +0.12 and fatty +0.14.~~ **WRONG — this compared runs on
DIFFERENT test sets. The paired control (below) overturns it: external odor data
does NOT lift the odor heads.**

## odor_nutty head + woody reconciliation — measured (5-seed scaffold, mean_max)

Followed through on the woody fix differently than the exclude-from-merge stopgap:
split the Maillard/roast cluster into a dedicated **odor_nutty** head (7th odor
head), kept mushroom in woody, re-enabled external-set woody, and fixed the
descriptor matcher (exact -> substring, so `balsamic` reaches woody). Two 5-seed
runs: a 12-head FlavorDB-only baseline and a +external-set train-only run.
Artifacts: `cv_results_scaffold_nutty_baseline.json`,
`cv_results_scaffold_nutty_p3b_trainonly.json`.

| head | baseline | +external-set | Δ | test pos/seed (base→aug) | trust |
|---|---|---|---|---|---|
| sweet | 0.853 | 0.776 | -0.077 | dense | Δ is artifact (seed-3 split collapse 0.378) |
| bitter | 0.806 | 0.816 | +0.010 | dense | robust |
| umami | 0.563 | 0.550 | -0.013 | moderate | flat |
| salty | 0.212 | 0.348 | +0.136 | tiny | noise (known-bad head) |
| sour | 0.766 | 0.716 | -0.050 | dense | ~test-set noise |
| odor_fruity | 0.713 | 0.772 | **+0.059** | dense | credible lift |
| odor_floral | 0.380 | 0.499 | +0.119 | 15→12 | suggestive, noisy |
| odor_green | 0.593 | 0.599 | +0.006 | moderate | flat |
| odor_woody | **0.497** | 0.408 | -0.089 | 27→11 | aug side noisy |
| odor_spicy | 0.286 | 0.327 | +0.041 | small | weak/noisy |
| odor_fatty | 0.529 | 0.654 | **+0.125** | 25→19 | credible lift |
| **odor_nutty** | **0.442** | 0.155 | -0.287 | **15→3** | aug side is pure noise |

**The two runs use different test sets** (baseline 1,991; train-only 1,273
pure-original), so Δ conflates the augment training effect with test composition
— not a clean paired comparison. Test-positive counts decide what's readable.

### Findings
- **odor_nutty works: baseline F1 0.442 ± 0.14** from FlavorDB's 194 positives
  alone — in the band of fatty (0.529) and woody (0.497), above floral (0.380)
  and spicy (0.286). The 7th head is viable; the model absorbed it with no
  architecture change. The `nutty 0.155` under +external-set is **not real** —
  the pure-original test has only 3 nutty positives/seed (one seed had 1 →
  F1 0.000). Whether external-set helps nutty is **unmeasurable** with this design.
- **Woody recovered as a head.** Splitting nutty out cost woody nothing (baseline
  0.497 ≈ its historical ~0.517) and the original -0.157 conflict is gone. But
  reconciliation did **not** turn external-set into a woody *lift* — the +external-set
  woody (-0.089) is on a degraded test (11 pos/seed, one seed = 3 → 0.222), so the
  augment effect on woody is neutral-to-unknown, not a win.
- **Credible external-set odor lifts: fatty +0.12, fruity +0.06** (enough test
  positives to trust; fatty matches the earlier P3b +0.142).
- **Methodological gap:** the train-only design (augment forced to train, test on
  pure-original) is underpowered for rare heads (nutty/woody) because it shrinks
  the test set. A trustworthy nutty/woody augment read needs more seeds (15-20) or
  an eval that doesn't starve the test set.

### Decision
Keep the 12-head model with the nutty head (it's viable: baseline F1 0.442 from
FlavorDB alone, no architecture cost). But external-set odor data is NOT a win —
see the definitive paired control below.

---

## DEFINITIVE PAIRED CONTROL — external odor data does NOT lift the odor heads

Every prior P3b comparison compared an augmented run against a baseline on a
DIFFERENT test set (augment-forced-to-train shrinks the pure-original test from
~1,991 to ~1,273, and that smaller set is simply easier for floral/fatty). That
confound produced the phantom "+0.12 floral / +0.14 fatty" wins.

The clean test: SAME parquet, SAME split, SAME seeds, SAME pure-original test set —
toggle only whether the external molecules are in TRAIN (`--no-augment-train`
control vs the excl run). Per-seed paired delta = the pure augment effect.
Artifacts: `cv_results_scaffold_control.json` vs `cv_results_scaffold_p3b12_excl.json`.

| odor head | control (no external) | +external | paired Δ |
|---|---|---|---|
| odor_fruity | 0.786 | 0.743 | -0.043 |
| odor_floral | 0.480 | 0.483 | +0.003 |
| odor_green | 0.611 | 0.594 | -0.017 |
| odor_woody | 0.377 | 0.399 | +0.022 |
| odor_spicy | 0.333 | 0.321 | -0.012 |
| odor_fatty | 0.648 | 0.624 | -0.023 |
| odor_nutty | 0.165 | 0.170 | +0.004 |
| **mean odor** | — | — | **≈ -0.01 (flat-to-negative)** |

**Smoking gun:** the control with ZERO external data already scores floral 0.480 /
fatty 0.648 on the pure-original test — the same as the +external run. The entire
apparent gain was the test set, not the data.

**Validity check:** taste heads (zero external signal, identical test) moved +0.021
mean with sweet swinging +0.122 — so the ±0.02-0.04 odor deltas are inside the noise
floor and mean nothing.

### FINAL VERDICT (corrected)
All three odor levers fail under rigorous (paired / fixed-test) measurement:
- P1a readout — flat on odor
- P1c de-noise — negative
- P3b external odor data — flat (the "win" was a test-set artifact)

The weak-odor ceiling is **structural** — it does not move for readout, label
cleanliness, or data volume. The bottleneck is deeper (the SMILES→odor signal
itself, or the compound→ingredient aggregation step), not any of these levers.

**Methodological lesson (the important takeaway):** NEVER compare model variants
across different test sets. Every augment/ablation must be measured paired on an
identical held-out set (`--no-augment-train` control pattern). Cross-test-set
comparison conflates intervention effect with test-set difficulty and manufactures
phantom wins — it fooled this campaign through three runs until the paired control
exposed it.

---

## Architecture + featurization levers (on the honest paired-control infra)

Measured paired (identical splits/seeds, one variable toggled).

| lever | comparison | mean odor paired Δ | verdict |
|---|---|---|---|
| **GAT backbone** (GATv2 attention msg-passing) | vs GINE | **+0.017** (floral +0.058 @4/5, woody/spicy/fruity +; sweet +0.047, sour +0.035) | **WIN — banked** |
| Descriptors (8-dim physchem, head late-fusion) | vs GAT | -0.022 (sweet -0.074) | rejected |
| Chirality/stereo features | vs GAT | -0.012 | UNTESTABLE — only 0.5% of our SMILES carry stereo (101/19,902); features ~all-zero |

### Bottom line
Of every lever this session, **only the GAT backbone moved the weak odor heads** under
rigorous paired measurement. floral +0.058 (4/5 seeds) is the headline; it also lifts
sweet/sour. The odor gain came from a better INDUCTIVE BIAS (attention weights the
salient substructure), not from more input signal or data volume — readout-beyond-
mean_max, label de-noise, more molecular data, and physchem descriptors all came back
flat-to-negative.

Chirality is unresolved: the enantiomer-blindness ceiling is real but our upstream
SMILES (FlavorDB/ChemTastesDB) are non-isomeric, so the feature has nothing to encode.
Testing it properly needs re-sourcing isomeric SMILES (Leffingwell's WERE isomeric).

### Net banked config
GAT backbone + mean_max readout + 12 heads (incl. odor_nutty). That is the model
improvement this campaign produced.
