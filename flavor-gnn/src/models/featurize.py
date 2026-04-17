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


def _one_hot(idx: int, size: int) -> list[int]:
    v = [0] * size
    if 0 <= idx < size:
        v[idx] = 1
    return v


def atom_features(atom) -> list[int]:
    sym = atom.GetSymbol()
    ele_idx = ELEMENTS.index(sym) if sym in ELEMENTS else len(ELEMENTS)
    feats = _one_hot(ele_idx, len(ELEMENTS) + 1)
    feats += _one_hot(min(atom.GetDegree(), 6), 7)
    feats += _one_hot(max(-2, min(2, atom.GetFormalCharge())) + 2, 5)
    hyb_idx = _HYB.get(atom.GetHybridization(), 3)
    feats += _one_hot(hyb_idx, 4)
    feats.append(int(atom.GetIsAromatic()))
    feats.append(int(atom.IsInRing()))
    return feats


def bond_features(bond) -> list[int]:
    b_idx = _BOND.get(bond.GetBondType(), 0)
    feats = _one_hot(b_idx, 4)
    feats.append(int(bond.GetIsConjugated()))
    feats.append(int(bond.IsInRing()))
    return feats


def smiles_to_data(smiles: str, y: Optional[torch.Tensor] = None):
    """Returns a torch_geometric.data.Data or None on parse failure."""
    from torch_geometric.data import Data
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    x = torch.tensor([atom_features(a) for a in mol.GetAtoms()], dtype=torch.float32)
    if x.size(0) == 0:
        return None

    edge_index, edge_attr = [], []
    for bond in mol.GetBonds():
        i, j = bond.GetBeginAtomIdx(), bond.GetEndAtomIdx()
        feats = bond_features(bond)
        edge_index.append((i, j))
        edge_index.append((j, i))
        edge_attr.append(feats)
        edge_attr.append(feats)

    if edge_index:
        edge_index_t = torch.tensor(edge_index, dtype=torch.long).t().contiguous()
        edge_attr_t = torch.tensor(edge_attr, dtype=torch.float32)
    else:
        edge_index_t = torch.empty(2, 0, dtype=torch.long)
        edge_attr_t = torch.empty(0, BOND_DIM, dtype=torch.float32)

    data = Data(x=x, edge_index=edge_index_t, edge_attr=edge_attr_t)
    if y is not None:
        data.y = y
    return data
