// Bump the version suffix whenever the StartPage redesign should
// re-show to users who already dismissed the previous one. v2 ships
// the three "Explore X Model" entry points (Pairing / Cocktail / Sauce).
const STORAGE_KEY = 'fn-start-seen-v2';

export function readStartPageFlag() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === 'start') {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* private-mode */ }
      return false;
    }
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeStartPageFlag() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch { /* private-mode Safari */ }
}

export function clearStartPageFlag() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* private-mode Safari */ }
}
