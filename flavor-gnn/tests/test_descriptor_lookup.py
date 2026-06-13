"""Tests for the N1-D2 curated descriptor lookup + tier-3/leaf derivation.

Covers the three acceptance-relevant pure-logic surfaces:
  - descriptor_lookup.json coverage of frequent descriptors (#3)
  - skip / t3 / leaf decisions, incl. audit-flagged ambiguous tokens
  - leaf derivation normalization + noise removal
"""
import json
from collections import Counter
from pathlib import Path

import importlib.util

ROOT = Path(__file__).resolve().parents[2]
LOOKUP = ROOT / "flavor-gnn" / "curation" / "descriptor_lookup.json"
GNN_COMPOUNDS = ROOT / "public" / "proDataset" / "gnn_compounds.json"


def _load_module(name, relpath):
    spec = importlib.util.spec_from_file_location(name, ROOT / relpath)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _lookup():
    return json.loads(LOOKUP.read_text(encoding="utf-8"))["descriptors"]


def test_lookup_exists_and_well_formed():
    doc = json.loads(LOOKUP.read_text(encoding="utf-8"))
    assert "descriptors" in doc and doc["descriptors"]
    for tag, d in doc["descriptors"].items():
        assert set(d) == {"t3", "leaf"}, f"{tag} has unexpected keys {set(d)}"
        assert d["t3"] is None or isinstance(d["t3"], str)
        assert d["leaf"] is None or isinstance(d["leaf"], str)


def test_frequent_descriptor_coverage_at_least_90pct():
    """Acceptance #3: lookup covers >=90% of descriptors in >=10 ingredients."""
    gc = json.loads(GNN_COMPOUNDS.read_text(encoding="utf-8"))
    ing = Counter()
    for entry in gc.values():
        seen = {(t or "").strip().lower()
                for c in entry.get("top_compounds", [])
                for t in c.get("tags", []) if (t or "").strip()}
        for t in seen:
            ing[t] += 1
    freq = [t for t, c in ing.items() if c >= 10]
    table = _lookup()
    covered = sum(1 for t in freq if t in table)
    assert covered / len(freq) >= 0.90, (
        f"only {covered}/{len(freq)} frequent descriptors covered")


def test_tastes_and_noise_are_skipped():
    table = _lookup()
    for skip_tag in ("sweet", "bitter", "sour", "odorless", "ethereal",
                     "alcoholic"):
        assert table[skip_tag] == {"t3": None, "leaf": None}, (
            f"{skip_tag} should be a skip decision")


def test_ambiguous_tokens_do_not_false_map():
    """Audit finding 2.4 regression guards."""
    table = _lookup()
    # 'warm' leaked into the spicy bucket via "warm-floral" — must be skip.
    assert table["warm"] == {"t3": None, "leaf": None}
    # 'mushroom' was mis-mapped to woody — must be its own leaf, never woody.
    assert table["mushroom"]["leaf"] == "mushroom"
    assert table["mushroom"]["t3"] is None
    # 'coconut'/'creamy' were mis-mapped to fatty — coconut is a leaf note,
    # creamy is the mouthfeel (not the 'oily'/fatty bucket).
    assert table["coconut"]["leaf"] == "coconut"
    assert table["creamy"]["t3"] == "creamy"


def test_leaf_derivation_normalizes_and_drops_noise():
    mod = _load_module("derive_long_tail",
                       "flavor-gnn/scripts/derive_long_tail.py")
    entry = {"top_compounds": [
        {"tags": ["fruit", "ethereal", "alcoholic", "apple peel", "waxy"]},
        {"tags": ["fruity", "sweet", "apple"]},
    ]}
    leaves = mod._derive_leaves(entry)
    # fruit/fruity collapse to "fruity"; apple peel/apple to "apple"
    assert "fruity" in leaves and "apple" in leaves
    # noise + taste dropped; mouthfeel-only "waxy" is not a leaf
    for bad in ("ethereal", "alcoholic", "sweet", "waxy", "fruit", "apple peel"):
        assert bad not in leaves


def test_long_tail_tag_passes_through_as_leaf():
    mod = _load_module("derive_long_tail2",
                       "flavor-gnn/scripts/derive_long_tail.py")
    # a rare descriptor not in the lookup should survive as a raw leaf
    entry = {"top_compounds": [{"tags": ["quincey-novel-note"]}]}
    assert mod._derive_leaves(entry) == ["quincey-novel-note"]
