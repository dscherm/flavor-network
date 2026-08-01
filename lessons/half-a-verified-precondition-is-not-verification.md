<!-- candidate-axes: verification -->
<!-- severity: high -->
<!-- applies-to: oauth, config, verification, deployment -->
<!-- tags: verification, preconditions, oauth, config-change, unverifiable -->
<!-- source: hand-authored -->
<!-- created: 2026-08-01 -->
<!-- project: flavor-network -->

# Lesson: If you can only verify half a precondition, that's the reason to confirm — not to ship

## Problem

Changing Firebase's `authDomain` from `neuralflavor.firebaseapp.com` to the
app's own origin `neuralflavor.web.app` looked well-founded. The reasoning
was sound (same-origin auth sidesteps Safari's ITP), and it came with a
measurement:

```
https://neuralflavor.web.app/__/auth/handler  ->  HTTP 200
```

The handler was live on the new origin. Verified. Shipped.

Every Google sign-in then failed, for every user, on every platform:

```
Access blocked — Error 400: redirect_uri_mismatch
```

`authDomain` has **two** consequences, not one. It selects which origin
serves the auth handler — the part that was checked — and it determines the
OAuth `redirect_uri` Firebase presents to Google. That URI must be listed in
the OAuth 2.0 client's Authorized redirect URIs, and only the
`firebaseapp.com` form ever was.

The second precondition was never checked. It also **could not** be checked
from the command line: OAuth client configuration lives in a console, with
no read path from the tools in use.

## Root cause

One precondition was cheap to verify and one was not, and the cheap one got
treated as the whole. A 200 response is concrete and satisfying; it produces
the *feeling* of having measured, and that feeling attached to the entire
change rather than to the one clause it actually covered.

The inability to check the second half was read as an obstacle to move past
rather than as information. It is information — and it points the opposite
way. A precondition you cannot confirm from here is precisely the one whose
failure you will not see coming, because nothing in your feedback loop
watches it.

There is also a decomposition failure. "Does this change work?" was never
broken into "what must ALL be true for this to work?" With the list
unwritten, there was nothing to check the single measurement against.

## Mitigation

1. **Enumerate every precondition before changing a config value**, in
   writing. For `authDomain`: (a) the handler serves on that origin, (b) the
   OAuth client authorises the matching redirect URI. Two items — and one
   was never listed, which is why it was never missed.
2. **Treat "I can't verify this from here" as a stop, not a shrug.** Confirm
   it out of band — ask the person with console access, check the dashboard,
   have someone click through — *before* shipping. Unverifiable and
   unimportant are not the same thing.
3. **Name what your measurement actually covers.** "The handler returns 200"
   proves the handler is served. It proves nothing about OAuth registration.
   Stating the scope of a check out loud exposes the gap while it is still
   cheap.
4. **For a change whose failure is externally enforced** (an OAuth provider,
   a CORS policy, a certificate pin, an API allowlist), assume the external
   party knows nothing about your change until you have evidence otherwise.
   Their configuration does not update because your code did.

## Generalization

A measurement is evidence for exactly the clause it tests, and confidence
tends to spread from it to the whole change. The dangerous shape is a
requirement with one easily-checked half and one that needs access you lack
— because the check you *can* run will feel like diligence while the half
that breaks you goes unexamined.

Related: [[measure-the-defect-before-fixing-it]] and
[[a-count-is-not-a-judgment]] — both about the gap between the thing
measured and the thing believed.
