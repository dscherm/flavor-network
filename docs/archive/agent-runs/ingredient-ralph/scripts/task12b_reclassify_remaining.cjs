/**
 * task12b_reclassify_remaining.cjs
 *
 * Second pass reclassification of ingredients still in category "other".
 * Applies additional keyword rules that the first pass (task12) did not cover.
 * First match wins. Only modifies the category field.
 */

const fs = require('fs');
const path = require('path');

const INGREDIENTS_PATH = path.join(__dirname, '..', '..', 'public', 'proDataset', 'ingredients.json');

// ---------------------------------------------------------------------------
// Helper: returns true if name contains ANY of the given keywords
// ---------------------------------------------------------------------------
function has(name, keywords) {
  return keywords.some(kw => name.includes(kw));
}

// ---------------------------------------------------------------------------
// Rule definitions — evaluated in order, first match wins
// ---------------------------------------------------------------------------
const rules = [
  // More proteins
  {
    category: 'protein',
    test: name => has(name, [
      'tofu', 'tempeh', 'seitan', 'egg', 'duck', 'goose', 'veal',
      'venison', 'rabbit', 'quail', 'bison', 'jerky', 'pepperoni',
      'salami', 'prosciutto', 'pancetta', 'chorizo', 'bratwurst',
      'hot dog', 'meatball', 'sardine', 'tilapia', 'catfish', 'cod',
      'halibut', 'trout', 'bass', 'snapper', 'squid', 'calamari',
      'octopus',
    ]),
  },

  // More grains
  {
    category: 'grain',
    test: name => has(name, [
      'spaghetti', 'macaroni', 'penne', 'fettuccin', 'linguine',
      'rigatoni', 'rotini', 'orzo', 'ramen', 'udon', 'wonton',
      'dumpling', 'ravioli', 'gnocchi', 'polenta', 'grits', 'granola',
      'bagel', 'croissant', 'brioche', 'focaccia', 'ciabatta',
      'sourdough', 'pretzel', 'crouton', 'stuffing', 'breadcrumb',
      'panko',
    ]),
  },

  // More fruits
  {
    category: 'fruit',
    test: name => has(name, [
      'avocado', 'olive', 'plantain', 'lychee', 'pomegranate',
      'persimmon', 'apricot', 'nectarine', 'tangelo', 'tangerine',
      'mandarin', 'clementine', 'kumquat', 'jackfruit', 'dragonfruit',
      'starfruit', 'tamarind',
    ]),
  },

  // More vegetables
  {
    category: 'vegetable',
    test: name => has(name, [
      'kale', 'arugula', 'chard', 'collard', 'endive', 'radicchio',
      'watercress', 'bok choy', 'leek', 'shallot', 'scallion', 'chive',
      'fennel', 'parsnip', 'rutabaga', 'yam', 'sweet potato', 'taro',
      'jicama', 'okra', 'daikon', 'lotus', 'bamboo shoot',
      'water chestnut', 'edamame', 'lentil', 'chickpea', 'hummus',
      'coleslaw', 'sauerkraut', 'kimchi', 'pickle',
    ]),
  },

  // Chocolate/confection
  {
    category: 'confection',
    test: name => has(name, [
      'chocolate', 'cocoa', 'cacao', 'candy', 'caramel', 'fudge',
      'ganache', 'truffle', 'toffee', 'praline', 'marshmallow',
      'meringue', 'fondant', 'icing', 'frosting', 'sprinkle',
    ]),
  },

  // More condiments
  {
    category: 'condiment',
    test: name => has(name, [
      'pesto', 'hummus', 'tahini', 'hoisin', 'sriracha', 'tabasco',
      'worcestershire', 'soy sauce', 'teriyaki', 'bbq', 'barbecue',
      'hot sauce', 'buffalo sauce', 'ranch', 'aioli',
    ]),
  },

  // More nuts/seeds
  {
    category: 'nut',
    test: name => has(name, [
      'sesame', 'sunflower', 'pumpkin seed', 'poppy seed', 'chia',
      'hemp seed', 'flax',
    ]),
  },

  // More liquids
  {
    category: 'liquid',
    test: name => has(name, [
      'water', 'soda', 'cola', 'ginger ale', 'tonic', 'lemonade',
      'smoothie',
    ]),
  },

  // Chili peppers
  {
    category: 'chili',
    test: name => has(name, [
      'chili', 'chile', 'cayenne', 'chipotle', 'jalapen', 'habanero',
      'serrano', 'ancho', 'guajillo', 'pasilla', 'pepper flake',
      'red pepper', 'black pepper',
    ]),
  },

  // Seasoning blends
  {
    category: 'seasoning',
    test: name => has(name, [
      'curry', 'garam masala', 'five spice', "za'atar", 'sumac',
      'berbere', 'ras el hanout', 'old bay', 'seasoning salt',
      'garlic salt', 'onion salt', 'celery salt',
    ]),
  },

  // Sweetener
  {
    category: 'sweetener',
    test: name => has(name, [
      'nectar', 'caramel sauce', 'dulce de leche', 'condensed milk',
    ]),
  },

  // Aromatic
  {
    category: 'aromatic',
    test: name => has(name, [
      'vanilla', 'rose', 'lavender', 'ginger', 'galangal', 'lemongrass',
      'citronella',
    ]),
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const data = JSON.parse(fs.readFileSync(INGREDIENTS_PATH, 'utf-8'));

  const otherEntries = Object.entries(data).filter(([, v]) => v.category === 'other');
  console.log(`Found ${otherEntries.length} ingredients with category "other"\n`);

  let reclassified = 0;
  const breakdown = {};
  const remaining = [];

  for (const [name, entry] of otherEntries) {
    const lowerName = name.toLowerCase();
    let matched = false;

    for (const rule of rules) {
      if (rule.test(lowerName)) {
        entry.category = rule.category;
        breakdown[rule.category] = (breakdown[rule.category] || 0) + 1;
        reclassified++;
        matched = true;
        break;
      }
    }

    if (!matched) {
      remaining.push(name);
    }
  }

  // Write back
  fs.writeFileSync(INGREDIENTS_PATH, JSON.stringify(data, null, 2), 'utf-8');

  // Report
  console.log(`Reclassified: ${reclassified}`);
  console.log(`Remaining as "other": ${remaining.length}\n`);

  console.log('Breakdown of reclassifications:');
  const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sorted) {
    console.log(`  ${cat}: ${count}`);
  }

  if (remaining.length > 0) {
    console.log(`\nRemaining "other" ingredients (${remaining.length}):`);
    for (const name of remaining.sort()) {
      console.log(`  - ${name}`);
    }
  } else {
    console.log('\nNo remaining "other" ingredients — all reclassified.');
  }
}

main();
