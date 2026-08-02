---
name: capacitor-ios
description: The packaged Capacitor iOS app — native sign-in wiring, required plist/entitlement config, why web-SDK OAuth cannot work in a WKWebView, and how to debug a device you cannot attach to from Windows. Read BEFORE changing native auth, adding a Capacitor plugin, or debugging "nothing happens when I tap it". Triggers: "iOS app", "capacitor", "native sign-in", "nothing happens when I tap", "WKWebView", "no Mac", "1001".
---

# Capacitor iOS — native wiring and blind debugging

The app is a WKWebView loaded from `capacitor://localhost`, wrapping the
same React bundle the web serves. Most things are identical to web. The
places they diverge are where every bug in this project has been.

## You cannot attach a debugger

This project is developed on **Windows**. Safari Web Inspector requires a
Mac. There is no console, no breakpoints, no network tab — the only channel
off the device is what the app renders on screen.

**So build that channel first, not last.** A day was spent generating ~9
hypotheses against zero device state; four lines of on-screen breadcrumb
localised the fault immediately:

```
1/4 calling native apple sheet
2/4 plugin returned: idToken=yes nonce=NO
3/4 exchanging credential with Firebase
4/4 signed in as <uid>
error code=1001 msg=...
```

The stage that fails to appear IS the diagnosis. `authDebug` in
`src/hooks/useAuth.js` is this mechanism — keep it, and extend the same
pattern to any other native flow you have to debug.

Two rules that make it work:

- **Race anything that can hang against a timeout.** A promise that never
  settles is indistinguishable from a dead button. `signInWithCredential`
  has no timeout of its own and hung forever; it now races a 15s timer.
- **Report raw values, not friendly summaries.** `nonce=NO` and `code=1001`
  are diagnostic; "sign-in failed" is not. On timeout the code also probes
  `identitytoolkit/recaptchaParams` (no auth, no side effects) to separate
  "webview cannot reach Google" from "the SDK is wedged" — those need
  opposite fixes.

## Why web-SDK OAuth cannot work here

`signInWithPopup` has no popup to open, and `signInWithRedirect` has no
authorized domain to return to — `capacitor://` can never be a Firebase
authorized domain, since those are HTTPS origins. This is why the sign-in
buttons "did nothing" in the app while working in Safari.

The fix is `@capacitor-firebase/authentication`, which runs the platform's
own sign-in and hands back a credential that the JS SDK then exchanges, so
`onAuthStateChanged` and the callable's token keep flowing through one code
path:

```jsonc
// capacitor.config.json
"FirebaseAuthentication": {
  "skipNativeAuth": true,               // plugin returns a credential, we exchange it
  "providers": ["apple.com", "google.com"]
}
```

```js
const result = await FirebaseAuthentication.signInWithApple();
const credential = new OAuthProvider('apple.com').credential({
  idToken: result.credential.idToken,
  rawNonce: result.credential.nonce,    // RAW, not hashed — see below
});
await signInWithCredential(auth, credential);
```

The plugin sends `sha256(nonce)` to Apple and returns the **raw** nonce.
Pass it as `rawNonce` or Firebase rejects the credential. (Verified in the
plugin's `AppleAuthProviderHandler.swift` — this part has always been
correct here, so do not re-litigate it.)

## Auth must be initialised differently on native

`getAuth()` probes browser storage to pick a persistence mechanism. In this
WKWebView that probe never completes, and every auth call queues behind it
**forever** — no error, no rejection. This was the real cause of native
sign-in doing nothing:

```js
export const auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : getAuth(app);
```

Scope it to native. Auth init is global; the web branch must stay on
`getAuth()` and both branches are pinned by tests.

## Required native config

All four must agree, and all four are easy to check locally:

| Thing | Where | Value |
|---|---|---|
| Firebase iOS app | `ios/App/App/GoogleService-Info.plist` | `BUNDLE_ID = com.neuralflavor.app` |
| Google URL scheme | `ios/App/App/Info.plist` → `CFBundleURLSchemes` | must equal `REVERSED_CLIENT_ID` from the plist |
| Apple entitlement | `ios/App/App/*.entitlements` | `com.apple.developer.applesignin` |
| Bundle id | `project.pbxproj`, `capacitor.config.json` | `com.neuralflavor.app` |

Check these exist before theorising about them — all four were correct here
while the bug was elsewhere, and confirming that took one command.

## Callable CORS

The app's origin is `capacitor://localhost` and it is **not** http, so it
matches no localhost pattern. It must be listed explicitly in the callable's
`cors` array or every request from the app fails preflight while the
identical code works in a browser. See the `firebase-auth` skill.

## `1001` is not a safe silent code

`ASAuthorizationError.canceled` (1001) is returned both when the user
dismisses the sheet **and** when the system aborts the authorization for
entitlement or configuration reasons. From JS the two are identical.

Swallowing it silently hid a real failure through an entire build cycle. If
Face ID *completed*, it was not a dismissal. Native 1001 now surfaces; a
spurious message after a deliberate cancel is much cheaper than another
invisible failure. Lesson: `fix-the-category-not-the-instance`.

More generally: cancellation is matched on **exact error codes**, never on
message text. A regex over `err.message` once matched `abort`, `cancel` and
`1001` inside unrelated failures and discarded them all.

## Deploying a change to the device

A web deploy does **not** update the app — the bundle is compiled in. Push to
`master`, let Codemagic build, wait for App Store Connect processing, then
update in TestFlight. See the `codemagic-ios` skill for the four stages and
how to tell which one you are stuck at.
