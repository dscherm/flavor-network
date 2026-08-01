<!-- candidate-axes: procedure -->
<!-- severity: low -->
<!-- applies-to: npm, node, typescript, tooling -->
<!-- tags: npm, audit, devdependencies, environment, false-signal -->
<!-- source: hand-authored -->
<!-- created: 2026-08-01 -->
<!-- project: flavor-network -->

# Lesson: `npm audit fix --omit=dev` prunes devDependencies from node_modules

## Symptom

Immediately after running `npm audit fix --omit=dev`, a previously clean
typecheck fails:

```
tsconfig.json(4,25): error TS5107: Option 'moduleResolution=node10' is
deprecated and will stop functioning in TypeScript 7.0. Specify
compilerOption '"ignoreDeprecations": "6.0"' to silence this error.
```

The tsconfig was not touched. It compiled clean minutes earlier. The error
names a real option in a real file and reads exactly like a config defect —
so the obvious next move is to start editing `moduleResolution`, or add
`ignoreDeprecations`, or migrate to `node16`. All of which would be changes
to source in response to a problem that is not in the source.

The tell:

```
$ npm ls typescript
flavor-network-functions@0.1.0
`-- (empty)
```

TypeScript is not installed at all.

## Root cause

`--omit=dev` on `npm audit fix` does not merely scope the *audit* to
production dependencies — it also scopes the resulting **install**, which
prunes `devDependencies` out of `node_modules`.

With the local TypeScript gone, `npx tsc` falls back to fetching a current
TypeScript from the registry. That newer compiler enforces a deprecation the
project's pinned version (here 5.9.3) does not. So the failure is produced
by a compiler the project never declared, running against a config written
for the one that was just deleted.

`npm install` restores devDependencies and the typecheck goes clean with the
tsconfig completely unmodified.

## Mitigation

1. **Run `npm install` after any `npm audit fix --omit=dev`.** Treat the
   `--omit=dev` flag as "this will prune my dev toolchain", because it does.
2. **When a typecheck or lint fails right after a dependency command, check
   the tool is still installed before believing the error.** `npm ls
   <tool>` returning `(empty)` is the whole diagnosis. Tool-version errors
   that appear without a source change are environment errors wearing a
   code error's clothes.
3. **Be suspicious of an error citing a deprecation you have never seen.**
   Deprecations arrive with compiler upgrades. If you did not upgrade the
   compiler on purpose, something else changed which compiler is running.
4. **Prefer `npm audit --omit=dev` (report only) for triage**, and do the
   fixing without the flag, so the install stays complete.

## Generalization

This is the same shape as an empty `node_modules` making a gate report a
pass ([[a-gate-that-could-not-run-its-tests-is-not-a-pass]]): a command
changed the environment as a side effect, and the resulting failure
described the code instead of the environment. When a tool's output stops
matching a file you did not edit, suspect what is running before what is
written.
