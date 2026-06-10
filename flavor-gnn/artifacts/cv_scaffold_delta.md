# GNN-LIFT-P0a — Scaffold-split CV vs random-split baseline (2026-06-09)

Replaced random `StratifiedKFold` with `GroupKFold` keyed on Bemis-Murcko scaffold
in `train_multitask.cross_validate` (`--scaffold` flag). Both runs: 5 folds, 15
epochs, seed 42, BCE+pos_weight, mask-aware F1, same `compounds.parquet`.
Scaffold split verified scaffold-disjoint (0 scaffold overlap across folds;
5,506 distinct scaffolds over 19,902 compounds).

| task | random | scaffold | delta | scaffold fold-std |
|---|---|---|---|---|
| sweet | 0.898 | 0.880 | -0.018 | 0.031 |
| bitter | 0.786 | 0.746 | -0.040 | 0.083 |
| umami | 0.563 | 0.548 | -0.015 | 0.089 |
| salty | 0.235 | 0.260 | +0.026 | 0.090 |
| sour | 0.830 | 0.788 | **-0.043** | 0.032 |
| odor_fruity | 0.722 | 0.710 | -0.012 | 0.077 |
| odor_floral | 0.502 | 0.518 | +0.016 | 0.084 |
| odor_green | 0.607 | 0.600 | -0.007 | 0.049 |
| odor_woody | 0.546 | 0.549 | +0.003 | 0.049 |
| odor_spicy | 0.346 | 0.321 | -0.026 | 0.053 |
| odor_fatty | 0.592 | 0.546 | **-0.047** | 0.154 |

## Interpretation
- **Inflation is real but modest, not dramatic.** 8 of 11 heads drop or stay flat
  under scaffold split; mean change ≈ **-0.016**. The audit's "almost certainly
  inflated" is directionally confirmed but the magnitude is smaller than a worst-case
  reading implied.
- **Largest, mechanism-consistent drop is sour (-0.043).** Matches the audit's
  hypothesis that FartDB's homologous carboxylic-acid series leaks across random
  folds — even though acyclic acids each get their own scaffold-fallback key, the
  shared *ring* sweeteners that co-train no longer help sour at test.
- **bitter (-0.040) and odor_fatty (-0.047)** also drop, but their scaffold fold-std
  (0.083 / 0.154) means these are within ~1 fold-std — directional, not decisive.
- **+salty / +odor_floral are noise** (10 / 43 positives; std ≈ their delta).
- **Fold variance widened materially** (e.g. bitter std 0.008 random → 0.083 scaffold).
  The random split was over-optimistic about *stability*, not just level.

## Caveats
- These scaffold numbers still carry the **best-epoch-on-test** leak (audit Finding
  2.3 / task GNN-LIFT-P0c, not yet applied). This run isolates the *scaffold* effect
  alone (random+best-epoch vs scaffold+best-epoch). P0c will lower both further and is
  the honest next correction.
- Acyclic homologous series still group individually (Murcko scaffold empty →
  SMILES fallback) — a documented limitation; the dominant ring-rich sweetener leak
  is fixed.

## Status
P0a acceptance met: GroupKFold-on-MurckoScaffold in place, `cv_results_scaffold.json`
written, random `cv_results.json` preserved, per-head delta reported, mask-aware eval
preserved, no production model/threshold artifact overwritten. **Uncommitted.**

---

# UPDATE — P0c applied: scaffold + validation-epoch selection (2026-06-09)

`cv_results_scaffold.json` was regenerated after GNN-LIFT-P0c (validation-loss epoch
selection replaces best-epoch-on-test in `_train_one_fold`). This is the FULLY honest
baseline: out-of-scaffold folds AND no test-set early-stopping.

| task | random+best-epoch | scaffold+val-epoch | total Δ | fold-std |
|---|---|---|---|---|
| sweet | 0.898 | 0.738 | -0.160 | **0.199** |
| bitter | 0.786 | 0.730 | -0.056 | 0.089 |
| umami | 0.563 | 0.458 | -0.105 | 0.043 |
| salty | 0.235 | 0.128 | -0.106 | 0.097 |
| sour | 0.830 | 0.734 | -0.096 | 0.062 |
| odor_fruity | 0.722 | 0.672 | -0.050 | 0.049 |
| odor_floral | 0.502 | 0.433 | -0.070 | 0.093 |
| odor_green | 0.607 | 0.541 | -0.066 | 0.088 |
| odor_woody | 0.546 | 0.491 | -0.055 | 0.062 |
| odor_spicy | 0.346 | 0.289 | -0.057 | 0.077 |
| odor_fatty | 0.592 | 0.477 | -0.115 | **0.219** |

Mean Δ vs original baseline: **-0.085** (vs -0.016 for scaffold alone → the
best-epoch-on-test leak was the DOMINANT inflation source, ~0.07 of the 0.085).

## CRITICAL methodological finding — the honest baseline is UNSTABLE
The high fold-std on sweet (0.199) and odor_fatty (0.219) is NOT real generalization
spread — it's a **fold-1 collapse** from val-loss epoch selection under an
under-powered training recipe:

```
sweet      per-fold: [0.362, 0.706, 0.884, 0.852, 0.887]   <- fold 1 collapsed
odor_fatty per-fold: [0.054, 0.524, 0.684, 0.586, 0.537]   <- fold 1 collapsed
bitter     per-fold: [0.559, 0.772, 0.734, 0.778, 0.807]   <- fold 1 low
umami      per-fold: [0.426, 0.440, 0.538, 0.466, 0.419]   <- stable
sour       per-fold: [0.807, 0.787, 0.698, 0.634, 0.744]   <- stable
```

Fold 1 picks an under-converged early epoch as its val-loss minimum (15 flat-LR epochs
give a noisy val-loss trajectory; on fold 1 the dense heads aren't trained yet at the
selected epoch). Folds 2-5 give the representative honest level: sweet ~0.85, bitter
~0.77, odor_fatty ~0.58.

**Implication — re-sequencing recommendation:** GNN-LIFT-P1e (LR schedule + more epochs
+ early-stopping-with-patience) should move BEFORE the other P1 feature levers. Until
the recipe gives a STABLE honest baseline, P1a/P1b/P1c deltas can't be measured against
a ±0.2 baseline. P0c is methodologically correct (the leak is gone) but it exposed that
the training recipe — not just the measurement — needs the P1e fix to be trustworthy.

---

# UPDATE 2 — P1e applied + benzene mega-scaffold finding (2026-06-09)

Re-ran with GNN-LIFT-P1e (cosine LR schedule + early-stopping patience=8, 40 max
epochs). P1e reduced the under-training variance (sweet fold-1 0.36 → 0.50) but did
NOT eliminate the fold-1 collapse — because the collapse is mostly NOT under-training.

**Root cause: benzene (`c1ccccc1`) is 20.9% of the corpus (4150 of 19,902).**
GroupKFold cannot split a scaffold group, so it places ALL 4150 benzene-scaffold
compounds in ONE fold's test set with ZERO benzene in that fold's training. The model
is asked to predict the single most common ring in chemistry having never seen it —
a pathologically pessimistic scenario that does not reflect deployment (real inference
always has benzene rings in training). That one fold drags every head down at once,
which is why fold 1 is uniformly low (a per-head epoch artifact would not be uniform).

Scaffold size distribution: top scaffold = benzene 20.9%; top-12 cover 37.1%; 4,120
singletons. A handful of mega-scaffolds make pure GroupKFold adversarial.

## Realistic baseline (drop the single benzene-holdout fold)

| task | random+BE | scaffold all-fold | scaffold drop-worst | realistic Δ |
|---|---|---|---|---|
| sweet | 0.898 | 0.784 | 0.856 | -0.042 |
| bitter | 0.786 | 0.732 | 0.779 | -0.007 |
| umami | 0.563 | 0.440 | **0.473** | **-0.090** |
| salty | 0.235 | 0.177 | 0.221 | -0.014 |
| sour | 0.830 | 0.786 | 0.796 | -0.034 |
| odor_fruity | 0.722 | 0.662 | 0.698 | -0.025 |
| odor_floral | 0.502 | 0.435 | 0.481 | -0.021 |
| odor_green | 0.607 | 0.581 | 0.599 | -0.008 |
| odor_woody | 0.546 | 0.472 | 0.492 | -0.054 |
| odor_spicy | 0.346 | 0.288 | 0.312 | -0.034 |
| odor_fatty | 0.592 | 0.472 | 0.553 | -0.040 |

**Realistic mean Δ ≈ -0.034** (vs -0.085 all-fold). The original numbers were modestly
inflated, NOT dramatically. **umami (-0.090) is the genuine casualty** — the rare taste
head most exposed by honest out-of-scaffold measurement, and the clearest target for
the P1 feature levers. bitter and odor_green are robust (≈ unchanged).

## Open methodology decision (P0a refinement)
Pure Murcko GroupKFold is too pessimistic with a 21% mega-scaffold. Candidate fixes:
(B) size-cap scaffold groups (sub-partition any group > ~2% so benzene spans folds);
(C) DeepChem-style scaffold split (mega-scaffolds → train, hold out diverse rarer
scaffolds); (D) keep pure GroupKFold but report the drop-worst-fold realistic number
and flag fold-1 = benzene-holdout as a pessimistic bound. Pending user decision before
the canonical baseline is locked.

---

# CANONICAL BASELINE — DeepChem balanced scaffold split (2026-06-09)

User-selected methodology. `cv_results_scaffold.json` (locked copy:
`cv_results_scaffold_baseline.json`). 5 seeds, readout=mean, cosine LR +
early-stop (P0c+P1e), benzene pinned to train every seed, 0 scaffold leakage.
This is THE baseline every P1 feature lever is judged against.

| task | random+BE | deepchem (mean±std) | Δ | per-seed |
|---|---|---|---|---|
| sweet | 0.898 | 0.823 ± 0.107 | -0.076 | [.87 .85 .88 .90 .61] |
| bitter | 0.786 | 0.799 ± 0.023 | **+0.013** | [.82 .76 .79 .82 .81] |
| umami | 0.563 | 0.528 ± 0.102 | -0.035 | [.70 .52 .51 .53 .38] |
| salty | 0.235 | 0.191 ± 0.096 | -0.044 | [.12 .29 .15 .07 .32] |
| sour | 0.830 | 0.754 ± 0.086 | -0.076 | [.59 .81 .84 .74 .79] |
| odor_fruity | 0.722 | 0.744 ± 0.045 | **+0.022** | [.69 .77 .78 .79 .69] |
| odor_floral | 0.502 | 0.358 ± 0.078 | **-0.144** | [.33 .38 .40 .46 .23] |
| odor_green | 0.607 | 0.585 ± 0.057 | -0.022 | [.61 .66 .60 .56 .49] |
| odor_woody | 0.546 | 0.517 ± 0.070 | -0.029 | [.52 .58 .38 .54 .56] |
| odor_spicy | 0.346 | 0.289 ± 0.056 | -0.058 | [.20 .26 .37 .29 .32] |
| odor_fatty | 0.592 | 0.522 ± 0.042 | -0.071 | [.45 .52 .58 .55 .51] |

Mean Δ vs random = **-0.047**; mean seed-std = 0.069.

## Final honest read
- **odor_floral was the most inflated head: -0.144** (0.50 → 0.36). It does not
  generalize to novel scaffolds — random-split CV badly overstated it.
- **bitter (+0.013) and odor_fruity (+0.022) are robust** — random split was NOT
  inflating them; they generalize cleanly out-of-scaffold.
- sweet/sour/fatty/spicy: modest real drops (-0.06 to -0.08).
- umami -0.035 — smaller than the GroupKFold estimate (benzene-in-train helps the
  GPCR taste heads). umami's honest level is ~0.53, still the weakest taste head and
  a prime P1 target.
- Overall: the original numbers were modestly inflated (~0.05 mean), with floral the
  one severe case. The model genuinely generalizes for most heads.

## How P1 levers will be judged (PAIRED comparison)
Seed-std is ~0.07, so comparing lever-mean vs baseline-mean directly is underpowered.
Instead, each lever runs the SAME 5 seeds (SEED+s); we compare PER-SEED PAIRED
(lever seed_i − baseline seed_i). Paired differencing cancels the seed-difficulty
variance (the thing driving the 0.07 std), so a consistent +0.03 lift across seeds is
detectable even though the marginal stds overlap. A lever "wins" if the paired mean
delta is positive AND consistent in sign across most seeds.

## Honest baseline takeaways (reading the stable folds)
- The original numbers WERE inflated, dominated by best-epoch-on-test (~0.07 mean).
- Stable-fold honest level: sweet ~0.85, bitter ~0.77, sour ~0.73, umami ~0.45
  (umami is the most stable AND lands well below its old 0.563 — the rare-head that
  most needs the P1 levers).
- umami's true level (~0.45) is notably below the shipped narrative (0.731 calibrated).
  Combined with P0b (calibration robust for umami), the inflation is the epoch leak,
  not calibration.
