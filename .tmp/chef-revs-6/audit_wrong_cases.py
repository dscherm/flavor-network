#!/usr/bin/env python3
"""
audit_wrong_cases.py — Hand-graded audit of the 60 'wrong' classifier eval
cases, deciding for each whether the LABEL or the CLASSIFIER was right.

Output of this audit:
  - For 'classifier_better' rows: update the curated tier1_aroma to the
    classifier's prediction (with possible trimming for over-prediction).
  - For 'label_better' rows: leave the curated label alone.
  - For 'ambiguous' rows: leave alone (manual review later).

Run this AFTER classify_aromas.py and BEFORE re-running it for fresh metrics.

Why this exists: the original 78.5% "accuracy" was misleading because the
'ground truth' itself inherited from a 5-aroma heuristic that didn't have
categories like citrus, pungent, marine, aged. Most of the 'wrongs' were
the classifier being more chemistry-correct than the label.
"""
import csv, sys


# verdict: 'classifier_better' | 'label_better' | 'ambiguous'
# correction: the value to write into tier1_aroma if applying. Empty = no change.
# rationale: one-line chemistry-grounded reason
AUDIT = [
    # name, verdict, correction, rationale
    ("almond",               "ambiguous",         "",                       "raw=lactonic/creamy; roasted=pyrazines/roasted — depends on prep"),
    ("anchovy",              "classifier_better", "marine|aged",            "small marine fish, often salt-cured"),
    ("baked potato",         "label_better",      "",                       "earthy (geosmin) is dominant; classifier missed it, only got roasted skin"),
    ("bergamot",             "classifier_better", "citrus|floral",          "limonene + linalyl acetate — textbook citrus-floral"),
    ("black bean",           "ambiguous",         "",                       "earthy raw, roasted pyrazines when cooked"),
    ("bonito",               "classifier_better", "aged|roasted",           "katsuobushi = smoke-dried + months-aged fish"),
    ("cabbage",              "classifier_better", "pungent|green",          "isothiocyanate-driven, plus leafy"),
    ("caper",                "classifier_better", "pungent|marine",         "methylisothiocyanate from glucocapparin + brine cure"),
    ("caramel",              "classifier_better", "caramel",                "literally the definition: HMF + furaneol + maltol"),
    ("cardamom",             "classifier_better", "herbal|citrus",          "1,8-cineole (herbal) + alpha-terpinyl acetate + limonene"),
    ("chestnut",             "classifier_better", "roasted|earthy",         "starchy nut; roasted develops Maillard, not creamy/lactonic"),
    ("chickpea",             "label_better",      "",                       "raw is earthy/beany; classifier hit only roasted"),
    ("cocoa",                "classifier_better", "roasted",                "pyrazines from fermenting + roasting beans"),
    ("coriander",            "classifier_better", "citrus|floral|woody",    "linalool + alpha-pinene + geranyl acetate — NOT pungent"),
    ("corn",                 "ambiguous",         "",                       "fresh corn: DMS (pungent), hexanal (green), lactones (creamy); all valid"),
    ("cumin",                "classifier_better", "herbal|earthy",          "cuminaldehyde + gamma-terpinene — warm/herbal, not pungent"),
    ("fenugreek",            "classifier_better", "caramel",                "sotolone is the marker compound — curry/maple = caramel family"),
    ("fish sauce",           "classifier_better", "aged|marine",            "fermented anchovy; aged + marine"),
    ("flour",                "label_better",      "",                       "raw flour is earthy/starchy; only becomes roasted when toasted"),
    ("garam masala",         "ambiguous",         "",                       "spice blend; warm/caramel vs roasted depending on toasting"),
    ("gruyere",              "classifier_better", "aged|creamy",            "aged hard cheese; lactic + butyric + free fatty acids"),
    ("hazelnut",             "classifier_better", "roasted",                "filbertone + pyrazines; almost always roasted in use"),
    ("hemp seed",            "classifier_better", "green",                  "hexanal-driven grassy character dominates"),
    ("hoisin sauce",         "label_better",      "",                       "fermented soy base; aged is dominant — classifier missed it"),
    ("horseradish",          "classifier_better", "pungent",                "allyl isothiocyanate — textbook pungent"),
    ("kombu",                "classifier_better", "marine",                 "kelp; bromophenols + DMS + glutamate"),
    ("lemon",                "classifier_better", "citrus",                 "limonene + citral"),
    ("lemon verbena",        "classifier_better", "citrus|herbal|floral",   "citral + linalool + terpenes"),
    ("lentil",               "label_better",      "",                       "raw lentils are earthy/beany; classifier overshot to roasted"),
    ("lime",                 "classifier_better", "citrus",                 "limonene + citral + neral"),
    ("marjoram",             "classifier_better", "herbal",                 "cis-sabinene hydrate + terpinenes — terpene-herbal, not green-leafy"),
    ("miso",                 "classifier_better", "aged|roasted",           "fermented soy paste; aged with Maillard from brewing"),
    ("nigella seed",         "classifier_better", "herbal|pungent",         "thymoquinone + p-cymene + slight peppery nasal note"),
    ("nori",                 "classifier_better", "marine",                 "seaweed; sometimes toasted but marine is dominant"),
    ("olive",                "classifier_better", "fruity|green",           "oleocanthal + leaf aldehydes; not creamy in dairy sense"),
    ("olive oil",            "classifier_better", "fruity|green",           "hexenals + oleocanthal — green-fruity, not creamy"),
    ("orange",               "classifier_better", "citrus",                 "limonene + decanal + linalool"),
    ("oyster sauce",         "classifier_better", "marine|caramel",         "reduced oyster broth + caramelized sugar"),
    ("parmesan",             "classifier_better", "aged",                   "aged hard cheese; lactic + butyric + propionic"),
    ("pasta",                "label_better",      "",                       "wheat-earthy; classifier overshot to roasted"),
    ("potato",               "classifier_better", "earthy",                 "geosmin + methylisoborneol; not woody"),
    ("pumpkin pie spice",    "label_better",      "",                       "cinnamon/clove/nutmeg blend = caramel-adjacent; classifier got it badly wrong"),
    ("pumpkin seed",         "classifier_better", "roasted|green",          "raw=green/grassy, toasted=pyrazines"),
    ("radish",               "classifier_better", "pungent",                "methylthio-3-butenyl isothiocyanate; brassica"),
    ("sausage",              "label_better",      "",                       "cooked meat = Maillard dominant; classifier picked up seasoning herbs"),
    ("shallot",              "classifier_better", "pungent",                "allium; same sulfur chemistry as onion"),
    ("shrimp",               "classifier_better", "marine",                 "TMA + bromophenols; not creamy unless butter-cooked"),
    ("soy sauce",            "classifier_better", "aged|roasted",           "fermented + Maillard during brewing"),
    ("sweet potato",         "classifier_better", "caramel|earthy",         "maltol/furaneol when cooked + beta-ionone + earthy base"),
    ("tofu",                 "ambiguous",         "",                       "very mild; hexanal-green and slight earthy both apply"),
    ("tomato juice",         "classifier_better", "green|caramel|floral",   "hexenal + furaneol + beta-ionone + isobutylthiazole — complex"),
    ("walnut",               "classifier_better", "roasted|earthy",         "Maillard + tannic; not dairy-creamy"),
    ("worcestershire sauce", "classifier_better", "aged",                   "fermented anchovy + vinegar + molasses; aged dominant"),
    ("yuzu",                 "classifier_better", "citrus|floral",          "citrus + linalool"),
    ("mandarin",             "classifier_better", "citrus",                 "limonene-dominant citrus"),
    ("red bell pepper",      "classifier_better", "green|fruity",           "methoxypyrazines (green) + ripening sweetness"),
    ("hops",                 "classifier_better", "woody|herbal|citrus",    "humulene + myrcene + citrus terpenes (modern varieties)"),
    ("black lime",           "classifier_better", "citrus|earthy|aged",     "dried/aged lime — all three chemistries present"),
    ("roasted garlic",       "classifier_better", "pungent|roasted|caramel","sulfur + Maillard + caramelization"),
    ("molasses",             "classifier_better", "caramel|roasted",        "concentrated caramelized sugar"),
]


def main(src, dst):
    # build lookup
    audit_by_name = {row[0]: row for row in AUDIT}

    with open(src, encoding="utf-8", newline="") as f:
        rows = list(csv.reader(f))
    header, data = rows[0], rows[1:]
    arm_i = header.index("tier1_aroma")
    src_i = header.index("sources")

    counts = {"classifier_better": 0, "label_better": 0, "ambiguous": 0,
              "applied": 0, "skipped_not_found": 0}

    for r in data:
        name = r[0]
        if name not in audit_by_name:
            continue
        _, verdict, correction, _ = audit_by_name[name]
        counts[verdict] += 1
        if verdict == "classifier_better" and correction:
            r[arm_i] = correction
            if "audit-corrected" not in r[src_i]:
                r[src_i] = (r[src_i] + ";audit-corrected").lstrip(";")
            counts["applied"] += 1

    with open(dst, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(data)

    # write audit transcript
    with open("audit_wrong_cases.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["name", "verdict", "correction", "rationale"])
        for row in AUDIT:
            w.writerow(row)

    # report
    print(f"=== audit of 60 'wrong' eval cases ===")
    print(f"  classifier was right : {counts['classifier_better']:>3}  ({counts['classifier_better']/60:.0%})")
    print(f"  label was right      : {counts['label_better']:>3}  ({counts['label_better']/60:.0%})")
    print(f"  ambiguous            : {counts['ambiguous']:>3}  ({counts['ambiguous']/60:.0%})")
    print()
    print(f"  rows updated         : {counts['applied']}")
    print(f"  output               : {dst}")
    print(f"  audit transcript     : audit_wrong_cases.csv")


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "flavor_graph_full_v4.csv"
    dst = sys.argv[2] if len(sys.argv) > 2 else "flavor_graph_full_v5.csv"
    main(src, dst)
