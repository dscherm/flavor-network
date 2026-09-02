# Flavor Network

**Live: https://neuralflavor.web.app** — frozen at **v1.0.0** (2026-09-01). Web only.

A browser app for cooks who want to know *why* things go together. It puts
3,891 ingredients and 95,992 scored pairings (68,417 observed across 2.2
million real recipes, the rest predicted by a molecular taste/odor model) behind four working
surfaces: a cocktail lab, a sauce lab, a pairing explorer, and a
"make a recipe" flow with a handwritten-notebook cookbook.

> **Status:** finished, not abandoned. The live site is the only
> distribution channel and is not receiving features. `CLOSEOUT.md` has
> the release notes and where to start if you return; `BACKLOG.md` lists
> everything that was deliberately not built.

## What's in the app

The landing page offers two doors:

| Door | What it opens |
|---|---|
| **The Labs** | **Cocktail Lab** — 441 cocktails in the 6 *Cocktail Codex* families (Old-Fashioned, Martini, Daiquiri, Sidecar, Whisky Highball, Flip) and 15 sub-clusters, as a 3D graph; build a drink, get "suggested next" ingredients. **Sauce Lab** — 77 curated sauces in the 10 mother families (Escoffier's five + Curry, Stir-fry, Mole, Salsa, Nut Sauce). **Pairing Lab** — pick an ingredient, see its strongest pairings and the compounds that explain them. **Recipe Notebook** — a 2D canvas notebook for assembling a bowl of ingredients with phase-aware suggestions. |
| **Make a recipe** | Start from ingredients, a cuisine, or a recipe URL (parsed server-side by a Cloud Function); an on-device set-completion model (ONNX, runs in the browser) proposes what to add next. Save to the **Cookbook**. |

Signing in (Google or Apple, via Firebase Auth) is optional; it syncs the
cookbook and the personal pairing prior to Firestore. Without sign-in
everything works from `localStorage`.

The original 3D "neural network" view of all 3,891 ingredients still
exists but is parked — open it with `https://neuralflavor.web.app/?path=explore`.

## Architecture

```
  ┌──────────────────────────────┐   ┌──────────────────────────────┐
  │  proDataset/  (Node.js)      │   │  chemDataset/  (Node.js)     │
  │  RecipeNLG · TheMealDB ·     │   │  FooDB · FlavorDB ·          │
  │  TheCocktailDB · FlavorDB    │   │  ChemTastesDB · BitterDB ·   │
  │  → co-occurrence, NPMI,      │   │  SuperSweetDB · FlavorNet ·  │
  │    cuisine tags, codex parse │   │  FartDB · PubChem SMILES     │
  └──────────────┬───────────────┘   └──────────────┬───────────────┘
                 │ ingredients.json,                 │ compounds.parquet
                 │ pairings.json, …                  ▼
                 │                    ┌──────────────────────────────┐
                 │                    │  flavor-gnn/  (Python)       │
                 │                    │  GINEConv MPNN, 11 heads     │
                 │                    │  (5 tastes + 6 odors), plus  │
                 │                    │  the set-completion model    │
                 │                    │  → gnn_*.json, *.onnx,       │
                 │                    │    layouts, cluster labels   │
                 │                    └──────────────┬───────────────┘
                 ▼                                   ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │  public/proDataset · public/data · public/models  (committed)    │
  └──────────────────────────────┬───────────────────────────────────┘
                                 ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │  src/  React 18 + Vite · Three.js (3D labs) · Canvas 2D (notebook)│
  │  onnxruntime-web (set-completion, in-browser) · RDKit wasm        │
  └──────────────────────────────┬───────────────────────────────────┘
                                 ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │  Firebase project `neuralflavor`                                  │
  │  Hosting (dist/) · Auth (Google, Apple) · Firestore (profiles/)   │
  │  Cloud Function `scrapeRecipe` (functions/, TypeScript)           │
  └──────────────────────────────────────────────────────────────────┘
```

Three things worth understanding about this shape:

1. **All served data is committed.** `public/` holds the finished JSON,
   binary and ONNX files (~220 MB). Cloning and building requires no
   pipeline run, no Python, and no raw datasets. The pipelines exist to
   *regenerate* those files, not to build the app.
2. **Inference happens in the browser.** The set-completion model and the
   compound viewer run client-side with onnxruntime-web and RDKit
   compiled to WebAssembly. The only server-side code is one Cloud
   Function that fetches and parses a recipe URL (server-side to avoid
   CORS and to sandbox SSRF).
3. **The molecular model is an explanation surface, not the pairing
   engine.** Pairing strength comes from recipe co-occurrence (NPMI +
   log-count). The GNN's taste/odor probabilities drive radar charts and
   "why" text; measured per-ingredient accuracy is too weak to rank
   pairings with (see `.claude/.chemdataset-status.md` for the numbers).

### Repository map

```
src/                 React app. App.jsx routes tabs; components/ holds the
                     labs, notebook, make flow, cookbook; three/ the 3D
                     scene; data/ the graph/scoring math; hooks/useProData
                     loads everything under public/.
public/proDataset/   Ingredient + pairing dataset, cluster labels, layouts,
                     GNN outputs (served as-is)
public/data/         Curated cocktail/sauce/cuisine augment files
public/models/       ONNX models + vocab/index files for in-browser inference
public/wasm/         Copied from node_modules by scripts/copy_wasm.cjs (gitignored)
functions/           Cloud Function `scrapeRecipe` (TypeScript, vitest)
proDataset/          Pairing-dataset pipeline (Node). scripts/ run in
                     numbered order; data/ holds hand-curated inputs
chemDataset/         Compound-dataset fetchers + validation suite (Node)
flavor-gnn/          Molecular GNN, set-completion model, layouts (Python)
scripts/             Build helpers (pairings binary, wasm copy, gate) and
                     Playwright QA scripts
docs/                Live specs for the shipped surfaces; docs/archive/ is
                     history; docs/{privacy,support} are the GitHub Pages site
lessons/, .claude/, ralph.sh, schermness.config.json, plan.md, activity.md,
public_api.md        Autonomous-agent harness files (schermness). Inert
                     unless you run the harness; kept so the project stays
                     enrollable.
```

## Run it locally

Requires Node 20+ (built with Node 24).

```bash
npm ci
npm run dev          # http://localhost:5173
```

```bash
npm run gate         # full vitest suite (132 files) + production build — the
                     # pre-commit check; must be green
npm run build        # dist/
npm run preview      # serve dist/ locally
```

Optional — the PDF/photo recipe import in the Profile panel needs the local
Express API with a Gemini key. Copy `.env.example` to `.env`, fill
`GEMINI_API_KEY`, then:

```bash
npm run api          # http://localhost:3001; Vite proxies /api/* to it in dev
```

That API is development-only; nothing on the live site calls it.

## Deploy

Firebase project `neuralflavor` (see `.firebaserc`). You need
`firebase-tools` and access to the project.

```bash
npm run gate
firebase deploy --only hosting            # web app → https://neuralflavor.web.app
firebase deploy --only functions          # scrapeRecipe (builds functions/ first)
firebase deploy --only firestore:rules    # profiles/{uid} owner-only rules
```

`firebase.json` sets `no-cache` on `index.html` and the versioned dataset
files so a deploy propagates within a minute; hashed `assets/*` are
immutable. Dataset snapshot files (`*.bak`, `*.pre-*`) are excluded from
upload.

Auth providers, `authDomain`, and the callable's CORS allow-list are
configured in the Firebase and Google Cloud consoles, not in this repo;
`.claude/skills/firebase-auth/SKILL.md` records every field and the
failure each one produces when wrong.

## Regenerating the datasets

You never need to do this to run or deploy the app. If you want to change
the data:

**Pairing dataset (`proDataset/`)** — needs the RecipeNLG CSV (~2.2 GB)
from Kaggle at `proDataset/raw/recipenlg.csv`; the other sources are
fetched by the scripts and cached under `proDataset/raw/` (gitignored).

```bash
cd proDataset && npm install
npm run all                    # scripts 01…19 in order → proDataset/output/
cp output/*.json ../public/proDataset/     # publish to the app
cd .. && npm run build:pairings            # repack public/proDataset/pairings.bin
```

`proDataset/processed/pair-features.json` (~110 MB) is a regenerable
intermediate and is gitignored. Hand-curated inputs (cuisine additions,
manual pairings, the *Cocktail Codex* source) live in `proDataset/data/`.

**Compound dataset (`chemDataset/`)** — `node scripts/NN-fetch-*.js` in
order, then `10-blend.js`. FooDB is a ~1 GB bulk download; the rest are
rate-limited scrapes or Zenodo/GitHub pulls. `npm run validate:pairings`
runs the chef-curated validation suite.

**Molecular GNN and layouts (`flavor-gnn/`)** — Python ≥ 3.10; install
from `flavor-gnn/pyproject.toml` into `flavor-gnn/.venv`. Training and
export are the `fm_*`, `aggregate_predictions.py` and layout scripts under
`flavor-gnn/scripts/`; `npm run bake:flavor-pipeline` runs the layout +
graph bake that writes `public/proDataset/flavor_*.json`. Trained
artifacts are in `flavor-gnn/artifacts/`; training tensors and the
RecipeNLG-derived corpus (`flavor-gnn/data/`, ~800 MB) are gitignored and
rebuilt by `fm_p0_*`.

The honest state of the model — what lifted accuracy, what didn't, and the
experiments not to repeat — is in `.claude/.chemdataset-status.md`.

## Tests

`npm test` runs vitest over `src/**` and `chemDataset/validation/**`
(1,438 tests). `functions/` has its own vitest suite
(`npm --prefix functions test`). `scripts/qa-*.mjs` are Playwright
walkthroughs that write screenshots to `.playwright-shots/` (gitignored).

## Credits and data licenses

This repository's **code** is MIT-licensed (`LICENSE`). The **data** under
`public/` is derived from the sources below, each under its own terms.
Nothing here re-distributes any source dataset; what ships is aggregate
statistics (co-occurrence counts, scores, cluster assignments, model
weights). Verify the current terms of each source before any commercial
use.

| Source | Used for | Terms (as understood at the freeze) |
|---|---|---|
| **RecipeNLG** (Bień et al., 2020) | Ingredient co-occurrence and PMI from 2.2 M recipes; set-completion training corpus | **Research use only.** We ship derived aggregate statistics and model weights, never recipe text. The CSV is not in the repo. |
| **FlavorDB / FlavorDB2** (Garg et al., IIIT-Delhi) | Shared-compound pairing signal; taste/odor descriptors | Academic use; cite the FlavorDB paper. No explicit license published. |
| **TheMealDB** | Cuisine-tagged co-occurrence (595 meals) | Free API for education/development with attribution; commercial use requires a supporter key. |
| **TheCocktailDB** | Cocktail co-occurrence (426 drinks) | Same terms as TheMealDB. |
| **FooDB** (Wishart Lab) | Food → compound mapping | CC BY-NC 4.0. |
| **ChemTastesDB v2.1** (Zenodo 15051366) | Taste labels for the GNN | See the Zenodo record's license. |
| **BitterDB** (Hebrew University) | Bitter labels | Free for academic use. |
| **SuperSweetDB** | Sweet labels | Academic use. |
| **FlavorNet** (Acree & Arn, Cornell) | Odor descriptors | Free for non-commercial use with attribution. |
| **FART / FartDB** (github.com/fart-lab/fart) | 14.5 k taste-labelled compounds, incl. pKa-derived sour labels | See that repository's license. |
| **PubChem** (NCBI) | Canonical SMILES | Public domain. |
| *Cocktail Codex* (Day, Fauchald, Kaplan, 2018) and *Le Guide Culinaire* (Escoffier, 1903) | Family taxonomies only | Taxonomy used as a classification scheme; no text reproduced. |

Software: React, Vite, Three.js, onnxruntime-web, RDKit (BSD-3, via
WebAssembly), PyTorch + PyTorch Geometric, Firebase.
