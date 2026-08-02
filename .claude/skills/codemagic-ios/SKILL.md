---
name: codemagic-ios
description: Codemagic iOS build, code signing, and TestFlight delivery for this project — the signing error ladder, certificate format requirements, what publishing config is correct, and how to verify a build actually reached the device. Read BEFORE editing codemagic.yaml or debugging a red build. Triggers: "build failed", "code signing", "No matching profiles found", "provisioning profile", "TestFlight", "not showing up in TestFlight", "codemagic".
---

# Codemagic iOS — signing and delivery

Written after repairing a signing chain that had been broken since some
orphaned certificates were minted, then shipping builds 202–208. The
failures here surface one at a time, each hiding the next, so work the
ladder in order rather than jumping to the error you recognise.

## Do not replace `ios_signing` with the CLI

The workflow uses Codemagic's own signing block:

```yaml
environment:
  ios_signing:
    distribution_type: app_store
    bundle_identifier: com.neuralflavor.app
```

That is the whole block — it names no cert and no profile, because it reads
identities **stored in Codemagic** (Teams → Code signing identities). This
replaced a manual `openssl genrsa` + `certificates create` +
`fetch-signing-files` sequence that kept tripping Apple's "1 active iOS
Distribution certificate per team" limit on every build.

**`ios_signing` alone is not sufficient.** It imports the cert and profile
into the keychain, but `build-ipa` also needs an `export_options.plist`,
which is only written by:

```bash
xcode-project use-profiles
```

The auto-flow deliberately does not run it (it leaves room for custom
signing strategies), so that step must stay in the workflow. Removing it
produces a build that signs and then fails at export.

**Do not swap this for the CLI.** `app-store-connect fetch-signing-files
--create` cannot see Codemagic's stored identities at all — it fetches from
App Store Connect using a certificate private key you supply. Replacing
`ios_signing` with it looks like a modernisation and simply breaks the
build. This was tried here and reverted.

If you *do* end up on the CLI path, the certificate must be **RSA 2048 in
PKCS#1**:

```bash
openssl genrsa -out cert.pem 2048
# if the header says "-----BEGIN PRIVATE KEY-----" it is PKCS#8, convert:
openssl rsa -in cert.pem -traditional -out cert_pkcs1.pem
base64 -w0 cert_pkcs1.pem     # store single-line, marked Secure
```

Do not attempt the PKCS#8→PKCS#1 conversion inside the build script: macOS
ships LibreSSL, which has no `-traditional`, and it fails silently with no
log output. Use `set -e`, never `set -ex`, or the trace prints the decoded
private key into the build log.

## "No matching profiles found for bundle identifier"

Work these in order; each one masks the ones below it.

1. **Read the Codemagic UI before theorising.** Teams → Code signing
   identities. If both stores are empty, no amount of YAML will help. This
   single check ended a long debugging spiral — six or seven plausible
   theories died against one screenshot.
2. **Orphaned distribution certificates.** A certificate whose private key
   is gone can never be used again, and the portal still lists it. In
   Apple Developer → Certificates, revoke any iOS Distribution cert the
   build log reports as "Did not find any Signing Certificates for given
   private key".
3. **Certificate quota.** Apple allows a limited number of distribution
   certs; `409: You already have a current Distribution certificate` means
   revoke first, then retry.
4. **The profile must match the certificate.** Profiles are bound to a
   specific certificate — regenerating the cert invalidates every profile.
   Regenerate profiles after any cert change, and re-upload both.
5. **App ID capabilities must be enabled before the profile is generated.**
   Enabling Sign in with Apple on the App ID *after* minting the profile
   leaves the entitlement unsatisfied and signing fails.

## Publishing — what is correct here

```yaml
publishing:
  app_store_connect:
    auth: integration
    submit_to_testflight: false
```

`beta_groups` and `submit_to_testflight` are for **external** testing. Both
were rejected by App Store Connect:

- `Cannot add internal group to a build`
- `Complete test information is required … for external testing`

**Internal testers receive every processed build automatically — uploading
IS the distribution.** Re-enable those keys only when you actually want
external testers, and fill Test Information (feedback email + review
contact) first or beta review rejects the build.

## A green build is not a build on the device

Four distinct stages, each of which can be the one that is stalled:

1. **Codemagic build** — codemagic.io/builds. Green ring + an `App.ipa #NNN`
   artifact means the build itself succeeded.
2. **Upload → processing** — App Store Connect → TestFlight → expand
   **Build Uploads**. A build sits at `Processing` for 5–20 minutes and does
   **not** appear in the Version list until it completes. "It's not showing
   up in TestFlight" is almost always this, and it is not a fault.
3. **Available to testers** — once processed it joins the Version 1.0 list
   with the internal groups attached.
4. **Installed** — TestFlight does **not** push builds. Unless automatic
   updates are on, the tester must open TestFlight and tap Update.

Confirm the build number in the app before drawing any conclusion from its
behaviour. Testing an old build produces symptoms indistinguishable from
"the fix didn't work".

**Do not trust the INSTALLS / SESSIONS columns for recent builds.** They lag
by hours; they showed dashes across every build including ones definitely in
use.

## Web assets must be rebuilt in CI

The IPA embeds the web bundle, so the workflow must run, in order:

```
npm ci
npm run build
npx cap sync ios
```

If `cap sync` is skipped the IPA ships stale web assets and every JS fix
appears not to have landed. `scripts/strip-ios-bundle.mjs` runs after sync;
the workflow also verifies sync produced the resources xcodebuild expects.

## Cost model

One speculative fix costs a commit, a push, ~5 min of build, 5–20 min of
processing, an install, and another person's attention — call it 30 minutes
of wall clock each. Price your hypotheses accordingly: measuring is cheaper
than guessing here by a wide margin. Lesson:
`build-the-observation-channel-first`.
