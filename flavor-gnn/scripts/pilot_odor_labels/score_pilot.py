"""Step-1 calibration pilot — score BLIND LLM labels against the chef gold set.

Companion to artifacts/INGREDIENT_ODOR_LABEL_SOURCING_2026-06-13.md.

Reads pilot/predictions.json (the LLM's blind labels) and pilot/gold.json
(held-out chef labels), then reports three views:

  1. primary_aroma exact-match accuracy  (chef 17-term aroma vocab)
  2. taste multi-label macro-F1          (chef 8-term taste vocab)
  3. 11-head macro-F1                     (GNN-mappable subset only) — directly
     comparable to the molecular ingredient baseline (~0.101 macro-F1 from
     aggregate_predictions.py topk_mean).

Verdict: distillation is "real" if the taste macro-F1 clears --threshold
(default 0.65) AND the 11-head macro-F1 decisively beats the 0.101 molecular
baseline.

predictions.json schema (array; order need not match):
    [{"name": "apple", "primary_aroma": "fruity", "tastes": ["sweet","sour"]}, ...]

Usage:
    python flavor-gnn/scripts/pilot_odor_labels/score_pilot.py
    python flavor-gnn/scripts/pilot_odor_labels/score_pilot.py --threshold 0.7
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

PILOT = Path(__file__).resolve().parent / "pilot"
MOLECULAR_BASELINE_11HEAD_F1 = 0.101  # aggregate_predictions.py topk_mean, chef set

# Chef-term -> GNN head, mirroring aggregate_predictions.py.ingredient_eval_set.
# (woody included here as odor_woody; the 2026-05 baseline mapping omitted it.)
AROMA_TO_HEAD = {
    "fruity": "odor_fruity", "floral": "odor_floral", "green": "odor_green",
    "woody": "odor_woody", "spicy": "odor_spicy", "fatty": "odor_fatty",
}
TASTE_TO_HEAD = {
    "sweet": "sweet", "sour": "sour", "bitter": "bitter",
    "salty": "salty", "umami": "umami",
}
ELEVEN_HEADS = sorted(set(AROMA_TO_HEAD.values()) | set(TASTE_TO_HEAD.values()))


def _prf(tp: int, fp: int, fn: int) -> tuple[float, float, float]:
    prec = tp / (tp + fp) if (tp + fp) else 0.0
    rec = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
    return prec, rec, f1


def macro_f1_multilabel(
    pred_sets: dict[str, set], gold_sets: dict[str, set], labels: list[str]
) -> tuple[float, dict]:
    """Per-label P/R/F1 over the shared name set; macro-average of F1."""
    per_label = {}
    for lab in labels:
        tp = fp = fn = 0
        for name, gold in gold_sets.items():
            pred = pred_sets.get(name, set())
            in_p, in_g = lab in pred, lab in gold
            if in_p and in_g:
                tp += 1
            elif in_p and not in_g:
                fp += 1
            elif (not in_p) and in_g:
                fn += 1
        p, r, f = _prf(tp, fp, fn)
        per_label[lab] = {"precision": round(p, 3), "recall": round(r, 3),
                          "f1": round(f, 3), "support": tp + fn}
    f1s = [v["f1"] for v in per_label.values()]
    macro = sum(f1s) / len(f1s) if f1s else 0.0
    return macro, per_label


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--threshold", type=float, default=0.65,
                    help="Taste macro-F1 bar for a 'distillation works' verdict.")
    ap.add_argument("--predictions", default=str(PILOT / "predictions.json"))
    ap.add_argument("--gold", default=str(PILOT / "gold.json"))
    args = ap.parse_args()

    preds_raw = json.loads(Path(args.predictions).read_text(encoding="utf-8"))
    gold_raw = json.loads(Path(args.gold).read_text(encoding="utf-8"))

    # Normalize predictions -> name-keyed.
    pred = {}
    for r in preds_raw:
        nm = (r.get("name") or "").strip().lower()
        if not nm:
            continue
        pred[nm] = {
            "primary_aroma": (r.get("primary_aroma") or "").strip().lower(),
            "tastes": {t.strip().lower() for t in (r.get("tastes") or []) if t},
        }

    gold = {nm: {"primary_aroma": g.get("primary_aroma", ""),
                 "tastes": set(g.get("tastes", []))} for nm, g in gold_raw.items()}

    shared = [n for n in gold if n in pred]
    missing = [n for n in gold if n not in pred]

    # View 1: primary_aroma exact-match accuracy.
    aroma_hits = sum(1 for n in shared
                     if pred[n]["primary_aroma"] == gold[n]["primary_aroma"])
    aroma_acc = aroma_hits / len(shared) if shared else 0.0

    # View 2: taste multi-label macro-F1 (chef 8-term vocab).
    taste_vocab = sorted({t for g in gold.values() for t in g["tastes"]})
    taste_pred = {n: pred[n]["tastes"] for n in shared}
    taste_gold = {n: gold[n]["tastes"] for n in shared}
    taste_macro, taste_per = macro_f1_multilabel(taste_pred, taste_gold, taste_vocab)

    # View 3: 11-head macro-F1 (GNN-mappable subset) — comparable to molecular.
    def to_heads(primary_aroma: str, tastes: set) -> set:
        heads = set()
        if primary_aroma in AROMA_TO_HEAD:
            heads.add(AROMA_TO_HEAD[primary_aroma])
        for t in tastes:
            if t in TASTE_TO_HEAD:
                heads.add(TASTE_TO_HEAD[t])
        return heads

    head_pred = {n: to_heads(pred[n]["primary_aroma"], pred[n]["tastes"]) for n in shared}
    head_gold = {n: to_heads(gold[n]["primary_aroma"], gold[n]["tastes"]) for n in shared}
    head_macro, head_per = macro_f1_multilabel(head_pred, head_gold, ELEVEN_HEADS)

    # ---- Report ----
    print("=" * 64)
    print(f"  CALIBRATION PILOT — LLM blind labels vs chef gold")
    print("=" * 64)
    print(f"  scored {len(shared)}/{len(gold)} ingredients"
          + (f"  ({len(missing)} missing predictions)" if missing else ""))
    if missing:
        print(f"  missing (first 10): {missing[:10]}")
    print()
    print(f"  [1] primary_aroma exact-match accuracy : {aroma_acc:.3f}")
    print(f"  [2] taste multi-label macro-F1         : {taste_macro:.3f}")
    print(f"  [3] 11-head macro-F1 (GNN-mappable)    : {head_macro:.3f}"
          f"   (molecular baseline {MOLECULAR_BASELINE_11HEAD_F1:.3f})")
    print()
    print("  --- taste per-label F1 ---")
    for lab, v in sorted(taste_per.items(), key=lambda kv: -kv[1]["f1"]):
        print(f"    {lab:<12} f1={v['f1']:.3f}  P={v['precision']:.3f}"
              f"  R={v['recall']:.3f}  n={v['support']}")
    print("  --- 11-head per-label F1 ---")
    for lab, v in sorted(head_per.items(), key=lambda kv: -kv[1]["f1"]):
        print(f"    {lab:<12} f1={v['f1']:.3f}  P={v['precision']:.3f}"
              f"  R={v['recall']:.3f}  n={v['support']}")
    print()

    taste_pass = taste_macro >= args.threshold
    head_pass = head_macro > MOLECULAR_BASELINE_11HEAD_F1 * 2  # "decisively beats"
    verdict = "PASS — distillation is viable; proceed to scale 304 -> 3,913" \
        if (taste_pass and head_pass) else \
        "FAIL — distillation does not clear the bar; do not scale"
    print(f"  VERDICT: {verdict}")
    print(f"    taste macro-F1 >= {args.threshold}: {taste_pass}")
    print(f"    11-head macro-F1 > 2x molecular baseline ({2*MOLECULAR_BASELINE_11HEAD_F1:.3f}): {head_pass}")
    print("=" * 64)

    (PILOT / "pilot_scores.json").write_text(json.dumps({
        "scored": len(shared), "missing": missing,
        "primary_aroma_accuracy": round(aroma_acc, 4),
        "taste_macro_f1": round(taste_macro, 4),
        "eleven_head_macro_f1": round(head_macro, 4),
        "molecular_baseline_11head_f1": MOLECULAR_BASELINE_11HEAD_F1,
        "taste_per_label": taste_per, "eleven_head_per_label": head_per,
        "threshold": args.threshold, "verdict": verdict,
    }, indent=2), encoding="utf-8")
    print(f"  scores written -> {PILOT / 'pilot_scores.json'}")


if __name__ == "__main__":
    main()
