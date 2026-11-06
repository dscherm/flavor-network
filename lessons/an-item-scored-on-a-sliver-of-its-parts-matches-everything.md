---
title: An item scored on a sliver of its parts matches everything
severity: medium
tags: [ranking, recommendation, name-resolution, evaluation]
source: reflection/candidate
created: 2026-11-06
project: flavor-network
---

## Symptom

"Normandie Club Bloody Mary" appeared in the top-8 cocktail matches for 35
of 49 Cookbook recipes — savoury or sweet. Spot checks on three recipes had
looked fine, so the ranker shipped.

## Root cause

The ranker averaged each item's resolved ingredients' best pairing with the
recipe. Of that drink's four ingredients only "fresh lemon juice" and
"fresh lime juice" resolved; aquavit and the house mix did not. Two hub
juices pair with every savoury ingredient, so an item judged on 2 of 4
parts scored like a perfectly matched drink. Averaging over resolved parts
hides how little of the item was actually read.

## Mitigation

1. Scale an item's score by coverage = resolved / (resolved + unresolved)
   non-trivial parts. Linear; a square-root version was tested and left the
   problem half in place.
2. Before shipping a ranker, run it over EVERY query (all 49 recipes) and
   print the most frequent top-N results. Any item in more than ~1/3 of the
   top lists is a bug, whatever the spot checks say.
3. Keep that concentration check next to the accuracy check (same-name
   sauce rank), because fixing one moves the other (MRR 0.66 → 0.60 here).
