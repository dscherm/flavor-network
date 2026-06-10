#!/usr/bin/env python3
"""Build compounds_p3b_trainonly.parquet — expanded odor data as TRAIN-ONLY augmentation.

compounds_p3b_trainonly.parquet = original compounds (labels UNCHANGED,
is_augment=0) + net-new odor-dataset molecules (is_augment=1, odor-only masked).
Existing molecules are NOT relabeled, so when scaffold_split_eval forces
is_augment rows into train, the test/val sets are pure-original molecules
evaluated against ORIGINAL labels. This isolates "does the extra training data
help predict OUR labels" from the augmented-test-set confound in the combined
P3b run.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
from rdkit import Chem

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from src.data.build_compounds import ODOR_CATEGORIES, ODOR_TASKS, TASTE_TASKS  # noqa: E402

import pyrfume  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
IN_PARQUET = ROOT / "flavor-gnn" / "data" / "compounds.parquet"
OUT_PARQUET = ROOT / "flavor-gnn" / "data" / "compounds_p3b_trainonly.parquet"


def canon(s):
    try:
        m = Chem.MolFromSmiles(str(s))
        return Chem.MolToSmiles(m) if m else None
    except Exception:
        return None


def main() -> int:
    df = pd.read_parquet(IN_PARQUET).copy()
    df["is_augment"] = 0
    have = set(x for x in (canon(s) for s in df["smiles"]) if x)

    mol = pyrfume.load_data("leffingwell/molecules.csv")
    beh = pyrfume.load_data("leffingwell/behavior.csv")
    descriptors = list(beh.columns)
    head_for = {}
    for d in descriptors:
        dl = d.lower()
        for head, kws in ODOR_CATEGORIES.items():
            if dl in kws:
                head_for[d] = head
                break
    mapped = {h: [d for d in descriptors if head_for.get(d) == h] for h in ODOR_CATEGORIES}

    leff = pd.DataFrame({"_canon": [canon(s) for s in mol["IsomericSMILES"]]})
    for h in ODOR_CATEGORIES:
        cols = mapped[h]
        leff[f"odor_{h}"] = (beh[cols].sum(axis=1) > 0).astype(int).values if cols else 0
    leff = leff[leff["_canon"].notna()].drop_duplicates("_canon", keep="first")
    new = leff[~leff["_canon"].isin(have)]

    rows = []
    for _, r in new.iterrows():
        row = {c: None for c in df.columns}
        row["smiles"] = r["_canon"]
        row["is_augment"] = 1
        for t in TASTE_TASKS:
            row[t] = 0
            row[f"mask_{t}"] = 0
        for h in ODOR_CATEGORIES:
            row[f"odor_{h}"] = int(r[f"odor_{h}"])
            row[f"mask_odor_{h}"] = 1
        row["flavor_tags"] = []
        row["functional_groups"] = []
        row["has_profile"] = False
        rows.append(row)
    new_df = pd.DataFrame(rows)
    out = pd.concat([df, new_df], ignore_index=True)
    for t in list(TASTE_TASKS) + list(ODOR_TASKS):
        out[t] = out[t].fillna(0).astype(int)
        out[f"mask_{t}"] = out[f"mask_{t}"].fillna(0).astype(int)
    out["is_augment"] = out["is_augment"].fillna(0).astype(int)
    out.to_parquet(OUT_PARQUET)
    print(f"original rows (is_augment=0): {int((out['is_augment']==0).sum())}")
    print(f"augment rows  (is_augment=1): {int((out['is_augment']==1).sum())}")
    print(f"total: {len(out)}  | original odor labels UNCHANGED")
    print(f"wrote {OUT_PARQUET.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
