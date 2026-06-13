#!/usr/bin/env python3
"""
apply_corrections.py — v7 -> v8. Fix pre-existing aroma quirks.

LOGIC
-----
For every row that is RULE-DERIVED (no chemistry_notes — curated rows are
protected), compare the stored tier1_aroma against what the name-based rule
predicts. If they share NO tokens at all (zero overlap), the stored value is
almost certainly an old-classifier artifact, so replace it with the rule
prediction.

The zero-overlap bar is deliberately strict: if stored and predicted share
even one aroma (e.g. stored 'aged|fruity', predicted 'aged'), we leave it
alone — that's a disagreement of nuance, not a clear error. This is also why
adding the 'wine' rule matters: 'rice wine' now predicts 'aged', which
overlaps its stored 'aged|fruity', so it is correctly skipped.
"""
import csv, sys
from collections import Counter
import complete_fields as cf

# tier2 must stay limited to real tastes — never re-introduce chemesthetic
# "pungent"/"spicy" that we moved to mouthfeel in v7.
REAL_TASTES = {"sweet", "sour", "salty", "bitter", "umami", "fatty"}

def main(src, dst):
    with open(src, encoding="utf-8", newline="") as f:
        rows = list(csv.reader(f))
    header, data = rows[0], rows[1:]
    arm_i   = header.index("tier1_aroma")
    taste_i = header.index("tier2_taste")
    chem_i  = header.index("chemistry_notes")

    fixed = 0
    fixed_taste = 0
    protected = 0
    patterns = Counter()
    taste_patterns = Counter()
    examples = {}

    for r in data:
        a = r[arm_i].strip()
        if a in ("[non-food]", ""):
            continue
        if r[chem_i].strip():          # curated — never touch
            protected += 1
            continue
        matched, rule_aroma, rule_taste = cf.best_rule(r[0])
        if not matched:
            continue

        # ---- aroma correction (zero overlap with predicted) ----
        if rule_aroma and a not in ("[odorless]",):
            stored    = set(t.strip() for t in a.split("|"))
            predicted = set(t.strip() for t in rule_aroma.split("|"))
            if not (stored & predicted):
                patterns[(a, rule_aroma)] += 1
                examples.setdefault((a, rule_aroma), []).append(r[0])
                r[arm_i] = rule_aroma
                fixed += 1

        # ---- taste correction (only flip TO real tastes) ----
        if rule_taste:
            pred_real = [t.strip() for t in rule_taste.split("|")
                         if t.strip() in REAL_TASTES]
            if pred_real:
                stored_t = set(t.strip() for t in r[taste_i].split("|") if t.strip())
                if stored_t and not (stored_t & set(pred_real)):
                    new_t = "|".join(pred_real)
                    taste_patterns[(r[taste_i], new_t)] += 1
                    r[taste_i] = new_t
                    fixed_taste += 1

    with open(dst, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(data)

    print("=== corrections v7 -> v8 ===")
    print(f"  curated rows protected : {protected}")
    print(f"  aroma values corrected : {fixed}")
    print(f"  taste values corrected : {fixed_taste}\n")
    print("=== aroma corrections by pattern (top 12) ===")
    for (stored, corr), c in patterns.most_common(12):
        ex = examples[(stored, corr)][0]
        print(f"  {c:>4}x  {stored:<22} -> {corr:<18}  e.g. {ex}")
    print("\n=== taste corrections by pattern (top 12) ===")
    for (stored, corr), c in taste_patterns.most_common(12):
        print(f"  {c:>4}x  {stored:<16} -> {corr}")
    print(f"\n  output: {dst}")


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "flavor_graph_full_v7.csv"
    dst = sys.argv[2] if len(sys.argv) > 2 else "flavor_graph_full_v8.csv"
    main(src, dst)
