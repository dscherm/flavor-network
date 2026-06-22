# FP-OV-4 — Local on-device model for the flavor-profile description: feasibility spike

**Date:** 2026-06-22 · **Type:** research SPIKE (no production wiring) ·
**Verdict: NO-GO** (keep the FP-OV-2 rule-based generator). A follow-up
implementation task is therefore **not** appended to plan.md.

## Question

Can we augment or replace the FP-OV-2 rule-based flavor description with a
**local** model running in-app via onnxruntime-web (WASM) — explicitly NOT
Claude or any cloud API — and is it worth it?

Input available per recipe: 11 quantity-weighted axis scores + a handful of
ingredient names + the aroma-match signal. Desired output: a 2-4 sentence
chef-style description.

## What the app already does (grounding)

The repo already ships ONNX inference, so the platform question is answered
empirically:

| Asset | Size | Notes |
|---|---|---|
| `public/models/flavor-gnn.onnx` | 0.51 MB | GINEConv taste/odor model |
| `public/models/recipe-setcompletion.onnx` | 4.18 MB | FM-P2 set-completion; **already consumes an 11-axis `profile` + ingredient ids** (`src/ml/recipeRuntime.js`) |
| `public/wasm/ort-wasm-simd-threaded.wasm` | 12.3 MB | onnxruntime-web runtime (non-JSEP) |
| `public/wasm/ort-wasm-simd-threaded.jsep.wasm` | 25.0 MB | JSEP/WebGPU build |
| `public/wasm/RDKit_minimal.wasm` | 6.9 MB | SMILES→mol for the GNN |

- onnxruntime-web `^1.24.3`, **WASM backend, single-thread, SIMD on**, no
  cross-origin isolation (`ort.env.wasm.numThreads = 1`, `wasmPaths='/wasm/'`
  — `src/ml/flavorGnnRuntime.js:171-177`).
- The app is wrapped for iOS via Capacitor (WKWebView). The GNN + set-completion
  models already run there, so onnxruntime-web WASM in WKWebView is proven for
  models in the **single-digit-MB** range.

The binding constraint is therefore **not "can ONNX run in-app"** — it's
**model size + latency + output quality** for a *generative* description model.

## 1. Smallest viable generative seq2seq is ~20× too big

The smallest off-the-shelf instruction-following text-to-text model people
actually run in `transformers.js` is **flan-t5-small** (~80M params). Quantized
ONNX download sizes (Xenova/flan-t5-small `onnx/`):

| variant | encoder | decoder | total |
|---|---|---|---|
| int8 / uint8 | 35.5 MB | 58.5 MB | **94 MB** |
| q4f16 | 43.7 MB | 56.6 MB | ~100 MB |
| quantized (q8) | 35.8 MB | 58.9 MB | ~95 MB |

That is **~22× the 4.18 MB set-completion model** and on the order of the
**entire current model+wasm payload combined**. A genuinely tiny generative LM
(tiny-GPT2 ~30-40 MB q8) is smaller but still ~10× the set-completion model and
is a far worse instruction-follower. `transformers.js` defaults to **q8 on the
WASM backend** precisely because anything larger is bandwidth-prohibitive in a
browser — and 94 MB is large even by that standard.

## 2. WASM single-thread generation latency is poor

Seq2seq decoding is autoregressive (one forward pass per output token). On the
**single-thread WASM** backend this app uses (no WebGPU, no SharedArrayBuffer /
threads because there's no COOP/COEP isolation):

- Public guidance is consistent that decoder-only/seq2seq generation on WASM-CPU
  is **seconds, not milliseconds**, for a few dozen tokens on a small T5; the
  same onnxruntime-web `wasm` path also runs ~1.6-2× slower in-browser than in
  Node. WebGPU would help materially — but the Microsoft "generative AI in the
  browser" work that makes this fast is **WebGPU**-based, which this app does not
  enable and which is unreliable inside iOS WKWebView.
- A 2-4 sentence (~40-60 token) generation would plausibly be **multiple seconds**
  on a mid-range phone — worse than the FP-OV-2 rule generator, which is
  **synchronous and sub-millisecond**.

(Evidence here is order-of-magnitude, not a measured benchmark — flagged as thin.
But the direction is unambiguous: single-thread WASM autoregressive decode is the
slow path, and the only fast path, WebGPU, isn't on the table for iOS.)

## 3. iOS WKWebView is hostile to a 94 MB WASM model

- WebKit caps `WebAssembly.Memory` requests and iOS Safari/WKWebView **OOMs when
  a module asks for a large maximum** (documented at the 2 GB default; people fix
  it by capping WASM max memory to ~256 MB). A ~94 MB model plus the 12 MB ort
  runtime plus RDKit plus the existing models pushes the WebView's memory budget
  on lower-end devices, where WKWebView already reloads/terminates under memory
  pressure (Capacitor has explicit crash-reload handling for exactly this).
- Net: shipping a ~100 MB generative model into the iOS bundle is a real
  stability risk, for a cosmetic feature.

## 4. A templated/classifier model adds ~nothing over FP-OV-2

The realistic on-device alternative to a generative LM is a **classifier /
controlled-NLG** design: a tiny model picks slot values (dominant axis, balance
verdict, mouthfeel bucket, …) and **templates** assemble the sentence. That is
small and fast — but it is **functionally what FP-OV-2 already is**:
`describeRecipeProfile()` already does deterministic slot selection (dominant
taste + driver, balance vs counter-axis, dominant aroma, mouthfeel cue,
aroma-match) over the same inputs. A learned classifier on top would, at best,
reproduce the rules it was trained on (see §5) while adding model weight and a
training pipeline. No quality gain.

For short, **factual, structured** text, a tiny generative LM also carries real
**hallucination risk** (inventing flavors/ingredients not in the bowl) that the
rule system structurally cannot have — a strict downgrade for a tool chefs are
meant to trust.

## 5. The training-data path is circular

The only available supervision is "recipe → description," and we have no human
corpus of those. The proposed bootstrap — generate targets from the FP-OV-2 rule
output + light curation, then distill into a tiny seq2seq — is a known pattern
(distilling a template system into an LM), and its known failure mode applies
directly: **the model learns to imitate the templates**, so the ceiling is the
rule system itself. You spend a training pipeline + 90 MB of model to approximate
what the rules already produce deterministically.

## The decisive argument is data, not size

The size/latency/iOS numbers (§1-§3) are reinforcing, not load-bearing: a
*purpose-built* tiny model (char/word RNN, 2-layer distilled transformer,
retrieval-over-canned-phrases) could be sub-10 MB and fast, so 94 MB does not by
itself bound the design. The load-bearing argument is **§5: the only training
signal we have is the FP-OV-2 rule output**, so any learned model — generative or
classifier, large or tiny — has the rule system as its quality ceiling. There is
no human "recipe → good description" corpus to learn a *better* description from,
and the structured-factual nature of the text means a generative model can only
add hallucination risk, never accuracy. So the verdict does **not** depend on
model size; it holds even for a hypothetical sub-10 MB model.

## Recommendation — NO-GO

Keep the **FP-OV-2 rule-based generator**. It is sub-millisecond, deterministic,
offline, zero-byte-of-model, and cannot hallucinate. A local ONNX description
model has the rules as its ceiling (no training data to exceed them) and adds
hallucination risk; the off-the-shelf generative floor (flan-t5-small) also
piles on **~100 MB + multi-second WASM latency + iOS memory risk**. Either way:
no quality gain on this short structured text.

If richer/varied prose is wanted later, the cheap, safe lever is **expanding the
FP-OV-2 rule templates** (more phrase variety, intensity-graded wording,
optional cuisine-conditioned phrasing) — not an in-browser LM. A cloud LLM would
write better prose, but that is explicitly out of scope (no external API) and
unnecessary for a flavor caption.

**Therefore:** no follow-up implementation task is appended to plan.md (the
"if go" branch of the acceptance criteria does not fire). The ingestion/runtime
infrastructure to revisit this already exists (onnxruntime-web + the
set-completion `profile` input) should a future decision flip to "go" — most
likely only if the app adopts WebGPU and drops iOS-WKWebView as a constraint.

## Sources

- Xenova/flan-t5-small ONNX file sizes — https://huggingface.co/Xenova/flan-t5-small/tree/main/onnx
- Transformers.js (q8 default on WASM, dtype options) — https://huggingface.co/docs/transformers.js/index
- Xenova/flan-t5-small model card — https://huggingface.co/Xenova/flan-t5-small
- ONNX Runtime Web + WebGPU for generative AI (fast path is WebGPU) — https://opensource.microsoft.com/blog/2024/02/29/onnx-runtime-web-unleashes-generative-ai-in-the-browser-using-webgpu/
- onnxruntime-web wasm slower in browser than Node (1.6-2×) — https://github.com/microsoft/onnxruntime/issues/16798
- iOS Safari/WKWebView WebAssembly 2 GB max-memory OOM (cap to ~256 MB) — https://github.com/godotengine/godot/issues/70621
- WebKit Wasm memory boundary bug — https://bugs.webkit.org/show_bug.cgi?id=221530
- Capacitor WKWebView memory-pressure crash/reload handling — https://github.com/ionic-team/capacitor/discussions/5260
