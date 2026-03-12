/**
 * Palate Discovery Questionnaire — Question Bank
 *
 * Each question maps to a set of ingredients with multipliers via the
 * `mappings` field. quizScoring.js (TASK-80) will use these mappings
 * to compute initial profile weights from quiz answers.
 *
 * Question types:
 *   - scale: 5-point Likert (labels array, answer = index 0-4)
 *   - choice: single select from options (answer = option string)
 *   - multi: pick up to `max` options (answer = string[])
 */

const palateQuestions = [
  // 1. Intensity / Allium
  {
    id: 'garlic_intensity',
    type: 'scale',
    title: 'Garlic Love',
    question: 'Do you always add extra garlic to recipes?',
    labels: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'],
    mappings: {
      garlic: [0, 0.2, 0.5, 0.8, 1.0],
      onion: [0, 0.1, 0.3, 0.5, 0.7],
      shallot: [0, 0.1, 0.2, 0.4, 0.6],
      leek: [0, 0.05, 0.15, 0.3, 0.5],
      chive: [0, 0.05, 0.15, 0.3, 0.5],
    },
  },

  // 2. Heat tolerance
  {
    id: 'heat',
    type: 'scale',
    title: 'Heat Tolerance',
    question: 'How spicy do you like your food?',
    labels: ['Mild', 'Medium', 'Hot', 'Very Hot', 'Extreme'],
    mappings: {
      'black pepper': [0.3, 0.4, 0.5, 0.6, 0.7],
      'chile pepper': [0, 0.2, 0.5, 0.8, 1.0],
      'red pepper flakes': [0, 0.15, 0.4, 0.7, 0.9],
      cayenne: [0, 0.1, 0.35, 0.65, 0.9],
      chipotle: [0, 0.1, 0.3, 0.6, 0.8],
      wasabi: [0, 0.05, 0.2, 0.4, 0.7],
      horseradish: [0, 0.05, 0.2, 0.4, 0.6],
      ginger: [0.2, 0.3, 0.4, 0.5, 0.6],
    },
  },

  // 3. Spicy cuisine affinity
  {
    id: 'spicy_cuisines',
    type: 'multi',
    title: 'Spicy Cuisine Affinity',
    question: 'Which spicy cuisines do you enjoy? (select all that apply)',
    options: ['Thai', 'Indian', 'Mexican', 'Szechuan', 'Korean', 'Ethiopian', 'Cajun/Creole', 'Caribbean'],
    max: 8,
    mappings: {
      Thai: { lemongrass: 0.7, 'thai basil': 0.7, galangal: 0.6, 'fish sauce': 0.6, 'coconut milk': 0.5, lime: 0.5 },
      Indian: { cumin: 0.7, turmeric: 0.7, coriander: 0.6, cardamom: 0.6, garam_masala: 0.5, 'curry leaf': 0.5 },
      Mexican: { cumin: 0.6, cilantro: 0.7, lime: 0.6, avocado: 0.5, 'chile pepper': 0.6, oregano: 0.4 },
      Szechuan: { 'sichuan peppercorn': 0.8, 'sesame oil': 0.5, 'soy sauce': 0.5, ginger: 0.5, garlic: 0.5 },
      Korean: { 'sesame oil': 0.6, ginger: 0.5, garlic: 0.6, 'soy sauce': 0.5, 'rice vinegar': 0.4 },
      Ethiopian: { cumin: 0.5, turmeric: 0.4, coriander: 0.4, cardamom: 0.4, ginger: 0.4 },
      'Cajun/Creole': { cayenne: 0.6, thyme: 0.5, oregano: 0.4, 'bay leaf': 0.5, 'black pepper': 0.5 },
      Caribbean: { allspice: 0.6, thyme: 0.5, lime: 0.5, ginger: 0.4, 'scotch bonnet': 0.5 },
    },
  },

  // 4. Sweet vs Savory
  {
    id: 'sweet_savory',
    type: 'choice',
    title: 'Sweet vs Savory',
    question: 'When snacking, do you reach for sweet or savory?',
    options: ['Sweet', 'Savory', 'Both equally'],
    mappings: {
      Sweet: { sugar: 0.6, honey: 0.6, vanilla: 0.5, chocolate: 0.5, cinnamon: 0.5, maple: 0.4, caramel: 0.4 },
      Savory: { salt: 0.6, 'soy sauce': 0.5, cheese: 0.5, olive: 0.4, 'black pepper': 0.5, garlic: 0.4 },
      'Both equally': { sugar: 0.3, honey: 0.3, salt: 0.3, 'soy sauce': 0.25, cheese: 0.25, vanilla: 0.25 },
    },
  },

  // 5. Herb preferences
  {
    id: 'herbs',
    type: 'multi',
    title: 'Herb Preferences',
    question: 'Pick your top 3 herbs:',
    options: ['Basil', 'Cilantro', 'Parsley', 'Rosemary', 'Thyme', 'Mint', 'Dill', 'Oregano', 'Tarragon', 'Chives'],
    max: 3,
    mappings: {
      Basil: { basil: 0.9, 'thai basil': 0.4 },
      Cilantro: { cilantro: 0.9, coriander: 0.4 },
      Parsley: { parsley: 0.9 },
      Rosemary: { rosemary: 0.9 },
      Thyme: { thyme: 0.9 },
      Mint: { mint: 0.9, spearmint: 0.4 },
      Dill: { dill: 0.9 },
      Oregano: { oregano: 0.9, marjoram: 0.4 },
      Tarragon: { tarragon: 0.9 },
      Chives: { chive: 0.9 },
    },
  },

  // 6. Acid tolerance
  {
    id: 'acid',
    type: 'scale',
    title: 'Acid Tolerance',
    question: 'Do you squeeze lemon or lime on everything?',
    labels: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'],
    mappings: {
      lemon: [0, 0.2, 0.4, 0.7, 1.0],
      lime: [0, 0.15, 0.35, 0.65, 0.9],
      vinegar: [0, 0.1, 0.3, 0.5, 0.7],
      'rice vinegar': [0, 0.05, 0.2, 0.4, 0.6],
      'balsamic vinegar': [0, 0.05, 0.2, 0.4, 0.6],
      orange: [0.1, 0.15, 0.25, 0.4, 0.5],
      grapefruit: [0, 0.05, 0.15, 0.3, 0.5],
    },
  },

  // 7. Umami seeking
  {
    id: 'umami',
    type: 'choice',
    title: 'Umami Seeking',
    question: 'Do you add soy sauce, parmesan, or mushrooms to boost flavor?',
    options: ['Rarely', 'Sometimes', 'Frequently', 'Every chance I get'],
    mappings: {
      Rarely: { 'soy sauce': 0.1, parmesan: 0.1, mushroom: 0.1 },
      Sometimes: { 'soy sauce': 0.3, parmesan: 0.3, mushroom: 0.3, 'fish sauce': 0.15, miso: 0.15 },
      Frequently: { 'soy sauce': 0.6, parmesan: 0.6, mushroom: 0.6, 'fish sauce': 0.3, miso: 0.3, anchovy: 0.2 },
      'Every chance I get': { 'soy sauce': 0.8, parmesan: 0.8, mushroom: 0.8, 'fish sauce': 0.5, miso: 0.5, anchovy: 0.4, 'dried tomato': 0.3 },
    },
  },

  // 8. Texture preference
  {
    id: 'texture',
    type: 'choice',
    title: 'Texture Preference',
    question: 'Crunchy or creamy?',
    options: ['Crunchy', 'Creamy', 'Both equally'],
    mappings: {
      Crunchy: { almond: 0.5, walnut: 0.5, peanut: 0.5, sesame: 0.4, pistachio: 0.4, 'pine nut': 0.3, breadcrumb: 0.3 },
      Creamy: { cream: 0.6, butter: 0.5, 'cream cheese': 0.4, 'coconut milk': 0.4, avocado: 0.5, mascarpone: 0.3, yogurt: 0.4 },
      'Both equally': { almond: 0.25, walnut: 0.25, cream: 0.3, butter: 0.25, avocado: 0.25, peanut: 0.25 },
    },
  },

  // 9. Bitter appreciation
  {
    id: 'bitter',
    type: 'scale',
    title: 'Bitter Appreciation',
    question: 'Do you enjoy dark chocolate, coffee, or hoppy beer?',
    labels: ['Not at all', 'A little', 'Moderately', 'Quite a bit', 'Love them'],
    mappings: {
      chocolate: [0, 0.2, 0.4, 0.7, 1.0],
      coffee: [0, 0.2, 0.4, 0.7, 1.0],
      cocoa: [0, 0.15, 0.35, 0.6, 0.85],
      'radicchio': [0, 0.1, 0.2, 0.4, 0.6],
      'endive': [0, 0.05, 0.15, 0.3, 0.5],
      arugula: [0, 0.1, 0.25, 0.45, 0.65],
    },
  },

  // 10. Aromatic preferences
  {
    id: 'aromas',
    type: 'multi',
    title: 'Aromatic Preferences',
    question: 'Which aromas appeal to you most? (pick 3)',
    options: ['Smoky', 'Floral', 'Earthy', 'Citrusy', 'Herbal', 'Nutty', 'Buttery', 'Spicy'],
    max: 3,
    mappings: {
      Smoky: { chipotle: 0.6, 'smoked paprika': 0.7, bacon: 0.5, 'smoked salt': 0.4 },
      Floral: { lavender: 0.7, 'rose water': 0.6, elderflower: 0.5, chamomile: 0.4, saffron: 0.5 },
      Earthy: { mushroom: 0.7, truffle: 0.6, beet: 0.5, cumin: 0.4, thyme: 0.4 },
      Citrusy: { lemon: 0.6, lime: 0.6, orange: 0.5, grapefruit: 0.4, 'lemon zest': 0.5, 'yuzu': 0.4 },
      Herbal: { basil: 0.5, rosemary: 0.5, thyme: 0.5, sage: 0.4, oregano: 0.4, 'bay leaf': 0.3 },
      Nutty: { almond: 0.6, walnut: 0.5, 'sesame oil': 0.5, hazelnut: 0.5, 'brown butter': 0.5 },
      Buttery: { butter: 0.7, cream: 0.5, ghee: 0.5, 'brown butter': 0.5, brioche: 0.3 },
      Spicy: { cinnamon: 0.5, cardamom: 0.5, clove: 0.4, nutmeg: 0.4, 'star anise': 0.4, allspice: 0.3 },
    },
  },

  // 11. Cooking fat preference
  {
    id: 'cooking_fat',
    type: 'choice',
    title: 'Cooking Fat',
    question: 'Your go-to cooking fat?',
    options: ['Butter', 'Olive oil', 'Coconut oil', 'Sesame oil', 'Ghee', 'Neutral oil'],
    mappings: {
      Butter: { butter: 0.9, cream: 0.3, 'brown butter': 0.4 },
      'Olive oil': { 'olive oil': 0.9, olive: 0.3, lemon: 0.2 },
      'Coconut oil': { 'coconut oil': 0.9, coconut: 0.4, 'coconut milk': 0.3 },
      'Sesame oil': { 'sesame oil': 0.9, sesame: 0.5, 'soy sauce': 0.3 },
      Ghee: { ghee: 0.9, butter: 0.3, cumin: 0.2, turmeric: 0.2 },
      'Neutral oil': {},
    },
  },

  // 12. Allium spectrum
  {
    id: 'allium_rank',
    type: 'multi',
    title: 'Allium Spectrum',
    question: 'Which alliums do you love most? (pick your top 3)',
    options: ['Raw garlic', 'Roasted garlic', 'Shallots', 'Red onion', 'Scallion', 'Leek', 'Chives'],
    max: 3,
    mappings: {
      'Raw garlic': { garlic: 0.9 },
      'Roasted garlic': { garlic: 0.7, 'olive oil': 0.2 },
      Shallots: { shallot: 0.9, 'red wine vinegar': 0.2 },
      'Red onion': { onion: 0.8 },
      Scallion: { scallion: 0.8, 'soy sauce': 0.15 },
      Leek: { leek: 0.8, butter: 0.15 },
      Chives: { chive: 0.8 },
    },
  },

  // 13. Dairy comfort
  {
    id: 'dairy',
    type: 'scale',
    title: 'Dairy & Cheese',
    question: 'How do you feel about strong cheeses?',
    labels: ['Avoid dairy', 'Mild only', 'Moderate', 'Love strong cheese', 'The stinkier the better'],
    mappings: {
      parmesan: [0, 0.2, 0.4, 0.7, 1.0],
      cheese: [0, 0.3, 0.5, 0.7, 0.9],
      'blue cheese': [0, 0, 0.1, 0.4, 0.8],
      'goat cheese': [0, 0.1, 0.3, 0.5, 0.7],
      cream: [0.1, 0.3, 0.4, 0.5, 0.5],
      butter: [0.1, 0.3, 0.4, 0.5, 0.5],
      yogurt: [0.1, 0.3, 0.4, 0.4, 0.4],
    },
  },

  // 14. Global palate breadth
  {
    id: 'adventure',
    type: 'scale',
    title: 'Culinary Adventure',
    question: 'How adventurous are you with unfamiliar cuisines?',
    labels: ['Very cautious', 'Somewhat cautious', 'Open', 'Adventurous', 'Will try anything'],
    // This question doesn't map to specific ingredients but modifies the
    // variety weighting in quizScoring.js — higher adventure = broader exploration suggestions
    mappings: {},
    meta: { controlsVarietyWeight: true },
  },

  // 15. Finish preference
  {
    id: 'finish',
    type: 'multi',
    title: 'Finishing Touch',
    question: 'What do you like to finish a dish with? (select all)',
    options: ['Fresh herbs', 'Citrus zest', 'Hot sauce', 'Cheese', 'Cream', 'Crunch', 'Nothing'],
    max: 7,
    mappings: {
      'Fresh herbs': { basil: 0.3, cilantro: 0.3, parsley: 0.3, chive: 0.2, dill: 0.2 },
      'Citrus zest': { 'lemon zest': 0.6, lemon: 0.3, lime: 0.3, orange: 0.2 },
      'Hot sauce': { 'chile pepper': 0.4, cayenne: 0.3, vinegar: 0.2 },
      Cheese: { parmesan: 0.5, cheese: 0.4, 'goat cheese': 0.2 },
      Cream: { cream: 0.5, butter: 0.3, 'sour cream': 0.3 },
      Crunch: { breadcrumb: 0.4, almond: 0.3, sesame: 0.3, 'pine nut': 0.2 },
      Nothing: {},
    },
  },
];

export default palateQuestions;
