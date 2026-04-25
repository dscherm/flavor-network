import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RAW_DIR, PROCESSED_DIR } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STEPS = [
  {
    num: 1,
    name: 'Parse RecipeNLG',
    script: './01-parse-recipenlg.js',
    flag: 'recipenlg',
    prereq: () => {
      const csv = path.join(RAW_DIR, 'recipenlg.csv');
      if (!fs.existsSync(csv)) return `Missing ${csv} — download from Kaggle first`;
      return null;
    },
  },
  {
    num: 2,
    name: 'Fetch FlavorDB',
    script: './02-fetch-flavordb.js',
    flag: 'flavordb',
    prereq: () => null, // no prerequisite files
  },
  {
    num: 3,
    name: 'Fetch TheMealDB',
    script: './03-fetch-mealdb.js',
    flag: 'mealdb',
    prereq: () => null,
  },
  {
    num: 4,
    name: 'Fetch TheCocktailDB',
    script: './04-fetch-cocktaildb.js',
    flag: 'cocktaildb',
    prereq: () => null,
  },
  {
    num: 5,
    name: 'Blend all sources',
    script: './05-blend.js',
    flag: 'blend',
    prereq: () => {
      // At least one processed file should exist
      const files = [
        'recipenlg-cooccurrence.json',
        'flavordb-overlap.json',
        'mealdb-cooccurrence.json',
        'cocktaildb-cooccurrence.json',
      ];
      const existing = files.filter(f => fs.existsSync(path.join(PROCESSED_DIR, f)));
      if (existing.length === 0) {
        return 'No processed source files found. Run steps 1-4 first.';
      }
      return null;
    },
  },
  {
    num: 8,
    name: 'Derive recipe_pairs.json (slim browser asset)',
    script: './08-derive-recipe-pairs.js',
    flag: 'recipe-pairs',
    prereq: () => {
      const f = path.join(PROCESSED_DIR, 'recipenlg-cooccurrence.json');
      if (!fs.existsSync(f)) return `Missing ${f}. Run step 1 first.`;
      return null;
    },
  },
  {
    num: 9,
    name: 'Derive cocktail-codex clusters',
    script: './09-derive-cocktail-clusters.js',
    flag: 'cocktail-clusters',
    prereq: () => {
      const dir = path.join(__dirname, '..', 'raw', 'cocktaildb');
      if (!fs.existsSync(dir)) return `Missing ${dir}. Run step 4 first.`;
      return null;
    },
  },
  {
    num: 10,
    name: 'Derive mother-sauce clusters',
    script: './10-derive-sauce-clusters.js',
    flag: 'sauce-clusters',
    prereq: () => null, // reads public/data/sauce_augment.json which is checked in
  },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { step: null, skipRecipenlg: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--step' && args[i + 1]) {
      result.step = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === '--skip-recipenlg') {
      result.skipRecipenlg = true;
    }
  }

  return result;
}

function ts() {
  return new Date().toISOString().slice(11, 19);
}

async function main() {
  const opts = parseArgs();
  console.log(`\n[${ts()}] === Flavor Network Pro Dataset Pipeline ===\n`);

  const stepsToRun = STEPS.filter(s => {
    if (opts.step !== null) return s.num === opts.step;
    if (opts.skipRecipenlg && s.num === 1) return false;
    return true;
  });

  if (stepsToRun.length === 0) {
    console.error('No steps to run. Check --step value.');
    process.exit(1);
  }

  console.log(`Steps to run: ${stepsToRun.map(s => s.num).join(', ')}\n`);

  const timings = [];

  for (const step of stepsToRun) {
    // Check prerequisites
    const prereqError = step.prereq();
    if (prereqError) {
      console.error(`[${ts()}] SKIP Step ${step.num} (${step.name}): ${prereqError}\n`);
      timings.push({ num: step.num, name: step.name, ms: 0, status: 'SKIPPED' });
      continue;
    }

    console.log(`[${ts()}] ── Step ${step.num}: ${step.name} ──`);
    const start = performance.now();

    try {
      await import(step.script);
      const elapsed = Math.round(performance.now() - start);
      timings.push({ num: step.num, name: step.name, ms: elapsed, status: 'OK' });
      console.log(`[${ts()}] Step ${step.num} completed in ${(elapsed / 1000).toFixed(1)}s\n`);
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      timings.push({ num: step.num, name: step.name, ms: elapsed, status: 'FAILED' });
      console.error(`[${ts()}] Step ${step.num} FAILED after ${(elapsed / 1000).toFixed(1)}s`);
      console.error(err);
      console.error('');
      // Continue to next step instead of aborting entirely
    }
  }

  // Print summary
  console.log(`\n[${ts()}] === Pipeline Summary ===`);
  console.log('─'.repeat(55));
  console.log(`${'Step'.padEnd(6)} ${'Name'.padEnd(25)} ${'Time'.padStart(10)} ${'Status'.padStart(10)}`);
  console.log('─'.repeat(55));
  for (const t of timings) {
    const time = t.ms > 0 ? `${(t.ms / 1000).toFixed(1)}s` : '-';
    console.log(`${String(t.num).padEnd(6)} ${t.name.padEnd(25)} ${time.padStart(10)} ${t.status.padStart(10)}`);
  }
  console.log('─'.repeat(55));

  const totalMs = timings.reduce((sum, t) => sum + t.ms, 0);
  console.log(`Total: ${(totalMs / 1000).toFixed(1)}s\n`);

  const failed = timings.filter(t => t.status === 'FAILED');
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
