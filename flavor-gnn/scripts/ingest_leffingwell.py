#!/usr/bin/env python3
"""Ingest the expanded odor dataset into compounds_p3b.parquet.

What it does:
  1. Load compounds.parquet (our existing labeled data).
  2. Load the odor dataset (3,522 molecules, 113 binary odor descriptors, all SMILES).
  3. Map descriptors -> our 6 odor heads via the curated ODOR_CATEGORIES
     keyword sets (same vocab the GNN uses).
  4. The dataset measures ODOR only -> mask_odor_*=1, taste masks untouched
     (existing rows) or 0 (net-new rows). This mirrors the FlavorNet masking
     established at v3.
  5. For existing molecules (canonical-SMILES match): logical-OR the odor labels
     in and set mask_odor_*=1. For net-new molecules: add rows with odor labels
     + odor masks, taste=0 with taste masks=0.
  6. Write compounds_p3b.parquet + print the lift.

Usage:
    python -m scripts.ingest_leffingwell
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
from rdkit import Chem

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from src.data.build_compounds import ODOR_CATEGORIES, ODOR_TASKS, TASTE_TASKS  # noqa: E402

import pyrfume  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
IN_PARQUET = ROOT / "flavor-gnn" / "data" / "compounds.parquet"
OUT_PARQUET = ROOT / "flavor-gnn" / "data" / "compounds_p3b.parquet"

# Heads whose Leffingwell labels we do NOT merge, because the two label
# sources define the head differently and merging hurts.
#   woody: our FlavorDB labels count nutty + mushroom as woody (~28% of woody
#   positives; 19% are woody ONLY because of those tags). Leffingwell maps
#   woody to {earthy, pine, smoky, woody} only — nutty/mushroom are explicitly
#   NOT woody there. Merging teaches the model "nutty/mushroom != woody" and
#   also drops the woody prior (31% positive rate in our data vs 11% in
#   Leffingwell), so recall on our test labels collapses (-0.157 F1). All five
#   other odor heads agree well enough to merge and improve.
LEFFINGWELL_EXCLUDE = {"woody"}


def canon(s) -> str | None:
    try:
        m = Chem.MolFromSmiles(str(s))
        return Chem.MolToSmiles(m) if m else None
    except Exception:
        return None


def main() -> int:
    df = pd.read_parquet(IN_PARQUET)
    df = df.copy()
    df["_canon"] = [canon(s) for s in df["smiles"]]

    mol = pyrfume.load_data("leffingwell/molecules.csv")
    beh = pyrfume.load_data("leffingwell/behavior.csv")
    descriptors = list(beh.columns)
    # descriptor -> head via curated keyword sets
    head_for: dict[str, str] = {}
    for d in descriptors:
        dl = d.lower()
        for head, kws in ODOR_CATEGORIES.items():
            if dl in kws:
                head_for[d] = head
                break
    mapped = {h: [d for d in descriptors if head_for.get(d) == h] for h in ODOR_CATEGORIES}

    # per-molecule head labels (positive if any mapped descriptor fires)
    leff = pd.DataFrame({"_canon": [canon(s) for s in mol["IsomericSMILES"]]})
    for h in ODOR_CATEGORIES:
        cols = mapped[h]
        leff[f"odor_{h}"] = (beh[cols].sum(axis=1) > 0).astype(int).values if cols else 0
    leff = leff[leff["_canon"].notna()].drop_duplicates("_canon", keep="first")
    leff_by_canon = leff.set_index("_canon")

    before = {f"odor_{h}": int(df[f"odor_{h}"].sum()) for h in ODOR_CATEGORIES}

    # 1) update existing rows: OR odor labels, set odor masks observed
    existing = df["_canon"].isin(leff_by_canon.index)
    n_existing = int(existing.sum())
    for h in ODOR_CATEGORIES:
        if h in LEFFINGWELL_EXCLUDE:
            continue  # keep our original label + mask for this head untouched
        col = f"odor_{h}"
        lab = df.loc[existing, "_canon"].map(leff_by_canon[col])
        df.loc[existing, col] = np.maximum(df.loc[existing, col].values, lab.values)
        df.loc[existing, f"mask_{col}"] = 1

    # 2) net-new rows
    have = set(df["_canon"].dropna())
    new = leff_by_canon[~leff_by_canon.index.isin(have)].reset_index()
    new_rows = []
    for _, r in new.iterrows():
        row = {c: None for c in df.columns if c != "_canon"}
        row["smiles"] = r["_canon"]
        for t in TASTE_TASKS:
            row[t] = 0
            row[f"mask_{t}"] = 0          # taste unobserved by Leffingwell
        for h in ODOR_CATEGORIES:
            if h in LEFFINGWELL_EXCLUDE:
                row[f"odor_{h}"] = 0
                row[f"mask_odor_{h}"] = 0   # head excluded -> unobserved on this row
                continue
            row[f"odor_{h}"] = int(r[f"odor_{h}"])
            row[f"mask_odor_{h}"] = 1      # odor observed
        row["flavor_tags"] = []
        row["functional_groups"] = []
        row["has_profile"] = False
        row["_canon"] = r["_canon"]
        new_rows.append(row)
    new_df = pd.DataFrame(new_rows)

    out = pd.concat([df, new_df], ignore_index=True).drop(columns=["_canon"])
    # restore int dtype on label/mask columns
    for t in list(TASTE_TASKS) + list(ODOR_TASKS):
        out[t] = out[t].fillna(0).astype(int)
        out[f"mask_{t}"] = out[f"mask_{t}"].fillna(0).astype(int)

    out.to_parquet(OUT_PARQUET)

    after = {f"odor_{h}": int(out[f"odor_{h}"].sum()) for h in ODOR_CATEGORIES}
    obs = {f"odor_{h}": int(out[f"mask_odor_{h}"].sum()) for h in ODOR_CATEGORIES}
    print(f"existing rows updated : {n_existing}")
    print(f"net-new rows added    : {len(new_df)}")
    print(f"total rows            : {len(df)} -> {len(out)}")
    print(f"{'head':14s} {'before_pos':>10s} {'after_pos':>9s} {'observed':>9s}")
    for h in ODOR_CATEGORIES:
        c = f"odor_{h}"
        print(f"{c:14s} {before[c]:10d} {after[c]:9d} {obs[c]:9d}")
    print(f"wrote {OUT_PARQUET.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
