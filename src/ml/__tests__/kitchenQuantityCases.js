/**
 * WEAK-4 — hand-written kitchen-sanity cases for the amount model.
 *
 * Written BEFORE the WEAK-4 rebuild so the before/after pass rate is honest.
 * Each case lists the units a cook would accept for a typical (serves ~4)
 * recipe and, per unit, the plausible quantity range (inclusive). A
 * prediction passes when its unit is one of the listed units AND its qty sits
 * inside that unit's range.
 *
 * Count units: 'each' is a whole item (an egg, an onion, a chicken thigh, a
 * slice of bacon); 'clove' / 'sprig' / 'handful' / 'can' are their own units.
 */
export const KITCHEN_CASES = [
  { name: 'chicken', ok: { lb: [0.5, 3], g: [225, 1400], oz: [8, 48], each: [1, 8] } },
  { name: 'beef', ok: { lb: [0.5, 3], g: [225, 1400], oz: [8, 48] } },
  { name: 'pork', ok: { lb: [0.5, 3], g: [225, 1400], oz: [8, 48], each: [1, 6] } },
  { name: 'bacon', ok: { each: [2, 12], lb: [0.25, 1], oz: [4, 16], g: [100, 450] } },
  { name: 'salmon', ok: { lb: [0.5, 2.5], oz: [6, 40], g: [200, 1200], each: [1, 6] } },
  { name: 'shrimp', ok: { lb: [0.5, 2], oz: [8, 32], g: [225, 900] } },
  { name: 'egg', ok: { each: [1, 6], large: [1, 6] } },
  { name: 'garlic', ok: { clove: [1, 6] } },
  { name: 'onion', ok: { each: [0.5, 2], cup: [0.25, 2] } },
  { name: 'olive oil', ok: { tbsp: [1, 4] } },
  { name: 'butter', ok: { tbsp: [1, 8], cup: [0.25, 1] } },
  { name: 'salt', ok: { tsp: [0.25, 2], pinch: [1, 2] } },
  { name: 'black pepper', ok: { tsp: [0.125, 1], pinch: [1, 2] } },
  { name: 'cumin', ok: { tsp: [0.25, 2] } },
  { name: 'paprika', ok: { tsp: [0.25, 2], tbsp: [1, 2] } },
  { name: 'cinnamon', ok: { tsp: [0.25, 2] } },
  { name: 'basil', ok: { tbsp: [1, 4], cup: [0.25, 1], handful: [1, 2], tsp: [0.5, 2] } },
  { name: 'parsley', ok: { tbsp: [1, 4], cup: [0.25, 1], handful: [1, 2] } },
  { name: 'cilantro', ok: { tbsp: [1, 4], cup: [0.25, 1], handful: [1, 2] } },
  { name: 'thyme', ok: { tsp: [0.25, 2], tbsp: [1, 2], sprig: [1, 6] } },
  { name: 'pasta', ok: { lb: [0.5, 1], oz: [8, 16], g: [225, 450] } },
  { name: 'rice', ok: { cup: [0.5, 3] } },
  { name: 'flour', ok: { cup: [0.25, 4] } },
  { name: 'sugar', ok: { cup: [0.25, 2], tbsp: [1, 4] } },
  { name: 'brown sugar', ok: { cup: [0.25, 1.5], tbsp: [1, 4] } },
  { name: 'milk', ok: { cup: [0.25, 2] } },
  { name: 'parmesan', ok: { cup: [0.25, 1], tbsp: [2, 8], oz: [1, 4], g: [25, 125] } },
  { name: 'cheddar', ok: { cup: [0.5, 3], oz: [4, 16], lb: [0.25, 1] } },
  { name: 'mozzarella', ok: { cup: [0.5, 3], oz: [4, 16], lb: [0.25, 1] } },
  { name: 'cream cheese', ok: { oz: [3, 16], cup: [0.25, 1], tbsp: [2, 8] } },
  { name: 'tomato', ok: { each: [1, 6], cup: [0.5, 3] } },
  { name: 'potato', ok: { each: [1, 6], lb: [0.5, 3] } },
  { name: 'carrot', ok: { each: [1, 4], cup: [0.5, 2] } },
  { name: 'celery', ok: { each: [1, 4], cup: [0.25, 2] } },
  { name: 'lemon juice', ok: { tbsp: [1, 4], tsp: [1, 3], cup: [0.25, 0.5] } },
  { name: 'soy sauce', ok: { tbsp: [1, 4], tsp: [1, 3], cup: [0.25, 0.5] } },
  { name: 'honey', ok: { tbsp: [1, 4], cup: [0.25, 1] } },
  { name: 'vanilla', ok: { tsp: [0.5, 2] } },
  { name: 'ginger', ok: { tsp: [0.5, 2], tbsp: [1, 2] } },
  { name: 'spinach', ok: { cup: [1, 6], oz: [5, 16], lb: [0.5, 1], g: [150, 450] } },
  { name: 'mushroom', ok: { oz: [4, 16], lb: [0.5, 1], cup: [1, 3], g: [100, 450], each: [4, 12] } },
  { name: 'water', ok: { cup: [0.25, 4] } },
  { name: 'white wine', ok: { cup: [0.25, 1], tbsp: [2, 4] } },
  { name: 'tomato paste', ok: { tbsp: [1, 4], oz: [3, 6], cup: [0.25, 0.5] } },
  { name: 'chili powder', ok: { tsp: [0.5, 3], tbsp: [1, 2] } },
  { name: 'sesame oil', ok: { tsp: [0.5, 3], tbsp: [1, 2] } },
];

/** Does one prediction satisfy its case? */
export function passesCase(c, pred) {
  if (!pred || !pred.unit || typeof pred.qty !== 'number') return false;
  const range = c.ok[pred.unit];
  if (!range) return false;
  return pred.qty >= range[0] - 1e-9 && pred.qty <= range[1] + 1e-9;
}
