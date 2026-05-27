// DREAM Olfaction Challenge ingest (Keller & Vosshall 2016).
// Source: github.com/pyrfume/pyrfume-data/tree/main/keller_2016
//
// 480 chemically-diverse odorant molecules × 21 perceptual descriptors,
// expert-rated 0-100 by 55 subjects. Reference for the DREAM Olfaction
// Prediction Challenge (Keller et al. 2017, Science).
//
// Pyrfume-data hosts a re-organized version of the supplementary
// dataset from Keller & Vosshall 2016 (BMC Neuroscience) — molecule
// SMILES + per-subject ratings — under a permissive open license.
//
// Mapping
// -------
// DREAM has 21 descriptors. Eight map cleanly to our 11-head vocabulary:
//   SWEET  → sweet
//   SOUR   → sour
//   ACID   → sour  (acidic sensation; merged with SOUR per Keller's
//                   own observation that ACID and SOUR cluster)
//   WOOD   → odor_woody
//   GRASS  → odor_green
//   FLOWER → odor_floral
//   FRUIT  → odor_fruity
//   SPICES → odor_spicy
//
// odor_fatty has no clean DREAM analogue (MUSKY is the closest but
// semantically diverges); it is intentionally left unmapped. odor_spicy
// is mapped but per N2-GNN-DREAM AC is excluded from improvement
// expectations (TRPV1-mediated, not olfaction).
//
// salty + bitter + umami: DREAM doesn't measure tastes, so those heads
// get no new positives — same DREAM contributes to odor heads only.
//
// Aggregation
// -----------
// For each (CID, descriptor) we take the mean rating across all subjects
// and replicates at the 1/1000 concentration (the canonical Keller
// reference stimulus). A compound is a positive for a descriptor when
// its mean rating ≥ POSITIVE_THRESHOLD (default 20 on 0-100 scale,
// chosen so we get roughly the documented ~30-50 positives per head
// rather than collapsing to only the most extreme).
//
// Emits processed/dream.json:
//   { compounds: { <smiles>: { smiles, cid, odor_name,
//                              ratings: { fruity: float, floral: float, … },
//                              labels: { sweet: 0|1, sour: 0|1, … } } } }

import { promises as fs } from 'node:fs';
import { createReadStream, createWriteStream, readFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import readline from 'node:readline';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { RAW, PROCESSED, ensureDir, writeJson } from './common.js';

const SOURCE_ROOT = 'https://raw.githubusercontent.com/pyrfume/pyrfume-data/main/keller_2016';
const DIR = path.join(RAW, 'dream');

// Files we need: molecules (SMILES + CID), stimuli (Stimulus→CID),
// behavior (per-subject ratings — large, ~68 MB).
const FILES = ['molecules.csv', 'stimuli.csv', 'behavior.csv'];

// DREAM 21 descriptor → our 11-head vocab.
//
// IMPORTANT: DREAM's SWEET, SOUR, and ACID descriptors are *olfactory
// perception* ratings ("does this smell sweet/sour/acidic") — NOT taste
// signals. Feeding them into our taste heads regressed sweet (-0.006),
// bitter (-0.020), and sour (-0.049) F1 on the first retrain attempt
// (compare_dream_lift report, 2026-05-26). DREAM is pure olfaction;
// only the five aroma descriptors that map cleanly to our odor heads
// are kept. BAKERY/BURNT/MUSKY/CHEMICAL/SWEATY/etc don't have a clean
// analogue in our 6-term odor vocab and are intentionally dropped.
const DESCRIPTOR_MAP = {
  'WOOD':   ['odor_woody'],
  'GRASS':  ['odor_green'],
  'FLOWER': ['odor_floral'],
  'FRUIT':  ['odor_fruity'],
  'SPICES': ['odor_spicy'],
};

// Map keyed by canonical head → list of (DREAM descriptor) inputs.
const HEAD_INPUTS = {};
for (const [dream, heads] of Object.entries(DESCRIPTOR_MAP)) {
  for (const h of heads) {
    (HEAD_INPUTS[h] ||= []).push(dream);
  }
}

// 30 on the 0-100 mean-of-55-subjects scale picks ~90-200 clear positives
// per head. At 20 we drown in noise (median rating per head is 20-30);
// at 40+ we collapse to a handful of extreme outliers (per the rating
// distribution analysis in flavor-gnn/artifacts/dream_threshold.json).
const POSITIVE_THRESHOLD = 30.0;
const REFERENCE_RATIO = '1/1000'; // Keller's main reference concentration

async function exists(p) { try { await fs.stat(p); return true; } catch { return false; } }

async function download(url, dest) {
  console.log(`[dream] downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

async function ensureSources() {
  await ensureDir(DIR);
  for (const f of FILES) {
    const dest = path.join(DIR, f);
    if (!(await exists(dest))) {
      await download(`${SOURCE_ROOT}/${f}`, dest);
    }
  }
}

function loadMolecules() {
  const text = readFileSync(path.join(DIR, 'molecules.csv'), 'utf8');
  const rows = parse(text, { columns: true, skip_empty_lines: true });
  const byCid = new Map();
  for (const row of rows) {
    const cid = String(row['CID'] || '').trim();
    const smiles = (row['CanonicalSMILES'] || '').trim();
    if (cid && smiles) {
      byCid.set(cid, {
        cid,
        smiles,
        odor_name: (row['OdorName'] || '').trim(),
        cas: (row['CAS'] || '').trim(),
      });
    }
  }
  return byCid;
}

function loadStimuli() {
  const text = readFileSync(path.join(DIR, 'stimuli.csv'), 'utf8');
  const rows = parse(text, { columns: true, skip_empty_lines: true });
  // Filter to the reference 1/1000 concentration — the high-intensity
  // stimulus that most matches "what does this molecule smell like."
  const stimToCid = new Map();
  for (const row of rows) {
    const stim = String(row['Stimulus'] || '').trim();
    const cid = String(row['CIDs'] || '').trim();
    const ratio = (row['Ratio'] || '').trim();
    if (stim && cid && ratio === REFERENCE_RATIO) {
      stimToCid.set(stim, cid);
    }
  }
  return stimToCid;
}

async function streamBehavior(filePath, stimToCid, dreamDescriptors) {
  // Stream the 68 MB behavior.csv line-by-line. Aggregate (cid, descriptor)
  // → array of float ratings. We mean later.
  const input = createReadStream(filePath, 'utf8');
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let header = null;
  let cIdx = null;
  const sums = new Map();   // key: `${cid}::${descriptor}` → {sum, n}
  let totalLines = 0;
  let kept = 0;
  for await (const raw of rl) {
    totalLines++;
    if (!header) {
      // CSV header parsed manually
      header = parse(raw, { columns: false })[0];
      cIdx = {
        stim: header.indexOf('Stimulus'),
        mv:   header.indexOf('MeasurementValue'),
        val:  header.indexOf('Value'),
      };
      continue;
    }
    const cells = parse(raw, { columns: false })[0];
    if (!cells) continue;
    const stim = String(cells[cIdx.stim] ?? '').trim();
    const cid = stimToCid.get(stim);
    if (!cid) continue;
    const mv = String(cells[cIdx.mv] ?? '').trim();
    if (!dreamDescriptors.has(mv)) continue;
    const v = parseFloat(cells[cIdx.val]);
    if (!Number.isFinite(v)) continue;
    const key = `${cid}::${mv}`;
    const entry = sums.get(key) || { sum: 0, n: 0 };
    entry.sum += v;
    entry.n += 1;
    sums.set(key, entry);
    kept++;
    if (totalLines % 200000 === 0) {
      console.log(`[dream] streamed ${totalLines} lines, kept ${kept}`);
    }
  }
  console.log(`[dream] streamed ${totalLines} lines total, kept ${kept} rating cells`);
  return sums;
}

async function main() {
  await ensureSources();
  const byCid = loadMolecules();
  console.log(`[dream] loaded ${byCid.size} molecules with SMILES`);
  const stimToCid = loadStimuli();
  console.log(`[dream] loaded ${stimToCid.size} stimuli at ${REFERENCE_RATIO} concentration`);

  const dreamDescriptors = new Set(Object.keys(DESCRIPTOR_MAP));
  const sums = await streamBehavior(path.join(DIR, 'behavior.csv'), stimToCid, dreamDescriptors);

  // Aggregate (cid, descriptor) → mean rating.
  const meanByCidDescriptor = new Map();
  for (const [key, { sum, n }] of sums.entries()) {
    if (n > 0) meanByCidDescriptor.set(key, sum / n);
  }

  // Collapse to (smiles, head) → mean rating (max across contributing
  // DREAM descriptors when multiple map to the same head, e.g.
  // SOUR + ACID → sour).
  const compounds = {};
  const headHits = {};
  for (const h of Object.keys(HEAD_INPUTS)) headHits[h] = 0;
  for (const [cid, mol] of byCid.entries()) {
    const ratings = {};
    const labels = {};
    let anyRating = false;
    for (const [head, dreams] of Object.entries(HEAD_INPUTS)) {
      let best = null;
      for (const d of dreams) {
        const v = meanByCidDescriptor.get(`${cid}::${d}`);
        if (typeof v === 'number') {
          best = best === null ? v : Math.max(best, v);
        }
      }
      if (best !== null) {
        ratings[head] = Math.round(best * 100) / 100;
        labels[head] = best >= POSITIVE_THRESHOLD ? 1 : 0;
        if (labels[head]) headHits[head]++;
        anyRating = true;
      }
    }
    if (anyRating) {
      compounds[mol.smiles] = {
        smiles: mol.smiles,
        cid: mol.cid,
        odor_name: mol.odor_name,
        ratings,
        labels,
      };
    }
  }

  console.log(`[dream] kept ${Object.keys(compounds).length} compounds with ≥1 mapped head`);
  console.log(`[dream] per-head positives (rating ≥ ${POSITIVE_THRESHOLD}):`);
  for (const [h, n] of Object.entries(headHits)) {
    console.log(`         ${h.padEnd(14)} ${n}`);
  }

  await ensureDir(PROCESSED);
  await writeJson(path.join(PROCESSED, 'dream.json'), {
    _meta: {
      source: 'pyrfume-data/keller_2016 (Keller & Vosshall 2016 / DREAM Olfaction Challenge)',
      reference_concentration: REFERENCE_RATIO,
      descriptor_map: DESCRIPTOR_MAP,
      positive_threshold: POSITIVE_THRESHOLD,
      n_compounds: Object.keys(compounds).length,
      head_positive_counts: headHits,
    },
    compounds,
  });
  console.log(`[dream] wrote ${path.join(PROCESSED, 'dream.json')}`);
}

await main();
