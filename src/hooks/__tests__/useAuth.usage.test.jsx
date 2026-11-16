// @vitest-environment jsdom
// USAGE-2: sign-in started / completed carry the provider and nothing else.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const signInWithPopup = vi.fn();
const signInWithRedirect = vi.fn();
let redirectResult = null;
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: () => () => {},
  signInWithPopup: (...a) => signInWithPopup(...a),
  signInWithRedirect: (...a) => signInWithRedirect(...a),
  getRedirectResult: async () => redirectResult,
  getAdditionalUserInfo: (r) => ({ isNewUser: !!r?.isNew }),
  signOut: async () => {},
}));
vi.mock('../../firebase.js', () => ({ auth: {}, googleProvider: { id: 'g' }, appleProvider: { id: 'a' } }));

import useAuth from '../useAuth.js';
import { setConsent, __resetUsageForTests } from '../../data/usage.js';

let handle;
const sent = () => handle.logEvent.mock.calls.map(([n, p]) => [n, p]);
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => {
  window.localStorage.clear();
  signInWithPopup.mockReset(); signInWithRedirect.mockReset(); redirectResult = null;
  handle = { logEvent: vi.fn(), setEnabled: vi.fn() };
  __resetUsageForTests({ loader: async () => handle, isLocal: () => false });
  setConsent('yes');
});

describe('useAuth usage', () => {
  it('a pop-up sign-in reports started and completed with the provider only', async () => {
    signInWithPopup.mockResolvedValue({ user: { uid: 'secret-uid', email: 'a@b.c' }, isNew: true });
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.loginWithGoogle(); });
    await flush();
    expect(sent()).toEqual([['signin_started', { provider: 'google' }], ['signin_completed', { provider: 'google' }]]);
    expect(result.current.lastSignInWasNew()).toBe(true);
    expect(JSON.stringify(sent())).not.toMatch(/secret-uid|a@b\.c/);
  });

  it('a cancelled or failed sign-in reports started only', async () => {
    signInWithPopup.mockRejectedValue({ code: 'auth/user-cancelled' });
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.loginWithApple(); });
    await flush();
    expect(sent()).toEqual([['signin_started', { provider: 'apple' }]]);
  });

  it('a redirect fallback is completed when the page comes back with a result', async () => {
    signInWithPopup.mockRejectedValue({ code: 'auth/popup-blocked' });
    signInWithRedirect.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.loginWithGoogle(); });
    await flush();
    expect(sent()).toEqual([['signin_started', { provider: 'google' }]]);

    redirectResult = { providerId: 'apple.com' };
    renderHook(() => useAuth());
    await flush();
    expect(sent().at(-1)).toEqual(['signin_completed', { provider: 'apple' }]);
  });
});
