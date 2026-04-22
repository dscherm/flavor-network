"""Emit flavor-gnn/data/compound_labels.json — a SMILES → task-label
dict used by scripts/build_compound_tastes.cjs to build the
Molecule↔Taste visualization artifact.

Each entry is shaped { [task]: 0|1 } for all 11 tasks.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

TASKS = ("sweet", "bitter", "umami", "salty", "sour",
         "odor_fruity", "odor_floral", "odor_green", "odor_woody",
         "odor_spicy", "odor_fatty")


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def main() -> int:
    root = _project_root()
    df = pd.read_parquet(root / "flavor-gnn" / "data" / "compounds.parquet")
    # Emit two lookup tables so downstream (scripts/build_compound_tastes.cjs)
    # can join against FooDB either by SMILES or by InChI-key (FooDB stores
    # the InChI key in its mislabeled `smiles` field).
    by_smiles: dict[str, dict[str, int]] = {}
    by_inchi: dict[str, dict[str, int]] = {}
    for _, row in df.iterrows():
        smi = row.get("smiles")
        ikey = row.get("inchi_key")
        labels = {t: int(row[t]) for t in TASKS if t in row.index}
        if not any(labels.values()):
            continue
        if smi:
            by_smiles[smi] = labels
        if ikey:
            by_inchi[ikey] = labels

    out = {"by_smiles": by_smiles, "by_inchi": by_inchi}
    path = root / "flavor-gnn" / "data" / "compound_labels.json"
    path.write_text(json.dumps(out))
    print(f"[dump] by_smiles={len(by_smiles)}  by_inchi={len(by_inchi)} → {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
