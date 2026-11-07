# Send a recipe from Apple News to Flavor Network

An iPhone Shortcut that adds **Send to Flavor Network** to the Share sheet.
Share a recipe from Apple News (or Safari, or any app that shares a link) and
Flavor Network opens on **Make a recipe → From a web link** with the link
filled in and the import already running.

It works by opening this address:

```
https://neuralflavor.web.app/?import=<the recipe link, URL-encoded>
```

`?path=make&import=<link>` works too. The app accepts only `http://` and
`https://` links, and removes `import` from the address bar once it has read
it, so reloading the page does not import the recipe again.

## Build the Shortcut (about two minutes)

1. Open the **Shortcuts** app and tap **+** to make a new shortcut.
2. Tap the name at the top, choose **Rename**, and call it
   `Send to Flavor Network`.
3. Turn on the Share sheet:
   - tap the **ⓘ** (Details) button at the bottom of the editor;
   - turn on **Show in Share Sheet**;
   - tap **Done**.
4. The editor now shows a first line like
   *Receive **Any** input from **Share Sheet***. Tap **Any**, deselect
   everything, then select **URLs**, **Safari web pages** and **Articles**.
   (Articles is the type Apple News shares.)
5. Add the action **URL Encode** (search the action list for "URL Encode").
   It should read *URL Encode **Shortcut Input***. If it shows a different
   variable, tap it and choose **Shortcut Input**.
6. Add a **Text** action. In its box type
   `https://neuralflavor.web.app/?import=` and then, with the cursor right
   after the `=`, tap **URL Encoded Text** in the variable bar above the
   keyboard. There must be no space between `=` and the variable.
7. Add the action **Open URLs**. It should read *Open **Text***.
8. Tap **Done**.

The finished shortcut is four lines:

```
Receive URLs, Safari web pages and Articles from Share Sheet
URL Encode  Shortcut Input
Text        https://neuralflavor.web.app/?import=[URL Encoded Text]
Open URLs   Text
```

## Use it

In Apple News, open the recipe, tap **Share**, scroll the row of actions and
tap **Send to Flavor Network**. The first time, iOS asks whether the shortcut
may open neuralflavor.web.app; choose **Always Allow**.

If you aren't signed in, the app shows the sign-in buttons with your link
kept; after you sign in, the import continues by itself.

## If it doesn't import

- **Apple News links never include the publisher's page.** Flavor Network
  reads the recipe name and publisher from the Apple News page and looks the
  recipe up on the publisher's own site. That works for Epicurious, Bon
  Appétit, Delish, The Pioneer Woman, Tasty, BBC Good Food, America's Test
  Kitchen and NYT Cooking. It doesn't work for Allrecipes, Serious Eats,
  Simply Recipes, Food & Wine, EatingWell and the other People Inc. sites,
  which block automated imports altogether, or for Food Network, Food52, The
  Kitchn, Taste of Home and Saveur, whose search pages can't be read from a
  server.
- When the lookup fails, the app shows the recipe name with a **Find it on the
  web** button and a box to paste the recipe's own link.
- In Apple News you can often tap **Share → Open in Safari** and share from
  Safari instead; that shares the publisher's real link.
- If the Text action reads `?import= URL Encoded Text` with a space, delete the
  space.
- If the shortcut opens the app on the start screen with nothing filled in,
  the input probably reached the shortcut as something other than a link. Add
  a **Get URLs from Input** action between the first line and **URL Encode**,
  and point **URL Encode** at **URLs** instead of **Shortcut Input**.

## What hasn't been checked on an iPhone

These steps were written against the Shortcuts naming in iOS 17 and 18
(**Show in Share Sheet**, **URL Encode**, **Text**, **Open URLs**, and the
share-sheet types **URLs**, **Safari web pages** and **Articles**). They have
not yet been run on a real iPhone. In particular, it is not yet confirmed:

- that Apple News hands the shortcut an `apple.news` link rather than an
  article object with no link (the **Get URLs from Input** step above is the
  fix if it doesn't);
- what the exact first-run permission prompt says.
