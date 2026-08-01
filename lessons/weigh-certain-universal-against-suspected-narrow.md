<!-- candidate-axes: decision -->
<!-- severity: high -->
<!-- applies-to: risk, deployment, config, decision-making -->
<!-- tags: risk-asymmetry, blast-radius, speculative-fix, deployment -->
<!-- source: hand-authored -->
<!-- created: 2026-08-01 -->
<!-- project: flavor-network -->

# Lesson: A certain, universal downside outranks a suspected, narrow upside

## Problem

A user could not sign in on an iPhone. A plausible cause was identified:
the app is served from `neuralflavor.web.app` while `authDomain` pointed at
`neuralflavor.firebaseapp.com`, and Safari's Intelligent Tracking Prevention
blocks the cross-site storage that flow depends on.

The change shipped. It broke Google sign-in for **everyone, everywhere**,
with `Error 400: redirect_uri_mismatch`.

Set the two sides beside each other, which was never done at the time:

| | upside | downside |
|---|---|---|
| **what** | iPhone sign-in might start working | sign-in might break |
| **certainty** | suspected — ITP was never measured | unknown, unverifiable from here |
| **blast radius** | one platform, one browser | every user, every platform |
| **detectability** | needs a device I don't have | immediate and total |

Even holding the ITP theory as probably-correct, this is a bad trade. A
narrow, unconfirmed gain was staked against a change whose failure mode —
had anyone asked what it would look like — was universal.

And the theory was never even tested. No measurement of ITP blocking
anything was performed; the mechanism was inferred from the config, and the
inference was plausible enough to feel like a finding.

## Root cause

Fix selection ran on "is this cause plausible?" and skipped "what does this
change cost if I'm wrong?" Those are different questions and only the first
was asked.

The pressure to ship *something* for a user who was blocked made the
plausible cause feel actionable. But a speculative fix aimed at one platform
is not a small change just because its intent is narrow — `authDomain` is a
global auth parameter, and the intent of a change has no bearing on its
blast radius.

Compounding it: the failure would surface on a surface not being tested. The
change was validated on desktop where a stale session masked it entirely.
Blast radius should have been assessed by asking *who could this break*,
not *who am I trying to help*.

## Mitigation

1. **Before shipping a fix, state both sides explicitly**: how certain is
   the upside, how wide is it, how certain is the downside, how wide. Four
   answers. When the downside is certain-and-universal and the upside is
   suspected-and-narrow, the bar is much higher than "the theory is sound".
2. **Score the theory before acting on it.** "Plausible mechanism, never
   observed" and "measured failure" deserve different responses. If it
   cannot be measured, that is a reason for a smaller, reversible probe —
   not for a global config change.
3. **Judge blast radius by the parameter, not the intent.** Targeting one
   browser does not make a global auth setting a local change.
4. **Prefer the narrow fix when the diagnosis is speculative.** The two
   things kept from this change — surfacing swallowed auth errors, and a
   popup→redirect fallback — were strict improvements with no global
   failure mode. Those alone would have produced the readable Google error
   that finally identified the real cause, at zero risk.
5. **Ask what failure would look like.** "Google rejects the redirect URI"
   is a sixty-second thought experiment, and it names the exact bug that
   shipped.

## Generalization

Debugging pressure rewards plausible causes, and a plausible cause makes a
risky fix feel justified. It does not change the cost of being wrong. A fix
for a suspected narrow problem should be at least as narrow and reversible
as the problem it targets — otherwise a hypothesis about one user becomes
an outage for all of them.

Related: [[half-a-verified-precondition-is-not-verification]] (the same
incident, from the verification angle) and
[[measure-the-defect-before-fixing-it]].
