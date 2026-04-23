import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readStartPageFlag,
  writeStartPageFlag,
  clearStartPageFlag,
} from './startPageFlag.js';

function setSearch(search) {
  // jsdom lets us swap window.location directly for tests
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, search },
  });
}

describe('startPageFlag', () => {
  beforeEach(() => {
    localStorage.clear();
    setSearch('');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    setSearch('');
  });

  it('readStartPageFlag returns false when key absent', () => {
    expect(readStartPageFlag()).toBe(false);
  });

  it('readStartPageFlag returns true when key === "1"', () => {
    localStorage.setItem('fn-start-seen', '1');
    expect(readStartPageFlag()).toBe(true);
  });

  it('readStartPageFlag returns false for any other stored value', () => {
    localStorage.setItem('fn-start-seen', 'yes');
    expect(readStartPageFlag()).toBe(false);
  });

  it('writeStartPageFlag persists "1"', () => {
    writeStartPageFlag();
    expect(localStorage.getItem('fn-start-seen')).toBe('1');
  });

  it('clearStartPageFlag removes the key', () => {
    localStorage.setItem('fn-start-seen', '1');
    clearStartPageFlag();
    expect(localStorage.getItem('fn-start-seen')).toBeNull();
  });

  it('?reset=start clears the key and returns false even if previously set', () => {
    localStorage.setItem('fn-start-seen', '1');
    setSearch('?reset=start');
    expect(readStartPageFlag()).toBe(false);
    expect(localStorage.getItem('fn-start-seen')).toBeNull();
  });

  it('write does not throw when localStorage.setItem throws (private-mode Safari)', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => writeStartPageFlag()).not.toThrow();
    setItemSpy.mockRestore();
  });

  it('read does not throw when localStorage.getItem throws', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readStartPageFlag()).toBe(false);
    getItemSpy.mockRestore();
  });
});
