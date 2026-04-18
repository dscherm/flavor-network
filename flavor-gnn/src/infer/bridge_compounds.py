"""Precompute distinctive shared molecules between ingredient pairs.

For every edge in the recipe graph, finds FlavorDB molecules shared by both
ingredients, ranked by rarity (inverse entity frequency). Rare shared molecules
are more narratively interesting — they explain WHY these specific ingredients
pair well, not just that they both contain water.

Also generates plain-English bridge narratives from functional group templates.

Output: public/proDataset/bridge_compounds.json

Usage:
    python -m src.infer.bridge_compounds
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _norm(s):
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


# Functional group → narrative template
BRIDGE_NARRATIVES = {
    "thioether": "sulfur compounds that give both ingredients their savory bite",
    "sulfide": "sulfur compounds that create pungent, savory aromas",
    "terpene": "terpenes — aromatic oils shared by herbs and citrus",
    "alkene": "terpenes that contribute fresh, aromatic character",
    "aldehyde": "aldehydes that create fresh, green aromas",
    "ester": "esters that produce fruity, sweet notes",
    "alcohol": "alcohols that add warmth and depth",
    "primary alcohol": "alcohols that add warmth and depth",
    "carboxylic acid": "organic acids that bring brightness and tang",
    "phenol": "phenolic compounds with earthy, smoky character",
    "ketone": "ketones that contribute creamy, buttery notes",
    "aromatic": "aromatic ring compounds with complex flavor",
    "lactone": "lactones that create creamy, coconut-like notes",
}


def narrative_for_groups(groups: list[str]) -> str:
    """Generate a narrative fragment from functional group names."""
    for g in groups:
        gl = g.lower()
        for key, tmpl in BRIDGE_NARRATIVES.items():
            if key in gl:
                return tmpl
    return "flavor compounds that create compatible aromas"


def build_entity_to_molecules(flavordb: dict) -> dict[str, set[int]]:
    """Map FlavorDB entity name → set of pubchem_ids."""
    out = {}
    for name, info in flavordb.get("entities", {}).items():
        mols = set(info.get("molecules", []))
        if mols:
            out[_norm(name)] = mols
    return out


def build_molecule_entity_count(flavordb: dict) -> dict[int, int]:
    """Count how many entities each molecule appears in (for rarity scoring)."""
    counts = Counter()
    for info in flavordb.get("entities", {}).values():
        for mid in info.get("molecules", []):
            counts[mid] += 1
    return counts


def main() -> int:
    root = _project_root()

    # Load data
    with (root / "chemDataset" / "processed" / "flavordb.json").open("r", encoding="utf-8") as fh:
        flavordb = json.load(fh)
    with (root / "public" / "proDataset" / "pairings.json").open("r", encoding="utf-8") as fh:
        pairings = json.load(fh)
    with (root / "public" / "proDataset" / "ingredients.json").open("r", encoding="utf-8") as fh:
        ingredients = json.load(fh)

    molecules = flavordb.get("molecules", {})
    total_entities = len(flavordb.get("entities", {}))
    entity_mols = build_entity_to_molecules(flavordb)
    mol_entity_count = build_molecule_entity_count(flavordb)

    print(f"[bridge] {len(entity_mols)} FlavorDB entities, {len(molecules)} molecules, {len(pairings)} pairings")

    # Build ingredient name → FlavorDB entity key mapping (fuzzy)
    def match_entity(name):
        key = _norm(name)
        if key in entity_mols:
            return key
        for ek in entity_mols:
            if len(ek) >= 4 and (ek in key or key in ek):
                return ek
        words = name.lower().split()
        for w in reversed(words):
            wk = _norm(w)
            if wk in entity_mols and len(wk) >= 4:
                return wk
        return None

    # Process top pairings (by strength) — limit to top 2000 edges to keep file small
    top_pairings = sorted(pairings, key=lambda p: p.get("strength", 0), reverse=True)[:2000]
    bridges = {}
    matched = 0

    for p in top_pairings:
        a, b = p.get("ingredientA"), p.get("ingredientB")
        if not a or not b:
            continue

        ea = match_entity(a)
        eb = match_entity(b)
        if not ea or not eb:
            continue

        mols_a = entity_mols.get(ea, set())
        mols_b = entity_mols.get(eb, set())
        shared = mols_a & mols_b

        if not shared:
            continue

        # Rank by rarity (inverse entity frequency)
        ranked = []
        for mid in shared:
            mol = molecules.get(str(mid))
            if not mol:
                continue
            name = mol.get("name", "")
            if not name or len(name) < 3:
                continue
            entity_count = mol_entity_count.get(mid, 1)
            rarity = 1.0 - (entity_count / max(1, total_entities))
            tags = mol.get("flavor_profile") or []
            groups = mol.get("functional_groups") or []

            # Skip extremely common compounds (appear in >50% of entities)
            if rarity < 0.5:
                continue

            ranked.append({
                "name": name,
                "tags": tags[:3],
                "groups": groups[:3],
                "smiles": mol.get("smiles"),
                "rarity": round(rarity, 3),
            })

        ranked.sort(key=lambda x: x["rarity"], reverse=True)
        top3 = ranked[:3]
        if not top3:
            continue

        # Generate narrative
        all_groups = []
        for c in top3:
            all_groups.extend(c.get("groups", []))
        narrative = narrative_for_groups(all_groups)

        key = f"{a}|{b}" if a < b else f"{b}|{a}"
        bridges[key] = {
            "shared_count": len(shared),
            "distinctive_count": len(ranked),
            "bridges": top3,
            "narrative": narrative,
            "summary": f"share {top3[0]['name']}" + (f" and {top3[1]['name']}" if len(top3) > 1 else ""),
        }
        matched += 1

    print(f"[bridge] computed bridges for {matched}/{len(top_pairings)} top pairings")

    out_path = root / "public" / "proDataset" / "bridge_compounds.json"
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump({"_meta": {"edges": matched, "total_entities": total_entities}, **bridges}, fh)
    print(f"[bridge] wrote {out_path}")

    # Also generate 3D coords for top bridge molecules
    try:
        from rdkit import Chem
        from rdkit.Chem import AllChem, Descriptors

        seen_mols = {}
        for edge_data in bridges.values():
            for b in edge_data["bridges"]:
                smi = b.get("smiles")
                name = b["name"]
                if not smi or name in seen_mols:
                    continue
                mol = Chem.MolFromSmiles(smi)
                if not mol:
                    continue
                mol_h = Chem.AddHs(mol)
                try:
                    AllChem.EmbedMolecule(mol_h, AllChem.ETKDGv3())
                    AllChem.MMFFOptimizeMolecule(mol_h, maxIters=200)
                except Exception:
                    AllChem.Compute2DCoords(mol_h)
                conf = mol_h.GetConformer() if mol_h.GetNumConformers() else None
                if not conf:
                    continue

                ELEMENT_COLORS = {'C': '#808080', 'N': '#3050F8', 'O': '#FF0D0D', 'S': '#FFFF30', 'H': '#FFFFFF', 'F': '#90E050', 'Cl': '#1FF01F', 'Br': '#A62929', 'P': '#FF8000'}
                atoms = []
                heavy_map = {}
                for i, atom in enumerate(mol_h.GetAtoms()):
                    sym = atom.GetSymbol()
                    if sym == 'H':
                        continue
                    pos = conf.GetAtomPosition(i)
                    heavy_map[i] = len(atoms)
                    atoms.append({"element": sym, "x": round(pos.x, 3), "y": round(pos.y, 3), "z": round(pos.z, 3), "color": ELEMENT_COLORS.get(sym, '#CCCCCC')})

                bonds = []
                for bond in mol_h.GetBonds():
                    bi, bj = bond.GetBeginAtomIdx(), bond.GetEndAtomIdx()
                    if bi in heavy_map and bj in heavy_map:
                        bonds.append({"from": heavy_map[bi], "to": heavy_map[bj], "order": int(bond.GetBondTypeAsDouble())})

                seen_mols[name] = {"name": name, "smiles": smi, "atoms": atoms, "bonds": bonds, "functional_groups": []}
                if len(seen_mols) >= 200:
                    break
            if len(seen_mols) >= 200:
                break

        mol3d_path = root / "public" / "models" / "bridge_molecules_3d.json"
        with mol3d_path.open("w", encoding="utf-8") as fh:
            json.dump(seen_mols, fh)
        print(f"[bridge] wrote {mol3d_path} — {len(seen_mols)} 3D molecules")
    except ImportError:
        print("[bridge] rdkit not available, skipping 3D molecule generation")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
