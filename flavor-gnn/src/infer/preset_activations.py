"""Precompute per-layer activations for the 10 preset molecules.

For each preset, runs the M3 model's forward_trace() to get:
  - per-atom activation magnitudes at each GINEConv layer
  - atom count (tells the diagram how many circles to draw)
  - calibrated prediction probabilities

Output: public/models/preset_activations.json
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch

from ..models.featurize import smiles_to_data
from ..models.mpnn import MPNN
from .calibrate import apply_shift

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

    presets_path = _project_root() / "public" / "models" / "preset_predictions.json"
    with presets_path.open("r", encoding="utf-8") as fh:
        presets = json.load(fh)["presets"]

    from torch_geometric.loader import DataLoader

    out = {}
    for p in presets:
        d = smiles_to_data(p["smiles"])
        if d is None:
            continue
        loader = DataLoader([d], batch_size=1, shuffle=False)
        batch = next(iter(loader))

        with torch.no_grad():
            trace = model.forward_trace(batch)

        atom_count = int(d.x.size(0))
        layers = {}
        for key in ["atom_enc", "layer_1", "layer_2", "layer_3"]:
            if key not in trace:
                continue
            act = trace[key].numpy()  # (N_atoms, hidden)
            magnitudes = np.linalg.norm(act, axis=1).tolist()
            layers[key] = [float(round(m, 3)) for m in magnitudes]

        raw_logits = trace["logits"].numpy()
        raw_probs = 1.0 / (1.0 + np.exp(-raw_logits))
        cal_probs = apply_shift(raw_probs, TASKS)[0]

        out[p["name"]] = {
            "atom_count": atom_count,
            "layers": layers,
            "predictions": {t: float(round(v, 4)) for t, v in zip(TASKS, cal_probs.tolist())},
        }
        print(f"[activations] {p['name']:22s}  atoms={atom_count}  "
              + "  ".join(f"L{i}={len(v)}" for i, (_, v) in enumerate(layers.items())))

    out_path = _project_root() / "public" / "models" / "preset_activations.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(out, fh)
    print(f"[activations] wrote {out_path} — {len(out)} presets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
