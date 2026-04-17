// 00-status.js — report chemDataset pipeline state.
// Writes a compact markdown table to .claude/.chemdataset-status.md so that
// Claude Code's SessionStart hook can surface progress automatically.

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { ROOT, RAW, PROCESSED } from './common.js';

const OUT = path.resolve(ROOT, '..', '.claude', '.chemdataset-status.md');
const PUBLIC_OUT = path.resolve(ROOT, '..', 'public', 'chemDataset');

async function sizeOf(p) {
  try { return (await fs.stat(p)).size; } catch { return 0; }
}
async function dirBytes(p) {
  try {
    let total = 0;
    for (const e of await fs.readdir(p, { withFileTypes: true })) {
      const full = path.join(p, e.name);
      total += e.isDirectory() ? await dirBytes(full) : (await fs.stat(full)).size;
    }
    return total;
  } catch { return 0; }
}
function kb(n) { return n >= 1024 ? `${(n / 1024).toFixed(0)} KB` : `${n} B`; }

async function isStub(p) {
  try {
    const txt = await fs.readFile(p, 'utf8');
    return txt.includes('"_stub": true') || txt.includes('"_stub":true');
  } catch { return true; }
}

async function main() {
  const sources = ['foodb', 'flavordb', 'chemtastedb', 'bitterdb', 'supersweetdb'];
  const rows = [];
  for (const s of sources) {
    const rawSize = await dirBytes(path.join(RAW, s));
    const procFile = path.join(PROCESSED, `${s}.json`);
    const procSize = await sizeOf(procFile);
    const stub = await isStub(procFile);
    const state = procSize === 0 ? 'missing' : stub ? 'stub' : 'real';
    rows.push({ s, rawSize, procSize, state });
  }
  const blendIng = path.join(PUBLIC_OUT, 'ingredients.json');
  const blendPair = path.join(PUBLIC_OUT, 'pairings.json');
  const blendStub = await isStub(blendIng);
  const pairSize = await sizeOf(blendPair);

  const lines = [
    '# chemDataset pipeline status',
    '',
    '| Source | raw/ | processed/ | state |',
    '|--------|------|------------|-------|',
    ...rows.map(r => `| ${r.s} | ${kb(r.rawSize)} | ${kb(r.procSize)} | ${r.state} |`),
    '',
    `**Blend output:** ${blendStub ? 'stub (run `npm run all`)' : `real, pairings.json=${kb(pairSize)}`}`,
    '',
    `_generated ${new Date().toISOString()}_`,
  ];
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, lines.join('\n'));
  console.log(lines.join('\n'));
}

main().catch(err => { console.error(err); process.exit(1); });
