import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider, appleProvider } from '../firebase.js';

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Google sign-in failed:', err);
    }
  }, []);

  // Apple sign-in via Firebase OAuthProvider — required by App Store
  // Review Guideline 4.8 since Google sign-in is also offered. On iOS
  // the popup opens Apple's web sheet inside the WebView; on web it
  // opens a normal popup window.
  const loginWithApple = useCallback(async () => {
    try {
      await signInWithPopup(auth, appleProvider);
    } catch (err) {
      console.error('Apple sign-in failed:', err);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign-out failed:', err);
    }
  }, []);

  return { user, loading, loginWithGoogle, loginWithApple, logout };
}
