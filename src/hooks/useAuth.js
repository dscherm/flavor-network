import { useState, useEffect, useCallback } from 'react';
import {
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { auth, googleProvider, appleProvider } from '../firebase.js';

/**
 * WEBLINK-10: errors used to be swallowed into console.error. On a phone that
 * meant tapping "Sign in with Google" did nothing visible at all — the
 * rejection went to a console the user cannot open and the UI never changed.
 * A silent auth failure is indistinguishable from a broken button, which is
 * exactly how it got reported.
 */
const POPUP_UNAVAILABLE = new Set([
  'auth/popup-blocked',
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
]);

/**
 * WEBLINK-17: the user backed out of the native sheet.
 *
 * This was `/cancel|abort|1001|user closed/i` tested against the whole
 * message, which is far too loose: "1001" occurs in request ids and
 * unrelated codes, "abort" matches a network AbortError, and "cancel"
 * matches plenty of genuine failures. Worse, a match returned WITHOUT
 * setting authError — so a real error in the credential exchange was
 * swallowed, sign-in appeared to succeed, and no session existed. That is
 * the exact silent-failure mode WEBLINK-10 was written to remove.
 *
 * Now: exact codes only, and when uncertain SHOW the error. A spurious
 * "sign-in failed" after a deliberate cancel is a small annoyance; a
 * swallowed real error costs hours.
 */
const USER_CANCELLED_CODES = new Set([
  'auth/cancelled-popup-request',
  'auth/popup-closed-by-user',
  'auth/user-cancelled',
  // ASAuthorizationError.canceled — Apple's native sheet dismissal.
  '1001',
]);

function isUserCancellation(err) {
  return USER_CANCELLED_CODES.has(String(err?.code ?? ''));
}

function friendlyAuthError(err) {
  const code = err?.code ?? '';
  if (code === 'auth/network-request-failed') {
    return 'Sign-in couldn\'t reach the network. Check your connection and try again.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This site isn\'t authorised for sign-in yet. That\'s on us — please report it.';
  }
  if (POPUP_UNAVAILABLE.has(code)) {
    return 'Sign-in was blocked by the browser. Try again, or allow pop-ups for this site.';
  }
  return err?.message || 'Sign-in failed. Please try again.';
}

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  // WEBLINK-18: a breadcrumb of how far native sign-in got. There is no way
  // to read a console from the packaged app without a Mac, so the app has to
  // report its own progress on screen. Reset per attempt; rendered in
  // ProfilePanel under the buttons.
  const [authDebug, setAuthDebug] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  // WEBLINK-10: collect the result of a redirect sign-in. Without this the
  // user returns from the provider and the app silently drops the result.
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return; // no redirect flow natively
    getRedirectResult(auth).catch((err) => {
      setAuthError(friendlyAuthError(err));
    });
  }, []);

  /**
   * WEBLINK-12: native sign-in for the packaged iOS app.
   *
   * The Firebase WEB SDK's OAuth cannot complete inside the Capacitor
   * WKWebView: the app is loaded from capacitor://localhost, so
   * signInWithPopup has no popup to open and signInWithRedirect has no
   * authorized domain to return to — and capacitor:// can never be one,
   * since Firebase authorized domains are HTTPS origins. That is why the
   * sign-in buttons did nothing in the app while working in Safari.
   *
   * The plugin runs the platform's own sign-in (Google Sign-In SDK,
   * ASAuthorization for Apple) and hands back an OAuth credential. We then
   * exchange that for a JS-SDK session via signInWithCredential, so
   * onAuthStateChanged and the callable's auth token keep flowing through
   * the same code path as on web — one source of truth, not two.
   */
  const signInNative = useCallback(async (providerId) => {
    const isGoogle = providerId === 'google';
    setAuthDebug(`1/4 calling native ${providerId} sheet`);
    const result = isGoogle
      ? await FirebaseAuthentication.signInWithGoogle()
      : await FirebaseAuthentication.signInWithApple();

    const idToken = result?.credential?.idToken;
    // Report what the plugin actually handed back. For Apple a missing
    // nonce is fatal on its own — Firebase rejects the credential — and
    // that is invisible without this line.
    setAuthDebug(
      `2/4 plugin returned: idToken=${idToken ? 'yes' : 'NO'}`
      + ` nonce=${result?.credential?.nonce ? 'yes' : 'NO'}`,
    );
    if (!idToken) {
      throw new Error('Sign-in returned no identity token.');
    }
    const credential = isGoogle
      ? GoogleAuthProvider.credential(idToken)
      // Apple's credential must carry the raw nonce, or Firebase rejects it.
      : new OAuthProvider('apple.com').credential({
        idToken,
        rawNonce: result?.credential?.nonce,
      });
    // WEBLINK-17: confirm the exchange actually produced a session. The
    // plugin succeeding only means the PLATFORM authenticated; without a
    // Firebase user the app is still signed out, which is precisely the
    // state that was reported as "signing in worked" while Profile showed
    // signed out.
    setAuthDebug('3/4 exchanging credential with Firebase');
    const result2 = await signInWithCredential(auth, credential);
    if (!result2?.user) {
      throw new Error('Signed in with the provider, but no Firebase session was created.');
    }
    setAuthDebug(`4/4 signed in as ${result2.user.uid}`);
  }, []);

  /**
   * Web: popup first — it keeps the user in place and works everywhere on
   * desktop. When the browser refuses it (Safari on iOS routinely does), fall
   * back to a full-page redirect. Firebase's documented pattern for
   * popup-blocking browsers.
   */
  const signInWeb = useCallback(async (provider) => {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (!POPUP_UNAVAILABLE.has(err?.code)) throw err;
      await signInWithRedirect(auth, provider);
    }
  }, []);

  const signIn = useCallback(async (providerId) => {
    setAuthError(null);
    setAuthDebug(null);
    try {
      if (Capacitor.isNativePlatform()) {
        await signInNative(providerId);
      } else {
        await signInWeb(providerId === 'google' ? googleProvider : appleProvider);
      }
      return true;
    } catch (err) {
      const code = String(err?.code ?? '');
      // Always record the raw failure, even for a cancellation. This is the
      // only channel we have off the device.
      setAuthDebug(`error code=${code || '(none)'} msg=${err?.message ?? '(none)'}`);
      // Backing out of the sheet is a decision, not a failure — but only
      // on an exact code match. Everything else surfaces.
      //
      // WEBLINK-18: 1001 is the exception to the exception. Apple returns
      // ASAuthorizationError.canceled both when the user dismisses the sheet
      // AND when the system aborts the authorization itself — a missing or
      // mismatched entitlement looks identical from JS. Reported from a
      // device: Face ID completed, then nothing and no message, which is a
      // completed authorization, not a dismissal. So 1001 now surfaces on
      // native. A spurious message after a deliberate cancel is the cost,
      // and it is much cheaper than another silent failure.
      const nativeAppleAbort = code === '1001' && Capacitor.isNativePlatform();
      if (isUserCancellation(err) && !nativeAppleAbort) return false;
      setAuthError(friendlyAuthError(err));
      return false;
    }
  }, [signInNative, signInWeb]);

  const loginWithGoogle = useCallback(() => signIn('google'), [signIn]);

  // Apple sign-in — App Store Review Guideline 4.8 requires it wherever
  // Google sign-in is also offered.
  const loginWithApple = useCallback(() => signIn('apple'), [signIn]);

  const logout = useCallback(async () => {
    setAuthError(null);
    try {
      // Sign out of BOTH SDKs natively — clearing only the JS session would
      // leave the native one cached and silently re-authenticate.
      if (Capacitor.isNativePlatform()) {
        await FirebaseAuthentication.signOut().catch(() => {});
      }
      await signOut(auth);
      return true;
    } catch (err) {
      setAuthError(friendlyAuthError(err));
      return false;
    }
  }, []);

  return { user, loading, authError, authDebug, loginWithGoogle, loginWithApple, logout };
}
