/**
 * notebookStarters.js — the three starter ingredients the Recipe Notebook
 * offers on an empty bowl (DESIGN-4).
 *
 * Uses existing data only: each graph node's `category` and `pairingCount`
 * (how many pairings it has in ProData, i.e. how widely it cooks with
 * things). For each starter category, in order, take that category's most
 * paired ingredient, so the trio spans different kinds of food (a
 * vegetable, an aromatic, a herb …) instead of three pantry staples.
 */

// Savoury, cook-from-here categories first; pantry staples (sugar, flour,
// butter, oil, stock) are left out on purpose — nobody starts a dish there.
export const STARTER_CATEGORIES = [
  'vegetable', 'aromatic', 'herb', 'protein', 'citrus', 'fruit', 'umami', 'chili', 'spice', 'dairy',
];

function nodeList(nodes) {
  if (!nodes) return [];
  if (nodes instanceof Map) return [...nodes.values()];
  if (Array.isArray(nodes)) return nodes;
  return Object.values(nodes);
}

/**
 * @param {Map<string, {name, category, pairingCount}>|Object|Array} nodes
 * @param {number} [count=3]
 * @returns {{name: string, category: string|null}[]}
 */
export function pickStarterIngredients(nodes, count = 3) {
  const list = nodeList(nodes).filter((n) => n && typeof n.name === 'string' && n.name.length > 0);
  const best = new Map(); // category → node with highest pairingCount
  for (const n of list) {
    const cat = String(n.category || '').toLowerCase();
    if (!STARTER_CATEGORIES.includes(cat)) continue;
    const cur = best.get(cat);
    const score = n.pairingCount || 0;
    if (!cur || score > (cur.pairingCount || 0) || (score === (cur.pairingCount || 0) && n.name < cur.name)) {
      best.set(cat, n);
    }
  }
  const picks = [];
  for (const cat of STARTER_CATEGORIES) {
    if (picks.length >= count) break;
    const n = best.get(cat);
    if (n) picks.push({ name: n.name, category: n.category || null });
  }
  return picks;
}
