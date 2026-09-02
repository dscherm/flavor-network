import { useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth';
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
  // WEBLINK-18: a breadcrumb of the last sign-in failure, rendered in
  // ProfilePanel under the buttons. Reset per attempt.
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
    getRedirectResult(auth).catch((err) => {
      setAuthError(friendlyAuthError(err));
    });
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
      await signInWeb(providerId === 'google' ? googleProvider : appleProvider);
      return true;
    } catch (err) {
      const code = String(err?.code ?? '');
      // Always record the raw failure, even for a cancellation. This is the
      // only channel we have off the device.
      setAuthDebug(`error code=${code || '(none)'} msg=${err?.message ?? '(none)'}`);
      // Backing out of the popup is a decision, not a failure — but only on
      // an exact code match. Everything else surfaces.
      if (isUserCancellation(err)) return false;
      setAuthError(friendlyAuthError(err));
      return false;
    }
  }, [signInWeb]);

  const loginWithGoogle = useCallback(() => signIn('google'), [signIn]);

  // Apple sign-in — App Store Review Guideline 4.8 requires it wherever
  // Google sign-in is also offered.
  const loginWithApple = useCallback(() => signIn('apple'), [signIn]);

  const logout = useCallback(async () => {
    setAuthError(null);
    try {
      await signOut(auth);
      return true;
    } catch (err) {
      setAuthError(friendlyAuthError(err));
      return false;
    }
  }, []);

  return { user, loading, authError, authDebug, loginWithGoogle, loginWithApple, logout };
}
