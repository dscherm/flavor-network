<!-- candidate-axes: procedure -->
<!-- severity: medium -->
<!-- applies-to: ci, deployment, ios, signing, prerequisites -->
<!-- tags: ci, prerequisites, blast-radius, sequencing, external-config -->
<!-- source: hand-authored -->
<!-- created: 2026-08-01 -->
<!-- project: flavor-network -->

# Lesson: Hold the push when the prerequisite lives in someone else's console

## Problem

Native iOS sign-in (WEBLINK-12) came together cleanly: plugin installed,
`GoogleService-Info.plist` pulled via the Firebase CLI, URL scheme and
entitlements added, `project.pbxproj` edited and validated by `cap sync`,
auth routing branched and tested. 127 test files, 1414 tests, build clean.

One prerequisite was outstanding and unownable from here: **Sign in with
Apple must be enabled on the App ID in the Apple Developer portal.** The
`com.apple.developer.applesignin` entitlement is only honoured if that
capability exists on the App ID.

The consequence decides the sequencing. A missing capability does not fail
at runtime, where it would affect one tester on one device. It fails at
**code signing** — so pushing would have turned a green CI pipeline red, on
a build triggered automatically by the push, for a reason with nothing to do
with the code. And that pipeline had only just been stabilised after real
effort.

So the work was committed and the push deliberately held, with the
prerequisite stated as the single thing needed to release it.

## Root cause

The reflex is that finished work should ship. But "finished" is a property
of the code, and shipping is an action on shared infrastructure whose
readiness is a separate question.

Three properties make this shape worth catching:

- **The prerequisite is enforced externally** — by Apple, an OAuth provider,
  a certificate authority, an API allowlist. Your repository has no
  authority over it and no way to read its state.
- **It fails early rather than late.** A signing failure is not a bug report
  from one user; it is a broken build for everyone, including anyone else
  mid-release.
- **The trigger is automatic.** Push-to-build means the push *is* the
  deploy. There is no later moment to reconsider.

Together these mean the failure lands on someone else's infrastructure at a
time you did not choose — which is the definition of a change that should be
sequenced, not merely announced.

## Mitigation

1. **Before pushing, ask where the prerequisite is enforced.** If the answer
   is a console you cannot open, the human step comes first. Commit, hold,
   and say exactly what unblocks it.
2. **Ask when it fails — build time or run time.** Build-time failures have
   a blast radius of "everyone who pushes next". Run-time failures are
   usually recoverable and observable. They deserve different caution.
3. **Remember that push-to-build removes the pause.** In a repo where CI
   triggers on push, there is no staging beat in which to notice. The
   decision has to happen before the push, not after.
4. **Name the blocker in one line, in the place the next person looks** —
   the commit body and the task. "Enable Sign in with Apple on the App ID
   before this is pushed" is actionable; "requires configuration" is not.
5. **Don't let completeness argue for shipping.** A green suite says the
   code is right. It says nothing about whether the environment is ready to
   receive it.

## Generalization

Finishing a change and releasing it are separate decisions with separate
preconditions. When the missing precondition belongs to someone else and
fails loudly on shared infrastructure, holding is not hesitation — it is the
cheaper ordering, because a red pipeline costs more to diagnose than a
commit costs to sit still.

Related: [[half-a-verified-precondition-is-not-verification]] (the same
prerequisite problem, from the verification side).
