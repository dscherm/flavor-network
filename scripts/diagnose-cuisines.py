"""Show cuisine count + lift per cluster to diagnose the rare-cuisine bias."""
from __future__ import annotations
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    pro = ROOT / "public" / "proDataset"
    with (pro / "cluster_explanations.json").open("r", encoding="utf-8") as fh:
        ce = json.load(fh)
    ic = ce.get("ingredient_clusters", {})
    with (pro / "ingredients.json").open("r", encoding="utf-8") as fh:
        ing = json.load(fh)
    with (ROOT / "public" / "data" / "cuisine_map.json").open("r", encoding="utf-8") as fh:
        cm = json.load(fh)

    members: dict[int, list[str]] = defaultdict(list)
    for name, info in ic.items():
        cid = info.get("cluster_id")
        if cid is None:
            continue
        members[cid].append(name)

    global_cuisines: Counter[str] = Counter()
    for cms in cm.values():
        for c in cms or []:
            cn = c.strip()
            if cn and cn.lower() != "global":
                global_cuisines[cn] += 1
    total_gc = sum(global_cuisines.values()) or 1

    for cid, names in sorted(members.items()):
        cnt: Counter[str] = Counter()
        for n in names:
            for c in cm.get(n, []) or []:
                cn = c.strip()
                if cn and cn.lower() != "global":
                    cnt[cn] += 1
        n = len(names)
        print(f"\nCluster {cid} (n={n}):")
        rows = []
        for cuis, count in cnt.most_common(10):
            cluster_rate = count / n
            global_rate = global_cuisines.get(cuis, 1) / total_gc
            lift = cluster_rate / max(global_rate, 0.001)
            rows.append((cuis, count, lift, global_cuisines[cuis]))
        for r in sorted(rows, key=lambda x: -x[1]):
            print(f"  {r[0]:<22s}  count={r[1]:<4d} lift={r[2]:6.2f}  global={r[3]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
