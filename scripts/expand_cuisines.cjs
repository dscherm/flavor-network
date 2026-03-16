/**
 * Expand cuisine_map.json to ensure underrepresented cuisines have adequate ingredient coverage.
 *
 * Approach: Use explicit ingredient lists with exact name matching primarily,
 * and carefully scoped pattern matching only where genuinely appropriate.
 */

const fs = require('fs');
const path = require('path');

const cuisineMapPath = path.join(__dirname, '..', 'public', 'data', 'cuisine_map.json');
const cuisineMap = JSON.parse(fs.readFileSync(cuisineMapPath, 'utf8'));
const allNames = Object.keys(cuisineMap);

// Build a lookup index for faster matching
const nameSet = new Set(allNames);

// Exact match assignment
function assignExact(name, cuisine) {
  if (cuisineMap[name] && !cuisineMap[name].includes(cuisine)) {
    cuisineMap[name].push(cuisine);
  }
}

// Assign cuisine to all ingredients whose name starts with prefix
function assignStartsWith(prefix, cuisine) {
  for (const name of allNames) {
    if (name.startsWith(prefix) || name === prefix) {
      if (!cuisineMap[name].includes(cuisine)) {
        cuisineMap[name].push(cuisine);
      }
    }
  }
}

// Assign cuisine to all ingredients containing a word (with word boundaries)
function assignWord(word, cuisine) {
  // Match word at start, end, or surrounded by spaces/hyphens
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(^|[\\s\\-])' + escaped + '($|[\\s\\-])', 'i');
  for (const name of allNames) {
    if (name === word || re.test(name)) {
      if (!cuisineMap[name].includes(cuisine)) {
        cuisineMap[name].push(cuisine);
      }
    }
  }
}

// Batch assign a list of exact ingredient names to a cuisine
function batchAssign(names, cuisine) {
  for (const n of names) {
    assignExact(n, cuisine);
  }
}

// Batch assign using startsWith for a list of prefixes
function batchStartsWith(prefixes, cuisine) {
  for (const p of prefixes) {
    assignStartsWith(p, cuisine);
  }
}

// Batch assign using word matching for a list of words
function batchWord(words, cuisine) {
  for (const w of words) {
    assignWord(w, cuisine);
  }
}

// Assign to multiple cuisines at once
function batchAssignMulti(names, cuisines) {
  for (const c of cuisines) batchAssign(names, c);
}
function batchStartsWithMulti(prefixes, cuisines) {
  for (const c of cuisines) batchStartsWith(prefixes, c);
}
function batchWordMulti(words, cuisines) {
  for (const c of cuisines) batchWord(words, c);
}

// ============================================================
// COMMON PROTEINS - assign by word match to relevant cuisines
// ============================================================

const allTargets = [
  'Pakistani', 'Sri Lankan', 'Malaysian', 'Indonesian', 'Filipino',
  'Ethiopian', 'West African', 'South African', 'Moroccan',
  'Hungarian', 'Polish', 'Portuguese', 'Russian', 'Scandinavian',
  'Israeli', 'Lebanese', 'Persian', 'Turkish',
  'Australian', 'Pacific Islander',
  'Cajun/Creole', 'Southern US', 'Tex-Mex',
  'Peruvian', 'Brazilian', 'Argentine', 'Caribbean'
];

// Chicken is used everywhere
batchStartsWithMulti(['chicken'], allTargets);

// Beef is used widely
batchStartsWithMulti(['beef'], allTargets);

// Lamb/goat - very common in Middle East, South Asia, Africa, Latin America, Europe
const lambCuisines = [
  'Pakistani', 'Sri Lankan', 'Ethiopian', 'West African', 'South African', 'Moroccan',
  'Hungarian', 'Polish', 'Portuguese', 'Russian', 'Scandinavian',
  'Israeli', 'Lebanese', 'Persian', 'Turkish',
  'Australian', 'Pacific Islander',
  'Peruvian', 'Argentine', 'Caribbean',
  'Malaysian', 'Indonesian', 'Brazilian'
];
batchStartsWithMulti(['lamb'], lambCuisines);

// Pork
const porkCuisines = [
  'Filipino', 'Malaysian', 'Indonesian',
  'Hungarian', 'Polish', 'Portuguese', 'Russian', 'Scandinavian',
  'Australian', 'Pacific Islander',
  'Cajun/Creole', 'Southern US', 'Tex-Mex',
  'Peruvian', 'Brazilian', 'Argentine', 'Caribbean',
  'South African', 'West African'
];
batchStartsWithMulti(['pork'], porkCuisines);

// Seafood
const seafoodCuisines = [
  'Pakistani', 'Sri Lankan', 'Malaysian', 'Indonesian', 'Filipino',
  'West African', 'South African', 'Moroccan', 'Portuguese',
  'Scandinavian', 'Israeli', 'Lebanese', 'Turkish',
  'Australian', 'Pacific Islander',
  'Cajun/Creole', 'Southern US',
  'Peruvian', 'Brazilian', 'Caribbean'
];
batchStartsWithMulti(['shrimp', 'prawn', 'fish', 'crab', 'lobster', 'clam', 'mussel', 'oyster', 'squid', 'scallop', 'salmon', 'tuna', 'cod', 'sardine', 'anchov'], seafoodCuisines);

// Eggs - universal
batchStartsWithMulti(['egg'], allTargets);

// ============================================================
// DAIRY - assign selectively
// ============================================================
const dairyCuisines = [
  'Pakistani', 'Sri Lankan', 'Hungarian', 'Polish', 'Portuguese',
  'Russian', 'Scandinavian', 'Israeli', 'Lebanese', 'Persian', 'Turkish',
  'Australian', 'Cajun/Creole', 'Southern US', 'Tex-Mex',
  'Argentine', 'Brazilian', 'Peruvian', 'Caribbean',
  'South African', 'Ethiopian', 'Moroccan'
];

batchStartsWithMulti(['milk', 'cream', 'butter', 'cheese', 'yogurt', 'sour cream', 'cottage cheese', 'cream cheese'], dairyCuisines);

// ============================================================
// GRAINS & STARCHES
// ============================================================
// Rice - universal
batchStartsWithMulti(['rice'], allTargets);

// Flour & bread - universal
batchStartsWithMulti(['flour', 'bread'], allTargets);

// Pasta/noodle
const pastaCuisines = [
  'Filipino', 'Malaysian', 'Indonesian',
  'Hungarian', 'Polish', 'Portuguese', 'Russian', 'Scandinavian',
  'Israeli', 'Lebanese', 'Turkish',
  'Australian', 'Pacific Islander',
  'Cajun/Creole', 'Southern US',
  'Peruvian', 'Brazilian', 'Argentine', 'Caribbean',
  'South African', 'Ethiopian'
];
batchStartsWithMulti(['pasta', 'noodle', 'spaghetti', 'macaroni', 'vermicelli'], pastaCuisines);

// Corn
batchStartsWithMulti(['corn'], [
  'Pakistani', 'Ethiopian', 'West African', 'South African', 'Moroccan',
  'Hungarian', 'Polish', 'Portuguese', 'Russian',
  'Australian', 'Pacific Islander',
  'Cajun/Creole', 'Southern US', 'Tex-Mex',
  'Peruvian', 'Brazilian', 'Argentine', 'Caribbean',
  'Filipino', 'Malaysian', 'Indonesian'
]);

// ============================================================
// VEGETABLES - universal ingredients
// ============================================================
const vegAllCuisines = allTargets;

batchStartsWithMulti(['onion', 'garlic', 'tomato', 'potato', 'carrot', 'celery'], vegAllCuisines);

// Leafy greens
batchStartsWithMulti(['spinach', 'cabbage', 'lettuce', 'kale'], allTargets);

// Other common veggies
batchStartsWithMulti([
  'bell pepper', 'green pepper', 'red pepper',
  'cucumber', 'zucchini', 'eggplant', 'squash', 'pumpkin',
  'mushroom', 'broccoli', 'cauliflower',
  'green bean', 'pea ', 'sweet potato', 'okra',
  'turnip', 'radish', 'beet', 'beetroot'
], allTargets);

// Specific vegetables
batchAssignMulti([
  'pea', 'bean', 'lentil', 'chickpea', 'sweet potato', 'yam',
  'okra', 'eggplant', 'squash', 'pumpkin', 'zucchini',
  'asparagus', 'artichoke', 'avocado',
  'mushroom', 'corn', 'plantain'
], allTargets);

// ============================================================
// FRUITS
// ============================================================
const fruitCuisines = allTargets;
batchStartsWithMulti(['lemon', 'lime', 'orange', 'apple', 'banana', 'mango', 'pineapple'], fruitCuisines);

const tropicalCuisines = [
  'Pakistani', 'Sri Lankan', 'Malaysian', 'Indonesian', 'Filipino',
  'Ethiopian', 'West African', 'South African', 'Moroccan',
  'Caribbean', 'Brazilian', 'Peruvian',
  'Pacific Islander', 'Australian'
];
batchStartsWithMulti(['coconut', 'papaya', 'guava', 'passion fruit', 'tamarind', 'jackfruit'], tropicalCuisines);
batchAssignMulti(['coconut', 'coconut milk', 'coconut cream', 'coconut oil', 'coconut water',
  'coconut flake', 'shredded coconut', 'desiccated coconut'], tropicalCuisines);

// Dates, figs, raisins - Middle East, Africa, South Asia
const driedFruitCuisines = [
  'Pakistani', 'Sri Lankan', 'Ethiopian', 'West African', 'South African', 'Moroccan',
  'Israeli', 'Lebanese', 'Persian', 'Turkish',
  'Hungarian', 'Polish', 'Portuguese', 'Russian', 'Scandinavian',
  'Australian', 'Caribbean', 'Brazilian', 'Argentine', 'Peruvian'
];
batchStartsWithMulti(['date', 'fig', 'raisin', 'prune', 'apricot', 'dried fruit'], driedFruitCuisines);

// Berries - European, American, Australian
const berryCuisines = [
  'Hungarian', 'Polish', 'Portuguese', 'Russian', 'Scandinavian',
  'Australian', 'Cajun/Creole', 'Southern US',
  'Argentine', 'Brazilian', 'Peruvian', 'Caribbean',
  'South African', 'Israeli', 'Turkish'
];
batchStartsWithMulti(['strawberry', 'blueberry', 'raspberry', 'blackberry', 'cherry', 'cranberry', 'grape'], berryCuisines);

batchAssignMulti(['peach', 'plum', 'pear', 'watermelon', 'melon', 'cantaloupe'], allTargets);

// ============================================================
// HERBS
// ============================================================
const herbCuisines = allTargets;
batchAssignMulti([
  'parsley', 'cilantro', 'mint', 'basil', 'thyme', 'oregano',
  'rosemary', 'sage', 'bay leaf', 'dill', 'tarragon', 'chive',
  'marjoram'
], herbCuisines);
batchStartsWithMulti(['parsley', 'cilantro', 'mint', 'basil', 'thyme', 'oregano',
  'rosemary', 'sage', 'bay leaf', 'dill', 'tarragon', 'chive'], herbCuisines);

// ============================================================
// SPICES
// ============================================================
// Universal spices
batchAssignMulti([
  'salt', 'black pepper', 'white pepper', 'pepper',
  'cinnamon', 'nutmeg', 'allspice', 'clove', 'ginger',
  'cumin', 'coriander', 'paprika', 'cayenne', 'turmeric'
], allTargets);
batchStartsWithMulti(['cinnamon', 'nutmeg', 'ginger', 'cumin', 'paprika', 'turmeric'], allTargets);

// South Asian / Middle Eastern spices
const sasMeCuisines = [
  'Pakistani', 'Sri Lankan', 'Ethiopian', 'Moroccan',
  'Israeli', 'Lebanese', 'Persian', 'Turkish',
  'Malaysian', 'Indonesian'
];
batchAssignMulti([
  'cardamom', 'fenugreek', 'fennel', 'fennel seed',
  'saffron', 'star anise', 'curry powder', 'garam masala',
  'mustard seed', 'nigella', 'caraway', 'anise', 'anise seed',
  'poppy seed', 'sesame seed', 'sesame'
], sasMeCuisines);
batchStartsWithMulti(['cardamom', 'fenugreek', 'fennel', 'saffron', 'curry'], sasMeCuisines);

// Chili/hot peppers
batchStartsWithMulti(['chili', 'chilli', 'jalapen', 'serrano', 'habanero', 'chipotle', 'cayenne', 'hot sauce', 'hot pepper'], allTargets);
batchAssignMulti(['chili powder', 'red pepper flake', 'crushed red pepper', 'chili flake'], allTargets);

// ============================================================
// OILS & FATS
// ============================================================
batchAssignMulti([
  'olive oil', 'vegetable oil', 'canola oil', 'sunflower oil', 'corn oil',
  'sesame oil', 'peanut oil', 'coconut oil', 'palm oil',
  'butter', 'ghee', 'lard', 'margarine',
  'oil', 'cooking oil', 'frying oil'
], allTargets);

// ============================================================
// CONDIMENTS & SAUCES
// ============================================================
batchAssignMulti([
  'vinegar', 'soy sauce', 'fish sauce', 'worcestershire sauce',
  'ketchup', 'mustard', 'mayonnaise', 'hot sauce', 'tabasco sauce',
  'tomato paste', 'tomato sauce', 'tomato puree',
  'honey', 'sugar', 'brown sugar', 'molasses', 'syrup'
], allTargets);

batchStartsWithMulti(['vinegar', 'soy sauce', 'honey', 'sugar', 'molasses'], allTargets);

// Asian sauces
const asianCuisines = ['Malaysian', 'Indonesian', 'Filipino', 'Sri Lankan', 'Pakistani'];
batchAssignMulti([
  'oyster sauce', 'hoisin sauce', 'fish sauce', 'shrimp paste',
  'bean paste', 'chili sauce', 'chili paste', 'sweet chili sauce',
  'rice vinegar', 'mirin', 'sake', 'dark soy sauce', 'light soy sauce'
], asianCuisines);

// ============================================================
// NUTS & SEEDS
// ============================================================
batchStartsWithMulti(['almond', 'walnut', 'cashew', 'peanut', 'pistachio', 'hazelnut', 'pecan', 'pine nut', 'sesame'], allTargets);
batchAssignMulti(['nut', 'mixed nut'], allTargets);

// ============================================================
// BEVERAGES & LIQUIDS
// ============================================================
batchAssignMulti([
  'water', 'tea', 'coffee', 'beer', 'wine', 'red wine', 'white wine',
  'stock', 'broth', 'bouillon',
  'chicken stock', 'beef stock', 'vegetable stock',
  'chicken broth', 'beef broth'
], allTargets);

batchStartsWithMulti(['stock', 'broth', 'bouillon'], allTargets);

// ============================================================
// BAKING ESSENTIALS
// ============================================================
batchAssignMulti([
  'baking powder', 'baking soda', 'yeast', 'active dry yeast',
  'vanilla', 'vanilla extract', 'chocolate', 'cocoa',
  'cornstarch', 'gelatin', 'powdered sugar', 'confectioner',
  'condensed milk', 'evaporated milk'
], allTargets);
batchStartsWithMulti(['vanilla', 'chocolate', 'cocoa', 'baking'], allTargets);

// ============================================================
// CUISINE-SPECIFIC INGREDIENTS
// ============================================================

// --- PAKISTANI ---
batchAssign([
  'ghee', 'yogurt', 'paneer', 'naan', 'chapati', 'roti',
  'basmati rice', 'biryani', 'dal', 'lentil',
  'garam masala', 'curry powder', 'turmeric', 'cumin',
  'coriander', 'cardamom', 'clove', 'cinnamon', 'fenugreek',
  'mustard seed', 'fennel seed', 'nigella',
  'black cardamom', 'green cardamom',
  'tamarind', 'pomegranate', 'mango', 'rose water',
  'saffron', 'mint', 'cilantro', 'parsley', 'dill',
  'lamb', 'goat', 'chicken', 'beef',
  'kidney bean', 'black bean', 'mung bean', 'split pea',
  'spinach', 'okra', 'eggplant', 'cauliflower',
  'cashew', 'almond', 'pistachio', 'walnut',
  'raisin', 'date', 'fig',
  'chickpea', 'chickpea flour'
], 'Pakistani');

// --- SRI LANKAN ---
batchAssign([
  'coconut milk', 'coconut cream', 'coconut oil', 'coconut',
  'curry leaf', 'pandan', 'lemongrass', 'galangal',
  'cinnamon', 'cardamom', 'clove', 'nutmeg', 'mace',
  'turmeric', 'cumin', 'coriander', 'fenugreek', 'fennel seed',
  'mustard seed', 'curry powder', 'chili powder', 'chili flake',
  'tamarind', 'lime', 'vinegar',
  'rice', 'rice flour', 'lentil', 'dal', 'chickpea',
  'jackfruit', 'plantain', 'banana', 'mango', 'papaya', 'pineapple',
  'cashew', 'peanut',
  'fish', 'shrimp', 'prawn', 'crab', 'squid', 'tuna',
  'chicken', 'beef', 'lamb', 'pork',
  'onion', 'garlic', 'ginger', 'tomato',
  'eggplant', 'okra', 'spinach', 'cabbage',
  'jaggery', 'palm sugar', 'treacle',
  'ghee', 'butter', 'yogurt',
  'black pepper', 'white pepper',
  'star anise', 'bay leaf',
  'dried shrimp', 'anchovy', 'dried fish',
  'bean sprout', 'sweet potato'
], 'Sri Lankan');

// --- MALAYSIAN ---
batchAssign([
  'coconut milk', 'coconut cream', 'coconut oil', 'coconut',
  'lemongrass', 'galangal', 'ginger', 'turmeric',
  'shallot', 'garlic', 'onion', 'scallion',
  'fish sauce', 'soy sauce', 'oyster sauce', 'shrimp paste',
  'tamarind', 'palm sugar', 'brown sugar',
  'lime', 'lime juice', 'pandan',
  'coriander', 'cumin', 'fennel seed', 'star anise',
  'cinnamon', 'clove', 'cardamom', 'nutmeg',
  'tofu', 'tempeh', 'bean sprout', 'bean curd',
  'noodle', 'rice noodle', 'egg noodle', 'vermicelli',
  'chicken', 'beef', 'lamb', 'shrimp', 'prawn', 'fish', 'squid',
  'egg', 'rice', 'rice flour',
  'sweet potato', 'taro', 'cassava',
  'banana', 'mango', 'papaya', 'pineapple', 'jackfruit',
  'peanut', 'cashew', 'sesame oil',
  'chili', 'chili paste', 'chili sauce',
  'curry powder', 'curry paste',
  'dried shrimp', 'anchovy',
  'ketchup', 'sambal',
  'eggplant', 'okra', 'cabbage', 'spinach',
  'mushroom', 'corn', 'cucumber',
  'black pepper', 'white pepper', 'salt',
  'oil', 'vegetable oil',
  'vinegar', 'rice vinegar',
  'sugar', 'honey', 'condensed milk',
  'bread', 'flatbread',
  'basil', 'mint', 'cilantro', 'curry leaf'
], 'Malaysian');

// --- INDONESIAN ---
batchAssign([
  'coconut milk', 'coconut cream', 'coconut oil', 'coconut',
  'lemongrass', 'galangal', 'ginger', 'turmeric',
  'shallot', 'garlic', 'onion', 'scallion',
  'soy sauce', 'sweet soy sauce', 'shrimp paste',
  'tamarind', 'palm sugar', 'brown sugar',
  'lime', 'lime juice',
  'coriander', 'cumin', 'fennel seed',
  'nutmeg', 'clove', 'cinnamon', 'cardamom', 'star anise',
  'tempeh', 'tofu', 'bean sprout', 'bean curd',
  'noodle', 'rice noodle', 'egg noodle', 'vermicelli',
  'chicken', 'beef', 'lamb', 'shrimp', 'prawn', 'fish', 'squid',
  'egg', 'rice', 'rice flour',
  'sweet potato', 'taro', 'cassava', 'yam',
  'banana', 'mango', 'papaya', 'pineapple', 'jackfruit',
  'peanut', 'peanut butter', 'cashew',
  'chili', 'chili paste', 'chili sauce', 'chili powder',
  'dried shrimp', 'anchovy',
  'eggplant', 'okra', 'cabbage', 'spinach',
  'mushroom', 'corn', 'cucumber',
  'black pepper', 'white pepper', 'salt',
  'oil', 'vegetable oil',
  'vinegar', 'rice vinegar',
  'sugar', 'honey', 'condensed milk',
  'vanilla', 'cocoa', 'coffee',
  'avocado', 'papaya', 'starfruit',
  'basil', 'mint', 'cilantro', 'bay leaf', 'pandan',
  'curry powder',
  'bread', 'flour', 'cornstarch', 'tapioca',
  'sambal', 'ketchup'
], 'Indonesian');

// --- FILIPINO ---
batchAssign([
  'coconut milk', 'coconut cream', 'coconut oil', 'coconut',
  'vinegar', 'soy sauce', 'fish sauce', 'oyster sauce',
  'garlic', 'onion', 'ginger', 'shallot', 'scallion',
  'bay leaf', 'peppercorn', 'black pepper',
  'pork', 'pork belly', 'pork chop', 'pork loin',
  'chicken', 'beef', 'shrimp', 'prawn', 'fish', 'squid', 'crab',
  'egg', 'rice', 'rice flour', 'noodle',
  'banana', 'mango', 'papaya', 'pineapple', 'calamansi',
  'annatto seed', 'achiote paste', 'achiote powder',
  'tamarind', 'lime', 'lemon',
  'sugar', 'brown sugar', 'condensed milk', 'evaporated milk',
  'tomato', 'tomato paste', 'tomato sauce',
  'bell pepper', 'chili', 'jalapen',
  'cabbage', 'spinach', 'kale', 'lettuce',
  'eggplant', 'okra', 'squash', 'pumpkin',
  'sweet potato', 'potato', 'taro', 'cassava', 'yam',
  'peanut', 'cashew',
  'liver', 'tripe', 'intestine',
  'bread crumb', 'panko',
  'macaroni', 'spaghetti', 'pasta',
  'cheese', 'cream cheese', 'cheddar',
  'sausage', 'ham', 'bacon', 'corned beef', 'spam',
  'flour', 'cornstarch', 'bread',
  'oil', 'vegetable oil', 'butter', 'lard',
  'salt', 'pepper', 'sugar',
  'ketchup', 'mustard', 'mayonnaise',
  'worcestershire sauce', 'tabasco sauce',
  'rum', 'beer', 'wine', 'brandy',
  'vanilla', 'chocolate', 'cocoa',
  'baking powder', 'baking soda', 'yeast',
  'milk', 'cream', 'yogurt',
  'corn', 'green bean', 'bitter melon', 'bitter gourd',
  'mushroom', 'bean sprout',
  'sesame oil', 'sesame seed',
  'chili flake', 'chili powder',
  'cilantro', 'parsley', 'mint', 'basil',
  'stock', 'broth', 'bouillon',
  'gelatin', 'cornstarch',
  'cucumber', 'radish', 'carrot', 'celery'
], 'Filipino');

// --- ETHIOPIAN ---
batchAssign([
  'onion', 'garlic', 'ginger', 'turmeric',
  'fenugreek', 'cumin', 'coriander', 'cardamom',
  'cinnamon', 'clove', 'allspice', 'nutmeg',
  'black pepper', 'white pepper', 'cayenne', 'paprika',
  'chili powder', 'red pepper',
  'butter', 'ghee', 'clarified butter',
  'lentil', 'split pea', 'chickpea', 'bean',
  'collard green', 'kale', 'spinach', 'cabbage',
  'potato', 'carrot', 'tomato', 'tomato paste',
  'egg', 'chicken', 'beef', 'lamb', 'goat',
  'honey', 'sugar', 'molasses',
  'barley', 'wheat', 'millet', 'sorghum',
  'flax', 'flaxseed', 'linseed', 'sesame', 'sesame seed',
  'sunflower seed', 'peanut',
  'coffee', 'tea',
  'lemon', 'lime', 'banana', 'mango',
  'salt', 'oil', 'vegetable oil', 'sunflower oil',
  'rice', 'flour', 'bread',
  'oregano', 'thyme', 'basil', 'rosemary', 'bay leaf',
  'vinegar', 'lemon juice', 'lime juice',
  'green pepper', 'bell pepper', 'hot pepper',
  'okra', 'eggplant', 'squash', 'pumpkin', 'sweet potato',
  'mushroom', 'corn', 'green bean', 'pea',
  'wine', 'beer',
  'beet', 'beetroot', 'turnip',
  'cucumber', 'lettuce', 'radish',
  'walnut', 'almond', 'cashew',
  'raisin', 'date', 'fig', 'apricot',
  'olive oil', 'olive',
  'yogurt', 'cottage cheese', 'cream', 'milk',
  'liver', 'kidney',
  'noodle', 'pasta',
  'stock', 'broth', 'bouillon',
  'soy sauce', 'worcestershire sauce',
  'ketchup', 'mustard', 'mayonnaise',
  'vanilla', 'chocolate', 'cocoa',
  'baking powder', 'baking soda',
  'condensed milk', 'evaporated milk',
  'cornstarch', 'gelatin',
  'water', 'juice'
], 'Ethiopian');

// --- WEST AFRICAN ---
batchAssign([
  'palm oil', 'vegetable oil', 'oil', 'peanut oil',
  'onion', 'garlic', 'ginger', 'tomato', 'tomato paste',
  'chili', 'chili powder', 'cayenne', 'paprika', 'habanero',
  'scotch bonnet', 'hot pepper', 'red pepper',
  'thyme', 'bay leaf', 'parsley', 'cilantro', 'basil',
  'curry powder', 'turmeric', 'cumin', 'coriander',
  'nutmeg', 'allspice', 'clove', 'cinnamon',
  'plantain', 'yam', 'cassava', 'taro', 'sweet potato', 'potato',
  'okra', 'eggplant', 'spinach', 'kale', 'cabbage',
  'peanut', 'peanut butter', 'groundnut',
  'rice', 'corn', 'millet', 'sorghum', 'flour', 'bread',
  'chicken', 'beef', 'lamb', 'goat', 'fish', 'shrimp', 'prawn',
  'dried fish', 'smoked fish', 'dried shrimp',
  'tripe', 'liver', 'kidney',
  'egg', 'milk', 'butter', 'cream', 'yogurt',
  'bean', 'kidney bean', 'black bean', 'cowpea', 'black-eyed pea',
  'lentil', 'chickpea',
  'coconut', 'coconut milk',
  'banana', 'mango', 'papaya', 'pineapple', 'avocado',
  'orange', 'lemon', 'lime',
  'sugar', 'honey', 'molasses',
  'salt', 'pepper', 'black pepper', 'white pepper',
  'vinegar', 'lemon juice', 'lime juice',
  'cornmeal', 'corn flour', 'cornstarch',
  'sesame', 'sesame seed', 'sesame oil',
  'bell pepper', 'green pepper',
  'carrot', 'celery', 'cucumber', 'lettuce', 'radish',
  'mushroom', 'corn', 'pea', 'green bean',
  'squash', 'pumpkin', 'zucchini',
  'raisin', 'date', 'tamarind',
  'sausage', 'ham',
  'tea', 'coffee',
  'stock', 'broth', 'bouillon',
  'ketchup', 'mustard', 'mayonnaise',
  'soy sauce', 'worcestershire sauce',
  'vanilla', 'chocolate', 'cocoa',
  'baking powder', 'baking soda',
  'condensed milk', 'evaporated milk',
  'cornstarch', 'gelatin',
  'pasta', 'macaroni', 'spaghetti',
  'water', 'wine', 'beer'
], 'West African');

// --- SOUTH AFRICAN ---
batchAssign([
  'onion', 'garlic', 'ginger', 'chili',
  'cumin', 'coriander', 'turmeric', 'curry powder', 'paprika',
  'cinnamon', 'nutmeg', 'allspice', 'clove', 'cardamom',
  'cayenne', 'chili powder', 'black pepper', 'white pepper',
  'salt', 'sugar', 'brown sugar', 'honey', 'molasses',
  'oil', 'vegetable oil', 'sunflower oil', 'olive oil',
  'butter', 'cream', 'milk', 'cheese', 'yogurt',
  'egg', 'sour cream', 'buttermilk', 'cream cheese', 'cottage cheese',
  'tomato', 'tomato paste', 'tomato sauce',
  'lamb', 'beef', 'chicken', 'pork', 'goat',
  'sausage', 'ham', 'bacon',
  'fish', 'shrimp', 'prawn', 'mussel', 'crab',
  'liver', 'kidney', 'tripe',
  'rice', 'bread', 'flour', 'wheat',
  'corn', 'cornmeal', 'corn flour', 'polenta',
  'potato', 'sweet potato', 'yam',
  'pumpkin', 'butternut squash', 'butternut',
  'bean', 'kidney bean', 'lentil', 'chickpea',
  'spinach', 'kale', 'cabbage', 'lettuce',
  'carrot', 'celery', 'cucumber', 'zucchini',
  'bell pepper', 'green bean', 'pea',
  'mushroom', 'cauliflower', 'broccoli',
  'eggplant', 'okra', 'squash',
  'avocado', 'banana', 'mango', 'pineapple', 'papaya', 'guava',
  'apple', 'pear', 'apricot', 'peach', 'grape',
  'orange', 'lemon', 'lime',
  'raisin', 'date', 'fig', 'prune',
  'almond', 'walnut', 'cashew', 'peanut', 'pistachio',
  'sesame', 'sesame seed',
  'vinegar', 'lemon juice', 'lime juice',
  'bay leaf', 'thyme', 'oregano', 'parsley', 'rosemary',
  'mint', 'basil', 'dill', 'sage', 'cilantro',
  'fennel', 'cardamom', 'saffron', 'tamarind',
  'coconut', 'coconut milk',
  'wine', 'red wine', 'white wine', 'brandy', 'beer',
  'tea', 'coffee',
  'worcestershire sauce', 'tabasco sauce', 'hot sauce',
  'ketchup', 'mustard', 'mayonnaise',
  'soy sauce',
  'vanilla', 'chocolate', 'cocoa',
  'baking powder', 'baking soda',
  'condensed milk', 'evaporated milk',
  'cornstarch', 'gelatin',
  'jam', 'jelly', 'marmalade',
  'pasta', 'macaroni', 'spaghetti',
  'stock', 'broth', 'bouillon',
  'peanut butter', 'chutney'
], 'South African');

// --- HUNGARIAN ---
batchAssign([
  'paprika', 'sweet paprika', 'smoked paprika', 'hot paprika',
  'sour cream', 'cream', 'butter', 'milk', 'cheese', 'yogurt',
  'egg', 'egg yolk', 'egg white',
  'onion', 'garlic', 'shallot',
  'tomato', 'tomato paste', 'bell pepper', 'green pepper',
  'potato', 'carrot', 'celery', 'turnip', 'parsnip',
  'cabbage', 'sauerkraut', 'red cabbage',
  'mushroom', 'porcini',
  'pork', 'pork chop', 'pork loin', 'pork shoulder', 'pork belly',
  'beef', 'chicken', 'duck', 'goose', 'turkey', 'veal', 'lamb',
  'sausage', 'ham', 'bacon', 'salami',
  'liver',
  'fish', 'carp', 'trout',
  'flour', 'bread', 'bread crumb',
  'egg noodle', 'noodle', 'dumpling', 'pasta',
  'rice', 'barley', 'oat',
  'dill', 'parsley', 'marjoram', 'caraway', 'bay leaf', 'thyme',
  'black pepper', 'white pepper', 'salt',
  'lard', 'vegetable oil', 'sunflower oil', 'oil',
  'sugar', 'honey', 'powdered sugar', 'brown sugar',
  'vinegar', 'lemon', 'lemon juice',
  'wine', 'red wine', 'white wine', 'beer',
  'vanilla', 'cinnamon', 'nutmeg', 'allspice', 'clove',
  'chocolate', 'cocoa',
  'apple', 'cherry', 'sour cherry', 'plum', 'apricot', 'pear',
  'strawberry', 'raspberry', 'blueberry', 'grape',
  'walnut', 'poppy seed', 'almond', 'hazelnut',
  'cottage cheese', 'cream cheese', 'sour cream',
  'baking powder', 'baking soda', 'yeast',
  'cornstarch', 'gelatin',
  'raisin', 'prune',
  'pea', 'bean', 'lentil', 'green bean',
  'spinach', 'kale', 'lettuce',
  'cucumber', 'radish', 'beet', 'beetroot',
  'corn', 'sweet potato',
  'squash', 'pumpkin', 'zucchini',
  'cauliflower', 'broccoli',
  'olive oil', 'olive',
  'lemon zest', 'orange',
  'leek', 'scallion',
  'condensed milk', 'evaporated milk',
  'stock', 'broth', 'bouillon',
  'water', 'tea', 'coffee',
  'ketchup', 'mustard', 'mayonnaise',
  'jam', 'jelly', 'marmalade',
  'sesame seed', 'sunflower seed',
  'horseradish', 'mustard seed'
], 'Hungarian');

// --- POLISH ---
batchAssign([
  'sauerkraut', 'cabbage', 'red cabbage',
  'beet', 'beetroot', 'horseradish',
  'rye', 'rye bread', 'pumpernickel',
  'poppy seed', 'caraway', 'dill', 'parsley', 'marjoram',
  'mushroom', 'dried mushroom',
  'pork', 'pork chop', 'pork loin', 'ham', 'bacon',
  'sausage', 'smoked sausage',
  'chicken', 'duck', 'goose', 'turkey', 'beef', 'veal', 'lamb',
  'herring', 'carp', 'trout', 'cod', 'salmon', 'fish',
  'potato', 'onion', 'garlic', 'carrot',
  'cucumber', 'pickle',
  'sour cream', 'cottage cheese', 'cream cheese',
  'butter', 'cream', 'milk', 'egg', 'cheese', 'yogurt',
  'flour', 'bread', 'bread crumb',
  'egg noodle', 'noodle', 'dumpling', 'pasta',
  'rice', 'barley', 'oat', 'buckwheat',
  'apple', 'plum', 'cherry', 'strawberry', 'raspberry', 'blueberry',
  'cranberry', 'pear', 'grape',
  'walnut', 'hazelnut', 'almond',
  'sugar', 'honey', 'salt', 'powdered sugar', 'brown sugar',
  'black pepper', 'white pepper', 'mustard',
  'bay leaf', 'allspice', 'juniper',
  'paprika', 'cayenne', 'nutmeg', 'cinnamon', 'clove',
  'vinegar', 'lemon', 'lemon juice',
  'oil', 'vegetable oil', 'sunflower oil', 'olive oil', 'lard',
  'vodka', 'beer', 'wine', 'red wine', 'white wine',
  'vanilla', 'chocolate', 'cocoa',
  'baking powder', 'baking soda', 'yeast',
  'cornstarch', 'gelatin',
  'tomato', 'tomato paste', 'tomato sauce',
  'pea', 'bean', 'lentil', 'green bean',
  'celery', 'leek', 'parsnip',
  'lettuce', 'spinach', 'kale',
  'bell pepper', 'green pepper',
  'squash', 'pumpkin', 'zucchini',
  'cauliflower', 'broccoli',
  'corn', 'sweet potato',
  'turnip', 'radish',
  'raisin', 'prune', 'date', 'fig',
  'condensed milk', 'evaporated milk',
  'stock', 'broth', 'bouillon',
  'water', 'tea', 'coffee',
  'ketchup', 'mustard', 'mayonnaise',
  'jam', 'jelly', 'marmalade',
  'sesame seed', 'sunflower seed',
  'thyme', 'oregano', 'rosemary', 'basil', 'sage',
  'cumin', 'coriander', 'fennel',
  'mushroom', 'avocado',
  'orange', 'lime',
  'ginger', 'tarragon',
  'eggplant', 'okra',
  'peanut', 'cashew', 'pistachio',
  'sesame oil',
  'soy sauce', 'worcestershire sauce',
  'hot sauce'
], 'Polish');

// --- PORTUGUESE ---
batchAssign([
  'olive oil', 'olive', 'garlic', 'onion', 'shallot',
  'tomato', 'tomato paste', 'tomato sauce',
  'bell pepper', 'red pepper', 'chili',
  'paprika', 'sweet paprika', 'smoked paprika',
  'bay leaf', 'parsley', 'cilantro', 'coriander', 'oregano', 'thyme', 'rosemary',
  'mint', 'basil', 'sage',
  'cumin', 'cinnamon', 'nutmeg', 'clove', 'allspice', 'saffron',
  'black pepper', 'white pepper', 'salt', 'sea salt',
  'lemon', 'lemon juice', 'orange', 'lime',
  'vinegar', 'red wine vinegar', 'white wine vinegar',
  'wine', 'red wine', 'white wine', 'port wine',
  'brandy', 'rum', 'beer',
  'cod', 'sardine', 'anchovy',
  'fish', 'shrimp', 'prawn', 'clam', 'mussel', 'crab', 'lobster',
  'octopus', 'squid', 'calamari',
  'chicken', 'pork', 'beef', 'lamb', 'goat', 'veal',
  'sausage', 'chorizo', 'ham', 'bacon',
  'liver', 'tripe',
  'egg', 'egg yolk',
  'cream', 'milk', 'butter', 'cheese', 'yogurt',
  'rice', 'bread', 'flour', 'cornmeal', 'corn bread',
  'potato', 'sweet potato',
  'bean', 'kidney bean', 'white bean', 'chickpea', 'lentil',
  'cabbage', 'kale', 'spinach', 'lettuce',
  'carrot', 'celery', 'turnip',
  'pea', 'green bean', 'fava bean', 'broad bean',
  'mushroom', 'corn',
  'eggplant', 'zucchini', 'squash', 'pumpkin',
  'cucumber', 'radish',
  'sugar', 'honey', 'molasses', 'powdered sugar', 'brown sugar',
  'almond', 'walnut', 'hazelnut', 'pistachio', 'chestnut', 'pine nut',
  'raisin', 'fig', 'date', 'prune',
  'apple', 'pear', 'orange', 'lemon',
  'strawberry', 'cherry', 'peach', 'apricot', 'grape',
  'banana', 'pineapple', 'mango', 'passion fruit',
  'coconut', 'coconut milk',
  'oil', 'vegetable oil',
  'cornstarch', 'baking powder', 'baking soda', 'yeast',
  'vanilla', 'chocolate', 'cocoa',
  'condensed milk', 'evaporated milk',
  'cream cheese', 'cottage cheese', 'sour cream',
  'pasta', 'macaroni', 'spaghetti',
  'stock', 'broth', 'bouillon',
  'water', 'tea', 'coffee',
  'ketchup', 'mustard', 'mayonnaise',
  'jam', 'jelly', 'marmalade',
  'gelatin',
  'sesame seed', 'peanut', 'cashew',
  'cauliflower', 'broccoli', 'avocado',
  'tamarind', 'ginger', 'turmeric', 'fennel',
  'leek', 'watercress',
  'noodle', 'vermicelli',
  'beet', 'beetroot',
  'dill', 'tarragon', 'chive',
  'oat', 'barley',
  'walnut', 'pecan',
  'lemon zest', 'orange zest'
], 'Portuguese');

// --- RUSSIAN ---
batchAssign([
  'beet', 'beetroot', 'sour cream', 'dill', 'parsley', 'chive', 'tarragon',
  'horseradish', 'mustard', 'pickle', 'sauerkraut',
  'rye', 'rye bread', 'buckwheat',
  'pork', 'beef', 'chicken', 'duck', 'goose', 'lamb', 'veal',
  'liver', 'tongue',
  'sausage', 'ham', 'bacon',
  'herring', 'salmon', 'smoked salmon', 'cod', 'trout', 'fish',
  'potato', 'onion', 'garlic', 'carrot', 'celery',
  'cabbage', 'red cabbage',
  'mushroom', 'dried mushroom',
  'tomato', 'cucumber', 'radish',
  'apple', 'pear', 'cherry', 'plum',
  'strawberry', 'raspberry', 'blueberry', 'cranberry',
  'walnut', 'hazelnut', 'almond', 'sunflower seed',
  'poppy seed',
  'cottage cheese', 'cream cheese',
  'butter', 'cream', 'milk', 'egg', 'cheese', 'yogurt',
  'flour', 'bread', 'bread crumb',
  'noodle', 'egg noodle', 'dumpling', 'pasta',
  'rice', 'barley', 'oat', 'semolina',
  'sugar', 'honey', 'salt', 'powdered sugar', 'brown sugar',
  'black pepper', 'white pepper', 'bay leaf',
  'allspice', 'caraway', 'coriander',
  'paprika', 'cayenne', 'nutmeg', 'cinnamon', 'clove',
  'vinegar', 'lemon', 'lemon juice',
  'oil', 'sunflower oil', 'vegetable oil', 'olive oil',
  'vodka', 'beer', 'wine', 'red wine', 'white wine',
  'vanilla', 'chocolate', 'cocoa',
  'tea', 'coffee',
  'condensed milk', 'evaporated milk',
  'baking powder', 'baking soda', 'yeast',
  'cornstarch', 'gelatin',
  'pea', 'bean', 'lentil', 'green bean', 'split pea',
  'spinach', 'kale', 'lettuce',
  'corn', 'rice',
  'turnip', 'parsnip', 'rutabaga',
  'bell pepper', 'green pepper',
  'eggplant', 'squash', 'pumpkin',
  'sweet potato', 'yam',
  'mayonnaise', 'ketchup',
  'jam', 'jelly', 'marmalade',
  'grape', 'orange', 'lime',
  'raisin', 'prune', 'date', 'fig', 'apricot',
  'pistachio', 'cashew', 'peanut',
  'sesame seed',
  'ginger', 'turmeric', 'cumin', 'fennel',
  'thyme', 'oregano', 'rosemary', 'basil', 'sage', 'marjoram',
  'soy sauce', 'worcestershire sauce',
  'stock', 'broth', 'bouillon',
  'ketchup', 'mustard', 'mayonnaise', 'hot sauce',
  'cauliflower', 'broccoli',
  'avocado', 'mango', 'banana', 'pineapple',
  'lard', 'margarine',
  'leek', 'scallion', 'shallot',
  'zucchini', 'cucumber',
  'water'
], 'Russian');

// --- SCANDINAVIAN ---
batchAssign([
  'dill', 'chive', 'parsley', 'thyme', 'juniper',
  'cardamom', 'cinnamon', 'nutmeg', 'allspice', 'clove',
  'caraway', 'fennel', 'anise',
  'herring', 'salmon', 'smoked salmon', 'cod', 'trout', 'mackerel',
  'shrimp', 'crab', 'lobster', 'mussel', 'fish',
  'pork', 'pork belly', 'pork chop', 'pork loin',
  'lamb', 'beef', 'veal', 'venison',
  'duck', 'goose', 'chicken', 'turkey',
  'sausage', 'ham', 'bacon',
  'liver',
  'potato', 'onion', 'garlic',
  'beet', 'beetroot', 'turnip', 'rutabaga', 'parsnip',
  'cabbage', 'red cabbage', 'kale',
  'carrot', 'celery', 'cucumber',
  'mushroom',
  'rye', 'rye bread',
  'oat', 'barley', 'buckwheat',
  'bread', 'flatbread',
  'butter', 'cream', 'milk', 'buttermilk',
  'sour cream', 'cottage cheese', 'cream cheese',
  'cheese', 'blue cheese',
  'egg', 'egg yolk',
  'sugar', 'honey', 'molasses', 'syrup',
  'cranberry', 'blueberry', 'raspberry', 'strawberry',
  'lingonberry',
  'apple', 'pear', 'plum', 'cherry', 'rhubarb',
  'lemon', 'lemon juice', 'orange',
  'almond', 'hazelnut', 'walnut',
  'poppy seed', 'sesame seed', 'sunflower seed',
  'mustard', 'horseradish',
  'pickle',
  'vinegar', 'white vinegar', 'apple cider vinegar',
  'salt', 'sea salt', 'pepper', 'black pepper', 'white pepper',
  'bay leaf',
  'flour', 'cornstarch',
  'vanilla', 'chocolate', 'cocoa', 'coffee',
  'oil', 'vegetable oil', 'canola oil', 'olive oil',
  'beer', 'wine', 'red wine', 'white wine',
  'gin', 'rum', 'vodka',
  'tomato', 'tomato paste',
  'pea', 'split pea', 'bean', 'lentil',
  'rice', 'pasta', 'noodle',
  'lettuce', 'spinach',
  'radish', 'leek', 'shallot', 'scallion',
  'bell pepper',
  'squash', 'pumpkin', 'zucchini',
  'corn',
  'jam', 'jelly', 'marmalade',
  'baking powder', 'baking soda', 'yeast',
  'powdered sugar', 'brown sugar',
  'gelatin',
  'condensed milk', 'evaporated milk',
  'saffron', 'ginger',
  'stock', 'broth', 'bouillon',
  'tea', 'water',
  'ketchup', 'mustard', 'mayonnaise',
  'paprika', 'cayenne', 'turmeric', 'cumin', 'coriander',
  'oregano', 'rosemary', 'basil', 'sage', 'tarragon', 'mint',
  'raisin', 'prune', 'date', 'fig', 'apricot',
  'pistachio', 'cashew', 'peanut',
  'avocado', 'mango', 'banana', 'pineapple',
  'grape', 'peach',
  'eggplant', 'sweet potato',
  'green bean', 'cauliflower', 'broccoli',
  'okra', 'mushroom',
  'lard', 'margarine',
  'soy sauce', 'worcestershire sauce', 'hot sauce',
  'sesame oil',
  'coconut',
  'lime'
], 'Scandinavian');

// --- ISRAELI ---
batchAssign([
  'tahini', 'chickpea', 'hummus',
  'olive', 'olive oil',
  'eggplant', 'tomato', 'cucumber', 'bell pepper',
  'parsley', 'cilantro', 'dill', 'mint', 'basil',
  'lemon', 'lemon juice', 'lime',
  'garlic', 'onion', 'shallot', 'scallion',
  'cumin', 'coriander', 'paprika', 'turmeric', 'cayenne',
  'cinnamon', 'cardamom', 'nutmeg', 'allspice',
  'sesame', 'sesame seed', 'sesame oil',
  'yogurt', 'feta', 'cream cheese', 'cottage cheese', 'sour cream',
  'egg', 'butter', 'cream', 'milk', 'cheese',
  'bread', 'pita', 'flatbread',
  'rice', 'couscous', 'bulgur',
  'chicken', 'lamb', 'beef', 'turkey', 'fish', 'veal',
  'shrimp',
  'date', 'fig', 'pomegranate', 'olive',
  'almond', 'walnut', 'pistachio', 'pine nut', 'cashew',
  'honey', 'sugar', 'molasses',
  'lentil', 'bean', 'fava bean', 'white bean',
  'spinach', 'kale', 'arugula', 'lettuce',
  'carrot', 'celery', 'beet', 'beetroot',
  'potato', 'sweet potato',
  'squash', 'pumpkin', 'zucchini',
  'cauliflower', 'broccoli', 'cabbage',
  'mushroom', 'corn', 'pea', 'green bean', 'okra',
  'flour', 'semolina', 'cornstarch',
  'vinegar', 'apple cider vinegar',
  'oil', 'vegetable oil', 'sunflower oil', 'canola oil',
  'salt', 'pepper', 'black pepper',
  'bay leaf', 'thyme', 'oregano', 'rosemary', 'sage',
  'fennel', 'fennel seed',
  'chili', 'hot sauce',
  'tomato paste', 'tomato sauce',
  'stock', 'broth', 'bouillon',
  'wine', 'beer',
  'vanilla', 'chocolate', 'cocoa',
  'apple', 'pear', 'orange', 'grape', 'cherry',
  'strawberry', 'raspberry', 'blueberry',
  'mango', 'banana', 'avocado',
  'watermelon', 'melon',
  'raisin', 'apricot', 'prune',
  'peanut', 'peanut butter',
  'soy sauce',
  'pasta', 'noodle',
  'tea', 'coffee',
  'baking powder', 'yeast',
  'gelatin',
  'jam', 'jelly',
  'ketchup', 'mayonnaise', 'mustard',
  'condensed milk',
  'powdered sugar', 'brown sugar',
  'ginger', 'tamarind',
  'poppy seed', 'nigella',
  'turnip', 'radish',
  'saffron', 'sumac',
  'rose water',
  'pomegranate molasses',
  'coconut',
  'water'
], 'Israeli');

// --- LEBANESE ---
batchAssign([
  'tahini', 'chickpea', 'hummus',
  'olive', 'olive oil',
  'eggplant', 'tomato', 'cucumber', 'bell pepper',
  'parsley', 'cilantro', 'dill', 'mint', 'basil',
  'lemon', 'lemon juice', 'lime',
  'garlic', 'onion', 'shallot', 'scallion',
  'cumin', 'coriander', 'paprika', 'turmeric', 'cayenne',
  'cinnamon', 'cardamom', 'nutmeg', 'allspice',
  'sesame', 'sesame seed', 'sesame oil',
  'yogurt', 'feta', 'cream cheese', 'cottage cheese', 'sour cream',
  'egg', 'butter', 'cream', 'milk', 'cheese',
  'bread', 'pita', 'flatbread',
  'rice', 'couscous', 'bulgur',
  'chicken', 'lamb', 'beef', 'turkey', 'fish', 'veal',
  'shrimp',
  'date', 'fig', 'pomegranate',
  'almond', 'walnut', 'pistachio', 'pine nut', 'cashew',
  'honey', 'sugar', 'molasses',
  'lentil', 'bean', 'fava bean', 'white bean', 'kidney bean',
  'spinach', 'kale', 'arugula', 'lettuce',
  'carrot', 'celery', 'beet', 'beetroot',
  'potato', 'sweet potato',
  'squash', 'pumpkin', 'zucchini',
  'cauliflower', 'broccoli', 'cabbage',
  'mushroom', 'corn', 'pea', 'green bean', 'okra',
  'flour', 'semolina', 'cornstarch',
  'vinegar', 'apple cider vinegar',
  'oil', 'vegetable oil', 'sunflower oil',
  'salt', 'pepper', 'black pepper', 'white pepper',
  'bay leaf', 'thyme', 'oregano', 'rosemary', 'sage',
  'fennel', 'fennel seed',
  'chili', 'hot sauce', 'chili flake',
  'tomato paste', 'tomato sauce',
  'stock', 'broth', 'bouillon',
  'wine', 'beer',
  'vanilla', 'chocolate', 'cocoa',
  'apple', 'pear', 'orange', 'grape', 'cherry',
  'strawberry', 'raspberry', 'blueberry',
  'mango', 'banana', 'avocado',
  'watermelon', 'melon',
  'raisin', 'apricot', 'prune',
  'peanut',
  'pasta', 'noodle', 'vermicelli',
  'tea', 'coffee',
  'baking powder', 'yeast',
  'gelatin',
  'jam', 'jelly',
  'ketchup', 'mayonnaise', 'mustard',
  'condensed milk',
  'powdered sugar', 'brown sugar',
  'ginger', 'tamarind',
  'poppy seed', 'nigella',
  'turnip', 'radish',
  'saffron', 'sumac',
  'rose water',
  'pomegranate molasses',
  'grape leaf',
  'coconut',
  'water',
  'fenugreek'
], 'Lebanese');

// --- PERSIAN ---
batchAssign([
  'saffron', 'rose water', 'pomegranate', 'pomegranate molasses',
  'turmeric', 'cinnamon', 'cardamom', 'cumin', 'coriander',
  'fenugreek', 'sumac',
  'walnut', 'pistachio', 'almond', 'pine nut',
  'rice', 'basmati rice', 'flatbread', 'bread',
  'lamb', 'chicken', 'beef', 'veal', 'fish', 'shrimp',
  'yogurt', 'cream', 'butter', 'milk', 'cheese', 'egg',
  'eggplant', 'tomato', 'cucumber',
  'parsley', 'cilantro', 'dill', 'mint', 'basil', 'tarragon', 'chive',
  'scallion', 'spring onion',
  'lemon', 'lime', 'orange',
  'cherry', 'sour cherry', 'date', 'fig', 'raisin', 'apricot', 'prune',
  'chickpea', 'lentil', 'kidney bean', 'fava bean', 'split pea', 'mung bean',
  'spinach', 'lettuce', 'kale',
  'onion', 'garlic', 'shallot',
  'tomato paste',
  'bell pepper', 'chili', 'hot pepper',
  'potato', 'carrot', 'celery', 'turnip',
  'squash', 'pumpkin', 'zucchini',
  'tea', 'coffee',
  'flour', 'cornstarch',
  'olive', 'olive oil',
  'oil', 'vegetable oil',
  'salt', 'pepper', 'black pepper', 'white pepper',
  'sugar', 'honey', 'molasses',
  'vinegar',
  'sesame', 'sesame seed',
  'pea', 'green bean',
  'mushroom', 'corn',
  'bay leaf', 'thyme', 'oregano',
  'nutmeg', 'allspice', 'clove',
  'fennel', 'fennel seed', 'anise',
  'nigella', 'poppy seed',
  'stock', 'broth', 'bouillon',
  'noodle', 'vermicelli', 'pasta',
  'cabbage', 'cauliflower', 'broccoli',
  'beet', 'beetroot', 'radish',
  'avocado', 'mango', 'banana', 'pineapple',
  'grape', 'apple', 'pear', 'peach', 'melon', 'watermelon',
  'strawberry', 'raspberry', 'blueberry',
  'vanilla', 'chocolate', 'cocoa',
  'baking powder', 'yeast',
  'gelatin',
  'condensed milk', 'evaporated milk',
  'cream cheese', 'cottage cheese', 'sour cream',
  'jam', 'jelly',
  'wine',
  'water',
  'coconut',
  'ginger',
  'tamarind',
  'cashew', 'peanut', 'hazelnut',
  'leek',
  'okra', 'sweet potato',
  'barley', 'wheat', 'oat'
], 'Persian');

// --- TURKISH ---
batchAssign([
  'olive', 'olive oil',
  'eggplant', 'tomato', 'cucumber', 'bell pepper',
  'parsley', 'cilantro', 'dill', 'mint', 'basil',
  'lemon', 'lemon juice', 'lime',
  'garlic', 'onion', 'shallot', 'scallion',
  'cumin', 'coriander', 'paprika', 'turmeric', 'cayenne',
  'cinnamon', 'cardamom', 'nutmeg', 'allspice',
  'sesame', 'sesame seed', 'sesame oil', 'tahini',
  'yogurt', 'feta', 'cream cheese', 'cottage cheese', 'sour cream',
  'egg', 'butter', 'cream', 'milk', 'cheese',
  'bread', 'pita', 'flatbread',
  'rice', 'couscous', 'bulgur',
  'chicken', 'lamb', 'beef', 'turkey', 'fish', 'veal',
  'shrimp', 'mussel',
  'date', 'fig', 'pomegranate',
  'almond', 'walnut', 'pistachio', 'pine nut', 'cashew', 'hazelnut',
  'honey', 'sugar', 'molasses',
  'lentil', 'bean', 'fava bean', 'white bean', 'kidney bean', 'chickpea',
  'spinach', 'kale', 'arugula', 'lettuce',
  'carrot', 'celery', 'beet', 'beetroot',
  'potato', 'sweet potato',
  'squash', 'pumpkin', 'zucchini',
  'cauliflower', 'broccoli', 'cabbage',
  'mushroom', 'corn', 'pea', 'green bean', 'okra',
  'flour', 'semolina', 'cornstarch',
  'vinegar', 'apple cider vinegar',
  'oil', 'vegetable oil', 'sunflower oil',
  'salt', 'pepper', 'black pepper', 'white pepper',
  'bay leaf', 'thyme', 'oregano', 'rosemary', 'sage',
  'fennel', 'fennel seed',
  'chili', 'hot sauce', 'chili flake', 'red pepper',
  'tomato paste', 'tomato sauce',
  'stock', 'broth', 'bouillon',
  'wine', 'beer',
  'vanilla', 'chocolate', 'cocoa',
  'apple', 'pear', 'orange', 'grape', 'cherry',
  'strawberry', 'raspberry', 'blueberry',
  'mango', 'banana', 'avocado',
  'watermelon', 'melon',
  'raisin', 'apricot', 'prune',
  'peanut',
  'pasta', 'noodle', 'vermicelli',
  'tea', 'coffee',
  'baking powder', 'yeast',
  'gelatin',
  'jam', 'jelly',
  'ketchup', 'mayonnaise', 'mustard',
  'condensed milk',
  'powdered sugar', 'brown sugar',
  'ginger', 'tamarind',
  'poppy seed', 'nigella', 'sumac',
  'turnip', 'radish',
  'saffron',
  'rose water',
  'pomegranate molasses',
  'grape leaf',
  'coconut',
  'water',
  'fenugreek',
  'mastic',
  'leek', 'tarragon', 'chive'
], 'Turkish');

// --- AUSTRALIAN ---
batchAssign([
  'olive oil', 'olive', 'garlic', 'onion', 'shallot',
  'tomato', 'tomato paste', 'tomato sauce',
  'lemon', 'lemon juice', 'lime', 'lime juice', 'orange',
  'vinegar', 'balsamic vinegar',
  'salt', 'pepper', 'black pepper', 'white pepper', 'sea salt',
  'oil', 'vegetable oil', 'canola oil', 'sunflower oil',
  'butter', 'cream', 'milk', 'cheese', 'yogurt',
  'egg', 'egg yolk', 'egg white',
  'flour', 'bread', 'bread crumb',
  'rice', 'pasta', 'noodle', 'spaghetti', 'macaroni',
  'chicken', 'beef', 'lamb', 'pork', 'veal',
  'fish', 'salmon', 'tuna', 'cod',
  'shrimp', 'prawn', 'crab', 'lobster', 'mussel', 'oyster', 'scallop',
  'squid', 'octopus',
  'sausage', 'ham', 'bacon',
  'parsley', 'cilantro', 'basil', 'thyme', 'rosemary', 'oregano',
  'mint', 'dill', 'sage', 'tarragon', 'chive', 'bay leaf',
  'cumin', 'coriander', 'paprika', 'cayenne', 'chili',
  'turmeric', 'curry powder',
  'cinnamon', 'nutmeg', 'allspice', 'cardamom', 'clove',
  'ginger', 'lemongrass',
  'soy sauce', 'fish sauce', 'oyster sauce', 'worcestershire sauce',
  'coconut', 'coconut milk', 'coconut cream', 'coconut oil',
  'avocado', 'mango', 'banana', 'pineapple', 'passion fruit',
  'apple', 'pear', 'strawberry', 'raspberry', 'blueberry',
  'cherry', 'peach', 'apricot', 'grape', 'plum',
  'watermelon', 'melon', 'kiwi', 'fig', 'date',
  'lemon zest', 'orange zest',
  'potato', 'sweet potato',
  'carrot', 'celery', 'cucumber', 'lettuce',
  'cabbage', 'spinach', 'kale', 'arugula',
  'bell pepper', 'zucchini', 'eggplant',
  'mushroom', 'corn', 'pea', 'green bean', 'bean',
  'cauliflower', 'broccoli', 'asparagus',
  'squash', 'pumpkin', 'butternut',
  'beetroot', 'beet', 'radish', 'turnip',
  'leek', 'scallion', 'spring onion',
  'chickpea', 'lentil', 'kidney bean', 'white bean',
  'almond', 'walnut', 'hazelnut', 'macadamia', 'pistachio',
  'cashew', 'peanut', 'peanut butter',
  'sesame', 'sesame seed', 'sesame oil',
  'sugar', 'brown sugar', 'powdered sugar', 'honey', 'molasses', 'syrup',
  'vanilla', 'chocolate', 'cocoa',
  'cornstarch', 'baking powder', 'baking soda', 'yeast',
  'cream cheese', 'cottage cheese', 'sour cream',
  'condensed milk', 'evaporated milk',
  'stock', 'broth', 'bouillon',
  'wine', 'red wine', 'white wine', 'beer',
  'rum', 'brandy', 'vodka', 'gin', 'whiskey',
  'tea', 'coffee',
  'ketchup', 'mayonnaise', 'mustard', 'hot sauce',
  'tabasco sauce',
  'jam', 'jelly', 'marmalade',
  'gelatin',
  'fennel', 'fennel seed',
  'raisin', 'prune',
  'okra', 'tamarind', 'pomegranate', 'tahini',
  'saffron', 'poppy seed', 'semolina',
  'oat', 'barley',
  'pine nut', 'chestnut',
  'macadamia nut',
  'water'
], 'Australian');

// --- PACIFIC ISLANDER ---
batchAssign([
  'coconut', 'coconut milk', 'coconut cream', 'coconut oil', 'coconut water',
  'taro', 'yam', 'sweet potato', 'cassava',
  'plantain', 'banana', 'breadfruit',
  'pineapple', 'mango', 'papaya', 'guava', 'passion fruit',
  'lime', 'lime juice', 'lemon', 'lemon juice',
  'jackfruit',
  'fish', 'tuna', 'salmon',
  'shrimp', 'prawn', 'crab', 'lobster', 'clam', 'mussel', 'oyster',
  'squid', 'octopus',
  'chicken', 'pork', 'beef', 'lamb',
  'spam', 'corned beef', 'sausage', 'ham', 'bacon',
  'rice', 'noodle',
  'soy sauce', 'fish sauce', 'oyster sauce',
  'ginger', 'garlic', 'onion', 'scallion', 'spring onion',
  'chili', 'hot pepper',
  'salt', 'sea salt', 'pepper', 'black pepper',
  'sugar', 'brown sugar', 'palm sugar', 'molasses', 'honey',
  'oil', 'vegetable oil', 'canola oil',
  'butter', 'margarine',
  'egg', 'milk', 'cream',
  'flour', 'bread', 'bread crumb',
  'cornstarch', 'tapioca', 'arrowroot',
  'vanilla', 'vanilla extract',
  'condensed milk', 'evaporated milk',
  'tomato', 'tomato paste', 'tomato sauce',
  'ketchup', 'mustard', 'mayonnaise',
  'vinegar', 'rice vinegar',
  'sesame', 'sesame seed', 'sesame oil',
  'cucumber', 'lettuce', 'cabbage',
  'carrot', 'celery', 'corn',
  'bell pepper', 'green bean', 'pea',
  'spinach', 'watercress',
  'mushroom', 'bean sprout',
  'tofu', 'bean curd',
  'peanut', 'macadamia', 'cashew', 'almond',
  'chocolate', 'cocoa',
  'tea', 'coffee',
  'beer', 'rum', 'wine',
  'lemongrass', 'turmeric', 'cumin', 'coriander',
  'curry', 'curry powder',
  'basil', 'mint', 'cilantro', 'parsley', 'thyme',
  'bay leaf', 'cinnamon', 'nutmeg', 'clove',
  'star anise', 'cardamom',
  'tamarind',
  'avocado', 'eggplant', 'okra', 'squash', 'pumpkin',
  'potato',
  'chickpea', 'lentil', 'bean', 'kidney bean',
  'pasta', 'macaroni', 'spaghetti',
  'cheese', 'cream cheese',
  'yogurt', 'sour cream',
  'baking powder', 'baking soda', 'yeast',
  'jam', 'jelly',
  'raisin',
  'walnut', 'hazelnut', 'pistachio',
  'oat', 'barley',
  'paprika', 'cayenne',
  'worcestershire sauce', 'tabasco sauce', 'hot sauce',
  'stock', 'broth', 'bouillon',
  'gelatin',
  'powdered sugar',
  'apple', 'pear', 'orange',
  'strawberry', 'blueberry', 'raspberry',
  'peach', 'apricot', 'cherry', 'grape',
  'melon', 'watermelon',
  'date', 'fig',
  'fennel',
  'dill', 'chive',
  'leek',
  'water'
], 'Pacific Islander');

// --- CAJUN/CREOLE ---
batchAssign([
  'andouille sausage', 'sausage',
  'crawfish', 'shrimp', 'prawn', 'crab', 'oyster',
  'catfish', 'fish',
  'chicken', 'pork', 'beef', 'ham', 'bacon',
  'turkey', 'duck',
  'rice',
  'onion', 'garlic', 'celery', 'bell pepper', 'green pepper',
  'scallion', 'spring onion', 'leek', 'shallot',
  'tomato', 'tomato paste', 'tomato sauce',
  'okra', 'corn', 'sweet potato', 'potato',
  'kidney bean', 'black bean', 'white bean', 'bean',
  'lima bean', 'butter bean',
  'green bean', 'pea', 'black-eyed pea',
  'lettuce', 'spinach', 'cabbage', 'collard green', 'mustard green',
  'cayenne', 'paprika', 'chili powder', 'red pepper', 'hot sauce',
  'tabasco sauce', 'hot pepper',
  'black pepper', 'white pepper', 'salt',
  'thyme', 'oregano', 'basil', 'bay leaf', 'parsley', 'sage',
  'garlic powder', 'onion powder', 'celery salt',
  'cumin', 'coriander', 'mustard', 'mustard seed',
  'worcestershire sauce',
  'vinegar', 'apple cider vinegar', 'white vinegar',
  'oil', 'vegetable oil', 'canola oil', 'olive oil',
  'butter', 'lard',
  'flour', 'cornmeal', 'corn flour', 'cornstarch', 'corn bread',
  'bread', 'bread crumb',
  'sugar', 'brown sugar', 'powdered sugar', 'molasses', 'honey', 'syrup',
  'egg', 'milk', 'cream', 'buttermilk',
  'cheese', 'cream cheese', 'sour cream',
  'stock', 'broth', 'bouillon', 'chicken stock', 'beef stock',
  'lemon', 'lemon juice', 'lime', 'lime juice', 'orange',
  'pecan', 'peanut', 'peanut butter', 'walnut', 'almond',
  'raisin',
  'mushroom', 'carrot', 'turnip', 'radish',
  'eggplant', 'squash', 'pumpkin', 'zucchini',
  'cucumber',
  'beet', 'beetroot',
  'banana', 'strawberry', 'blueberry', 'blackberry', 'peach',
  'apple', 'pear', 'fig', 'watermelon',
  'coconut', 'pineapple', 'mango',
  'rum', 'bourbon', 'whiskey', 'beer', 'wine',
  'brandy', 'gin', 'vodka',
  'tea', 'coffee',
  'vanilla', 'cinnamon', 'nutmeg', 'allspice', 'clove',
  'ginger',
  'ketchup', 'mayonnaise', 'mustard',
  'pasta', 'spaghetti', 'macaroni', 'noodle',
  'baking powder', 'baking soda', 'yeast',
  'condensed milk', 'evaporated milk',
  'chocolate', 'cocoa',
  'gelatin',
  'jam', 'jelly',
  'sesame', 'sesame seed',
  'soy sauce',
  'tamarind',
  'fennel', 'dill', 'chive', 'rosemary', 'mint',
  'avocado',
  'chickpea', 'lentil',
  'cauliflower', 'broccoli',
  'smoked paprika',
  'water'
], 'Cajun/Creole');

// --- SOUTHERN US ---
batchAssign([
  'sausage', 'andouille sausage',
  'crawfish', 'shrimp', 'prawn', 'crab', 'oyster', 'catfish', 'fish',
  'chicken', 'pork', 'beef', 'ham', 'bacon', 'turkey', 'duck',
  'rice', 'corn', 'cornmeal', 'corn bread', 'corn flour',
  'onion', 'garlic', 'celery', 'bell pepper', 'green pepper',
  'scallion', 'spring onion', 'leek', 'shallot',
  'tomato', 'tomato paste', 'tomato sauce',
  'okra', 'sweet potato', 'potato',
  'kidney bean', 'black bean', 'white bean', 'bean',
  'lima bean', 'butter bean', 'black-eyed pea',
  'green bean', 'pea',
  'lettuce', 'spinach', 'cabbage', 'collard green', 'mustard green', 'kale',
  'cayenne', 'paprika', 'chili powder', 'red pepper', 'hot sauce',
  'tabasco sauce', 'hot pepper',
  'black pepper', 'white pepper', 'salt',
  'thyme', 'oregano', 'basil', 'bay leaf', 'parsley', 'sage', 'rosemary',
  'garlic powder', 'onion powder', 'celery salt',
  'cumin', 'coriander', 'mustard', 'mustard seed',
  'worcestershire sauce',
  'vinegar', 'apple cider vinegar', 'white vinegar',
  'oil', 'vegetable oil', 'canola oil', 'olive oil',
  'butter', 'lard', 'margarine',
  'flour', 'cornstarch',
  'bread', 'bread crumb',
  'sugar', 'brown sugar', 'powdered sugar', 'molasses', 'honey', 'syrup',
  'egg', 'milk', 'cream', 'buttermilk',
  'cheese', 'cream cheese', 'sour cream', 'cottage cheese',
  'stock', 'broth', 'bouillon', 'chicken stock', 'beef stock',
  'lemon', 'lemon juice', 'lime', 'lime juice', 'orange',
  'pecan', 'peanut', 'peanut butter', 'walnut', 'almond',
  'raisin', 'date',
  'mushroom', 'carrot', 'turnip', 'radish',
  'eggplant', 'squash', 'pumpkin', 'zucchini',
  'cucumber', 'beet', 'beetroot',
  'banana', 'strawberry', 'blueberry', 'blackberry', 'peach',
  'apple', 'pear', 'fig', 'watermelon', 'grape',
  'coconut', 'pineapple', 'mango',
  'rum', 'bourbon', 'whiskey', 'beer', 'wine',
  'brandy', 'vodka',
  'tea', 'coffee',
  'vanilla', 'cinnamon', 'nutmeg', 'allspice', 'clove',
  'ginger',
  'ketchup', 'mayonnaise', 'mustard',
  'pasta', 'spaghetti', 'macaroni', 'noodle',
  'baking powder', 'baking soda', 'yeast',
  'condensed milk', 'evaporated milk',
  'chocolate', 'cocoa',
  'gelatin',
  'jam', 'jelly', 'marmalade',
  'sesame', 'sesame seed',
  'soy sauce',
  'fennel', 'dill', 'chive', 'mint',
  'avocado',
  'chickpea', 'lentil',
  'cauliflower', 'broccoli',
  'smoked paprika',
  'water',
  'tarragon'
], 'Southern US');

// --- TEX-MEX ---
batchAssign([
  'tortilla', 'corn tortilla', 'flour tortilla', 'taco shell',
  'cheese', 'cheddar', 'cream cheese', 'sour cream',
  'avocado',
  'hot sauce', 'taco sauce',
  'chili', 'chili powder', 'cayenne', 'paprika', 'smoked paprika',
  'cumin', 'coriander', 'oregano',
  'jalapeno', 'chipotle', 'habanero', 'serrano',
  'black bean', 'pinto bean', 'kidney bean', 'bean',
  'rice', 'spanish rice',
  'chicken', 'beef', 'pork', 'ground beef',
  'chorizo', 'sausage', 'bacon',
  'onion', 'garlic', 'scallion', 'shallot',
  'tomato', 'tomato paste', 'tomato sauce',
  'bell pepper', 'green pepper', 'red pepper',
  'corn', 'cornmeal', 'corn bread',
  'lettuce', 'cabbage', 'spinach',
  'cilantro', 'parsley', 'basil',
  'lime', 'lime juice', 'lemon', 'lemon juice',
  'salt', 'pepper', 'black pepper',
  'oil', 'vegetable oil', 'canola oil', 'olive oil',
  'butter', 'lard',
  'flour', 'cornstarch',
  'sugar', 'brown sugar', 'honey',
  'egg', 'milk', 'cream', 'buttermilk',
  'stock', 'broth', 'bouillon',
  'vinegar', 'apple cider vinegar',
  'worcestershire sauce',
  'mustard', 'ketchup', 'mayonnaise',
  'potato', 'sweet potato',
  'carrot', 'celery', 'cucumber',
  'mushroom', 'zucchini', 'squash',
  'pea', 'green bean',
  'peanut', 'pecan', 'almond', 'walnut',
  'chocolate', 'cocoa', 'vanilla', 'cinnamon',
  'coffee', 'beer', 'rum', 'tequila',
  'pineapple', 'mango', 'banana', 'strawberry',
  'apple', 'peach', 'watermelon',
  'raisin', 'coconut',
  'fish', 'shrimp', 'crab',
  'ham', 'turkey',
  'bread', 'bread crumb',
  'pasta', 'macaroni', 'spaghetti',
  'condensed milk',
  'baking powder', 'baking soda',
  'gelatin',
  'jam', 'jelly',
  'sesame', 'sesame seed',
  'soy sauce',
  'ginger', 'turmeric',
  'thyme', 'bay leaf', 'rosemary',
  'nutmeg', 'allspice', 'clove',
  'okra', 'eggplant',
  'cauliflower', 'broccoli',
  'chickpea', 'lentil',
  'oat',
  'achiote paste', 'achiote powder',
  'annatto seed',
  'chili flake',
  'water'
], 'Tex-Mex');

// --- PERUVIAN ---
batchAssign([
  'aji amarillo',
  'quinoa', 'amaranth flour',
  'potato', 'sweet potato',
  'lime', 'lime juice', 'lemon', 'lemon juice',
  'cilantro', 'parsley', 'oregano', 'basil',
  'cumin', 'garlic', 'onion',
  'fish', 'shrimp', 'crab', 'squid', 'octopus', 'mussel', 'clam',
  'chicken', 'beef', 'pork', 'lamb', 'duck',
  'rice', 'corn', 'bean', 'lima bean', 'fava bean',
  'avocado', 'tomato', 'bell pepper',
  'peanut', 'cashew', 'walnut',
  'condensed milk', 'evaporated milk',
  'cheese', 'cream cheese',
  'egg', 'milk', 'cream', 'butter',
  'oil', 'olive oil', 'vegetable oil',
  'vinegar', 'wine', 'beer',
  'sugar', 'honey', 'molasses',
  'chocolate', 'cocoa', 'vanilla', 'cinnamon',
  'salt', 'pepper', 'black pepper',
  'chili', 'chili paste', 'chili sauce', 'chili powder',
  'soy sauce', 'oyster sauce',
  'ginger', 'turmeric',
  'coconut', 'passion fruit', 'mango', 'pineapple', 'banana',
  'papaya', 'guava',
  'cassava', 'yam', 'taro', 'plantain',
  'lettuce', 'spinach', 'cabbage', 'kale',
  'carrot', 'celery', 'cucumber', 'radish',
  'mushroom', 'squash', 'pumpkin', 'zucchini',
  'eggplant', 'okra', 'green bean', 'pea',
  'cauliflower', 'broccoli',
  'chickpea', 'lentil', 'kidney bean', 'black bean',
  'almond', 'pistachio', 'sesame',
  'raisin', 'date', 'fig', 'prune',
  'apple', 'pear', 'orange', 'grape', 'cherry',
  'strawberry', 'raspberry', 'blueberry',
  'watermelon', 'melon',
  'flour', 'cornstarch', 'bread',
  'pasta', 'noodle',
  'sausage', 'ham', 'bacon',
  'stock', 'broth', 'bouillon',
  'ketchup', 'mayonnaise', 'mustard',
  'worcestershire sauce',
  'hot sauce', 'tabasco sauce',
  'baking powder', 'baking soda', 'yeast',
  'gelatin',
  'tea', 'coffee',
  'rum', 'brandy',
  'tamarind', 'annatto seed', 'achiote paste',
  'thyme', 'bay leaf', 'rosemary', 'sage', 'mint', 'dill',
  'fennel', 'cardamom',
  'nutmeg', 'allspice', 'clove',
  'paprika', 'cayenne',
  'leek', 'scallion', 'shallot',
  'turnip', 'beet', 'beetroot',
  'artichoke',
  'olive', 'olive oil',
  'anchovy', 'sardine', 'tuna',
  'liver',
  'oat', 'barley', 'wheat',
  'jam', 'jelly',
  'soy sauce',
  'sesame seed', 'sesame oil',
  'water',
  'yogurt', 'sour cream', 'cottage cheese',
  'cornmeal'
], 'Peruvian');

// --- BRAZILIAN ---
batchAssign([
  'palm oil', 'dende oil',
  'cassava', 'tapioca',
  'black bean', 'kidney bean', 'bean',
  'rice', 'corn', 'cornmeal',
  'coconut', 'coconut milk',
  'lime', 'lime juice', 'orange', 'passion fruit', 'guava', 'papaya', 'mango',
  'pineapple', 'banana', 'avocado',
  'chicken', 'beef', 'pork', 'sausage', 'chorizo',
  'fish', 'cod', 'shrimp', 'prawn', 'crab', 'mussel',
  'egg', 'milk', 'cream', 'cheese', 'butter',
  'condensed milk', 'cream cheese',
  'garlic', 'onion', 'scallion',
  'tomato', 'tomato paste', 'tomato sauce',
  'bell pepper', 'chili', 'hot pepper',
  'cilantro', 'parsley', 'bay leaf', 'oregano', 'basil', 'thyme',
  'cumin', 'coriander', 'paprika', 'cayenne',
  'salt', 'pepper', 'black pepper',
  'sugar', 'brown sugar', 'molasses',
  'oil', 'olive oil', 'vegetable oil',
  'vinegar',
  'flour', 'cornstarch',
  'chocolate', 'cocoa', 'vanilla', 'cinnamon',
  'coffee',
  'peanut', 'cashew',
  'chickpea', 'lentil',
  'potato', 'sweet potato', 'yam', 'plantain',
  'okra', 'pumpkin', 'squash', 'zucchini',
  'spinach', 'kale', 'cabbage', 'lettuce',
  'carrot', 'celery', 'cucumber',
  'mushroom', 'corn', 'pea', 'green bean',
  'eggplant', 'cauliflower', 'broccoli',
  'ham', 'bacon',
  'liver',
  'almond', 'walnut',
  'raisin', 'date', 'fig',
  'apple', 'pear', 'strawberry', 'grape',
  'watermelon', 'melon',
  'lemon', 'lemon juice',
  'nutmeg', 'allspice', 'clove', 'cardamom',
  'ginger', 'turmeric',
  'fennel', 'mint', 'dill', 'rosemary', 'sage',
  'sesame', 'sesame seed',
  'baking powder', 'baking soda', 'yeast',
  'gelatin',
  'stock', 'broth', 'bouillon',
  'pasta', 'spaghetti', 'macaroni', 'noodle',
  'soy sauce', 'worcestershire sauce',
  'ketchup', 'mayonnaise', 'mustard', 'hot sauce',
  'jam', 'jelly',
  'tea', 'beer', 'wine', 'rum', 'brandy',
  'water',
  'pistachio', 'hazelnut', 'pecan',
  'cherry', 'peach', 'apricot',
  'leek', 'scallion', 'shallot',
  'turnip', 'radish', 'beet', 'beetroot',
  'yogurt', 'sour cream',
  'tamarind',
  'annatto seed', 'achiote paste',
  'chili powder', 'chili flake', 'smoked paprika'
], 'Brazilian');

// --- ARGENTINE ---
batchAssign([
  'beef', 'steak', 'ground beef', 'veal', 'lamb',
  'chorizo', 'sausage',
  'chicken', 'pork',
  'mozzarella', 'parmesan', 'provolone',
  'olive', 'olive oil',
  'oregano', 'parsley', 'cilantro', 'basil', 'thyme', 'rosemary',
  'bay leaf',
  'cumin', 'paprika', 'chili', 'red pepper', 'chili flake',
  'garlic', 'onion', 'bell pepper',
  'tomato', 'tomato paste',
  'corn', 'squash', 'pumpkin',
  'potato', 'sweet potato',
  'rice', 'bread', 'flour',
  'egg', 'milk', 'cream', 'butter', 'cheese',
  'sugar', 'brown sugar', 'honey',
  'wine', 'red wine',
  'vinegar', 'lemon', 'lime', 'orange',
  'salt', 'pepper', 'black pepper',
  'oil', 'vegetable oil', 'sunflower oil',
  'lettuce', 'spinach', 'cabbage',
  'carrot', 'celery', 'cucumber',
  'apple', 'pear', 'peach', 'grape', 'strawberry', 'cherry',
  'banana', 'pineapple', 'mango',
  'walnut', 'almond', 'peanut',
  'vanilla', 'chocolate', 'cocoa', 'cinnamon',
  'condensed milk', 'evaporated milk',
  'cornstarch',
  'pasta', 'spaghetti', 'macaroni', 'noodle',
  'ham', 'bacon',
  'fish', 'shrimp',
  'bean', 'lentil', 'chickpea',
  'mushroom', 'eggplant', 'zucchini',
  'pea', 'green bean',
  'beet', 'radish',
  'coffee', 'tea', 'beer',
  'baking powder', 'yeast',
  'gelatin',
  'jam', 'marmalade',
  'ketchup', 'mayonnaise', 'mustard',
  'soy sauce',
  'sesame',
  'raisin', 'date', 'fig', 'prune',
  'oat', 'wheat',
  'coconut',
  'avocado',
  'cauliflower', 'broccoli',
  'asparagus', 'artichoke',
  'leek', 'scallion',
  'dill', 'mint', 'sage',
  'nutmeg', 'allspice', 'clove',
  'stock', 'broth', 'bouillon',
  'lemon juice', 'lime juice',
  'sour cream', 'cream cheese', 'cottage cheese',
  'yogurt',
  'coriander', 'turmeric', 'ginger',
  'hot sauce', 'worcestershire sauce',
  'water',
  'turnip',
  'kale', 'arugula',
  'watermelon', 'melon',
  'raspberry', 'blueberry', 'blackberry',
  'hazelnut', 'pistachio', 'cashew', 'pecan',
  'lemon zest', 'orange zest',
  'brandy', 'rum', 'vodka',
  'fennel', 'tarragon', 'chive',
  'poppy seed', 'sesame seed',
  'anchovy', 'sardine',
  'liver',
  'sausage',
  'smoked paprika', 'cayenne'
], 'Argentine');

// --- CARIBBEAN ---
batchAssign([
  'scotch bonnet', 'habanero',
  'allspice',
  'plantain', 'banana',
  'breadfruit',
  'cassava', 'yam', 'taro', 'sweet potato',
  'coconut', 'coconut milk', 'coconut cream', 'coconut water', 'coconut oil',
  'rum',
  'lime', 'lime juice', 'lemon', 'lemon juice',
  'mango', 'papaya', 'guava', 'passion fruit',
  'pineapple', 'tamarind',
  'thyme', 'oregano', 'parsley', 'cilantro', 'basil',
  'bay leaf', 'marjoram',
  'cumin', 'coriander', 'turmeric', 'curry', 'curry powder',
  'cinnamon', 'nutmeg', 'clove', 'ginger',
  'garlic', 'onion', 'scallion', 'spring onion', 'shallot',
  'tomato', 'tomato paste', 'tomato sauce',
  'bell pepper', 'hot pepper', 'chili',
  'rice', 'kidney bean', 'black bean',
  'bean', 'chickpea', 'lentil', 'pigeon pea',
  'chicken', 'pork', 'beef', 'goat', 'lamb',
  'fish', 'cod', 'snapper',
  'shrimp', 'crab', 'lobster',
  'sausage', 'ham', 'bacon',
  'egg', 'milk', 'cream', 'butter', 'cheese',
  'flour', 'cornmeal', 'corn flour', 'cornstarch',
  'bread', 'dumpling',
  'sugar', 'brown sugar', 'molasses', 'honey', 'syrup',
  'vanilla', 'chocolate', 'cocoa',
  'oil', 'vegetable oil', 'olive oil',
  'vinegar', 'apple cider vinegar',
  'salt', 'pepper', 'black pepper', 'white pepper',
  'soy sauce', 'worcestershire sauce', 'hot sauce',
  'ketchup', 'mustard', 'mayonnaise',
  'peanut', 'cashew', 'almond',
  'sesame', 'sesame seed',
  'okra', 'spinach', 'cabbage', 'lettuce',
  'carrot', 'celery', 'cucumber',
  'corn', 'pea', 'green bean',
  'eggplant', 'squash', 'pumpkin',
  'potato',
  'avocado', 'watermelon',
  'apple', 'orange', 'grape', 'strawberry',
  'condensed milk', 'evaporated milk',
  'stock', 'broth', 'bouillon',
  'beer', 'wine',
  'tea', 'coffee',
  'baking powder', 'baking soda',
  'gelatin',
  'jam', 'jelly',
  'raisin', 'date',
  'annatto seed', 'achiote paste',
  'angostura bitters',
  'mushroom', 'radish', 'turnip',
  'kale',
  'chili powder', 'cayenne', 'paprika',
  'beet',
  'fennel', 'cardamom',
  'rosemary', 'sage', 'mint', 'dill',
  'leek',
  'walnut', 'pistachio', 'hazelnut', 'pecan',
  'fig', 'prune', 'apricot',
  'cherry', 'peach', 'plum',
  'raspberry', 'blueberry', 'blackberry',
  'melon',
  'liver',
  'fish sauce',
  'ginger',
  'water'
], 'Caribbean');

// ============================================================
// NOW use startsWith to catch variants (e.g., "chicken breast", "beef stew")
// but ONLY for the specific cuisine groups that genuinely use these
// ============================================================

// Catch all chicken/beef/pork/lamb/fish/shrimp variants for all cuisines
// These are already done above via batchStartsWithMulti

// Catch egg variants (egg white, egg yolk, egg noodle, etc.)
// Already done above

// Catch all onion/garlic/tomato/potato/carrot variants for all
// Already done above

// Catch lemon/lime/orange variants
// Already done above

// Catch rice variants
// Already done above

// ============================================================
// ADDITIONAL: Catch spice blends and compound ingredients
// ============================================================

// Chili variants for all Latin American + African + Asian cuisines
const chiliCuisines = [
  'Pakistani', 'Sri Lankan', 'Malaysian', 'Indonesian', 'Filipino',
  'Ethiopian', 'West African', 'South African', 'Moroccan',
  'Israeli', 'Lebanese', 'Persian', 'Turkish',
  'Cajun/Creole', 'Southern US', 'Tex-Mex',
  'Peruvian', 'Brazilian', 'Argentine', 'Caribbean',
  'Pacific Islander', 'Australian',
  'Hungarian', 'Portuguese'
];
batchStartsWithMulti(['chili', 'chilli', 'jalapen', 'habanero', 'chipotle', 'serrano', 'cayenne'], chiliCuisines);

// Coconut variants for tropical cuisines
batchStartsWithMulti(['coconut'], tropicalCuisines);

// Almond/walnut/cashew/peanut variants
batchStartsWithMulti(['almond', 'walnut', 'cashew', 'peanut', 'pistachio'], allTargets);

// Sesame variants
batchStartsWithMulti(['sesame'], allTargets);

// Cinnamon/nutmeg/cardamom variants
batchStartsWithMulti(['cinnamon', 'nutmeg', 'cardamom'], allTargets);

// Curry variants for Asian + African cuisines
const curryCuisines = [
  'Pakistani', 'Sri Lankan', 'Malaysian', 'Indonesian', 'Filipino',
  'Ethiopian', 'West African', 'South African', 'Moroccan',
  'Israeli', 'Lebanese', 'Persian', 'Turkish',
  'Caribbean', 'Pacific Islander', 'Australian'
];
batchStartsWithMulti(['curry'], curryCuisines);

// Soy sauce variants for Asian cuisines
batchStartsWithMulti(['soy sauce', 'soy'], asianCuisines);

// Ginger variants
batchStartsWithMulti(['ginger'], allTargets);

// Paprika variants for European + Latin American
batchStartsWithMulti(['paprika'], [
  'Hungarian', 'Polish', 'Portuguese', 'Russian', 'Scandinavian',
  'Israeli', 'Lebanese', 'Turkish', 'Moroccan',
  'Cajun/Creole', 'Southern US', 'Tex-Mex',
  'Brazilian', 'Argentine', 'Peruvian',
  'Australian', 'South African', 'Ethiopian', 'West African',
  'Pakistani', 'Sri Lankan', 'Malaysian', 'Indonesian', 'Filipino',
  'Persian', 'Caribbean', 'Pacific Islander'
]);

// Olive/olive oil for Mediterranean + Latin American
batchStartsWithMulti(['olive'], [
  'Israeli', 'Lebanese', 'Persian', 'Turkish', 'Moroccan',
  'Portuguese', 'Australian',
  'Argentine', 'Brazilian', 'Peruvian',
  'South African'
]);

// Yogurt variants for South Asian + Middle Eastern
batchStartsWithMulti(['yogurt'], [
  'Pakistani', 'Sri Lankan', 'Israeli', 'Lebanese', 'Persian', 'Turkish',
  'Hungarian', 'Polish', 'Russian', 'Scandinavian',
  'Australian', 'South African', 'Ethiopian', 'Moroccan'
]);

// Honey variants
batchStartsWithMulti(['honey'], allTargets);

// Sugar variants
batchStartsWithMulti(['sugar'], allTargets);

// Vinegar variants
batchStartsWithMulti(['vinegar'], allTargets);

// Stock/broth/bouillon variants
batchStartsWithMulti(['stock', 'broth', 'bouillon'], allTargets);

// Cream variants for all (but not "cream of mushroom soup" etc. - well, startsWith is fine)
batchStartsWithMulti(['cream'], allTargets);

// Butter variants
batchStartsWithMulti(['butter'], allTargets);

// Sour cream variants
batchStartsWithMulti(['sour cream'], allTargets);

// Cheese variants
batchStartsWithMulti(['cheese'], allTargets);

// Milk variants
batchStartsWithMulti(['milk'], allTargets);

// Flour variants
batchStartsWithMulti(['flour'], allTargets);

// Bread variants
batchStartsWithMulti(['bread'], allTargets);

// Vanilla/chocolate/cocoa variants
batchStartsWithMulti(['vanilla', 'chocolate', 'cocoa'], allTargets);

// Baking variants
batchStartsWithMulti(['baking powder', 'baking soda', 'baking'], [
  'Pakistani', 'Sri Lankan', 'Malaysian', 'Indonesian', 'Filipino',
  'South African', 'Australian', 'Pacific Islander',
  'Cajun/Creole', 'Southern US', 'Tex-Mex',
  'Peruvian', 'Brazilian', 'Argentine', 'Caribbean',
  'Hungarian', 'Polish', 'Portuguese', 'Russian', 'Scandinavian'
]);

// ============================================================
// FINAL: Count and report
// ============================================================
const cuisineCounts = {};
for (const [ing, cuisines] of Object.entries(cuisineMap)) {
  for (const c of cuisines) {
    cuisineCounts[c] = (cuisineCounts[c] || 0) + 1;
  }
}

const sorted = Object.entries(cuisineCounts).sort((a, b) => a[1] - b[1]);
console.log('\n=== FINAL CUISINE COUNTS ===');
for (const [c, n] of sorted) {
  console.log(`${c}: ${n}`);
}

// Write the updated cuisine map
fs.writeFileSync(cuisineMapPath, JSON.stringify(cuisineMap, null, 2), 'utf8');
console.log('\nWrote updated cuisine_map.json');
