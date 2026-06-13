"""Step-1 calibration pilot v2 scorer — multi-label aroma + taste.

Reads pilot_v2/predictions.json (LLM blind labels) and pilot_v2/gold.json
(multi-aroma + taste gold), reports:

  1. aroma multi-label macro-F1   (6 GNN-mappable aroma terms)
  2. taste multi-label macro-F1   (5 GNN-mappable taste terms; full 8 also shown)
  3. 11-head macro-F1             (6 aroma heads + 5 taste heads) — comparable to
     the molecular ingredient baseline (~0.101, aggregate_predictions.py topk_mean)

predictions.json schema (array):
    [{"name": "almond", "aromas": ["nutty","fatty"], "tastes": ["sweet","bitter"]}, ...]

Usage:
    python flavor-gnn/scripts/pilot_odor_labels/score_pilot_v2.py
    python flavor-gnn/scripts/pilot_odor_labels/score_pilot_v2.py --threshold 0.65
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

PILOT = Path(__file__).resolve().parent / "pilot_v2"
MOLECULAR_BASELINE_11HEAD_F1 = 0.101

GNN_AROMAS = ["fruity", "floral", "green", "woody", "spicy", "fatty"]
GNN_TASTES = ["sweet", "sour", "bitter", "salty", "umami"]
AROMA_TO_HEAD = {a: f"odor_{a}" for a in GNN_AROMAS}
TASTE_TO_HEAD = {t: t for t in GNN_TASTES}
ELEVEN_HEADS = sorted(set(AROMA_TO_HEAD.values()) | set(TASTE_TO_HEAD.values()))


def _prf(tp, fp, fn):
    p = tp / (tp + fp) if (tp + fp) else 0.0
    r = tp / (tp + fn) if (tp + fn) else 0.0
    f = 2 * p * r / (p + r) if (p + r) else 0.0
    return p, r, f


def macro_f1(pred_sets, gold_sets, labels):
    per = {}
    for lab in labels:
        tp = fp = fn = 0
        for name, gold in gold_sets.items():
            pred = pred_sets.get(name, set())
            ip, ig = lab in pred, lab in gold
            if ip and ig: tp += 1
            elif ip and not ig: fp += 1
            elif (not ip) and ig: fn += 1
        p, r, f = _prf(tp, fp, fn)
        per[lab] = {"precision": round(p, 3), "recall": round(r, 3),
                    "f1": round(f, 3), "support": tp + fn}
    f1s = [v["f1"] for v in per.values()]
    return (sum(f1s) / len(f1s) if f1s else 0.0), per


def _print_per(title, per):
    print(f"  --- {title} ---")
    for lab, v in sorted(per.items(), key=lambda kv: -kv[1]["f1"]):
        print(f"    {lab:<12} f1={v['f1']:.3f}  P={v['precision']:.3f}"
              f"  R={v['recall']:.3f}  n={v['support']}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--threshold", type=float, default=0.65)
    ap.add_argument("--predictions", default=str(PILOT / "predictions.json"))
    ap.add_argument("--gold", default=str(PILOT / "gold.json"))
    args = ap.parse_args()

    preds_raw = json.loads(Path(args.predictions).read_text(encoding="utf-8"))
    gold_raw = json.loads(Path(args.gold).read_text(encoding="utf-8"))

    pred = {}
    for r in preds_raw:
        nm = (r.get("name") or "").strip().lower()
        if not nm:
            continue
        pred[nm] = {
            "aromas": {a.strip().lower() for a in (r.get("aromas") or []) if a},
            "tastes": {t.strip().lower() for t in (r.get("tastes") or []) if t},
        }
    gold = {nm: {"aromas": set(g.get("aromas", [])), "tastes": set(g.get("tastes", []))}
            for nm, g in gold_raw.items()}

    shared = [n for n in gold if n in pred]
    missing = [n for n in gold if n not in pred]

    # View 1: aroma multi-label macro-F1 over the 6 GNN aromas.
    aroma_macro, aroma_per = macro_f1(
        {n: pred[n]["aromas"] for n in shared},
        {n: gold[n]["aromas"] for n in shared}, GNN_AROMAS)

    # View 2: taste macro-F1 over the 5 GNN tastes (full-8 also computed).
    taste_macro, taste_per = macro_f1(
        {n: pred[n]["tastes"] for n in shared},
        {n: gold[n]["tastes"] for n in shared}, GNN_TASTES)
    full_taste_vocab = sorted({t for g in gold.values() for t in g["tastes"]})
    taste8_macro, _ = macro_f1(
        {n: pred[n]["tastes"] for n in shared},
        {n: gold[n]["tastes"] for n in shared}, full_taste_vocab)

    # View 3: 11-head macro-F1.
    def heads(aromas, tastes):
        h = {AROMA_TO_HEAD[a] for a in aromas if a in AROMA_TO_HEAD}
        h |= {TASTE_TO_HEAD[t] for t in tastes if t in TASTE_TO_HEAD}
        return h
    head_macro, head_per = macro_f1(
        {n: heads(pred[n]["aromas"], pred[n]["tastes"]) for n in shared},
        {n: heads(gold[n]["aromas"], gold[n]["tastes"]) for n in shared},
        ELEVEN_HEADS)

    print("=" * 64)
    print("  CALIBRATION PILOT v2 — multi-label, blind LLM vs chef gold")
    print("=" * 64)
    print(f"  scored {len(shared)}/{len(gold)} ingredients"
          + (f"  ({len(missing)} missing)" if missing else ""))
    print()
    print(f"  [1] aroma macro-F1 (6 GNN aromas)   : {aroma_macro:.3f}")
    print(f"  [2] taste macro-F1 (5 GNN tastes)   : {taste_macro:.3f}"
          f"   (full 8-term: {taste8_macro:.3f})")
    print(f"  [3] 11-head macro-F1                : {head_macro:.3f}"
          f"   (molecular baseline {MOLECULAR_BASELINE_11HEAD_F1:.3f})")
    print()
    _print_per("11-head per-label F1", head_per)
    print()

    head_pass = head_macro >= args.threshold
    beats = head_macro > MOLECULAR_BASELINE_11HEAD_F1 * 2
    verdict = ("PASS — distillation is viable; proceed to scale 304 -> 3,913"
               if (head_pass and beats) else
               "MARGINAL/FAIL — inspect per-head before scaling")
    print(f"  VERDICT: {verdict}")
    print(f"    11-head macro-F1 >= {args.threshold}: {head_pass}")
    print(f"    11-head macro-F1 > 2x molecular ({2*MOLECULAR_BASELINE_11HEAD_F1:.3f}): {beats}")
    print("=" * 64)

    (PILOT / "pilot_scores.json").write_text(json.dumps({
        "scored": len(shared), "missing": missing,
        "aroma_macro_f1": round(aroma_macro, 4),
        "taste_macro_f1_5": round(taste_macro, 4),
        "taste_macro_f1_8": round(taste8_macro, 4),
        "eleven_head_macro_f1": round(head_macro, 4),
        "molecular_baseline_11head_f1": MOLECULAR_BASELINE_11HEAD_F1,
        "aroma_per_label": aroma_per, "taste_per_label": taste_per,
        "eleven_head_per_label": head_per,
        "threshold": args.threshold, "verdict": verdict,
    }, indent=2), encoding="utf-8")
    print(f"  scores written -> {PILOT / 'pilot_scores.json'}")


if __name__ == "__main__":
    main()
