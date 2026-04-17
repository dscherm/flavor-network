// auto-blend-hook.js — fired as a PostToolUse(Bash) hook.
// Reads the tool_input JSON on stdin; if the command was a chemDataset
// fetch script and all 5 processed/*.json files are present and non-stub,
// run the blend once. Idempotent (checks mtime to skip re-blends).

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, PROCESSED } from './common.js';

async function readStdin() {
  return new Promise((resolve) => {
    let buf = '';
    process.stdin.on('data', (c) => (buf += c));
    process.stdin.on('end', () => resolve(buf));
    setTimeout(() => resolve(buf), 300);
  });
}

async function exists(p) { try { return (await fs.stat(p)).size > 0; } catch { return false; } }
async function isStub(p) {
  try { return (await fs.readFile(p, 'utf8')).includes('"_stub"'); } catch { return true; }
}
async function mtime(p) { try { return (await fs.stat(p)).mtimeMs; } catch { return 0; } }

async function main() {
  const raw = await readStdin();
  let cmd = '';
  try { cmd = JSON.parse(raw)?.tool_input?.command || ''; } catch { /* ignore */ }
  const isFetch = /chemDataset.*(npm run (foodb|flavordb|chemtastedb|bitterdb|supersweetdb))/.test(cmd);
  if (!isFetch) return;

  const sources = ['foodb', 'flavordb', 'chemtastedb', 'bitterdb', 'supersweetdb'];
  for (const s of sources) {
    const p = path.join(PROCESSED, `${s}.json`);
    if (!(await exists(p)) || (await isStub(p))) return;
  }
  const latestIn = Math.max(
    ...(await Promise.all(sources.map(s => mtime(path.join(PROCESSED, `${s}.json`)))))
  );
  const outIng = path.resolve(ROOT, '..', 'public', 'chemDataset', 'ingredients.json');
  if ((await mtime(outIng)) > latestIn) return;

  console.log('[auto-blend] all sources real and newer than blend — running 10-blend.js');
  const blend = spawn('node', [path.join(ROOT, 'scripts', '10-blend.js')], { stdio: 'inherit' });
  await new Promise(r => blend.on('exit', r));
}

main().catch(err => { console.error('[auto-blend]', err.message); });
