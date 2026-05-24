"""spatial_rebalance.py — post-process V3 positions for better visual UX.

Three sequential transforms applied to `flavor_positions_v3.json` and
`flavor_positions_2d_v3.json` after the layout pipeline has finished:

  1. **Global radial compression** of cluster centroids.
     Pulls far-out cluster centroids inward via r' = sqrt(r * R_median).
     Preserves the median radius (so the overall scene scale doesn't
     shrink) while compressing outliers by ~30-40%.

  2. **Per-cluster local spread expansion** for tight clusters.
     For each cluster, computes the median member-to-centroid distance.
     If the cluster is tighter than `tight_threshold`, all member
     offsets get scaled by `spread_factor`. Loose clusters left alone.

  3. **Per-alias jitter** for the 113+ aliases that currently sit
     directly on top of their canonical. Each aliased name gets a
     deterministic offset from sha1(name), scaled to `alias_jitter`
     unit radius. Visually transforms a 1-dot pile into a tight
     constellation around the canonical.

Run AFTER `apply_v3_assignments.py` + `fold_aliases_visually.py` since
this script reads the alias map to identify which positions should
get the jitter. Idempotent against the .pre-rebalance.bak snapshots.

Usage:
    python flavor-gnn/scripts/spatial_rebalance.py [--dry-run] [--strength gentle]

Strengths (`--strength`):
    gentle    (default) sqrt radial, 1.5x spread for tight clusters, 0.3 jitter
    moderate  r^0.6 radial, 2x spread, 0.5 jitter
    aggressive log(1+r) radial, 2.5x spread, 0.7 jitter
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

CLUSTER_LABELS = ROOT / "public" / "proDataset" / "cluster_labels_v3.json"
POS_3D = ROOT / "public" / "proDataset" / "flavor_positions_v3.json"
POS_2D = ROOT / "public" / "proDataset" / "flavor_positions_2d_v3.json"
ALIAS_MAP = ROOT / "flavor-gnn" / "curation" / "v3_alias_map.json"

STRENGTHS = {
    "gentle":     {"radial_mode": "sqrt",   "tight_threshold": 2.0, "spread_factor": 1.5, "alias_jitter": 0.3},
    "moderate":   {"radial_mode": "pow06",  "tight_threshold": 2.5, "spread_factor": 2.0, "alias_jitter": 0.5},
    "aggressive": {"radial_mode": "log1p",  "tight_threshold": 3.0, "spread_factor": 2.5, "alias_jitter": 0.7},
}


def snapshot(path: Path) -> None:
    bak = path.with_suffix(path.suffix + ".pre-rebalance.bak")
    if not bak.exists():
        shutil.copy2(path, bak)


def deterministic_offset(name: str, scale: float, dims: int = 3) -> list[float]:
    """Unit-sphere-ish offset from sha1(name), then scaled."""
    h = hashlib.sha1(name.encode("utf-8")).digest()
    raw = [(h[i] - 128) / 128.0 for i in range(dims)]
    # Normalize to unit length then re-scale to scale * uniform-in-ball
    mag = math.sqrt(sum(x * x for x in raw)) or 1.0
    radius_frac = (h[dims] / 255.0) ** (1.0 / dims)  # uniform-in-ball
    return [scale * radius_frac * (x / mag) for x in raw]


def compress_radial(r: float, r_anchor: float, mode: str) -> float:
    if r <= 1e-6:
        return r
    if mode == "sqrt":
        return math.sqrt(r * r_anchor)
    if mode == "pow06":
        return (r ** 0.6) * (r_anchor ** 0.4)
    if mode == "log1p":
        # tuned so r_anchor maps to itself
        k = r_anchor / math.log1p(r_anchor) if r_anchor > 0 else 1.0
        return k * math.log1p(r)
    raise ValueError(f"unknown radial mode: {mode}")


def main(strength: str, dry_run: bool) -> None:
    cfg = STRENGTHS[strength]
    print(f"[rebalance] strength={strength}  {cfg}")

    cluster_labels = json.loads(CLUSTER_LABELS.read_text(encoding="utf-8"))
    pos_3d = {k: list(v) for k, v in json.loads(POS_3D.read_text(encoding="utf-8")).items()}
    pos_2d = {k: list(v) for k, v in json.loads(POS_2D.read_text(encoding="utf-8")).items()}
    alias_map = json.loads(ALIAS_MAP.read_text(encoding="utf-8"))
    aliases = set(alias_map.get("auto_high_confidence", {}).keys())

    name_to_cid = cluster_labels["ingredients"]
    by_cluster: dict[int, list[str]] = {}
    for name, cid in name_to_cid.items():
        by_cluster.setdefault(cid, []).append(name)

    # ── 1. Compute cluster centroids from current member positions ────
    centroids_3d: dict[int, list[float]] = {}
    centroids_2d: dict[int, list[float]] = {}
    for cid, members in by_cluster.items():
        pts3 = [pos_3d[n] for n in members if n in pos_3d]
        pts2 = [pos_2d[n] for n in members if n in pos_2d]
        if pts3:
            centroids_3d[cid] = [sum(p[i] for p in pts3) / len(pts3) for i in range(3)]
        if pts2:
            centroids_2d[cid] = [sum(p[i] for p in pts2) / len(pts2) for i in range(2)]

    # ── 2. Radial compression of centroids around origin ──────────────
    radii_3d = [math.sqrt(sum(c[i] ** 2 for i in range(3))) for c in centroids_3d.values()]
    radii_2d = [math.sqrt(sum(c[i] ** 2 for i in range(2))) for c in centroids_2d.values()]
    r_anchor_3d = sorted(radii_3d)[len(radii_3d) // 2] if radii_3d else 1.0
    r_anchor_2d = sorted(radii_2d)[len(radii_2d) // 2] if radii_2d else 1.0
    print(f"[rebalance] median centroid radius — 3D: {r_anchor_3d:.2f}  2D: {r_anchor_2d:.2f}")

    centroid_shifts_3d: dict[int, list[float]] = {}
    centroid_shifts_2d: dict[int, list[float]] = {}
    for cid, c in centroids_3d.items():
        r = math.sqrt(sum(c[i] ** 2 for i in range(3)))
        if r < 1e-6:
            centroid_shifts_3d[cid] = [0.0, 0.0, 0.0]
            continue
        r_new = compress_radial(r, r_anchor_3d, cfg["radial_mode"])
        scale = r_new / r
        centroid_shifts_3d[cid] = [c[i] * (scale - 1.0) for i in range(3)]
    for cid, c in centroids_2d.items():
        r = math.sqrt(sum(c[i] ** 2 for i in range(2)))
        if r < 1e-6:
            centroid_shifts_2d[cid] = [0.0, 0.0]
            continue
        r_new = compress_radial(r, r_anchor_2d, cfg["radial_mode"])
        scale = r_new / r
        centroid_shifts_2d[cid] = [c[i] * (scale - 1.0) for i in range(2)]

    # ── 3. Compute per-cluster local spread + apply expansion ─────────
    spread_factors: dict[int, float] = {}
    for cid, members in by_cluster.items():
        pts = [pos_3d[n] for n in members if n in pos_3d]
        if len(pts) < 3:
            spread_factors[cid] = 1.0
            continue
        c = centroids_3d[cid]
        dists = [math.sqrt(sum((p[i] - c[i]) ** 2 for i in range(3))) for p in pts]
        dists.sort()
        median_dist = dists[len(dists) // 2]
        spread_factors[cid] = cfg["spread_factor"] if median_dist < cfg["tight_threshold"] else 1.0

    tight = sum(1 for f in spread_factors.values() if f > 1.0)
    print(f"[rebalance] tight clusters (will be spread out): {tight} / {len(spread_factors)}")

    # ── 4. Apply transforms per node ──────────────────────────────────
    aliased_jittered = 0
    for name, cid in name_to_cid.items():
        if cid not in centroid_shifts_3d:
            continue
        # 3D
        if name in pos_3d:
            p = pos_3d[name]
            c = centroids_3d[cid]
            local = [p[i] - c[i] for i in range(3)]
            local = [v * spread_factors[cid] for v in local]
            new_c = [c[i] + centroid_shifts_3d[cid][i] for i in range(3)]
            new_p = [new_c[i] + local[i] for i in range(3)]
            if name in aliases:
                jit = deterministic_offset(name, cfg["alias_jitter"], dims=3)
                new_p = [new_p[i] + jit[i] for i in range(3)]
                aliased_jittered += 1
            pos_3d[name] = [round(v, 4) for v in new_p]
        # 2D
        if name in pos_2d:
            p = pos_2d[name]
            c = centroids_2d[cid]
            local = [p[i] - c[i] for i in range(2)]
            local = [v * spread_factors[cid] for v in local]
            new_c = [c[i] + centroid_shifts_2d[cid][i] for i in range(2)]
            new_p = [new_c[i] + local[i] for i in range(2)]
            if name in aliases:
                jit = deterministic_offset(name, cfg["alias_jitter"], dims=2)
                new_p = [new_p[i] + jit[i] for i in range(2)]
            pos_2d[name] = [round(v, 4) for v in new_p]

    print(f"[rebalance] jittered {aliased_jittered // 2} alias nodes (3D)")

    # ── 5. Recompute centroids stored in cluster_labels.clusters ──────
    for c_entry in cluster_labels["clusters"]:
        cid = c_entry["id"]
        members = by_cluster.get(cid, [])
        pts = [pos_3d[n] for n in members if n in pos_3d]
        if pts:
            c_entry["centroid_3d"] = [round(sum(p[i] for p in pts) / len(pts), 4) for i in range(3)]

    # ── 6. Report bbox before/after ────────────────────────────────────
    xs = [p[0] for p in pos_3d.values()]
    ys = [p[1] for p in pos_3d.values()]
    zs = [p[2] for p in pos_3d.values()]
    print(f"[rebalance] new 3D bbox: x={min(xs):.1f}..{max(xs):.1f}  "
          f"y={min(ys):.1f}..{max(ys):.1f}  z={min(zs):.1f}..{max(zs):.1f}")

    # Position de-dup check
    keys = [tuple(round(v, 2) for v in p) for p in pos_3d.values()]
    dup = len(keys) - len(set(keys))
    print(f"[rebalance] duplicate (rounded) positions remaining: {dup}")

    if dry_run:
        print("[rebalance] dry-run — no files written")
        return

    snapshot(CLUSTER_LABELS)
    snapshot(POS_3D)
    snapshot(POS_2D)

    CLUSTER_LABELS.write_text(json.dumps(cluster_labels, separators=(",", ":")), encoding="utf-8")
    POS_3D.write_text(json.dumps(pos_3d, separators=(",", ":")), encoding="utf-8")
    POS_2D.write_text(json.dumps(pos_2d, separators=(",", ":")), encoding="utf-8")
    print("[rebalance] wrote 3D positions, 2D positions, cluster centroids")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--strength", choices=list(STRENGTHS), default="gentle")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    main(strength=args.strength, dry_run=args.dry_run)
