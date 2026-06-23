import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteCompression from 'vite-plugin-compression';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Dev-only fix for onnxruntime-web. ort is configured with
 * `wasm.wasmPaths = '/wasm/'` (public dir) and dynamically imports
 * `/wasm/ort-wasm-simd-threaded.jsep.mjs`. Vite's dev server forbids importing
 * files out of `public/` ("can only be referenced via HTML tags") and returns
 * 500. This middleware serves `/wasm/*.mjs` raw (stripping Vite's `?import`
 * query) so the dynamic import resolves in dev. Production is unaffected — the
 * build copies these files and serves them statically. Gated to `apply:'serve'`.
 */
function serveWasmMjs() {
  return {
    name: 'serve-ort-wasm-mjs',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const urlPath = (req.url || '').split('?')[0];
        if (urlPath.startsWith('/wasm/') && urlPath.endsWith('.mjs')) {
          const file = path.join(process.cwd(), 'public', urlPath);
          try {
            const code = fs.readFileSync(file, 'utf8');
            res.setHeader('Content-Type', 'application/javascript');
            res.end(code);
            return;
          } catch { /* fall through to Vite's default handling */ }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    serveWasmMjs(),
    react(),
    viteCompression({
      algorithm: 'gzip',
      threshold: 1024,
      filter: /\.(js|mjs|json|css|html|bin)$/i,
    }),
    viteCompression({
      algorithm: 'brotliCompress',
      threshold: 1024,
      ext: '.br',
      filter: /\.(js|mjs|json|css|html|bin)$/i,
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}', 'chemDataset/validation/**/*.test.{js,jsx}'],
    exclude: ['src/data/tests/**', 'node_modules/**'],
  },
  server: {
    port: 5173,
    open: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
  },
});
