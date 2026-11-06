---
title: A packed data file silently drops the field a new feature reads
severity: high
tags: [data, binary-format, worker, ranking, test]
source: reflection/candidate
created: 2026-11-06
project: flavor-network
---

## Symptom

A new ranker read `edge.known` to keep only observed pairings. Unit tests
passed (fixtures carried the flag). In the running app every match was
"shares X" only — no cross-ingredient pairs — and a drink read as two
ingredients outranked everything. No error anywhere.

## Root cause

The app does not load `pairings.json`; a worker decodes
`public/proDataset/pairings.bin`, packed by `scripts/buildPairingsBinary.cjs`
to keep "only the three fields the app reads" (A, B, strength). `known` was
dropped years before the feature that needed it. `e.known !== true` then
filtered out every edge, and the fallback (same ingredient = 1.0) hid the
loss as a plausible-looking result.

## Mitigation

1. Before reading a new field from graph/edge data, grep the LOADER, not the
   source JSON: `grep -rn "pairings.bin\|decodePairings" src` — the shape
   the app sees is whatever the packer kept.
2. Add the field to the packer and bump the format version; keep the decoder
   reading the old version.
3. Add a test that decodes the shipped packed file and asserts the new
   field's aggregate (count of `known === true`) equals the source JSON's.
4. When a ranker has a fallback path, make the "data missing" case visible:
   a test that feeds edges without the flag must produce a different result
   than edges with it.
