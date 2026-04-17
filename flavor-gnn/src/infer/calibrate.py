"""Logit-shift calibration to correct GNN prediction bias.

The training set is heavily curated toward positives (BitterDB = 1041 bitter+0
non-bitter, ChemTasteDB = taste-notable compounds only), so the classifier
head predicts bitter=17% and sweet=9% on FooDB's 70k compounds — far above a
reasonable food-compound prior.

Logit shift preserves the relative ranking per task while moving the mean
probability toward a target prior:

    logit_shift_i = log(target_i / (1 - target_i)) - log(train_i / (1 - train_i))
    p_calibrated  = sigmoid(logit(p_raw) + logit_shift_i)

This is the fastest debias — no retraining, no new data — and it fixes the
"everything looks bitter" symptom in the UI immediately. Confident predictions
(caffeine=0.99 bitter) stay confident; uncertain ones (most FooDB compounds)
shift toward the prior.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np


# Training label rates from compounds.parquet (2026-04-15 run):
#   bitter 49.5% | sweet 14.3% | umami 1.2% | salty 0.4% | sour 1.2%
TRAIN_PRIORS = {
    "sweet":  0.228,
    "bitter": 0.504,
    "umami":  0.023,
    "salty":  0.004,
    "sour":   0.019,
    "odor_fruity": 0.123,
    "odor_floral": 0.056,
    "odor_green":  0.119,
    "odor_woody":  0.103,
    "odor_spicy":  0.047,
    "odor_fatty":  0.071,
}

# Target priors — best-guess base rates in a random food compound.
#   - bitter ~10% (food compounds skew bitter because plants evolved for it)
#   - sweet ~6% (sugars + select diterpenes)
#   - umami/salty/sour ~1-3% (rarer in isolation)
# These can be tuned once we have a held-out balanced eval set.
# Target priors — calibrated aggressively for tasks with weak F1.
# Bitter + sweet have enough training signal; umami/salty/sour have <100
# positives each so the model defaults to over-predicting. Odor heads
# have decent signal (200-500 positives) so light correction only.
TARGET_PRIORS = {
    "sweet":  0.06,
    "bitter": 0.10,
    "umami":  0.005,
    "salty":  0.005,
    "sour":   0.01,
    "odor_fruity": 0.10,
    "odor_floral": 0.04,
    "odor_green":  0.10,
    "odor_woody":  0.08,
    "odor_spicy":  0.03,
    "odor_fatty":  0.05,
}


def _logit(p: float) -> float:
    p = min(max(p, 1e-6), 1.0 - 1e-6)
    return math.log(p / (1.0 - p))


def shift_vector(tasks: list[str]) -> np.ndarray:
    return np.array([
        _logit(TARGET_PRIORS[t]) - _logit(TRAIN_PRIORS[t]) for t in tasks
    ], dtype=np.float32)


def apply_shift(raw_probs: np.ndarray, tasks: list[str]) -> np.ndarray:
    """raw_probs: (N, T) sigmoid outputs. Returns calibrated probs, same shape."""
    raw = np.clip(raw_probs, 1e-6, 1.0 - 1e-6)
    logits = np.log(raw / (1.0 - raw))
    shifted = logits + shift_vector(tasks)[None, :]
    return 1.0 / (1.0 + np.exp(-shifted))


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def main() -> int:
    """Print the shift vector and an example transformation."""
    tasks = list(TARGET_PRIORS.keys())
    shift = shift_vector(tasks)
    print("Calibration shift vector (added to logits before sigmoid):")
    for t, s in zip(tasks, shift):
        print(f"  {t:7s} train={TRAIN_PRIORS[t]:.3f} -> target={TARGET_PRIORS[t]:.3f}   shift={s:+.3f}")

    # Example: raw 0.5 (uncertain) gets pulled toward each target prior.
    example_raw = np.array([[0.5, 0.5, 0.5, 0.5, 0.5]])
    calibrated = apply_shift(example_raw, tasks)
    print("\nExample: raw probs all 0.5 (max-entropy) calibrate to:")
    for t, p in zip(tasks, calibrated[0]):
        print(f"  {t:7s} {p:.3f}")

    # Dump to disk so other languages can read the shift
    out = _project_root() / "flavor-gnn" / "artifacts" / "calibration.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as fh:
        json.dump({
            "tasks": tasks,
            "train_priors": TRAIN_PRIORS,
            "target_priors": TARGET_PRIORS,
            "shift": shift.tolist(),
        }, fh, indent=2)
    print(f"\nwrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
