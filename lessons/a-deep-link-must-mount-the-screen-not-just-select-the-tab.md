---
title: A deep link must mount the screen, not just select the tab
severity: medium
tags: [react, routing, deep-link, lazy-mount, test]
source: reflection/candidate
created: 2026-11-06
project: flavor-network
---

## Symptom

`?path=cocktail` opened the landing picker; once past it, the Cocktail Lab
tab was active and the page was blank. Two bugs stacked, and the first hid
the second for months.

## Root cause

1. The landing gate (`startPageComplete`) ignored the URL entirely.
2. Labs were lazy-mounted by a latch (`cocktailMounted`) flipped only inside
   click handlers. Setting `activeTab` from the URL selected a tab that had
   never been mounted. The URL-sync effect then wrote `?path=` back, so
   state and URL agreed while the screen was empty.

## Mitigation

1. Derive mount latches from the active tab (`useEffect` on `activeTab`),
   not from the handlers that happen to set it.
2. Let a valid `?path=` satisfy the landing gate; write `?path=` to the URL
   only after the gate is passed, so a bare visit does not acquire one.
3. Test deep links by rendering the app at the URL and asserting the target
   surface is in the DOM (`App.deepLink.test.jsx`). Asserting the tab state
   is not enough — that was already "correct".
4. Verify in the browser at the URL, not by clicking through to it.
