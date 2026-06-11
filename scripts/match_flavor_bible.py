#!/usr/bin/env python3
"""Match Flavor Bible pairing names to our ingredient (gnn_entropy) keys, then
re-measure how well the GNN flavor profiles predict FB pairings on the fuller
matched set.

Cascade: exact -> synonyms.json -> singularize -> token-subset -> fuzzy(difflib).
Reports recovery at each stage; writes the matched FB pair graph to
public/proDataset/flavor_bible_matched.json.
"""
from __future__ import annotations

import csv
import json
import difflib
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[1]
TASKS = ["sweet", "bitter", "umami", "salty", "sour", "odor_fruity",
         "odor_floral", "odor_green", "odor_woody", "odor_spicy", "odor_fatty"]


def singularize(w: str) -> str:
    if w.endswith("ies"):
        return w[:-3] + "y"
    if w.endswith("es") and len(w) > 4:
        return w[:-2]
    if w.endswith("s") and not w.endswith("ss"):
        return w[:-1]
    return w


def main() -> int:
    ent = json.loads((ROOT / "public/proDataset/gnn_entropy.json").read_text(encoding="utf-8"))
    prof = {nm: np.array([e["probs"].get(t, 0.0) for t in TASKS])
            for nm, e in ent.items() if not nm.startswith("_")}
    keys = set(prof)
    keys_sing = {singularize(k): k for k in keys}
    tokenmap: dict[str, str] = {}
    for k in keys:
        tokenmap[" ".join(sorted(singularize(t) for t in k.split()))] = k

    syn = json.loads((ROOT / "proDataset/data/synonyms.json").read_text(encoding="utf-8"))
    syn = {k: v for k, v in syn.items() if not k.startswith("_")}

    cache: dict[str, str | None] = {}
    stage_count = {"exact": 0, "synonym": 0, "singular": 0, "token": 0, "fuzzy": 0, "miss": 0}

    def match(name: str):
        n = name.strip().lower()
        if n in cache:
            return cache[n]
        res = None; stage = "miss"
        if n in keys:
            res, stage = n, "exact"
        elif n in syn and syn[n] in keys:
            res, stage = syn[n], "synonym"
        elif singularize(n) in keys_sing:
            res, stage = keys_sing[singularize(n)], "singular"
        else:
            tok = " ".join(sorted(singularize(t) for t in n.split()))
            if tok in tokenmap:
                res, stage = tokenmap[tok], "token"
            else:
                close = difflib.get_close_matches(n, keys, n=1, cutoff=0.9)
                if close:
                    res, stage = close[0], "fuzzy"
        cache[n] = res
        match._stage = stage  # type: ignore
        return res

    pairs_raw = []
    fb_names = set()
    with (ROOT / "data/flavor_bible_full.csv").open(encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            a = (r.get("main") or "").strip().lower()
            b = (r.get("pairing") or "").strip().lower()
            if a and b:
                pairs_raw.append((a, b)); fb_names.add(a); fb_names.add(b)

    # match each unique name once, count stages
    name_match = {}
    for nm in fb_names:
        res = match(nm)
        stage_count[match._stage] += 1  # type: ignore
        name_match[nm] = res

    matched_pairs = []
    seen = set()
    for a, b in pairs_raw:
        ma, mb = name_match.get(a), name_match.get(b)
        if ma and mb and ma != mb:
            key = tuple(sorted((ma, mb)))
            if key not in seen:
                seen.add(key); matched_pairs.append((ma, mb))

    print(f"unique FB names: {len(fb_names)}  | matched: {sum(1 for v in name_match.values() if v)} "
          f"({100*sum(1 for v in name_match.values() if v)/len(fb_names):.0f}%)")
    print("  by stage:", {k: v for k, v in stage_count.items()})
    print(f"FB pairs: {len(pairs_raw)} raw  -> {len(matched_pairs)} unique matched (both endpoints) "
          f"(was 2,330 before matching)")

    (ROOT / "public/proDataset/flavor_bible_matched.json").write_text(
        json.dumps({"pairs": matched_pairs, "n": len(matched_pairs)}), encoding="utf-8")

    # re-measure: learned classifier (contrast + co-presence) FB pair vs random
    rng = np.random.default_rng(0)
    names = list(keys)

    def feat(a, b):
        u, v = prof[a], prof[b]
        return np.concatenate([np.abs(u - v), u * v])

    X = [feat(a, b) for a, b in matched_pairs]; y = [1] * len(matched_pairs)
    rp = [(names[i], names[j]) for i, j in rng.integers(0, len(names), (len(matched_pairs), 2)) if i != j]
    X += [feat(a, b) for a, b in rp]; y += [0] * len(rp)
    X = np.array(X); y = np.array(y)
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.3, random_state=0, stratify=y)
    clf = LogisticRegression(max_iter=2000).fit(Xtr, ytr)
    auc = roc_auc_score(yte, clf.predict_proba(Xte)[:, 1])
    print(f"\nLearned pairing-classifier AUROC on fuller set: {auc:.3f}  (was 0.696 on 2,330 pairs)")
    print("wrote public/proDataset/flavor_bible_matched.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
