#!/usr/bin/env python3
"""Aroma profiles per Wine Lab style, aggregated from 129,971 wine reviews.

Source: "Wine Reviews" by zynicide on Kaggle (winemag-data-130k-v2.csv),
licence CC BY-NC-SA 4.0 — https://www.kaggle.com/datasets/zynicide/wine-reviews
Download (git-ignored):
  kaggle datasets download zynicide/wine-reviews -f winemag-data-130k-v2.csv -p proDataset/raw/kaggle-wine

What ships: ONLY aggregate statistics — for each wine style, the share of its
reviews that mention each aroma family / descriptor, and the review count.
No review text, taster or winery is copied. Because the source licence is
share-alike, the output file is itself licensed CC BY-NC-SA 4.0 (stated in
its _meta) and must stay non-commercial.

Usage:
  python -I scripts/build_wine_review_aromas.py            # writes public/data/wine_review_aromas.json
  python -I scripts/build_wine_review_aromas.py --compare  # agreement with the hand-written aromas
"""
from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "proDataset/raw/kaggle-wine/winemag-data-130k-v2.csv"
STYLES = ROOT / "public/data/wine_styles.json"
OUT = ROOT / "public/data/wine_review_aromas.json"
MIN_REVIEWS = 15

# Aroma family -> descriptor terms (whole-word, case-insensitive). Families
# line up with the wine card's aroma families; terms are common review words.
LEXICON = {
    "red fruit": ["cherry", "cherries", "raspberry", "raspberries", "strawberry", "strawberries", "red berry", "red berries", "cranberry", "red currant", "red fruit", "pomegranate"],
    "black fruit": ["blackberry", "blackberries", "black cherry", "cassis", "black currant", "blackcurrant", "plum", "plums", "blueberry", "blueberries", "black fruit", "boysenberry", "dark fruit"],
    "citrus": ["lemon", "lime", "grapefruit", "citrus", "orange peel", "orange zest", "tangerine", "lemon zest"],
    "orchard fruit": ["apple", "apples", "green apple", "pear", "pears", "quince"],
    "stone fruit": ["peach", "peaches", "apricot", "apricots", "nectarine", "stone fruit"],
    "tropical fruit": ["pineapple", "mango", "passion fruit", "passionfruit", "lychee", "guava", "papaya", "tropical"],
    "melon": ["melon", "cantaloupe", "honeydew"],
    "floral": ["floral", "flower", "flowers", "violet", "violets", "rose", "roses", "blossom", "blossoms", "honeysuckle", "jasmine", "lavender"],
    "herbal": ["herb", "herbs", "herbal", "grass", "grassy", "sage", "thyme", "mint", "eucalyptus", "green pepper", "bell pepper", "fennel", "dill", "tomato leaf"],
    "earthy": ["earth", "earthy", "forest floor", "mushroom", "truffle", "leather", "tobacco", "underbrush", "dust", "dusty", "tar", "game", "gamy"],
    "spice": ["spice", "spicy", "clove", "cinnamon", "baking spice", "licorice", "anise", "nutmeg", "ginger"],
    "pepper": ["pepper", "peppery", "black pepper", "white pepper"],
    "oak & toast": ["oak", "oaky", "vanilla", "toast", "toasty", "toasted", "smoke", "smoky", "cedar", "char", "charred"],
    "chocolate & coffee": ["chocolate", "cocoa", "coffee", "espresso", "mocha"],
    "nutty": ["almond", "almonds", "hazelnut", "hazelnuts", "nutty", "walnut", "nut"],
    "honey & caramel": ["honey", "honeyed", "caramel", "toffee", "butterscotch", "marmalade", "raisin", "raisins", "fig", "figs", "dried fruit", "date"],
    "mineral & saline": ["mineral", "minerality", "flint", "flinty", "slate", "chalk", "chalky", "saline", "salty", "wet stone", "stony", "briny", "sea"],
    "butter & bread": ["butter", "buttery", "cream", "creamy", "brioche", "yeast", "yeasty", "bread", "biscuit", "toasted bread"],
}
TERM_RX = {fam: re.compile(r"\b(" + "|".join(re.escape(t) for t in sorted(terms, key=len, reverse=True)) + r")\b", re.I)
           for fam, terms in LEXICON.items()}

# Wine Lab style id -> review selector. Every condition must hold.
# v = variety (exact, any of), c = country, p = province, r = region_1 (substring), t = title (substring), not_t = title must NOT contain
SELECT = {
    "champagne": {"v": ["Champagne Blend"], "c": ["France"]},
    "prosecco": {"v": ["Glera", "Prosecco"]},
    "cava": {"v": ["Sparkling Blend", "Cava"], "c": ["Spain"]},
    "sparkling-rose": {"v": ["Champagne Blend", "Sparkling Blend"], "t": ["Rosé", "Rose "]},
    "lambrusco": {"v": ["Lambrusco"]},
    "sancerre": {"v": ["Sauvignon Blanc"], "c": ["France"], "r": ["Sancerre", "Pouilly-Fumé", "Menetou", "Quincy", "Reuilly", "Touraine"]},
    "nz-sauvignon": {"v": ["Sauvignon Blanc"], "c": ["New Zealand"]},
    "pinot-grigio": {"v": ["Pinot Grigio"], "c": ["Italy"]},
    "albarino": {"v": ["Albariño"], "c": ["Spain"]},
    "muscadet": {"v": ["Melon"]},
    "chablis": {"v": ["Chardonnay"], "c": ["France"], "r": ["Chablis"]},
    "vermentino": {"v": ["Vermentino"]},
    "assyrtiko": {"v": ["Assyrtiko"]},
    "gruner": {"v": ["Grüner Veltliner"]},
    "vinho-verde": {"v": ["Portuguese White", "Alvarinho", "Loureiro"], "c": ["Portugal"], "p": ["Vinho Verde", "Minho"]},
    "riesling-dry": {"v": ["Riesling"], "c": ["France", "Austria"]},
    "riesling-offdry": {"v": ["Riesling"], "c": ["Germany"], "t": ["Kabinett", "Spätlese"]},
    "gewurztraminer": {"v": ["Gewürztraminer"], "c": ["France"]},
    "viognier": {"v": ["Viognier"]},
    "chenin-blanc": {"v": ["Chenin Blanc"], "c": ["France"]},
    "chardonnay-oaked": {"v": ["Chardonnay"], "c": ["US"], "p": ["California"]},
    "white-burgundy": {"v": ["Chardonnay"], "c": ["France"], "p": ["Burgundy"], "not_r": ["Chablis"]},
    "rhone-white": {"v": ["Rhône-style White Blend", "Marsanne", "Roussanne"], "c": ["France"]},
    "provence-rose": {"v": ["Rosé"], "c": ["France"], "p": ["Provence"]},
    "rosado": {"v": ["Rosado", "Rosé"], "c": ["Spain"]},
    "red-burgundy": {"v": ["Pinot Noir"], "c": ["France"], "p": ["Burgundy"]},
    "pinot-noir-nw": {"v": ["Pinot Noir"], "c": ["US", "New Zealand"], "p": ["Oregon", "Central Otago", "Marlborough", "Martinborough"]},
    "beaujolais": {"v": ["Gamay"], "c": ["France"]},
    "valpolicella": {"v": ["Corvina, Rondinella, Molinara", "Corvina"], "not_t": ["Amarone", "Recioto"]},
    "chianti": {"v": ["Sangiovese", "Red Blend"], "c": ["Italy"], "r": ["Chianti"]},
    "rioja": {"v": ["Tempranillo", "Tempranillo Blend"], "c": ["Spain"], "r": ["Rioja"]},
    "cotes-du-rhone": {"v": ["Rhône-style Red Blend", "Grenache"], "c": ["France"], "p": ["Rhône Valley"]},
    "barbera": {"v": ["Barbera"]},
    "merlot": {"v": ["Merlot"]},
    "chinon": {"v": ["Cabernet Franc"], "c": ["France"]},
    "montepulciano": {"v": ["Montepulciano"]},
    "cab-napa": {"v": ["Cabernet Sauvignon"], "c": ["US"], "r": ["Napa"]},
    "bordeaux": {"v": ["Bordeaux-style Red Blend"], "c": ["France"]},
    "syrah-rhone": {"v": ["Syrah"], "c": ["France"]},
    "shiraz": {"v": ["Shiraz"], "c": ["Australia"]},
    "malbec": {"v": ["Malbec"], "c": ["Argentina"]},
    "zinfandel": {"v": ["Zinfandel"]},
    "barolo": {"v": ["Nebbiolo"], "r": ["Barolo"]},
    "amarone": {"v": ["Corvina, Rondinella, Molinara", "Red Blend", "Corvina"], "t": ["Amarone"]},
    "sauternes": {"v": ["Bordeaux-style White Blend", "Sémillon"], "r": ["Sauternes", "Barsac"]},
    "moscato-dasti": {"v": ["Moscato"], "c": ["Italy"]},
    "tokaji": {"v": ["Furmint", "Tokaji", "Tokaji Aszú"], "c": ["Hungary"], "t": ["Aszú", "Tokaji"]},
    "vin-santo": {"t": ["Vin Santo", "Vinsanto"]},
    "fino-sherry": {"v": ["Sherry", "Palomino"], "t": ["Fino", "Manzanilla"]},
    "amontillado": {"v": ["Sherry", "Palomino"], "t": ["Amontillado", "Oloroso"]},
    "tawny-port": {"v": ["Port"], "t": ["Tawny"]},
    "ruby-port": {"v": ["Port"], "not_t": ["Tawny", "White"]},
    "madeira": {"v": ["Madeira Blend", "Malvasia", "Bual", "Sercial", "Verdelho"], "c": ["Portugal"], "p": ["Madeira"]},
}


def matches(row: dict, sel: dict) -> bool:
    if "v" in sel and row["variety"] not in sel["v"]:
        return False
    if "c" in sel and row["country"] not in sel["c"]:
        return False
    if "p" in sel and not any(x.lower() in (row["province"] or "").lower() for x in sel["p"]):
        return False
    if "r" in sel and not any(x.lower() in (row["region_1"] or "").lower() or x.lower() in (row["title"] or "").lower() for x in sel["r"]):
        return False
    if "not_r" in sel and any(x.lower() in (row["region_1"] or "").lower() for x in sel["not_r"]):
        return False
    if "t" in sel and not any(x.lower() in (row["title"] or "").lower() for x in sel["t"]):
        return False
    if "not_t" in sel and any(x.lower() in (row["title"] or "").lower() for x in sel["not_t"]):
        return False
    return True


def build() -> dict:
    counts: dict[str, Counter] = defaultdict(Counter)
    terms: dict[str, Counter] = defaultdict(Counter)
    n: Counter = Counter()
    base: Counter = Counter()
    total = 0
    with SRC.open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            desc = row["description"] or ""
            fams = {fam for fam, rx in TERM_RX.items() if rx.search(desc)}
            total += 1
            for fam in fams:
                base[fam] += 1
            for sid, sel in SELECT.items():
                if matches(row, sel):
                    n[sid] += 1
                    for fam in fams:
                        counts[sid][fam] += 1
                    for fam, rx in TERM_RX.items():
                        for m in {x.lower() for x in rx.findall(desc)}:
                            terms[sid][m] += 1
    styles = {}
    for sid in SELECT:
        if n[sid] < MIN_REVIEWS:
            styles[sid] = {"reviews": n[sid], "families": [], "terms": [], "note": f"fewer than {MIN_REVIEWS} reviews — not profiled"}
            continue
        fam_rows = []
        for fam in LEXICON:
            share = counts[sid][fam] / n[sid]
            lift = share / (base[fam] / total) if base[fam] else 0
            fam_rows.append({"family": fam, "share": round(share, 3), "lift": round(lift, 2)})
        fam_rows.sort(key=lambda x: -x["share"])
        top_terms = [{"term": t, "share": round(c / n[sid], 3)} for t, c in terms[sid].most_common(12) if c / n[sid] >= 0.05]
        styles[sid] = {"reviews": n[sid], "families": fam_rows, "terms": top_terms}
    return {
        "_meta": {
            "source": "Wine Reviews (zynicide, Kaggle; winemag-data-130k-v2.csv, 129,971 reviews) — https://www.kaggle.com/datasets/zynicide/wine-reviews",
            "license": "CC BY-NC-SA 4.0 (adapted material: aggregate descriptor shares only; no review text). Non-commercial use only; share alike.",
            "built_by": "scripts/build_wine_review_aromas.py",
            "share": "fraction of the style's reviews that mention the family/term; lift = share / share across all reviews",
            "total_reviews": total,
        },
        "styles": styles,
    }


FAMILY_OF_TAG = {  # hand-written wine aroma tag -> review family
    "citrus": "citrus", "green apple": "orchard fruit", "apple": "orchard fruit", "pear": "orchard fruit", "quince": "orchard fruit",
    "stone fruit": "stone fruit", "peach": "stone fruit", "apricot": "stone fruit", "tropical": "tropical fruit", "passion fruit": "tropical fruit",
    "lychee": "tropical fruit", "melon": "melon", "floral": "floral", "herbal": "herbal", "red fruit": "red fruit", "cherry": "red fruit",
    "strawberry": "red fruit", "raspberry": "red fruit", "black fruit": "black fruit", "blackberry": "black fruit", "plum": "black fruit",
    "earthy": "earthy", "mushroom": "earthy", "truffle": "earthy", "leather": "earthy", "spice": "spice", "ginger": "spice",
    "pepper": "pepper", "white pepper": "pepper", "smoky": "oak & toast", "toast": "oak & toast", "vanilla": "oak & toast",
    "chocolate": "chocolate & coffee", "nutty": "nutty", "almond": "nutty", "hazelnut": "nutty", "honey": "honey & caramel",
    "caramel": "honey & caramel", "dried fruit": "honey & caramel", "raisin": "honey & caramel", "mineral": "mineral & saline",
    "saline": "mineral & saline", "butter": "butter & bread", "yeasty": "butter & bread", "olive": "herbal", "grape": "orchard fruit",
    "tomato": "herbal", "jam": "black fruit",
}


def compare(out: dict) -> None:
    """How often a hand-written aroma tag is also among the style's top review families."""
    wines = json.loads(STYLES.read_text(encoding="utf-8"))["wines"]
    hits = total = 0
    missing = []
    for w in wines:
        prof = out["styles"].get(w["id"])
        if not prof or not prof["families"]:
            continue
        top = {f["family"] for f in prof["families"][:5]}
        for tag in w["aromas"]:
            fam = FAMILY_OF_TAG.get(tag)
            if not fam:
                continue
            total += 1
            if fam in top:
                hits += 1
            else:
                missing.append(f"{w['id']}: '{tag}' ({fam}) not in reviews' top 5 — {', '.join(f['family'] + ' ' + str(int(f['share'] * 100)) + '%' for f in prof['families'][:3])}")
    print(f"hand-written aroma tags confirmed by reviews' top-5 families: {hits}/{total} ({100 * hits / max(total, 1):.0f}%)")
    print("not confirmed (first 25):")
    for m in missing[:25]:
        print("  " + m)


def main() -> int:
    out = build()
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    prof = sum(1 for s in out["styles"].values() if s["families"])
    print(f"wrote {OUT.relative_to(ROOT)}: {prof}/{len(SELECT)} styles profiled")
    for sid, s in out["styles"].items():
        top = ", ".join(f"{f['family']} {int(f['share'] * 100)}%" for f in s["families"][:4])
        print(f"  {sid:18s} n={s['reviews']:5d}  {top}")
    if "--compare" in sys.argv:
        compare(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
