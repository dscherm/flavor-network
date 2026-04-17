"""Best-effort ONNX export of the M3 multi-task model.

PyG's GINEConv uses scatter_add under the hood, which historically has
incomplete ONNX op coverage. We try the export with dynamic axes; if it
fails, the PyTorch checkpoint + score_all.py offline inference path is
sufficient for the build-time rescoring use case (no browser-side
inference required).

Usage:
    python -m src.export.to_onnx
"""
from __future__ import annotations

import argparse
from pathlib import Path

import torch

from ..models.featurize import smiles_to_data
from ..models.mpnn import MPNN


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ckpt", default=str(_project_root() / "flavor-gnn" / "artifacts" / "m3_multitask.pt"))
    parser.add_argument("--out", default=str(_project_root() / "flavor-gnn" / "artifacts" / "m3_multitask.onnx"))
    parser.add_argument("--opset", type=int, default=17)
    args = parser.parse_args()

    ckpt = torch.load(args.ckpt, map_location="cpu", weights_only=False)
    model = MPNN(
        ckpt["atom_dim"], ckpt["bond_dim"],
        hidden=ckpt["hidden"], num_layers=ckpt["num_layers"],
        num_tasks=len(ckpt["tasks"]),
    )
    model.load_state_dict(ckpt["state_dict"])
    model.eval()

    # Wrap the Data-based forward in a plain-tensor signature so torch.onnx.export
    # can trace it. Inputs: x (N,atom_dim), edge_index (2,E), edge_attr (E,bond_dim),
    # batch (N,). Outputs: logits (G,T).
    class FlatWrapper(torch.nn.Module):
        def __init__(self, m):
            super().__init__()
            self.m = m
        def forward(self, x, edge_index, edge_attr, batch):
            class _Data: pass
            d = _Data()
            d.x = x; d.edge_index = edge_index; d.edge_attr = edge_attr; d.batch = batch
            return self.m(d)

    wrapper = FlatWrapper(model)

    # Dummy graph for tracing: benzene-ish, 4 atoms, 4 bonds (directed both ways → 8 edges)
    d = smiles_to_data("c1ccccc1")  # 6 atoms, 6 aromatic bonds (12 directed)
    if d is None:
        print("[onnx] dummy SMILES failed to parse — aborting")
        return 2
    x = d.x
    edge_index = d.edge_index
    edge_attr = d.edge_attr
    batch = torch.zeros(x.size(0), dtype=torch.long)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        torch.onnx.export(
            wrapper, (x, edge_index, edge_attr, batch),
            out_path,
            input_names=["x", "edge_index", "edge_attr", "batch"],
            output_names=["logits"],
            dynamic_axes={
                "x": {0: "N"},
                "edge_index": {1: "E"},
                "edge_attr": {0: "E"},
                "batch": {0: "N"},
                "logits": {0: "G"},
            },
            opset_version=args.opset,
            do_constant_folding=True,
            dynamo=False,
        )
    except Exception as err:
        print(f"[onnx] export failed: {type(err).__name__}: {err}")
        print("[onnx] This is a known limitation with PyG GNN exports (scatter_add).")
        print("[onnx] The PyTorch checkpoint + score_all.py offline path remains available.")
        return 1

    print(f"[onnx] exported {out_path}")

    # Quick round-trip sanity check
    try:
        import onnxruntime as ort
        sess = ort.InferenceSession(str(out_path), providers=["CPUExecutionProvider"])
        logits = sess.run(None, {
            "x": x.numpy(),
            "edge_index": edge_index.numpy(),
            "edge_attr": edge_attr.numpy(),
            "batch": batch.numpy(),
        })[0]
        print(f"[onnx] round-trip logits shape={logits.shape}, dtype={logits.dtype}")
    except Exception as err:
        print(f"[onnx] export wrote file, but round-trip inference failed: {err}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
