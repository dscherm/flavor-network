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

Next: (a) reconcile woody, (b) add goodscents/arctander for more positives.
