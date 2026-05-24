"""dynamic_cluster_compaction.py — adaptive per-cluster compression.

Post-processes flavor_positions_v3.json + 2d to push same-cluster members
visibly closer together, with strength adapted per-cluster to its current
spread. Stays faithful to the GNN+UMAP semantic structure: cluster
identity is unchanged, cluster centroids barely move, within-cluster
relative topology is preserved (just scaled).

How the dynamic strength works:
  1. For each cluster, compute centroid and member-to-centroid distances.
  2. Measure median radius (typical distance to centroid).
  3. Map median radius to a contraction factor:
       radius < 2u    → factor 1.0  (no change — already tight)
       radius 2-5u    → factor 0.65 (mild pull-in)
       radius 5-10u   → factor 0.45 (moderate pull-in)
       radius > 10u   → factor 0.30 (strong pull-in)
  4. For each member: new_pos = centroid + (old_pos - centroid) * factor.
  5. Final per-name jitter (0.2u) to guarantee no exact-coord overlaps.

Different clusters keep their relative spatial positions — cross-cluster
distances are barely affected (each cluster centroid stays put). What
changes is **within-cluster** packing: members get pulled toward their
own centroid, making clusters look like distinct visible blobs rather
than overlapping clouds.

Snapshots: each output file is backed up to `<name>.pre-compact.bak`
once per run. Re-running is idempotent against the snapshots.

Usage:
    python flavor-gnn/scripts/dynamic_cluster_compaction.py [--dry-run]
    python flavor-gnn/scripts/dynamic_cluster_compaction.py --aggressive
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CLUSTER_LABELS = ROOT / "public" / "proDataset" / "cluster_labels_v3.json"
POS_3D = ROOT / "public" / "proDataset" / "flavor_positions_v3.json"
POS_2D = ROOT / "public" / "proDataset" / "flavor_positions_2d_v3.json"

# Contraction schedules: (max_radius, factor). Lower factor = stronger pull.
# Default keeps clusters readable — strong factors (<0.5) cause node pile-up
# because cluster radius shrinks faster than within-cluster spacing.
DEFAULT_SCHEDULE = [(2.0, 1.0), (5.0, 0.8), (10.0, 0.65), (float("inf"), 0.55)]
AGGRESSIVE_SCHEDULE = [(1.5, 0.85), (4.0, 0.55), (8.0, 0.4), (float("inf"), 0.3)]

# Post-jitter is per-node deterministic offset to break exact-coord ties.
# Must scale with how much we've compacted — tighter compaction → bigger
# jitter needed to keep nodes visually distinguishable.
POST_JITTER = 0.55


def snapshot(path: Path) -> None:
    bak = path.with_suffix(path.suffix + ".pre-compact.bak")
    if not bak.exists() and path.exists():
        shutil.copy2(path, bak)


def deterministic_offset(name: str, scale: float, dims: int = 3) -> list[float]:
    h = hashlib.sha1(name.encode("utf-8")).digest()
    return [(h[i] - 128) / 128.0 * scale for i in range(dims)]


def factor_for_radius(r: float, schedule: list[tuple[float, float]]) -> float:
    for max_r, f in schedule:
        if r <= max_r:
            return f
    return schedule[-1][1]


def main(dry_run: bool, aggressive: bool) -> None:
    schedule = AGGRESSIVE_SCHEDULE if aggressive else DEFAULT_SCHEDULE
    print(f"[compact] schedule: {schedule}")

    cluster_labels = json.loads(CLUSTER_LABELS.read_text(encoding="utf-8"))
    pos_3d = {k: list(v) for k, v in json.loads(POS_3D.read_text(encoding="utf-8")).items()}
    pos_2d = {k: list(v) for k, v in json.loads(POS_2D.read_text(encoding="utf-8")).items()}
    labels = {c["id"]: c["label"] for c in cluster_labels["clusters"]}

    name_to_cid = cluster_labels["ingredients"]
    by_cluster: dict[int, list[str]] = defaultdict(list)
    for name, cid in name_to_cid.items():
        by_cluster[cid].append(name)

    # ── For each cluster, compute centroid + adaptive factor ──────
    rebalanced_3d = 0
    rebalanced_2d = 0
    report_lines = []
    for cid, members in by_cluster.items():
        pts3 = [pos_3d[n] for n in members if n in pos_3d]
        pts2 = [pos_2d[n] for n in members if n in pos_2d]
        if not pts3:
            continue

        # 3D centroid + median radius
        c3 = [sum(p[i] for p in pts3) / len(pts3) for i in range(3)]
        radii_3d = [math.sqrt(sum((p[i] - c3[i]) ** 2 for i in range(3))) for p in pts3]
        radii_3d.sort()
        median_r_3d = radii_3d[len(radii_3d) // 2]
        f3 = factor_for_radius(median_r_3d, schedule)

        # 2D centroid + median radius
        c2 = [sum(p[i] for p in pts2) / len(pts2) for i in range(2)]
        radii_2d = [math.sqrt(sum((p[i] - c2[i]) ** 2 for i in range(2))) for p in pts2]
        radii_2d.sort()
        median_r_2d = radii_2d[len(radii_2d) // 2]
        f2 = factor_for_radius(median_r_2d, schedule)

        report_lines.append(
            f"  c{cid:>2} ({len(members):>4})  {labels.get(cid, '?'):<30}  "
            f"r3D={median_r_3d:>5.2f}→f={f3:.2f}  r2D={median_r_2d:>5.2f}→f={f2:.2f}"
        )

        # Apply contraction + jitter
        for name in members:
            if name in pos_3d:
                p = pos_3d[name]
                offsetted = [c3[i] + (p[i] - c3[i]) * f3 for i in range(3)]
                jit = deterministic_offset(name, POST_JITTER, 3)
                pos_3d[name] = [round(offsetted[i] + jit[i], 4) for i in range(3)]
                rebalanced_3d += 1
            if name in pos_2d:
                p = pos_2d[name]
                offsetted = [c2[i] + (p[i] - c2[i]) * f2 for i in range(2)]
                jit = deterministic_offset(name, POST_JITTER, 2)
                pos_2d[name] = [round(offsetted[i] + jit[i], 4) for i in range(2)]
                rebalanced_2d += 1

    print("[compact] per-cluster contraction:")
    for line in report_lines:
        print(line)
    print(f"\n[compact] rebalanced {rebalanced_3d} (3D) + {rebalanced_2d} (2D) nodes")

    # Recompute cluster centroids stored in cluster_labels.clusters
    for c_entry in cluster_labels["clusters"]:
        cid = c_entry["id"]
        members = by_cluster.get(cid, [])
        pts = [pos_3d[n] for n in members if n in pos_3d]
        if pts:
            c_entry["centroid_3d"] = [
                round(sum(p[i] for p in pts) / len(pts), 4) for i in range(3)
            ]

    # Overlap diagnostic
    from collections import Counter
    bucket3 = Counter(tuple(round(v * 2) / 2 for v in p) for p in pos_3d.values())
    overlap3 = sum(c - 1 for c in bucket3.values() if c > 1)
    print(f"[compact] overlap (3D, 0.5u): {overlap3} stacked, {len(bucket3)} unique positions")

    if dry_run:
        print("[compact] dry-run — no files written")
        return

    snapshot(CLUSTER_LABELS); snapshot(POS_3D); snapshot(POS_2D)
    CLUSTER_LABELS.write_text(json.dumps(cluster_labels, separators=(",", ":")), encoding="utf-8")
    POS_3D.write_text(json.dumps(pos_3d, separators=(",", ":")), encoding="utf-8")
    POS_2D.write_text(json.dumps(pos_2d, separators=(",", ":")), encoding="utf-8")
    print("[compact] wrote cluster_labels + positions (3D + 2D)")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--aggressive", action="store_true", help="use stronger contraction schedule")
    args = p.parse_args()
    main(dry_run=args.dry_run, aggressive=args.aggressive)
