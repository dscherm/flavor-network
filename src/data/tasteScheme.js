/**
 * tasteScheme.js (DATA-5). The ingredient taste labels, written down once: the ten words, what each
 * means, the rules for choosing and ordering them, and worked examples. docs/data-quality.md renders this
 * (scripts/auditData.mjs) and src/data/__tests__/tasteLabels.test.js checks every example against the
 * curated data, so the page a cook reads cannot drift from the labels the app uses.
 *
 * FLAVOR-3 reads these labels: first word 1.0, second 0.6, third 0.35; spicy and pungent feed heat;
 * astringent counts half toward bitter; neutral and rich feed no taste axis.
 */
export const TASTE_WORDS = [
  { word: 'sweet', meaning: 'sugar, honey, ripe fruit, sweet liqueurs', examples: ['sugar', 'honey', 'rum'] },
  { word: 'sour', meaning: 'acid, tang: citrus, vinegar, yogurt, dry sparkling wine', examples: ['lemon juice', 'vinegar', 'champagne'] },
  { word: 'bitter', meaning: 'bitterness: bitters, coffee, dark chocolate, gin\'s dry botanicals', examples: ['angostura bitters', 'coffee', 'gin'] },
  { word: 'salty', meaning: 'salt, brine, cured and salted foods', examples: ['salt', 'feta', 'bacon'] },
  { word: 'umami', meaning: 'savoury depth: aged cheese, soy, mushrooms, meat, tomato paste', examples: ['soy sauce', 'parmesan', 'mushroom'] },
  { word: 'spicy', meaning: 'the heat of chili, pepper and ginger', examples: ['cayenne pepper', 'ginger', 'ginger beer'] },
  { word: 'pungent', meaning: 'a sharp, nose-clearing bite: garlic, onion, mustard, strong spices', examples: ['garlic', 'onion', 'horseradish root'] },
  { word: 'astringent', meaning: 'a dry, puckering, leafy feel: some herbs, tea, unripe fruit', examples: ['oregano', 'mint', 'okra'] },
  { word: 'neutral', meaning: 'no taste of its own: water, plain starch, neutral spirit. It always stands alone', examples: ['water', 'flour', 'vodka'] },
  { word: 'rich', meaning: 'a fatty or creamy mouthfeel that is not one of the basic tastes: butter, oil, cream, egg yolk, avocado. It may lead a label with a taste after it', examples: ['butter', 'olive oil', 'egg yolk'] },
];

export const TASTE_RULES = [
  'A label is one to three words, strongest first. A second or third word is added only when a cook would taste it.',
  'Label what the ingredient tastes like on its own, in the amount a cook uses, not what it becomes in a dish. Flour is not sweet because a cake is.',
  'Starches and grains (flour, rice, bread, pasta, noodles, oats, cornmeal, cornstarch, tortillas), water, ice, soda water and neutral spirit are neutral. Neutral is never combined with another word.',
  'Plain fats and oils (butter, oils, lard, shortening, ghee) are rich. Cream, milk, egg yolk, avocado and nuts are rich first, with a taste after it only if the taste is real: cream is rich sweet, sour cream is sour rich.',
  'The burn of alcohol is not a taste. Spirits are never labelled pungent or spicy; they get the flavour that tells them apart: bourbon sweet, gin bitter, vodka neutral, rum sweet.',
  'Spicy and pungent are charted as heat, so they are kept for real bite (chili, garlic, mustard). Herbs and warm spices (parsley, thyme, cumin, cinnamon, nutmeg and the like) are aromatic, not hot: FLAVOR-3 took pungent off them in tasteOverrides.json.',
  'A label that is a deliberate correction of the generated data is one line in src/data/curation/tasteOverrides.json with a reason.',
];

/** Worked examples: the label the data must hold, and why. */
export const TASTE_EXAMPLES = [
  { name: 'flour', label: 'neutral', why: 'a plain starch; the old label was sweet' },
  { name: 'rice', label: 'neutral', why: 'a plain grain' },
  { name: 'water', label: 'neutral', why: 'no taste at all' },
  { name: 'vodka', label: 'neutral', why: 'neutral spirit; the old label was sweet bitter' },
  { name: 'butter', label: 'rich', why: 'fat, not sugar; the old label was sweet' },
  { name: 'olive oil', label: 'rich', why: 'fat; the old label was bitter' },
  { name: 'cream', label: 'rich sweet', why: 'fat first, faintly sweet' },
  { name: 'sour cream', label: 'sour rich', why: 'the tang leads, then the fat' },
  { name: 'egg white', label: 'neutral', why: 'protein and water' },
  { name: 'bourbon', label: 'sweet', why: 'sweet from corn and oak; no heat word' },
  { name: 'gin', label: 'bitter', why: 'dry juniper and botanicals; no heat word' },
  { name: 'lemon juice', label: 'sour', why: 'the sour of a drink or a sauce' },
  { name: 'parmesan', label: 'umami salty', why: 'aged cheese: savoury depth, then salt' },
  { name: 'garlic', label: 'pungent', why: 'a sharp bite' },
];
