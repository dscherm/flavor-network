import { resolveIngredientName } from './recipePairingMatch.js';
import { namedBottle } from './myBar.js';
import { usage } from './usageEvents.js';

/**
 * Report a typed ingredient the app does not know (usage: ingredient_unrecognised).
 * "Known" means it resolves to a name in the ingredient list, or names a bottle the bar knows.
 * With no ingredient list loaded there is nothing to judge against, so nothing is sent.
 * Never throws; the caller carries on whatever the answer.
 */
export function noteTypedIngredient(lab, text, names) {
  try {
    if (!names || !(names.size > 0)) return;
    if (resolveIngredientName(text, names) || namedBottle(text)) return;
    usage.ingredientUnrecognised(lab, text);
  } catch { /* never throws */ }
}
