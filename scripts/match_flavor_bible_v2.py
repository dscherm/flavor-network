#!/usr/bin/env python3
"""Improved FB->ingredient matcher + miss diagnostics.

Adds over v1: qualifier/prep stripping, head-noun + token-set matching, and a
categorization of the still-missed names so we can tell whether 9% is matcher
weakness or a genuine vocabulary gap.
"""
from __future__ import annotations

import csv
import json
import sys
import difflib
from collections import Counter
from pathlib import Path

# Precision mode: when --precise is passed, disable the two low-precision
# match stages (head-noun + fuzzy difflib). For a CURATED authoritative
# pairing layer a false match asserts a Flavor Bible endorsement that
# doesn't exist, so precision > recall. Safe stages = exact, synonym,
# singular, token-set (all are equality-based, not heuristic).
PRECISE = "--precise" in sys.argv

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[1]
TASKS = ["sweet", "bitter", "umami", "salty", "sour", "odor_fruity",
         "odor_floral", "odor_green", "odor_woody", "odor_spicy", "odor_fatty"]

# modifiers that don't change ingredient identity
PREP = {"fresh", "dried", "ground", "whole", "raw", "cooked", "chopped", "minced",
        "sliced", "grated", "crushed", "toasted", "roasted", "smoked", "frozen",
        "canned", "powdered", "powder", "flakes", "seeds", "seed", "leaves", "leaf",
        "fillets", "fillet", "juice", "zest", "extract", "fresh-squeezed"}
COLORS = {"red", "green", "yellow", "white", "black", "purple", "golden", "dark", "light"}


def singularize(w: str) -> str:
    if w.endswith("ies"):
        return w[:-3] + "y"
    if w.endswith("es") and len(w) > 4:
        return w[:-2]
    if w.endswith("s") and not w.endswith("ss"):
        return w[:-1]
    return w


def norm_tokens(name: str) -> list[str]:
    n = name.strip().lower()
    for sep in (":", "(", ",", "-"):
        n = n.split(sep)[0]
    toks = [singularize(t) for t in n.replace("/", " ").split() if t]
    content = [t for t in toks if t not in PREP and t not in COLORS]
    return content or toks  # never empty


def main() -> int:
    ent = json.loads((ROOT / "public/proDataset/gnn_entropy.json").read_text(encoding="utf-8"))
    prof = {nm: np.array([e["probs"].get(t, 0.0) for t in TASKS])
            for nm, e in ent.items() if not nm.startswith("_")}
    keys = list(prof)

    # index ingredients by exact, singular, token-set
    exact = set(keys)
    sing = {singularize(k): k for k in keys}
    tokset = {}
    for k in keys:
        tokset[frozenset(norm_tokens(k))] = k
    head = {}  # last content token -> ingredient (only if unambiguous)
    headc = Counter(norm_tokens(k)[-1] for k in keys)
    for k in keys:
        h = norm_tokens(k)[-1]
        if headc[h] == 1:
            head[h] = k

    syn = json.loads((ROOT / "proDataset/data/synonyms.json").read_text(encoding="utf-8"))
    syn = {k: v for k, v in syn.items() if not k.startswith("_")}

    stage = Counter()

    def match(name: str):
        n = name.strip().lower()
        if n in exact:
            stage["exact"] += 1; return n
        if n in syn and syn[n] in exact:
            stage["synonym"] += 1; return syn[n]
        if singularize(n) in sing:
            stage["singular"] += 1; return sing[singularize(n)]
        ct = norm_tokens(name)
        fs = frozenset(ct)
        if fs in tokset:
            stage["tokenset"] += 1; return tokset[fs]
        # head-noun: the ingredient's identity word, e.g. "red bell peppers" -> "bell pepper" via "pepper"? keep strict: full token subset
        joined = " ".join(ct)
        if joined in exact:
            stage["stripped"] += 1; return joined
        if not PRECISE and len(ct) == 1 and ct[0] in head:
            stage["head"] += 1; return head[ct[0]]
        if not PRECISE:
            close = difflib.get_close_matches(joined, keys, n=1, cutoff=0.88)
            if close:
                stage["fuzzy"] += 1; return close[0]
        stage["miss"] += 1; return None

    pairs_raw, fb_names = [], set()
    with (ROOT / "data/flavor_bible_full.csv").open(encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            a = (r.get("main") or "").strip().lower(); b = (r.get("pairing") or "").strip().lower()
            if a and b:
                pairs_raw.append((a, b)); fb_names.add(a); fb_names.add(b)

    nm_match = {nm: match(nm) for nm in fb_names}
    matched = sum(1 for v in nm_match.values() if v)
    print(f"unique FB names: {len(fb_names)}  matched: {matched} ({100*matched/len(fb_names):.0f}%)")
    print("  stages:", dict(stage))

    # still-missed sample
    misses = [nm for nm, v in nm_match.items() if not v]
    print(f"\n  {len(misses)} misses. Sample (do these look like ingredients we SHOULD have?):")
    for nm in sorted(misses)[:25]:
        print("   -", nm)

    seen, mpairs = set(), []
    for a, b in pairs_raw:
        ma, mb = nm_match.get(a), nm_match.get(b)
        if ma and mb and ma != mb:
            k = tuple(sorted((ma, mb)))
            if k not in seen:
                seen.add(k); mpairs.append((ma, mb))
    print(f"\nmatched unique pairs: {len(mpairs)} (v1 cascade: 5,457; exact-only: 2,330)")

    # Persist the matched graph for the app's pairing layer (FB-PAIR-1).
    # Pairs are canonical-sorted (line 121 `tuple(sorted(...))`), so the
    # on-disk order is order-independent. The app builds a Set<"a|b"> from this.
    out = {"pairs": [list(p) for p in mpairs], "n": len(mpairs),
           "_generated": "scripts/match_flavor_bible_v2.py"}
    out_path = ROOT / "public/proDataset/flavor_bible_matched.json"
    out_path.write_text(json.dumps(out), encoding="utf-8")
    print(f"wrote {len(mpairs)} pairs -> {out_path.relative_to(ROOT)}")

    # re-measure AUROC
    rng = np.random.default_rng(0)

    def feat(a, b):
        u, v = prof[a], prof[b]; return np.concatenate([np.abs(u - v), u * v])
    X = [feat(a, b) for a, b in mpairs]; y = [1] * len(mpairs)
    rp = [(keys[i], keys[j]) for i, j in rng.integers(0, len(keys), (len(mpairs), 2)) if i != j]
    X += [feat(a, b) for a, b in rp]; y += [0] * len(rp)
    X = np.array(X); y = np.array(y)
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.3, random_state=0, stratify=y)
    auc = roc_auc_score(yte, LogisticRegression(max_iter=2000).fit(Xtr, ytr).predict_proba(Xte)[:, 1])
    print(f"\nLearned pairing AUROC: {auc:.3f}  (v1 fuller 0.595; exact-only 0.696)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
