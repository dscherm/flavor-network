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
  resolve: {
    // Force a single instance of these packages. three/addons import 'three'
    // and can otherwise resolve to a second optimized copy ("WARNING: Multiple
    // instances of Three.js being imported"); the modular Firebase SDK shares
    // a component registry in @firebase/app/component/util — a duplicate copy
    // makes getAuth() throw "Component auth has not been registered yet" because
    // firebase/auth registered onto a different @firebase/app instance.
    dedupe: [
      'three',
      'firebase',
      '@firebase/app',
      '@firebase/component',
      '@firebase/util',
    ],
  },
  optimizeDeps: {
    // Pre-bundle three + its addons in ONE pass so the addons (which import
    // 'three') share the single optimized instance instead of pulling a second
    // copy ("Multiple instances of Three.js"). Likewise pre-bundle every
    // Firebase entry the app uses so a lazy second-optimize can't create a
    // duplicate @firebase/app (which makes getAuth throw "Component auth has
    // not been registered yet").
    include: [
      'three',
      'three/addons/controls/OrbitControls.js',
      'three/addons/postprocessing/EffectComposer.js',
      'three/addons/postprocessing/RenderPass.js',
      'three/addons/postprocessing/UnrealBloomPass.js',
      'three/addons/utils/BufferGeometryUtils.js',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/functions',
    ],
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
