"""Precompute GNN predictions for a small set of well-known flavor molecules.

The Molecule Lab UI renders these as a preset picker until full browser-side
SMILES → features → ONNX inference lands. Each preset is a canonical
example of a taste class.

Output: public/models/preset_predictions.json
"""
from __future__ import annotations

import json
from pathlib import Path

import torch

from ..models.featurize import smiles_to_data
from ..models.mpnn import MPNN
from .calibrate import apply_shift
import numpy as np


PRESETS = [
    {"name": "Caffeine", "smiles": "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
     "intuition": "Classic bitter alkaloid"},
    {"name": "Vanillin", "smiles": "COC1=C(C=CC(=C1)C=O)O",
     "intuition": "Sweet-vanilla aroma"},
    {"name": "Capsaicin", "smiles": "CC(C)/C=C/CCCCC(=O)NCC1=CC(=C(C=C1)O)OC",
     "intuition": "Chili pungency (not a taste our model tracks)"},
    {"name": "Aspartame", "smiles": "COC(=O)C(CC1=CC=CC=C1)NC(=O)C(CC(=O)O)N",
     "intuition": "Artificial sweetener, ~200× sucrose"},
    {"name": "Monosodium Glutamate", "smiles": "C(CC(C(=O)[O-])N)C(=O)O.[Na+]",
     "intuition": "Canonical umami"},
    {"name": "Quinine", "smiles": "COC1=CC2=C(C=C1)C(=CN=C2)C(C1CC2CCN1CC2C=C)O",
     "intuition": "Extremely bitter, used in tonic water"},
    {"name": "Citric Acid", "smiles": "OC(=O)CC(O)(CC(=O)O)C(=O)O",
     "intuition": "Sour / tart (lemons)"},
    {"name": "Glucose", "smiles": "C([C@@H]1[C@H]([C@@H]([C@H]([C@H](O1)O)O)O)O)O",
     "intuition": "Primary sugar, mildly sweet"},
    {"name": "Menthol", "smiles": "CC(C)C1CCC(C)CC1O",
     "intuition": "Cooling, minty — odor-dominant"},
    {"name": "Sodium Chloride", "smiles": "[Na+].[Cl-]",
     "intuition": "Pure salt"},
]

TASKS = ["sweet", "bitter", "umami", "salty", "sour",
         "odor_fruity", "odor_floral", "odor_green", "odor_woody", "odor_spicy",
         "odor_fatty", "odor_nutty"]


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def main() -> int:
    ckpt_path = _project_root() / "flavor-gnn" / "artifacts" / "m3_multitask.pt"
    ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    model = MPNN(
        ckpt["atom_dim"], ckpt["bond_dim"],
        hidden=ckpt["hidden"], num_layers=ckpt["num_layers"],
        num_tasks=len(ckpt["tasks"]),
    )
    model.load_state_dict(ckpt["state_dict"])
    model.eval()

    from torch_geometric.loader import DataLoader

    out = []
    for p in PRESETS:
        d = smiles_to_data(p["smiles"])
        if d is None:
            print(f"[presets] skip {p['name']}: SMILES parse failed")
            continue
        loader = DataLoader([d], batch_size=1, shuffle=False)
        with torch.no_grad():
            batch = next(iter(loader))
            logits = model(batch).view(-1)
            raw = torch.sigmoid(logits).numpy()[None, :]  # (1, T)
        calibrated = apply_shift(raw, TASKS)[0]
        out.append({
            "name": p["name"],
            "smiles": p["smiles"],
            "intuition": p["intuition"],
            "predictions": {t: float(round(v, 4)) for t, v in zip(TASKS, calibrated.tolist())},
            "predictions_raw": {t: float(round(v, 4)) for t, v in zip(TASKS, raw[0].tolist())},
        })
        print(f"[presets] {p['name']:22s} -> " + "  ".join(f"{t}={float(v):.2f}" for t, v in zip(TASKS, calibrated.tolist())))

    out_path = _project_root() / "public" / "models" / "preset_predictions.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump({"tasks": TASKS, "presets": out}, fh, indent=2)
    print(f"[presets] wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
