#!/usr/bin/env python3
"""Add the odor_nutty head + reconcile woody, in place, from existing data.

Rather than re-running the full source pipeline (which needs flavornet.json +
pubchem_smiles.json, no longer present in chemDataset/processed), this rebuilds
the odor LABEL columns of compounds.parquet directly from the `flavor_tags`
column that is already stored on every odor-observed row. That is exactly what
build_compounds._odor_flags does at build time, so the result matches a fresh
build for FlavorDB profile rows (and approximates it for FlavorNet rows, whose
first descriptor tag is stored in flavor_tags).

What changes:
  - All 7 odor label columns (odor_fruity..odor_nutty) are re-derived from
    flavor_tags with the current ODOR_CATEGORIES (word-boundary match). This
    moves nutty out of woody, keeps mushroom in woody, and adds the new
    odor_nutty column.
  - mask_odor_nutty is added = mask_odor_woody (both odor sources observe all
    odor heads together, so any row that observed woody also observes nutty).
  - Taste labels/masks and all other columns are left untouched.

The original parquet is backed up to compounds.parquet.pre-nutty.bak.

Usage:
    python -m scripts.migrate_add_nutty
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from src.data.build_compounds import ODOR_TASKS, _odor_flags  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
PARQUET = ROOT / "flavor-gnn" / "data" / "compounds.parquet"
BACKUP = PARQUET.with_suffix(".parquet.pre-nutty.bak")


def _tags(v) -> list[str]:
    if v is None:
        return []
    return [str(x) for x in list(v)]


def main() -> int:
    df = pd.read_parquet(PARQUET)
    if not BACKUP.exists():
        shutil.copy2(PARQUET, BACKUP)
        print(f"backed up -> {BACKUP.relative_to(ROOT)}")

    before = {t: int(df[t].sum()) for t in ODOR_TASKS if t in df.columns}

    # Re-derive every odor label column from flavor_tags (current keyword logic).
    flags = df["flavor_tags"].map(lambda v: _odor_flags(_tags(v)))
    for t in ODOR_TASKS:
        df[t] = flags.map(lambda d, t=t: d[t]).astype(int)

    # New head observes wherever the existing odor heads observe.
    df["mask_odor_nutty"] = df["mask_odor_woody"].astype(int)

    df.to_parquet(PARQUET)

    after = {t: int(df[t].sum()) for t in ODOR_TASKS}
    obs = int(df["mask_odor_nutty"].sum())
    print(f"rows: {len(df)}  | odor-observed (mask_odor_nutty=1): {obs}")
    print(f"{'head':14s} {'before':>8s} {'after':>8s}")
    for t in ODOR_TASKS:
        print(f"{t:14s} {before.get(t, 0):8d} {after[t]:8d}")
    print(f"wrote {PARQUET.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
