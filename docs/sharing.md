# Sharing recipes: how it works and how to run it

Written for the site owner. No programming needed to follow it. The design and the reasons are in
`.schermness/spec.md` ("Share a recipe on social media"); the per-task reports are in `.schermness/reports/SHARE-1.md` to `SHARE-7.md`.

**Status: nothing described here is deployed.** It is all on `master`. Read "Before you deploy" first.

## What a shared link is

A shared link is a web address that opens one recipe for anyone, with no account and no sign-in. It has two kinds.

1. **A built-in link** looks like `https://neuralflavor.web.app/r/cocktail/negroni` (or `/r/sauce/...`, `/r/dish/...`). It points at a recipe that ships with the app. Nothing a user wrote is involved, so there is nothing to report or remove.
2. **A user's copy** looks like `https://neuralflavor.web.app/r/k7m2q9x4tz` (ten letters and numbers). It exists only when a signed-in person taps "Create link" on a cocktail, sauce or recipe they made. The app makes a frozen public copy of it; the person's own recipe is not touched, and later edits to it do not change the link. If they edit and share again they get a new link.

Both kinds show the recipe, a flavor chart (labelled a visual guide), and buttons to save it, copy it ("Make it your own") and share it. A visitor who is signed out is invited to create a free account. Pasting a link into a chat or social post shows a preview card with the recipe's name, its first ingredients and a picture. That preview is made by two small server programs (Cloud Functions), `sharePreview` and `shareCard`.

## What becomes public, and what never does

When someone shares a recipe they made, the app shows them exactly what will go public first and only publishes after "Create link".

**Public:** the recipe's name, its ingredient lines (name and amount), the method, the glass or category if there is one, the flavor chart numbers, and a name only if the person chose to show one ("Shared by ..."). The default is no name at all. The choices are no name, their first name, or a nickname they type.

**Never public:** their email, their account id on the page, the rest of their profile, their other recipes, their cookbook, their bar or pantry, their saved items. The stored copy is built from scratch from only the fields above, so nothing else can leak into it. The copy does hold the owner's account id (the rules need it to let only the owner unshare), but the page and the preview functions never show it. Anyone who knows a link's id can read that one copy; nobody can list or browse the copies.

## How a person unshares their own recipe

Profile, then "Shared links" at the bottom. Each link is listed with its name and date, with "Copy link" and "Unshare". Unshare asks for a second tap. After that the link says "This recipe is no longer shared." It can take a few minutes for previews and pictures to catch up (see "Caching" below).

## How you remove someone's shared recipe

You are the site owner, so you can do this from the Firebase console. You do not need the person's account.

1. Open https://console.firebase.google.com and choose the project `neuralflavor`.
2. In the left menu open **Build**, then **Firestore Database**, then the **Data** tab.
3. Click the collection **shared**.
4. Find the document whose name is the last part of the link. For `https://neuralflavor.web.app/r/k7m2q9x4tz` that is `k7m2q9x4tz`. (A report, see below, gives you this id as `shareId`.)
5. Inside that document find the field **removed**. It says `false`. Click it, change the value to `true`, and press Update.

The recipe is now gone from the public. The page says it is no longer shared, and the database rules also refuse to hand the document to anyone except its owner. The recipe's author still sees it in Profile until they unshare it; that is harmless.

**Caching.** Previews and pictures are kept for a short time to save work and cost. After you set `removed` to `true`, the link's page stops showing it at once for new visitors, but a chat app's preview text and picture can keep appearing for up to about 13 minutes (3 minutes inside the server program plus a 10 minute cache in front of it). Apps such as Instagram or WhatsApp may keep their own copy of a preview for longer than that; this cannot be controlled from here.

To restore a removed recipe set `removed` back to `false` in the same place. Deleting the document also works, and cannot be undone.

**Exercised for real?** The steps above were not run in the real console. What was exercised is the same change against the Firestore emulator on this computer (a pretend database): a test (`rules-tests/shared.rules.test.js`, "site-owner takedown") creates a shared copy, sets `removed` to `true` the way the console does (bypassing the rules), and confirms an anonymous visitor and a different signed-in user are then refused. The button names in the console may differ a little from what is written above.

## Reports: how people flag a recipe, and how you read them

Every page for a user's copy has a small "Report" link (built-in pages do not, because nobody wrote them). It opens a short form: a reason (Offensive or abusive; Spam or advertising; Private information; Not a recipe; Something else), an optional note of up to 300 characters, and "Send report". After sending it says "Thanks. The report was sent."

A report records only the link's id, the reason, the note and the time. It does **not** record who sent it, even if the reporter was signed in.

**To read reports:** Firebase console, Firestore Database, Data, collection **shareReports**. Each document is one report: `shareId` (the link id, which is also the document name in `shared`), `reason`, `note`, and `at` (a number, the time in milliseconds since 1970; paste it into any "epoch milliseconds" converter to see the date). The database rules let the app add reports but never read them, so you in the console are the only reader.

**Nobody is notified when a report arrives.** Reports must be checked by hand; there is no email and no alert. If nobody looks, they pile up unseen. This is open decision 2 below.

**The report limit is a courtesy.** One browser can send 3 reports a day; the fourth is refused with "You have already sent 3 reports today. Please try again tomorrow." The count is kept in that browser's own storage, so it stops accidents and casual repeats but not someone determined (clearing site data or using another browser resets it). It is not a security control.

## Limits

- 50 live shared links per account. The 51st is refused with a plain message asking the person to unshare one in Profile. This is enforced by the app only; the database rules cannot count.
- Name 80 characters, shown-name 30, ingredient lines 40, each amount 30, method 2,000, glass or category 60, flavor chart 11 bars.
- Report note 300 characters.
- Anything not covered by those limits is escaped and shown as plain text on the page, in the preview tags and on the card. The database rules cannot look inside the ingredient list, so that part relies on the app and the server programs treating it as text, which they do and which is tested.

## The pictures: formats, and why Instagram and TikTok need images

A link pasted into a chat shows a preview card, 1200 by 630 pixels, made by the `shareCard` function. Instagram and TikTok do not show a link preview inside posts and stories, and Instagram does not make links in post captions tappable. So the share sheet also offers downloadable pictures, drawn in the browser:

- **Feed card:** 1080 by 1350 pixels (portrait). One card, or a set of three (name and chart; ingredients; method).
- **Story / TikTok card:** 1080 by 1920 pixels (tall), with the top and bottom 250 pixels kept clear of text so the apps' buttons do not cover it.

Every card prints the link. On a phone that supports it the button is "Share images" (opens the phone's share sheet); otherwise it is "Download images".

## Before you deploy

**The flavor chart on cards was rebuilt (FLAVOR-2 to FLAVOR-6), but check it before you deploy.** The chart is now built from a taste label and aroma notes for each ingredient, weighted by amount, and is labelled "a visual guide". It leads with the right taste on 36 of 41 test recipes and 19 of 20 held-back ones (`docs/flavor-profile.md`, "Where the charts stand"), which means it is still wrong on some. The nine cards looked at in FLAVOR-6 are described there; Margarita, Mojito, Thai green curry and Teriyaki are the ones a cook might wince at. The switch to hide it again is `SHARE_CHARTS_ENABLED`.

**Deploy together.** The hosting site, the two functions and `firestore.rules` depend on each other:

- Hosting sends every `/r/` address to the `sharePreview` function and every `/r-img/` address to `shareCard`. Hosting without the functions makes those addresses error.
- The functions now read shared recipes from the database. Without the new `firestore.rules` the app cannot write reports or shared copies, and a removed copy would not be refused on a raw read.

Run this once, from the project folder, after `npm run gate` passes:

```
firebase deploy --only functions:sharePreview,functions:shareCard,firestore:rules,hosting
```

Do not deploy hosting alone. Check afterwards: open a built-in link and a link you created, paste both into a chat app, and only then post anything publicly. This was not done; see the report for what is and is not verified.

## Three decisions still open (each has a default that is built)

**1. Counting views and saves.**
- What it is: whether the app records how often a shared link is opened, and how often a visitor saves a recipe or signs up from one.
- Current default: **nothing is counted.** The app records nothing about visitors.
- If nothing is decided: it stays that way. You cannot tell whether sharing brings sign-ups except by watching the account total in the Firebase console.
- Options: (a) count nothing (default; no new data about visitors); (b) two counters on each shared record, opens and saves, with no visitor identity (cheap; shows which recipes travel; one extra database write per open); (c) full analytics such as Google Analytics (needs a cookie notice and a privacy note, neither of which exists).
- Collides with: the README's statement that visitors are not tracked would need a line if (b) or (c) is chosen.

**2. Who handles reports.**
- What it is: a report has to reach a person.
- Current default: **a list only you can read in the console.** Nobody is told.
- If nothing is decided: reports pile up unseen unless you look.
- Options: (a) console list only (default; free; depends on you checking); (b) also email you per report (needs an email-sending service and its key); (c) hide a share automatically after some number of reports (no human needed, but anyone could take down a rival's recipe by reporting it).

**3. A cap on a very popular link.**
- What it is: each open of a shared link is one function call and one database read, and each new preview picture is a drawing job. Firebase's free allowance is about 2 million function calls a month and 50,000 database reads a day.
- Current default: **caching only.** Preview tags are cached 10 minutes (60 seconds on error), the picture 1 day for a built-in recipe and 10 minutes for a user's copy (so a removal shows quickly), so repeat opens cost nothing.
- If nothing is decided: a link that went viral could pass the free allowance and start a bill on your account (it is on the pay-as-you-go plan because functions need it).
- Options: (a) caching only (default); (b) also a daily cap per link, after which the link shows the plain generic preview (bounded cost; a popular link looks plain); (c) a budget alert in Google Cloud (does not stop spending, tells you).
- Collides with: the earlier "No paid key" ruling for the photo scan is about the AI key, not Firebase, but the intent (no surprise bill) is the same.

## Charts on shared pages and cards: hidden 2026-11-15, back 2026-11-16 (SHARE-8, FLAVOR-6)

On 2026-11-15 (SHARE-8) the flavor chart was switched off on every public share surface because it still led with a wrong taste on most test recipes. On 2026-11-16 (FLAVOR-6) it was switched back on, after the charts were rebuilt and re-measured. The code is in the working tree; nothing was deployed by that task.

What is back: the "Flavor profile (visual guide)" section on the `/r/` page, the chart on the picture cards you save or send (single and set of three), on the link-preview cards, and the bars stored when someone shares their own recipe.

What the page now downloads for the chart: only `taste_labels.json` (about 100 KB, about 20 KB compressed). The aroma and strength tables are in the page's code. It no longer downloads the model file (`gnn_entropy.json`, about 1.37 MB). The share-image button loads the same small label file, and draws the card without a chart if it cannot.

The switch is still there: `SHARE_CHARTS_ENABLED` in `src/data/shareTargets.js`. Set it to `false`, run `node scripts/buildShareIndex.mjs`, commit the regenerated `functions/src/share/share-cards.json` and `cardLayout.generated.ts`, and redeploy functions to hide the chart on every public surface again. Charts inside the app (Recipe Notebook, the invent panels) are not affected by it.
