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
from sklearn.model_selection import StratifiedKFold, train_test_split

from ..models.featurize import ATOM_DIM, BOND_DIM, smiles_to_data
from ..models.mpnn import MPNN

TASKS = ("sweet", "bitter", "umami", "salty", "sour",
         "odor_fruity", "odor_floral", "odor_green", "odor_woody", "odor_spicy", "odor_fatty")
SEED = 42


def focal_loss(logits: torch.Tensor, y: torch.Tensor,
               pos_weight: torch.Tensor, gamma: float = 2.0,
               mask: torch.Tensor | None = None) -> torch.Tensor:
    """Focal BCE — downweights easy examples, upweights hard ones.

    FL(p,y) = -[α y (1-p)^γ log(p) + (1-y) p^γ log(1-p)]

    With α implemented via pos_weight so positives on rare tasks get an
    additional (pos_count/neg_count)^{-1} multiplier on top of the focal
    modulation. Designed to lift tasks where standard BCE + pos_weight
    underfits because the model predicts low-confidence positives that
    get swallowed by the "easy negative" gradient mass.

    `mask` (B, T) gates which (sample, task) pairs contribute. Use this
    to exclude unobserved labels (e.g. odor heads on FartDB rows that
    never measured odor).
    """
    p = torch.sigmoid(logits)
    # Clamp for numerical stability when computing logs.
    p_clamp = p.clamp(min=1e-7, max=1 - 1e-7)
    pos_term = pos_weight * y * ((1 - p_clamp) ** gamma) * torch.log(p_clamp)
    neg_term = (1 - y) * (p_clamp ** gamma) * torch.log(1 - p_clamp)
    elem = -(pos_term + neg_term)
    if mask is not None:
        denom = mask.sum().clamp(min=1.0)
        return (elem * mask).sum() / denom
    return elem.mean()


def _masked_bce(logits: torch.Tensor, y: torch.Tensor,
                pos_weight: torch.Tensor, mask: torch.Tensor | None) -> torch.Tensor:
    """BCE-with-logits + per-task pos_weight, masked over unobserved labels."""
    if mask is None:
        return F.binary_cross_entropy_with_logits(logits, y, pos_weight=pos_weight)
    elem = F.binary_cross_entropy_with_logits(
        logits, y, pos_weight=pos_weight, reduction="none"
    )
    denom = mask.sum().clamp(min=1.0)
    return (elem * mask).sum() / denom


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _set_seed(s: int) -> None:
    random.seed(s); np.random.seed(s); torch.manual_seed(s)


def _featurize_all(df: pd.DataFrame):
    """Featurize SMILES -> PyG Data with y and mask attributes.

    `mask[t]=1` means the row's label for task t was observed by some
    source (informed positive or informed negative). `mask[t]=0` means
    the label is missing — that (row, task) pair is excluded from loss
    and from F1 evaluation.

    Backwards-compat: parquets without mask_<t> columns get all-ones
    masks so legacy data behaves identically to the pre-masking pipeline.
    """
    data_list, y_mat, m_mat = [], [], []
    has_mask = all(f"mask_{t}" in df.columns for t in TASKS)
    for _, row in df.iterrows():
        y = torch.tensor([[float(row[t]) for t in TASKS]], dtype=torch.float32)
        if has_mask:
            mvec = torch.tensor(
                [[float(row[f"mask_{t}"]) for t in TASKS]], dtype=torch.float32,
            )
        else:
            mvec = torch.ones((1, len(TASKS)), dtype=torch.float32)
        d = smiles_to_data(row["smiles"], y=y)
        if d is None:
            continue
        d.mask = mvec
        data_list.append(d)
        y_mat.append([int(row[t]) for t in TASKS])
        m_mat.append([int(mvec[0, i].item()) for i in range(len(TASKS))])
    return data_list, np.array(y_mat, dtype=np.int64), np.array(m_mat, dtype=np.int64)


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
          trace_path: Path | None = None,
          loss_type: str = "bce", gamma: float = 2.0) -> tuple[dict, dict | None]:
    from torch_geometric.loader import DataLoader
    data_list, Y, M = _featurize_all(df)

    # Stratify by bitter (the most balanced dense label)
    strat = Y[:, TASKS.index("bitter")]
    idx = np.arange(len(data_list))
    tr_idx, te_idx = train_test_split(idx, test_size=0.2, stratify=strat, random_state=SEED)
    tr = [data_list[i] for i in tr_idx]
    te = [data_list[i] for i in te_idx]

    tr_loader = DataLoader(tr, batch_size=batch_size, shuffle=True)
    te_loader = DataLoader(te, batch_size=batch_size, shuffle=False)

    # pos_weight uses observed-only positive rate per task. An unobserved
    # 0 inflates the negative count and would push pos_weight too high.
    Y_tr, M_tr = Y[tr_idx], M[tr_idx]
    pos_weight = torch.tensor(
        [
            (M_tr[:, i].sum() - (Y_tr[:, i] * M_tr[:, i]).sum())
            / max(1, (Y_tr[:, i] * M_tr[:, i]).sum())
            for i in range(len(TASKS))
        ],
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
            mask = batch.mask.view(-1, len(TASKS))
            if loss_type == "focal":
                loss = focal_loss(logits, y, pos_weight=pos_weight, gamma=gamma, mask=mask)
            else:
                loss = _masked_bce(logits, y, pos_weight=pos_weight, mask=mask)
            loss.backward()
            opt.step()
            tot += float(loss.detach()) * batch.num_graphs
        tr_loss = tot / len(tr)

        model.eval()
        all_y, all_p, all_m = [], [], []
        with torch.no_grad():
            for batch in te_loader:
                batch = batch.to(device)
                logits = model(batch)
                y = batch.y.view(-1, len(TASKS))
                m = batch.mask.view(-1, len(TASKS))
                all_y.append(y.cpu().numpy())
                all_p.append((torch.sigmoid(logits) > 0.5).cpu().numpy())
                all_m.append(m.cpu().numpy())
        y_arr = np.concatenate(all_y, 0)
        p_arr = np.concatenate(all_p, 0)
        m_arr = np.concatenate(all_m, 0)
        per_task_f1 = {}
        for i, t in enumerate(TASKS):
            sel = m_arr[:, i].astype(bool)
            if sel.sum() == 0:
                per_task_f1[t] = 0.0
                continue
            ys, ps = y_arr[sel, i], p_arr[sel, i]
            f1 = f1_score(ys, ps, zero_division=0)
            per_task_f1[t] = float(f1)
            if f1 > best_per_task[t]["f1"]:
                best_per_task[t] = {
                    "f1": float(f1),
                    "precision": float(precision_score(ys, ps, zero_division=0)),
                    "recall": float(recall_score(ys, ps, zero_division=0)),
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
        "test_positives": {
            t: int((Y[te_idx][:, i] * M[te_idx][:, i]).sum()) for i, t in enumerate(TASKS)
        },
        "test_observed": {t: int(M[te_idx][:, i].sum()) for i, t in enumerate(TASKS)},
    }, best_ckpt


def _train_one_fold(df: pd.DataFrame, tr_idx, te_idx, epochs: int,
                    batch_size: int, device: str, loss_type: str = "bce",
                    gamma: float = 2.0) -> dict:
    """Train on a pre-split fold; return per-task best F1 dict.

    Loss and F1 use per-task masks: only (sample, task) pairs with mask=1
    contribute. This is what keeps FartDB's odor-unobserved rows from
    poisoning the odor heads with forced zeros.
    """
    from torch_geometric.loader import DataLoader
    data_list, Y, M = _featurize_all(df)
    tr = [data_list[i] for i in tr_idx]
    te = [data_list[i] for i in te_idx]
    tr_loader = DataLoader(tr, batch_size=batch_size, shuffle=True)
    te_loader = DataLoader(te, batch_size=batch_size, shuffle=False)

    Y_tr, M_tr = Y[tr_idx], M[tr_idx]
    pos_weight = torch.tensor(
        [
            (M_tr[:, i].sum() - (Y_tr[:, i] * M_tr[:, i]).sum())
            / max(1, (Y_tr[:, i] * M_tr[:, i]).sum())
            for i in range(len(TASKS))
        ],
        dtype=torch.float32, device=device,
    )

    model = MPNN(ATOM_DIM, BOND_DIM, hidden=128, num_layers=3, num_tasks=len(TASKS)).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    best = {t: -1.0 for t in TASKS}

    for _ in range(1, epochs + 1):
        model.train()
        for batch in tr_loader:
            batch = batch.to(device)
            opt.zero_grad()
            logits = model(batch)
            y = batch.y.view(-1, len(TASKS))
            mask = batch.mask.view(-1, len(TASKS))
            if loss_type == "focal":
                loss = focal_loss(logits, y, pos_weight=pos_weight, gamma=gamma, mask=mask)
            else:
                loss = _masked_bce(logits, y, pos_weight=pos_weight, mask=mask)
            loss.backward()
            opt.step()
        model.eval()
        ys, ps, ms = [], [], []
        with torch.no_grad():
            for batch in te_loader:
                batch = batch.to(device)
                logits = model(batch)
                y = batch.y.view(-1, len(TASKS))
                m = batch.mask.view(-1, len(TASKS))
                ys.append(y.cpu().numpy())
                ps.append((torch.sigmoid(logits) > 0.5).cpu().numpy())
                ms.append(m.cpu().numpy())
        y_arr = np.concatenate(ys, 0)
        p_arr = np.concatenate(ps, 0)
        m_arr = np.concatenate(ms, 0)
        for i, t in enumerate(TASKS):
            sel = m_arr[:, i].astype(bool)
            if sel.sum() == 0:
                continue
            f1 = f1_score(y_arr[sel, i], p_arr[sel, i], zero_division=0)
            if f1 > best[t]:
                best[t] = float(f1)
    return best


def cross_validate(df: pd.DataFrame, folds: int, epochs: int, batch_size: int, device: str,
                   loss_type: str = "bce", gamma: float = 2.0) -> dict:
    """Stratified K-fold CV. Stratifies on the bitter label (dense + balanced).
    Returns per-task mean/std F1 across folds."""
    data_list, Y, _M = _featurize_all(df)
    strat = Y[:, TASKS.index("bitter")]
    idx = np.arange(len(data_list))
    skf = StratifiedKFold(n_splits=folds, shuffle=True, random_state=SEED)
    per_task_scores = {t: [] for t in TASKS}
    for fold, (tr_idx, te_idx) in enumerate(skf.split(idx, strat), start=1):
        print(f"[M3-CV] fold {fold}/{folds}  n_train={len(tr_idx)}  n_test={len(te_idx)}")
        best = _train_one_fold(df, tr_idx, te_idx, epochs, batch_size, device,
                               loss_type=loss_type, gamma=gamma)
        for t in TASKS:
            per_task_scores[t].append(best[t])
        scores = "  ".join(f"{t}={best[t]:.3f}" for t in TASKS)
        print(f"[M3-CV] fold {fold} best: {scores}")
    summary = {
        t: {
            "mean": float(np.mean(per_task_scores[t])),
            "std": float(np.std(per_task_scores[t])),
            "per_fold": [float(v) for v in per_task_scores[t]],
        }
        for t in TASKS
    }
    return summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default=str(_project_root() / "flavor-gnn" / "data" / "compounds.parquet"))
    parser.add_argument("--out", default=str(_project_root() / "flavor-gnn" / "artifacts" / "m3_multitask.json"))
    parser.add_argument("--ckpt", default=str(_project_root() / "flavor-gnn" / "artifacts" / "m3_multitask.pt"))
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--trace", nargs="?", const=str(_project_root() / "flavor-gnn" / "artifacts" / "m3_training_trace.json"),
                        default=None, help="Write per-epoch loss + embeddings to this path")
    parser.add_argument("--cv", type=int, default=0,
                        help="If >1, run stratified K-fold cross-validation instead of a single train/test split. Writes per-task mean/std F1 to artifacts/cv_results.json.")
    parser.add_argument("--loss", choices=["bce", "focal"], default="bce",
                        help="Loss function. 'bce' is BCE+pos_weight (default). 'focal' uses focal-BCE with --gamma to downweight easy examples.")
    parser.add_argument("--gamma", type=float, default=2.0, help="Focal loss γ (default 2).")
    parser.add_argument("--cv-out", default=None,
                        help="Custom CV output path — defaults to artifacts/cv_results.json (bce) or artifacts/cv_results_focal.json (focal)")
    args = parser.parse_args()

    _set_seed(SEED)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[M3] device={device}")

    df = pd.read_parquet(args.data)
    print(f"[M3] loaded {len(df)} compounds")

    if args.cv and args.cv > 1:
        summary = cross_validate(df, args.cv, args.epochs, args.batch_size, device,
                                 loss_type=args.loss, gamma=args.gamma)
        if args.cv_out:
            cv_path = Path(args.cv_out)
        elif args.loss == "focal":
            cv_path = _project_root() / "flavor-gnn" / "artifacts" / "cv_results_focal.json"
        else:
            cv_path = _project_root() / "flavor-gnn" / "artifacts" / "cv_results.json"
        cv_path.parent.mkdir(parents=True, exist_ok=True)
        cv_path.write_text(json.dumps({
            "model": "MPNN multi-task (GINEConv, 3 layers, hidden=128)",
            "tasks": list(TASKS),
            "folds": args.cv, "epochs": args.epochs, "batch_size": args.batch_size,
            "device": device, "seed": SEED,
            "loss": args.loss, "gamma": args.gamma if args.loss == "focal" else None,
            "per_task": summary,
        }, indent=2))
        print(f"[M3-CV] wrote {cv_path}")
        for t in TASKS:
            s = summary[t]
            print(f"       {t:12s}: F1 = {s['mean']:.3f} ± {s['std']:.3f}")
        return 0

    trace_path = Path(args.trace) if args.trace else None
    results, ckpt = train(df, args.epochs, args.batch_size, device, trace_path=trace_path,
                          loss_type=args.loss, gamma=args.gamma)

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
