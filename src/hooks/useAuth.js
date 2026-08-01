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
 * WEBLINK-10 (2026-08-01): errors used to be swallowed into console.error.
 * On an iPhone that meant tapping "Sign in with Google" did nothing visible
 * at all — Safari blocked the popup, the rejection went to a console the
 * user cannot open, and the UI never changed. A silent auth failure is
 * indistinguishable from a broken button, which is exactly how it was
 * reported.
 */
const POPUP_UNAVAILABLE = new Set([
  'auth/popup-blocked',
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
]);

function friendlyAuthError(err) {
  const code = err?.code ?? '';
  if (code === 'auth/network-request-failed') {
    return 'Sign-in couldn\'t reach the network. Check your connection and try again.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This site isn\'t authorised for sign-in yet. That\'s on us — please report it.';
  }
  if (POPUP_UNAVAILABLE.has(code)) {
    // The redirect fallback below handles these; if the message still
    // surfaces, the redirect itself failed too.
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
    getRedirectResult(auth).catch((err) => {
      // A plain page load with no redirect pending resolves to null and
      // never lands here; anything that does is a real failure worth showing.
      setAuthError(friendlyAuthError(err));
    });
  }, []);

  /**
   * Popup first — it keeps the user in place and works everywhere desktop.
   * When the browser refuses it (Safari on iOS routinely does), fall back to
   * a full-page redirect rather than failing. The redirect result is picked
   * up by the effect above on the way back.
   */
  const signInWith = useCallback(async (provider) => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, provider);
      return true;
    } catch (err) {
      if (POPUP_UNAVAILABLE.has(err?.code)) {
        try {
          await signInWithRedirect(auth, provider);
          return true; // navigation is now in flight
        } catch (redirectErr) {
          setAuthError(friendlyAuthError(redirectErr));
          return false;
        }
      }
      setAuthError(friendlyAuthError(err));
      return false;
    }
  }, []);

  const loginWithGoogle = useCallback(() => signInWith(googleProvider), [signInWith]);

  // Apple sign-in via Firebase OAuthProvider — required by App Store Review
  // Guideline 4.8 since Google sign-in is also offered.
  const loginWithApple = useCallback(() => signInWith(appleProvider), [signInWith]);

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

  return { user, loading, authError, loginWithGoogle, loginWithApple, logout };
}
