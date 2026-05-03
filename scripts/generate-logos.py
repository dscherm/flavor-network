"""
Generate logo concepts for Flavor Network using ComfyUI's Flux 1 dev model.

Usage:
    python scripts/generate-logos.py

Requires ComfyUI running at http://localhost:8188 with:
  - models/checkpoints/flux1-dev-fp8.safetensors

Outputs land in ComfyUI/output/ then get copied to resources/logo-options/.
"""
from __future__ import annotations

import json
import os
import shutil
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

COMFY_URL = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188")
COMFY_OUTPUT = Path(os.environ.get(
    "COMFYUI_OUTPUT_ROOT",
    r"D:\Projects\ComfyUI\output",
))
DEST = Path(__file__).resolve().parent.parent / "resources" / "logo-options"
DEST.mkdir(parents=True, exist_ok=True)

CHECKPOINT = "flux1-dev-fp8.safetensors"

# 5 logo concepts. Flux responds well to long, descriptive prompts so each
# prompt names the visual primitives, palette, framing, and style cues.
NEGATIVE = (
    "text, words, letters, watermark, signature, logo text, "
    "low quality, jpeg artifacts, busy, cluttered, photo, photograph, "
    "people, hands, fingers"
)

# Two prompts × 4 seed variations each = 8 outputs.
# Variant A is the "monoline + colored rings, large composition" iteration
# of the previous #4. Variant B is the "sketched hat, no stray dots"
# iteration of the previous #2.
VARIANTS = [
    {
        "slug": "A-monoline-colored",
        "prompt": (
            "iOS app icon, large bold composition that fills the entire "
            "square canvas edge-to-edge with minimal margin, on deep navy "
            "#0a0a0f background, stylized chef's toque hat at the top "
            "drawn with a clean white monoline outline and smooth wavy "
            "crown silhouette, directly below three thin elliptical atomic "
            "orbital rings crossing at a single central nucleus, ring "
            "colors bright yellow ring, leaf-green ring, royal-blue ring, "
            "exactly three small electron dots on the rings each matching "
            "its ring color (one yellow dot, one green dot, one blue dot), "
            "bold geometric capital letters NF in white centered inside the "
            "atom as the nucleus, all linework consistent uniform thickness, "
            "balanced symmetric composition, premium minimal flat vector "
            "design, centered 1:1 composition, no shadows, no notebook "
            "lines, no extra text, no stray particles"
        ),
    },
    {
        "slug": "B-vector-sketched-hat",
        "prompt": (
            "premium iOS app icon, soft cream background, at the top a "
            "loose hand-sketched chef's toque hat drawn in dark navy ink "
            "with visible pencil and ink line texture and slight imperfect "
            "wobble strokes, NOT flat clipart, NOT smooth vector hat, hat "
            "feels illustrated by hand, directly below three interlocking "
            "elliptical atomic orbital rings rotated 60 degrees apart "
            "crossing at a single central nucleus, orbital ring colors warm "
            "yellow, fresh green, royal blue, exactly two small electron-dot "
            "circles resting on the rings, bold geometric capital letters NF "
            "in dark navy centered inside the atom as the nucleus, ultra-"
            "clean minimal flat design for the atom and letters, balanced "
            "symmetric composition, centered 1:1 composition, no shadows, "
            "no notebook lines, no extra text, no stray dots, no scattered "
            "particles, no debris in background"
        ),
    },
]

PROMPTS = [
    {
        "slug": f"{v['slug']}-{i+1:02d}",
        "prompt": v["prompt"],
    }
    for v in VARIANTS
    for i in range(4)
]


def build_workflow(prompt_text: str, negative_text: str, seed: int) -> dict:
    """
    Flux 1 dev workflow using the all-in-one fp8 checkpoint.

    CheckpointLoaderSimple loads UNet + CLIP + VAE from one file. We keep
    cfg=1.0 (Flux dev guidance distilled), 25 steps, euler/simple — these
    are the ComfyUI defaults that give clean results without finetuning.
    """
    return {
        "1": {
            "inputs": {"ckpt_name": CHECKPOINT},
            "class_type": "CheckpointLoaderSimple",
        },
        "2": {
            "inputs": {"text": prompt_text, "clip": ["1", 1]},
            "class_type": "CLIPTextEncode",
        },
        "3": {
            "inputs": {"text": negative_text, "clip": ["1", 1]},
            "class_type": "CLIPTextEncode",
        },
        "4": {
            "inputs": {"width": 1024, "height": 1024, "batch_size": 1},
            "class_type": "EmptyLatentImage",
        },
        "5": {
            "inputs": {
                "seed": seed,
                "steps": 25,
                "cfg": 1.0,
                "sampler_name": "euler",
                "scheduler": "simple",
                "denoise": 1.0,
                "model": ["1", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["4", 0],
            },
            "class_type": "KSampler",
        },
        "6": {
            "inputs": {"samples": ["5", 0], "vae": ["1", 2]},
            "class_type": "VAEDecode",
        },
        "7": {
            "inputs": {
                "filename_prefix": "fn-logo",
                "images": ["6", 0],
            },
            "class_type": "SaveImage",
        },
    }


def post_json(path: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"{COMFY_URL}{path}",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_json(path: str) -> dict:
    with urllib.request.urlopen(f"{COMFY_URL}{path}", timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def queue_prompt(workflow: dict) -> str:
    result = post_json("/prompt", {"prompt": workflow})
    return result["prompt_id"]


def wait_for_prompt(prompt_id: str, timeout_s: int = 600) -> list[dict]:
    """Poll /history/{id} until the prompt completes; return the produced files."""
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            history = get_json(f"/history/{prompt_id}")
        except urllib.error.HTTPError:
            history = {}
        if prompt_id in history:
            outputs = history[prompt_id].get("outputs", {})
            files = []
            for node_out in outputs.values():
                for img in node_out.get("images", []):
                    files.append(img)
            return files
        time.sleep(2)
    raise TimeoutError(f"prompt {prompt_id} did not complete within {timeout_s}s")


def main():
    print(f"[fn-logo] ComfyUI: {COMFY_URL}")
    print(f"[fn-logo] checkpoint: {CHECKPOINT}")
    print(f"[fn-logo] dest: {DEST}")
    base_seed = int(os.environ.get("FN_LOGO_SEED", "424242"))

    for idx, item in enumerate(PROMPTS):
        seed = base_seed + idx * 1009
        print(f"\n[fn-logo] [{idx+1}/{len(PROMPTS)}] {item['slug']}  (seed={seed})")
        wf = build_workflow(item["prompt"], NEGATIVE, seed)
        try:
            pid = queue_prompt(wf)
        except urllib.error.HTTPError as e:
            print(f"  queue failed: HTTP {e.code} — {e.read().decode('utf-8', 'ignore')}")
            sys.exit(1)
        print(f"  queued: {pid}")
        files = wait_for_prompt(pid)
        if not files:
            print("  no output produced!")
            continue
        for f in files:
            src = COMFY_OUTPUT / f.get("subfolder", "") / f["filename"]
            dst = DEST / f"{item['slug']}.png"
            shutil.copy2(src, dst)
            print(f"  -> {dst.relative_to(DEST.parent.parent)}")

    # Save the prompt manifest alongside the PNGs so the picks are reproducible.
    manifest = {
        "checkpoint": CHECKPOINT,
        "negative": NEGATIVE,
        "base_seed": base_seed,
        "options": [
            {"slug": p["slug"], "seed": base_seed + i * 1009, "prompt": p["prompt"]}
            for i, p in enumerate(PROMPTS)
        ],
    }
    (DEST / "manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8",
    )
    print(f"\n[fn-logo] done. {len(PROMPTS)} options in {DEST}")


if __name__ == "__main__":
    main()
