"""M3 multi-task GNN training.

Shared GINEConv backbone + per-task heads for all five tastes. Labels are
"present or absent" bits from compounds.parquet — every row has every label
(0 or 1), so masking isn't strictly needed here, but we still support it via
`label_mask` for future expansion to labels with genuine missingness.

Goal: beat M1 single-task RF on sparse labels (umami, salty, sour) via shared
representation transfer from the dense labels (bitter, sweet).

Usage:
    python -m src.train.train_multitask [--epochs 40]
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

TASKS = ("sweet", "bitter", "umami", "salty", "sour",
         "odor_fruity", "odor_floral", "odor_green", "odor_woody", "odor_spicy", "odor_fatty")
SEED = 42


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _set_seed(s: int) -> None:
    random.seed(s); np.random.seed(s); torch.manual_seed(s)


def _featurize_all(df: pd.DataFrame):
    data_list, y_mat = [], []
    for _, row in df.iterrows():
        y = torch.tensor([[float(row[t]) for t in TASKS]], dtype=torch.float32)
        d = smiles_to_data(row["smiles"], y=y)
        if d is None:
            continue
        data_list.append(d)
        y_mat.append([int(row[t]) for t in TASKS])
    return data_list, np.array(y_mat, dtype=np.int64)


def _pick_trace_compounds(df: pd.DataFrame, per_task: int = 6) -> list[int]:
    """Pick N = 5*per_task row indices — positives for each task, spread by pairingCount-ish heuristic."""
    rng = np.random.default_rng(SEED)
    picks: list[int] = []
    for task in TASKS:
        pos_idx = np.where(df[task].to_numpy() == 1)[0]
        if len(pos_idx) == 0:
            continue
        take = min(per_task, len(pos_idx))
        chosen = rng.choice(pos_idx, size=take, replace=False)
        picks.extend(int(i) for i in chosen)
    # dedup, preserve order
    seen = set()
    out = []
    for p in picks:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out


def train(df: pd.DataFrame, epochs: int, batch_size: int, device: str,
          trace_path: Path | None = None) -> tuple[dict, dict | None]:
    from torch_geometric.loader import DataLoader
    data_list, Y = _featurize_all(df)

    # Stratify by bitter (the most balanced dense label)
    strat = Y[:, TASKS.index("bitter")]
    idx = np.arange(len(data_list))
    tr_idx, te_idx = train_test_split(idx, test_size=0.2, stratify=strat, random_state=SEED)
    tr = [data_list[i] for i in tr_idx]
    te = [data_list[i] for i in te_idx]

    tr_loader = DataLoader(tr, batch_size=batch_size, shuffle=True)
    te_loader = DataLoader(te, batch_size=batch_size, shuffle=False)

    Y_tr = Y[tr_idx]
    pos_weight = torch.tensor(
        [(len(Y_tr) - Y_tr[:, i].sum()) / max(1, Y_tr[:, i].sum()) for i in range(len(TASKS))],
        dtype=torch.float32, device=device,
    )

    model = MPNN(ATOM_DIM, BOND_DIM, hidden=128, num_layers=3, num_tasks=len(TASKS)).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)

    best_per_task = {t: {"f1": -1.0, "epoch": -1} for t in TASKS}
    best_ckpt = None

    # Tracing setup: pick a stable sample of compounds and record their 2-D
    # PCA-projected embedding each epoch. The 2-D axes are fitted once at
    # epoch 1 so subsequent snapshots share a consistent frame.
    trace_data: list[dict] = []
    trace_idx: list[int] = []
    trace_labels: list[str] = []
    pca_components: np.ndarray | None = None
    pca_mean: np.ndarray | None = None
    if trace_path is not None:
        trace_idx = _pick_trace_compounds(df, per_task=6)
        for i in trace_idx:
            row = df.iloc[i]
            labels = [t for t in TASKS if int(row[t]) == 1]
            trace_labels.append("+".join(labels) or "none")
        print(f"[trace] sampled {len(trace_idx)} compounds for embedding trajectory")

    def _compute_trace_snapshot() -> list[list[float]]:
        nonlocal pca_components, pca_mean
        if not trace_idx:
            return []
        trace_batch = [data_list[i] for i in trace_idx]
        loader = DataLoader(trace_batch, batch_size=len(trace_batch), shuffle=False)
        with torch.no_grad():
            b = next(iter(loader)).to(device)
            emb = model.forward_embedding(b).cpu().numpy()  # (N, hidden)
        if pca_components is None:
            # Fit PCA on first call. Use plain numpy to avoid another dep.
            pca_mean = emb.mean(axis=0)
            X = emb - pca_mean
            _, _, Vt = np.linalg.svd(X, full_matrices=False)
            pca_components = Vt[:2]
        X = emb - pca_mean
        proj = X @ pca_components.T  # (N, 2)
        return [[float(round(v, 4)) for v in row] for row in proj.tolist()]

    for epoch in range(1, epochs + 1):
        model.train()
        tot = 0.0
        for batch in tr_loader:
            batch = batch.to(device)
            opt.zero_grad()
            logits = model(batch)  # (B, T)
            y = batch.y.view(-1, len(TASKS))
            loss = F.binary_cross_entropy_with_logits(logits, y, pos_weight=pos_weight)
            loss.backward()
            opt.step()
            tot += float(loss.detach()) * batch.num_graphs
        tr_loss = tot / len(tr)

        model.eval()
        all_y, all_p = [], []
        with torch.no_grad():
            for batch in te_loader:
                batch = batch.to(device)
                logits = model(batch)
                y = batch.y.view(-1, len(TASKS))
                all_y.append(y.cpu().numpy())
                all_p.append((torch.sigmoid(logits) > 0.5).cpu().numpy())
        y_arr = np.concatenate(all_y, 0)
        p_arr = np.concatenate(all_p, 0)
        per_task_f1 = {}
        for i, t in enumerate(TASKS):
            f1 = f1_score(y_arr[:, i], p_arr[:, i], zero_division=0)
            per_task_f1[t] = float(f1)
            if f1 > best_per_task[t]["f1"]:
                best_per_task[t] = {
                    "f1": float(f1),
                    "precision": float(precision_score(y_arr[:, i], p_arr[:, i], zero_division=0)),
                    "recall": float(recall_score(y_arr[:, i], p_arr[:, i], zero_division=0)),
                    "epoch": epoch,
                }

        if epoch == 1 or epoch % 5 == 0 or epoch == epochs:
            scores = "  ".join(f"{t}={per_task_f1[t]:.3f}" for t in TASKS)
            print(f"       ep {epoch:3d}  tr_loss={tr_loss:.4f}  {scores}")

        # Trace snapshot every 2 epochs so the playback is smooth but the file
        # doesn't bloat. Includes loss, per-task F1, and 2D-projected
        # embeddings of the tracked compounds.
        if trace_path is not None and (epoch == 1 or epoch % 2 == 0 or epoch == epochs):
            snap = {
                "epoch": epoch,
                "loss": float(round(tr_loss, 4)),
                "f1": {t: float(round(per_task_f1[t], 4)) for t in TASKS},
                "embeddings": _compute_trace_snapshot(),
            }
            trace_data.append(snap)

        # Save last model (could change to save-best-macro)
        best_ckpt = model.state_dict()

    if trace_path is not None:
        trace_path.parent.mkdir(parents=True, exist_ok=True)
        with open(trace_path, "w", encoding="utf-8") as fh:
            json.dump({
                "tasks": list(TASKS),
                "compound_labels": trace_labels,
                "frames": trace_data,
            }, fh)
        print(f"[trace] wrote {trace_path} ({len(trace_data)} frames)")

    return {
        "best_per_task": best_per_task,
        "train_n": int(len(tr_idx)),
        "test_n": int(len(te_idx)),
        "test_positives": {t: int(Y[te_idx][:, i].sum()) for i, t in enumerate(TASKS)},
    }, best_ckpt


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default=str(_project_root() / "flavor-gnn" / "data" / "compounds.parquet"))
    parser.add_argument("--out", default=str(_project_root() / "flavor-gnn" / "artifacts" / "m3_multitask.json"))
    parser.add_argument("--ckpt", default=str(_project_root() / "flavor-gnn" / "artifacts" / "m3_multitask.pt"))
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--trace", nargs="?", const=str(_project_root() / "flavor-gnn" / "artifacts" / "m3_training_trace.json"),
                        default=None, help="Write per-epoch loss + embeddings to this path")
    args = parser.parse_args()

    _set_seed(SEED)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[M3] device={device}")

    df = pd.read_parquet(args.data)
    print(f"[M3] loaded {len(df)} compounds")

    trace_path = Path(args.trace) if args.trace else None
    results, ckpt = train(df, args.epochs, args.batch_size, device, trace_path=trace_path)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({
        "model": "MPNN multi-task (GINEConv, 3 layers, hidden=128)",
        "tasks": list(TASKS),
        "seed": SEED, "epochs": args.epochs, "batch_size": args.batch_size,
        "device": device, **results,
    }, indent=2))
    print(f"[M3] wrote {out_path}")

    ckpt_path = Path(args.ckpt)
    torch.save({"state_dict": ckpt, "tasks": list(TASKS),
                "atom_dim": ATOM_DIM, "bond_dim": BOND_DIM,
                "hidden": 128, "num_layers": 3}, ckpt_path)
    print(f"[M3] wrote {ckpt_path}")

    for t in TASKS:
        b = results["best_per_task"][t]
        print(f"       {t:6s}: best F1={b['f1']:.3f} @ep{b['epoch']}  P={b['precision']:.3f} R={b['recall']:.3f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
