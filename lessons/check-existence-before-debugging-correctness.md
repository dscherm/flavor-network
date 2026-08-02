<!-- candidate-axes: debugging -->
<!-- severity: high -->
<!-- applies-to: debugging, config, third-party-integration -->
<!-- tags: verification, assumptions, oauth, read-the-actual-state -->
<!-- source: hand-authored -->
<!-- created: 2026-08-02 -->
<!-- project: flavor-network -->

# Lesson: Check whether a value is set before debugging what it is set to

## Problem

Sign in with Apple failed on iOS Safari with Apple's own "Sign Up Not
Complete". Several hours of hypotheses followed, all of the same shape:

- the `redirect_uri` doesn't match the registered Return URL
- the Services ID identifier doesn't match Firebase's `client_id`
- the domain isn't verified because the association file isn't served

Each was a theory about which registered value was **wrong**. One was even
measured and true-but-irrelevant: `/.well-known/apple-developer-domain-association.txt`
really does return the SPA's `index.html` on both domains, because the
`"**" -> /index.html` rewrite catches it. A config change was made to fix
that, and reverted an hour later.

Then the Apple Developer portal was actually opened. *Domains and
Subdomains* was empty. *Return URLs* was empty. **Nothing had ever been
registered.** Apple had nowhere to send the response.

Every hypothesis presupposed a populated field. The whole search space was
downstream of an assumption that was never checked, and checking it took
about ninety seconds.

## Root cause

Debugging started at "which of these values is wrong?" without first asking
"are these values there at all?" That ordering feels natural because the
error message *sounds* like a mismatch — Apple's wording describes a flow
that got partway. Partial-completion language implies partial
configuration, so the mind fills in a config that exists and is subtly off.

Two specific accelerants:

1. **A prior report of "all done."** The URLs had been discussed and the
   user said they had handled it. That is a report about intent, not a
   reading of state. Treating it as state removed the cheapest check.
2. **A measured-but-irrelevant finding.** The missing association file was
   real and verifiable, which made it feel like *the* answer. Confirmation
   that something is broken is not confirmation that it is the cause. It
   also cost a config change that had to be reverted.

## Mitigation

1. **Before theorising about a value, look at it.** For third-party console
   config, open the console. Existence first, correctness second. It is
   almost always faster than the reasoning it replaces.
2. **Rank checks by cost, not by sophistication.** "Is the field empty" is
   seconds. "Does the domain-association file serve correct content" is
   minutes and needs a fix. The cheap check comes first even when the
   expensive one feels more insightful.
3. **A user's "done" is a report, not a measurement.** Verify state
   directly when it is verifiable, without implying the report was
   careless — people say "done" about the step they believed they finished.
4. **Do not ship a fix for a finding you have not tied to the symptom.**
   The association-file change was correct in isolation and useless here.
   Confirm causation before changing config, or the diff accumulates
   unrelated edits.
5. **Read the DOM, not the screenshot, for exact strings.** The Services ID
   is `neuralflavor.web.app.` with a trailing dot (char 46). A JPEG can
   hide or invent a period; `textContent.length` cannot.

## Generalization

An error message that describes a *partial* failure invites you to assume a
*partial* configuration. Often the truth is that the configuration is
absent entirely, and absent is not a special case of wrong — it is a
different branch, and none of the mismatch hypotheses can reach it.

When several theories share a presupposition, test the presupposition
before testing any of the theories.

Related: [[measure-the-defect-before-fixing-it]],
[[half-a-verified-precondition-is-not-verification]],
[[count-is-not-a-judgment]].
