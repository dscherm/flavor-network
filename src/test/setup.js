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

// JSDOM does not implement Element.scrollIntoView either. MakeRecipeStart
// calls it inside a requestAnimationFrame to bring the sign-in panel into
// view (WEBLINK-17); without this stub the call throws after the test body
// has finished and vitest reports it as an unhandled error.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
