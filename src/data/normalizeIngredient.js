// Ingredient-name normalization: strip leading measurement, parenthetical
// asides, and trailing qualifier words to get a canonical lower-case
// ingredient label that matches the ProData pairings graph. Extracted
// from the retired cocktailCodex.js so CocktailDetailPanel (and any
// future consumer) can pull it without dragging in the legacy v1 codex
// loader.

const STOP = new Set([
  'oz','ounce','ounces','cl','ml','dash','dashes','drop','drops','tsp','tbsp','teaspoon','teaspoons',
  'tablespoon','tablespoons','parts','part','cube','cubes','splash','splashes','sprays','spray',
  'pinch','jigger','jiggers','cup','cups','liter','liters','pony','tin','batch',
  'to','taste','of','the','a','an','and','or','with','no','none','about','around',
  'approximately','very','if','needed','for','optional','our','ideal','recipe','classic',
  'signature','specifically','typically','standard','wet',
  'fresh','cold','hot','chilled',
  'small','large','whole','half','thin','sliced','crushed','grated','muddled','expressed',
  'discarded','served','rim','garnish','blended','reserve',
]);

export function normalizeIngredient(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  s = s.replace(/^[¼½¾⅓⅔⅛⅜⅝⅞0-9]+[¼½¾⅓⅔⅛⅜⅝⅞0-9.\s/()-]*\s*(ounces|ounce|oz|dashes|dash|drops|drop|teaspoons?|tablespoons?|tsp|tbsp|parts?|cubes?|splashes|splash|sprays?|to taste|pinch|jiggers?|cups?|cl|ml)?\s*/i, '');
  s = s.replace(/\([^)]*\)/g, '');
  s = s.replace(/[,;].*$/, '');
  s = s.replace(/^(Garnish|Rim):\s*/i, '');
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  const tokens = s.split(' ').filter((t) => !STOP.has(t));
  return tokens.join(' ').trim();
}
