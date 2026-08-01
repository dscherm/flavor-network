<!-- candidate-axes: procedure -->
<!-- severity: medium -->
<!-- applies-to: debugging, documentation, retraction, code-comments -->
<!-- tags: retraction, stale-knowledge, comments, disconfirmation, cleanup -->
<!-- source: hand-authored -->
<!-- created: 2026-08-01 -->
<!-- project: flavor-network -->

# Lesson: When a theory is disproven, sweep the artifacts it seeded — not just the code

## Problem

A user could not sign in on an iPhone. A plausible mechanism was identified
— the app served from `neuralflavor.web.app` with `authDomain` pointing at
`neuralflavor.firebaseapp.com`, and Safari's ITP blocking the cross-site
storage that flow needs. The change shipped, broke Google sign-in for
everyone with `redirect_uri_mismatch`, and was reverted.

The revert was the easy part. What it left behind was worse:

```js
// … Reverted. To do this properly, first add
// https://neuralflavor.web.app/__/auth/handler to the Authorized redirect
// URIs of the OAuth 2.0 client in Google Cloud Console, verify, and only
// then flip this value.
```

A tidy, confident recipe for finishing the job — written while the theory
was still merely *unproven*. Hours later the user confirmed sign-in worked
in Safari on iPhone with the original cross-origin value. ITP had never
been breaking anything; the real blocker was a missing sign-in entry point
entirely elsewhere.

So the comment now described a task with **zero benefit**, in enough detail
to be actionable, sitting in the exact file someone would open next time
auth misbehaved. A lesson file written the same day carried the same
premise. Both had to be corrected explicitly.

## Root cause

Reverting code and retracting a *belief* are different operations, and only
the first is prompted by anything. Git shows the diff; nothing shows the
comments, lesson files, queued tasks, and commit messages the hypothesis
seeded along the way.

Those artifacts are also disproportionately dangerous. A wrong theory in
someone's head is a guess; the same theory written into a source comment
reads as institutional knowledge — reviewed, considered, recorded. It is
*more* persuasive than the original hunch, and it survives the person who
had it.

Worse here: the comment was written in the honest register, documenting a
mistake and warning the next person. That framing earns trust, and the trust
attached to a premise that later turned out to be false.

## Mitigation

1. **When a hypothesis is disconfirmed, list what it touched** before
   closing the thread: source comments, lesson or doc files, queued tasks
   in the backlog, TODOs. The code revert is one item on that list, not the
   list.
2. **Record the disconfirmation, not just the reversal.** "Reverted because
   it broke X" leaves the theory alive and worth retrying. "Reverted, and
   the premise was later disproven by Y — do not revisit" closes it. State
   the evidence that killed it.
3. **Kill the recipe, not just the change.** A comment explaining how to do
   the thing properly is an invitation. If the thing has no value, say so
   plainly and say why.
4. **Re-read anything you wrote while the theory was live.** Lesson files
   and commit messages authored mid-investigation encode the then-current
   belief. Add the epilogue; do not leave the reader to discover it.
5. **Treat "unproven" and "disproven" as different words.** The first
   invites a retry, the second forecloses it. Upgrade the wording the moment
   evidence arrives.

## Generalization

A retraction is incomplete while the reasoning still circulates. The cost of
a dead theory is not the code it produced — that gets reverted — but the
confident prose it leaves in the places people look when the same symptom
recurs. Whatever you wrote to explain a hypothesis needs revisiting when the
hypothesis dies, and it needs it most when you wrote it well.

Related: [[weigh-certain-universal-against-suspected-narrow]] (the same
incident) and [[measure-the-defect-before-fixing-it]].
