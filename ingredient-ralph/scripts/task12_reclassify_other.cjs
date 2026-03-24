/**
 * task12_reclassify_other.cjs
 *
 * Reclassifies ingredients with category "other" into proper categories
 * using keyword-based rules on the ingredient name. First match wins.
 * Only modifies the category field — everything else stays untouched.
 */

const fs = require('fs');
const path = require('path');

const INGREDIENTS_PATH = path.join(__dirname, '..', '..', 'public', 'proDataset', 'ingredients.json');

// ---------------------------------------------------------------------------
// Rule definitions — evaluated in order, first match wins
// ---------------------------------------------------------------------------

// Helper: returns true if name contains ANY of the given keywords
function has(name, keywords) {
  return keywords.some(kw => name.includes(kw));
}

const rules = [
  // Acid (before liquid, so "wine vinegar" matches acid not liquid)
  {
    category: 'acid',
    test: name => has(name, ['vinegar', 'lemon juice', 'lime juice']),
  },

  // Sweetener
  {
    category: 'sweetener',
    test: name => has(name, ['sugar', 'syrup', 'honey', 'molasses', 'agave', 'stevia', 'maple']),
  },

  // Dairy
  {
    category: 'dairy',
    test: name => has(name, [
      'cheese', 'cream', 'yogurt', 'yoghurt', 'milk', 'butter', 'whey',
      'ricotta', 'mozzarella', 'cheddar', 'parmesan', 'mascarpone',
      'brie', 'gouda', 'feta', 'cottage',
    ]),
  },

  // Protein
  {
    category: 'protein',
    test: name => has(name, [
      'chicken', 'beef', 'pork', 'turkey', 'lamb', 'fish', 'shrimp',
      'salmon', 'tuna', 'sausage', 'bacon', 'ham', 'steak', 'meat',
      'prawn', 'crab', 'lobster', 'scallop', 'mussel', 'clam', 'oyster',
      'anchov',
    ]),
  },

  // Grain/Baked
  {
    category: 'grain',
    test: name => has(name, [
      'bread', 'flour', 'pasta', 'noodle', 'rice', 'oat', 'wheat',
      'cracker', 'tortilla', 'pita', 'biscuit', 'cookie', 'cake',
      'muffin', 'waffle', 'pancake', 'cereal', 'couscous', 'quinoa',
      'barley',
    ]),
  },

  // Fruit
  {
    category: 'fruit',
    test: name => has(name, [
      'berry', 'apple', 'banana', 'peach', 'pear', 'plum', 'grape',
      'mango', 'melon', 'cherry', 'fig', 'date', 'prune', 'raisin',
      'cranberr', 'blueberr', 'strawberr', 'raspberr', 'blackberr',
      'pineapple', 'kiwi', 'coconut', 'papaya', 'guava', 'passion fruit',
    ]),
  },

  // Vegetable — with exclusions for condiment/fat forms
  {
    category: 'vegetable',
    test: name => {
      const vegKeywords = [
        'pepper', 'tomato', 'onion', 'carrot', 'celery', 'broccoli',
        'spinach', 'lettuce', 'cabbage', 'corn', 'pea', 'bean',
        'squash', 'zucchini', 'cucumber', 'asparagus', 'mushroom',
        'artichoke', 'radish', 'turnip', 'beet',
      ];
      const exclusions = ['sauce', 'powder', 'oil', 'extract', 'syrup', 'butter'];
      if (!has(name, vegKeywords)) return false;
      if (has(name, exclusions)) return false;
      return true;
    },
  },

  // Condiment
  {
    category: 'condiment',
    test: name => has(name, [
      'sauce', 'ketchup', 'mustard', 'mayo', 'dressing', 'relish',
      'chutney', 'salsa', 'marinade', 'glaze', 'jam', 'jelly',
      'preserve', 'spread',
    ]),
  },

  // Fat/Oil
  {
    category: 'fat',
    test: name => has(name, ['oil', 'lard', 'shortening', 'margarine', 'ghee', 'dripping']),
  },

  // Spice
  {
    category: 'spice',
    test: name => has(name, [
      'powder', 'cumin', 'turmeric', 'paprika', 'cinnamon', 'nutmeg',
      'clove', 'cardamom', 'fennel seed', 'anise', 'saffron',
      'allspice', 'fenugreek',
    ]),
  },

  // Herb
  {
    category: 'herb',
    test: name => has(name, [
      'basil', 'oregano', 'rosemary', 'sage', 'tarragon', 'chive',
      'bay leaf', 'marjoram',
    ]),
  },

  // Nut
  {
    category: 'nut',
    test: name => has(name, [
      'almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut',
      'macadamia', 'pine nut',
    ]),
  },

  // Liquid
  {
    category: 'liquid',
    test: name => has(name, [
      'broth', 'stock', 'juice', 'wine', 'beer', 'ale', 'cider',
      'tea', 'coffee',
    ]),
  },

  // Thickener
  {
    category: 'thickener',
    test: name => has(name, ['gelatin', 'pectin', 'agar', 'arrowroot', 'tapioca']),
  },

  // Extract/Flavoring → aromatic
  {
    category: 'aromatic',
    test: name => name === 'vanilla' || has(name, ['extract', 'essence']),
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
  }
}

main();
