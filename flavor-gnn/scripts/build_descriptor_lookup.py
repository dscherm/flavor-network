"""build_descriptor_lookup.py — emit the curated descriptor → tier-3/leaf lookup.

N1-D2 implementer deliverable. Replaces the ad-hoc substring buckets that
`derive_long_tail.py` (TAG_TO_T3 + DESCRIPTOR_BLOCKLIST) and the odor-label
derivation in `build_compounds.py` (ODOR_CATEGORIES) used to rely on, with a
single explicit, auditable mapping from every frequent `gnn_compounds.json`
descriptor tag to one of three decisions:

  - t3   : the tag denotes a mouthfeel / trigeminal sensation → Tier-3 term
  - leaf : the tag denotes a specific aroma/flavor note → leaf term (normalized)
  - skip : the tag is noise, an off-note, a non-specific intensity word, or a
           taste already captured in Tier-2 → contributes nothing

A descriptor may carry BOTH a t3 term and a leaf term (e.g. menthol → cooling
mouthfeel + "menthol" note). `skip` is encoded as t3=null, leaf=null.

Why this exists (audit finding 2.4, plan.md): the old substring buckets
generated false positives — ambiguous tokens like "warm" (inside
"warm-floral") leaked into the spicy bucket, "mushroom" mapped to woody,
"coconut"/"creamy" mapped to fatty. Each ambiguous token below is given an
explicit decision and an inline rationale rather than a substring guess.

Schema of the emitted JSON (flavor-gnn/curation/descriptor_lookup.json):
    {
      "_meta": {...},
      "descriptors": { "<tag>": {"t3": <str|null>, "leaf": <str|null>}, ... }
    }

Run: python flavor-gnn/scripts/build_descriptor_lookup.py
Idempotent: deterministic, sorted keys; re-running on unchanged source is a
byte-identical write.
"""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GNN_COMPOUNDS = ROOT / "public" / "proDataset" / "gnn_compounds.json"
OUT = ROOT / "flavor-gnn" / "curation" / "descriptor_lookup.json"

# Tier-3 mouthfeel vocabulary actually used by the chef in
# top500_flavor_graph.csv, so derived T3 stays in the chef's voice.
# (smooth tender juicy crisp crunchy warming viscous powdery pungent chewy
#  oily starchy astringent crystalline dry fizzy creamy moist crumbly cooling
#  + waxy/sticky for compound-derived texture.)

# ── T3: descriptor tag → Tier-3 mouthfeel term ──────────────────────────────
T3: dict[str, str] = {
    "waxy": "waxy", "wax": "waxy", "alkane": "waxy", "slightly waxy": "waxy",
    "fat": "oily", "fatty": "oily", "oily": "oily", "oil": "oily",
    "tallow": "oily", "lard": "oily",
    "camphor": "cooling", "menthol": "cooling", "peppermint": "cooling",
    "wintergreen": "cooling", "mint": "cooling", "minty": "cooling",
    "fresh": "cooling",
    "powdery": "powdery",
    "creamy": "creamy", "cream": "creamy", "milky": "creamy",
    "butter": "creamy", "buttery": "creamy",
    "pungent": "pungent",
    "dry": "dry",
    "astringent": "astringent",
    "sticky": "sticky",
}

# ── LEAF: descriptor tag → canonical leaf note (normalized) ─────────────────
LEAF: dict[str, str] = {
    # aroma families
    "herbal": "herbaceous", "herb": "herbaceous",
    "floral": "floral", "flower": "floral", "cananga": "floral",
    "neroli": "floral", "orange blossom": "floral",
    "green": "green", "leafy": "green", "bell": "green", "green pepper": "green",
    "grass": "grassy",
    # specific notes
    "new mown hay": "hay", "tonka": "tonka", "coconut": "coconut",
    "vegetable": "vegetal",
    "peach": "peach", "citrus": "citrus", "onion": "onion", "prune": "prune",
    "fruit": "fruity", "fruity": "fruity", "overripe fruit": "fruity",
    "tutti frutti": "fruity",
    "coffee": "coffee", "nutty": "nutty", "nut": "nutty",
    "cocoa": "cocoa", "chocolate": "chocolate", "banana": "banana",
    "earthy": "earthy", "moss": "earthy",
    "apple": "apple", "apple peel": "apple",
    "rose": "rose", "rose water": "rose",
    "grape": "grape", "apricot": "apricot", "berry": "berry",
    "balsamic": "balsamic", "balsam": "balsamic",
    "malt": "malt", "fermented": "fermented",
    "bready": "bready", "bread": "bready",
    "whiskey": "whiskey", "brandy": "brandy", "wine": "wine",
    "potato": "potato",
    "spicy": "spice", "spice": "spice",
    "vanilla": "vanilla", "pineapple": "pineapple", "cucumber": "cucumber",
    "orange": "orange", "orange peel": "orange",
    "hop_oil": "hop", "bean": "bean",
    "caramellic": "caramel", "caramel": "caramel",
    "lemon": "lemon", "lime": "lime", "mustard": "mustard", "honey": "honey",
    "thyme": "thyme", "grapefruit peel": "grapefruit", "vinegar": "vinegar",
    "woody": "woody", "wood": "woody", "roast": "roasted", "popcorn": "popcorn",
    "cabbage": "cabbage", "garlic": "garlic", "lilac": "lilac",
    "sulfurous": "sulfurous", "sulfur": "sulfurous",
    "hazelnut": "hazelnut", "cinnamon": "cinnamon", "pepper": "pepper",
    "resin": "resinous", "mushroom": "mushroom", "cheesy": "cheesy",
    "cherry": "cherry", "pear": "pear",
    # carry a mouthfeel AND a note
    "sharp": "sharp",
}

# Descriptors that carry both a mouthfeel and a surfaced leaf note.
LEAF.update({"menthol": "menthol", "fresh": "fresh"})

# ── SKIP: explicit no-op decisions, with rationale ──────────────────────────
# Tastes already represented in Tier-2 (no double-count):
SKIP_TASTE = {"sweet", "bitter", "sour", "tart"}
# Non-specific intensity / structure words (carry no flavor identity).
# NB: 'dry' is intentionally NOT here — it is a Tier-3 mouthfeel.
SKIP_GENERIC = {"deep", "mild", "bland", "fragrant", "delicate", "raw",
                "cooked", "brown"}
# Solvent / chemical-fragment noise that floods most compounds.
# NB: 'alkane' is NOT here — it maps to the waxy mouthfeel.
SKIP_NOISE = {"odorless", "ethereal", "alcoholic", "ether", "formyl",
              "solvent"}
# Off-notes / defects — real perceptions but not appetizing leaf labels;
# several are ambiguous tokens the old substring buckets mis-mapped:
SKIP_OFFNOTE = {
    "medical", "medicinal", "terpentine", "gasoline", "musty", "must",
    "soap", "soapy", "phenolic", "fishy", "dusty", "metal", "ammonia",
    "sweaty", "burnt", "warm",  # 'warm' → skip: the audit's canonical
                                # false-positive (leaked into spicy via
                                # "warm-floral"); it is an intensity cue,
                                # not a spice note.
}
SKIP = SKIP_TASTE | SKIP_GENERIC | SKIP_NOISE | SKIP_OFFNOTE


def build_table() -> dict[str, dict[str, str | None]]:
    table: dict[str, dict[str, str | None]] = {}
    keys = set(T3) | set(LEAF) | SKIP
    for tag in sorted(keys):
        table[tag] = {"t3": T3.get(tag), "leaf": LEAF.get(tag)}
    return table


def main() -> None:
    table = build_table()

    # Coverage report against the frequent-descriptor target (N1-D2 #3).
    gc = json.loads(GNN_COMPOUNDS.read_text(encoding="utf-8"))
    ing = Counter()
    for entry in gc.values():
        seen = set()
        for comp in entry.get("top_compounds", []):
            for t in comp.get("tags", []):
                t = (t or "").strip().lower()
                if t:
                    seen.add(t)
        for t in seen:
            ing[t] += 1
    freq = [t for t, c in ing.items() if c >= 10]
    covered = [t for t in freq if t in table]
    missing = [t for t in freq if t not in table]
    pct = len(covered) / len(freq) if freq else 1.0

    doc = {
        "_meta": {
            "purpose": "Curated descriptor (gnn_compounds tag) -> Tier-3 "
                       "mouthfeel / leaf-note decision. skip = both null.",
            "schema": "descriptors[tag] = {t3: str|null, leaf: str|null}",
            "source": "flavor-gnn/scripts/build_descriptor_lookup.py",
            "task": "N1-D2",
            "descriptor_count": len(table),
            "frequent_target_count": len(freq),
            "frequent_covered": len(covered),
            "frequent_coverage_pct": round(pct, 4),
        },
        "descriptors": table,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, indent=2, ensure_ascii=False, sort_keys=False) + "\n",
                   encoding="utf-8")
    print(f"[lookup] wrote {OUT.relative_to(ROOT)}  ({len(table)} descriptors)")
    print(f"[lookup] frequent (>=10 ingredients) coverage: "
          f"{len(covered)}/{len(freq)} = {pct:.1%}")
    if missing:
        print(f"[lookup] UNCOVERED frequent descriptors: {missing}")
    else:
        print("[lookup] all frequent descriptors covered")


if __name__ == "__main__":
    main()
