// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { track, setConsent, getConsent, initUsage, CONSENT_KEY, __resetUsageForTests } from '../usage.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeLoader(handle) {
  return vi.fn(async () => handle);
}
function makeHandle() {
  return { logEvent: vi.fn(), setEnabled: vi.fn() };
}

beforeEach(() => {
  window.localStorage.clear();
  __resetUsageForTests();
});

describe('usage consent + track', () => {
  it('is a no-op before an answer and never imports the module', async () => {
    const h = makeHandle(); const loader = makeLoader(h);
    __resetUsageForTests({ loader, isLocal: () => false });
    initUsage();
    track('lab_opened', { lab: 'cocktail' });
    await flush();
    expect(getConsent()).toBeNull();
    expect(loader).not.toHaveBeenCalled();
    expect(h.logEvent).not.toHaveBeenCalled();
  });

  it('is a no-op after No', async () => {
    const h = makeHandle(); const loader = makeLoader(h);
    __resetUsageForTests({ loader, isLocal: () => false });
    setConsent('no');
    track('x');
    await flush();
    expect(window.localStorage.getItem(CONSENT_KEY)).toBe('no');
    expect(loader).not.toHaveBeenCalled();
    expect(h.logEvent).not.toHaveBeenCalled();
  });

  it('loads once and forwards name and params after Yes', async () => {
    const h = makeHandle(); const loader = makeLoader(h);
    __resetUsageForTests({ loader, isLocal: () => false });
    setConsent('yes');
    track('a', { n: 1 });
    track('b');
    await flush();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(h.logEvent).toHaveBeenCalledWith('a', { n: 1 });
    expect(h.logEvent).toHaveBeenCalledWith('b', {});
  });

  it('never forwards identity params', async () => {
    const h = makeHandle();
    __resetUsageForTests({ loader: makeLoader(h), isLocal: () => false });
    setConsent('yes');
    track('a', { uid: 'u1', email: 'e', name: 'n', user_id: 'x', lab: 'bar' });
    await flush();
    expect(h.logEvent).toHaveBeenCalledWith('a', { lab: 'bar' });
  });

  it('stops sending when consent is withdrawn, without a reload', async () => {
    const h = makeHandle();
    __resetUsageForTests({ loader: makeLoader(h), isLocal: () => false });
    setConsent('yes');
    track('a');
    await flush();
    setConsent('no');
    expect(h.setEnabled).toHaveBeenCalledWith(false);
    track('b');
    await flush();
    expect(h.logEvent).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when unsupported or the measurement id is missing (loader returns null)', async () => {
    const loader = makeLoader(null);
    __resetUsageForTests({ loader, isLocal: () => false });
    setConsent('yes');
    expect(() => track('a')).not.toThrow();
    await flush();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('never throws when the loader or logEvent throws', async () => {
    __resetUsageForTests({ loader: vi.fn(async () => { throw new Error('blocked'); }), isLocal: () => false });
    setConsent('yes');
    expect(() => track('a')).not.toThrow();
    await flush();
    const h = { logEvent: vi.fn(() => { throw new Error('x'); }), setEnabled: vi.fn() };
    __resetUsageForTests({ loader: makeLoader(h), isLocal: () => false });
    setConsent('yes');
    expect(() => track('a')).not.toThrow();
    await flush();
  });

  it('does nothing on localhost unless the debug flag is set', async () => {
    const h = makeHandle(); const loader = makeLoader(h);
    __resetUsageForTests({ loader, isLocal: () => true });
    setConsent('yes');
    track('a');
    await flush();
    expect(loader).not.toHaveBeenCalled();
    window.localStorage.setItem('nf.usage.debug', '1');
    track('a');
    await flush();
    expect(h.logEvent).toHaveBeenCalledWith('a', {});
  });

  it('restores analytics at start-up for a stored Yes', async () => {
    window.localStorage.setItem(CONSENT_KEY, 'yes');
    const loader = makeLoader(makeHandle());
    __resetUsageForTests({ loader, isLocal: () => false });
    initUsage();
    await flush();
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
