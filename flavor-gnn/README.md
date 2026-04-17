# flavor-gnn — Molecular GNN for taste/odor prediction (C variant)

A Python project that trains a graph neural network on the assembled
chemDataset (FooDB + FlavorDB + ChemTasteDB + BitterDB + SuperSweetDB)
and exports an ONNX artifact consumable from the web app.

**Status:** scaffold only. Full training is weeks of work. See
`docs/roadmap.md` for the milestones.

## Targets

Multi-task head predicting, from a SMILES string:
- `sweet`, `bitter`, `umami`, `salty`, `sour` (taste probabilities)
- `odor_class` (k-way classification over FlavorDB / Flavornet descriptors)
- `intensity` (regression, scaled against SuperSweetDB / BitterDB where labels exist)

## Stack

- `rdkit-pypi` — SMILES → RDKit mol → atom/bond features
- `torch` + `torch-geometric` — MPNN with 3–5 message-passing layers
- `onnxruntime` + `torch.onnx.export` for export
- `wandb` (optional) for tracking

## Milestones

1. **M0 data join** — reuse chemDataset/processed/*.json; produce a unified
   `compounds.parquet` with SMILES + multi-label taste + odor class.
2. **M1 baseline** — Random Forest on Morgan fingerprints; establish
   per-task F1 to beat.
3. **M2 MPNN** — small 3-layer GNN; aim to beat baseline on bitter/sweet.
4. **M3 multi-task** — joint training on all labels with per-task heads.
5. **M4 export** — ONNX artifact in `public/models/flavor-gnn.onnx`,
   plus `src/ml/flavorGnn.js` wrapper over onnxruntime-web.

## Non-goals (for v1)

- Texture prediction (separate dataset tradition; out of scope).
- Real-time inference on >1k molecules in the browser (build-time scoring only).
