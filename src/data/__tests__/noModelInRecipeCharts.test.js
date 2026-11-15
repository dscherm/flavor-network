import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// FLAVOR-6: no RECIPE chart surface reads the model's per-ingredient values. The per-ingredient wheels and
// radars and the parked 3D Network views may (see docs/flavor-profile.md, "Where the charts stand").
const RECIPE_CHART_FILES = [
  'src/data/inventProfile.js', 'src/data/recipeProfileAnalysis.js', 'src/data/flavorTaste.js', 'src/data/flavorAroma.js',
  'src/data/flavorStrengths.js', 'src/data/flavorAromas.js', 'src/data/shareCardData.js', 'src/data/sharedLoaders.js',
  'src/data/recipeAromaSimilarity.js', 'src/components/RecipeFlavorProfilesCard.jsx', 'src/components/InventFlavorProfile.jsx',
  'src/components/InventCocktail.jsx', 'src/components/InventSauce.jsx', 'src/components/InventRecipe.jsx',
  'src/components/SharedRecipePage.jsx', 'src/components/ShareImages.jsx', 'src/components/OwnShare.jsx',
  'src/components/SuggestionCardDeck.jsx', 'src/components/SauceSuggestionDeck.jsx', 'src/components/ProfileAxisRadar.jsx',
  'scripts/buildShareIndex.mjs', 'scripts/lib/flavorNodes.mjs', 'scripts/measureFlavorProfile.mjs',
];
const code = (p) => readFileSync(p, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

describe('recipe charts do not read the model', () => {
  for (const f of RECIPE_CHART_FILES) {
    it(`${f} neither reads gnnProbs nor loads gnn_entropy.json`, () => {
      const src = code(f);
      expect(src).not.toMatch(/\.gnnProbs|gnnProbs\s*[:?]|gnn_entropy/);
    });
  }
});
