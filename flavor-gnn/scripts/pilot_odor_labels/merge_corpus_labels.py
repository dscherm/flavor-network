"""Full-corpus distillation — consensus-merge, overlay, validate, finalize.

Reads per-batch per-sample predictions written by the labeling workflow
(corpus/preds/_pred_<batch>_s<sample>.json), then:

  1. CONSENSUS across samples per ingredient: a label is kept if it appears in
     >= ceil(samples/2) samples (majority). With 1 sample this is pass-through.
  2. VOCAB VALIDATION: drop any term not in the controlled vocab; drop entries
     with no valid aroma.
  3. CHEF OVERLAY: chef gold rows (chef_overlay.json) win by precedence.
  4. LOW-CONFIDENCE FLAGS: salty + odor_spicy were the only pilot heads < 0.6
     (and match the molecular model's known-weak axes); they are emitted but
     marked low_confidence so the UI doesn't surface them as accuracy claims.

Writes:
  public/proDataset/flavor_profiles_distilled.json   {meta, ingredients:{name:{aromas,tastes,source}}}
  corpus/distill_report.json                          coverage + per-head counts + agreement

Usage:
    python flavor-gnn/scripts/pilot_odor_labels/merge_corpus_labels.py
"""
from __future__ import annotations

import glob
import json
import math
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
CORPUS = HERE / "corpus"
OUT_JSON = ROOT / "public" / "proDataset" / "flavor_profiles_distilled.json"

AROMA_VOCAB = {
    "fruity", "floral", "green", "woody", "spicy", "fatty", "earthy",
    "fermented", "smoky", "nutty", "creamy", "caramel", "meaty", "marine",
    "citrusy", "roasted", "alliaceous green",
}
TASTE_VOCAB = {"sweet", "sour", "bitter", "salty", "umami", "spicy", "pungent",
               "astringent"}
LOW_CONFIDENCE_TASTES = {"salty"}
LOW_CONFIDENCE_AROMAS = {"spicy"}  # aroma-spicy == odor_spicy, weak head


def _norm_terms(raw, vocab):
    out = []
    for t in raw or []:
        t = str(t).strip().lower()
        if t in vocab and t not in out:
            out.append(t)
    return out


def main() -> None:
    manifest = json.loads((CORPUS / "manifest.json").read_text(encoding="utf-8"))
    samples = manifest["samples"]

    # Gather predictions: name -> list of (aromas_set, tastes_set) across all samples.
    by_name_aromas: dict[str, list] = {}
    by_name_tastes: dict[str, list] = {}
    pred_files = sorted(glob.glob(str(CORPUS / "preds" / "_pred_*.json")))
    sample_seen: dict[str, set] = {}  # name -> set of sample indices contributing

    for pf in pred_files:
        m = re.search(r"_pred_(\d+)_s(\d+)\.json$", pf)
        s_idx = int(m.group(2)) if m else 0
        try:
            arr = json.loads(Path(pf).read_text(encoding="utf-8"))
        except Exception as e:
            print(f"[merge] WARN unreadable {pf}: {e}")
            continue
        for r in arr:
            nm = (r.get("name") or "").strip().lower()
            if not nm:
                continue
            by_name_aromas.setdefault(nm, []).append(set(_norm_terms(r.get("aromas"), AROMA_VOCAB)))
            by_name_tastes.setdefault(nm, []).append(set(_norm_terms(r.get("tastes"), TASTE_VOCAB)))
            sample_seen.setdefault(nm, set()).add(s_idx)

    # Consensus: keep a term present in >= need of the samples that labeled the name.
    distilled: dict[str, dict] = {}
    dropped_no_aroma = 0
    for nm in by_name_aromas:
        n_seen = len(sample_seen.get(nm, {0}))
        thr = max(1, math.ceil(n_seen / 2))
        ac = Counter(t for s in by_name_aromas[nm] for t in s)
        tc = Counter(t for s in by_name_tastes[nm] for t in s)
        aromas = [t for t, c in ac.items() if c >= thr]
        tastes = [t for t, c in tc.items() if c >= thr]
        # If consensus nukes all aromas (rare), fall back to the union top-1.
        if not aromas and ac:
            aromas = [ac.most_common(1)[0][0]]
        if not aromas:
            dropped_no_aroma += 1
            continue
        distilled[nm] = {
            "aromas": aromas, "tastes": tastes, "source": "llm-distilled",
            "low_confidence": sorted(
                ({"salty"} & set(tastes)) | ({"odor_spicy"} if "spicy" in aromas else set())
            ),
        }

    # Overlay chef gold (precedence).
    overlay = json.loads((CORPUS / "chef_overlay.json").read_text(encoding="utf-8"))
    for nm, g in overlay.items():
        distilled[nm] = {"aromas": g["aromas"], "tastes": g["tastes"],
                         "source": "chef", "low_confidence": []}

    # Report.
    aroma_counts = Counter(a for v in distilled.values() for a in v["aromas"])
    taste_counts = Counter(t for v in distilled.values() for t in v["tastes"])
    src_counts = Counter(v["source"] for v in distilled.values())
    report = {
        "total_labeled": len(distilled),
        "by_source": dict(src_counts),
        "dropped_no_valid_aroma": dropped_no_aroma,
        "samples": samples,
        "aroma_head_counts": dict(aroma_counts.most_common()),
        "taste_head_counts": dict(taste_counts.most_common()),
        "low_confidence_policy": {
            "tastes": sorted(LOW_CONFIDENCE_TASTES),
            "aromas": sorted(LOW_CONFIDENCE_AROMAS),
            "note": "salty + odor_spicy match the molecular model's known-weak "
                    "axes and the pilot's only sub-0.6 heads; emitted but flagged.",
        },
    }

    OUT_JSON.write_text(json.dumps({
        "meta": {
            "generator": "merge_corpus_labels.py",
            "method": "blind LLM multi-label distillation + consensus + chef overlay",
            "pilot_validation": "11-head macro-F1 0.710 vs molecular 0.101 (v2)",
            "vocab_aroma": sorted(AROMA_VOCAB),
            "vocab_taste": sorted(TASTE_VOCAB),
            **report,
        },
        "ingredients": dict(sorted(distilled.items())),
    }, indent=2, ensure_ascii=False), encoding="utf-8")
    (CORPUS / "distill_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(json.dumps(report, indent=2))
    print(f"\n[merge] wrote {len(distilled)} profiles -> {OUT_JSON}")


if __name__ == "__main__":
    main()
