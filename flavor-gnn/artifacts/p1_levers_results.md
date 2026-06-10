# P1 Feature Lever Results (measured vs DeepChem scaffold baseline)

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

## P3b — Leffingwell odor-data ingestion — **WORKS**

Ingested the Leffingwell odor set (3,522 molecules, 113 binary odor descriptors
mapped to our 6 heads). Odor-observed molecules 1,383 → 4,645; weak heads 2.6–4x positives.
Two measurements, both `mean_max` readout, 5 seeds:

**(1) Combined** (Leffingwell labels OR'd + net-new molecules, augmented test):
floral +0.095, fatty +0.106, fruity +0.045, green +0.039, spicy -0.010, woody -0.081.
Suggestive but the test set changed (confound).

**(2) Train-only confirmation** (Leffingwell forced 100% into TRAIN, test = pure
ORIGINAL molecules + ORIGINAL labels — verified 0 augment leak):

| odor head | baseline | +Leffingwell(train) | Δ | verdict |
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
Leffingwell's woody distribution (earthy/pine/smoky/woody) conflicts with our
FlavorDB woody (which still includes nutty/mushroom in the ORIGINAL labels).
Fix: exclude Leffingwell's woody mapping, or reconcile the woody vocab.

### Woody conflict — diagnosed + fixed (exclude woody from the Leffingwell merge)

Root cause, three compounding factors confirmed on the data:
1. **Vocabulary disagreement.** Leffingwell maps only {earthy, pine, smoky,
   woody} → odor_woody. Our FlavorDB woody was built with a broader set that
   counts nutty + mushroom. Of 432 original woody positives, 121 (28%) carry a
   nutty/mushroom tag and **81 (19%) are woody ONLY because of nutty/mushroom** —
   labels Leffingwell explicitly calls NOT woody.
2. **Prior shift.** Woody positive rate is **31% in our data vs 11% in the
   Leffingwell augment** (224/1980). Mixing in 1,980 low-woody molecules pulls
   the model's woody prior down → recall collapses on the 31%-prevalence test set.
3. **Exact-match mapping gap.** Ingest maps descriptors with exact `dl in kws`,
   so Leffingwell's `balsamic` descriptor never reaches woody (our keyword is
   `balsam`), making the augment woody set even sparser than intended.

(1) and (2) push the same direction (systematic woody false-negatives) and are
the dominant cause; (3) worsens (2). De-noising the *original* woody labels was
already shown not to help (P1c: odor_woody -0.019).

**Fix applied:** `LEFFINGWELL_EXCLUDE = {"woody"}` in both ingest scripts —
woody keeps its ORIGINAL labels untouched (existing rows) and is left
*unobserved* (mask=0) on net-new augment rows, so Leffingwell contributes zero
woody signal. The other 5 odor heads still merge and keep their lifts.
Regenerated `compounds_p3b.parquet` + `compounds_p3b_trainonly.parquet` confirm:
augment woody = 0 pos / 0 obs; original woody = 432 / 1383 unchanged.
Expected effect: odor_woody returns to its ~0.517 baseline while floral/fatty/
fruity/green/spicy retain their gains. **Pending: re-run the 5-seed train-only
scaffold eval to confirm the F1 numbers.**

**Caveat:** taste heads wobbled (sweet +0.05, sour -0.11) because the train-only
test set (1,273 pure-original) differs in size/composition from the baseline split
(~1,991). Leffingwell adds no taste signal, so that wobble is test-set noise — the
ODOR comparison is the valid one, and even there the consistency across two runs is
the evidence, not any single number.

### VERDICT
**Scraping molecular odor data is the lever the model-side experiments weren't.**
P1a (readout) and P1c (de-noise) left the weak odor heads flat; Leffingwell lifts
floral +0.12 and fatty +0.14 on rigorous measurement. This confirms the weak-odor
ceiling was a DATA-QUANTITY problem, exactly as the failed model-side levers implied.

Next: (a) ~~reconcile woody~~ DONE — woody excluded from the merge (see above);
re-run the train-only eval to confirm. (b) add goodscents/arctander for more
positives.

## odor_nutty head + woody reconciliation — measured (5-seed scaffold, mean_max)

Followed through on the woody fix differently than the exclude-from-merge stopgap:
split the Maillard/roast cluster into a dedicated **odor_nutty** head (7th odor
head), kept mushroom in woody, re-enabled Leffingwell woody, and fixed the
descriptor matcher (exact -> substring, so `balsamic` reaches woody). Two 5-seed
runs: a 12-head FlavorDB-only baseline and a +Leffingwell train-only run.
Artifacts: `cv_results_scaffold_nutty_baseline.json`,
`cv_results_scaffold_nutty_p3b_trainonly.json`.

| head | baseline | +Leffingwell | Δ | test pos/seed (base→aug) | trust |
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
  architecture change. The `nutty 0.155` under +Leffingwell is **not real** —
  the pure-original test has only 3 nutty positives/seed (one seed had 1 →
  F1 0.000). Whether Leffingwell helps nutty is **unmeasurable** with this design.
- **Woody recovered as a head.** Splitting nutty out cost woody nothing (baseline
  0.497 ≈ its historical ~0.517) and the original -0.157 conflict is gone. But
  reconciliation did **not** turn Leffingwell into a woody *lift* — the +Leffingwell
  woody (-0.089) is on a degraded test (11 pos/seed, one seed = 3 → 0.222), so the
  augment effect on woody is neutral-to-unknown, not a win.
- **Credible Leffingwell odor lifts: fatty +0.12, fruity +0.06** (enough test
  positives to trust; fatty matches the earlier P3b +0.142).
- **Methodological gap:** the train-only design (augment forced to train, test on
  pure-original) is underpowered for rare heads (nutty/woody) because it shrinks
  the test set. A trustworthy nutty/woody augment read needs more seeds (15-20) or
  an eval that doesn't starve the test set.

### Decision
Keep the 12-head model with the nutty head. Production policy for Leffingwell on
nutty/woody is still open (merge-all vs exclude-those-two) — unresolved because
the measurement can't separate them; the dense-head lifts (fatty/fruity) are the
banked win.
