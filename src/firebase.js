import { initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  GoogleAuthProvider,
  OAuthProvider,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyBEEwVg9EwgqvdLmv-eg19akt5lXAUqSdk",
  // authDomain must match the app's own origin. This is the THIRD state for
  // this value today; the history matters because two of them were wrong.
  //
  // 1. Originally neuralflavor.firebaseapp.com — cross-origin.
  // 2. WEBLINK-10 changed it to web.app on an ITP hunch, WITHOUT registering
  //    the new redirect URI with Google. Every sign-in broke with
  //    Error 400: redirect_uri_mismatch. Reverted.
  // 3. That revert's comment then declared the ITP theory "disproven" and
  //    told the next person not to revisit it. Too strong, and wrong.
  //
  // What is actually true, confirmed in production on Safari/iOS:
  //   - ITP did NOT cause the original complaint (no sign-in button existed;
  //     see WEBLINK-11). That part was correctly disproven.
  //   - Cross-origin authDomain DOES break signInWithRedirect, because the
  //     redirect stores state in sessionStorage on firebaseapp.com and
  //     Safari partitions storage per origin. Firebase reports it as:
  //       "Unable to process request due to missing initial state ...
  //        signInWithRedirect in a storage-partitioned browser environment"
  //
  // Same-origin authDomain is Firebase's documented fix. The PREREQUISITE —
  // skipped in attempt 2, done now — is registering the handler with both
  // providers BEFORE flipping this value:
  //   Google Cloud -> Credentials -> Web client -> Authorized redirect URIs
  //     https://neuralflavor.web.app/__/auth/handler
  //   Apple Services ID -> Sign In with Apple -> Configure -> Return URLs
  //     https://neuralflavor.web.app/__/auth/handler
  // The firebaseapp.com entries were kept in both, so reverting is safe.
  //
  // Sessions survive the change: Firebase persists auth under
  // `firebase:authUser:<apiKey>:<appName>`, which excludes authDomain.
  authDomain: "neuralflavor.web.app",
  projectId: "neuralflavor",
  storageBucket: "neuralflavor.firebasestorage.app",
  messagingSenderId: "793952773208",
  appId: "1:793952773208:web:9ddc2e11f44a8b7297d62d",
};

const app = initializeApp(firebaseConfig);

// WEBLINK-20: native must pin persistence explicitly, web must not.
//
// Measured, not guessed. The WEBLINK-18 breadcrumb stopped at "3/4
// exchanging credential" on device and never became an error line, so
// signInWithCredential was neither resolving nor rejecting. WEBLINK-19's
// probe then returned "reachable HTTP 200" — the WKWebView CAN reach
// identitytoolkit, so it is not network, transport, or origin.
//
// That leaves the SDK. Every auth call queues behind Firebase's internal
// initialisation promise, which settles only once persistence is resolved.
// getAuth() probes browser storage to pick a mechanism, and inside a
// WKWebView served from capacitor://localhost that probe never completes —
// so the queue never drains and the call hangs forever with no error. This
// is the documented Capacitor setup for @capacitor-firebase/authentication.
//
// Scoped to native ON PURPOSE. Auth initialisation is global, and the last
// global auth change made here without bounding its blast radius
// (authDomain, WEBLINK-10) broke sign-in for every user on every platform.
// Web keeps getAuth() byte-for-byte, so the worst case is confined to the
// surface that is already broken. See the lesson
// weigh-certain-universal-against-suspected-narrow.
export const auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : getAuth(app);
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
