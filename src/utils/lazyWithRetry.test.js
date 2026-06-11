import { describe, it, expect, vi } from 'vitest';
import { loadWithRetry } from './lazyWithRetry.js';

function fakeStorage(seed = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
  };
}

describe('loadWithRetry', () => {
  it('returns the module on first success', async () => {
    const mod = { default: 'X' };
    expect(await loadWithRetry(() => Promise.resolve(mod), { interval: 0 })).toBe(mod);
  });

  it('retries a transient failure then succeeds', async () => {
    let n = 0;
    const factory = () => { n += 1; return n < 2 ? Promise.reject(new Error('blip')) : Promise.resolve('ok'); };
    expect(await loadWithRetry(factory, { retries: 3, interval: 0 })).toBe('ok');
    expect(n).toBe(2);
  });

  it('reloads once after exhausting retries (stale chunk)', async () => {
    const reload = vi.fn();
    const storage = fakeStorage();
    const p = loadWithRetry(() => Promise.reject(new Error('gone')), { retries: 1, interval: 0, reload, storage });
    await Promise.race([p, new Promise((r) => setTimeout(r, 10))]); // never resolves; let microtasks flush
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.getItem('fn_chunk_reload')).toBe('1');
  });

  it('throws instead of looping when the reload flag is already set', async () => {
    const reload = vi.fn();
    const storage = fakeStorage({ fn_chunk_reload: '1' });
    await expect(
      loadWithRetry(() => Promise.reject(new Error('gone')), { retries: 0, interval: 0, reload, storage }),
    ).rejects.toThrow('gone');
    expect(reload).not.toHaveBeenCalled();
  });

  it('clears the reload flag on eventual success', async () => {
    const storage = fakeStorage({ fn_chunk_reload: '1' });
    await loadWithRetry(() => Promise.resolve('ok'), { retries: 0, interval: 0, storage });
    expect(storage.getItem('fn_chunk_reload')).toBeNull();
  });
});
