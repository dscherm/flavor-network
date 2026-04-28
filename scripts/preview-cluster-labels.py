"""Preview new cluster labels and (optionally) write them to
public/proDataset/cluster_labels.json without re-running Node2Vec.

Reads cluster membership from cluster_explanations.json (which already
maps every ingredient → cluster_id via nearest-centroid), runs the new
auto_label() on each cluster's full member set, applies the existing
dedup-by-top-ingredient logic, and prints old-vs-new side by side.

Pass `--write` to overwrite cluster_labels.json (preserving centroids
and member lists, only the `label` field changes).

Usage:
    python scripts/preview-cluster-labels.py
    python scripts/preview-cluster-labels.py --write
"""
from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "flavor-gnn"))
from src.infer.cluster_labels import auto_label  # noqa: E402


def main() -> int:
    write_mode = "--write" in sys.argv

    pro = ROOT / "public" / "proDataset"

    with (pro / "cluster_labels.json").open("r", encoding="utf-8") as fh:
        cluster_data = json.load(fh)
    clusters = cluster_data.get("clusters", [])
    cluster_by_id = {cl["id"]: cl for cl in clusters}

    with (pro / "cluster_explanations.json").open("r", encoding="utf-8") as fh:
        ce = json.load(fh)
    ingredient_clusters = ce.get("ingredient_clusters", {})

    with (pro / "ingredients.json").open("r", encoding="utf-8") as fh:
        ingredients_data = json.load(fh)

    cuisine_path = ROOT / "public" / "data" / "cuisine_map.json"
    with cuisine_path.open("r", encoding="utf-8") as fh:
        cuisine_map = json.load(fh)

    members_by_cluster: dict[int, list[dict]] = defaultdict(list)
    for name, info in ingredient_clusters.items():
        cid = info.get("cluster_id")
        if cid is None:
            continue
        meta = ingredients_data.get(name)
        if not isinstance(meta, dict):
            continue
        members_by_cluster[cid].append({**meta, "name": name})

    # Compute new labels with dedup (mirrors cluster_labels.py main loop).
    label_counts: Counter[str] = Counter()
    new_labels: dict[int, str] = {}
    for cid in sorted(members_by_cluster.keys()):
        members = members_by_cluster[cid]
        label_text = auto_label(members, ingredients_data, cuisine_map=cuisine_map)
        if label_counts[label_text] >= 1:
            top = sorted(members, key=lambda x: x.get("totalCount", 0) or 0, reverse=True)
            diff = next((t["name"].split()[0] for t in top if t.get("name")), None)
            if diff:
                label_text = f"{label_text} ({diff.lower()})"
        label_counts[label_text.split(" (")[0]] += 1
        new_labels[cid] = label_text

    print(f"{'cluster':<3}  {'old label':<20s}  →  {'new label':<28s}  members(top-5)")
    print("─" * 110)
    for cid in sorted(members_by_cluster.keys()):
        old_label = cluster_by_id.get(cid, {}).get("label", "?")
        new_label = new_labels[cid]
        top5 = sorted(members_by_cluster[cid], key=lambda x: x.get("totalCount", 0) or 0, reverse=True)[:5]
        top5_names = ", ".join(t["name"] for t in top5)
        change = "✓" if new_label != old_label else " "
        print(f"  {cid:<3} {change} {old_label:<20s}  →  {new_label:<28s}  {top5_names}")

    if write_mode:
        for cl in clusters:
            cid = cl.get("id")
            if cid in new_labels:
                cl["label"] = new_labels[cid]
        out_path = pro / "cluster_labels.json"
        with out_path.open("w", encoding="utf-8") as fh:
            json.dump(cluster_data, fh, indent=2)
        print(f"\n[write] updated {out_path.relative_to(ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
