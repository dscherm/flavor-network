# Usage data

What the app reports to Google Analytics (through Firebase), and nothing else.
Everything below is sent only after a visitor says Yes to the one-time banner
(or turns it on in Profile). With No, or no answer, no analytics script is even
downloaded. Not sent from localhost. The code is `src/data/usageEvents.js`; the
privacy page (`/privacy`) lists the same events from the same catalogue, and a
test fails if this table and the code disagree.

Never sent: an account id, email or name; the name, ingredients or text of any
recipe, drink or sauce a person made; a nickname chosen for a shared recipe; the
id of a link a person made; photos. Two events carry typed text (below); text
containing an `@` or a web address is dropped, not sent.

Rules every event follows: the name is lowercase `snake_case`, at most 40
characters, with no `firebase_`, `google_` or `ga_` prefix; at most 25 params;
every text value is at most 100 characters (the two typed-text params at most 60).

## Events

| Event | Fires when | Params |
|---|---|---|
| `lab_opened` | A lab, the Cookbook or the Pairing Lab becomes the open page (once per opening, not per re-render). | `lab` |
| `invent_started` | The cook answers the first question of an invent panel, or the panel opens already holding a search (once per run; Start over begins a new run). | `lab` |
| `invent_style_chosen` | The cook picks a style or accepts the recommended one (each change of choice). | `lab` |
| `invent_named` | The cook leaves the name box with something typed in it (once per run). | `lab` |
| `invent_saved` | An invention is written to the cook's account, including a save that completes after sign-in. | `lab` |
| `share_sheet_opened` | The share sheet opens. | `kind`, `origin`, `slug` |
| `share_link_created` | The cook taps Create link and the link is written. | `kind` |
| `shared_page_opened` | A shared recipe page finishes loading a recipe (once per page load). | `kind`, `origin`, `slug` |
| `shared_saved` | A recipe is saved to the account from a shared page, including a save that completes after sign-in. | `kind`, `origin` |
| `shared_signup` | A sign-in started on a shared page creates a new account (pop-up sign-in only). | `kind`, `origin` |
| `search_no_result` | A search box holds text that matches nothing and stays unchanged for about a second (once per settled query, not per keystroke). | `lab`, `term` |
| `ingredient_unrecognised` | The cook types an ingredient (or a bottle) that is not in the ingredient list and submits it. | `lab`, `text` |
| `scan_started` | A photo is picked for My bar and sent to be read. | `route` |
| `scan_succeeded` | The scan returns and at least one bottle or item is listed for review. | `route`, `count` |
| `scan_kept` | The cook confirms the review list and the checked bottles are added to My bar. | `route`, `count` |
| `signin_started` | The cook taps Sign in with Google or Apple. | `provider` |
| `signin_completed` | Sign-in succeeds (pop-up, or the return from a redirect sign-in). | `provider` |

## Params

| Param | Values |
|---|---|
| `lab` | `lab_opened`: cocktail, sauce, recipe (the Recipe Notebook), make, cookbook, pairing, wine, network. Invent events: cocktail, sauce, recipe. `search_no_result`: cocktail, sauce, cookbook. `ingredient_unrecognised`: cocktail, sauce, recipe, bar. |
| `kind` | cocktail, sauce, dish |
| `origin` | built_in (a recipe that ships with the app) or own (one a person made) |
| `slug` | The built-in recipe's address name, for example `negroni`. Sent only when `origin` is built_in; never for an own recipe. |
| `term` | The words in a search that found nothing: lowercased, trimmed, at most 60 characters. |
| `text` | The ingredient name that was not recognised: lowercased, trimmed, at most 60 characters. |
| `route` | key (the person's own Gemini key) or code (an invite code) |
| `count` | A whole number of bottles, 0 to 9999. |
| `provider` | google or apple |

## De-duplication

- `lab_opened` fires when the open page changes, once per opening.
- `invent_started`, `invent_named` fire once per run of a panel; Start over begins a new run. Editing a saved item is not a start.
- `search_no_result` waits until the same query has sat unchanged for about 1.2 seconds, then fires once for that query. Clearing the box lets the same query count again.
- `share_sheet_opened` fires once per opening of the sheet, including when an own recipe's sheet turns into the link sheet after Create link.
- Typed-text events fire on submit, not on each keystroke.

## Owner steps in Google Analytics (nothing here is done by the app)

Do these in the Google Analytics property that Firebase created for `neuralflavor`.
Events arrive without any of this; the steps only make the params usable in reports.

1. Open Admin, then Custom definitions, then Create custom dimension. For each row below
   choose scope Event, type the dimension name, and pick the event parameter from the list
   (a parameter shows in the list a day or so after its first event arrives).

   | Event parameter | Dimension name |
   |---|---|
   | `lab` | Lab |
   | `kind` | Recipe kind |
   | `origin` | Recipe origin |
   | `slug` | Built-in recipe |
   | `term` | Search with no result |
   | `text` | Unrecognised ingredient |
   | `route` | Scan route |
   | `provider` | Sign-in provider |

2. Create a custom metric for `count`: Admin, Custom definitions, Custom metrics, Create custom metric,
   scope Event, event parameter `count`, unit of measure Standard.
3. Mark key events: Admin, Events, and switch on "Mark as key event" for `signin_completed`,
   `shared_signup`, `invent_saved`, `shared_saved`, `share_link_created` and `scan_kept`.
4. To check events before relying on them, open Admin, DebugView, then on a deployed copy of the
   site answer Yes on the banner. Events appear in DebugView within seconds. (On localhost nothing is
   sent unless `localStorage['nf.usage.debug']` is `1`.)

## Totals from account records

Counts from the records the app already holds, with no visitor tracking involved. `scripts/accountTotals.mjs`
prints numbers and fixed labels only: accounts, accounts with at least one saved item, saved items by kind
(cocktails, sauces, recipes) and how many came from a shared link, live and removed shared links by kind,
reports waiting (total and per reason), and invite-code photo-scan totals (codes, scans). It prints no recipe
name, ingredient, email, user id or share id, and it only reads (no write or delete call exists in it).

The builder never ran it against the live project. You run it, with your own Google login:

```
gcloud auth application-default login
npm run totals -- --live
npm run totals -- --live --json
```

Without `--live` it refuses to touch a real project. `npm run totals -- --dry-run` prints made-up numbers
with no network, to see the layout. Before reading, it prints what it is about to read.

Read cost: saved items live inside each profile document, so every profile is read once (one read per
account; only the three list fields are fetched). Everything else is about 14 count or sum queries, roughly
one read each. Firestore's free allowance is 50,000 reads a day, so this is fine until the site has tens of
thousands of accounts. The last line of the output, "Documents read", is the number it used.

`firebase-admin` is taken from `functions/node_modules` (run `npm install` inside `functions/` once if it is
missing), so the root project gains no dependency. No key file is used: it reads your login from
`gcloud auth application-default login`, or from `GOOGLE_APPLICATION_CREDENTIALS` if you set it yourself.
