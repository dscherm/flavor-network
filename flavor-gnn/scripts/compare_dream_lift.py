"""Compare cv_results.json (post-DREAM retrain) vs the pre-DREAM backup.

Prints per-task mean F1 delta and verifies the N2-GNN-DREAM AC:
"≥4 of 5 odor heads (excluding spicy) improve by ≥0.03 vs current v3"

Run after src.train.train_multitask completes and writes the new
cv_results.json.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "flavor-gnn" / "artifacts"

ODOR_NON_SPICY = ("odor_fruity", "odor_floral", "odor_green",
                  "odor_woody", "odor_fatty")
ALL_TASKS = ("sweet", "bitter", "umami", "salty", "sour",
             "odor_fruity", "odor_floral", "odor_green", "odor_woody",
             "odor_spicy", "odor_fatty", "odor_nutty")


def _per_task_mean_f1(path: Path) -> dict[str, float]:
    """cv_results.json schema (per train_multitask.py):
       { "tasks": [...], "per_task": { "<task>": {"mean": float, "std": float,
         "per_fold": [...]}, ... }, ... }
    Returns {task: mean_f1}.
    """
    data = json.load(path.open("r", encoding="utf-8"))
    pt = data.get("per_task")
    if isinstance(pt, dict):
        return {t: float(v["mean"]) for t, v in pt.items()}
    raise ValueError(f"Unknown cv_results schema in {path}: keys={list(data.keys())}")


def main() -> int:
    new_path = ART / "cv_results.json"
    old_path = ART / "cv_results.json.pre-dream.bak"
    if not new_path.exists():
        print(f"ERROR: {new_path} not present — training didn't finish?")
        return 1
    if not old_path.exists():
        print(f"ERROR: backup {old_path} not present")
        return 1

    new_f1 = _per_task_mean_f1(new_path)
    old_f1 = _per_task_mean_f1(old_path)

    print(f"{'task':14s}  {'pre-DREAM':>10s}  {'+DREAM':>10s}  {'Δ':>8s}")
    print("-" * 50)
    for t in ALL_TASKS:
        n = new_f1.get(t, 0.0)
        o = old_f1.get(t, 0.0)
        d = n - o
        marker = "▲" if d >= 0.03 else ("▼" if d <= -0.03 else " ")
        print(f"{t:14s}  {o:10.3f}  {n:10.3f}  {d:+8.3f}  {marker}")

    print()
    print("AC check: ≥4 of 5 odor heads (excluding spicy) improve by ≥0.03 vs current v3")
    improved = []
    regressed = []
    for t in ODOR_NON_SPICY:
        d = new_f1.get(t, 0.0) - old_f1.get(t, 0.0)
        if d >= 0.03:
            improved.append((t, d))
        elif d <= -0.03:
            regressed.append((t, d))
    print(f"  improved (+0.03 or better): {len(improved)} / 5")
    for t, d in improved:
        print(f"    {t}: +{d:.3f}")
    if regressed:
        print(f"  regressed (-0.03 or worse): {len(regressed)}")
        for t, d in regressed:
            print(f"    {t}: {d:.3f}")
    print()
    if len(improved) >= 4:
        print("AC PASSED")
        return 0
    print(f"AC FAILED — only {len(improved)} of 5 mapped odor heads lifted by ≥0.03")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
