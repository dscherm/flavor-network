<!-- candidate-axes: debugging -->
<!-- severity: medium -->
<!-- applies-to: scraping, http, node, cloud-functions -->
<!-- tags: scraping, user-agent, bot-blocking, layer-confusion, http-status -->
<!-- source: hand-authored -->
<!-- created: 2026-07-31 -->
<!-- project: flavor-network -->

# Lesson: A "parser failed" error may mean the fetch never succeeded

## Problem

flavor-network's recipe-from-URL import surfaced *"The recipe parser
failed"* for every major recipe site. The error names the parser, the
parser is the interesting code, and the parser is where a debugging
session naturally starts.

The parser was fine. Observed on **2026-07-31**: the Cloud Function
fetched pages with `user-agent: flavor-network-scrape/0.1
(+https://github.com/...)`, and the sites refused it at the HTTP layer.
Probing each target with the function's exact outbound headers:

| site | bot UA | browser UA |
|---|---|---|
| allrecipes | 402 | 402 |
| seriouseats | 402 | 402 |
| simplyrecipes | 402 | 402 |
| foodnetwork | **403** | **200** |
| bonappetit | 200 | 200 |

Ten minutes of probing replaced an open-ended parser investigation, and
the table did more than confirm the layer — it revealed **two different
walls needing two different fixes**, which no amount of reading the
parser would have shown.

## Root cause

Client-facing error copy is written from the perspective of the pipeline
stage the user cares about ("we couldn't get your recipe"), not the stage
that actually failed. A fetch that returns 402 and a page that parses to
zero ingredients arrive at the UI as the same sentence. The error message
names a *component*; it does not name a *layer*.

The two walls also fail identically from inside the app while requiring
opposite fixes:

- **UA-sniffing** (403 here): the origin objects to *who you say you are*.
  A realistic browser header set fixes it outright.
- **IP-blocking** (402 here, Dotdash Meredith properties): the origin
  objects to *where you are calling from*. No header set will ever work;
  it needs a different egress — a reader proxy, or an origin that will
  serve datacenter IPs.

Conflating them produces the wrong conclusion in both directions: "headers
didn't fix it, so headers weren't the problem" (they were, for one class),
or "I'll just add a proxy" (unnecessary for the other class, and a
permanent third-party dependency).

## Mitigation

1. **Probe the raw HTTP status per target before opening the parser.**
   Use the *exact* outbound headers the production code sends — a probe
   with your shell's default `curl` UA tests a different request than the
   one that is failing, and will happily succeed where production fails.
2. **Suspect the user-agent first when statuses cluster in 401/402/403/
   406/429/451.** Any UA that names your project, a version number, or a
   bot URL is an invitation to be blocked. These statuses mean "refused",
   not "broken" — distinct from 404/410, which mean the page genuinely
   isn't there and no amount of retrying will conjure it.
3. **Run the probe twice — bot UA and browser UA — and tabulate.** The
   diff between the two columns partitions your targets into
   headers-will-fix-it and needs-different-egress. Fixing only one class
   and declaring victory is the failure mode this step exists to prevent.
4. **Verify live-site fixtures exist before reading anything into their
   failure.** An invented URL used for testing returned a 200-with-"Page
   Not Found" through the proxy and briefly looked like a parser bug on a
   site that in fact worked perfectly. Confirm the URL resolves in a
   browser first; a fabricated path costs more to misdiagnose than to check.

## Generalization

When an error message names a component, confirm the component actually
ran before you debug it. Multi-stage pipelines — fetch → parse →
normalize → render — collapse every upstream failure into whichever stage
owns the user-visible message, and the named stage is frequently the
innocent one.
