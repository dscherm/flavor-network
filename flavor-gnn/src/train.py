"""flavor-gnn training entrypoint.

STATUS: scaffold. Run against M0 compounds.parquet once chemDataset
has real (non-stub) data. The function signatures define the contract;
actual MPNN body lands in a later milestone.
"""

from __future__ import annotations

from pathlib import Path
import argparse


def build_dataset(compounds_parquet: Path):
    """Load compounds.parquet → list of (smiles, labels) tuples."""
    raise NotImplementedError("M0: implement parquet reader + RDKit featurization")


def train(args: argparse.Namespace) -> None:
    data = build_dataset(args.data)  # noqa: F841
    raise NotImplementedError("M2+: define MPNN forward, train loop, checkpointing")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data", type=Path, required=True, help="path to compounds.parquet")
    p.add_argument("--epochs", type=int, default=50)
    p.add_argument("--out", type=Path, default=Path("runs/latest"))
    train(p.parse_args())


if __name__ == "__main__":
    main()
