"""FM-P2 generation demo — qualitative check that the set-completion model
produces sensible recipes. Loads the trained checkpoint and runs both flows:
  A. complete-from-partial: user picked a few ingredients → suggest the rest
  B. generate-from-profile: a target flavor profile → a recipe
optionally conditioned on cuisine. Not a shipped feature — a sanity demo.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch

from fm_p2_train_setcompletion import SetCompletion, vocab_profiles, HEADS  # reuse model + helpers

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "flavor-gnn" / "data"
ART = ROOT / "flavor-gnn" / "artifacts"


def main():
    ck = torch.load(ART / "fm_p2_setcompletion.pt", map_location="cpu", weights_only=False)
    V = ck["V"]
    model = SetCompletion(V, ck["dim"], ck["n_cuisine"], ck["n_season"])
    model.load_state_dict(ck["state_dict"]); model.eval()

    vocab = json.loads((DATA / "vocab.json").read_text(encoding="utf-8"))["vocab"]
    name_to_id = {n: i for i, n in enumerate(vocab)}
    cond = json.loads((DATA / "cond_vocab.json").read_text(encoding="utf-8"))
    cue_id = {c: i for i, c in enumerate(cond["cuisine_vocab"])}
    P, _ = vocab_profiles(V)
    n_cuisine, n_season = ck["n_cuisine"], ck["n_season"]

    def gen(observed, cuisine=None, target_profile=None, k=10, maxlen=32):
        oids = [name_to_id[o] for o in observed if o in name_to_id]
        obs = np.full((1, maxlen), V, dtype=np.int64)
        om = np.zeros((1, maxlen), dtype=np.float32)
        for j, oid in enumerate(oids[:maxlen]):
            obs[0, j] = oid; om[0, j] = 1.0
        if target_profile is not None:
            prof = target_profile.astype(np.float32)
        elif oids:
            prof = P[oids].mean(axis=0)
        else:
            prof = np.zeros(11, dtype=np.float32)
        cidx = cue_id.get(cuisine, n_cuisine) if cuisine else n_cuisine
        with torch.no_grad():
            logits = model(torch.from_numpy(obs), torch.from_numpy(om),
                           torch.from_numpy(prof[None]),
                           torch.tensor([cidx]), torch.tensor([n_season]))[0].numpy()
        for oid in oids:
            logits[oid] = -1e9
        return [vocab[i] for i in np.argsort(-logits)[:k]]

    print("=== FLOW A: complete-from-partial ===")
    for obs, cz in [(["garlic", "onion", "tomato"], None),
                    (["chicken breast", "garlic"], "Italian"),
                    (["flour", "butter", "sugar"], None),
                    (["lime", "tequila"], None),
                    (["soy sauce", "ginger", "garlic"], "Asian")]:
        cs = f"  [cuisine={cz}]" if cz else ""
        print(f"\nobserved: {obs}{cs}\n  -> " + ", ".join(gen(obs, cuisine=cz, k=10)))

    print("\n\n=== FLOW B: generate-from-profile (empty observed) ===")
    # build target profiles by averaging exemplar ingredients' gnn profiles
    def profile_of(names):
        ids = [name_to_id[n] for n in names if n in name_to_id]
        return P[ids].mean(axis=0) if ids else np.zeros(11, dtype=np.float32)
    for label, seed in [("sweet/dessert", ["sugar", "vanilla", "chocolate"]),
                        ("savory/umami", ["mushroom", "soy sauce", "parmesan cheese"]),
                        ("citrus/bright", ["lemon", "lime", "orange"])]:
        tp = profile_of(seed)
        nz = {h: round(float(v), 2) for h, v in zip(HEADS, tp) if v > 0.25}
        print(f"\ntarget '{label}' (profile>{0.25}: {nz})\n  -> " + ", ".join(gen([], target_profile=tp, k=12)))


if __name__ == "__main__":
    main()
