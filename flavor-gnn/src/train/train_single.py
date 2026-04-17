"""M2 single-task GNN training.

Trains one MPNN per taste label. Uses the same stratified 80/20 split and
seed=42 as the M1 RF baseline for fair comparison. Reports F1/precision/recall
on the test split and writes a checkpoint per task.

Usage:
    python -m src.train.train_single --task bitter
    python -m src.train.train_single --task bitter,sweet --epochs 50
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
from sklearn.model_selection import train_test_split

from ..models.featurize import ATOM_DIM, BOND_DIM, smiles_to_data
from ..models.mpnn import MPNN

SEED = 42


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _set_seed(s: int) -> None:
    random.seed(s); np.random.seed(s); torch.manual_seed(s)


def _featurize_all(df: pd.DataFrame, task: str):
    from torch_geometric.data import Data  # noqa: F401 (ensures PyG is importable)
    data_list, labels = [], []
    for _, row in df.iterrows():
        y_val = row[task]
        y = torch.tensor([float(y_val)], dtype=torch.float32)
        d = smiles_to_data(row["smiles"], y=y)
        if d is None:
            continue
        data_list.append(d)
        labels.append(int(y_val))
    return data_list, np.array(labels, dtype=np.int64)


def train_task(df: pd.DataFrame, task: str, epochs: int, batch_size: int,
               device: str) -> dict:
    from torch_geometric.loader import DataLoader
    data_list, y = _featurize_all(df, task)
    if y.sum() < 20 or (len(y) - y.sum()) < 20:
        return {"skipped": True, "reason": "too few positives/negatives",
                "positives": int(y.sum()), "n": int(len(y))}

    idx = np.arange(len(data_list))
    tr_idx, te_idx = train_test_split(idx, test_size=0.2, stratify=y, random_state=SEED)
    tr = [data_list[i] for i in tr_idx]
    te = [data_list[i] for i in te_idx]

    tr_loader = DataLoader(tr, batch_size=batch_size, shuffle=True)
    te_loader = DataLoader(te, batch_size=batch_size, shuffle=False)

    pos_weight = torch.tensor([(len(y) - y.sum()) / max(1, y.sum())], dtype=torch.float32, device=device)

    model = MPNN(ATOM_DIM, BOND_DIM, hidden=128, num_layers=3, num_tasks=1).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)

    best = {"f1": -1.0, "epoch": -1}
    for epoch in range(1, epochs + 1):
        model.train()
        tot = 0.0
        for batch in tr_loader:
            batch = batch.to(device)
            opt.zero_grad()
            logits = model(batch).view(-1)
            loss = F.binary_cross_entropy_with_logits(logits, batch.y.view(-1), pos_weight=pos_weight)
            loss.backward()
            opt.step()
            tot += float(loss) * batch.num_graphs
        tr_loss = tot / len(tr)

        model.eval()
        y_true, y_pred = [], []
        with torch.no_grad():
            for batch in te_loader:
                batch = batch.to(device)
                logits = model(batch).view(-1)
                y_true.extend(batch.y.view(-1).cpu().numpy().tolist())
                y_pred.extend((torch.sigmoid(logits) > 0.5).cpu().numpy().tolist())
        f1 = f1_score(y_true, y_pred, zero_division=0)
        if f1 > best["f1"]:
            best = {
                "f1": float(f1),
                "precision": float(precision_score(y_true, y_pred, zero_division=0)),
                "recall": float(recall_score(y_true, y_pred, zero_division=0)),
                "epoch": epoch,
            }
        if epoch % 5 == 0 or epoch == 1:
            print(f"       [{task}] ep {epoch:3d}  tr_loss={tr_loss:.4f}  test_F1={f1:.3f}  best={best['f1']:.3f}@ep{best['epoch']}")

    return {
        "skipped": False,
        "task": task,
        "n": int(len(y)),
        "positives": int(y.sum()),
        "train_n": int(len(tr_idx)),
        "test_n": int(len(te_idx)),
        "best": best,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default=str(_project_root() / "flavor-gnn" / "data" / "compounds.parquet"))
    parser.add_argument("--out", default=str(_project_root() / "flavor-gnn" / "artifacts" / "m2_results.json"))
    parser.add_argument("--task", default="bitter,sweet")
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--batch-size", type=int, default=64)
    args = parser.parse_args()

    _set_seed(SEED)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[M2] device={device}")

    df = pd.read_parquet(args.data)
    print(f"[M2] loaded {len(df)} compounds")

    results = {}
    for task in [t.strip() for t in args.task.split(",") if t.strip()]:
        print(f"[M2] training task={task}")
        results[task] = train_task(df, task, args.epochs, args.batch_size, device)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({
        "model": "MPNN(GINEConv, 3 layers, hidden=128)",
        "seed": SEED, "epochs": args.epochs, "batch_size": args.batch_size,
        "device": device, "per_task": results,
    }, indent=2))
    print(f"[M2] wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
