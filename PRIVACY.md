# Privacy Policy — Flavor Network

**Last updated: 2026-05-03**

This policy describes what information Flavor Network ("the app",
"we", "our") collects, why, where it's stored, how long we keep it,
and how you can have it deleted. The policy applies to the iOS app
distributed on the App Store under bundle ID `com.neuralflavor.app`.

If anything here is unclear or you'd like a copy of your data,
contact: **schermele@gmail.com**.

---

## What we collect

Flavor Network is designed to work without an account. You can browse
the entire flavor network, build recipes, and explore the Cocktail and
Sauce models with **no data collection at all**.

When you choose to **sign in** (optional, with Apple ID or Google),
we collect the minimum needed to sync your saved recipes across your
devices:

| Data | Source | Linked to your account? | Used for |
|------|--------|-------------------------|----------|
| Email address | Apple ID or Google account | Yes | Authentication; nothing else |
| Display name | Apple ID or Google account | Yes | Showing "you" in the profile panel |
| Account ID | Apple / Google → Firebase Auth | Yes | Internal key for your saved data |
| Saved recipes | What you save in the app | Yes | Cross-device sync of your library |
| Saved ingredients | What you favorite | Yes | Personalized weight in pairing scoring |
| Saved cuisines | What you bookmark | Yes | Personalized scoring + insights |

We **do not** collect:
- Location, contacts, photos, microphone, camera input, or device IDs
- Browsing or interaction analytics
- Crash logs or performance telemetry
- Any third-party advertising or tracking signals

We **do not** track you across other apps or websites and we run
**no advertising**. The `NSPrivacyTracking` flag in our App Privacy
Manifest is set to `false`.

---

## Where data is stored

- **Authentication** — Firebase Authentication (Google Cloud, US region).
  Apple/Google handle the sign-in itself; Firebase only sees the
  resulting account ID, email, and display name.
- **Saved recipes / ingredients / cuisines** — Cloud Firestore
  (Google Cloud, US region), under a document keyed to your account ID.
  Only your account can read or write your document.
- **On-device cache** — A copy lives in your iPhone's local storage
  (Capacitor/WKWebView Preferences). Removed when you delete the app.

---

## How long we keep it

We keep your data only as long as your account is active.

- **Sign out** keeps your data on the server so you can return.
- **Delete account** (in the app's Profile screen, or by emailing
  the address above) permanently erases the Firestore document and
  removes the auth record within 30 days.
- **Backups**: Firestore retains automatic backups for up to 7 days
  after deletion as a disaster-recovery measure. After that, your
  data is gone.

---

## Your rights

Wherever you live, you can:
- **Access** — Email us and we'll send you a JSON dump of everything
  we hold about you within 30 days.
- **Correct** — Edit anything wrong directly in the app.
- **Delete** — Use the "Delete account" action in the Profile panel,
  or email us. We'll erase your data and confirm within 30 days.
- **Object / restrict** — Stop using the app, or sign out. We'll never
  share your data with third parties for their own purposes (we never
  do this anyway — there are no third-party data partners).

If you're in the EU/UK (GDPR) or California (CCPA), the rights above
satisfy your statutory access, deletion, and portability rights. We
don't sell personal information and never have.

---

## Children

Flavor Network is rated **17+** because the Cocktail Model surfaces
alcoholic-drink content. The app is not directed at children under 13
(or 16 in the EU). If you believe a child has signed in, contact us
and we'll delete the account.

---

## Required-reason API use

The iOS app calls a small set of Apple-designated "required reason"
APIs for ordinary app functionality. The full declaration lives in
`PrivacyInfo.xcprivacy` shipped with the binary. Summary:

| Category | Reason | What it's for |
|----------|--------|---------------|
| File timestamp | C617.1 | WKWebView reads the bundled asset files |
| User defaults | CA92.1 | Capacitor's preferences plugin |
| Disk space | E174.1 | WebView cache management |
| System boot time | 35F9.1 | Performance timing on cold start |

None of these access user content or personal data.

---

## Third-party services

We use exactly two services, both from Google Cloud:

- **Firebase Authentication** — handles sign-in.
  Privacy policy: https://firebase.google.com/support/privacy
- **Cloud Firestore** — stores your saved recipes/ingredients.
  Privacy policy: https://firebase.google.com/support/privacy

You may also sign in with **Apple ID** or **Google**. Their respective
privacy policies govern the sign-in itself:

- Apple: https://www.apple.com/legal/privacy/
- Google: https://policies.google.com/privacy

We do not share data with any other party. We do not run advertising,
analytics, or third-party SDKs.

---

## Updates

If this policy changes materially, the "Last updated" date above
changes and the in-app Profile panel will show a one-time notice.
Continuing to use the app after the change means you accept the
new version. The previous version is recoverable from the app's
Git history at https://github.com/dscherm/flavor-network.

---

## Contact

Questions, deletion requests, or data exports:

**schermele@gmail.com**
