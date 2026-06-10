# GNN-LIFT-P0b — Held-out calibration vs on-test calibration (2026-06-09)

Audit Finding 3.2: `calibrate_thresholds.py` chose AND reported thresholds on the
same test rows. Fix: `--heldout` splits the test set 50/50 (stratified on bitter,
seed+1), sweeps thresholds on the calibration half, reports F1 on the held-out half.
Run on the existing `m3_multitask.pt` checkpoint (isolates the calibration leak from
the P0a/P0c retrains). Legacy on-test path preserved (default, no flag).

| head | on-test F1 | held-out F1 | drop | report positives |
|---|---|---|---|---|
| odor_floral | 0.515 | 0.333 | **-0.182** | 16 |
| odor_woody | 0.541 | 0.423 | **-0.118** | 39 |
| salty | 0.333 | 0.286 | -0.047 | 3 |
| odor_spicy | 0.329 | 0.294 | -0.035 | 18 |
| odor_fatty | 0.617 | 0.586 | -0.031 | 26 |
| odor_green | 0.606 | 0.576 | -0.030 | 44 |
| sour | 0.819 | 0.790 | -0.029 | 155 |
| bitter | 0.799 | 0.781 | -0.018 | 418 |
| sweet | 0.904 | 0.897 | -0.007 | 1167 |
| umami | 0.731 | 0.743 | +0.012 | 35 |
| odor_fruity | 0.722 | 0.739 | +0.017 | 51 |

## Interpretation
- **Calibration-on-test inflation is real and concentrated on the rare odor heads** —
  exactly the audit's prediction. odor_floral (16 pos) loses **0.182** and odor_woody
  (39 pos) loses **0.118** when the threshold must generalize to unseen rows.
- **Dense heads barely move** (sweet -0.007, bitter -0.018): their thresholds were
  well-calibrated; nothing to overfit.
- **Nuance that corrects the audit's framing:** umami (+0.012) and odor_fruity (+0.017)
  do NOT lose under held-out calibration — their high-threshold calibration genuinely
  generalizes. So umami's 0.73 is robust to the *calibration* leak; only the
  best-epoch leak (P0c) remains to test it. The audit's "umami stacks two leaks" was
  half-right: it stacks one.
- **salty (3 report positives) is pure noise** at this split — do not read its number.

## Caveat
The shipped per-ingredient thresholds (`odor_thresholds.json`,
`ingredient_profile_thresholds.json`) were NOT regenerated — this run only proves the
leak on the molecule-level checkpoint. When the P1 model is retrained, calibration
must use `--heldout` and the shipped thresholds re-derived from the held-out half.

## Status
P0b acceptance met: cal/report split in place behind `--heldout`, thresholds chosen on
calibration half, F1 reported on held-out half, `threshold_calibration_heldout.json`
written, v3 `threshold_calibration.json` preserved, shipped thresholds untouched.
**Uncommitted.**
