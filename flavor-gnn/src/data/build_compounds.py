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
from pathlib import Path

import pandas as pd


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _load(name: str) -> dict:
    path = _project_root() / "chemDataset" / "processed" / f"{name}.json"
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


ODOR_CATEGORIES = {
    "fruity": ["fruity", "fruit", "tropical", "apple", "berry", "citrus", "banana", "peach", "pear", "grape", "melon", "cherry", "plum", "lemon", "orange"],
    "floral": ["floral", "rose", "jasmine", "violet", "lavender", "geranium", "lily", "flower"],
    "green": ["green", "fresh", "herbal", "grassy", "leafy", "vegetable", "cucumber", "minty", "tea"],
    "woody": ["woody", "earthy", "balsam", "nutty", "mossy", "mushroom", "cedar", "pine", "resinous", "smoky"],
    "spicy": ["spicy", "pungent", "pepper", "clove", "cinnamon", "anise", "warm", "hot"],
    "fatty": ["fatty", "waxy", "oily", "creamy", "buttery", "cheesy", "milky", "coconut"],
}


def _odor_flags(flavor_tags: list[str]) -> dict[str, int]:
    tags_str = " ".join(t.lower() for t in flavor_tags)
    return {
        f"odor_{cat}": int(any(kw in tags_str for kw in keywords))
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


def build() -> pd.DataFrame:
    flavordb = _load("flavordb")
    chemtastedb = _load("chemtastedb")
    bitterdb = _load("bitterdb")
    supersweetdb = _load("supersweetdb")

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
        # Merge from the taste field
        _merge_labels(r, _taste_flags(m.get("taste")))
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
            # Mark that this compound has an informed profile — the 0s are
            # real negatives, not missing data. Downstream can use this.
            r["has_profile"] = 1
        r["flavor_tags"] = sorted(set(r["flavor_tags"]) | set(flavor_tags))
        if m.get("odor") and not r["odor_class"]:
            r["odor_class"] = str(m["odor"]).split(",")[0].strip().lower() or None
        if not r["odor_class"] and flavor_tags:
            r["odor_class"] = flavor_tags[0]
        r["functional_groups"] = sorted(set(r["functional_groups"]) | set(m.get("functional_groups") or []))

    # ChemTasteDB — multi-label taste (string)
    for _, c in chemtastedb.get("compounds", {}).items():
        r = _row(None, c.get("smiles"), inchi_key=c.get("inchikey"), cas=c.get("cas"))
        if r is None:
            continue
        _merge_labels(r, _taste_flags(c.get("taste")))

    # BitterDB — every compound is bitter=1 by membership
    for _, c in bitterdb.get("compounds", {}).items():
        pid = c.get("pubchem_id")
        smiles = c.get("smiles") or c.get("isomeric_smiles")
        r = _row(pid, smiles, inchi_key=c.get("inchi_key"), cas=c.get("cas"))
        if r is None:
            continue
        r["bitter"] = 1

    # SuperSweetDB (ChemTasteDB sweet fallback) — sweet=1 by membership
    for _, c in supersweetdb.get("compounds", {}).items():
        r = _row(None, c.get("smiles"))
        if r is None:
            continue
        r["sweet"] = 1
        if c.get("intensity") is not None and r["intensity"] is None:
            r["intensity"] = c["intensity"]

    df = pd.DataFrame(list(compounds.values()))
    df = df.dropna(subset=["smiles"])
    df = df.drop_duplicates(subset=["smiles"])
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
