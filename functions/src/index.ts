// MAKE-WEBLINK-FN (2026-05-30). Firebase Functions entry point.
// Single export for now: scrapeRecipe (a Callable function that fetches
// a recipe URL, parses JSON-LD, returns the title + ingredient list).

export { scrapeRecipe } from './scrape';
