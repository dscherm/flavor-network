"""M0 data join — unify chemDataset sources into compounds.parquet.

Joins FlavorDB, ChemTasteDB, BitterDB, and SuperSweetDB on pubchem_id when
available, falling back to canonical SMILES. Produces a multi-label table
suitable for the M1 Random Forest baseline and downstream GNN training.

Output columns:
    pubchem_id   : int (nullable — rows without a pubchem id are keyed by smiles)
    smiles       : str
    inchi_key    : str | None
    cas          : str | None
    sweet        : 0/1 — ChemTasteDB sweet-containing OR SuperSweetDB member
    bitter       : 0/1 — ChemTasteDB bitter-containing OR BitterDB member
    umami        : 0/1 — ChemTasteDB umami
    salty        : 0/1 — ChemTasteDB salty
    sour         : 0/1 — ChemTasteDB sour-containing
    odor_class   : str | None — FlavorDB primary odor descriptor (first token)
    flavor_tags  : list[str] — FlavorDB flavor_profile tokens
    functional_groups : list[str]
    intensity    : float | None — SuperSweetDB relative sweetness (currently None)

Usage:
    python -m src.data.build_compounds [--out flavor-gnn/data/compounds.parquet]

Any compound without SMILES is dropped. Conflicts are resolved as logical OR
across multi-label columns (see CLAUDE.md: multi-label is intentional).
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import pandas as pd


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _load(name: str) -> dict:
    path = _project_root() / "chemDataset" / "processed" / f"{name}.json"
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


# P1c (GNN-LIFT, audit Finding 2.4): curated descriptor->odor-head lookup.
# Two de-noising changes vs the original substring buckets:
#   1. Matching is WORD-BOUNDARY (see _odor_flags), not substring — "warm"
#      no longer fires inside "warmth"/"warm-sweet" etc.
#   2. Ambiguous tokens that generated cross-head false positives are REMOVED
#      (mapped to skip). Each removal + reason is listed in _ODOR_SKIPPED below.
# Rationale: the research found de-noising existing positives is multiplicative
# for the weak odor heads (floral/spicy/fatty), where ingesting new labels
# (DREAM) fell below the noise floor.
ODOR_CATEGORIES = {
    "fruity": ["fruity", "fruit", "tropical", "apple", "berry", "citrus", "banana", "peach", "pear", "grape", "melon", "cherry", "plum", "lemon", "orange"],
    "floral": ["floral", "rose", "jasmine", "violet", "lavender", "geranium", "lily", "flower"],
    "green": ["green", "herbal", "grassy", "leafy", "vegetable", "cucumber", "minty"],
    # woody = resinous/earthy/piney. nutty was pulled out into its own head
    # (the Maillard/roast cluster — see "nutty" below) because our FlavorDB
    # labels conflated it with woody while Leffingwell keeps them ~86% disjoint.
    # mushroom stays here (earthy-fungal); its Leffingwell descriptor is mapped
    # into woody on ingestion so both sources agree on the woody boundary.
    "woody": ["woody", "earthy", "balsam", "mossy", "cedar", "pine", "resinous", "smoky", "mushroom"],
    "spicy": ["spicy", "pungent", "pepper", "clove", "cinnamon", "anise"],
    "fatty": ["fatty", "waxy", "oily", "buttery", "cheesy", "milky"],
    # nutty = Maillard/roast cluster, kept distinct from woody (Leffingwell
    # taxonomy treats nutty/roasted as separate from woody). Tight keyword set.
    "nutty": ["nutty", "almond", "hazelnut", "walnut", "peanut", "cocoa", "coffee", "roasted", "roast"],
}

# Ambiguous tokens removed from the buckets above, with why. Kept as a record
# so the de-noise is auditable / reversible.
_ODOR_SKIPPED = {
    "fresh": "too generic — appears across many unrelated descriptors (was green)",
    "tea": "more often floral than green (was green)",
    "warm": "fires inside warm-sweet/warm-floral, not a spice signal (was spicy)",
    "hot": "too generic / temperature, not reliably spicy (was spicy)",
    "creamy": "dessert-sweet texture, not waxy/fatty (was fatty)",
    "coconut": "tropical-sweet, not waxy/fatty (was fatty)",
}


TASTE_TASKS = ("sweet", "bitter", "umami", "salty", "sour")
ODOR_TASKS = ("odor_fruity", "odor_floral", "odor_green", "odor_woody",
              "odor_spicy", "odor_fatty", "odor_nutty")
ALL_TASKS = TASTE_TASKS + ODOR_TASKS


def _obs(r: dict, tasks) -> None:
    """Mark these tasks as observed (informed) for this row.

    A task is "observed" iff some source provided either a positive or a
    negative signal for it. Unobserved tasks are masked out of the loss
    in train_multitask.py so the model isn't trained on default-zero
    labels from sources that don't measure that modality (e.g. FartDB
    has zero odor signal — its rows must not poison odor heads with
    forced negatives).
    """
    for t in tasks:
        r[f"mask_{t}"] = 1


def _odor_flags(flavor_tags: list[str]) -> dict[str, int]:
    # Word-boundary match (P1c): a keyword fires only as a whole token, so
    # "warm" no longer matches inside "warmth" and "pear" no longer matches
    # inside "appears". Non-alpha separators (space, hyphen, slash) are token
    # boundaries, so phrase descriptors like "warm-sweet" tokenize cleanly.
    tags_str = " ".join(t.lower() for t in flavor_tags)
    return {
        f"odor_{cat}": int(any(
            re.search(r"\b" + re.escape(kw) + r"\b", tags_str) for kw in keywords
        ))
        for cat, keywords in ODOR_CATEGORIES.items()
    }


def _taste_flags(taste: str | None) -> dict[str, int]:
    t = (taste or "").lower()
    return {
        "sweet": int("sweet" in t and "non-sweet" not in t),
        "bitter": int("bitter" in t),
        "umami": int("umami" in t),
        "salty": int("salty" in t),
        "sour": int("sour" in t),
    }


def _merge_labels(row: dict, update: dict) -> None:
    for k in ("sweet", "bitter", "umami", "salty", "sour"):
        if k in update:
            row[k] = row.get(k, 0) | int(update[k])


def _load_optional(name: str) -> dict:
    """Load a processed source, return empty dict if missing (for new sources
    that haven't been scraped yet — FlavorNet + pubchem_smiles fall here)."""
    try:
        return _load(name)
    except FileNotFoundError:
        print(f"[M0] skipping optional source: {name}.json not present")
        return {}


def build() -> pd.DataFrame:
    flavordb = _load("flavordb")
    chemtastedb = _load("chemtastedb")
    bitterdb = _load("bitterdb")
    supersweetdb = _load("supersweetdb")
    flavornet = _load_optional("flavornet")
    pubchem_smiles = _load_optional("pubchem_smiles")
    fartdb = _load_optional("fartdb")

    # DREAM (Keller & Vosshall 2016) is gated OFF by default — N2-GNN-DREAM
    # 2026-05-26 retrain produced net-neutral results (only odor_spicy
    # lifted; AC required ≥4 of 5 mapped odor heads). See chemDataset-
    # status.md negative-finding entry. The fetcher + processed JSON
    # remain in the repo so a future revisit can flip this flag and
    # iterate on threshold / mapping. To re-enable, set INCLUDE_DREAM=True
    # and re-run training (cv_results_dream.json holds the prior attempt).
    INCLUDE_DREAM = False
    dreamdb = _load_optional("dream") if INCLUDE_DREAM else {}

    compounds: dict[str, dict] = {}

    def _key(pubchem_id, smiles) -> str | None:
        if pubchem_id:
            return f"pcid:{pubchem_id}"
        if smiles:
            return f"smi:{smiles}"
        return None

    def _row(pubchem_id, smiles, inchi_key=None, cas=None) -> dict | None:
        k = _key(pubchem_id, smiles)
        if k is None:
            return None
        if k not in compounds:
            compounds[k] = {
                "pubchem_id": int(pubchem_id) if pubchem_id else None,
                "smiles": smiles,
                "inchi_key": inchi_key,
                "cas": cas,
                "sweet": 0, "bitter": 0, "umami": 0, "salty": 0, "sour": 0,
                "odor_class": None,
                "flavor_tags": [],
                "functional_groups": [],
                "intensity": None,
                "has_profile": 0,
                "odor_fruity": 0, "odor_floral": 0, "odor_green": 0,
                "odor_woody": 0, "odor_spicy": 0, "odor_fatty": 0,
                "odor_nutty": 0,
                # mask=0 means "label is unknown for this row" — task is
                # excluded from the loss. Each source block flips relevant
                # masks to 1 when it contributes evidence.
                **{f"mask_{t}": 0 for t in ALL_TASKS},
            }
        else:
            r = compounds[k]
            if not r["inchi_key"] and inchi_key: r["inchi_key"] = inchi_key
            if not r["cas"] and cas: r["cas"] = cas
        return compounds[k]

    # FlavorDB — SMILES + flavor_profile (taste/odor) + functional groups
    # Two sources of taste signal: (a) the `taste` field (223 mols), and
    # (b) the `flavor_profile` array (1499 mols). Profile tokens like "sweet",
    # "bitter" are direct taste evidence. Molecules WITH a non-empty profile
    # that DON'T mention a taste are soft negatives for that taste — their
    # existing 0 values are informed rather than absent.
    for pid, m in flavordb.get("molecules", {}).items():
        r = _row(pid, m.get("smiles"), cas=m.get("cas_id"))
        if r is None:
            continue
        # Merge from the taste field — only when present, so absent rows
        # don't pretend to be informed negatives.
        if m.get("taste"):
            _merge_labels(r, _taste_flags(m.get("taste")))
            _obs(r, TASTE_TASKS)
        # Also derive taste labels from flavor_profile tokens
        flavor_tags = m.get("flavor_profile") or []
        if flavor_tags:
            profile_str = " ".join(flavor_tags).lower()
            profile_taste = {
                "sweet": int("sweet" in profile_str),
                "bitter": int("bitter" in profile_str),
                "umami": int("umami" in profile_str or "savory" in profile_str or "meaty" in profile_str),
                "salty": int("salty" in profile_str or "briny" in profile_str),
                "sour": int("sour" in profile_str or "acidic" in profile_str or "tart" in profile_str),
            }
            _merge_labels(r, profile_taste)
            # Odor categories from profile tags
            odor = _odor_flags(flavor_tags)
            for k, v in odor.items():
                r[k] = r.get(k, 0) | v
            # FlavorDB profile is comprehensive — both taste and odor tokens
            # are present in flavor_tags, so a compound with a profile is
            # informed for every taste AND every odor head.
            _obs(r, ALL_TASKS)
            r["has_profile"] = 1
        r["flavor_tags"] = sorted(set(r["flavor_tags"]) | set(flavor_tags))
        if m.get("odor") and not r["odor_class"]:
            r["odor_class"] = str(m["odor"]).split(",")[0].strip().lower() or None
        if not r["odor_class"] and flavor_tags:
            r["odor_class"] = flavor_tags[0]
        r["functional_groups"] = sorted(set(r["functional_groups"]) | set(m.get("functional_groups") or []))

    # ChemTasteDB — multi-label taste (string). Every row is taste-informed
    # across all 5 taste heads (the database explicitly assigns a Class taste,
    # so absence of e.g. "umami" in the row is a real negative).
    for _, c in chemtastedb.get("compounds", {}).items():
        r = _row(None, c.get("smiles"), inchi_key=c.get("inchikey"), cas=c.get("cas"))
        if r is None:
            continue
        _merge_labels(r, _taste_flags(c.get("taste")))
        _obs(r, TASTE_TASKS)

    # BitterDB — every compound is bitter=1 by membership. BitterDB ONLY
    # measures TAS2R agonism, so we observe bitter but learn nothing about
    # the other tastes/odors from this source.
    for _, c in bitterdb.get("compounds", {}).items():
        pid = c.get("pubchem_id")
        smiles = c.get("smiles") or c.get("isomeric_smiles")
        r = _row(pid, smiles, inchi_key=c.get("inchi_key"), cas=c.get("cas"))
        if r is None:
            continue
        r["bitter"] = 1
        r["mask_bitter"] = 1

    # SuperSweetDB — sweet=1 by membership. Same as BitterDB: this source
    # only measures sweet, so we don't claim to observe other heads.
    for _, c in supersweetdb.get("compounds", {}).items():
        r = _row(None, c.get("smiles"))
        if r is None:
            continue
        r["sweet"] = 1
        r["mask_sweet"] = 1
        if c.get("intensity") is not None and r["intensity"] is None:
            r["intensity"] = c["intensity"]

    # FartDB (NPJ Sci. Food 2025) — 14.5k SMILES with single canonical taste.
    # Headline contribution: ~1,513 sour positives sourced from IUPAC pKa data
    # (~30x expansion vs ChemTasteDB v2.1's 49 sour rows). FART measures only
    # taste — its rows MUST NOT mask in odor heads or the model learns
    # "FART-like compounds have no odor", which is wrong.
    #
    # Each FART row has ONE canonical taste label. We only mask the specific
    # task that label informs. A row labeled "sweet" doesn't mean the
    # compound was tested for bitter and found negative — FART's classifier
    # picks a single taste; bitter=0 for that row is missing data, not
    # evidence. Masking all 5 tastes on every FART row caused the v2
    # bitter regression (-0.20 calibrated F1): FART's 9.5k artificial-
    # sweetener rows acted as confident bitter-negatives and pulled the
    # decision boundary off-distribution from food chemistry. "undefined"
    # rows are the exception: confirmed-not-tasty across the four GPCR-
    # mediated tastes; salty stays unobserved (FART excludes salty by
    # design — its negative signal is unreliable).
    FART_LABEL_TO_OBS = {
        "sweet":     ("sweet",),
        "bitter":    ("bitter",),
        "sour":      ("sour",),
        "umami":     ("umami",),
        "undefined": ("sweet", "bitter", "sour", "umami"),
    }
    for _, c in fartdb.get("compounds", {}).items():
        r = _row(None, c.get("smiles"))
        if r is None:
            continue
        _merge_labels(r, _taste_flags(c.get("taste")))
        label = (c.get("class_taste") or c.get("taste") or "").strip().lower()
        # Multi-merged rows ("sweet; bitter") observe both — split & dispatch.
        for tok in (label.split(";") if label else []):
            tok = tok.strip()
            if tok in FART_LABEL_TO_OBS:
                _obs(r, FART_LABEL_TO_OBS[tok])

    # FlavorNet — CAS-keyed aroma compounds. No taste labels, but odor
    # descriptors populate the odor_* category flags via the same keyword
    # bucketing used for FlavorDB. SMILES comes from the PubChem CAS lookup.
    cas_smiles = (pubchem_smiles or {}).get("cas", {})
    for cas, entry in (flavornet.get("compounds", {}) if flavornet else {}).items():
        resolved = cas_smiles.get(cas)
        smiles = resolved.get("smiles") if resolved else None
        if not smiles:
            continue
        r = _row(resolved.get("cid"), smiles,
                 inchi_key=resolved.get("inchikey"), cas=cas)
        if r is None:
            continue
        descriptor = (entry.get("descriptor") or "").lower()
        if descriptor:
            tag = descriptor.split(",")[0].strip()
            r["flavor_tags"] = sorted(set(r["flavor_tags"]) | {tag})
            if not r["odor_class"]:
                r["odor_class"] = tag
            odor = _odor_flags([descriptor])
            for k, v in odor.items():
                r[k] = r.get(k, 0) | v
            # FlavorNet is pure aroma — Arn & Acree's compendium only catalogs
            # odor descriptors, not taste. Earlier code marked these rows as
            # taste-informed; that was wrong (a compound with no taste data
            # is unknown for taste, not negative-for-every-taste). Mask in
            # only the odor heads.
            _obs(r, ODOR_TASKS)
            r["has_profile"] = 1

    # DREAM Olfaction Challenge (Keller & Vosshall 2016) — 417 compounds
    # rated 0-100 on 21 olfactory descriptors by 55 subjects. Only the
    # five aroma descriptors map to our odor heads: FRUIT, FLOWER, GRASS,
    # WOOD, SPICES → odor_fruity, odor_floral, odor_green, odor_woody,
    # odor_spicy. Each compound's mean rating ≥ POSITIVE_THRESHOLD
    # (set in 09-fetch-dream.js, default 30) becomes a positive;
    # sub-threshold means a real negative because every DREAM compound
    # was rated on every descriptor by the full subject pool.
    #
    # SWEET/SOUR/ACID descriptors are intentionally NOT used — they're
    # olfactory perception ratings ("smells sweet/sour/acidic"), not
    # taste signals. Mapping them to our taste heads in v1 regressed
    # sweet/bitter/sour calibrated F1 (see chemDataset-status.md
    # negative-finding entry). odor_fatty has no DREAM analogue and
    # stays unmasked. bitter, umami, salty get no signal from DREAM.
    DREAM_OBS = ("odor_fruity", "odor_floral", "odor_green",
                 "odor_woody", "odor_spicy")
    for _, c in (dreamdb.get("compounds", {}) if dreamdb else {}).items():
        smiles = c.get("smiles")
        if not smiles:
            continue
        r = _row(c.get("cid"), smiles)
        if r is None:
            continue
        labels = c.get("labels") or {}
        for head in DREAM_OBS:
            if head in labels:
                r[head] = r.get(head, 0) | int(labels[head])
        _obs(r, DREAM_OBS)

    df = pd.DataFrame(list(compounds.values()))
    df = df.dropna(subset=["smiles"])
    df = df.drop_duplicates(subset=["smiles"])
    # CAS arrives as a mix of strings ("517-28-2"), placeholders ("*"), and
    # occasional ints (some upstream rows store the leading digits as numeric).
    # Coerce to nullable string so pyarrow can serialize the column.
    df["cas"] = df["cas"].apply(lambda x: None if x is None or x == "*" else str(x))
    return df


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--out",
        default=str(_project_root() / "flavor-gnn" / "data" / "compounds.parquet"),
    )
    args = parser.parse_args()

    df = build()
    print(f"[M0] joined {len(df)} unique compounds")
    for col in ("sweet", "bitter", "umami", "salty", "sour"):
        print(f"       {col:6s}: {int(df[col].sum())}")
    print(f"       with_odor_class: {int(df['odor_class'].notna().sum())}")

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out_path, index=False)
    print(f"[M0] wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
