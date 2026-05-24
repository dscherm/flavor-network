"""apply_removal_review.py — apply chef removal marks from the unassigned review doc.

Reads `flavor-gnn/curation/unassigned_ingredients_review.md`, finds every
row whose Action column starts with `r` (any case), and removes those
names from `public/proDataset/ingredients.json` AND drops any edge
referencing them from `public/proDataset/pairings.json`.

Both files are rewritten in place; a `.pre-removal.bak` snapshot of
each is written next to the original so you can diff or revert.

Usage:
    python flavor-gnn/scripts/apply_removal_review.py [--dry-run]

`--dry-run` prints the summary without touching any file.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REVIEW_DOC = ROOT / "flavor-gnn" / "curation" / "unassigned_ingredients_review.md"
INGREDIENTS = ROOT / "public" / "proDataset" / "ingredients.json"
PAIRINGS = ROOT / "public" / "proDataset" / "pairings.json"

ROW_RE = re.compile(r"^\|\s*([^|]*?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$")


def parse_removals() -> set[str]:
    """Read the review doc; return names whose Action column starts with 'r'."""
    if not REVIEW_DOC.exists():
        raise FileNotFoundError(f"review doc not found: {REVIEW_DOC}")
    text = REVIEW_DOC.read_text(encoding="utf-8")
    removals: set[str] = set()
    for line in text.splitlines():
        m = ROW_RE.match(line)
        if not m:
            continue
        action, name = m.group(1).strip(), m.group(2).strip()
        if action.lower().startswith("r") and name and name not in ("Name", "------"):
            # Unescape pipes the writer doubled.
            removals.add(name.replace("\\|", "|"))
    return removals


def apply(dry_run: bool) -> None:
    removals = parse_removals()
    if not removals:
        print("[remove] no rows marked with 'r' — nothing to do")
        return

    # ── Snapshot + load ───────────────────────────────────────────
    ingredients = json.loads(INGREDIENTS.read_text(encoding="utf-8"))
    pairings = json.loads(PAIRINGS.read_text(encoding="utf-8"))

    print(f"[remove] {len(removals)} names marked for removal")
    sample = sorted(removals)[:10]
    print(f"[remove] sample: {sample}")

    # ── Filter ingredients ────────────────────────────────────────
    before_ing = sum(1 for k in ingredients if not k.startswith("_"))
    new_ing = {k: v for k, v in ingredients.items() if k.startswith("_") or k not in removals}
    after_ing = sum(1 for k in new_ing if not k.startswith("_"))
    dropped_ing = before_ing - after_ing
    print(f"[remove] ingredients.json: {before_ing} → {after_ing} ({dropped_ing} dropped)")

    # ── Filter pairings ───────────────────────────────────────────
    before_pairs = 0
    after_pairs = 0
    if isinstance(pairings, list):
        before_pairs = len(pairings)
        new_pairs = [
            p for p in pairings
            if (p.get("source") or p.get("ingredientA") or p.get("a")) not in removals
            and (p.get("target") or p.get("ingredientB") or p.get("b")) not in removals
        ]
        after_pairs = len(new_pairs)
    elif isinstance(pairings, dict):
        # Some shapes: {"edges": [...]} or {name: {neighbor: strength}}
        if "edges" in pairings and isinstance(pairings["edges"], list):
            before_pairs = len(pairings["edges"])
            pairings["edges"] = [
                p for p in pairings["edges"]
                if (p.get("source") or p.get("ingredientA")) not in removals
                and (p.get("target") or p.get("ingredientB")) not in removals
            ]
            after_pairs = len(pairings["edges"])
            new_pairs = pairings
        else:
            before_pairs = sum(len(v) for v in pairings.values() if isinstance(v, dict))
            new_pairs = {}
            for src, neighbors in pairings.items():
                if src in removals:
                    continue
                if isinstance(neighbors, dict):
                    new_pairs[src] = {k: v for k, v in neighbors.items() if k not in removals}
                else:
                    new_pairs[src] = neighbors
            after_pairs = sum(len(v) for v in new_pairs.values() if isinstance(v, dict))
    else:
        print("[remove] pairings.json has unrecognized shape; skipping pairings filter")
        new_pairs = pairings
    dropped_pairs = before_pairs - after_pairs
    print(f"[remove] pairings.json: {before_pairs} → {after_pairs} ({dropped_pairs} dropped)")

    if dry_run:
        print("[remove] dry-run — no files written")
        return

    # ── Snapshot + write ──────────────────────────────────────────
    bak_ing = INGREDIENTS.with_suffix(INGREDIENTS.suffix + ".pre-removal.bak")
    bak_pair = PAIRINGS.with_suffix(PAIRINGS.suffix + ".pre-removal.bak")
    shutil.copy2(INGREDIENTS, bak_ing)
    shutil.copy2(PAIRINGS, bak_pair)
    print(f"[remove] backed up to {bak_ing.name} and {bak_pair.name}")

    INGREDIENTS.write_text(json.dumps(new_ing, indent=2), encoding="utf-8")
    PAIRINGS.write_text(json.dumps(new_pairs), encoding="utf-8")
    print(f"[remove] wrote {INGREDIENTS.relative_to(ROOT)}")
    print(f"[remove] wrote {PAIRINGS.relative_to(ROOT)}")
    print(
        "[remove] re-run derive_long_tail.py + train_gnn.py + flavor_layout_v3.py "
        "to rebuild the V3 corpus without the removed names."
    )


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--dry-run", action="store_true", help="Print summary without writing")
    args = p.parse_args()
    apply(dry_run=args.dry_run)
