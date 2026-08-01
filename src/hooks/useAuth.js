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

/** The user backed out of the native sheet — not an error worth showing. */
const USER_CANCELLED = /cancel|abort|1001|user closed/i;

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
    const result = isGoogle
      ? await FirebaseAuthentication.signInWithGoogle()
      : await FirebaseAuthentication.signInWithApple();

    const idToken = result?.credential?.idToken;
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
    await signInWithCredential(auth, credential);
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
    try {
      if (Capacitor.isNativePlatform()) {
        await signInNative(providerId);
      } else {
        await signInWeb(providerId === 'google' ? googleProvider : appleProvider);
      }
      return true;
    } catch (err) {
      // Backing out of the native sheet is a decision, not a failure.
      if (USER_CANCELLED.test(err?.message ?? '')) return false;
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

  return { user, loading, authError, loginWithGoogle, loginWithApple, logout };
}
