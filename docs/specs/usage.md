# usage as-built specs

## USAGE-1 — Consent banner, privacy page and analytics wiring (nothing sent before a yes)

src/data/usage.js: consent state (unset, yes, no) kept on the device; track(name, params) is a no-op unless consent is yes; Firebase Analytics is imported lazily only after a yes and only when isSupported(); failures are swallowed. A one-time banner with Yes and No in the chalk language, not blocking the page, 44px targets; the choice can be changed in Profile. A plain /privacy page (routed like the shared recipe page, no account needed) listing what is collected, by whom (Google), the typed text that is sent (search terms that found nothing, unrecognised ingredient names), and how to turn it off; linked from the banner, the Labs menu and the shared recipe page. No user id, email or display name is ever set on analytics. The measurement id comes from the Firebase config; without one, everything stays a no-op. README's statement that the app records nothing is rewritten to match.

## USAGE-2 — The events: labs, invent, sharing, searches that find nothing, photo scan, sign-in

docs/usage-data.md holds the one table of events (name, when it fires, fields) and src/data/usageEvents.js the matching helpers, so nothing calls track() with a free-form name. Events: lab_opened (lab); invent_started (lab), invent_style_chosen, invent_named, invent_saved; share_sheet_opened (kind, built-in or own), share_link_created, shared_page_opened (kind, built-in or own), shared_saved, shared_signup; search_no_result (lab, term trimmed to 60 characters, lowercased); ingredient_unrecognised (lab, text trimmed to 60); scan_started, scan_succeeded (count), scan_kept (count); signin_started (provider), signin_completed. Never sent: recipe contents, the name a user gave their own recipe, nicknames, anything from a shared recipe a user wrote.

## USAGE-3 — Totals from account records, printed by a script the owner runs

scripts/accountStats.mjs, run by the owner with their own Google login (application default credentials), reads the profiles, shared and shareReports collections with firebase-admin and prints totals only: accounts, accounts with at least one saved item, saved cocktails, sauces and recipes, items saved from a shared link, live and removed shared links, reports waiting. It prints no recipe content, names, emails or ids, and writes nothing. docs/usage-data.md says how to run it. The counting functions are pure and tested on made-up records.

## USAGE-4 — A feedback button

'Send feedback' in the Labs menu and on the shared recipe page: a short note (500 characters) and an optional 'what were you trying to do' (200), written to feedback/{auto} as { note, goal, lab, at } with no identity. Rules: create by anyone within the limits, no read, update or delete; the owner reads it in the Firebase console (docs/usage-data.md says where). Three per browser per day as a courtesy limit.
