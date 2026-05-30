import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyBEEwVg9EwgqvdLmv-eg19akt5lXAUqSdk",
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
