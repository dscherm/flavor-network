"""Compute per-ingredient GNN embeddings and project to 3D for the app.

Strategy
--------
1. For each proDataset ingredient (3,913), find a matching chemDataset
   ingredient via normalized-name lookup.
2. For each match, pull up to MAX_COMPOUNDS compounds (FooDB IDs), fetch
   SMILES from FooDB (SMILES lives in the mislabeled `cas` field), featurize,
   and mean-pool the GNN's 128-d penultimate embedding.
3. Stack into (N, 128) matrix → UMAP → 3-D positions → renormalize so the
   95th-percentile distance equals TARGET_RADIUS (matches camera framing).

Output
------
public/proDataset/gnn_positions.json
    { "<ingredient_name>": [x, y, z], ... "_meta": { source, n, ... } }

Ingredients without a chemDataset match are omitted (the frontend falls back
to computeTastePositions for those).

Usage
-----
    python -m src.infer.embed_ingredients
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import numpy as np
import torch

from ..models.featurize import smiles_to_data
from ..models.mpnn import MPNN
from .calibrate import apply_shift

MAX_COMPOUNDS = 20
TARGET_RADIUS = 50.0


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _norm(name: str | None) -> str:
    if not name:
        return ""
    return re.sub(r"[^a-z0-9]+", "", name.lower())


def load_model(ckpt_path: Path, device: str):
    ckpt = torch.load(ckpt_path, map_location=device, weights_only=False)
    model = MPNN(
        ckpt["atom_dim"], ckpt["bond_dim"],
        hidden=ckpt["hidden"], num_layers=ckpt["num_layers"],
        num_tasks=len(ckpt["tasks"]),
    )
    model.load_state_dict(ckpt["state_dict"])
    model.to(device).eval()
    return model, ckpt["hidden"]


def build_name_to_compound_smiles(foodb: dict, chem_ingredients: dict,
                                  training_smiles: set | None = None):
    """Map chemDataset ingredient name → list of SMILES + compound info.

    Prioritizes compounds whose SMILES appeared in the M3 training set —
    those are the flavor/taste-annotated molecules the GNN actually learned
    something about. Without this, FooDB's per-food compound list leads
    with generic nutrients (Sucrose, Ethanol, Retinol, Vitamin D, ...)
    shared across most foods, producing identical GNN predictions for
    ~72% of ingredients. See TASK-186.

    Also merges in FlavorDB name-matched tags when flavordb.json is
    present (used only for the UI "top_compounds" display, not
    prioritization).

    Returns:
        smiles_map: { norm_name: [smiles, ...] }
        compound_info: { norm_name: [ {name, smiles, flavor_tags}, ... ] }
    """
    foodb_compounds = foodb.get("compounds", {})
    smiles_map = {}
    compound_info_map = {}
    training_smiles = training_smiles or set()

    # Load FlavorDB tags (for UI display, not prioritization — FlavorDB is
    # optional and often not scraped). Build a normalized-name index once.
    fdb_tags: dict[str, list[str]] = {}
    try:
        flavordb = json.load((_project_root() / "chemDataset" / "processed" / "flavordb.json").open("r", encoding="utf-8"))
        for _pid, mol in flavordb.get("molecules", {}).items():
            name = mol.get("name")
            if not name:
                continue
            profile = mol.get("flavor_profile") or []
            if profile:
                fdb_tags[_norm(name)] = profile
    except Exception:
        pass

    foods = foodb.get("foods", {})
    for food_name, food_info in foods.items():
        # Gather every compound with a valid SMILES in the `cas` field,
        # then sort so training-set compounds come first.
        all_compounds: list[dict] = []
        for cid in food_info.get("compounds", []):
            c = foodb_compounds.get(str(cid)) or foodb_compounds.get(cid)
            if not c:
                continue
            smi = c.get("cas")  # SMILES in mislabeled 'cas' field
            if not (smi and isinstance(smi, str) and 0 < len(smi) < 300):
                continue
            cname = c.get("name", "")
            in_training = smi in training_smiles
            tags = fdb_tags.get(_norm(cname), [])
            all_compounds.append({
                "name": cname,
                "smiles": smi,
                "flavor_tags": tags,
                "_priority": 1 if in_training else 0,
            })

        # Sort: training-set first (stable — preserves original within each bucket).
        all_compounds.sort(key=lambda c: -c["_priority"])
        picked = all_compounds[:MAX_COMPOUNDS]
        smiles = [c["smiles"] for c in picked]
        compounds = [{"name": c["name"], "smiles": c["smiles"], "flavor_tags": c["flavor_tags"]} for c in picked]

        key = _norm(food_name)
        if smiles:
            smiles_map[key] = smiles
            compound_info_map[key] = compounds

    return smiles_map, compound_info_map


def fuzzy_match_name(prodata_name: str, smiles_map: dict) -> str | None:
    """Try to match a proDataset ingredient name to a FooDB food name.

    Strategy: exact → contains → last-word fallback.
    """
    key = _norm(prodata_name)
    if key in smiles_map:
        return key

    # proDataset name contains a FooDB name (e.g., "extra virgin olive oil" contains "olive")
    best = None
    best_len = 0
    for fdb_key in smiles_map:
        if len(fdb_key) < 3:
            continue
        if fdb_key in key and len(fdb_key) > best_len:
            best = fdb_key
            best_len = len(fdb_key)
    if best and best_len >= 4:
        return best

    # FooDB name contains proDataset name (e.g., "chicken" in "chickenbreast")
    for fdb_key in smiles_map:
        if key in fdb_key and len(key) >= 4:
            return fdb_key

    # Try last word (e.g., "boneless chicken breast" → "chicken")
    words = prodata_name.lower().split()
    for word in reversed(words):
        wk = _norm(word)
        if wk in smiles_map and len(wk) >= 4:
            return wk

    return None


def embed_smiles_batch(model, smiles_list: list[str], device: str, hidden: int) -> np.ndarray | None:
    from torch_geometric.loader import DataLoader
    data_list = []
    for s in smiles_list:
        d = smiles_to_data(s)
        if d is not None:
            data_list.append(d)
    if not data_list:
        return None
    loader = DataLoader(data_list, batch_size=len(data_list), shuffle=False)
    with torch.no_grad():
        batch = next(iter(loader)).to(device)
        emb = model.forward_embedding(batch)  # (n, hidden)
    return emb.cpu().numpy().mean(axis=0)  # mean-pool across compounds → (hidden,)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ckpt", default=str(_project_root() / "flavor-gnn" / "artifacts" / "m3_multitask.pt"))
    parser.add_argument("--foodb", default=str(_project_root() / "chemDataset" / "processed" / "foodb.json"))
    parser.add_argument("--prodata", default=str(_project_root() / "public" / "proDataset" / "ingredients.json"))
    parser.add_argument("--out", default=str(_project_root() / "public" / "proDataset" / "gnn_positions.json"))
    parser.add_argument("--entropy-out", default=str(_project_root() / "public" / "proDataset" / "gnn_entropy.json"))
    args = parser.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[embed] device={device}")

    model, hidden = load_model(Path(args.ckpt), device)

    with open(args.foodb, "r", encoding="utf-8") as fh:
        foodb = json.load(fh)
    with open(args.prodata, "r", encoding="utf-8") as fh:
        prodata = json.load(fh)

    # Training SMILES — used to prioritize compounds the GNN has actually
    # seen. Without this the mean-pool is dominated by generic nutrients.
    training_smiles: set = set()
    try:
        import pandas as pd
        train_df = pd.read_parquet(_project_root() / "flavor-gnn" / "data" / "compounds.parquet")
        training_smiles = set(train_df["smiles"].tolist())
        print(f"[embed] loaded {len(training_smiles)} training SMILES for prioritization")
    except Exception as e:
        print(f"[embed] WARNING could not load training SMILES: {e}")

    smiles_map, compound_info_map = build_name_to_compound_smiles(foodb, {}, training_smiles=training_smiles)
    print(f"[embed] indexed {len(smiles_map)} FooDB foods with SMILES")

    ingredient_names = [n for n in prodata.keys() if not n.startswith("_")]
    print(f"[embed] proDataset ingredients: {len(ingredient_names)}")

    embeddings = {}
    probs_by_name = {}
    ingredient_compounds = {}  # per-ingredient top compounds for the UI
    tasks = ["sweet", "bitter", "umami", "salty", "sour",
             "odor_fruity", "odor_floral", "odor_green", "odor_woody", "odor_spicy", "odor_fatty"]
    matched = 0

    from torch_geometric.loader import DataLoader

    for i, name in enumerate(ingredient_names):
        fdb_key = fuzzy_match_name(name, smiles_map)
        if not fdb_key:
            continue
        smiles_list = smiles_map[fdb_key]
        emb = embed_smiles_batch(model, smiles_list, device, hidden)
        if emb is None:
            continue
        embeddings[name] = emb
        matched += 1

        # Store top compounds with flavor tags for the UI
        cinfo = compound_info_map.get(fdb_key, [])
        # Prefer compounds that have flavor tags
        tagged = [c for c in cinfo if c.get("flavor_tags")]
        top = (tagged or cinfo)[:5]
        if top:
            ingredient_compounds[name] = {
                "matched_food": fdb_key,
                "total_compounds": len(cinfo),
                "top_compounds": [
                    {"name": c["name"], "tags": c["flavor_tags"][:4]}
                    for c in top
                ],
            }

        # Avg predicted probabilities for entropy coloring
        with torch.no_grad():
            data_list = [smiles_to_data(s) for s in smiles_list]
            data_list = [d for d in data_list if d is not None]
            if data_list:
                loader = DataLoader(data_list, batch_size=len(data_list), shuffle=False)
                batch = next(iter(loader)).to(device)
                logits = model(batch)
                raw = torch.sigmoid(logits).cpu().numpy().mean(axis=0, keepdims=True)
                probs = apply_shift(raw, tasks)[0]
                probs_by_name[name] = {t: float(round(p, 4)) for t, p in zip(tasks, probs.tolist())}

        if (i + 1) % 500 == 0:
            print(f"[embed] {i + 1}/{len(ingredient_names)}  matched so far: {matched}")

    print(f"[embed] embedded {matched}/{len(ingredient_names)} ingredients")
    if matched < 50:
        print("[embed] WARNING: very few matches — layout will fall back to taste axes for most nodes")
        # Still continue to write what we have

    # UMAP to 3D
    names = list(embeddings.keys())
    X = np.stack([embeddings[n] for n in names])
    print(f"[embed] running UMAP on X shape={X.shape}")
    import umap
    reducer = umap.UMAP(n_components=3, n_neighbors=min(15, max(2, len(names) - 1)),
                        min_dist=0.1, random_state=42, metric="cosine")
    Y = reducer.fit_transform(X)

    # Renormalize so the 95th-percentile distance from origin = TARGET_RADIUS
    Y = Y - Y.mean(axis=0, keepdims=True)
    d = np.linalg.norm(Y, axis=1)
    p95 = float(np.percentile(d, 95)) if len(d) else 1.0
    scale = (TARGET_RADIUS / p95) if p95 > 0 else 1.0
    Y = Y * scale

    positions = {n: [float(round(x, 3)) for x in Y[i].tolist()] for i, n in enumerate(names)}
    positions["_meta"] = {
        "source": "flavor-gnn m3_multitask embedding -> UMAP(3, cosine)",
        "n": matched,
        "target_radius": TARGET_RADIUS,
        "p95_before_scale": p95,
    }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(positions, fh)
    print(f"[embed] wrote {args.out} — {matched} positioned ingredients")

    # Entropy snapshot for R5-29
    entropy_out = {}
    for name, probs in probs_by_name.items():
        p = np.array(list(probs.values()))
        # Normalize so Σp = 1 for entropy calc (per-taste is Bernoulli, but
        # for visualization we treat the 5-vector as a soft distribution over
        # the "strongest" taste)
        if p.sum() > 0:
            pn = p / p.sum()
            H = float(-np.sum(pn[pn > 0] * np.log(pn[pn > 0])))
        else:
            H = 0.0
        H_max = float(np.log(len(p)))
        entropy_out[name] = {
            "probs": probs,
            "entropy": float(round(H, 4)),
            "entropy_norm": float(round(H / H_max if H_max > 0 else 0.0, 4)),
        }
    entropy_out["_meta"] = {"tasks": tasks, "n": len(probs_by_name)}
    with open(args.entropy_out, "w", encoding="utf-8") as fh:
        json.dump(entropy_out, fh)
    print(f"[embed] wrote {args.entropy_out} — entropy for {len(probs_by_name)} ingredients")

    # Compound info for the UI — "why does this ingredient taste this way?"
    compounds_out = _project_root() / "public" / "proDataset" / "gnn_compounds.json"
    with compounds_out.open("w", encoding="utf-8") as fh:
        json.dump(ingredient_compounds, fh)
    print(f"[embed] wrote {compounds_out} — compound info for {len(ingredient_compounds)} ingredients")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
