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
    parser.add_argument("--heldout", action="store_true",
                        help="Audit Finding 3.2 fix: split the test set 50/50, sweep thresholds on "
                             "the calibration half, and report F1 on the held-out report half. "
                             "Removes calibration-on-test leakage. Writes _heldout artifact.")
    args = parser.parse_args()

    root = _project_root()
    ckpt_path = Path(args.ckpt) if args.ckpt else (root / "flavor-gnn" / "artifacts" / "m3_multitask.pt")
    data_path = root / "flavor-gnn" / "data" / "compounds.parquet"
    if args.out:
        out_path = Path(args.out)
    elif args.heldout:
        out_path = root / "flavor-gnn" / "artifacts" / "threshold_calibration_heldout.json"
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

    # P0b (audit Finding 3.2): when --heldout, split the test set 50/50 into a
    # calibration half (thresholds chosen here) and a report half (F1 reported
    # here). `cal_pos` / `rep_pos` are boolean masks over te_idx positions so we
    # can keep a single inference pass over `te`. Without --heldout, both masks
    # cover the whole test set (legacy calibration-on-test behavior, unchanged).
    if args.heldout:
        strat_te = Y_te[:, TASKS.index("bitter")]
        cal_sel, rep_sel = train_test_split(
            np.arange(len(te_idx)), test_size=0.5,
            stratify=strat_te, random_state=SEED + 1,
        )
        cal_pos = np.zeros(len(te_idx), dtype=bool); cal_pos[cal_sel] = True
        rep_pos = np.zeros(len(te_idx), dtype=bool); rep_pos[rep_sel] = True
    else:
        cal_pos = np.ones(len(te_idx), dtype=bool)
        rep_pos = np.ones(len(te_idx), dtype=bool)

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
        obs = M_te[:, i].astype(bool)
        cal = obs & cal_pos   # rows used to CHOOSE the threshold
        rep = obs & rep_pos   # rows used to REPORT F1 (held out when --heldout)
        n_obs = int(rep.sum())
        if cal.sum() == 0 or rep.sum() == 0:
            rows.append({
                "task": t, "n_test_observed": int(rep.sum()), "n_test_positives": 0,
                "n_cal_observed": int(cal.sum()),
                "f1_at_0.5": 0.0, "calibrated_threshold": 0.5,
                "calibrated_f1": 0.0, "calibrated_precision": 0.0,
                "calibrated_recall": 0.0, "lift": 0.0,
            })
            continue
        y_cal, p_cal = Y_te[cal, i], P[cal, i]
        y_rep, p_rep = Y_te[rep, i], P[rep, i]
        n_pos = int(y_rep.sum())

        # Choose the threshold on the calibration subset only.
        best_thr = 0.5
        best_cal_f1 = f1_score(y_cal, (p_cal > 0.5).astype(int), zero_division=0)
        for thr in THRESHOLDS:
            f1 = f1_score(y_cal, (p_cal > thr).astype(int), zero_division=0)
            if f1 > best_cal_f1:
                best_cal_f1 = f1
                best_thr = float(thr)

        # Report all metrics on the held-out report subset, at the chosen thr.
        rep_default = (p_rep > 0.5).astype(int)
        rep_pred = (p_rep > best_thr).astype(int)
        f1_default = f1_score(y_rep, rep_default, zero_division=0)
        rep_f1 = f1_score(y_rep, rep_pred, zero_division=0)
        rep_prec = precision_score(y_rep, rep_pred, zero_division=0)
        rep_rec = recall_score(y_rep, rep_pred, zero_division=0)

        lift = rep_f1 - f1_default
        rows.append({
            "task": t,
            "n_test_observed": n_obs,
            "n_cal_observed": int(cal.sum()),
            "n_test_positives": n_pos,
            "f1_at_0.5": round(float(f1_default), 3),
            "calibrated_threshold": round(best_thr, 2),
            "calibrated_f1": round(float(rep_f1), 3),
            "calibrated_precision": round(float(rep_prec), 3),
            "calibrated_recall": round(float(rep_rec), 3),
            "lift": round(float(lift), 3),
        })

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({
        "model_ckpt": ckpt_path.name,
        "calibration_mode": "heldout" if args.heldout else "on_test",
        "test_split": {"n": int(len(te_idx)), "seed": SEED, "stratify": "bitter",
                       "heldout_calibration": bool(args.heldout),
                       "cal_report_split": "50/50 seed+1" if args.heldout else None},
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
