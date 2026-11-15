// DATA-2 guard: nothing under src/ may read the generated ingredient / pairing files or build the
// ingredient graph except through the curated loader (src/data/curation/loadDataset.js). Otherwise a
// merged or hidden ingredient comes back from the dead in whichever module forgot to ask.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const SRC = resolve(__dirname, '..');
const LOADER = 'data/curation/loadDataset.js';
const GRAPH_BUILDER = 'hooks/useProData.js';
// The decoder and its own definition are not readers of the data; useProData owns buildProGraph.
const DECODER = 'data/pairingsBinary.js';

const RAW_FILE = /(?<![\w-])(ingredients\.json|pairings\.json|pairings\.bin)/;
const READS = /(\bfetch\s*\(|\bimport\b|\brequire\s*\(|\breadFile(Sync)?\s*\(|\bnew URL\s*\()/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== '__tests__' && name !== 'node_modules') walk(p, out); }
    else if (/\.(js|jsx|mjs|cjs)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

/** @param {Record<string,string>} files path (relative to src, forward slashes) -> source */
export function findBypasses(files) {
  const found = [];
  for (const [path, source] of Object.entries(files)) {
    if (path === LOADER) continue;
    const lines = source.split('\n');
    lines.forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');
      if (/^\s*(\*|\/\*)/.test(line)) return;
      if (RAW_FILE.test(code) && READS.test(code)) found.push(`${path}:${i + 1} reads a generated data file outside the curated loader`);
      if (path !== DECODER && /\bdecodePairingsBinary\b/.test(code) && !/^\s*(\*|\/\*)/.test(line)) found.push(`${path}:${i + 1} decodes pairings.bin outside the curated loader`);
      if (path !== GRAPH_BUILDER && /\bbuildProGraph\s*\(/.test(code)) found.push(`${path}:${i + 1} builds the ingredient graph outside useProData`);
    });
  }
  if (files[GRAPH_BUILDER] !== undefined) {
    const g = files[GRAPH_BUILDER];
    if (!/loadCuratedDataset/.test(g)) found.push(`${GRAPH_BUILDER}: does not use loadCuratedDataset`);
    if (/buildProGraph\s*\(\s*(?!ingredientsData\b)/.test(g.replace(/function buildProGraph\(/, ''))) found.push(`${GRAPH_BUILDER}: buildProGraph is fed something other than the loader's ingredientsData`);
  }
  return found;
}

function loadSrc() {
  const files = {};
  for (const p of walk(SRC)) files[relative(SRC, p).split(sep).join('/')] = readFileSync(p, 'utf8');
  return files;
}

describe('curated loader guard', () => {
  it('no module in src/ bypasses the curated loader', () => {
    expect(findBypasses(loadSrc())).toEqual([]);
  });

  it('the loader and the graph builder are where the guard expects them', () => {
    const files = loadSrc();
    expect(files[LOADER]).toMatch(/ingredients\.json/);
    expect(files[GRAPH_BUILDER]).toMatch(/function buildProGraph/);
  });

  describe('the guard itself (fixtures standing in for a careless module)', () => {
    const clean = { [LOADER]: "fetch('/proDataset/ingredients.json')", [GRAPH_BUILDER]: 'loadCuratedDataset(); buildProGraph(ingredientsData, pairingsData);' };
    it('passes on a clean tree', () => { expect(findBypasses(clean)).toEqual([]); });
    it('fails when a module fetches ingredients.json', () => {
      const r = findBypasses({ ...clean, 'components/Rogue.jsx': "const r = await fetch('/proDataset/ingredients.json');" });
      expect(r).toEqual(['components/Rogue.jsx:1 reads a generated data file outside the curated loader']);
    });
    it('fails when a module imports ingredients.json', () => {
      expect(findBypasses({ ...clean, 'data/rogue.js': "import raw from '../../public/proDataset/ingredients.json';" })).toHaveLength(1);
    });
    it('fails when a module fetches the pairings', () => {
      expect(findBypasses({ ...clean, 'x.js': "fetch('/proDataset/pairings.bin')" })).toHaveLength(1);
      expect(findBypasses({ ...clean, 'x.js': "fetch('/proDataset/pairings.json')" })).toHaveLength(1);
    });
    it('fails when a module decodes the binary itself', () => {
      expect(findBypasses({ ...clean, 'x.js': 'const p = decodePairingsBinary(buf, ing);' })).toHaveLength(1);
    });
    it('fails when another module builds the graph', () => {
      expect(findBypasses({ ...clean, 'x.js': 'const g = buildProGraph(raw, pairs);' })).toHaveLength(1);
    });
    it('fails when useProData feeds the graph something other than the loader output', () => {
      expect(findBypasses({ ...clean, [GRAPH_BUILDER]: 'loadCuratedDataset(); buildProGraph(rawIngredients, pairingsData);' })).toHaveLength(1);
    });
    it('ignores comments that only mention the file', () => {
      expect(findBypasses({ ...clean, 'x.js': '// see public/proDataset/ingredients.json\n/** import ingredients.json */\n * fetch ingredients.json' })).toEqual([]);
    });
  });
});
