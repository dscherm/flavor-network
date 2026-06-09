"""FM-P2-3 — export the trained set-completion model to ONNX for in-browser
serving, plus a parity fixture so a Node/onnxruntime check can confirm the
exported graph matches PyTorch.

Outputs:
  public/models/recipe-setcompletion.onnx   served model (onnxruntime-web)
  public/models/recipe_vocab.json           vocab + cuisine/season id maps + heads
  flavor-gnn/artifacts/fm_p2_parity_fixture.json   inputs + torch logits (2 cases)

Plain Embedding/Linear/ReLU/matmul → clean opset-17 export (no GINEConv issues).
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch

from fm_p2_train_setcompletion import SetCompletion, vocab_profiles, HEADS

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "flavor-gnn" / "data"
ART = ROOT / "flavor-gnn" / "artifacts"
MODELS = ROOT / "public" / "models"
MAXLEN = 32


def main():
    ck = torch.load(ART / "fm_p2_setcompletion.pt", map_location="cpu", weights_only=False)
    V, d, n_cuisine, n_season = ck["V"], ck["dim"], ck["n_cuisine"], ck["n_season"]
    model = SetCompletion(V, d, n_cuisine, n_season)
    model.load_state_dict(ck["state_dict"]); model.eval()
    MODELS.mkdir(parents=True, exist_ok=True)

    # Dummy inputs (batch=1, L=MAXLEN). Batch axis is dynamic.
    obs = torch.full((1, MAXLEN), V, dtype=torch.int64)
    om = torch.zeros((1, MAXLEN), dtype=torch.float32)
    prof = torch.zeros((1, 11), dtype=torch.float32)
    cue = torch.tensor([n_cuisine], dtype=torch.int64)
    sea = torch.tensor([n_season], dtype=torch.int64)

    onnx_path = MODELS / "recipe-setcompletion.onnx"
    torch.onnx.export(
        model, (obs, om, prof, cue, sea), str(onnx_path),
        input_names=["obs_ids", "obs_mask", "profile", "cuisine", "season"],
        output_names=["logits"], opset_version=17,
        dynamic_axes={"obs_ids": {0: "B"}, "obs_mask": {0: "B"}, "profile": {0: "B"},
                      "cuisine": {0: "B"}, "season": {0: "B"}, "logits": {0: "B"}},
    )
    print(f"[fm-p2-onnx] exported {onnx_path.relative_to(ROOT)} ({onnx_path.stat().st_size//1024} KB)")

    # Vocab + cond maps for the browser loader.
    vocab = json.loads((DATA / "vocab.json").read_text(encoding="utf-8"))["vocab"]
    cond = json.loads((DATA / "cond_vocab.json").read_text(encoding="utf-8"))
    (MODELS / "recipe_vocab.json").write_text(json.dumps({
        "vocab": vocab, "maxlen": MAXLEN, "pad_id": V,
        "cuisine_vocab": cond["cuisine_vocab"], "cuisine_null": n_cuisine,
        "season_vocab": cond["season_vocab"], "season_null": n_season,
        "heads": HEADS,
    }), encoding="utf-8")
    print("[fm-p2-onnx] wrote recipe_vocab.json")

    # Parity fixture: two scenarios, with full torch logits.
    name_to_id = {n: i for i, n in enumerate(vocab)}
    P, _ = vocab_profiles(V)

    def make_case(observed, cuisine=None):
        oids = [name_to_id[o] for o in observed if o in name_to_id]
        o = np.full((1, MAXLEN), V, dtype=np.int64)
        m = np.zeros((1, MAXLEN), dtype=np.float32)
        for j, oid in enumerate(oids[:MAXLEN]):
            o[0, j] = oid; m[0, j] = 1.0
        p = (P[oids].mean(axis=0) if oids else np.zeros(11, dtype=np.float32)).astype(np.float32)
        c = cond["cuisine_vocab"].index(cuisine) if cuisine in cond["cuisine_vocab"] else n_cuisine
        with torch.no_grad():
            logits = model(torch.from_numpy(o), torch.from_numpy(m), torch.from_numpy(p[None]),
                           torch.tensor([c]), torch.tensor([n_season]))[0].numpy()
        return {"obs_ids": o.tolist(), "obs_mask": m.tolist(), "profile": p.tolist(),
                "cuisine": [int(c)], "season": [int(n_season)],
                "logits": [round(float(x), 5) for x in logits],
                "observed": observed, "cuisine_name": cuisine}

    fixture = {"V": V, "cases": [
        make_case(["garlic", "onion", "tomato"]),
        make_case(["chicken breast", "garlic"], cuisine="Italian"),
    ]}
    (ART / "fm_p2_parity_fixture.json").write_text(json.dumps(fixture), encoding="utf-8")
    print(f"[fm-p2-onnx] wrote parity fixture ({len(fixture['cases'])} cases)")


if __name__ == "__main__":
    main()
