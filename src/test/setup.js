import '@testing-library/jest-dom';

// JSDOM does not implement window.matchMedia. Provide a minimal stub so
// hooks that call it (useIsMobile, prefers-reduced-motion checks) don't
// throw in the test environment.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
