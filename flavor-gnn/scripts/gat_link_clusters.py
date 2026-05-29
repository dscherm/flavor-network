"""gat_link_clusters.py — N3-GAT-CLUSTERS orchestrator (phase D3 sink).

End-to-end pipeline:
  1. (D1) build PyG Data + stratified split
  2. (D2) train GAT link-prediction model
  3. (D3) Leiden consensus on 32d embeddings
  4. (D3 sink) recompute centroid_3d per cluster from flavor_positions_v3
  5. (D3 sink) emit cluster_labels_v3.json + quality report

Idempotent — running twice with same seed produces identical artifacts.

Inputs (read-only):
  - public/proDataset/pairings.json
  - public/proDataset/flavor_graph_data_v3.json
  - public/proDataset/ingredients.json
  - public/proDataset/flavor_positions_v3.json
  - public/proDataset/cluster_labels_v3.json   (pre-image: BACKED UP before write)

Outputs:
  - public/proDataset/cluster_labels_v3.json   (NEW partition)
  - public/proDataset/cluster_labels_v3.json.pre-N3-GAT (backup of pre-image)
  - flavor-gnn/artifacts/gat_link_v1.pt
  - flavor-gnn/artifacts/gat_link_v1_embeddings.npy
  - flavor-gnn/artifacts/gat_link_v1_report.json
  - flavor-gnn/artifacts/gat_cluster_quality_report.json
"""
from __future__ import annotations

import json
import shutil
import sys
from collections import Counter
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
PRO = REPO / "public" / "proDataset"
ART = REPO / "flavor-gnn" / "artifacts"

sys.path.insert(0, str(REPO / "flavor-gnn"))

from src.train.train_gat_link import train as train_gat
from scripts.leiden_consensus import leiden_consensus
from scripts.kmeans_auto_k import kmeans_auto_k


def _safe_label_for(cluster_id: int) -> str:
    return f"cluster-{cluster_id}"


def _recompute_centroids_3d(
    membership: list[int],
    name_to_idx: dict[str, int],
    positions_v3: dict,
) -> dict[int, list[float]]:
    """Average flavor_positions_v3 coordinates per cluster."""
    idx_to_name = {i: n for n, i in name_to_idx.items()}
    cluster_xyz = {}
    for node_idx, cid in enumerate(membership):
        name = idx_to_name.get(node_idx)
        if name is None:
            continue
        pos = positions_v3.get(name)
        if not pos:
            continue
        if isinstance(pos, list) and len(pos) >= 3:
            x, y, z = float(pos[0]), float(pos[1]), float(pos[2])
        elif isinstance(pos, dict):
            x = float(pos.get("x", 0)); y = float(pos.get("y", 0)); z = float(pos.get("z", 0))
        else:
            continue
        bucket = cluster_xyz.setdefault(cid, {"sum": [0.0, 0.0, 0.0], "n": 0})
        bucket["sum"][0] += x; bucket["sum"][1] += y; bucket["sum"][2] += z
        bucket["n"] += 1
    centroids = {}
    for cid, b in cluster_xyz.items():
        n = max(b["n"], 1)
        centroids[cid] = [round(b["sum"][0] / n, 4),
                          round(b["sum"][1] / n, 4),
                          round(b["sum"][2] / n, 4)]
    return centroids


def _tier1_purity_per_cluster(
    membership: list[int],
    name_to_idx: dict[str, int],
    fg_v3: dict,
) -> dict[int, dict]:
    """Per-cluster: dominant tier1 + fraction of members sharing it."""
    idx_to_name = {i: n for n, i in name_to_idx.items()}
    tier1_by_name = {}
    for n in fg_v3.get("nodes", []):
        if n.get("tier1"):
            tier1_by_name[n["name"]] = n["tier1"]
    by_cluster = {}
    for node_idx, cid in enumerate(membership):
        name = idx_to_name.get(node_idx)
        if name is None:
            continue
        for a in (tier1_by_name.get(name) or []):
            d = by_cluster.setdefault(cid, Counter())
            d[a] += 1
    out = {}
    for cid in set(membership):
        c = by_cluster.get(cid, Counter())
        size = sum(1 for x in membership if x == cid)
        if not c:
            out[cid] = {"dominant": None, "purity": 0.0, "size": size}
            continue
        dom, dom_n = c.most_common(1)[0]
        out[cid] = {"dominant": dom, "purity": round(dom_n / max(size, 1), 3), "size": size}
    return out


def main(seed: int = 42, train_full: bool = True, cluster_algo: str = "leiden",
         force_k: int | None = None):
    print("=" * 60)
    print("N3-GAT-CLUSTERS end-to-end pipeline")
    print("=" * 60)

    variant = "v5"

    if train_full:
        print(f"\n[step 1] D2 — train GAT link-prediction model (variant={variant})")
        train_report = train_gat(seed=seed, variant=variant)
    else:
        train_report = json.loads(
            (ART / f"gat_link_{variant}_report.json").read_text(encoding="utf-8")
        )

    print(f"\n[step 2] D3 — load embeddings + run {cluster_algo}")
    embeddings = np.load(ART / f"gat_link_{variant}_embeddings.npy")
    ckpt = __import__("torch").load(
        ART / f"gat_link_{variant}.pt", weights_only=False
    )
    name_to_idx = ckpt["name_to_idx"]
    print(f"  embeddings {embeddings.shape}, name_to_idx {len(name_to_idx)} entries")

    if cluster_algo == "kmeans":
        membership, info = kmeans_auto_k(embeddings, k_min=4, k_max=20, seed=seed,
                                         force_k=force_k)
        sizes = sorted(Counter(membership).values(), reverse=True)
        print(f"  k={info['k']}  silhouette={info['silhouette']:.4f}  "
              f"stability_min={info['stability_min']:.3f}  stability_mean={info['stability_mean']:.3f}")
        print(f"  silhouette curve top 5: " + ", ".join(
            f"k={k}:{s:.3f}" for k, s in sorted(info['silhouette_curve'], key=lambda kv: -kv[1])[:5]
        ))
        info["gate_passed"] = info["stability_min"] >= 0.85
        info["jaccard_min"] = info["stability_min"]
        info["jaccard_mean"] = info["stability_mean"]
        info.setdefault("seeds_run", 5)
    else:
        membership, info = leiden_consensus(
            embeddings, k_neighbors=15, n_seeds=10,
            resolution=1.0, jaccard_gate=0.85, raise_on_gate=False,
        )
        sizes = sorted(Counter(membership).values(), reverse=True)
        print(f"  k={info['k']}  jaccard_min={info['jaccard_min']:.3f}  "
              f"jaccard_mean={info['jaccard_mean']:.3f}  gate_passed={info['gate_passed']}")
    print(f"  sizes: {sizes}")

    print(f"\n[step 3] recompute centroid_3d from flavor_positions_v3")
    positions_v3 = json.loads(
        (PRO / "flavor_positions_v3.json").read_text(encoding="utf-8")
    )
    centroids = _recompute_centroids_3d(membership, name_to_idx, positions_v3)
    print(f"  centroids computed for {len(centroids)} clusters")

    print(f"\n[step 4] compute tier1 purity per cluster (informational)")
    fg_v3 = json.loads(
        (PRO / "flavor_graph_data_v3.json").read_text(encoding="utf-8")
    )
    purity = _tier1_purity_per_cluster(membership, name_to_idx, fg_v3)
    for cid in sorted(purity):
        d = purity[cid]
        print(f"    cluster {cid:2d}  size={d['size']:4d}  "
              f"dominant_tier1={d['dominant']:<10s}  purity={d['purity']}")

    print(f"\n[step 5] emit cluster_labels_v3.json")
    out = {
        "k": info["k"],
        "clusters": [
            {
                "id": cid,
                "label": _safe_label_for(cid),
                "size": purity[cid]["size"],
                "centroid_3d": centroids.get(cid, [0.0, 0.0, 0.0]),
                "dominant_tier1": purity[cid]["dominant"],
            }
            for cid in sorted(set(membership))
        ],
        "ingredients": {
            list(name_to_idx.keys())[i]: int(cid)
            for i, cid in enumerate(membership)
        },
        "_meta": {
            "generated_by": "flavor-gnn/scripts/gat_link_clusters.py (N3-GAT-CLUSTERS, 2026-05-28)",
            "source_files": ["pairings.json", "flavor_graph_data_v3.json", "ingredients.json"],
            "stability_jaccard_min": info["jaccard_min"],
            "stability_jaccard_mean": info["jaccard_mean"],
            "stability_gate_passed": info["gate_passed"],
            "cluster_algo": cluster_algo,
            "model_artifact": f"flavor-gnn/artifacts/gat_link_{variant}.pt",
            "model_variant": variant,
            "val_auc": train_report["val"]["auc"],
            "test_auc": train_report["test"]["auc"],
            "val_hits_at_10": train_report["val"]["hits_at_10"],
            "test_hits_at_10": train_report["test"]["hits_at_10"],
        },
    }
    target = PRO / "cluster_labels_v3.json"
    backup = PRO / "cluster_labels_v3.json.pre-N3-GAT"
    if target.exists() and not backup.exists():
        shutil.copy2(target, backup)
        print(f"  backed up pre-image -> {backup.name}")
    target.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"  wrote {target}")

    quality = {
        "model": {
            "val_auc": train_report["val"]["auc"],
            "test_auc": train_report["test"]["auc"],
            "val_hits_at_10": train_report["val"]["hits_at_10"],
            "test_hits_at_10": train_report["test"]["hits_at_10"],
            "epochs_trained": train_report["epochs_trained"],
        },
        "stability": {
            "jaccard_min": info["jaccard_min"],
            "jaccard_mean": info["jaccard_mean"],
            "gate_passed": info["gate_passed"],
            "seeds_run": info["seeds_run"],
        },
        "partition": {
            "k": info["k"],
            "sizes": sizes,
            "min_size": min(sizes),
            "max_size": max(sizes),
            "median_size": int(np.median(sizes)),
        },
        "tier1_purity": {str(cid): purity[cid] for cid in purity},
    }
    qr = ART / "gat_cluster_quality_report.json"
    qr.write_text(json.dumps(quality, indent=2, default=str), encoding="utf-8")
    print(f"  wrote {qr}")
    print("\n[done]")


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--no-train", action="store_true",
                   help="Skip training; use existing artifacts/gat_link_v{N}.pt")
    p.add_argument("--cluster-algo", choices=["leiden", "kmeans"], default="leiden")
    p.add_argument("--force-k", type=int, default=None,
                   help="Override silhouette auto-k (KMeans only)")
    args = p.parse_args()
    main(seed=args.seed, train_full=not args.no_train,
         cluster_algo=args.cluster_algo, force_k=args.force_k)
