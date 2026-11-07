#!/usr/bin/env python3
"""Build a variant -> ProData ingredient synonym map from FoodOn.

Source: FoodOn (https://foodon.org), foodon-synonyms.tsv, CC BY 4.0.
Download it to proDataset/raw/foodon/foodon-synonyms.tsv (git-ignored):
  curl -sL -o proDataset/raw/foodon/foodon-synonyms.tsv \
    https://raw.githubusercontent.com/FoodOntology/foodon/master/foodon-synonyms.tsv

Each FoodOn class carries a label plus synonyms. Two names are treated as
the same food only when they sit in the SAME class as a label, alternative
label, exact synonym or plain synonym (narrow/broad synonyms are skipped:
"green onion" is a narrow synonym of onion, not the same thing).

A variant is mapped only when it is not already a ProData ingredient and
every class it appears in points to ONE ProData ingredient — ambiguous
variants are dropped, because a wrong match is worse than none.

Usage:
  python -I scripts/build_foodon_synonyms.py            # write the map
  python -I scripts/build_foodon_synonyms.py --measure  # Flavor Bible name-match before/after
Writes proDataset/raw/foodon/foodon_synonyms.json (git-ignored, not shipped).

Finding (2026-11-07): 2,095 mappings, ~85-90% correct on a 60-item spot check,
but mostly Latin species names that never appear in recipe text, plus some
culinary errors (ninjin -> ginseng; ninjin is carrot; bell pepper -> paprika).
Flavor Bible name match only 45% -> 46%; the real gap is plurals, "x, y"
inversions, "x and y" entries, mojibake and non-ingredient rows. Not used.
"""
from __future__ import annotations

import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TSV = ROOT / "proDataset/raw/foodon/foodon-synonyms.tsv"
OUT = ROOT / "proDataset/raw/foodon/foodon_synonyms.json"  # not shipped: see the finding in the docstring
KEEP = {'"label"', '"label (alternative)"', '"synonym (exact)"', '"synonym"'}


def clean(text: str) -> str:
    t = text.strip()
    m = re.match(r'^"(.*)"(@\w+)?$', t)
    if m:
        if m.group(2) and m.group(2) != "@en":
            return ""
        t = m.group(1)
    t = t.lower()
    t = re.sub(r"\s*\((?:raw|whole|food source|plant|fresh|dried|ground)\)\s*", " ", t)
    t = re.sub(r"[^a-z0-9' -]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def singular(w: str) -> str:
    if w.endswith("ies") and len(w) > 4:
        return w[:-3] + "y"
    if w.endswith("oes") and len(w) > 4:
        return w[:-2]
    if w.endswith("s") and not w.endswith("ss") and len(w) > 3:
        return w[:-1]
    return w


def sing_phrase(n: str) -> str:
    parts = n.split(" ")
    return " ".join(parts[:-1] + [singular(parts[-1])]) if parts else n


def load_classes() -> dict[str, set[str]]:
    classes: dict[str, set[str]] = defaultdict(set)
    with TSV.open(encoding="utf-8") as fh:
        for row in csv.reader(fh, delimiter="\t", quoting=csv.QUOTE_NONE):
            if len(row) < 4 or row[2] not in KEEP:
                continue
            name = clean(row[3])
            if name and len(name) >= 3:
                classes[row[0]].add(name)
    return classes


def build(ingredients: set[str]) -> dict[str, str]:
    ing_sing = {sing_phrase(i): i for i in ingredients}

    def to_ing(name: str) -> str | None:
        if name in ingredients:
            return name
        return ing_sing.get(sing_phrase(name))

    targets: dict[str, set[str]] = defaultdict(set)
    for names in load_classes().values():
        hits = {to_ing(n) for n in names} - {None}
        if len(hits) != 1:
            continue  # class maps to no ingredient, or to several — skip
        (target,) = hits
        for n in names:
            if to_ing(n) is None:
                targets[n].add(target)
    return {v: next(iter(t)) for v, t in sorted(targets.items()) if len(t) == 1}


def measure(ingredients: set[str], foodon: dict[str, str]) -> None:
    """Flavor Bible name-match rate with the existing cascade, then with FoodOn added."""
    fb = ROOT / "data/flavor_bible_full.csv"
    syn = {k: v for k, v in json.loads((ROOT / "proDataset/data/synonyms.json").read_text(encoding="utf-8")).items() if not k.startswith("_")}
    names, pairs = set(), []
    with fb.open(encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            a, b = (r.get("main") or "").strip().lower(), (r.get("pairing") or "").strip().lower()
            if a and b:
                names.update((a, b)); pairs.append((a, b))
    ing_sing = {sing_phrase(i): i for i in ingredients}

    def base(n: str) -> str | None:
        n = re.sub(r"\s*[:(,].*$", "", n).strip()
        if n in ingredients: return n
        if n in syn and syn[n] in ingredients: return syn[n]
        return ing_sing.get(sing_phrase(n))

    def with_foodon(n: str) -> str | None:
        hit = base(n)
        if hit: return hit
        c = clean(re.sub(r"\s*[:(,].*$", "", n))
        return foodon.get(c) or foodon.get(sing_phrase(c))

    for label, fn in (("existing cascade", base), ("+ FoodOn", with_foodon)):
        m = {n: fn(n) for n in names}
        hit = sum(1 for v in m.values() if v)
        mp = {tuple(sorted((m[a], m[b]))) for a, b in pairs if m.get(a) and m.get(b) and m[a] != m[b]}
        print(f"  {label:18s} names matched {hit}/{len(names)} ({100 * hit / len(names):.0f}%)   unique pairs {len(mp)}")
    gained = sorted(n for n in names if not base(n) and with_foodon(n))
    print(f"  gained by FoodOn ({len(gained)}), sample: " + "; ".join(f"{n} -> {with_foodon(n)}" for n in gained[:25]))


def main() -> int:
    ingredients = set(json.loads((ROOT / "public/proDataset/ingredients.json").read_text(encoding="utf-8")))
    foodon = build(ingredients)
    OUT.write_text(json.dumps({
        "_source": "FoodOn (https://foodon.org) foodon-synonyms.tsv, CC BY 4.0 — Dooley et al., npj Science of Food 2018. Built by scripts/build_foodon_synonyms.py.",
        "map": foodon,
    }, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"wrote {len(foodon)} variant -> ingredient mappings to {OUT.relative_to(ROOT)}")
    if "--measure" in sys.argv:
        measure(ingredients, foodon)
    return 0


if __name__ == "__main__":
    sys.exit(main())
