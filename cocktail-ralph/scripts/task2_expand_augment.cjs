/**
 * task2_expand_augment.cjs
 * Expands cocktail_augment.json with 40+ missing world spirits,
 * craft/modern liqueurs, and mixers/modifiers.
 */
const fs = require('fs');
const path = require('path');

const AUGMENT_PATH = path.resolve(__dirname, '../../public/data/cocktail_augment.json');

const data = JSON.parse(fs.readFileSync(AUGMENT_PATH, 'utf8'));

const existingNames = new Set(data.ingredients.map(i => i.name.toLowerCase()));
const existingPairingKeys = new Set(
  data.pairings.map(p => `${p.source.toLowerCase()}|${p.target.toLowerCase()}`)
);

// ── New ingredients to add ──────────────────────────────────────────────────

const newIngredients = [
  // World Spirits
  { name: "pisco", category: "Spirit", taste: "sweet sour", weight: "medium", codexRole: "base" },
  { name: "cachaca", category: "Spirit", taste: "sweet", weight: "medium", codexRole: "base" },
  { name: "rhum agricole", category: "Spirit", taste: "sweet pungent", weight: "medium", codexRole: "base" },
  { name: "aquavit", category: "Spirit", taste: "bitter pungent", weight: "medium", codexRole: "base" },
  { name: "genever", category: "Spirit", taste: "bitter sweet", weight: "medium", codexRole: "base" },
  { name: "shochu", category: "Spirit", taste: "sweet", weight: "light", codexRole: "base" },
  { name: "baijiu", category: "Spirit", taste: "pungent", weight: "heavy", codexRole: "base" },
  { name: "sotol", category: "Spirit", taste: "bitter pungent", weight: "medium", codexRole: "base" },
  { name: "grappa", category: "Spirit", taste: "bitter pungent", weight: "heavy", codexRole: "base" },
  { name: "eau de vie", category: "Spirit", taste: "sweet", weight: "light", codexRole: "base" },
  { name: "soju", category: "Spirit", taste: "sweet", weight: "light", codexRole: "base" },
  { name: "arrack", category: "Spirit", taste: "sweet pungent", weight: "medium", codexRole: "base" },

  // Craft/Modern
  { name: "falernum", category: "Liqueur", taste: "spicy sweet", weight: "medium", codexRole: "modifier" },
  { name: "velvet falernum", category: "Liqueur", taste: "spicy sweet", weight: "medium", codexRole: "modifier" },
  { name: "allspice dram", category: "Liqueur", taste: "spicy sweet", weight: "medium", codexRole: "accent" },
  { name: "creme de violette", category: "Liqueur", taste: "bitter sweet", weight: "light", codexRole: "accent" },
  { name: "suze", category: "Liqueur", taste: "bitter", weight: "medium", codexRole: "modifier" },
  { name: "amaro montenegro", category: "Liqueur", taste: "bitter sweet", weight: "medium", codexRole: "modifier" },
  { name: "amaro nonino", category: "Liqueur", taste: "bitter sweet", weight: "medium", codexRole: "modifier" },
  { name: "fernet branca", category: "Liqueur", taste: "bitter pungent", weight: "heavy", codexRole: "seasoning" },
  { name: "cynar", category: "Liqueur", taste: "bitter sweet", weight: "medium", codexRole: "modifier" },
  { name: "aperol", category: "Liqueur", taste: "bitter sweet", weight: "light", codexRole: "modifier" },
  { name: "yellow chartreuse", category: "Liqueur", taste: "bitter sweet", weight: "medium", codexRole: "modifier" },
  { name: "benedictine", category: "Liqueur", taste: "bitter sweet", weight: "medium", codexRole: "modifier" },
  { name: "galliano", category: "Liqueur", taste: "sweet", weight: "medium", codexRole: "accent" },
  { name: "licor 43", category: "Liqueur", taste: "sweet", weight: "medium", codexRole: "sweetener" },
  { name: "pimm's", category: "Liqueur", taste: "bitter sweet", weight: "light", codexRole: "modifier" },

  // Mixers/Modifiers
  { name: "coconut water", category: "Mixer", taste: "sweet", weight: "light", codexRole: "lengthener" },
  { name: "orgeat", category: "Sweetener", taste: "sweet", weight: "medium", codexRole: "sweetener" },
  { name: "honey syrup", category: "Sweetener", taste: "sweet", weight: "medium", codexRole: "sweetener" },
  { name: "demerara syrup", category: "Sweetener", taste: "sweet", weight: "medium", codexRole: "sweetener" },
  { name: "ginger syrup", category: "Sweetener", taste: "spicy sweet", weight: "medium", codexRole: "sweetener" },
  { name: "passion fruit syrup", category: "Sweetener", taste: "sour sweet", weight: "medium", codexRole: "sweetener" },
  { name: "cinnamon syrup", category: "Sweetener", taste: "spicy sweet", weight: "medium", codexRole: "sweetener" },
  { name: "oleo saccharum", category: "Sweetener", taste: "sweet", weight: "medium", codexRole: "sweetener" },
  { name: "saline solution", category: "Seasoning", taste: "salty", weight: "light", codexRole: "seasoning" },
];

// ── Pairings for each new ingredient ────────────────────────────────────────

const newPairingsMap = {
  "pisco": [
    ["lime juice", 0.90], ["simple syrup", 0.85], ["egg white", 0.85],
    ["angostura bitters", 0.75], ["ginger", 0.70], ["lemon juice", 0.80]
  ],
  "cachaca": [
    ["lime juice", 0.92], ["sugar", 0.88], ["passion fruit", 0.80],
    ["coconut", 0.75], ["ginger", 0.72], ["pineapple juice", 0.78]
  ],
  "rhum agricole": [
    ["lime juice", 0.88], ["simple syrup", 0.82], ["orange juice", 0.78],
    ["falernum", 0.80], ["angostura bitters", 0.75], ["pineapple juice", 0.82],
    ["coconut cream", 0.76]
  ],
  "aquavit": [
    ["lemon juice", 0.82], ["dill", 0.80], ["grapefruit juice", 0.78],
    ["honey", 0.75], ["caraway", 0.72], ["tonic water", 0.70]
  ],
  "genever": [
    ["lemon juice", 0.85], ["sugar", 0.80], ["orange", 0.78],
    ["angostura bitters", 0.75], ["sweet vermouth", 0.82], ["dry vermouth", 0.78]
  ],
  "shochu": [
    ["lemon juice", 0.82], ["soda water", 0.80], ["grapefruit juice", 0.78],
    ["green tea", 0.75], ["cucumber", 0.72], ["ginger", 0.70]
  ],
  "baijiu": [
    ["lemon juice", 0.78], ["honey syrup", 0.75], ["ginger", 0.80],
    ["lychee", 0.72], ["soda water", 0.70], ["simple syrup", 0.68]
  ],
  "sotol": [
    ["lime juice", 0.85], ["agave syrup", 0.82], ["grapefruit juice", 0.78],
    ["mezcal", 0.72], ["orange bitters", 0.70], ["pineapple juice", 0.75]
  ],
  "grappa": [
    ["lemon juice", 0.82], ["honey", 0.78], ["espresso", 0.80],
    ["simple syrup", 0.75], ["orange", 0.72], ["chamomile", 0.68]
  ],
  "eau de vie": [
    ["lemon juice", 0.82], ["simple syrup", 0.80], ["prosecco", 0.78],
    ["elderflower", 0.75], ["peach", 0.85], ["apricot", 0.82]
  ],
  "soju": [
    ["lemon juice", 0.80], ["watermelon", 0.78], ["peach", 0.80],
    ["grapefruit juice", 0.75], ["soda water", 0.72], ["yogurt", 0.68]
  ],
  "arrack": [
    ["lime juice", 0.85], ["simple syrup", 0.82], ["pineapple juice", 0.80],
    ["coconut", 0.78], ["angostura bitters", 0.72], ["ginger beer", 0.75]
  ],
  "velvet falernum": [
    ["rum", 0.88], ["lime juice", 0.85], ["angostura bitters", 0.78],
    ["pineapple juice", 0.80], ["ginger beer", 0.75], ["bourbon", 0.70]
  ],
  "allspice dram": [
    ["rum", 0.85], ["lime juice", 0.78], ["angostura bitters", 0.80],
    ["honey", 0.75], ["bourbon", 0.72], ["lemon juice", 0.76]
  ],
  "creme de violette": [
    ["gin", 0.88], ["lemon juice", 0.82], ["maraschino liqueur", 0.85],
    ["simple syrup", 0.70], ["prosecco", 0.72], ["egg white", 0.68]
  ],
  "suze": [
    ["gin", 0.82], ["lemon juice", 0.80], ["tonic water", 0.78],
    ["grapefruit juice", 0.76], ["dry vermouth", 0.75], ["simple syrup", 0.68]
  ],
  "amaro nonino": [
    ["bourbon", 0.85], ["sweet vermouth", 0.82], ["lemon juice", 0.80],
    ["orange bitters", 0.78], ["rye whiskey", 0.82], ["prosecco", 0.72]
  ],
  "fernet branca": [
    ["cola", 0.82], ["mint", 0.78], ["espresso", 0.75],
    ["sugar", 0.70], ["rye whiskey", 0.72], ["ginger beer", 0.68]
  ],
  "cynar": [
    ["bourbon", 0.80], ["sweet vermouth", 0.82], ["lemon juice", 0.78],
    ["orange bitters", 0.75], ["grapefruit juice", 0.76], ["soda water", 0.68]
  ],
  "licor 43": [
    ["espresso", 0.85], ["heavy cream", 0.82], ["vodka", 0.78],
    ["orange juice", 0.80], ["vanilla", 0.75], ["milk", 0.72]
  ],
  "pimm's": [
    ["lemon-lime soda", 0.85], ["cucumber", 0.82], ["strawberry", 0.80],
    ["mint", 0.78], ["lemon juice", 0.75], ["ginger ale", 0.82]
  ],
  "coconut water": [
    ["rum", 0.82], ["lime juice", 0.80], ["pineapple juice", 0.85],
    ["vodka", 0.72], ["coconut cream", 0.78], ["ginger", 0.70]
  ],
  "passion fruit syrup": [
    ["rum", 0.85], ["lime juice", 0.82], ["prosecco", 0.80],
    ["vodka", 0.75], ["pineapple juice", 0.78], ["egg white", 0.72]
  ],
  "cinnamon syrup": [
    ["bourbon", 0.85], ["rum", 0.82], ["lemon juice", 0.78],
    ["apple", 0.80], ["angostura bitters", 0.75], ["egg white", 0.70]
  ],
  "oleo saccharum": [
    ["lemon juice", 0.88], ["rum", 0.82], ["brandy", 0.85],
    ["tea", 0.80], ["bourbon", 0.78], ["prosecco", 0.75]
  ],
  "saline solution": [
    ["bourbon", 0.78], ["tequila", 0.78], ["rum", 0.75],
    ["lime juice", 0.72], ["simple syrup", 0.70], ["grapefruit juice", 0.72]
  ],
};

// For ingredients that already exist but need pairings added anyway,
// we skip adding the ingredient but still add pairings from the map
// if they were specified.

// ── Also add pairings for existing ingredients that overlap with new list ──
// falernum, aperol, yellow chartreuse, benedictine, galliano,
// amaro montenegro, orgeat, honey syrup, demerara syrup, ginger syrup
// already exist. We add pairings for them if not already present.

const existingIngredientPairings = {
  "falernum": [
    ["rum", 0.88], ["lime juice", 0.85], ["angostura bitters", 0.78],
    ["pineapple juice", 0.80], ["ginger beer", 0.75]
  ],
  "aperol": [
    ["prosecco", 0.88], ["soda water", 0.82], ["gin", 0.80],
    ["lemon juice", 0.78], ["grapefruit juice", 0.82], ["orange juice", 0.75]
  ],
  "yellow chartreuse": [
    ["gin", 0.85], ["lemon juice", 0.82], ["maraschino liqueur", 0.80],
    ["dry vermouth", 0.78], ["lime juice", 0.75], ["pineapple juice", 0.72]
  ],
  "benedictine": [
    ["rye whiskey", 0.85], ["bourbon", 0.82], ["lemon juice", 0.78],
    ["angostura bitters", 0.80], ["cognac", 0.82], ["honey", 0.72]
  ],
  "galliano": [
    ["vodka", 0.82], ["orange juice", 0.85], ["espresso", 0.80],
    ["lime juice", 0.75], ["cream", 0.72], ["coffee liqueur", 0.78]
  ],
  "amaro montenegro": [
    ["bourbon", 0.82], ["rye whiskey", 0.80], ["lemon juice", 0.78],
    ["orange bitters", 0.75], ["sweet vermouth", 0.80], ["soda water", 0.70]
  ],
  "orgeat": [
    ["rum", 0.88], ["lime juice", 0.85], ["orange juice", 0.80],
    ["bourbon", 0.75], ["brandy", 0.78], ["pineapple juice", 0.82]
  ],
  "honey syrup": [
    ["bourbon", 0.88], ["lemon juice", 0.85], ["rum", 0.82],
    ["scotch", 0.80], ["ginger", 0.78], ["rye whiskey", 0.75]
  ],
  "demerara syrup": [
    ["rum", 0.88], ["bourbon", 0.85], ["lime juice", 0.82],
    ["angostura bitters", 0.80], ["lemon juice", 0.78], ["cognac", 0.75]
  ],
  "ginger syrup": [
    ["bourbon", 0.82], ["rum", 0.80], ["lemon juice", 0.85],
    ["lime juice", 0.82], ["vodka", 0.75], ["soda water", 0.72]
  ],
  "passion fruit syrup": [
    ["rum", 0.85], ["lime juice", 0.82], ["prosecco", 0.80],
    ["vodka", 0.75], ["pineapple juice", 0.78], ["egg white", 0.72]
  ],
};

// ── Process ─────────────────────────────────────────────────────────────────

let ingredientsAdded = 0;
let pairingsAdded = 0;

// Add new ingredients (skip existing)
for (const ing of newIngredients) {
  const lowerName = ing.name.toLowerCase();
  if (existingNames.has(lowerName)) {
    continue;
  }
  data.ingredients.push(ing);
  existingNames.add(lowerName);
  ingredientsAdded++;
}

// Helper: add a pairing if it doesn't already exist
function addPairing(source, target, strength) {
  const key = `${source.toLowerCase()}|${target.toLowerCase()}`;
  if (existingPairingKeys.has(key)) return false;
  data.pairings.push({ source: source.toLowerCase(), target: target.toLowerCase(), strength });
  existingPairingKeys.add(key);
  return true;
}

// Add pairings for new ingredients
for (const [ingredient, pairs] of Object.entries(newPairingsMap)) {
  for (const [target, strength] of pairs) {
    if (addPairing(ingredient, target, strength)) pairingsAdded++;
  }
}

// Add pairings for existing ingredients that were in the task spec
for (const [ingredient, pairs] of Object.entries(existingIngredientPairings)) {
  for (const [target, strength] of pairs) {
    if (addPairing(ingredient, target, strength)) pairingsAdded++;
  }
}

// Update cocktailIngredientNames
const existingNamesSet = new Set(data.cocktailIngredientNames.map(n => n.toLowerCase()));
for (const ing of newIngredients) {
  if (!existingNamesSet.has(ing.name.toLowerCase())) {
    data.cocktailIngredientNames.push(ing.name.toLowerCase());
    existingNamesSet.add(ing.name.toLowerCase());
  }
}

// Write back
fs.writeFileSync(AUGMENT_PATH, JSON.stringify(data, null, 2), 'utf8');

console.log(`Ingredients added: ${ingredientsAdded}`);
console.log(`Pairings added: ${pairingsAdded}`);
console.log(`Total ingredients: ${data.ingredients.length}`);
console.log(`Total pairings: ${data.pairings.length}`);
console.log(`Total cocktailIngredientNames: ${data.cocktailIngredientNames.length}`);
