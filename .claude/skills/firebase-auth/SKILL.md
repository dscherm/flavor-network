---
name: firebase-auth
description: Firebase Auth + Callable Functions configuration for this project — authDomain semantics, Google/Apple provider prerequisites, the exact consoles and fields involved, and the CORS allow-list. Read BEFORE changing authDomain, adding a provider, or debugging a sign-in failure. Triggers: "sign in broken", "redirect_uri_mismatch", "invalid_client", "authDomain", "Sign Up Not Complete", "add a provider", "CORS on the callable".
---

# Firebase Auth — configuration and failure atlas

Everything here was paid for once, on 2026-08-01/02, across a full day of
WEBLINK-10..20. Read the relevant section before touching config; each
entry names the console, the field, and the error you get when it is wrong.

## The one rule

**Register the handler with every provider BEFORE flipping `authDomain`.**

`authDomain` does two jobs at once, and it is easy to see only the first:

1. it serves `/__/auth/handler`, and
2. it determines the OAuth `redirect_uri` sent to every provider.

Change it without registering the new `redirect_uri` and sign-in breaks for
**every user on every platform**, instantly, with
`Error 400: redirect_uri_mismatch`. That happened here. It is a universal,
certain downside — do not trade it against a narrow, unmeasured hypothesis.
See lesson `weigh-certain-universal-against-suspected-narrow`.

Sessions DO survive an `authDomain` change: Firebase persists under
`firebase:authUser:<apiKey>:<appName>`, which does not include authDomain.
So the change is reversible without logging anyone out.

## When authDomain must be same-origin

Cross-origin `authDomain` genuinely breaks `signInWithRedirect` on
Safari/iOS. The redirect parks state in `sessionStorage` on
`firebaseapp.com`; Safari partitions storage per origin, so the state is
gone on return:

> Unable to process request due to missing initial state … using
> signInWithRedirect in a storage-partitioned browser environment.

Same-origin `authDomain` is Firebase's documented fix. Current value:
`neuralflavor.web.app`. Keep the `firebaseapp.com` entries registered with
both providers so reverting stays possible.

Note this is NOT a general theory of sign-in failure. The same hunch was
once used to explain a bug whose real cause was that no sign-in button
existed on mobile. Confirm the storage-partition error text before blaming
it.

## Prerequisite checklist per provider

Do these first, then change `authDomain`.

**Google** — Google Cloud Console → APIs & Services → Credentials → the Web
client:
- *Authorized redirect URIs*: `https://<authDomain>/__/auth/handler`
- *Authorized JavaScript origins*: origin only. A path or trailing slash is
  rejected with `Invalid Origin: URIs must not contain a path or end with '/'`.

**Apple** — Apple Developer → Certificates, Identifiers & Profiles →
Identifiers → **Services IDs** (not App IDs) → your Services ID → Sign In
with Apple → Configure:
- *Domains and Subdomains*: `neuralflavor.web.app,neuralflavor.firebaseapp.com`
- *Return URLs*: `https://neuralflavor.web.app/__/auth/handler,https://neuralflavor.firebaseapp.com/__/auth/handler`
- Then **Done → Continue → Save**. The dialog's Done does not persist on its
  own; the confirmation page should report "4 Website URLs".

Apple did **not** require `/.well-known/apple-developer-domain-association.txt`
for this flow. Do not go build one — a full investigation of that file was a
dead end. (It is also unservable as-is: the `"**" → /index.html` rewrite
returns the SPA for that path, so it 200s with the wrong body.)

## Error atlas

| Symptom | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` (Google) | handler URL not registered for the current authDomain | add it in Cloud Console Credentials |
| `Invalid Origin: URIs must not contain a path` | pasted the full handler URL into *JavaScript origins* | origins take scheme+host only |
| `invalid_client` (Apple) | Firebase's *Services ID* ≠ the Apple Services ID identifier | copy the identifier **exactly** |
| **"Sign Up Not Complete"** (Apple) | Services ID has **no** Website URLs registered | register domains + return URLs |
| "missing initial state … storage-partitioned" | cross-origin authDomain + redirect flow | same-origin authDomain |
| "Apple sign in provider not enabled" | provider disabled in Firebase console | enable it |
| callable rejected, no `Access-Control-Allow-Origin` | origin absent from the callable's `cors` | see below |

**Check existence before correctness.** The "Sign Up Not Complete" hunt
produced four hypotheses about which registered value was *wrong* — the
fields were simply **empty**. Open the console and look before theorising.
Lesson: `check-existence-before-debugging-correctness`.

## Reading the exact string

Identifiers hide characters. This project's Services ID is genuinely
`neuralflavor.web.app.` — with a trailing dot. Firebase holds the identical
21-character string, so it matches; "tidying" it on one side only would
break Apple sign-in with a confusing error. Read values from the DOM, never
off a screenshot:

```js
[...document.querySelectorAll('input')].map(i => ({ v: i.value, len: i.value.length }))
```

## Callable Functions CORS

`functions/src/scrape/index.ts` carries an explicit allow-list. v2 callables
reject anything not listed at preflight. It must include:

```
https://neuralflavor.web.app
https://neuralflavor.firebaseapp.com
http://localhost(:port)          // dev + Android
capacitor://localhost            // the packaged iOS app
ionic://localhost                // pre-Capacitor-3 scheme
```

`capacitor://localhost` is easy to miss: the app is not served over http, so
identical code works in a browser and fails in the app.

## Native (Capacitor) — auth must be initialised differently

`getAuth()` probes browser storage to choose a persistence mechanism. In a
WKWebView served from `capacitor://localhost` that probe never completes,
and **every auth call queues behind it forever** — no error, no rejection,
just a promise that never settles. Symptom: sign-in appears to do nothing.

```js
export const auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : getAuth(app);
```

Keep the web branch on `getAuth()` and pin both with tests — auth init is
global, and the blast radius of getting it wrong is every user.

## Gotcha: authError is per-hook-instance

`useAuth` holds `authError` in its own `useState`, and `useAuth()` is called
independently in `App.jsx` and `MakeRecipeStart.jsx`. Those are **separate
state instances** — `user` only stays in sync because `onAuthStateChanged`
broadcasts. An error set on one instance is invisible to a component
rendering the other. If you add a third sign-in surface, verify it renders
the same instance it calls.

## Never swallow an error silently

Two separate bugs here came from a `catch` that returned without setting
`authError`. Cancellation is detected by **code**, never by message text,
and `1001` is not a safe silent code — see the `capacitor-ios` skill.
