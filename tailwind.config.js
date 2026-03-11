/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        neural: {
          bg: '#0a0a0f',
          surface: '#12121a',
          border: '#1e1e2e',
          glow: '#4f8fff',
          accent: '#7c3aed',
          text: '#e2e8f0',
          muted: '#64748b',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(79, 143, 255, 0.3)',
        'glow-lg': '0 0 40px rgba(79, 143, 255, 0.4)',
      },
    },
  },
  plugins: [],
};
