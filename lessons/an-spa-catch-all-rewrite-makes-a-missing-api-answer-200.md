---
title: A missing API route returns 200 behind an SPA catch-all rewrite — res.ok is not proof the endpoint exists
severity: medium
tags: [firebase-hosting, spa, rewrite, fetch, res-ok, dev-only-endpoint, false-success]
source: hand-authored
created: 2026-09-02
project: flavor-network
---

## Symptom

A feature that works in `npm run dev` fails on the deployed site with a
message that is not any of the errors the code was written to produce:

```
Cannot read properties of null (reading 'title')
```

The component's own error handling (`if (!res.ok) …`) never fires. Nothing
in the deploy logs, nothing in the console beyond the TypeError.

```bash
curl -s -o /dev/null -w '%{http_code} %{content_type} %{size_download}' \
  -X POST https://<site>/api/recipe/import
# 200 text/html; charset=utf-8 1759
```

## Root cause

`firebase.json` rewrites `**` to `/index.html` so client-side routes deep-
link. That rule also answers **any** path — including a `POST` to a route
that only exists as the Vite dev-server proxy to a local Express API. The
browser receives `200 text/html`, so `res.ok` is true; `res.json()` fails
and is caught into `null`; the code then dereferences the null. The
"success" branch ran on a response that was the app's own landing page.

The same rewrite hides deletions: a removed file (`/proDataset/x.bak`)
still returns 200 after deploy — with `index.html` as its body — so a
status-only check cannot confirm a removal either.

## Mitigation

1. Do not let a dev-only endpoint reach production UI. Gate the feature on
   `import.meta.env.DEV` (or a build-time flag) and render a one-line note
   instead of the control; test both states with `vi.stubEnv('DEV', …)`.
2. Where a fetch must run in production, treat `res.ok` as necessary, not
   sufficient: check `res.headers.get('content-type')` starts with
   `application/json` (or that the parsed body has the expected shape)
   before touching fields.
3. When verifying a deploy with curl, print `%{content_type}` and
   `%{size_download}` alongside `%{http_code}`. Under a catch-all rewrite,
   `200` alone is meaningless — a 1.7 KB `text/html` answer to an API or
   data URL is the fallback page.
4. Grep `src/` for `fetch('/api/` before shipping: every hit must be either
   a real deployed route (Cloud Function, rewrite to a function) or dev-
   gated.

## Notes

The rewrite itself is correct for an SPA; the fix is never to remove it.
Related: `a-service-worker-navigatefallback-swallows-the-oauth-handler`
(same family — something answering successfully with the wrong content).
