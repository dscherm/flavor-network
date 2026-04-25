/**
 * sauceScoring.js — Mother-sauce template registry consumed by the
 * Recipe Lab template strip (RecipeLabTemplates.jsx). Used to bias
 * the SuggestionDrawer toward filling each template's missing roles
 * when the user picks a "Start from" template in Sauce mode.
 *
 * The previous compatibility / template-detection / next-ingredient
 * helpers in this file were only used by the now-deleted SaucePanel
 * + SauceBuilder; they were removed alongside those components.
 */

export const SAUCE_TEMPLATES = [
  // French Mother Sauces
  {
    name: 'Béchamel',
    roles: { Fat: 1, Thickener: 1, Liquid: 1 },
    description: 'Fat + Roux + Milk',
    technique: 'roux',
  },
  {
    name: 'Velouté',
    roles: { Fat: 1, Thickener: 1, Liquid: 1 },
    description: 'Fat + Roux + Stock',
    technique: 'roux',
  },
  {
    name: 'Espagnole',
    roles: { Fat: 1, Thickener: 1, Liquid: 1, Aromatic: 1, Protein: 0.5 },
    description: 'Fat + Roux + Stock + Mirepoix',
    technique: 'reduction',
  },
  {
    name: 'Tomato',
    roles: { Fat: 1, Acid: 1, Aromatic: 1, Herb: 0.5 },
    description: 'Fat + Tomato + Aromatics + Herbs',
    technique: 'simmer',
  },
  {
    name: 'Hollandaise',
    roles: { Fat: 1, Thickener: 1, Acid: 1 },
    description: 'Butter + Egg Yolk + Acid',
    technique: 'emulsification',
  },
  // Global Templates
  {
    name: 'Curry',
    roles: { Fat: 1, Aromatic: 1, Seasoning: 1, Chili: 0.5, Liquid: 0.5 },
    description: 'Fat + Aromatics + Spices + Heat',
    technique: 'bloom + simmer',
  },
  {
    name: 'Stir-fry',
    roles: { Protein: 1, Aromatic: 1, Seasoning: 0.5 },
    description: 'Soy/Fish Sauce + Aromatics + Seasoning',
    technique: 'wok',
  },
  {
    name: 'Mole',
    roles: { Fat: 1, Chili: 1, Seasoning: 1, Other: 1 },
    description: 'Fat + Chilies + Spices + Chocolate/Nuts',
    technique: 'toast + blend',
  },
  {
    name: 'Salsa',
    roles: { Acid: 1, Aromatic: 1, Chili: 0.5, Herb: 0.5 },
    description: 'Tomato/Tomatillo + Aromatics + Chili + Herbs',
    technique: 'raw or roast',
  },
  {
    name: 'Nut Sauce',
    roles: { Other: 1, Acid: 0.5, Seasoning: 0.5, Chili: 0.5 },
    description: 'Peanut/Tahini + Acid + Seasoning',
    technique: 'blend',
  },
];
