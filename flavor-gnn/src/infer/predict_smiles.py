"""CLI tool: SMILES -> JSON taste predictions (calibrated).

Usage:
    python -m src.infer.predict_smiles "CCO"
    -> {"smiles":"CCO","predictions":{"sweet":0.12,...},"valid":true}

Exit code 0 = success, 1 = invalid SMILES, 2 = model error.
Used by the Express API to serve /api/gnn/predict without a persistent Python
server process.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import torch

from ..models.featurize import smiles_to_data
from ..models.mpnn import MPNN
from .calibrate import apply_shift

TASKS = ["sweet", "bitter", "umami", "salty", "sour"]


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: predict_smiles <SMILES>", "valid": False}))
        return 1

    smiles = sys.argv[1].strip()
    if not smiles:
        print(json.dumps({"error": "empty SMILES", "valid": False}))
        return 1

    ckpt_path = _project_root() / "flavor-gnn" / "artifacts" / "m3_multitask.pt"
    try:
        ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)
        model = MPNN(
            ckpt["atom_dim"], ckpt["bond_dim"],
            hidden=ckpt["hidden"], num_layers=ckpt["num_layers"],
            num_tasks=len(ckpt["tasks"]),
        )
        model.load_state_dict(ckpt["state_dict"])
        model.eval()
    except Exception as e:
        print(json.dumps({"error": f"model load: {e}", "valid": False}))
        return 2

    d = smiles_to_data(smiles)
    if d is None:
        print(json.dumps({"smiles": smiles, "error": "invalid SMILES or parse failure", "valid": False}))
        return 1

    from torch_geometric.loader import DataLoader
    loader = DataLoader([d], batch_size=1, shuffle=False)
    batch = next(iter(loader))

    with torch.no_grad():
        logits = model(batch).numpy()
    raw = 1.0 / (1.0 + np.exp(-logits))
    cal = apply_shift(raw, TASKS)[0]

    out = {
        "smiles": smiles,
        "valid": True,
        "atom_count": int(d.x.size(0)),
        "predictions": {t: float(round(v, 4)) for t, v in zip(TASKS, cal.tolist())},
        "predictions_raw": {t: float(round(v, 4)) for t, v in zip(TASKS, raw[0].tolist())},
    }
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
