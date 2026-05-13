# chemDataset/validation

External validation harness for the shipped pairing model. Phase 1 of the
"pairing audit + guided discovery" plan
(`.omc/plans/pairing-audit-and-guided-discovery-v2.md`, Critic-APPROVED iter 2).

## Why this lives here

`chemDataset/validation/` is external validation tooling — it does NOT modify
the production pipeline under `proDataset/scripts/**` and is not consumed by
the shipped React app under `src/**`. It reads `public/proDataset/pairings.json`
(the already-ranked output of `proDataset/scripts/07-blend-v2.js`) and grades
it against human-curated ground truth.

This placement matches Critic Open Question #1 of the consensus plan: the
harness is neither part of the data pipeline nor part of the app. It is a
sibling utility under `chemDataset/` because that's where the chemistry
sources already live (FooDB, FlavorDB, etc.) and where future
chemistry-driven validators will land.

## Hard rules (Executor Handoff Constraints)

1. **NEVER recomputes pairing strength.** Input is the already-ranked
   `pairings.json`. The harness imports nothing from `proDataset/scripts/**`
   for runtime behavior — it only reads `07-blend-v2.js` as text to extract
   the `DEFAULT_WEIGHTS` const for the hash gate.

2. **Per-axis verdict gated on `n >= 15`.** Axes below threshold report
   `insufficient (n=Y, target >= 15)`. Healthier axes get a pass/warn/fail
   verdict. This is NOT a global gate — one slow axis does not block the
   others.

## Files

- `score_pairings.js` — CLI entry point. Pure ESM, no React/three.js deps.
- `ground_truth.json` — human-curated seed corpus of 30 pairings (Phase 1
  baseline). Schema: `{ version, generatedAt, pairings: [{ a, b, sources, strength_book, axes_validated }] }`.
- `lib/metrics.js` — pure rank/set arithmetic (`precisionAt`, `recallAt`,
  `beyondBookAt`, `axisDistribution`, `verdictGate`, `crossSourceAgreement`).
- `lib/axes.js` — surprise-axis classifiers: `chem-bridged-rare`,
  `absent-from-books`, `cross-cuisine`, `cross-aroma`.
- `__tests__/metrics.test.js` — vitest unit tests for the metric helpers.
- `__tests__/score_pairings.test.js` — vitest integration tests covering the
  hash gate, per-axis verdict gating, and a smoke test against the real
  shipped data.
- `reports/audit-FIRST.md` — first-run baseline (committed). Subsequent
  daily reports go to `reports/audit-{YYYY-MM-DD}.md` (gitignored). The
  latest run is mirrored to `reports/LATEST.md` so the next run's hash gate
  has a stable anchor.

## Running it

```bash
# default: refuses to run if previous report's scoredAgainst or weightsHash differ
npm run validate:pairings

# bypass the staleness gate (e.g. you regenerated metadata.json deliberately)
npm run validate:pairings -- --allow-stale

# bypass the weight-hash gate (e.g. you re-ran 07-blend-v2.js with a trained
# perceptron and the hash legitimately changed)
npm run validate:pairings -- --allow-weight-change

# first run of the harness (writes reports/audit-FIRST.md instead of audit-{date}.md)
node chemDataset/validation/score_pairings.js --first-run --allow-stale
```

Tests:

```bash
# all chemDataset/validation tests
npm run test:audit

# whole project (vitest)
npm test
```

## Contributing to `ground_truth.json`

Rules:

1. **Publicly visible references only.** Every entry must cite a
   `sources[].ref` and `sources[].url` reachable from a normal browser
   (book preview, Amazon look-inside, magazine article, chef interview,
   recipe blog, etc.).
2. **Ingredient names must match `public/proDataset/ingredients.json`
   exactly** — lowercase, singular-as-stored (`salmon`, not `Salmon` or
   `salmons`). Where the canonical book reference uses an ingredient we do
   not ship (e.g. `oyster`, `kiwi`), substitute the closest dataset entry
   (e.g. `oyster sauce`, `kiwi fruit`) and document the substitution in the
   source `ref`.
3. **Axis labels are drawn from the canonical four:**
   `chem-bridged-rare`, `absent-from-books`, `cross-cuisine`, `cross-aroma`.
   Tag every entry with at least one axis so the per-axis verdict gate has
   signal.
4. **`strength_book`** uses Flavor Bible's star rating (`★`, `★★`, `★★★`)
   when the source is the Bible. Use `null` for Flavor Matrix entries (no
   numeric strength in that book) and chef-cite entries.
5. **Avoid relying on copyrighted lists.** Cite individual pairings, not
   bulk lifts. The whole point of the harness is to validate a small,
   defensible corpus, not to recreate a copyrighted book.

To grow the corpus:

1. Find the pairing in a publicly-visible reference.
2. Confirm both ingredient names exist in `public/proDataset/ingredients.json`.
3. Add an entry to `pairings[]` with proper source attribution.
4. Run `npm run test:audit` (the smoke test will catch malformed entries).
5. Run `npm run validate:pairings -- --allow-stale` and verify the report
   shows your new entry under the right axis.
6. Commit just `chemDataset/validation/ground_truth.json` and the new
   `reports/audit-{YYYY-MM-DD}.md` if you want the run committed.

## Audit report structure

Each report has:

- Header block (parsed on next run for hash-gate anchoring):
  - `runDate`, `scoredAgainst` (= `metadata.gnnTrainedAt`), `weightsHash`,
    `pairingCount`, `groundTruthCount`.
- Per-axis verdict table (n / P@10 / R@20 / beyondBook@10 / axis pair count / verdict).
- Top 10 illustrative pairings per axis (rank, pair, strength, GT match flag, shared compounds).
- Data-source health (FB / Matrix / chef-cite counts, FlavorDB API health proxy via x3==0.5 rate).
- Coverage delta vs `LATEST.md` (first run is all-new).
- Verdict paragraph (one bullet per axis).
- `curatedStoryCompoundOverlapRate` (N/A until Phase 4 fixture lands).

## Phase 1.5: Perceptron Ablation

SGD-based perceptron weight ablation against `ground_truth.json` labels.
Implemented in `ablate_perceptron.js`. READ-ONLY against shipped weights —
it never modifies any file under `proDataset/`.

### The gate (n >= 15 per axis)

The ablation tool refuses to run unless every axis present in
`ground_truth.json` has at least 15 labeled entries. With the current
30-entry seed corpus the per-axis breakdown is:

- `cross-aroma`: 30 entries — **ready**
- `cross-cuisine`: 10 entries — **insufficient**
- `absent-from-books`: 9 entries — **insufficient**
- `chem-bridged-rare`: 2 entries — **insufficient**

The tool exits with code 2 and a clear per-axis message. Growing
`ground_truth.json` to n >= 15 on the three weak axes is the path forward.
Adding entries follows the same rules as the audit corpus (publicly visible
references, names matching `ingredients.json` exactly).

### Write-protection guarantee

`safeWrite(targetPath, content)` is a thin wrapper around `fs.writeFileSync`
that resolves the target path and asserts it is under
`chemDataset/validation/`. Any attempt to write to `proDataset/**`,
`public/proDataset/**`, or any other directory throws immediately with a
`Write-protection violation` error. The CLI itself only ever calls
`safeWrite`, so production weight files are unreachable from this script.

### CLI flags

```bash
# default run (exits with gate-fail until ground_truth grows)
npm run validate:ablate

# bypass gnnTrainedAt staleness check
npm run validate:ablate -- --allow-stale

# override hyperparameters
npm run validate:ablate -- --lr 0.05 --epochs 200 --l2 0.0001

# skip writing output files; print summary only
npm run validate:ablate -- --dry-run
```

All flags may be combined: `--allow-stale --dry-run --lr 0.05`.

### Output schema (`ablation/run-{YYYY-MM-DD}.json`)

```jsonc
{
  "runDate": "<ISO timestamp>",
  "scoredAgainst": "<metadata.gnnTrainedAt>",
  "weightsHash": "<sha256 of {weights, bias}>",
  "groundTruthCount": 30,
  "perAxisCounts": { "cross-aroma": 30, "cross-cuisine": 10, ... },
  "matchedPairCount": 12,       // GT entries that joined to pair-features.json
  "preWeights": [2.0, 0.5, 2.5, 1.5, 1.0, 0.8, 0.3, 1.2],
  "preBias": -3.0,
  "postWeights": [...],         // weights after SGD
  "postBias": ...,
  "deltaWeights": [...],        // postWeights - preWeights element-wise
  "topFiveDeltaFeatures": [
    { "index": 2, "name": "x3_chemical_overlap", "delta": 0.42 },
    ...
  ],
  "lossCurve": [
    { "epoch": 0, "loss": 1.23 },
    ...
  ],
  "finalLoss": 0.45,
  "recommendation": "raise x3_chemical_overlap weight; current 2.500 -> suggested 2.920"
}
```

A markdown summary is emitted alongside at
`chemDataset/validation/reports/ablation-{YYYY-MM-DD}.md`.
Both outputs are gitignored (see `.gitignore`).

### Prerequisite: `proDataset/processed/pair-features.json`

`ablate_perceptron.js` reads feature vectors from
`proDataset/processed/pair-features.json`. This file is produced by the
proDataset pipeline (`proDataset/scripts/07-blend-v2.js`) and is not
committed. If it is absent the CLI reports:

```
feature file not found at <path>; ablation requires the proDataset pipeline to have run
```

and exits with code 2 (no unhandled exception).
