const STORAGE_KEY = 'fn-start-seen';

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
