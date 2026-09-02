// @vitest-environment jsdom
// Auth initialisation is global: the one unbounded change made here
// (authDomain, WEBLINK-10) broke sign-in for every user on every platform.
// This pins the web path so a future edit cannot quietly swap it. The native
// initializeAuth path that used to sit beside it is on branch archive/ios.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAuth = vi.fn(() => ({ via: 'getAuth' }));
const initializeAuth = vi.fn(() => ({ via: 'initializeAuth' }));
vi.mock('firebase/auth', () => ({
  getAuth: (...a) => getAuth(...a),
  initializeAuth: (...a) => initializeAuth(...a),
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

describe('firebase auth initialisation', () => {
  it('uses getAuth (default persistence) on the web', async () => {
    const mod = await import('../firebase.js');
    expect(getAuth).toHaveBeenCalledTimes(1);
    expect(initializeAuth).not.toHaveBeenCalled();
    expect(mod.auth.via).toBe('getAuth');
  });
});
