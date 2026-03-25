/**
 * Task 6: Expand sauce_augment.json with missing global ingredients and sauce recipes.
 * - Adds new ingredients (if not already present)
 * - Adds pairings for new ingredients (5-8 each, with reverse symmetry)
 * - Adds new sauce recipes (if not already present)
 * - Updates sauceIngredientNames
 */

const fs = require("fs");
const path = require("path");

const SAUCE_PATH = path.resolve(__dirname, "../../public/data/sauce_augment.json");

const data = JSON.parse(fs.readFileSync(SAUCE_PATH, "utf-8"));

const existingIngredientNames = new Set(data.ingredients.map((i) => i.name));
const existingSauceNames = new Set(data.sauces.map((s) => s.name.toLowerCase()));
const existingPairingKeys = new Set(
  data.pairings.map((p) => `${p.source}|${p.target}`)
);

let ingredientsAdded = 0;
let recipesAdded = 0;
let pairingsAdded = 0;

// --- New ingredients ---
const newIngredients = [
  { name: "gochujang", category: "Chili", taste: "spicy sweet", weight: "heavy", codexRole: "seasoning" },
  { name: "doenjang", category: "Other", taste: "salty umami", weight: "heavy", codexRole: "seasoning" },
  { name: "shito", category: "Chili", taste: "spicy umami", weight: "heavy", codexRole: "seasoning" },
  { name: "berbere", category: "Seasoning", taste: "spicy pungent", weight: "medium", codexRole: "seasoning" },
  { name: "palm oil", category: "Fat", taste: "sweet", weight: "heavy", codexRole: "base" },
  { name: "scotch bonnet", category: "Chili", taste: "spicy sweet", weight: "medium", codexRole: "chili" },
  { name: "aji amarillo", category: "Chili", taste: "spicy sweet", weight: "medium", codexRole: "chili" },
  { name: "toum", category: "Other", taste: "pungent", weight: "heavy", codexRole: "base" },
  { name: "sumac", category: "Seasoning", taste: "sour", weight: "light", codexRole: "acid" },
  { name: "pomegranate molasses", category: "Acid", taste: "sour sweet", weight: "heavy", codexRole: "acid" },
  { name: "preserved lemon", category: "Acid", taste: "salty sour", weight: "medium", codexRole: "acid" },
  { name: "palm sugar", category: "Other", taste: "sweet", weight: "medium", codexRole: "sweetener" },
  { name: "bonito flakes", category: "Other", taste: "umami", weight: "light", codexRole: "protein" },
  { name: "kombu", category: "Other", taste: "umami", weight: "light", codexRole: "protein" },
];

for (const ing of newIngredients) {
  if (!existingIngredientNames.has(ing.name)) {
    data.ingredients.push(ing);
    existingIngredientNames.add(ing.name);
    ingredientsAdded++;
  }
}

// --- Pairings for new ingredients ---
const newPairingsMap = {
  gochujang: [
    { target: "soy sauce", strength: 0.90 },
    { target: "sesame oil", strength: 0.88 },
    { target: "garlic", strength: 0.85 },
    { target: "sugar", strength: 0.78 },
    { target: "rice vinegar", strength: 0.75 },
    { target: "ginger", strength: 0.72 },
    { target: "scallion", strength: 0.68 },
  ],
  doenjang: [
    { target: "garlic", strength: 0.88 },
    { target: "scallion", strength: 0.85 },
    { target: "gochugaru", strength: 0.82 },
    { target: "sesame oil", strength: 0.80 },
    { target: "tofu", strength: 0.75 },
    { target: "onion", strength: 0.72 },
  ],
  shito: [
    { target: "palm oil", strength: 0.90 },
    { target: "scotch bonnet", strength: 0.88 },
    { target: "dried shrimp", strength: 0.85 },
    { target: "garlic", strength: 0.82 },
    { target: "ginger", strength: 0.80 },
    { target: "onion", strength: 0.78 },
    { target: "tomato paste", strength: 0.72 },
  ],
  berbere: [
    { target: "onion", strength: 0.88 },
    { target: "garlic", strength: 0.85 },
    { target: "ginger", strength: 0.82 },
    { target: "butter", strength: 0.80 },
    { target: "tomato paste", strength: 0.78 },
    { target: "fenugreek", strength: 0.75 },
    { target: "cardamom", strength: 0.70 },
  ],
  "palm oil": [
    { target: "onion", strength: 0.85 },
    { target: "scotch bonnet", strength: 0.82 },
    { target: "garlic", strength: 0.80 },
    { target: "ginger", strength: 0.78 },
    { target: "tomato", strength: 0.75 },
    { target: "dried shrimp", strength: 0.72 },
  ],
  "scotch bonnet": [
    { target: "garlic", strength: 0.85 },
    { target: "onion", strength: 0.82 },
    { target: "ginger", strength: 0.80 },
    { target: "lime juice", strength: 0.78 },
    { target: "thyme", strength: 0.75 },
    { target: "tomato", strength: 0.70 },
  ],
  "aji amarillo": [
    { target: "garlic", strength: 0.85 },
    { target: "lime juice", strength: 0.82 },
    { target: "onion", strength: 0.78 },
    { target: "cilantro", strength: 0.75 },
    { target: "cumin", strength: 0.72 },
    { target: "mayonnaise", strength: 0.68 },
  ],
  toum: [
    { target: "garlic", strength: 0.90 },
    { target: "lemon juice", strength: 0.88 },
    { target: "vegetable oil", strength: 0.85 },
    { target: "salt", strength: 0.80 },
    { target: "olive oil", strength: 0.75 },
    { target: "mint", strength: 0.68 },
  ],
  sumac: [
    { target: "olive oil", strength: 0.85 },
    { target: "onion", strength: 0.82 },
    { target: "parsley", strength: 0.80 },
    { target: "lemon juice", strength: 0.78 },
    { target: "garlic", strength: 0.75 },
    { target: "yogurt", strength: 0.70 },
    { target: "pomegranate molasses", strength: 0.68 },
  ],
  "pomegranate molasses": [
    { target: "olive oil", strength: 0.85 },
    { target: "garlic", strength: 0.82 },
    { target: "lemon juice", strength: 0.78 },
    { target: "sumac", strength: 0.75 },
    { target: "onion", strength: 0.72 },
    { target: "honey", strength: 0.70 },
    { target: "tahini", strength: 0.68 },
  ],
  "preserved lemon": [
    { target: "olive oil", strength: 0.88 },
    { target: "garlic", strength: 0.85 },
    { target: "cilantro", strength: 0.82 },
    { target: "cumin", strength: 0.78 },
    { target: "onion", strength: 0.75 },
    { target: "parsley", strength: 0.72 },
  ],
  "palm sugar": [
    { target: "fish sauce", strength: 0.88 },
    { target: "lime juice", strength: 0.85 },
    { target: "garlic", strength: 0.80 },
    { target: "thai chili", strength: 0.78 },
    { target: "tamarind", strength: 0.75 },
    { target: "coconut milk", strength: 0.72 },
  ],
  "bonito flakes": [
    { target: "kombu", strength: 0.90 },
    { target: "soy sauce", strength: 0.88 },
    { target: "mirin", strength: 0.85 },
    { target: "sake", strength: 0.80 },
    { target: "rice vinegar", strength: 0.75 },
    { target: "water", strength: 0.72 },
  ],
  kombu: [
    { target: "bonito flakes", strength: 0.90 },
    { target: "soy sauce", strength: 0.85 },
    { target: "mirin", strength: 0.82 },
    { target: "sake", strength: 0.78 },
    { target: "water", strength: 0.75 },
    { target: "rice vinegar", strength: 0.70 },
    { target: "miso", strength: 0.68 },
  ],
};

function addPairing(source, target, strength) {
  const fwd = `${source}|${target}`;
  const rev = `${target}|${source}`;
  if (!existingPairingKeys.has(fwd)) {
    data.pairings.push({ source, target, strength });
    existingPairingKeys.add(fwd);
    pairingsAdded++;
  }
  if (!existingPairingKeys.has(rev)) {
    data.pairings.push({ source: target, target: source, strength });
    existingPairingKeys.add(rev);
    pairingsAdded++;
  }
}

for (const [source, targets] of Object.entries(newPairingsMap)) {
  for (const { target, strength } of targets) {
    addPairing(source, target, strength);
  }
}

// --- New sauce recipes ---
// Ingredients use {name, measure} object format to match existing structure.
function parseMeasuredIngredient(str) {
  // e.g. "2 tbsp gochujang" -> { name: "gochujang", measure: "2 tbsp" }
  const match = str.match(/^([\d\/]+\s+(?:tbsp|tsp|cup|cups|piece|pieces|clove|cloves|oz)\s+)(.+)$/i);
  if (match) {
    return { name: match[2].toLowerCase().trim(), measure: match[1].trim() };
  }
  // e.g. "1 onion", "salt", "4 scotch bonnet", "4 aji amarillo"
  const match2 = str.match(/^([\d\/]+)\s+(.+)$/);
  if (match2) {
    return { name: match2[2].toLowerCase().trim(), measure: match2[1] };
  }
  return { name: str.toLowerCase().trim(), measure: "to taste" };
}

const newSauces = [
  {
    name: "Gochujang Sauce",
    motherSauce: "Independent",
    cuisine: "Korean",
    rawIngredients: ["2 tbsp gochujang", "1 tbsp soy sauce", "1 tbsp sesame oil", "1 tsp sugar", "1 clove garlic"],
    instructions: "Mince garlic finely. Combine gochujang, soy sauce, sesame oil, and sugar in a bowl. Stir in garlic and mix until smooth and well blended.",
    pairsWith: ["bibimbap", "grilled meat", "fried chicken"],
  },
  {
    name: "Berbere Sauce",
    motherSauce: "Independent",
    cuisine: "Ethiopian",
    rawIngredients: ["2 tbsp berbere", "2 tbsp butter", "1 onion", "2 cloves garlic", "1 tbsp tomato paste"],
    instructions: "Dice onion and saute in butter until soft. Add minced garlic and cook one minute. Stir in berbere and tomato paste, cook 5 minutes until fragrant and darkened.",
    pairsWith: ["injera", "lentils", "chicken"],
  },
  {
    name: "Shito",
    motherSauce: "Independent",
    cuisine: "Ghanaian",
    rawIngredients: ["1 cup palm oil", "4 scotch bonnet", "2 onions", "1 cup dried shrimp", "3 cloves garlic", "1 tbsp ginger"],
    instructions: "Blend scotch bonnets, onions, garlic, and ginger into a paste. Heat palm oil and fry the paste on medium heat for 20 minutes. Add ground dried shrimp and cook another 15 minutes, stirring frequently, until oil separates.",
    pairsWith: ["rice", "grilled fish", "yam"],
  },
  {
    name: "Aji Sauce",
    motherSauce: "Salsa",
    cuisine: "Peruvian",
    rawIngredients: ["4 aji amarillo", "1 cup mayonnaise", "2 tbsp lime juice", "1 clove garlic", "salt"],
    instructions: "Deseed aji amarillo peppers and blend with garlic and lime juice until smooth. Fold into mayonnaise and season with salt. Chill before serving.",
    pairsWith: ["grilled chicken", "potatoes", "empanadas"],
  },
  {
    name: "Ponzu",
    motherSauce: "Independent",
    cuisine: "Japanese",
    rawIngredients: ["1/4 cup soy sauce", "2 tbsp rice vinegar", "2 tbsp lemon juice", "1 tbsp mirin", "1 piece kombu"],
    instructions: "Combine soy sauce, rice vinegar, lemon juice, and mirin. Add kombu and let steep for at least 2 hours or overnight. Remove kombu before serving.",
    pairsWith: ["sashimi", "gyoza", "grilled fish"],
  },
  {
    name: "Nuoc Cham",
    motherSauce: "Independent",
    cuisine: "Vietnamese",
    rawIngredients: ["3 tbsp fish sauce", "2 tbsp lime juice", "2 tbsp sugar", "1 clove garlic", "1 thai chili", "2 tbsp water"],
    instructions: "Dissolve sugar in warm water. Add fish sauce and lime juice. Mince garlic and thinly slice thai chili, stir in. Let sit 10 minutes for flavors to meld.",
    pairsWith: ["spring rolls", "grilled pork", "noodles"],
  },
  {
    name: "Toum",
    motherSauce: "Independent",
    cuisine: "Lebanese",
    rawIngredients: ["1 cup garlic", "1 cup vegetable oil", "3 tbsp lemon juice", "1 tsp salt"],
    instructions: "Pulse garlic and salt in a food processor until finely minced. With motor running, very slowly drizzle in oil alternating with lemon juice until emulsified into a thick, fluffy white sauce.",
    pairsWith: ["shawarma", "grilled chicken", "falafel"],
  },
  {
    name: "Zhug",
    motherSauce: "Salsa",
    cuisine: "Yemeni",
    rawIngredients: ["1 cup cilantro", "4 green chili", "4 cloves garlic", "1 tsp cumin", "1/4 cup olive oil", "2 tbsp lemon juice"],
    instructions: "Combine cilantro, green chilies, garlic, and cumin in a food processor. Pulse until coarsely chopped. Drizzle in olive oil and lemon juice, blend until a rough paste forms.",
    pairsWith: ["falafel", "grilled lamb", "pita"],
  },
  {
    name: "Romesco",
    motherSauce: "Nut Sauce",
    cuisine: "Spanish",
    rawIngredients: ["4 roasted red pepper", "1/2 cup almonds", "2 cloves garlic", "2 tbsp olive oil", "1 tbsp sherry vinegar", "1 tsp smoked paprika"],
    instructions: "Toast almonds until golden. Blend roasted red peppers, almonds, garlic, and smoked paprika. Drizzle in olive oil and sherry vinegar, process until thick but slightly chunky.",
    pairsWith: ["grilled vegetables", "fish", "bread"],
  },
  {
    name: "Beurre Blanc",
    motherSauce: "Hollandaise",
    cuisine: "French",
    rawIngredients: ["1/2 cup white wine", "2 tbsp shallot", "1 cup cold butter", "1 tbsp lemon juice", "salt"],
    instructions: "Mince shallot and simmer with white wine until reduced to 2 tablespoons. Over low heat, whisk in cold butter one tablespoon at a time until emulsified. Finish with lemon juice and salt.",
    pairsWith: ["fish", "scallops", "vegetables"],
  },
  {
    name: "Beurre Noisette",
    motherSauce: "Independent",
    cuisine: "French",
    rawIngredients: ["1/2 cup butter", "1 tbsp lemon juice", "1 tbsp capers", "1 tbsp parsley"],
    instructions: "Melt butter over medium heat and cook, swirling occasionally, until milk solids turn golden brown and it smells nutty. Remove from heat immediately, add lemon juice, capers, and chopped parsley.",
    pairsWith: ["fish", "ravioli", "vegetables"],
  },
  {
    name: "Gastrique",
    motherSauce: "Independent",
    cuisine: "French",
    rawIngredients: ["1/2 cup sugar", "1/4 cup vinegar", "1/2 cup fruit puree"],
    instructions: "Cook sugar in a dry saucepan over medium heat until it caramelizes to a deep amber. Carefully add vinegar (it will sputter) and stir until dissolved. Add fruit puree and simmer until slightly thickened.",
    pairsWith: ["duck", "foie gras", "pork"],
  },
  {
    name: "Chimichurri Verde",
    motherSauce: "Salsa",
    cuisine: "Argentine",
    rawIngredients: ["1 cup parsley", "1/4 cup oregano", "4 cloves garlic", "1/2 cup olive oil", "2 tbsp red wine vinegar", "1 tsp red pepper flakes"],
    instructions: "Finely chop parsley, oregano, and garlic. Combine in a bowl with olive oil, red wine vinegar, and red pepper flakes. Let rest at least 30 minutes before serving.",
    pairsWith: ["steak", "grilled chicken", "empanadas"],
  },
  {
    name: "Dashi",
    motherSauce: "Independent",
    cuisine: "Japanese",
    rawIngredients: ["4 cups water", "1 piece kombu", "1 cup bonito flakes"],
    instructions: "Soak kombu in water for 30 minutes. Heat slowly until just before boiling, then remove kombu. Bring to a boil, add bonito flakes, and immediately remove from heat. Let steep 5 minutes, then strain.",
    pairsWith: ["miso soup", "ramen", "soba"],
  },
  {
    name: "Salsa Macha",
    motherSauce: "Salsa",
    cuisine: "Mexican",
    rawIngredients: ["1 cup vegetable oil", "6 dried chili", "1/4 cup peanuts", "4 cloves garlic", "1 tbsp sesame seeds"],
    instructions: "Heat oil and fry dried chilies, peanuts, garlic, and sesame seeds until toasted and fragrant. Let cool slightly, then blend or chop to desired consistency. Store submerged in the frying oil.",
    pairsWith: ["tacos", "eggs", "noodles"],
  },
];

for (const sauce of newSauces) {
  if (!existingSauceNames.has(sauce.name.toLowerCase())) {
    const ingredients = sauce.rawIngredients.map(parseMeasuredIngredient);
    data.sauces.push({
      name: sauce.name,
      motherSauce: sauce.motherSauce,
      cuisine: sauce.cuisine,
      ingredients,
      instructions: sauce.instructions,
      pairsWith: sauce.pairsWith,
    });
    recipesAdded++;
  }
}

// --- Update sauceIngredientNames ---
const existingNameSet = new Set(data.sauceIngredientNames);
for (const ing of data.ingredients) {
  if (!existingNameSet.has(ing.name)) {
    data.sauceIngredientNames.push(ing.name);
    existingNameSet.add(ing.name);
  }
}
// Also add any ingredient names from new sauces that are not yet tracked
for (const sauce of data.sauces) {
  for (const ing of sauce.ingredients) {
    if (!existingNameSet.has(ing.name)) {
      data.sauceIngredientNames.push(ing.name);
      existingNameSet.add(ing.name);
    }
  }
}

// --- Write output ---
fs.writeFileSync(SAUCE_PATH, JSON.stringify(data, null, 2), "utf-8");

console.log(`New ingredients added: ${ingredientsAdded}`);
console.log(`New recipes added: ${recipesAdded}`);
console.log(`New pairings added: ${pairingsAdded}`);
console.log(`Total ingredients: ${data.ingredients.length}`);
console.log(`Total sauces: ${data.sauces.length}`);
console.log(`Total pairings: ${data.pairings.length}`);
console.log(`Total sauceIngredientNames: ${data.sauceIngredientNames.length}`);
