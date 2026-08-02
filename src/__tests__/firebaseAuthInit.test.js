// @vitest-environment jsdom
// WEBLINK-20 (2026-08-02). Native sign-in hung forever at "3/4 exchanging
// credential": signInWithCredential neither resolved nor rejected, while a
// reachability probe returned HTTP 200 — so the network was fine and the SDK
// itself was wedged behind its persistence probe, which cannot complete in a
// WKWebView served from capacitor://localhost.
//
// These pin BOTH halves of the fix. The native half is the repair; the web
// half is the guard, because auth initialisation is global and the previous
// unbounded global auth change here broke sign-in for every user.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const isNative = vi.fn(() => false);
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => isNative() } }));

const getAuth = vi.fn(() => ({ via: 'getAuth' }));
const initializeAuth = vi.fn(() => ({ via: 'initializeAuth' }));
const indexedDBLocalPersistence = { id: 'idb' };
vi.mock('firebase/auth', () => ({
  getAuth: (...a) => getAuth(...a),
  initializeAuth: (...a) => initializeAuth(...a),
  indexedDBLocalPersistence,
  GoogleAuthProvider: class { addScope() {} },
  OAuthProvider: class { addScope() {} },
}));
vi.mock('firebase/app', () => ({ initializeApp: () => ({ name: 'app' }) }));
vi.mock('firebase/firestore', () => ({ getFirestore: () => ({}) }));
vi.mock('firebase/functions', () => ({ getFunctions: () => ({}) }));

beforeEach(() => {
  vi.resetModules();
  getAuth.mockClear();
  initializeAuth.mockClear();
});

describe('firebase auth initialisation (WEBLINK-20)', () => {
  it('pins IndexedDB persistence on native, or the SDK never finishes initialising', async () => {
    isNative.mockReturnValue(true);
    const mod = await import('../firebase.js');

    expect(initializeAuth).toHaveBeenCalledTimes(1);
    // The persistence must be explicit. Letting the SDK probe for storage is
    // the exact step that never completes in a WKWebView, and every auth call
    // queues behind it — which is why sign-in hung with no error at all.
    expect(initializeAuth).toHaveBeenCalledWith(
      expect.anything(),
      { persistence: indexedDBLocalPersistence },
    );
    expect(getAuth).not.toHaveBeenCalled();
    expect(mod.auth.via).toBe('initializeAuth');
  });

  it('leaves web on getAuth, so a native fix cannot break every browser user', async () => {
    isNative.mockReturnValue(false);
    const mod = await import('../firebase.js');

    expect(getAuth).toHaveBeenCalledTimes(1);
    expect(initializeAuth).not.toHaveBeenCalled();
    expect(mod.auth.via).toBe('getAuth');
  });
});
