// MAKE-WEBLINK-FN (2026-05-30). Firebase Functions entry point.
// Single export for now: scrapeRecipe (a Callable function that fetches
// a recipe URL, parses JSON-LD, returns the title + ingredient list).

export { scrapeRecipe } from './scrape';

// BARPHOTO-3: scanBar — photo of a home bar in, list of bottles out.
export { scanBar } from './barscan';

// SHARE-4: sharePreview — link-preview tags for /r/ share links.
export { sharePreview } from './share';
