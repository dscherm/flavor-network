"""5-fold stratified cross-validation + calibration analysis.

Reports mean±std F1 per task across 5 folds. Also computes a simple
calibration metric: for each predicted-probability bin (0-10%, 10-20%, ...),
what fraction of compounds are actually positive? Dumps results to
artifacts/cv_results.json.

Usage:
    python -m src.eval.cross_validate
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
from sklearn.metrics import f1_score, precision_score, recall_score
from sklearn.model_selection import StratifiedKFold

from ..models.featurize import ATOM_DIM, BOND_DIM, smiles_to_data
from ..models.mpnn import MPNN

TASKS = ("sweet", "bitter", "umami", "salty", "sour",
         "odor_fruity", "odor_floral", "odor_green", "odor_woody", "odor_spicy", "odor_fatty")
SEED = 42


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _set_seed(s: int) -> None:
    random.seed(s); np.random.seed(s); torch.manual_seed(s)


def _featurize_all(df: pd.DataFrame):
    from torch_geometric.data import Data  # noqa
    data_list, y_mat = [], []
    for _, row in df.iterrows():
        y = [float(row[t]) for t in TASKS]
        d = smiles_to_data(row["smiles"], y=torch.tensor([y], dtype=torch.float32))
        if d is None:
            continue
        data_list.append(d)
        y_mat.append([int(row[t]) for t in TASKS])
    return data_list, np.array(y_mat, dtype=np.int64)


def train_and_eval_fold(data_list, Y, tr_idx, te_idx, epochs=25, batch_size=64, device="cpu"):
    from torch_geometric.loader import DataLoader

    tr = [data_list[i] for i in tr_idx]
    te = [data_list[i] for i in te_idx]
    Y_tr = Y[tr_idx]

    tr_loader = DataLoader(tr, batch_size=batch_size, shuffle=True)
    te_loader = DataLoader(te, batch_size=batch_size, shuffle=False)

    pos_weight = torch.tensor(
        [(len(Y_tr) - Y_tr[:, i].sum()) / max(1, Y_tr[:, i].sum()) for i in range(len(TASKS))],
        dtype=torch.float32, device=device,
    )

    model = MPNN(ATOM_DIM, BOND_DIM, hidden=128, num_layers=3, num_tasks=len(TASKS)).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)

    for epoch in range(1, epochs + 1):
        model.train()
        for batch in tr_loader:
            batch = batch.to(device)
            opt.zero_grad()
            logits = model(batch)
            y = batch.y.view(-1, len(TASKS))
            loss = F.binary_cross_entropy_with_logits(logits, y, pos_weight=pos_weight)
            loss.backward()
            opt.step()

    # Evaluate
    model.eval()
    all_y, all_probs = [], []
    with torch.no_grad():
        for batch in te_loader:
            batch = batch.to(device)
            logits = model(batch)
            y = batch.y.view(-1, len(TASKS))
            all_y.append(y.cpu().numpy())
            all_probs.append(torch.sigmoid(logits).cpu().numpy())

    y_arr = np.concatenate(all_y, 0)
    p_arr = np.concatenate(all_probs, 0)
    pred_arr = (p_arr > 0.5).astype(int)

    per_task = {}
    for i, t in enumerate(TASKS):
        per_task[t] = {
            "f1": float(f1_score(y_arr[:, i], pred_arr[:, i], zero_division=0)),
            "precision": float(precision_score(y_arr[:, i], pred_arr[:, i], zero_division=0)),
            "recall": float(recall_score(y_arr[:, i], pred_arr[:, i], zero_division=0)),
        }

    # Calibration: bin predicted probs, measure actual positive rate
    calibration = {}
    bins = np.linspace(0, 1, 11)
    for i, t in enumerate(TASKS):
        bin_actual = []
        bin_predicted = []
        bin_count = []
        for b in range(len(bins) - 1):
            mask = (p_arr[:, i] >= bins[b]) & (p_arr[:, i] < bins[b + 1])
            n = int(mask.sum())
            if n > 0:
                actual_rate = float(y_arr[:, i][mask].mean())
                pred_rate = float(p_arr[:, i][mask].mean())
            else:
                actual_rate = 0.0
                pred_rate = (bins[b] + bins[b + 1]) / 2
            bin_actual.append(round(actual_rate, 3))
            bin_predicted.append(round(pred_rate, 3))
            bin_count.append(n)
        calibration[t] = {
            "bin_edges": [round(x, 1) for x in bins.tolist()],
            "actual_rate": bin_actual,
            "predicted_rate": bin_predicted,
            "count": bin_count,
        }

    return per_task, calibration


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default=str(_project_root() / "flavor-gnn" / "data" / "compounds.parquet"))
    parser.add_argument("--out", default=str(_project_root() / "flavor-gnn" / "artifacts" / "cv_results.json"))
    parser.add_argument("--folds", type=int, default=5)
    parser.add_argument("--epochs", type=int, default=25)
    args = parser.parse_args()

    _set_seed(SEED)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[CV] device={device}, folds={args.folds}, epochs={args.epochs}")

    df = pd.read_parquet(args.data)
    print(f"[CV] loaded {len(df)} compounds, {len(TASKS)} tasks")

    data_list, Y = _featurize_all(df)
    print(f"[CV] featurized: {len(data_list)} valid compounds")

    # Stratify by bitter (most balanced dense label)
    strat = Y[:, list(TASKS).index("bitter")]
    skf = StratifiedKFold(n_splits=args.folds, shuffle=True, random_state=SEED)

    all_results = []
    all_calibrations = []
    for fold, (tr_idx, te_idx) in enumerate(skf.split(np.zeros(len(data_list)), strat)):
        print(f"[CV] fold {fold + 1}/{args.folds}...")
        per_task, calibration = train_and_eval_fold(
            data_list, Y, tr_idx, te_idx, epochs=args.epochs, device=device,
        )
        all_results.append(per_task)
        all_calibrations.append(calibration)
        scores = "  ".join(f"{t}={per_task[t]['f1']:.3f}" for t in TASKS[:5])
        print(f"       taste: {scores}")
        odor_scores = "  ".join(f"{t.replace('odor_','')}={per_task[t]['f1']:.3f}" for t in TASKS[5:])
        print(f"       odor:  {odor_scores}")

    # Aggregate
    summary = {}
    for t in TASKS:
        f1s = [r[t]["f1"] for r in all_results]
        ps = [r[t]["precision"] for r in all_results]
        rs = [r[t]["recall"] for r in all_results]
        summary[t] = {
            "f1_mean": float(round(np.mean(f1s), 3)),
            "f1_std": float(round(np.std(f1s), 3)),
            "precision_mean": float(round(np.mean(ps), 3)),
            "recall_mean": float(round(np.mean(rs), 3)),
            "f1_per_fold": [round(x, 3) for x in f1s],
        }
        flag = " ⚠ HIGH VARIANCE" if np.std(f1s) > 0.10 else ""
        print(f"  {t:14s} F1={np.mean(f1s):.3f} ± {np.std(f1s):.3f}{flag}")

    out = {
        "folds": args.folds,
        "epochs": args.epochs,
        "seed": SEED,
        "tasks": list(TASKS),
        "compounds": len(data_list),
        "summary": summary,
        "per_fold": all_results,
        "calibration_last_fold": all_calibrations[-1],
    }
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2))
    print(f"[CV] wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
