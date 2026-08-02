// @vitest-environment jsdom
// WEBLINK-12 (2026-08-01). The packaged iOS app could not sign in at all:
// the Firebase WEB SDK's OAuth cannot complete in a WKWebView loaded from
// capacitor://localhost — popup has no window, redirect has no authorized
// domain to return to, and capacitor:// can never be one. These pin that
// native takes the credential-exchange path while web is left untouched.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const isNative = vi.fn(() => false);
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => isNative() } }));

const signInWithGoogle = vi.fn();
const signInWithApple = vi.fn();
const nativeSignOut = vi.fn(async () => {});
vi.mock('@capacitor-firebase/authentication', () => ({
  FirebaseAuthentication: {
    signInWithGoogle: (...a) => signInWithGoogle(...a),
    signInWithApple: (...a) => signInWithApple(...a),
    signOut: (...a) => nativeSignOut(...a),
  },
}));

const signInWithPopup = vi.fn(async () => ({}));
const signInWithRedirect = vi.fn(async () => ({}));
const signInWithCredential = vi.fn(async () => ({}));
const googleCredential = vi.fn((t) => ({ provider: 'google', idToken: t }));
const appleCredential = vi.fn((o) => ({ provider: 'apple', ...o }));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: { credential: (t) => googleCredential(t) },
  OAuthProvider: class { credential(o) { return appleCredential(o); } },
  onAuthStateChanged: (_a, cb) => { cb(null); return () => {}; },
  signInWithCredential: (...a) => signInWithCredential(...a),
  signInWithPopup: (...a) => signInWithPopup(...a),
  signInWithRedirect: (...a) => signInWithRedirect(...a),
  getRedirectResult: async () => null,
  signOut: async () => ({}),
}));
vi.mock('../../firebase.js', () => ({
  auth: { __mock: true }, googleProvider: { id: 'g' }, appleProvider: { id: 'a' },
}));

const { renderHook, act } = await import('@testing-library/react');
const useAuth = (await import('../useAuth.js')).default;

beforeEach(() => {
  isNative.mockReturnValue(false);
  [signInWithGoogle, signInWithApple, nativeSignOut, signInWithPopup,
   signInWithRedirect, signInWithCredential].forEach((m) => m.mockReset());
  signInWithPopup.mockResolvedValue({});
  signInWithCredential.mockResolvedValue({ user: { uid: 'u1' } });
  nativeSignOut.mockResolvedValue(undefined);
});

describe('useAuth — native vs web routing (WEBLINK-12)', () => {
  it('web still uses the popup and never touches the native plugin', async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.loginWithGoogle(); });
    expect(signInWithPopup).toHaveBeenCalledTimes(1);
    expect(signInWithGoogle).not.toHaveBeenCalled();
  });

  it('native exchanges the plugin credential for a JS-SDK session', async () => {
    isNative.mockReturnValue(true);
    signInWithGoogle.mockResolvedValue({ credential: { idToken: 'tok-123' } });
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.loginWithGoogle(); });

    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    // Never the web flow — that is the bug this fixes.
    expect(signInWithPopup).not.toHaveBeenCalled();
    expect(signInWithRedirect).not.toHaveBeenCalled();
    // The JS SDK must end up holding the session, so onAuthStateChanged and
    // the callable's token keep working through one code path.
    expect(googleCredential).toHaveBeenCalledWith('tok-123');
    expect(signInWithCredential).toHaveBeenCalledTimes(1);
  });

  it('native Apple passes the raw nonce, which Firebase requires', async () => {
    isNative.mockReturnValue(true);
    signInWithApple.mockResolvedValue({ credential: { idToken: 'tok-a', nonce: 'n-1' } });
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.loginWithApple(); });
    expect(appleCredential).toHaveBeenCalledWith({ idToken: 'tok-a', rawNonce: 'n-1' });
    expect(signInWithCredential).toHaveBeenCalledTimes(1);
  });

  it('surfaces an error when the native plugin returns no token', async () => {
    isNative.mockReturnValue(true);
    signInWithGoogle.mockResolvedValue({ credential: {} });
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.loginWithGoogle(); });
    expect(signInWithCredential).not.toHaveBeenCalled();
    expect(result.current.authError).toMatch(/identity token/i);
  });

  it('keeps a genuine cancellation silent when the code says so', async () => {
    // Cancellation is detected by CODE, never by message text. An explicit
    // "the user closed it" code stays quiet — that is a decision, not a
    // failure, and nagging about it is noise.
    isNative.mockReturnValue(true);
    const cancelled = Object.assign(new Error('closed'), { code: 'auth/popup-closed-by-user' });
    signInWithGoogle.mockRejectedValue(cancelled);
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.loginWithGoogle(); });
    expect(result.current.authError).toBeNull();
  });

  it('SURFACES a native 1001, because Apple sends it for real aborts too', async () => {
    // WEBLINK-18. This reverses WEBLINK-17's treatment of 1001, on evidence:
    // reported from a device on build 205 as "Face ID comes up and then it
    // doesn't sign in, no error message". Face ID COMPLETING is not a sheet
    // dismissal, so 1001 there was the system aborting the authorization
    // (entitlement/config), which JS cannot distinguish from a real cancel.
    // Silence on the one code Apple overloads is how the failure stayed
    // invisible. Surfacing it costs a spurious message after a deliberate
    // cancel; that is far cheaper than another silent dead end.
    isNative.mockReturnValue(true);
    const aborted = Object.assign(new Error('The operation couldn’t be completed.'), { code: '1001' });
    signInWithApple.mockRejectedValue(aborted);
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.loginWithApple(); });
    expect(result.current.authError).toBeTruthy();
  });

  it('reports a STALLED exchange instead of hanging on 3/4 forever', async () => {
    // WEBLINK-19. Reported on build 206: the breadcrumb reached "3/4
    // exchanging credential" and stopped there, never becoming an error
    // line. Since the catch always overwrites the breadcrumb, that is not a
    // rejection — signInWithCredential simply never settles, and it carries
    // no timeout of its own. A promise that never resolves is indis-
    // tinguishable from a dead button.
    vi.useFakeTimers();
    isNative.mockReturnValue(true);
    signInWithApple.mockResolvedValue({ credential: { idToken: 't', nonce: 'n' } });
    signInWithCredential.mockReturnValue(new Promise(() => {}));  // never settles
    global.fetch = vi.fn(async () => ({ status: 200 }));

    const { result } = renderHook(() => useAuth());
    let done;
    await act(async () => {
      done = result.current.loginWithApple();
      await vi.advanceTimersByTimeAsync(16000);
      await done;
    });
    expect(result.current.authError).toMatch(/never answered/i);
    vi.useRealTimers();
  });

  it('records a breadcrumb of the raw failure for off-device diagnosis', async () => {
    // The packaged app has no console reachable from Windows. authDebug is
    // the only channel, so it must carry the raw code even when authError
    // shows friendlier wording.
    isNative.mockReturnValue(true);
    signInWithGoogle.mockRejectedValue(Object.assign(new Error('boom'), { code: 'auth/internal-error' }));
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.loginWithGoogle(); });
    expect(result.current.authDebug).toMatch(/auth\/internal-error/);
  });

  it('SHOWS an error whose message merely mentions cancel but carries no code', async () => {
    // The regression this replaces: USER_CANCELLED was a regex tested
    // against the whole message (/cancel|abort|1001|user closed/i) and a
    // match returned WITHOUT setting authError. Real failures containing
    // any of those substrings vanished silently, sign-in appeared to
    // succeed, and no session existed.
    isNative.mockReturnValue(true);
    signInWithGoogle.mockRejectedValue(new Error('Request aborted: token exchange failed (id 1001)'));
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.loginWithGoogle(); });
    expect(result.current.authError).toBeTruthy();
    expect(result.current.authError).toMatch(/token exchange failed/i);
  });

  it('fails loudly when the exchange yields no Firebase session', async () => {
    // The plugin succeeding only means the PLATFORM authenticated. Without
    // a Firebase user the app is still signed out — exactly the state
    // reported as "signing in worked" while Profile showed signed out.
    isNative.mockReturnValue(true);
    signInWithGoogle.mockResolvedValue({ credential: { idToken: 'tok' } });
    signInWithCredential.mockResolvedValue({ user: null });
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.loginWithGoogle(); });
    expect(result.current.authError).toMatch(/no Firebase session/i);
  });

  it('signs out of BOTH SDKs natively so the native session cannot re-auth', async () => {
    isNative.mockReturnValue(true);
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.logout(); });
    expect(nativeSignOut).toHaveBeenCalledTimes(1);
  });

  it('does not call the native sign-out on web', async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.logout(); });
    expect(nativeSignOut).not.toHaveBeenCalled();
  });
});
