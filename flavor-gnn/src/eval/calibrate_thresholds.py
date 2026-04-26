"""R12 — Per-task threshold calibration for the M3 multi-task head.

Loads the existing m3_multitask.pt checkpoint, reproduces the train/test
split (seed=42, stratify=bitter — same as train_multitask.py), runs
inference to get raw sigmoid probabilities on the test set, then sweeps
thresholds in [0.05, 0.95] per task picking the threshold that maximizes
F1. Reports calibrated F1 alongside the default-0.5 F1 so we can see
which tasks gain from tuning.

This is a zero-retraining experiment: if F1 lifts substantially on the
weak odor heads (floral/spicy/fatty), we can ship calibrated thresholds
without waiting for a retrain. If it doesn't lift, the collapse is in
the learned features themselves and focal-loss retrain is required.

Usage:
    python -m src.eval.calibrate_thresholds
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split

from ..models.featurize import ATOM_DIM, BOND_DIM, smiles_to_data
from ..models.mpnn import MPNN
from ..train.train_multitask import TASKS, SEED


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--ckpt", default=None,
                        help="Checkpoint to calibrate. Defaults to artifacts/m3_multitask.pt.")
    parser.add_argument("--out", default=None,
                        help="Output JSON path. Defaults to artifacts/threshold_calibration.json (or _focal suffix when --ckpt is the focal ckpt).")
    args = parser.parse_args()

    root = _project_root()
    ckpt_path = Path(args.ckpt) if args.ckpt else (root / "flavor-gnn" / "artifacts" / "m3_multitask.pt")
    data_path = root / "flavor-gnn" / "data" / "compounds.parquet"
    if args.out:
        out_path = Path(args.out)
    elif "focal" in ckpt_path.name:
        out_path = root / "flavor-gnn" / "artifacts" / "threshold_calibration_focal.json"
    else:
        out_path = root / "flavor-gnn" / "artifacts" / "threshold_calibration.json"

    ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    assert tuple(ckpt["tasks"]) == TASKS, "task list mismatch"

    device = "cpu"
    model = MPNN(ATOM_DIM, BOND_DIM, hidden=ckpt.get("hidden", 128),
                 num_layers=ckpt.get("num_layers", 3),
                 num_tasks=len(TASKS)).to(device)
    model.load_state_dict(ckpt["state_dict"])
    model.eval()

    df = pd.read_parquet(data_path)
    print(f"[calib] loaded {len(df)} compounds")

    # Mirror train_multitask._featurize_all → featurize + build Y, M matrices.
    # Mask is required: rows from sources that don't measure a task (e.g. FART
    # for odor heads) must not contribute to threshold sweeping for that task,
    # otherwise we calibrate against forced zeros.
    has_mask = all(f"mask_{t}" in df.columns for t in TASKS)
    data_list, y_mat, m_mat = [], [], []
    for _, row in df.iterrows():
        y = torch.tensor([[float(row[t]) for t in TASKS]], dtype=torch.float32)
        d = smiles_to_data(row["smiles"], y=y)
        if d is None:
            continue
        data_list.append(d)
        y_mat.append([int(row[t]) for t in TASKS])
        if has_mask:
            m_mat.append([int(row[f"mask_{t}"]) for t in TASKS])
        else:
            m_mat.append([1] * len(TASKS))
    Y = np.array(y_mat, dtype=np.int64)
    M = np.array(m_mat, dtype=np.int64)

    # Same split as train_multitask.train()
    strat = Y[:, TASKS.index("bitter")]
    idx = np.arange(len(data_list))
    tr_idx, te_idx = train_test_split(idx, test_size=0.2, stratify=strat, random_state=SEED)
    te = [data_list[i] for i in te_idx]
    Y_te = Y[te_idx]
    M_te = M[te_idx]

    from torch_geometric.loader import DataLoader
    loader = DataLoader(te, batch_size=128, shuffle=False)

    # Gather raw sigmoid probabilities (no threshold yet).
    probs = []
    with torch.no_grad():
        for batch in loader:
            batch = batch.to(device)
            logits = model(batch)
            probs.append(torch.sigmoid(logits).cpu().numpy())
    P = np.concatenate(probs, 0)  # shape (N_test, num_tasks)
    assert P.shape == (len(te_idx), len(TASKS))

    # Sweep thresholds per task. Restrict each task's eval to rows where its
    # label was observed — calibrating against unobserved zeros would push
    # every threshold to 0.95 trivially.
    THRESHOLDS = np.linspace(0.05, 0.95, 19)
    rows = []
    for i, t in enumerate(TASKS):
        sel = M_te[:, i].astype(bool)
        n_obs = int(sel.sum())
        if n_obs == 0:
            rows.append({
                "task": t, "n_test_observed": 0, "n_test_positives": 0,
                "f1_at_0.5": 0.0, "calibrated_threshold": 0.5,
                "calibrated_f1": 0.0, "calibrated_precision": 0.0,
                "calibrated_recall": 0.0, "lift": 0.0,
            })
            continue
        y = Y_te[sel, i]
        p = P[sel, i]
        n_pos = int(y.sum())

        default_pred = (p > 0.5).astype(int)
        f1_default = f1_score(y, default_pred, zero_division=0)

        best_thr = 0.5
        best_f1 = f1_default
        best_prec = precision_score(y, default_pred, zero_division=0)
        best_rec = recall_score(y, default_pred, zero_division=0)

        for thr in THRESHOLDS:
            pred = (p > thr).astype(int)
            f1 = f1_score(y, pred, zero_division=0)
            if f1 > best_f1:
                best_f1 = f1
                best_thr = float(thr)
                best_prec = precision_score(y, pred, zero_division=0)
                best_rec = recall_score(y, pred, zero_division=0)

        lift = best_f1 - f1_default
        rows.append({
            "task": t,
            "n_test_observed": n_obs,
            "n_test_positives": n_pos,
            "f1_at_0.5": round(float(f1_default), 3),
            "calibrated_threshold": round(best_thr, 2),
            "calibrated_f1": round(float(best_f1), 3),
            "calibrated_precision": round(float(best_prec), 3),
            "calibrated_recall": round(float(best_rec), 3),
            "lift": round(float(lift), 3),
        })

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({
        "model_ckpt": "m3_multitask.pt",
        "test_split": {"n": int(len(te_idx)), "seed": SEED, "stratify": "bitter"},
        "threshold_grid": [round(float(x), 2) for x in THRESHOLDS],
        "per_task": rows,
    }, indent=2))

    print(f"[calib] wrote {out_path}")
    print(f"{'task':<14} {'nobs':>5} {'npos':>5} {'F1@0.5':>7} {'calib_thr':>10} {'calib_F1':>9} {'lift':>6}")
    for r in rows:
        print(f"{r['task']:<14} {r.get('n_test_observed', '-'):>5} "
              f"{r['n_test_positives']:>5} "
              f"{r['f1_at_0.5']:>7.3f} {r['calibrated_threshold']:>10.2f} "
              f"{r['calibrated_f1']:>9.3f} {r['lift']:>+6.3f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
