"""Generate AI-drafted Tier-1/2/3 proposals for the empty rows in the
top-500 chef-curation CSV.

N2-V3-CHEF-LIFT support tool. The chef-user CSV at
`flavor-gnn/curation/top500_flavor_graph.csv` currently has 209 chef-
verified rows out of 500 top-pairing-count slots. To close the
gap, the chef needs to fill ~290 more rows — each row takes minutes
when starting from a blank slate.

This script accelerates the workflow by emitting `draft_proposals.csv`
with AI-pre-filled drafts the chef reviews / edits / accepts. The
proposals are explicitly LOW-CONFIDENCE first-passes, never written
into the chef CSV automatically — the chef pastes accepted rows.

Method
------
For each top-pairing ingredient NOT yet in the chef CSV:

  1. tier1_aroma — primary aroma head per resolvePrimaryTier1 logic
     (chef overrides + allium → green + surplus-ratio tie-break across
     fruity/floral/green/woody/fatty). Only filled when the head
     fires above its calibrated ingredient_profile_threshold. Empty
     when no head fires (chef decides).

  2. tier2_taste — GNN taste prediction. Heads firing above their
     calibrated ingredient threshold; multiple heads joined with '|'
     to match the chef CSV format (e.g. "sweet|umami"). Salty heads
     are excluded (mol F1 < 0.4 production gate).

  3. tier3_mouthfeel — coarse name-keyword heuristic:
        oil / butter / fat → 'oily'
        powder → 'powdery'
        leaf / herb → 'crisp'
        bean / nut → 'crunchy'
        liquid / milk / sauce / juice → 'smooth'
        crystal / sugar / salt → 'crystalline'
        meat / fish / chicken → 'tender'
        ...else blank (chef decides — this is the weakest head)

  4. leaves — FlavorDB flavor_profile tags for the molecularly-matched
     food, capped at 7 entries, joined with '|'. Only filled when the
     ingredient name resolves to a FlavorDB entity via fuzzy match.

  5. sources — pre-filled to "ai-draft;<provenance>" so re-runs of the
     chef CSV scaffold can distinguish drafts from manual entries via
     the existing manual-column gate. Chef edits the sources to
     "manual-top-500;tgsc" on acceptance to mark the row as their own.

  6. key_pairings — top-7 highest-strength pairings from pairings.json,
     joined with '|'. Mechanical pull, chef-friendly.

  7. pairing_principles, chemistry_notes — left blank. These require
     chef chemistry reasoning that the model can't fake reliably.

Output
------
`flavor-gnn/curation/draft_proposals.csv`

The chef reviews each row, edits in-place, accepts by pasting into
top500_flavor_graph.csv with sources flipped to "manual-top-500;tgsc"
(or similar). Rejected rows are simply not pasted. The next scaffold
re-run preserves the chef's pasted rows verbatim.

Usage
-----
    python -m scripts.propose_chef_drafts
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path
from typing import Dict, List

ROOT = Path(__file__).resolve().parents[2]


AROMA_AXES = ["fruity", "floral", "green", "woody", "fatty"]
TASTE_HEADS_PRODUCTION = ("sweet", "bitter", "umami", "sour")  # salty disabled by N2-AGG-RECAL

# Same overrides + allium map as src/data/tier1Overrides.js. Kept in
# sync by convention — when one updates, run both.
TIER1_OVERRIDES = {
    "truffle": "woody", "truffle oil": "woody", "beetroot": "woody",
    "rhubarb": "fruity", "cranberry": "fruity",
    "cranberry sauce": "fruity", "cranberry jelly": "fruity",
    "cranberry juice": "fruity", "cranberry juice cocktail": "fruity",
    "cranberry juice concentrate": "fruity",
    "cranberry-orange relish": "fruity",
    "cranberry-raspberry juice": "fruity",
    "cranberry-apple juice": "fruity",
    "cranberry cocktail": "fruity",
    "fluid cranberry juice": "fruity",
    "cranberry bean": "fruity",
    "chardonnay wine": "fruity",
    "goat's milk": "fatty",
}
ALLIUM_RE = re.compile(
    r"\b(shallot|scallion|chive|garlic|onion|leek|asafoetida|ramp)\b", re.I)


# Crude name-keyword mouthfeel heuristic. Ordered so longer specific
# matches beat shorter generic ones.
MOUTHFEEL_KEYWORDS = [
    ("oil", "oily"),
    ("butter", "oily"),
    ("fat ", "oily"),
    ("powder", "powdery"),
    ("flour", "powdery"),
    ("crystal", "crystalline"),
    ("sugar", "crystalline"),
    ("salt", "crystalline"),
    ("juice", "smooth"),
    ("milk", "smooth"),
    ("sauce", "smooth"),
    ("syrup", "viscous"),
    ("honey", "viscous"),
    ("paste", "viscous"),
    ("cream", "smooth"),
    ("yogurt", "smooth"),
    ("leaf", "crisp"),
    ("herb", "crisp"),
    ("greens", "crisp"),
    ("bean", "crunchy"),
    ("nut", "crunchy"),
    ("seed", "crunchy"),
    ("meat", "tender"),
    ("chicken", "tender"),
    ("fish", "tender"),
    ("beef", "tender"),
    ("pork", "tender"),
    ("shrimp", "tender"),
    ("cheese", "smooth"),
    ("apple", "crisp"),
    ("pear", "crisp"),
    ("berry", "juicy"),
    ("fruit", "juicy"),
    ("citrus", "juicy"),
    ("orange", "juicy"),
    ("lemon", "juicy"),
    ("squash", "tender"),
]


def _norm(s: str | None) -> str:
    if not s:
        return ""
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def _load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _ranked_top_n(ingredients: dict, pairings: list, top_n: int) -> List[str]:
    valid = set(ingredients.keys())
    counts: Counter = Counter()
    for pair in pairings:
        a = pair.get("ingredientA")
        b = pair.get("ingredientB")
        if a in valid and b in valid:
            counts[a] += 1
            counts[b] += 1
    return sorted(valid, key=lambda n: (-counts.get(n, 0), n))[:top_n]


def _existing_chef_names(csv_path: Path) -> set:
    if not csv_path.exists():
        return set()
    with csv_path.open("r", encoding="utf-8", newline="") as fh:
        rd = csv.DictReader(fh)
        return {r["name"] for r in rd if (r.get("tier1_aroma") or "").strip()}


def _tier1_pick(name: str, probs: dict, thresholds: dict) -> str:
    norm = (name or "").lower().replace("  ", " ").strip()
    if norm in TIER1_OVERRIDES:
        return TIER1_OVERRIDES[norm]
    # Allium override → green when green fires
    if ALLIUM_RE.search(norm):
        g_p = probs.get("odor_green", 0)
        g_t = thresholds.get("green", 1.0)
        if g_t > 0 and g_p >= g_t:
            return "green"
    # Surplus-ratio tie-break across 5 aroma heads
    above = []
    for axis in AROMA_AXES:
        p = probs.get(f"odor_{axis}")
        t = thresholds.get(axis)
        if (isinstance(p, (int, float))
                and isinstance(t, (int, float)) and t > 0 and p >= t):
            above.append((axis, (p - t) / t))
    if not above:
        return ""
    above.sort(key=lambda x: (-x[1], AROMA_AXES.index(x[0])))
    return above[0][0]


def _tier2_picks(probs: dict, thresholds: dict) -> str:
    """Return pipe-joined taste heads firing above their thresholds."""
    fires = []
    for taste in TASTE_HEADS_PRODUCTION:
        p = probs.get(taste)
        t = thresholds.get(taste)
        if (isinstance(p, (int, float))
                and isinstance(t, (int, float)) and t > 0 and t < 1.0 and p >= t):
            fires.append((taste, p))
    fires.sort(key=lambda x: -x[1])
    return "|".join(t for t, _ in fires[:3])


def _tier3_mouthfeel(name: str) -> str:
    low = name.lower()
    for kw, mf in MOUTHFEEL_KEYWORDS:
        if kw in low:
            return mf
    return ""


def _leaves_from_flavordb(name: str, flavordb_tags: dict) -> str:
    key = _norm(name)
    if key in flavordb_tags:
        tags = flavordb_tags[key]
        # de-dup, cap at 7
        seen, out = set(), []
        for t in tags:
            tn = (t or "").strip().lower()
            if tn and tn not in seen:
                seen.add(tn)
                out.append(tn)
            if len(out) >= 7:
                break
        return "|".join(out)
    return ""


def _flavordb_tags_index(flavordb: dict) -> dict:
    out = {}
    for _, mol in (flavordb.get("molecules", {}) or {}).items():
        nm = mol.get("name")
        if not nm:
            continue
        profile = mol.get("flavor_profile") or []
        if profile:
            out.setdefault(_norm(nm), []).extend(profile)
    for ent_alias, ent in (flavordb.get("entities", {}) or {}).items():
        out.setdefault(_norm(ent_alias), [])
        for pid in ent.get("molecules", []):
            mol = (flavordb.get("molecules", {}) or {}).get(str(pid))
            if mol:
                out[_norm(ent_alias)].extend(mol.get("flavor_profile") or [])
    return out


def _top_pairings(name: str, pairings_by_name: dict, top_k: int = 7) -> str:
    pairs = pairings_by_name.get(name) or []
    pairs = sorted(pairs, key=lambda p: -p["strength"])[:top_k]
    return "|".join(p["other"] for p in pairs)


def _build_pairings_index(pairings: list) -> dict:
    out: Dict[str, List[dict]] = {}
    for pair in pairings:
        a = pair.get("ingredientA")
        b = pair.get("ingredientB")
        s = pair.get("strength", 0)
        if a and b:
            out.setdefault(a, []).append({"other": b, "strength": s})
            out.setdefault(b, []).append({"other": a, "strength": s})
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--top-n", type=int, default=500)
    parser.add_argument(
        "--out",
        default=str(ROOT / "flavor-gnn" / "curation" / "draft_proposals.csv"),
    )
    args = parser.parse_args()

    ingredients = {
        k: v for k, v in _load_json(
            ROOT / "public" / "proDataset" / "ingredients.json"
        ).items() if not k.startswith("_")
    }
    pairings = _load_json(ROOT / "public" / "proDataset" / "pairings.json")
    entropy = _load_json(ROOT / "public" / "proDataset" / "gnn_entropy.json")
    thr_doc = _load_json(
        ROOT / "public" / "proDataset" / "ingredient_profile_thresholds.json")
    flavordb = {}
    try:
        flavordb = _load_json(
            ROOT / "chemDataset" / "processed" / "flavordb.json")
    except FileNotFoundError:
        print("[chef-drafts] WARN: flavordb.json not present — leaves column will be blank")

    # Thresholds: split into aroma + taste keyed maps
    aroma_thr = {}
    taste_thr = {}
    for entry in thr_doc.get("per_task", []):
        task = entry["task"]
        v = entry["ingredient_threshold"]
        if task.startswith("odor_"):
            aroma_thr[task[len("odor_"):]] = v
        else:
            taste_thr[task] = v

    flavordb_tags = _flavordb_tags_index(flavordb)
    pairings_index = _build_pairings_index(pairings)
    top_names = _ranked_top_n(ingredients, pairings, args.top_n)
    chef_filled = _existing_chef_names(
        ROOT / "flavor-gnn" / "curation" / "top500_flavor_graph.csv")
    candidates = [n for n in top_names if n not in chef_filled]

    print(
        f"[chef-drafts] top_n={args.top_n}  chef_filled={len(chef_filled)}  "
        f"candidates={len(candidates)}"
    )

    rows = []
    counts = {"t1_filled": 0, "t2_filled": 0, "t3_filled": 0,
              "leaves_filled": 0, "pairings_filled": 0}
    for name in candidates:
        ent = (entropy or {}).get(name, {})
        probs = ent.get("probs", {}) if isinstance(ent, dict) else {}
        t1 = _tier1_pick(name, probs, aroma_thr)
        t2 = _tier2_picks(probs, taste_thr)
        t3 = _tier3_mouthfeel(name)
        leaves = _leaves_from_flavordb(name, flavordb_tags)
        pairings_col = _top_pairings(name, pairings_index)
        if t1: counts["t1_filled"] += 1
        if t2: counts["t2_filled"] += 1
        if t3: counts["t3_filled"] += 1
        if leaves: counts["leaves_filled"] += 1
        if pairings_col: counts["pairings_filled"] += 1
        rows.append({
            "name": name,
            "tier1_aroma": t1,
            "tier2_taste": t2,
            "tier3_mouthfeel": t3,
            "leaves": leaves,
            "sources": "ai-draft;gnn-v3+flavordb",
            "key_pairings": pairings_col,
            "pairing_principles": "",
            "chemistry_notes": "",
        })

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cols = ["name", "tier1_aroma", "tier2_taste", "tier3_mouthfeel",
            "leaves", "sources", "key_pairings",
            "pairing_principles", "chemistry_notes"]
    with out_path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    print(f"[chef-drafts] wrote {out_path} — {len(rows)} draft rows")
    print(f"[chef-drafts] fill rates:")
    for k, v in counts.items():
        pct = 100.0 * v / max(1, len(rows))
        print(f"             {k:18s} {v:4d}/{len(rows)} ({pct:.0f}%)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
