#!/usr/bin/env python3
"""Strand 2 — flag compound/recipe foods vs single-source ingredients.

Goal (per chef request 2026-06-10): separate RECIPE/BLEND foods (mayonnaise,
italian dressing, curry powder — combinations of multiple distinct ingredients)
from single-source ingredients (basil, beef, even butter/cheese/wine which come
from one base). Recipe foods are where the molecular GNN aggregation is
meaningless — their aroma is an emergent mixture property (the non-linear
mixture finding), so they should route to the compoundFoods.js mixture path and
be excluded from molecular-aggregation calibration/benchmarks.

This is a FIRST-PASS heuristic audit for chef review, not a final tagging. It
writes public/proDataset/processed_foods_audit.json with each flagged
ingredient + the trigger, and prints a summary. Nothing is mutated.

Signals (in priority order):
  1. seed     — already in compoundFoods.js COMPOUND_FOODS (definitely recipe)
  2. category — 'condiment' / 'seasoning' (strong recipe prior)
  3. keyword  — name contains a recipe/blend word (sauce, dressing, masala, ...)

Single-source processed items (butter, cheese, wine, yogurt) are deliberately
NOT flagged — they have one base and a stable-ish profile.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INGREDIENTS = ROOT / "public" / "proDataset" / "ingredients.json"
COMPOUND_FOODS_JS = ROOT / "src" / "data" / "compoundFoods.js"
OUT = ROOT / "public" / "proDataset" / "processed_foods_audit.json"

# Recipe/blend words. Word-boundary matched against the ingredient name.
# Tuned to catch multi-ingredient preparations, NOT single-source processed
# items (no 'butter', 'cheese', 'wine', 'oil', 'flour' here).
RECIPE_KEYWORDS = [
    "sauce", "dressing", "paste", "marinade", "ketchup", "catsup", "mustard",
    "mayonnaise", "mayo", "relish", "chutney", "salsa", "dip", "spread",
    "gravy", "glaze", "vinaigrette", "aioli", "pesto", "tapenade", "hummus",
    "gochujang", "hoisin", "teriyaki", "worcestershire", "masala", "harissa",
    "seasoning", "rub", "marinara", "bolognese", "alfredo", "curry",
    "five-spice", "five spice", "garam", "jerk", "cajun", "ras el hanout",
    "bouillon", "broth", "stock", "consomme", "blend", "mix",
]
# 'mix'/'blend'/'curry' need a guard so we don't catch e.g. 'mixed berries'.
GUARDED = {"mix", "blend", "curry", "rub", "dip", "stock", "broth"}

STRONG_CATEGORIES = {"condiment", "seasoning"}


def load_seed() -> set[str]:
    if not COMPOUND_FOODS_JS.exists():
        return set()
    src = COMPOUND_FOODS_JS.read_text(encoding="utf-8")
    return {m.lower() for m in re.findall(r"^\s*'([^']+)':\s*\{", src, re.M)}


def main() -> int:
    ing = json.loads(INGREDIENTS.read_text(encoding="utf-8"))
    seed = load_seed()
    names = [k for k in ing if not k.startswith("_")]

    flagged: dict[str, dict] = {}
    for name in names:
        low = name.lower()
        cat = ing[name].get("category") if isinstance(ing[name], dict) else None
        trigger = None
        if low in seed:
            trigger = "seed:compoundFoods.js"
        elif cat in STRONG_CATEGORIES:
            trigger = f"category:{cat}"
        else:
            for kw in RECIPE_KEYWORDS:
                if re.search(r"\b" + re.escape(kw) + r"\b", low):
                    # guarded words must look like a preparation, not an adjective
                    if kw in GUARDED and not (low.endswith(kw) or f"{kw} " in low or f" {kw}" in low):
                        continue
                    trigger = f"keyword:{kw}"
                    break
        if trigger:
            flagged[name] = {"category": cat, "trigger": trigger}

    by_trigger: dict[str, int] = {}
    for v in flagged.values():
        key = v["trigger"].split(":")[0]
        by_trigger[key] = by_trigger.get(key, 0) + 1

    OUT.write_text(json.dumps({
        "note": "First-pass heuristic audit of recipe/blend (compound) foods for chef review. Not yet applied.",
        "total_ingredients": len(names),
        "flagged_count": len(flagged),
        "by_trigger": by_trigger,
        "flagged": flagged,
    }, indent=2), encoding="utf-8")

    print(f"ingredients scanned : {len(names)}")
    print(f"flagged as recipe   : {len(flagged)}  ({100*len(flagged)/len(names):.1f}%)")
    print(f"by trigger          : {by_trigger}")
    print(f"seed already known  : {len(seed)}")
    print(f"NEW beyond seed     : {len(flagged) - sum(1 for v in flagged.values() if v['trigger'].startswith('seed'))}")
    print(f"wrote {OUT.relative_to(ROOT)}")
    print()
    print("sample NEW flags (not in compoundFoods.js):")
    shown = 0
    for n, v in flagged.items():
        if not v["trigger"].startswith("seed"):
            print(f"  {n:40s} [{v['category']}] {v['trigger']}")
            shown += 1
            if shown >= 25:
                break
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
