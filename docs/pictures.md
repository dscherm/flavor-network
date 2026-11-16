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

## Remove background: an automatic cut-out (PICTURE-8)

A "Remove background" button in the "A photo as chalk" step, beside Adjust. Tapping it finds the main subject of the photo and draws chalk only there; the rest stays bare slate with a soft edge. Tap it again to turn it off. Focus still works with or without it (the two fade together).

How it works:
- The model is U2-Net small (`u2netp.onnx`, 4.6 MB, Apache-2.0, see `THIRD_PARTY_NOTICES.md`), run with onnxruntime-web, the runtime the recipe model already uses. It runs on the device, in the runtime's own worker (`ort.env.wasm.proxy`), so the page stays responsive; the picture is shrunk to 320 x 320 for it, and its answer is stretched, enlarged and feathered back to the picture's size.
- Nothing is loaded until the tap. The tap dynamically imports `src/data/chalkCutout.js` (2.9 KB) and the runtime chunk, then requests one file from this site's own hosting: `/models/u2netp.onnx`, the first time only (the browser caches it). Nothing else is requested; the photo, its pixels and the subject map are not sent anywhere. A test pins the single fetch and that the arithmetic module has no network call.
- The pure filter takes an optional `mask` (one 0..1 value per pixel). With no mask its output is byte-identical to before (the prototype parity tests are untouched).
- Only the finished chalk JPEG is stored, as before. No cut-out setting or map is stored or migrated.

When it cannot do it, the picture is drawn without a cut-out, a plain sentence says so, and saving still works:
- No WebAssembly: "This browser can't run the cut-out, so the whole picture is drawn."
- No clear subject (the map keeps under 3% or over 97% of the picture): "I couldn't find a clear subject in this photo, so the whole picture is drawn."
- The model file or runtime would not load, or it failed while working (for example out of memory): "The cut-out couldn't run on this device, so the whole picture is drawn."
- "Cancel cut-out" while it is working stops waiting for it and draws without one, with no sentence. Because the runtime's worker cannot be interrupted, the work in progress finishes unseen.

Honest limits (also one line under the buttons in the app): clear glass and busy backgrounds may cut badly, and the first use downloads about 5 MB. Measured on the development machine, in the dev server's browser pane, on two drawn pictures (not photographs): about 1.7 s from tap to subject map once the model is loaded, and about 3.3 s the first time (model fetch and start included). The kept shapes were the plate and its food (about 15% of each picture); in the plain scene the chalk lit 98% of the picture without the cut-out and 21% with it, in the shelf-behind-the-plate scene 67% and 19%. A phone's time was not measured.
