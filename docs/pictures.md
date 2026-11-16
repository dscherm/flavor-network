# Recipe pictures: what changed from the plan

The plan is `.schermness/spec.md`, "A picture for a recipe", with the addendum "Fading or removing the background". The storage, sharing and removal details are in `docs/sharing.md`, "Pictures on recipes". Nothing here is deployed.

## What was built

- A coloured-chalk filter that turns a photo into a chalk drawing in the browser, with six settings and a good default (`src/data/chalkFilter.js`, `chalkFilterBrowser.js`, `chalkWorker.js`).
- A chooser with three choices: a drawing, a photo as chalk, no picture (`src/components/RecipePicture.jsx`, `PictureField.jsx`), offered when saving an invented item, when editing one, and in the share sheet's publish step.
- Ten new chalk drawings (six glasses, four sauce vessels) beside the 23 dish drawings.
- Storage for saved items and shared copies, with rules (`profiles/{uid}/pictures`, `sharedPictures`).
- The picture shown on the saved item (Cocktail Lab and Sauce Lab "Yours"), on the shared page, and on the cards, including the link-preview card the server draws.

## Where it differs from the plan

1. **JPEG, not WebP.** The plan said WebP, with JPEG where WebP is unavailable. The server card drawing library (resvg) silently draws nothing for a WebP, so the encoder always produces JPEG (still 600 px, at most 150 KB), and the rules now accept `image/jpeg` only.
2. **No pictures under 40 px, instead of redrawn small drawings.** The plan expected the drawings to be used at small sizes. At under about 40 px they turn into faint shapes, so `PictureView` draws nothing below 40 px (`MIN_PICTURE_SIZE`) and no drawing was redrawn for small use. The smallest place a picture appears is the 40 px "Yours" row.
3. **A sixth slider, Focus.** The plan had five settings. After the owner tried the first version, Focus (0 to 100, default 0) was added: it fades the chalk background to bare slate around a centred oval (PICTURE-6). At 0 the picture is exactly the five-setting result.
4. **Cropping is only square or 4:3 landscape**, as the plan said, and is applied to the photo before the filter.

## Left out on purpose

Listed in `BACKLOG.md` under PICTURE-LEFT-OUT: publishing original photos, an AI image model, cropping beyond square and landscape, more than one picture per recipe, pictures on built-in recipes, redrawing the small drawings, copying a picture when someone saves from a shared page, and changing the picture of an existing link.

## Open with the owner

An automatic cut-out of the subject (so no oval is needed). A trial page exists (`docs/prototypes/chalk-cutout-bench.html`, https://claude.ai/artifact/D2APE3CRDfPAvHka3jdMz8). The owner has not judged it. Nothing in `src/` uses a model for it.
