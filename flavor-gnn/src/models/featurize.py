"""SMILES -> torch_geometric.data.Data featurization.

Node features (per atom):
  - element one-hot: H,C,N,O,F,P,S,Cl,Br,I,other  (11)
  - degree 0..6     (one-hot, 7)
  - formal_charge in {-2,-1,0,1,2} (one-hot, 5)
  - hybridization sp, sp2, sp3, other (one-hot, 4)
  - aromatic       (1)
  - in_ring        (1)
  = 29 dims

Edge features (per bond, directed both ways):
  - bond type: single, double, triple, aromatic (one-hot, 4)
  - conjugated (1)
  - in_ring    (1)
  = 6 dims
"""
from __future__ import annotations

from typing import Optional

import torch
from rdkit import Chem

ELEMENTS = ["H", "C", "N", "O", "F", "P", "S", "Cl", "Br", "I"]
ATOM_DIM = len(ELEMENTS) + 1 + 7 + 5 + 4 + 1 + 1   # 29
BOND_DIM = 4 + 1 + 1                                # 6

# Lever #2 (chirality/stereo). When enabled, atom features gain a 4-dim chiral-tag
# one-hot and bond features gain a 4-dim stereo one-hot. Enantiomers (same graph,
# different 3D handedness) can smell completely different (R/S-carvone =
# caraway/spearmint), so stereo is odor-relevant signal the base featurizer drops.
CHIRAL_DIM = 4
BOND_STEREO_DIM = 4
ATOM_DIM_STEREO = ATOM_DIM + CHIRAL_DIM   # 33
BOND_DIM_STEREO = BOND_DIM + BOND_STEREO_DIM  # 10

_HYB = {
    Chem.rdchem.HybridizationType.SP: 0,
    Chem.rdchem.HybridizationType.SP2: 1,
    Chem.rdchem.HybridizationType.SP3: 2,
}

_BOND = {
    Chem.rdchem.BondType.SINGLE: 0,
    Chem.rdchem.BondType.DOUBLE: 1,
    Chem.rdchem.BondType.TRIPLE: 2,
    Chem.rdchem.BondType.AROMATIC: 3,
}

_CHI = {
    Chem.rdchem.ChiralType.CHI_UNSPECIFIED: 0,
    Chem.rdchem.ChiralType.CHI_TETRAHEDRAL_CW: 1,
    Chem.rdchem.ChiralType.CHI_TETRAHEDRAL_CCW: 2,
}

_STEREO = {
    Chem.rdchem.BondStereo.STEREONONE: 0,
    Chem.rdchem.BondStereo.STEREOZ: 1,
    Chem.rdchem.BondStereo.STEREOE: 2,
}

# Lever #1 (physchem descriptors). 8-dim per-molecule vector concatenated into the
# classifier head (normalized in the model). logP / MolWt are volatility proxies —
# a molecule must be volatile to reach the nose — which the topology-only GNN can't
# see; TPSA / H-bonding relate to receptor binding.
DESC_DIM = 8


def molecule_descriptors(mol) -> list[float]:
    from rdkit.Chem import Crippen, Descriptors, rdMolDescriptors
    return [
        Descriptors.MolWt(mol),
        rdMolDescriptors.CalcTPSA(mol),
        rdMolDescriptors.CalcNumHBD(mol),
        rdMolDescriptors.CalcNumHBA(mol),
        rdMolDescriptors.CalcNumRotatableBonds(mol),
        Crippen.MolLogP(mol),
        rdMolDescriptors.CalcFractionCSP3(mol),
        rdMolDescriptors.CalcNumRings(mol),
    ]


def _one_hot(idx: int, size: int) -> list[int]:
    v = [0] * size
    if 0 <= idx < size:
        v[idx] = 1
    return v


def atom_features(atom, stereo: bool = False) -> list[int]:
    sym = atom.GetSymbol()
    ele_idx = ELEMENTS.index(sym) if sym in ELEMENTS else len(ELEMENTS)
    feats = _one_hot(ele_idx, len(ELEMENTS) + 1)
    feats += _one_hot(min(atom.GetDegree(), 6), 7)
    feats += _one_hot(max(-2, min(2, atom.GetFormalCharge())) + 2, 5)
    hyb_idx = _HYB.get(atom.GetHybridization(), 3)
    feats += _one_hot(hyb_idx, 4)
    feats.append(int(atom.GetIsAromatic()))
    feats.append(int(atom.IsInRing()))
    if stereo:
        feats += _one_hot(_CHI.get(atom.GetChiralTag(), 3), CHIRAL_DIM)
    return feats


def bond_features(bond, stereo: bool = False) -> list[int]:
    b_idx = _BOND.get(bond.GetBondType(), 0)
    feats = _one_hot(b_idx, 4)
    feats.append(int(bond.GetIsConjugated()))
    feats.append(int(bond.IsInRing()))
    if stereo:
        feats += _one_hot(_STEREO.get(bond.GetStereo(), 3), BOND_STEREO_DIM)
    return feats


def smiles_to_data(smiles: str, y: Optional[torch.Tensor] = None,
                   stereo: bool = False, descriptors: bool = False):
    """Returns a torch_geometric.data.Data or None on parse failure.

    stereo=True adds chirality/bond-stereo dims (Lever #2). descriptors=True
    attaches an 8-dim physchem `desc` vector (Lever #1).
    """
    from torch_geometric.data import Data
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    x = torch.tensor([atom_features(a, stereo) for a in mol.GetAtoms()], dtype=torch.float32)
    if x.size(0) == 0:
        return None

    edge_index, edge_attr = [], []
    for bond in mol.GetBonds():
        i, j = bond.GetBeginAtomIdx(), bond.GetEndAtomIdx()
        feats = bond_features(bond, stereo)
        edge_index.append((i, j))
        edge_index.append((j, i))
        edge_attr.append(feats)
        edge_attr.append(feats)

    bdim = BOND_DIM_STEREO if stereo else BOND_DIM
    if edge_index:
        edge_index_t = torch.tensor(edge_index, dtype=torch.long).t().contiguous()
        edge_attr_t = torch.tensor(edge_attr, dtype=torch.float32)
    else:
        edge_index_t = torch.empty(2, 0, dtype=torch.long)
        edge_attr_t = torch.empty(0, bdim, dtype=torch.float32)

    data = Data(x=x, edge_index=edge_index_t, edge_attr=edge_attr_t)
    if descriptors:
        data.desc = torch.tensor([molecule_descriptors(mol)], dtype=torch.float32)
    if y is not None:
        data.y = y
    return data
