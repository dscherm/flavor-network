"""M1 baseline — Morgan fingerprint + Random Forest per taste label.

Establishes the per-task F1 floor for the GNN to beat. One independent RF
classifier per binary label (sweet / bitter / umami / salty / sour), each
trained on stratified 80/20 splits with seed=42.

Artifacts:
    flavor-gnn/artifacts/m1_baseline.json — per-task metrics + label counts

Usage:
    python -m src.baselines.morgan_rf [--out <path>] [--fp-bits 2048] [--radius 2]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from rdkit import Chem
from rdkit.Chem import AllChem
from rdkit import RDLogger
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split

RDLogger.DisableLog("rdApp.*")

TASKS = ("sweet", "bitter", "umami", "salty", "sour")
SEED = 42


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def morgan_fp(smiles: str, radius: int, bits: int) -> np.ndarray | None:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    fp = AllChem.GetMorganFingerprintAsBitVect(mol, radius, nBits=bits)
    arr = np.zeros(bits, dtype=np.uint8)
    from rdkit.DataStructs import ConvertToNumpyArray
    ConvertToNumpyArray(fp, arr)
    return arr


def featurize(df: pd.DataFrame, radius: int, bits: int):
    X, keep = [], []
    for i, smi in enumerate(df["smiles"].tolist()):
        fp = morgan_fp(smi, radius, bits)
        if fp is None:
            continue
        X.append(fp)
        keep.append(i)
    return np.stack(X), df.iloc[keep].reset_index(drop=True)


def train_task(X: np.ndarray, y: np.ndarray) -> dict:
    if y.sum() < 5 or (len(y) - y.sum()) < 5:
        return {"skipped": True, "reason": "too few positives/negatives", "positives": int(y.sum()), "n": int(len(y))}
    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=SEED,
    )
    clf = RandomForestClassifier(
        n_estimators=300, n_jobs=-1, random_state=SEED, class_weight="balanced",
    )
    clf.fit(X_tr, y_tr)
    y_pred = clf.predict(X_te)
    return {
        "skipped": False,
        "n": int(len(y)),
        "positives": int(y.sum()),
        "train_n": int(len(y_tr)),
        "test_n": int(len(y_te)),
        "test_positives": int(y_te.sum()),
        "f1": float(f1_score(y_te, y_pred, zero_division=0)),
        "precision": float(precision_score(y_te, y_pred, zero_division=0)),
        "recall": float(recall_score(y_te, y_pred, zero_division=0)),
        "f1_macro": float(f1_score(y_te, y_pred, average="macro", zero_division=0)),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default=str(_project_root() / "flavor-gnn" / "data" / "compounds.parquet"))
    parser.add_argument("--out", default=str(_project_root() / "flavor-gnn" / "artifacts" / "m1_baseline.json"))
    parser.add_argument("--fp-bits", type=int, default=2048)
    parser.add_argument("--radius", type=int, default=2)
    args = parser.parse_args()

    df = pd.read_parquet(args.data)
    print(f"[M1] loaded {len(df)} compounds")

    n_before = len(df)
    X, df = featurize(df, args.radius, args.fp_bits)
    print(f"[M1] featurized: {X.shape[0]} rows × {X.shape[1]} bits "
          f"(dropped {n_before - X.shape[0]} unparseable SMILES)")

    results = {}
    for task in TASKS:
        y = df[task].to_numpy().astype(np.uint8)
        res = train_task(X, y)
        results[task] = res
        if res.get("skipped"):
            print(f"       {task:6s}: skipped ({res['reason']}, n={res['n']}, pos={res['positives']})")
        else:
            print(f"       {task:6s}: F1={res['f1']:.3f}  P={res['precision']:.3f}  R={res['recall']:.3f}  "
                  f"(pos={res['positives']}/{res['n']}, test_pos={res['test_positives']})")

    out = {
        "model": "RandomForest(n=300, class_weight=balanced)",
        "features": {"type": "morgan", "radius": args.radius, "bits": args.fp_bits},
        "seed": SEED,
        "compounds": int(len(df)),
        "per_task": results,
    }
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2))
    print(f"[M1] wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
