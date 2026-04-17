"""Precompute 3D atom coordinates for preset molecules.

Uses RDKit to generate 3D conformers from SMILES, then exports atom positions,
bond connectivity, and element info for the Three.js molecular viewer.

Output: public/models/preset_molecules.json

Usage:
    python -m src.infer.preset_molecules
"""
from __future__ import annotations

import json
from pathlib import Path

from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors


ELEMENT_COLORS = {
    'C': '#808080', 'N': '#3050F8', 'O': '#FF0D0D', 'S': '#FFFF30',
    'H': '#FFFFFF', 'F': '#90E050', 'Cl': '#1FF01F', 'Br': '#A62929',
    'P': '#FF8000', 'I': '#940094',
}

# Functional group patterns and their taste/odor relevance
FUNCTIONAL_GROUPS = [
    {"smarts": "[NR1]1[CR1]=[NR1][CR1]=[CR1]1", "label": "Imidazole ring", "relevance": "Common in bitter alkaloids like caffeine and histidine"},
    {"smarts": "c1ccccc1", "label": "Benzene ring", "relevance": "Aromatic — contributes to woody, floral, or medicinal flavors"},
    {"smarts": "[OH]", "label": "Hydroxyl group", "relevance": "Increases water solubility and sweetness perception"},
    {"smarts": "C=O", "label": "Carbonyl group", "relevance": "Key to many aroma compounds — aldehydes smell fruity, ketones smell sweet"},
    {"smarts": "C(=O)O", "label": "Carboxyl group", "relevance": "Creates sour/acidic taste (citric acid, vinegar)"},
    {"smarts": "[NH2]", "label": "Amino group", "relevance": "Found in amino acids — contributes to umami taste"},
    {"smarts": "OC", "label": "Methoxy group", "relevance": "Common in vanilla-family compounds — sweet, warm aroma"},
    {"smarts": "S", "label": "Sulfur atom", "relevance": "Creates pungent, savory, or garlic-like flavors"},
]


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def process_molecule(name: str, smiles: str) -> dict | None:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None

    # Add hydrogens for realistic 3D structure
    mol_h = Chem.AddHs(mol)
    try:
        AllChem.EmbedMolecule(mol_h, AllChem.ETKDGv3())
        AllChem.MMFFOptimizeMolecule(mol_h, maxIters=200)
    except Exception:
        # Fallback: 2D coordinates
        AllChem.Compute2DCoords(mol_h)

    conf = mol_h.GetConformer() if mol_h.GetNumConformers() > 0 else None
    if conf is None:
        return None

    # Extract atoms (skip explicit hydrogens for cleaner display)
    atoms = []
    heavy_map = {}  # old idx → new idx
    for i, atom in enumerate(mol_h.GetAtoms()):
        sym = atom.GetSymbol()
        if sym == 'H':
            continue
        pos = conf.GetAtomPosition(i)
        heavy_map[i] = len(atoms)
        atoms.append({
            "element": sym,
            "x": round(pos.x, 3),
            "y": round(pos.y, 3),
            "z": round(pos.z, 3),
            "color": ELEMENT_COLORS.get(sym, '#CCCCCC'),
        })

    # Extract bonds (only between heavy atoms)
    bonds = []
    for bond in mol_h.GetBonds():
        i, j = bond.GetBeginAtomIdx(), bond.GetEndAtomIdx()
        if i in heavy_map and j in heavy_map:
            bonds.append({
                "from": heavy_map[i],
                "to": heavy_map[j],
                "order": int(bond.GetBondTypeAsDouble()),
            })

    # Find functional groups
    groups = []
    for fg in FUNCTIONAL_GROUPS:
        pattern = Chem.MolFromSmarts(fg["smarts"])
        if pattern is None:
            continue
        matches = mol.GetSubstructMatches(pattern)
        if matches:
            # Map to heavy atom indices
            mapped_atoms = sorted(set(
                idx for match in matches for idx in match
                if idx < len(atoms)
            ))
            if mapped_atoms:
                groups.append({
                    "label": fg["label"],
                    "relevance": fg["relevance"],
                    "atoms": mapped_atoms,
                })

    return {
        "name": name,
        "smiles": smiles,
        "atoms": atoms,
        "bonds": bonds,
        "functional_groups": groups,
        "molecular_weight": round(Descriptors.ExactMolWt(mol), 1),
        "atom_count": len(atoms),
    }


def main() -> int:
    root = _project_root()

    with (root / "public" / "models" / "preset_predictions.json").open("r", encoding="utf-8") as fh:
        presets = json.load(fh)["presets"]

    out = {}
    for p in presets:
        result = process_molecule(p["name"], p["smiles"])
        if result:
            out[p["name"]] = result
            fg_str = ", ".join(g["label"] for g in result["functional_groups"][:3]) or "none"
            print(f"[mol3d] {p['name']:22s}  atoms={result['atom_count']:3d}  bonds={len(result['bonds']):3d}  groups: {fg_str}")
        else:
            print(f"[mol3d] {p['name']:22s}  FAILED")

    out_path = root / "public" / "models" / "preset_molecules.json"
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(out, fh)
    print(f"[mol3d] wrote {out_path} — {len(out)} molecules")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
