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
from sklearn.model_selection import GroupKFold, StratifiedKFold, train_test_split

from ..models.featurize import ATOM_DIM, BOND_DIM, smiles_to_data
from ..models.mpnn import MPNN

TASKS = ("sweet", "bitter", "umami", "salty", "sour",
         "odor_fruity", "odor_floral", "odor_green", "odor_woody", "odor_spicy",
         "odor_fatty", "odor_nutty")
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
    data_list, y_mat, m_mat, smiles_list = [], [], [], []
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
        smiles_list.append(row["smiles"])
    return (data_list, np.array(y_mat, dtype=np.int64),
            np.array(m_mat, dtype=np.int64), smiles_list)


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
    data_list, Y, M, _smiles = _featurize_all(df)

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
                    gamma: float = 2.0, val_frac: float = 0.1,
                    patience: int = 8, val_idx=None, readout: str = "mean") -> dict:
    """Train on a pre-split fold; return per-task TEST F1 at the epoch chosen
    by VALIDATION loss (not by test F1).

    Audit Finding 2.3 fix (P0c): the previous implementation returned the
    per-task MAX F1 across all epochs measured on the test fold — early-stopping
    on the test set, which inflates every reported F1 (more so on high-variance
    rare heads). Here we carve a `val_frac` validation slice out of the training
    fold, pick the single global epoch with the lowest masked validation loss,
    and report that epoch's test F1 for every head. One model, one epoch, no
    per-task test argmax.

    P1e: a cosine-annealed LR schedule + early-stopping-with-`patience` make the
    validation-loss trajectory smooth enough that the selected epoch is
    well-converged. Without this, a flat-LR 15-epoch run produced a noisy
    val-loss curve whose minimum sometimes landed on an under-trained early
    epoch (fold-1 collapse: sweet 0.36, odor_fatty 0.05). The schedule removes
    that instability so P1 feature levers can be judged against a stable baseline.

    Loss and F1 use per-task masks: only (sample, task) pairs with mask=1
    contribute. This is what keeps FartDB's odor-unobserved rows from
    poisoning the odor heads with forced zeros.
    """
    from torch_geometric.loader import DataLoader
    data_list, Y, M, _smiles = _featurize_all(df)

    # Validation slice: use an explicit val_idx when the caller provides one
    # (balanced-scaffold split already holds out a scaffold-disjoint val set);
    # otherwise carve it from the training fold (GroupKFold CV path), stratified
    # on bitter so the val loss is stable across epochs.
    if val_idx is not None:
        tr_inner, va_idx = np.asarray(tr_idx), np.asarray(val_idx)
    else:
        strat_tr = Y[tr_idx][:, TASKS.index("bitter")]
        tr_inner, va_idx = train_test_split(
            tr_idx, test_size=val_frac, stratify=strat_tr, random_state=SEED,
        )

    tr = [data_list[i] for i in tr_inner]
    va = [data_list[i] for i in va_idx]
    te = [data_list[i] for i in te_idx]
    tr_loader = DataLoader(tr, batch_size=batch_size, shuffle=True)
    va_loader = DataLoader(va, batch_size=batch_size, shuffle=False)
    te_loader = DataLoader(te, batch_size=batch_size, shuffle=False)

    # pos_weight from the inner-train positives only (observed-only).
    Y_tr, M_tr = Y[tr_inner], M[tr_inner]
    pos_weight = torch.tensor(
        [
            (M_tr[:, i].sum() - (Y_tr[:, i] * M_tr[:, i]).sum())
            / max(1, (Y_tr[:, i] * M_tr[:, i]).sum())
            for i in range(len(TASKS))
        ],
        dtype=torch.float32, device=device,
    )

    model = MPNN(ATOM_DIM, BOND_DIM, hidden=128, num_layers=3,
                 num_tasks=len(TASKS), readout=readout).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)

    best_val_loss = float("inf")
    best_test_f1 = {t: 0.0 for t in TASKS}
    epochs_no_improve = 0

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
        sched.step()

        model.eval()
        # Validation loss (masked, same loss as training) — drives epoch choice.
        val_loss_tot, val_graphs = 0.0, 0
        with torch.no_grad():
            for batch in va_loader:
                batch = batch.to(device)
                logits = model(batch)
                y = batch.y.view(-1, len(TASKS))
                mask = batch.mask.view(-1, len(TASKS))
                if loss_type == "focal":
                    vl = focal_loss(logits, y, pos_weight=pos_weight, gamma=gamma, mask=mask)
                else:
                    vl = _masked_bce(logits, y, pos_weight=pos_weight, mask=mask)
                val_loss_tot += float(vl) * batch.num_graphs
                val_graphs += batch.num_graphs
        val_loss = val_loss_tot / max(1, val_graphs)

        # Test per-task F1 this epoch (recorded, not used for selection).
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
        epoch_f1 = {}
        for i, t in enumerate(TASKS):
            sel = m_arr[:, i].astype(bool)
            epoch_f1[t] = (
                float(f1_score(y_arr[sel, i], p_arr[sel, i], zero_division=0))
                if sel.sum() > 0 else 0.0
            )

        # Select by validation loss only; early-stop after `patience` epochs
        # without improvement so the reported epoch is well-converged.
        if val_loss < best_val_loss - 1e-4:
            best_val_loss = val_loss
            best_test_f1 = epoch_f1
            epochs_no_improve = 0
        else:
            epochs_no_improve += 1
            if epochs_no_improve >= patience:
                break
    return best_test_f1


def _murcko_scaffold(smiles: str) -> str:
    """Bemis-Murcko scaffold SMILES for grouping; falls back to the full
    SMILES when the scaffold is empty (acyclic molecules have no ring system,
    so MurckoScaffoldSmiles returns '').

    KNOWN LIMITATION: acyclic homologous series (e.g. the carboxylic-acid sour
    set acetic/propanoic/.../decanoic) each get a distinct fallback key and can
    still split across folds. The dominant leak source flagged in the audit —
    the ring-rich artificial-sweetener analogues — IS grouped correctly, since
    they share ring scaffolds. A stricter generic-framework or Tanimoto-cluster
    grouping is out of scope for this measurement-correctness task.
    """
    from rdkit.Chem.Scaffolds.MurckoScaffold import MurckoScaffoldSmiles
    try:
        scaf = MurckoScaffoldSmiles(smiles=smiles)
    except Exception:
        scaf = None
    return scaf or smiles


def _scaffold_split_indices(smiles_list, frac_train: float = 0.8,
                            frac_valid: float = 0.1, seed: int = 42,
                            augment_mask=None):
    """DeepChem/Chemprop-style *balanced* scaffold split.

    Groups molecules by Bemis-Murcko scaffold, then assigns whole groups to
    train/val/test so no scaffold spans splits (no leakage). "Balanced": any
    scaffold group larger than half the holdout size is forced into TRAIN
    first — this puts mega-scaffolds (here benzene, 21% of the corpus) in
    training rather than letting one dominate the test set (the pathology that
    made plain GroupKFold's benzene-holdout fold collapse). The remaining
    smaller groups are shuffled by `seed` and packed into train→val→test, so
    the held-out test set is a diverse mix of rarer scaffolds — the realistic
    "generalize to novel chemotypes" measurement.

    Returns (train_idx, valid_idx, test_idx) as int arrays over the position
    space of `smiles_list`.
    """
    scaffolds: dict[str, list[int]] = {}
    for i, smi in enumerate(smiles_list):
        scaffolds.setdefault(_murcko_scaffold(smi), []).append(i)

    # Augment-only-in-train (P3b confirmation): any scaffold group containing an
    # augment molecule is forced entirely into train, so test/val are drawn ONLY
    # from original molecules with original labels. This isolates "does the extra
    # training data help predict OUR labels" from "the augmented test set is
    # easier". Fractions are computed over the ORIGINAL (non-augment) count so the
    # held-out test stays ~frac of the original molecules.
    forced_train: list[list[int]] = []
    free: list[list[int]] = []
    if augment_mask is not None:
        for idxs in scaffolds.values():
            (forced_train if any(augment_mask[i] for i in idxs) else free).append(idxs)
        n = sum(len(g) for g in free)
    else:
        free = list(scaffolds.values())
        n = len(smiles_list)

    n_train, n_valid = frac_train * n, frac_valid * n
    holdout_cutoff = (n * (1.0 - frac_train)) / 2.0  # half the val+test size

    big, small = [], []
    for idxs in free:
        (big if len(idxs) > holdout_cutoff else small).append(idxs)
    rng = np.random.default_rng(seed)
    rng.shuffle(small)
    ordered = big + small  # big scaffolds first → guaranteed into train

    train, valid, test = [], [], []
    for idxs in ordered:
        if len(train) + len(idxs) <= n_train:
            train.extend(idxs)
        elif len(valid) + len(idxs) <= n_valid:
            valid.extend(idxs)
        else:
            test.extend(idxs)
    for idxs in forced_train:  # augment scaffolds always train
        train.extend(idxs)
    return np.array(train), np.array(valid), np.array(test)


def scaffold_split_eval(df: pd.DataFrame, seeds: int, epochs: int, batch_size: int,
                        device: str, loss_type: str = "bce", gamma: float = 2.0,
                        readout: str = "mean") -> dict:
    """Repeated balanced-scaffold-split evaluation → per-task mean/std F1.

    Each seed produces a different train/val/test scaffold split (mega-scaffolds
    pinned to train, rarer scaffolds shuffled across splits). For each seed we
    train once with the cosine schedule + early-stopping (P1e), select the epoch
    by validation loss (P0c), and record per-task TEST F1. Returns mean/std/
    per_seed across seeds — the DeepChem-style honest, stable baseline.
    """
    data_list, Y, M, smiles_list = _featurize_all(df)
    # If df carries an is_augment flag (P3b train-only confirmation), build a
    # mask aligned to the (None-dropped) smiles_list so augment molecules are
    # forced into train and test/val stay pure-original.
    augment_mask = None
    if "is_augment" in df.columns:
        aug_smiles = set(df.loc[df["is_augment"] == 1, "smiles"].astype(str))
        augment_mask = [str(s) in aug_smiles for s in smiles_list]
        print(f"[M3-SCAF] augment-train-only: {sum(augment_mask)} augment / "
              f"{len(smiles_list) - sum(augment_mask)} original molecules")
    per_task_scores = {t: [] for t in TASKS}
    for s in range(seeds):
        tr_idx, val_idx, te_idx = _scaffold_split_indices(
            smiles_list, frac_train=0.8, frac_valid=0.1, seed=SEED + s,
            augment_mask=augment_mask,
        )
        print(f"[M3-SCAF] seed {s + 1}/{seeds}  "
              f"n_train={len(tr_idx)} n_val={len(val_idx)} n_test={len(te_idx)}")
        f1 = _train_one_fold(df, tr_idx, te_idx, epochs, batch_size, device,
                             loss_type=loss_type, gamma=gamma, val_idx=val_idx,
                             readout=readout)
        for t in TASKS:
            per_task_scores[t].append(f1[t])
        scores = "  ".join(f"{t}={f1[t]:.3f}" for t in TASKS)
        print(f"[M3-SCAF] seed {s + 1} test F1: {scores}")
    return {
        t: {
            "mean": float(np.mean(per_task_scores[t])),
            "std": float(np.std(per_task_scores[t])),
            "per_seed": [float(v) for v in per_task_scores[t]],
        }
        for t in TASKS
    }


def cross_validate(df: pd.DataFrame, folds: int, epochs: int, batch_size: int, device: str,
                   loss_type: str = "bce", gamma: float = 2.0,
                   split: str = "random") -> dict:
    """K-fold CV returning per-task mean/std F1 across folds.

    split='random'  : StratifiedKFold on the bitter label (legacy behavior).
    split='scaffold': GroupKFold keyed on Bemis-Murcko scaffold so no scaffold
                      appears in both train and test. This measures the
                      out-of-scaffold generalization the deployment target
                      (chef ingredients) actually needs, instead of letting
                      FartDB homologous series leak across folds and inflate F1
                      (audit Finding 2.1).
    """
    data_list, Y, _M, smiles_list = _featurize_all(df)
    idx = np.arange(len(data_list))
    if split == "scaffold":
        groups = np.array([_murcko_scaffold(s) for s in smiles_list])
        n_groups = len(set(groups.tolist()))
        print(f"[M3-CV] scaffold split: {n_groups} distinct scaffolds over {len(idx)} compounds")
        splitter = GroupKFold(n_splits=folds)
        fold_iter = splitter.split(idx, groups=groups)
    else:
        strat = Y[:, TASKS.index("bitter")]
        splitter = StratifiedKFold(n_splits=folds, shuffle=True, random_state=SEED)
        fold_iter = splitter.split(idx, strat)
    per_task_scores = {t: [] for t in TASKS}
    for fold, (tr_idx, te_idx) in enumerate(fold_iter, start=1):
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
    parser.add_argument("--scaffold", action="store_true",
                        help="Use GroupKFold keyed on Bemis-Murcko scaffold for CV (out-of-scaffold "
                             "generalization). Defaults CV output to artifacts/cv_results_scaffold.json.")
    parser.add_argument("--scaffold-split", action="store_true",
                        help="DeepChem/Chemprop balanced-scaffold split eval (mega-scaffolds pinned to "
                             "train, rarer scaffolds held out) over --seeds repeats. Writes "
                             "artifacts/cv_results_scaffold.json. Preferred over --scaffold for the "
                             "honest baseline when one scaffold dominates the corpus.")
    parser.add_argument("--seeds", type=int, default=5,
                        help="Number of scaffold-split repeats for --scaffold-split (mean/std over seeds).")
    parser.add_argument("--readout", choices=["mean", "mean_max", "mean_max_sum"], default="mean",
                        help="Graph readout (P1a lever). 'mean' = baseline global_mean_pool; "
                             "'mean_max' adds max pool (motif-preserving, no size-sensitive sum); "
                             "'mean_max_sum' also concatenates the sum pool.")
    args = parser.parse_args()

    _set_seed(SEED)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[M3] device={device}")

    df = pd.read_parquet(args.data)
    print(f"[M3] loaded {len(df)} compounds")

    if args.scaffold_split:
        summary = scaffold_split_eval(df, args.seeds, args.epochs, args.batch_size, device,
                                      loss_type=args.loss, gamma=args.gamma, readout=args.readout)
        cv_path = Path(args.cv_out) if args.cv_out else (
            _project_root() / "flavor-gnn" / "artifacts" / "cv_results_scaffold.json")
        cv_path.parent.mkdir(parents=True, exist_ok=True)
        cv_path.write_text(json.dumps({
            "model": "MPNN multi-task (GINEConv, 3 layers, hidden=128)",
            "tasks": list(TASKS),
            "seeds": args.seeds, "epochs": args.epochs, "batch_size": args.batch_size,
            "device": device, "seed": SEED, "loss": args.loss,
            "split": "deepchem_balanced_scaffold", "readout": args.readout,
            "per_task": summary,
        }, indent=2))
        print(f"[M3-SCAF] wrote {cv_path}")
        for t in TASKS:
            s = summary[t]
            print(f"       {t:12s}: F1 = {s['mean']:.3f} ± {s['std']:.3f}")
        return 0

    if args.cv and args.cv > 1:
        split = "scaffold" if args.scaffold else "random"
        summary = cross_validate(df, args.cv, args.epochs, args.batch_size, device,
                                 loss_type=args.loss, gamma=args.gamma, split=split)
        if args.cv_out:
            cv_path = Path(args.cv_out)
        elif args.scaffold:
            cv_path = _project_root() / "flavor-gnn" / "artifacts" / "cv_results_scaffold.json"
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
            "split": split,
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
