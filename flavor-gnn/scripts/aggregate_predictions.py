"""Per-ingredient compound aggregation for gnn_entropy.json (N2-GNN-AGG).

Background
----------
embed_ingredients.py builds per-ingredient predictions by mean-pooling the
raw sigmoid outputs of every SMILES it can find for that ingredient, then
applying logit-shift calibration once on the mean. This dilutes individual
high-confidence signals: an ingredient whose top compound predicts umami at
p=0.9 ends up averaged with 19 others at p=0.02, landing at ~0.06 — well
below the v3 calibrated threshold (0.8).

Per chemDataset-status.md, only 605–607 ingredients fire above any v3
calibrated head; most heads (umami, sour, salty, odor_floral, odor_fruity,
…) emit ~0 above-threshold ingredients under mean pooling.

This script implements aggregation strategies that promote the strongest
compound signal per task. Default: top-K mean (K=3) per task across an
ingredient's compounds, applied AFTER per-compound calibration.

Output schema matches today's gnn_entropy.json so the frontend is unchanged.

Strategies
----------
mean       — Current baseline: mean of calibrated per-compound probs.
topk_mean  — Per task, mean of top-K highest calibrated probs (default K=3).
max        — Per task, max calibrated prob across compounds.
noisy_or   — Per task, 1 − ∏(1 − p_i). Treats each compound as an
             independent vote.

Usage
-----
    python -m scripts.aggregate_predictions \\
        --strategy topk_mean --k 3 --max-compounds 10

    # Benchmark mode prints above-threshold counts for every strategy
    # without writing output:
    python -m scripts.aggregate_predictions --benchmark
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "flavor-gnn"))

from src.models.featurize import smiles_to_data
from src.models.mpnn import MPNN
from src.infer.calibrate import apply_shift
from src.infer.embed_ingredients import (
    build_name_to_compound_smiles,
    fuzzy_match_name,
    load_model,
)


STRATEGIES = ("mean", "topk_mean", "max", "noisy_or")


def aggregate(calibrated: np.ndarray, strategy: str, k: int) -> np.ndarray:
    """Aggregate per-compound calibrated probs (n_compounds, n_tasks) → (n_tasks,)."""
    if calibrated.size == 0:
        return np.zeros(0, dtype=np.float32)
    if strategy == "mean":
        return calibrated.mean(axis=0)
    if strategy == "max":
        return calibrated.max(axis=0)
    if strategy == "noisy_or":
        return 1.0 - np.prod(1.0 - np.clip(calibrated, 0.0, 1.0), axis=0)
    if strategy == "topk_mean":
        sorted_desc = np.sort(calibrated, axis=0)[::-1]
        kk = max(1, min(k, sorted_desc.shape[0]))
        return sorted_desc[:kk].mean(axis=0)
    raise ValueError(f"Unknown strategy: {strategy}")


def predict_compound_probs(model, smiles_list, device, tasks):
    """Run inference on a list of SMILES → calibrated probs (n, n_tasks)."""
    from torch_geometric.loader import DataLoader

    data_list = []
    for s in smiles_list:
        d = smiles_to_data(s)
        if d is not None:
            data_list.append(d)
    if not data_list:
        return None
    loader = DataLoader(data_list, batch_size=len(data_list), shuffle=False)
    with torch.no_grad():
        batch = next(iter(loader)).to(device)
        logits = model(batch)
        raw = torch.sigmoid(logits).cpu().numpy()
    return apply_shift(raw, tasks)


def compute_per_ingredient_probs(model, smiles_map, prodata_names, device,
                                 tasks, max_compounds, strategy, k):
    """For each proDataset name, find a fuzzy match → infer → aggregate."""
    out = {}
    matched = 0
    for i, name in enumerate(prodata_names):
        fdb_key = fuzzy_match_name(name, smiles_map)
        if not fdb_key:
            continue
        smiles_list = smiles_map[fdb_key][:max_compounds]
        calibrated = predict_compound_probs(model, smiles_list, device, tasks)
        if calibrated is None:
            continue
        agg = aggregate(calibrated, strategy, k)
        out[name] = {t: float(round(p, 4)) for t, p in zip(tasks, agg.tolist())}
        matched += 1
        if (i + 1) % 500 == 0:
            print(f"[agg] {i + 1}/{len(prodata_names)}  matched {matched}", flush=True)
    return out, matched


def threshold_table():
    """Load v3 molecule-level calibrated thresholds (the ones the UI uses)."""
    path = ROOT / "flavor-gnn" / "artifacts" / "threshold_calibration_v3.json"
    data = json.load(path.open("r", encoding="utf-8"))
    return {e["task"]: float(e["calibrated_threshold"]) for e in data["per_task"]}


def above_threshold_counts(probs_by_name, thresholds, tasks):
    """Return (total_ingredients_with_any_hit, per_task_count_dict)."""
    per_task = {t: 0 for t in tasks}
    any_hit = 0
    for probs in probs_by_name.values():
        hit = False
        for t in tasks:
            if probs.get(t, 0.0) >= thresholds.get(t, 1.0):
                per_task[t] += 1
                hit = True
        if hit:
            any_hit += 1
    return any_hit, per_task


def ingredient_eval_set(tasks):
    """Build (name, task) positives from the chef-curated top-500 CSV.

    Maps the chef vocab to the 11 GNN heads only where the term is identical.
    Returns dict {name: set(positive_task_names)}.

    Chef T1 maps: green→odor_green, fruity→odor_fruity, floral→odor_floral,
                  fatty→odor_fatty, spicy→odor_spicy.
    Chef T2 maps directly: sweet, sour, bitter, salty, umami.
    T3 mouthfeel does not map onto any GNN head — skipped.
    """
    csv_path = ROOT / "flavor-gnn" / "curation" / "top500_flavor_graph.csv"
    t1_to_head = {
        "green": "odor_green",
        "fruity": "odor_fruity",
        "floral": "odor_floral",
        "fatty": "odor_fatty",
        "spicy": "odor_spicy",
    }
    t2_to_head = {
        "sweet": "sweet", "sour": "sour", "bitter": "bitter",
        "salty": "salty", "umami": "umami",
    }
    truth = {}
    with csv_path.open("r", encoding="utf-8") as fh:
        rd = csv.DictReader(fh)
        for row in rd:
            name = (row.get("name") or "").strip().lower()
            if not name:
                continue
            positives = set()
            for term in (row.get("tier1_aroma") or "").split("|"):
                term = term.strip().lower()
                if term in t1_to_head:
                    positives.add(t1_to_head[term])
            for term in (row.get("tier2_taste") or "").split("|"):
                term = term.strip().lower()
                if term in t2_to_head:
                    positives.add(t2_to_head[term])
            if positives:
                truth[name] = positives
    return truth


def macro_f1_per_task(probs_by_name, thresholds, truth, tasks):
    """Compute per-task F1 against chef-curated ingredient truth set.

    For each task, positives = chef rows where that task is in their set.
    Negatives = chef rows where the task is NOT in their set.
    F1 at the v3 calibrated threshold.
    """
    out = {}
    for t in tasks:
        tp = fp = fn = tn = 0
        thr = thresholds.get(t, 1.0)
        for name, positives in truth.items():
            probs = probs_by_name.get(name)
            if probs is None:
                continue
            pred = probs.get(t, 0.0) >= thr
            is_pos = t in positives
            if pred and is_pos: tp += 1
            elif pred and not is_pos: fp += 1
            elif (not pred) and is_pos: fn += 1
            else: tn += 1
        prec = tp / (tp + fp) if (tp + fp) else 0.0
        rec  = tp / (tp + fn) if (tp + fn) else 0.0
        f1   = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
        out[t] = {"f1": round(f1, 3), "precision": round(prec, 3),
                  "recall": round(rec, 3), "tp": tp, "fp": fp, "fn": fn,
                  "support_pos": tp + fn, "support_neg": fp + tn}
    return out


def write_entropy(probs_by_name, tasks, out_path, strategy, k, max_compounds):
    entropy_out = {}
    for name, probs in probs_by_name.items():
        p = np.array([probs[t] for t in tasks])
        if p.sum() > 0:
            pn = p / p.sum()
            mask = pn > 0
            H = float(-np.sum(pn[mask] * np.log(pn[mask])))
        else:
            H = 0.0
        H_max = float(np.log(len(p)))
        entropy_out[name] = {
            "probs": probs,
            "entropy": float(round(H, 4)),
            "entropy_norm": float(round(H / H_max if H_max > 0 else 0.0, 4)),
        }
    entropy_out["_meta"] = {
        "tasks": tasks,
        "n": len(probs_by_name),
        "aggregation": strategy,
        "k": k if strategy == "topk_mean" else None,
        "max_compounds": max_compounds,
        "source": "aggregate_predictions.py (N2-GNN-AGG)",
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(entropy_out, fh)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ckpt", default=str(ROOT / "flavor-gnn" / "artifacts" / "m3_multitask.pt"))
    parser.add_argument("--foodb", default=str(ROOT / "chemDataset" / "processed" / "foodb.json"))
    parser.add_argument("--prodata", default=str(ROOT / "public" / "proDataset" / "ingredients.json"))
    parser.add_argument("--out", default=str(ROOT / "public" / "proDataset" / "gnn_entropy.json"))
    parser.add_argument("--strategy", choices=STRATEGIES, default="topk_mean")
    parser.add_argument("--k", type=int, default=3, help="Top-K for topk_mean")
    parser.add_argument("--max-compounds", type=int, default=10,
                        help="Per-ingredient compound budget (was 20 in embed_ingredients)")
    parser.add_argument("--benchmark", action="store_true",
                        help="Try every strategy, print stats, do not write output")
    parser.add_argument("--dry-run", action="store_true",
                        help="Compute but do not overwrite gnn_entropy.json")
    args = parser.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[agg] device={device}  strategy={args.strategy}  k={args.k}  max_compounds={args.max_compounds}")

    ckpt_path = Path(args.ckpt)
    model, hidden = load_model(ckpt_path, device)
    ckpt = torch.load(ckpt_path, map_location=device, weights_only=False)
    tasks = ckpt["tasks"]
    print(f"[agg] tasks: {tasks}")

    with open(args.foodb, "r", encoding="utf-8") as fh:
        foodb = json.load(fh)
    with open(args.prodata, "r", encoding="utf-8") as fh:
        prodata = json.load(fh)

    training_smiles: set = set()
    try:
        import pandas as pd
        train_df = pd.read_parquet(ROOT / "flavor-gnn" / "data" / "compounds.parquet")
        training_smiles = set(train_df["smiles"].tolist())
        print(f"[agg] loaded {len(training_smiles)} training SMILES")
    except Exception as e:
        print(f"[agg] WARNING could not load training SMILES: {e}")

    smiles_map, _ = build_name_to_compound_smiles(
        foodb, {}, training_smiles=training_smiles)
    print(f"[agg] indexed {len(smiles_map)} foods with SMILES")

    prodata_names = [n for n in prodata.keys() if not n.startswith("_")]
    print(f"[agg] proDataset ingredients: {len(prodata_names)}")

    thresholds = threshold_table()
    truth = ingredient_eval_set(tasks)
    print(f"[agg] chef eval set: {len(truth)} ingredients with mappable labels")

    if args.benchmark:
        print("\n[agg] BENCHMARK MODE — trying every strategy\n")
        rows = []
        for strategy in STRATEGIES:
            k = args.k if strategy == "topk_mean" else None
            probs_by_name, matched = compute_per_ingredient_probs(
                model, smiles_map, prodata_names, device,
                tasks, args.max_compounds, strategy, args.k)
            any_hit, per_task = above_threshold_counts(probs_by_name, thresholds, tasks)
            f1 = macro_f1_per_task(probs_by_name, thresholds, truth, tasks)
            macro_f1 = float(np.mean([v["f1"] for v in f1.values()]))
            rows.append({
                "strategy": strategy,
                "k": k,
                "matched": matched,
                "above_any": any_hit,
                "per_task_above": per_task,
                "macro_f1_chef": round(macro_f1, 3),
                "per_task_f1": {t: f1[t]["f1"] for t in tasks},
            })
            print(f"  {strategy:11s}  matched={matched}  above_any={any_hit:5d}  "
                  f"macro_F1(chef)={macro_f1:.3f}")
            print(f"               per-task above: {per_task}")
        print()
        report_path = ROOT / "flavor-gnn" / "artifacts" / "aggregation_benchmark.json"
        report_path.parent.mkdir(parents=True, exist_ok=True)
        with report_path.open("w", encoding="utf-8") as fh:
            json.dump({"thresholds": thresholds, "rows": rows}, fh, indent=2)
        print(f"[agg] wrote benchmark → {report_path}")
        return 0

    probs_by_name, matched = compute_per_ingredient_probs(
        model, smiles_map, prodata_names, device,
        tasks, args.max_compounds, args.strategy, args.k)
    print(f"[agg] aggregated probs for {matched} ingredients")

    any_hit, per_task = above_threshold_counts(probs_by_name, thresholds, tasks)
    print(f"[agg] above-threshold (any task): {any_hit}")
    for t in tasks:
        print(f"       {t:14s} {per_task[t]}")

    f1 = macro_f1_per_task(probs_by_name, thresholds, truth, tasks)
    macro_f1 = float(np.mean([v["f1"] for v in f1.values()]))
    print(f"[agg] chef-set macro-F1: {macro_f1:.3f}")
    for t in tasks:
        v = f1[t]
        print(f"       {t:14s} F1={v['f1']:.3f}  P={v['precision']:.3f}  R={v['recall']:.3f}  "
              f"(pos={v['support_pos']}, neg={v['support_neg']})")

    out_path = Path(args.out)
    if args.dry_run:
        print(f"[agg] --dry-run: skipping write to {out_path}")
        return 0
    write_entropy(probs_by_name, tasks, out_path, args.strategy, args.k, args.max_compounds)
    print(f"[agg] wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
