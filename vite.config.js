import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteCompression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
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
