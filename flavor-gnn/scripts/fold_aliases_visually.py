"""fold_aliases_visually.py — make aliased ingredients render in-cluster.

The V3 alias map (`v3_alias_map.json.auto_high_confidence`) tells the
build pipeline to fold pairings from each `<alias>` into its `<canonical>`
during `derive_long_tail.py`. But at *runtime* the alias map isn't
consumed — useProData reads `cluster_labels_v3.json.ingredients` to color
nodes and `flavor_positions_v3.json` for positions. Aliased names are in
neither, so they render with the gray fallback color at a default position.

This script folds the alias map into the runtime artifacts: for every
`<alias> → <canonical>` mapping, copy the canonical's cluster_id into
`cluster_labels_v3.ingredients[alias]` and the canonical's 3D/2D
position into `flavor_positions_v3.json[alias]` and the 2D file.

Semantically: the alias renders on top of its canonical with the same
color — exactly what "alias" means.

Snapshots: each output file is backed up to `<name>.pre-aliasfold.bak`
once per run. Re-running is idempotent (skips already-folded entries).

Usage:
    python flavor-gnn/scripts/fold_aliases_visually.py [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

ALIAS_MAP = ROOT / "flavor-gnn" / "curation" / "v3_alias_map.json"
CLUSTER_LABELS = ROOT / "public" / "proDataset" / "cluster_labels_v3.json"
POS_3D = ROOT / "public" / "proDataset" / "flavor_positions_v3.json"
POS_2D = ROOT / "public" / "proDataset" / "flavor_positions_2d_v3.json"
INGREDIENTS = ROOT / "public" / "proDataset" / "ingredients.json"


def snapshot(path: Path) -> Path:
    bak = path.with_suffix(path.suffix + ".pre-aliasfold.bak")
    if not bak.exists():
        shutil.copy2(path, bak)
    return bak


def main(dry_run: bool) -> None:
    alias_map = json.loads(ALIAS_MAP.read_text(encoding="utf-8"))
    cluster_labels = json.loads(CLUSTER_LABELS.read_text(encoding="utf-8"))
    pos_3d = json.loads(POS_3D.read_text(encoding="utf-8"))
    pos_2d = json.loads(POS_2D.read_text(encoding="utf-8"))
    ingredients = json.loads(INGREDIENTS.read_text(encoding="utf-8"))

    auto_hc = alias_map.get("auto_high_confidence", {})
    print(f"[fold] alias map has {len(auto_hc)} entries")

    cluster_ing = cluster_labels["ingredients"]
    ing_names = {k for k in ingredients if not k.startswith("_")}

    folded = []
    skipped_canonical_missing = []
    skipped_alias_not_rendered = []
    skipped_already_folded = []
    for alias, canonical in auto_hc.items():
        if alias not in ing_names:
            # Alias isn't even in ingredients.json, so it never renders;
            # nothing to fold for it.
            skipped_alias_not_rendered.append(alias)
            continue
        if alias in cluster_ing:
            # Already has its own cluster slot (e.g. survived a
            # classify pass) — leave alone.
            skipped_already_folded.append(alias)
            continue
        if canonical not in cluster_ing:
            skipped_canonical_missing.append((alias, canonical))
            continue
        cid = cluster_ing[canonical]
        canon_3d = pos_3d.get(canonical)
        canon_2d = pos_2d.get(canonical)
        if canon_3d is None or canon_2d is None:
            skipped_canonical_missing.append((alias, canonical))
            continue
        cluster_ing[alias] = cid
        pos_3d[alias] = list(canon_3d)
        pos_2d[alias] = list(canon_2d)
        folded.append((alias, canonical, cid))

    print(f"[fold] folded {len(folded)} aliases into v3 visual layer")
    print(f"[fold] skipped {len(skipped_alias_not_rendered)} (alias not in ingredients.json)")
    print(f"[fold] skipped {len(skipped_already_folded)} (alias already has its own cluster)")
    print(f"[fold] skipped {len(skipped_canonical_missing)} (canonical missing from v3)")
    if skipped_canonical_missing[:5]:
        print("  examples:")
        for a, c in skipped_canonical_missing[:5]:
            print(f"    {a!r} → {c!r}  (canonical not in cluster_labels)")

    # bump cluster sizes
    for c in cluster_labels["clusters"]:
        c["size"] = sum(1 for v in cluster_ing.values() if v == c["id"])

    if dry_run:
        print("\n[dry-run] no files written")
        return

    snapshot(CLUSTER_LABELS)
    CLUSTER_LABELS.write_text(json.dumps(cluster_labels, separators=(",", ":")), encoding="utf-8")
    print(f"[write] {CLUSTER_LABELS.relative_to(ROOT)} (+{len(folded)} alias entries)")

    snapshot(POS_3D)
    POS_3D.write_text(json.dumps(pos_3d, separators=(",", ":")), encoding="utf-8")
    print(f"[write] {POS_3D.relative_to(ROOT)} (+{len(folded)} alias positions)")

    snapshot(POS_2D)
    POS_2D.write_text(json.dumps(pos_2d, separators=(",", ":")), encoding="utf-8")
    print(f"[write] {POS_2D.relative_to(ROOT)} (+{len(folded)} alias positions)")

    print("\n[fold] done")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = p.parse_args()
    main(dry_run=args.dry_run)
