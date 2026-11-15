# Flavor Network

**Live: https://neuralflavor.web.app** — frozen at **v1.0.0** (2026-09-01), currently serving **v1.0.4** (fixes and polish only, no features). Web only.

A browser app for cooks who want to know *why* things go together. It puts
3,891 ingredients and 95,992 scored pairings (68,417 observed across 2.2
million real recipes, the rest predicted by a molecular model) behind four working
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

**Invent, in every lab.** Cocktail Lab, Sauce Lab and the Recipe Lab each have an *Invent* panel that starts empty: one question first (which liquor, what the sauce is built on, the main ingredient), then you add every ingredient yourself, by typing or from suggestions. A style, technique or kind of dish is optional; with a few ingredients in, one is recommended from your list and applied only if you accept it, and a checklist shows what it usually has. Ingredients you do not have offer stand-ins, a flavor profile (built from taste labels and aroma notes for each ingredient, weighted by amount; a guide, not a taste test) is drawn from the list, and you name it and save it to your account; your own cocktails and sauces then appear in the lab's list with Edit and Delete, and invented recipes in the Cookbook. "✨ Invent this" on the Cocktail, Sauce and Cookbook search boxes starts the list from what you typed. Amounts are suggestions, an idea from what pairs rather than a tested recipe.

**My bar from a photo.** In Cocktail Lab, My bar → "Add from a photo" reads the labels on a shelf photo and lists the bottles it found; you tick the right ones and only then are they added. Reading uses Google's Gemini, connected one of two ways, set up once on the card the button opens: paste your own free Gemini key from [Google AI Studio](https://aistudio.google.com/apikey) (kept in your browser, the photo goes straight from your browser to Google), or enter an invite code from the site owner, which runs the scan on the owner's key through the `scanBar` Cloud Function (not deployed yet; see `docs/bar-scan-codes.md`). Free keys allow about 20 scans a day.

Signing in (Google or Apple, via Firebase Auth) is optional; it syncs the
cookbook and the personal pairing prior to Firestore. Without sign-in
everything works from `localStorage`.

The original 3D "neural network" view of all 3,891 ingredients still
exists but is parked — open it with `https://neuralflavor.web.app/?path=explore`.

## Sharing a recipe

Every cocktail, sauce and dish has a Share button. It gives a link (`/r/<kind>/<slug>`) that opens the whole recipe without an account, a preview card when the link is pasted into a chat, and picture cards for Instagram and TikTok. A signed-in cook can also publish a recipe they made as a frozen public copy (`/r/<id>`), after a step that shows exactly what becomes public; no name is shown unless they choose one, and they can unshare from Profile, "Shared links". Pages for those copies have a Report link, and the site owner can remove any copy from the Firebase console. Full details, the takedown steps and the deploy command are in [`docs/sharing.md`](docs/sharing.md). Not deployed yet.

**What is recorded about visitors:** nothing. Opening a shared link is not counted and there is no analytics. A report stores the link id, a reason, an optional note and the time, and nothing about who sent it, even if they were signed in. (The limit of 3 reports a day per browser is kept in that browser's own storage.) A shared copy stores its owner's account id, which is never shown.

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
   engine, and it is not the source of the recipe flavor charts.**
   Pairing strength comes from recipe co-occurrence (NPMI + log-count).
   The recipe flavor charts (Recipe Notebook, Invent panels, shared pages
   and cards) are built from a hand-written taste label and aroma notes
   for each ingredient, weighted by amount, and are a guide rather than a
   taste test (`docs/flavor-profile.md`). The GNN's per-ingredient
   taste/odor probabilities only drive single-ingredient wheels and radars
   and the parked 3D views; measured per-ingredient accuracy is too weak
   to rank pairings with (see `.claude/.chemdataset-status.md`).

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
npm run gate         # full vitest suite (131 files) + production build — the
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
(1,427 tests). `functions/` has its own vitest suite
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
| **Wine Reviews** (zynicide, Kaggle — 129,971 reviews) | Aroma profile per Wine Lab style (`public/data/wine_review_aromas.json`) | Source licence **CC BY-NC-SA 4.0**. We ship only aggregate descriptor shares per style, never review text; that file is adapted material and is itself CC BY-NC-SA 4.0 — non-commercial, share-alike. |
| Wine Lab styles (`public/data/wine_styles.json`) | Wine structure, aromas, classic matches | Written for this project from general wine-education knowledge. |
| **Wikipedia** + **Wikimedia Commons** | "About this dish / sauce / drink / wine" stories and photos on the cards (`public/data/dish_stories.json`, built by `scripts/build_dish_stories.mjs`) | Text: 1–2 sentences per article, **CC BY-SA 4.0**, each linked to its article. Photos: only Commons files under CC0, public domain, CC BY or CC BY-SA, credited on the card with artist, licence and file page; hotlinked from upload.wikimedia.org, not stored in this repository. |
| *The Flavor Bible* (Page & Dornenburg, 2008) | — | **Not used or shipped.** Its pairing list was removed from the app, the live site and this repository's history on 2026-11-07. A private local copy is used only to score the pairing engines offline. |

Software: React, Vite, Three.js, onnxruntime-web, RDKit (BSD-3, via
WebAssembly), PyTorch + PyTorch Geometric, Firebase.
