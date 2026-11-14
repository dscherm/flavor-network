# Bar photo scan codes (owner guide)

**Status: nothing here is deployed yet.** The `scanBar` function, its rules and
its secret exist in the code only. Until you do the steps below, no code works.

## What this is

Most people scan a bar photo with their own Gemini key, in the browser. The
`scanBar` function is the exception: someone you have given a **code** can scan
photos using **your** Gemini key. Anyone holding a code spends your daily
allowance (the free tier is roughly 20 requests a day in total, across everyone),
so give codes only to people you trust.

## Switch it on (once)

1. Put your Gemini key in as a secret:
   `firebase functions:secrets:set GEMINI_API_KEY`
   (paste the key when asked).
2. Deploy the function and the rules:
   `firebase deploy --only functions:scanBar,firestore:rules`
3. Make a code (below). Nothing works until at least one exists.

## Make a code

In the Firebase console, open Firestore Database, collection `scanCodes`, and
add a document:

- **Document ID: the code itself.** Make it long and random, at least 12
  characters, letters, digits and dashes only (8 to 64 allowed), for example
  `kT9-mQ4x-Lw7e-Rz2p`. Short or guessable codes can be found by trial.
- `enabled` (boolean): `true`
- `label` (string): who it is for, e.g. `Sam`. This is what shows in the logs;
  the code itself is never logged.
- `dailyCap` (number, optional): scans per day for this code, a whole number
  from 1 to 200. Leave it out for the default of 10.

## Turn a code off

Open its document and set `enabled` to `false` (or delete the document). It
takes effect on the next scan. People see "That code isn't valid" for a
disabled, unknown or mistyped code alike.

## See usage

Collection `barScans`: one document per code per UTC day, named
`<code>_<yyyy-mm-dd>`, with a `count` field. A scan counts when the photo is
sent to Gemini, even if Gemini then fails. A photo rejected for being too big
or the wrong type does not count. Usage resets at midnight UTC.

## If Gemini says it is out of quota

People see "out of capacity for today". That is Gemini's own daily limit on your
key, not the per-code cap. It clears on Gemini's daily reset.
