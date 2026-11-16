# Sharing recipes: how it works and how to run it

Written for the site owner. No programming needed to follow it. The design and the reasons are in
`.schermness/spec.md` ("Share a recipe on social media"); the per-task reports are in `.schermness/reports/SHARE-1.md` to `SHARE-7.md`.

**Status: nothing described here is deployed.** It is all on `master`. Read "Before you deploy" first.

## What a shared link is

A shared link is a web address that opens one recipe for anyone, with no account and no sign-in. It has two kinds.

1. **A built-in link** looks like `https://neuralflavor.web.app/r/cocktail/negroni` (or `/r/sauce/...`, `/r/dish/...`). It points at a recipe that ships with the app. Nothing a user wrote is involved, so there is nothing to report or remove.
2. **A user's copy** looks like `https://neuralflavor.web.app/r/k7m2q9x4tz` (ten letters and numbers). It exists only when a signed-in person taps "Create link" on a cocktail, sauce or recipe they made. The app makes a frozen public copy of it; the person's own recipe is not touched, and later edits to it do not change the link. If they edit and share again they get a new link.

Both kinds show the recipe, a flavor chart (labelled a visual guide), and buttons to save it, copy it ("Make it your own") and share it. A visitor who is signed out is invited to create a free account. The chart is a tasting note (CHART-4): one sentence naming the strongest notes, such as "Bitter and sweet, with fruity, green and spice behind", with each note word underlined in its colour, then two thin strips, Taste and Aroma, on one scale with a label under the segments wide enough to read. Nothing is capped or hidden. The first card of a set of three also shows the fixed wheel. The wording and strips come from `src/data/flavorCharts.js`, the same code the page uses. Pasting a link into a chat or social post shows a preview card with the recipe's name, its first ingredients and a picture. That preview is made by two small server programs (Cloud Functions), `sharePreview` and `shareCard`.

## What becomes public, and what never does

When someone shares a recipe they made, the app shows them exactly what will go public first and only publishes after "Create link".

**Public:** the recipe's name, its ingredient lines (name and amount), the method, the glass or category if there is one, the picture if they added one (a chalk drawing, never their original photo), the flavor chart numbers, and a name only if the person chose to show one ("Shared by ..."). The default is no name at all. The choices are no name, their first name, or a nickname they type.

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

Every page for a user's copy has a small "Report" link (built-in pages do not, because nobody wrote them). It opens a short form: a reason (Offensive or abusive; Spam or advertising; Private information; Not a recipe; The picture; Something else), an optional note of up to 300 characters, and "Send report". After sending it says "Thanks. The report was sent."

A report records only the link's id, the reason, the note and the time. It does **not** record who sent it, even if the reporter was signed in.

**To read reports:** Firebase console, Firestore Database, Data, collection **shareReports**. Each document is one report: `shareId` (the link id, which is also the document name in `shared`), `reason`, `note`, and `at` (a number, the time in milliseconds since 1970; paste it into any "epoch milliseconds" converter to see the date). The database rules let the app add reports but never read them, so you in the console are the only reader.

**Nobody is notified when a report arrives.** Reports must be checked by hand; there is no email and no alert. If nobody looks, they pile up unseen. This is open decision 2 below.

**The report limit is a courtesy.** One browser can send 3 reports a day; the fourth is refused with "You have already sent 3 reports today. Please try again tomorrow." The count is kept in that browser's own storage, so it stops accidents and casual repeats but not someone determined (clearing site data or using another browser resets it). It is not a security control.

## Limits

- 50 live shared links per account. The 51st is refused with a plain message asking the person to unshare one in Profile. This is enforced by the app only; the database rules cannot count.
- Name 80 characters, shown-name 30, ingredient lines 40, each amount 30, method 2,000, glass or category 60, flavor chart 17 bars, one per taste or aroma (CHART-4 raised this from 11; the app now saves every note above the floor, because the sentence and the strips need all of them. Copies made earlier hold 8 bars and still read and draw).
- Report note 300 characters.
- Anything not covered by those limits is escaped and shown as plain text on the page, in the preview tags and on the card. The database rules cannot look inside the ingredient list, so that part relies on the app and the server programs treating it as text, which they do and which is tested.

## The pictures: formats, and why Instagram and TikTok need images

A link pasted into a chat shows a preview card, 1200 by 630 pixels, made by the `shareCard` function. Instagram and TikTok do not show a link preview inside posts and stories, and Instagram does not make links in post captions tappable. So the share sheet also offers downloadable pictures, drawn in the browser:

- **Feed card:** 1080 by 1350 pixels (portrait). One card, or a set of three (name and chart; ingredients; method).
- **Story / TikTok card:** 1080 by 1920 pixels (tall), with the top and bottom 250 pixels kept clear of text so the apps' buttons do not cover it.

Every card prints the link. On a phone that supports it the button is "Share images" (opens the phone's share sheet); otherwise it is "Download images".

## Pictures on recipes (PICTURE-1 to 6; nothing here is deployed)

A recipe a person made can carry a picture: either one of the app's chalk drawings (dishes, glasses, sauce vessels), or a photo they turn into a chalk drawing. Full list of changes from the plan is in `docs/pictures.md`.

**The original photo never leaves the device.** The photo is read and redrawn as chalk in the browser (`src/data/chalkFilter.js`, run by `src/data/chalkFilterBrowser.js`), and only the finished drawing is encoded and stored. The picture is made from pixels, so nothing from the photo file (location, camera, time) is carried over; `inspectMetadata` in `chalkFilter.js` is what the tests use to check that.

**Format and size.** The stored picture is always a JPEG, 600 pixels on the long side, with the quality stepped down until it is at most 150 KB (`encodeChalk` in `src/data/chalkFilterBrowser.js`, `STORE_BYTES` = 153,600 in `chalkFilter.js`). The plan said WebP with a JPEG fallback. That was changed during PICTURE-4: the server program that draws the link-preview card (`shareCard`, using resvg) silently draws nothing for a WebP, so the encoder produces JPEG in every browser, and `firestore.rules` and the app now accept `image/jpeg` only (`functions/src/share/picture.ts` also refuses WebP). The rules cap the stored text at fewer than 210,000 characters (base64 of about 150 KB).

**Where it is stored.**

- **On the saved item** (inside the person's own profile record): `picture`, a small label only. A drawing is its name (for example `glass:coupe`); a chalk photo is `{ kind: chalk, v }`, where `v` changes whenever the picture changes. The image is not in the profile record, which has to stay far below Firestore's 1 MB limit.
- **Their own chalk picture:** `profiles/{account id}/pictures/{item id}`, holding the image as base64 text, its type, width, height and time. Only that person can read or write it (`firestore.rules`, `src/data/pictureStore.js`).
- **The picture of a shared copy:** `sharedPictures/{link id}`, the same fields plus the owner's account id. The record `shared/{link id}` carries only `picture: { kind: chalk }` or `picture: { kind: icon, icon: name }`, never image data. Width and height must be whole numbers from 16 to 2,000, and no other fields are allowed.

**What a visitor sees and when.** A shared page, the cards the person downloads, and the link-preview card show the picture of the link as it was when the link was created (`src/components/SharedRecipePage.jsx`, `PictureView.jsx`, `functions/src/share/picture.ts`). A link keeps the picture it was published with: to change it, unshare and share again, which makes a new link. "Save to my cookbook" (or my cocktails, my sauces) from a shared page does not copy the picture; the saved copy has none (`sharedSaveInput` in `src/data/sharedSave.js` has no picture field). Pictures are not drawn smaller than 40 pixels (`MIN_PICTURE_SIZE` in `src/components/PictureView.jsx`); a list row that small shows no picture rather than a smudge.

**The six chalk settings** (`CHALK_DEFAULTS` in `src/data/chalkFilter.js`; the sliders are behind an "Adjust" button in `RecipePicture.jsx`, with Reset): line weight 5 (0.6 to 10), fine detail 13 (0 to 16), shading 110 (0 to 200), colour 200 (0 to 300), chalk grain 5 (0 to 100), and Focus 0 (0 to 100), which fades the background to bare slate in an oval around the middle. Focus at 0 does nothing. The person can also choose a square or a 4:3 landscape centre crop.

**Who can read a shared picture:** anyone who has the link id, only while the share is live. Nobody can list pictures. Once a share is removed (the owner unshares, or you set `removed` to `true` in the console) everyone except the owner is refused. Unsharing also deletes the picture document; if that clean-up fails, the leftover can be read only by its owner.

**Reports.** The report form has a reason "The picture" (`src/data/shareReport.js`, id `picture`), next to the others. It arrives in `shareReports` like any other, with the link id.

**Removing a share removes its picture, but not instantly.** The page and the card function refuse to serve a picture once `removed` is `true`. The card function keeps a share, and its picture, in memory for 3 minutes (`SHARED_TTL_MS` in `functions/src/share/shared.ts`), and the card image for a user's recipe is cached 10 minutes in front of that (`USER_CACHE` in `functions/src/share/card.ts`), so a cached card can keep showing the picture for up to about 13 minutes. Chat apps may keep their own copy longer, which cannot be controlled from here.

**Write order and half-finished states.** The rules read the share record as it will be after the write, so the app saves the share and its picture in one batch (`publishShareWithPicture` in `src/data/shareStore.js`); both land or neither does. If the batch fails (offline, too large) the link is published without the picture and the person is told in one line. For a saved item the picture is written first and the item second; if the item cannot be saved the app deletes the picture, and if even that fails the leftover is a document only its owner can read. A picture that cannot be stored never blocks saving or sharing.

**To see or remove a picture by hand:** Firebase console, Firestore Database, Data, collection `sharedPictures` (document name = link id) or `profiles`, a person's document, subcollection `pictures`. Deleting a `sharedPictures` document removes it from every link and card within the caching window above.

**Deploy targets for this part:** `firestore:rules` first (the picture rules, the optional `picture` key on `shared`, the report reason), then `functions` (the card draws the picture; `sharePreview` shares the same bundle), then `hosting` (chooser, lists, cards, JPEG encoder). Hosting before the rules makes picture writes refused, and every picture is left out with the one-line notice. Test the rules locally with `npm run test:rules`.

**Not verified:** anything on the real database, a phone camera, a real phone photo (HEIC), Safari, the card function on the live site, live link previews, and whether a busy photo looks good at 150 KB.

## Before you deploy

**The flavor chart on cards was rebuilt (FLAVOR-2 to FLAVOR-6), but check it before you deploy.** The chart is now built from a taste label and aroma notes for each ingredient, weighted by amount, and is labelled "a visual guide". It leads with the right taste on 36 of 41 test recipes and 19 of 20 held-back ones (`docs/flavor-profile.md`, "Where the charts stand"), which means it is still wrong on some. The nine cards looked at in FLAVOR-6 are described there; Margarita, Mojito, Thai green curry and Teriyaki are the ones a cook might wince at. The switch to hide it again is `SHARE_CHARTS_ENABLED`.

**Deploy together.** The hosting site, the two functions and `firestore.rules` depend on each other (CHART-4 changed the cards, both functions and the rules, so all of them go out together):

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
