// Post `npx cap sync ios` cleanup. WKWebView serves files directly off
// the bundle, so the brotli/gzip duplicates that vite-plugin-compression
// emits (useful for our GitHub Pages deploy) are pure dead weight here.
// The ONNX runtime jsep WASM variant in assets/ is also unread because
// the runtime config sets wasmPaths='/wasm/' and uses the leaner SIMD
// variant from there.

import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

const PUBLIC_DIR = 'ios/App/App/public';
const ASSETS_DIR = join(PUBLIC_DIR, 'assets');

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

async function totalBytes(dir) {
  let total = 0;
  for (const f of await walk(dir)) {
    try {
      total += (await stat(f)).size;
    } catch { /* ignore */ }
  }
  return total;
}

async function rmFiles(files) {
  for (const f of files) {
    try {
      await rm(f, { force: true });
    } catch { /* ignore */ }
  }
}

const before = await totalBytes(PUBLIC_DIR);

const allFiles = await walk(PUBLIC_DIR);
const compressed = allFiles.filter((f) => f.endsWith('.br') || f.endsWith('.gz'));
await rmFiles(compressed);

const assetsFiles = await walk(ASSETS_DIR);
const jsepWasm = assetsFiles.filter((f) => /ort-wasm-.*jsep.*\.wasm$/i.test(f));
await rmFiles(jsepWasm);

const after = await totalBytes(PUBLIC_DIR);
const savedMb = (before - after) / 1024 / 1024;
console.log(
  `[strip-ios-bundle] ${(before / 1024 / 1024).toFixed(1)} MB -> ${(after / 1024 / 1024).toFixed(1)} MB (saved ${savedMb.toFixed(1)} MB) — dropped ${compressed.length} compressed file(s) and ${jsepWasm.length} jsep wasm file(s)`,
);
