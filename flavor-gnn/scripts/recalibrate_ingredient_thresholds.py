"""Recalibrate public/proDataset/ingredient_profile_thresholds.json against
the current gnn_entropy.json.

Background — N2-AGG-RECAL (2026-05-26)
--------------------------------------
N2-GNN-AGG (committed 2026-05-26, 3327661) replaced single-representative
mean-pool with per-task top-3 mean across the top-10 compounds. This
shifted per-ingredient probs upward, but ingredient_profile_thresholds.json
was generated against the OLD mean-pool distribution. The stale
thresholds produced a severe Tier-1 bias: 829/1010 GNN-scored long-tail
ingredients (82%) picked `woody` as their primary Tier-1 aroma, vs 0 for
green/floral.

The artifact's convention: each ingredient_threshold = 85th percentile of
ingredient-level GNN probabilities for that task, so the top-15% of
ingredients clear it. After top-3 aggregation those percentiles shift —
this script recomputes them.

Production gate: heads with molecule-level calibrated F1 < 0.4 (per
threshold_calibration_v3.json) are disabled by setting their
ingredient_threshold to 1.01 — no ingredient can clear that, so the UI
won't surface them. This matches the existing artifact's stated
min_molecule_level_f1 = 0.4 policy.

Usage:
    python -m scripts.recalibrate_ingredient_thresholds
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]

PERCENTILE = 0.85
MIN_MOLECULE_LEVEL_F1 = 0.4
DISABLED_THRESHOLD = 1.01

TASKS = ("sweet", "bitter", "umami", "salty", "sour",
         "odor_fruity", "odor_floral", "odor_green", "odor_woody",
         "odor_spicy", "odor_fatty")


def load_molecule_f1() -> dict[str, float]:
    """Read v3 calibrated molecule-level F1 per task."""
    path = ROOT / "flavor-gnn" / "artifacts" / "threshold_calibration_v3.json"
    data = json.load(path.open("r", encoding="utf-8"))
    return {e["task"]: float(e["calibrated_f1"]) for e in data["per_task"]}


def load_ingredient_probs() -> dict[str, list[float]]:
    """Per-task list of all per-ingredient probs from gnn_entropy.json."""
    path = ROOT / "public" / "proDataset" / "gnn_entropy.json"
    data = json.load(path.open("r", encoding="utf-8"))
    out = {t: [] for t in TASKS}
    for name, v in data.items():
        if name.startswith("_"):
            continue
        probs = v.get("probs", {})
        for t in TASKS:
            p = probs.get(t)
            if isinstance(p, (int, float)):
                out[t].append(float(p))
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--out",
        default=str(ROOT / "public" / "proDataset" / "ingredient_profile_thresholds.json"),
    )
    parser.add_argument("--percentile", type=float, default=PERCENTILE)
    args = parser.parse_args()

    molecule_f1 = load_molecule_f1()
    probs_by_task = load_ingredient_probs()

    per_task = []
    print(f"[recal] percentile={args.percentile}  min_molecule_f1={MIN_MOLECULE_LEVEL_F1}\n")
    print(f"{'task':14s}  {'mol_F1':>7s}  {'p85_raw':>9s}  {'shipped':>9s}  {'note':12s}")
    print("-" * 60)
    for t in TASKS:
        mol_f1 = molecule_f1.get(t, 0.0)
        ps = probs_by_task[t]
        p_raw = float(np.quantile(np.asarray(ps), args.percentile)) if ps else None
        if p_raw is None:
            shipped = DISABLED_THRESHOLD
            note = "no probs"
        elif mol_f1 < MIN_MOLECULE_LEVEL_F1:
            shipped = DISABLED_THRESHOLD
            note = f"F1<{MIN_MOLECULE_LEVEL_F1}, disabled"
        else:
            shipped = round(p_raw, 4)
            note = ""
        per_task.append({
            "task": t,
            "ingredient_threshold": shipped,
            "molecule_f1": round(mol_f1, 4),
        })
        p_raw_display = f"{p_raw:.4f}" if p_raw is not None else "—"
        print(f"{t:14s}  {mol_f1:7.3f}  {p_raw_display:>9s}  {shipped:>9.4f}  {note}")

    out = {
        "generated_by": "85th percentile of per-ingredient GNN probabilities under top-3 mean aggregation (N2-AGG-RECAL); molecule_f1 from v3 calibrated test split",
        "percentile": args.percentile,
        "min_molecule_level_f1": MIN_MOLECULE_LEVEL_F1,
        "disabled_threshold": DISABLED_THRESHOLD,
        "per_task": per_task,
    }
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2)
    print(f"\n[recal] wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
