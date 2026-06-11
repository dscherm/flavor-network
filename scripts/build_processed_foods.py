#!/usr/bin/env python3
"""Strand 2 (APPLIED) — build the curated compound/recipe-food manifest.

Chef-approved 2026-06-10. Refines audit_processed_foods.py: the bare
`category:seasoning` trigger over-flagged single-source seasonings (salt
variants, white pepper), so seasoning-category items are kept ONLY when the
name also matches a blend keyword (grill seasoning, jerk seasoning, ...). The
salts and single spices stay classified as natural ingredients.

Output: public/proDataset/processed_foods.json — the list of recipe/blend
(compound) foods, to route to the compoundFoods.js mixture path and exclude
from molecular-aggregation calibration/benchmarks. Non-destructive: ingredients.json
is not modified.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INGREDIENTS = ROOT / "public" / "proDataset" / "ingredients.json"
COMPOUND_FOODS_JS = ROOT / "src" / "data" / "compoundFoods.js"
OUT = ROOT / "public" / "proDataset" / "processed_foods.json"

RECIPE_KEYWORDS = [
    "sauce", "dressing", "paste", "marinade", "ketchup", "catsup", "mustard",
    "mayonnaise", "mayo", "relish", "chutney", "salsa", "dip", "spread",
    "gravy", "glaze", "vinaigrette", "aioli", "pesto", "tapenade", "hummus",
    "gochujang", "hoisin", "teriyaki", "worcestershire", "masala", "harissa",
    "seasoning", "rub", "marinara", "bolognese", "alfredo", "curry",
    "five-spice", "five spice", "garam", "jerk", "cajun", "ras el hanout",
    "bouillon", "broth", "stock", "consomme", "blend", "mix",
]
GUARDED = {"mix", "blend", "curry", "rub", "dip", "stock", "broth"}
# blend words that legitimize a category:seasoning item as a true blend
BLEND_WORDS = ["seasoning", "blend", "mix", "masala", "rub", "jerk", "cajun",
               "five spice", "five-spice", "garam", "spice"]


def _kw_hit(low: str) -> str | None:
    for kw in RECIPE_KEYWORDS:
        if re.search(r"\b" + re.escape(kw) + r"\b", low):
            if kw in GUARDED and not (low.endswith(kw) or f"{kw} " in low or f" {kw}" in low):
                continue
            return kw
    return None


def main() -> int:
    ing = json.loads(INGREDIENTS.read_text(encoding="utf-8"))
    src = COMPOUND_FOODS_JS.read_text(encoding="utf-8") if COMPOUND_FOODS_JS.exists() else ""
    seed = {m.lower() for m in re.findall(r"^\s*'([^']+)':\s*\{", src, re.M)}
    names = [k for k in ing if not k.startswith("_")]

    processed: dict[str, dict] = {}
    excluded_seasoning: list[str] = []
    for name in names:
        low = name.lower()
        cat = ing[name].get("category") if isinstance(ing[name], dict) else None
        kw = _kw_hit(low)
        if low in seed:
            trig = "seed"
        elif cat == "condiment":
            trig = "category:condiment"
        elif kw:
            trig = f"keyword:{kw}"
        elif cat == "seasoning" and any(b in low for b in BLEND_WORDS):
            trig = "seasoning-blend"
        elif cat == "seasoning":
            excluded_seasoning.append(name)   # single spice / salt — keep natural
            continue
        else:
            continue
        processed[name] = {"category": cat, "trigger": trig}

    by_trig: dict[str, int] = {}
    for v in processed.values():
        by_trig[v["trigger"].split(":")[0]] = by_trig.get(v["trigger"].split(":")[0], 0) + 1

    OUT.write_text(json.dumps({
        "note": "Chef-approved compound/recipe-food manifest (2026-06-10). Route these to the compoundFoods.js mixture path; exclude from molecular-aggregation calibration. Single-source seasonings (salt, single spices) deliberately NOT included.",
        "total_ingredients": len(names),
        "processed_count": len(processed),
        "by_trigger": by_trig,
        "excluded_single_seasonings": sorted(excluded_seasoning),
        "processed_foods": processed,
    }, indent=2), encoding="utf-8")

    print(f"ingredients          : {len(names)}")
    print(f"processed (recipe)   : {len(processed)}  ({100*len(processed)/len(names):.1f}%)")
    print(f"by trigger           : {by_trig}")
    print(f"excluded single seasonings (kept natural): {len(excluded_seasoning)}")
    print(f"  e.g. {sorted(excluded_seasoning)[:12]}")
    print(f"wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
