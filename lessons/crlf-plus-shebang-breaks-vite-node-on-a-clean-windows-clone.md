---
title: A clean Windows clone fails tests the working tree passes — CRLF checkout plus a shebang
severity: high
tags: [windows, crlf, line-endings, vitest, vite-node, gitattributes, clean-clone]
source: hand-authored
created: 2026-09-02
project: flavor-network
---

## Symptom

`npm run gate` is green in the developer's working tree. The same command on
`git clone --no-local … && npm ci` fails two test files with no location:

```
 FAIL  chemDataset/validation/__tests__/score_pairings.test.js
SyntaxError: Invalid or unexpected token
 FAIL  chemDataset/validation/__tests__/ablate_perceptron.test.js
SyntaxError: Invalid or unexpected token
```

`node --check` on every file in the clone passes. `diff -rq` between the
clone and the working tree reports every text file as different.

## Root cause

`core.autocrlf=true` (the Git-for-Windows default) converts LF to CRLF on
checkout. The two modules those tests import begin with
`#!/usr/bin/env node`. vite-node strips a hashbang before wrapping the
module in its function body, but its matcher does not span `\r`; the `#!`
line survives into the wrapper, and V8 throws on `#` mid-source. Files
written as LF in the original working tree were never re-checked-out, so
the author's machine never saw it. macOS/Linux clones never will.

Confirmed by LF-normalising only the two shebang'd files in the clone:
2 failed → 4/4 passing.

## Mitigation

1. Add a `.gitattributes` at the repo root and commit it:
   ```
   * text=auto eol=lf
   *.png binary
   *.wasm binary
   ```
   (list every binary extension the repo carries; `eol=lf` overrides
   `core.autocrlf` on every clone regardless of the cloner's config).
2. Run the gate at least once from a fresh `git clone --no-local <repo>`
   before calling a build reproducible. A working tree that wrote the
   files cannot exhibit checkout-time conversion.
3. When a clean-clone-only SyntaxError has no line number, check
   `git ls-files --eol <file>` (`w/crlf` vs `i/lf`) and `head -c 3` for a
   shebang before reading the code.

## Notes

`git ls-files --eol` showing `i/lf w/crlf` on hundreds of files is not a
problem by itself — the index is LF and the working tree normalises on the
next checkout. Do not `git add --renormalize` the whole tree during a freeze
just to make the working copy match; it produces a giant no-op diff.
Related: `a-line-ending-round-trip-rewrites-the-whole-file` (a different
CRLF failure: a tool rewriting every line of a file).
