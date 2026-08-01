import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyBEEwVg9EwgqvdLmv-eg19akt5lXAUqSdk",
  // DO NOT change this to neuralflavor.web.app without first adding the
  // matching redirect URI in Google Cloud Console.
  //
  // WEBLINK-10 (2026-08-01) did exactly that, reasoning that same-origin auth
  // would sidestep Safari's ITP. The handler does serve on web.app
  // (https://neuralflavor.web.app/__/auth/handler returns 200) — but that is
  // only half the requirement. authDomain also determines the OAuth
  // redirect_uri Firebase sends to Google, and the OAuth client only has
  // https://neuralflavor.firebaseapp.com/__/auth/handler registered. Google
  // rejected the flow outright:
  //
  //     Access blocked — Error 400: redirect_uri_mismatch
  //
  // That is strictly worse than the ITP risk it was meant to avoid: a hard
  // failure for every user on every platform, versus a suspected failure on
  // one.
  //
  // DISPROVEN 2026-08-01, after the revert: Google sign-in was confirmed
  // working in Safari on iPhone with THIS cross-origin value. ITP was never
  // breaking anything here — the actual blocker was that no sign-in entry
  // point existed in the mobile nav at all (fixed in WEBLINK-11, bb2181d).
  //
  // So there is no reason to revisit this. Do NOT spend time registering the
  // web.app redirect URI in Google Cloud Console to "enable" a same-origin
  // authDomain: it would buy nothing, and the cross-origin flow is verified
  // working on the platform it was supposed to fix.
  authDomain: "neuralflavor.firebaseapp.com",
  projectId: "neuralflavor",
  storageBucket: "neuralflavor.firebasestorage.app",
  messagingSenderId: "793952773208",
  appId: "1:793952773208:web:9ddc2e11f44a8b7297d62d",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
// MAKE-WEBLINK-FN (2026-05-30): Cloud Functions client for the
// scrapeRecipe Callable. Region defaults to us-central1 — match the
// functions deploy target.
export const functions = getFunctions(app);
export const googleProvider = new GoogleAuthProvider();

// App Store Review Guideline 4.8 requires Sign-in-with-Apple as an
// alternative whenever any third-party sign-in is offered (we offer
// Google). OAuthProvider('apple.com') uses Firebase's Apple OAuth
// flow, which works on web (popup) and inside the iOS WebView (popup
// → Apple ID web sheet). Native ASAuthorization on iOS would be a
// nicer UX but isn't required for App Review compliance — the web
// flow is.
export const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');
