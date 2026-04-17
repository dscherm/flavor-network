import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RAW = path.join(ROOT, 'raw');
export const PROCESSED = path.join(ROOT, 'processed');

export async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

export async function writeJson(p, obj) {
  await ensureDir(path.dirname(p));
  await fs.writeFile(p, JSON.stringify(obj, null, 2));
}

export async function readJson(p) {
  return JSON.parse(await fs.readFile(p, 'utf8'));
}

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function fetchText(url, { retries = 3, delayMs = 1000 } = {}) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(delayMs * (i + 1));
    }
  }
}
