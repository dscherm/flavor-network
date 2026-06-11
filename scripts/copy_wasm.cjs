// Copy WASM runtimes from node_modules to public/wasm/ so the Vite dev
// server + production build can serve them. Keeps them out of git.
//
// Files copied:
//   public/wasm/RDKit_minimal.wasm  (~6.6 MB)  — for SMILES parsing
//   public/wasm/ort-wasm-simd-threaded.wasm  (~12 MB) — onnxruntime-web SIMD backend
//
// Runs automatically via the `prebuild` and `predev` npm scripts.
const fs = require('node:fs');
const path = require('node:path');

const SOURCES = [
  ['node_modules/@rdkit/rdkit/dist/RDKit_minimal.wasm', 'public/wasm/RDKit_minimal.wasm'],
  ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', 'public/wasm/ort-wasm-simd-threaded.wasm'],
  ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs', 'public/wasm/ort-wasm-simd-threaded.mjs'],
  // onnxruntime-web 1.24's default backend loads the JSEP (WebGPU/WebNN-capable)
  // wasm variant. Without these two, the runtime requests
  // /wasm/ort-wasm-simd-threaded.jsep.{mjs,wasm} → 404 → the Firebase SPA rewrite
  // serves index.html → "Failed to load module script: MIME type text/html"
  // (breaks the recipe set-completion model: ✨ Suggest / Smart swaps).
  ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm', 'public/wasm/ort-wasm-simd-threaded.jsep.wasm'],
  ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs', 'public/wasm/ort-wasm-simd-threaded.jsep.mjs'],
];

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'public', 'wasm');
fs.mkdirSync(outDir, { recursive: true });

for (const [src, dst] of SOURCES) {
  const srcPath = path.join(root, src);
  const dstPath = path.join(root, dst);
  if (!fs.existsSync(srcPath)) {
    console.error(`[copy_wasm] missing ${src} — run \`npm install\` first`);
    process.exit(1);
  }
  fs.copyFileSync(srcPath, dstPath);
  const sz = (fs.statSync(dstPath).size / 1024 / 1024).toFixed(1);
  console.log(`[copy_wasm] ${dst} (${sz} MB)`);
}
