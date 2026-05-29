"""gat_3d_positions.py — N3-GAT-POSITIONS (2026-05-29).

Project the v5 multi-task GAT 32d embeddings (gat_link_v5_embeddings.npy)
to 3D positions via UMAP and write to public/proDataset/flavor_positions_v3.json.

Rationale:
  N3-GAT-CLUSTERS shipped 2026-05-28 produced the cluster file
  (cluster_labels_v3.json) from GAT embeddings but did NOT regenerate
  the 3D positions. flavor_positions_v3.json was generated 3+ hours
  before the GAT model trained, so the 3D scene shows 7 chef-cognitive
  clusters with correct colors but spatially collapsed near the origin.

  This script closes the loop: same embeddings that drove the cluster
  partition now drive the 3D layout, so members of each cluster form
  spatially distinct groups in the scene.

Pipeline:
  1. Load embeddings + name_to_idx from artifacts/gat_link_v5*.
  2. UMAP(n_components=3, random_state=42, n_neighbors=15, min_dist=0.25).
  3. Standardize per axis (mean=0, std=1), then scale to match the
     existing flavor_positions_v3.json range (~SCENE_SCALE=22 gives
     a comparable spread to the pre-GAT layout's [-50, +50] range).
  4. Backup the existing flavor_positions_v3.json to
     .pre-N3-GAT-POS before overwriting.
  5. Names not in the GAT embeddings (compound foods, post-prune
     additions) keep their existing position from the backup so the
     ingredient set stays the same and the scene doesn't get holes.

Usage:
    python flavor-gnn/scripts/gat_3d_positions.py
    python flavor-gnn/scripts/gat_3d_positions.py --seed 42 --scene-scale 22
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import numpy as np
import torch
import umap

REPO = Path(__file__).resolve().parents[2]
ART = REPO / "flavor-gnn" / "artifacts"
PRO = REPO / "public" / "proDataset"

VARIANT = "v5"
DEFAULT_SCENE_SCALE = 22.0
DEFAULT_SEED = 42


def main(seed: int = DEFAULT_SEED, scene_scale: float = DEFAULT_SCENE_SCALE):
    print("=" * 64)
    print("N3-GAT-POSITIONS — project GAT v5 32d embeddings to 3D")
    print("=" * 64)

    emb_path = ART / f"gat_link_{VARIANT}_embeddings.npy"
    ckpt_path = ART / f"gat_link_{VARIANT}.pt"
    if not emb_path.exists() or not ckpt_path.exists():
        print(f"ERROR: missing artifact(s)\n  {emb_path}\n  {ckpt_path}", file=sys.stderr)
        sys.exit(1)

    print(f"\n[1] loading embeddings + checkpoint")
    embeddings = np.load(emb_path)
    ckpt = torch.load(ckpt_path, weights_only=False)
    name_to_idx = ckpt["name_to_idx"]
    idx_to_name = {i: n for n, i in name_to_idx.items()}
    print(f"  embeddings: shape={embeddings.shape}  (32d × {len(name_to_idx)} nodes)")

    print(f"\n[2] UMAP n_components=3 (seed={seed})")
    reducer = umap.UMAP(
        n_components=3,
        n_neighbors=15,
        min_dist=0.25,
        random_state=seed,
        metric="cosine",
    )
    coords_3d = reducer.fit_transform(embeddings)
    print(f"  raw UMAP range: x[{coords_3d[:,0].min():.2f},{coords_3d[:,0].max():.2f}]  "
          f"y[{coords_3d[:,1].min():.2f},{coords_3d[:,1].max():.2f}]  "
          f"z[{coords_3d[:,2].min():.2f},{coords_3d[:,2].max():.2f}]")

    print(f"\n[3] standardize + scale to SCENE_SCALE={scene_scale}")
    coords_3d = (coords_3d - coords_3d.mean(axis=0)) / (coords_3d.std(axis=0) + 1e-8)
    coords_3d *= scene_scale
    print(f"  scaled range: x[{coords_3d[:,0].min():.2f},{coords_3d[:,0].max():.2f}]  "
          f"y[{coords_3d[:,1].min():.2f},{coords_3d[:,1].max():.2f}]  "
          f"z[{coords_3d[:,2].min():.2f},{coords_3d[:,2].max():.2f}]")

    print(f"\n[4] backup + merge with existing positions for orphan retention")
    target = PRO / "flavor_positions_v3.json"
    backup = PRO / "flavor_positions_v3.json.pre-N3-GAT-POS"
    existing = json.loads(target.read_text(encoding="utf-8")) if target.exists() else {}
    if target.exists() and not backup.exists():
        shutil.copy2(target, backup)
        print(f"  backed up pre-image -> {backup.name}")
    elif backup.exists():
        print(f"  backup already exists at {backup.name} (not overwriting)")

    new_positions = {}
    for i in range(len(name_to_idx)):
        name = idx_to_name[i]
        new_positions[name] = [
            round(float(coords_3d[i, 0]), 4),
            round(float(coords_3d[i, 1]), 4),
            round(float(coords_3d[i, 2]), 4),
        ]

    orphan_count = 0
    for name, pos in existing.items():
        if name not in new_positions:
            new_positions[name] = pos
            orphan_count += 1
    print(f"  GAT-positioned: {len(name_to_idx)} nodes")
    print(f"  carried-over orphans (not in GAT embeddings): {orphan_count} nodes")
    print(f"  total positions: {len(new_positions)}")

    print(f"\n[5] write {target.name}")
    target.write_text(json.dumps(new_positions, indent=2), encoding="utf-8")
    print(f"  wrote {target}  ({target.stat().st_size} bytes)")
    print("\n[done]")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--seed", type=int, default=DEFAULT_SEED)
    p.add_argument("--scene-scale", type=float, default=DEFAULT_SCENE_SCALE)
    args = p.parse_args()
    main(seed=args.seed, scene_scale=args.scene_scale)
