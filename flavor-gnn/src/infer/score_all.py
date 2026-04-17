"""Offline inference on every FooDB compound using the M3 multi-task GNN.

Writes chemDataset/processed/predictions.json:
    { "<foodb_id>": {
        "sweet": 0.04, "bitter": 0.91, "umami": 0.02,
        "salty": 0.01, "sour":  0.07 } }

Note: FooDB compounds have SMILES in the `cas` field (the upstream foodb
parser misnames columns — confirmed by spot-check against known compounds).
The `smiles` field holds an InChIKey.

Usage:
    python -m src.infer.score_all [--batch-size 128]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch

from ..models.featurize import smiles_to_data
from ..models.mpnn import MPNN


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def load_model(ckpt_path: Path, device: str):
    ckpt = torch.load(ckpt_path, map_location=device, weights_only=False)
    model = MPNN(
        ckpt["atom_dim"], ckpt["bond_dim"],
        hidden=ckpt["hidden"], num_layers=ckpt["num_layers"],
        num_tasks=len(ckpt["tasks"]),
    )
    model.load_state_dict(ckpt["state_dict"])
    model.to(device).eval()
    return model, ckpt["tasks"]


def iter_batches(items, batch_size: int):
    buf = []
    for it in items:
        buf.append(it)
        if len(buf) >= batch_size:
            yield buf
            buf = []
    if buf:
        yield buf


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ckpt", default=str(_project_root() / "flavor-gnn" / "artifacts" / "m3_multitask.pt"))
    parser.add_argument("--foodb", default=str(_project_root() / "chemDataset" / "processed" / "foodb.json"))
    parser.add_argument("--out", default=str(_project_root() / "chemDataset" / "processed" / "predictions.json"))
    parser.add_argument("--batch-size", type=int, default=128)
    args = parser.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[infer] device={device}")

    model, tasks = load_model(Path(args.ckpt), device)
    print(f"[infer] loaded multi-task model: {tasks}")

    with open(args.foodb, "r", encoding="utf-8") as fh:
        foodb = json.load(fh)
    compounds = foodb.get("compounds", {})
    print(f"[infer] scanning {len(compounds)} FooDB compounds")

    from torch_geometric.loader import DataLoader

    preds = {}
    parse_failed = 0
    prepared = []
    for cid, c in compounds.items():
        smi = c.get("cas")  # SMILES lives in the 'cas' column (upstream mislabel)
        if not smi or not isinstance(smi, str):
            continue
        d = smiles_to_data(smi)
        if d is None:
            parse_failed += 1
            continue
        d.foodb_id = cid
        prepared.append(d)

    print(f"[infer] featurized {len(prepared)} compounds ({parse_failed} SMILES failed to parse)")

    with torch.no_grad():
        for batch_list in iter_batches(prepared, args.batch_size):
            ids = [d.foodb_id for d in batch_list]
            for d in batch_list:
                if hasattr(d, "foodb_id"):
                    del d.foodb_id
            loader = DataLoader(batch_list, batch_size=len(batch_list), shuffle=False)
            batch = next(iter(loader)).to(device)
            logits = model(batch)
            probs = torch.sigmoid(logits).cpu().numpy()
            for cid, p in zip(ids, probs):
                preds[cid] = {t: float(round(v, 4)) for t, v in zip(tasks, p.tolist())}

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump({
            "tasks": tasks,
            "model": "m3_multitask.pt",
            "_count": len(preds),
            "predictions": preds,
        }, fh)
    print(f"[infer] wrote {out_path} — {len(preds)} predictions")

    # Quick sanity stats
    import statistics
    for i, t in enumerate(tasks):
        vals = [p[t] for p in preds.values()]
        mean = statistics.fmean(vals)
        hi = sum(1 for v in vals if v > 0.5)
        print(f"       {t:6s}: mean_prob={mean:.3f}  predicted_positive={hi}/{len(vals)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
