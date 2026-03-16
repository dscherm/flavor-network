import { scoreIngredient } from './tastePositioning.js';

// 8 taste axes mapped to evenly-spaced 2D angles (45 degrees apart)
const TASTE_AXES_2D = {
  sweet:      0,
  salty:      Math.PI * 0.25,
  sour:       Math.PI * 0.5,
  bitter:     Math.PI * 0.75,
  umami:      Math.PI,
  spicy:      Math.PI * 1.25,
  pungent:    Math.PI * 1.5,
  astringent: Math.PI * 1.75,
};

const TASTE_KEYS = Object.keys(TASTE_AXES_2D);
const MAX_PAIRINGS = 60;
const ARC_SPREAD = Math.PI / 12; // ±15 degrees

/**
 * Compute 2D radial layout positions for pairings around a center ingredient.
 * @param {string} centerName - Name of the center ingredient
 * @param {Array<{name: string, strength: number}>} pairings - Sorted neighbor list
 * @param {Map} nodes - Full ingredient node map
 * @param {number} radius - Base radius for layout (canvas units)
 * @returns {Map<string, {x: number, y: number, dominantTaste: string, strength: number}>}
 */
export function computeRadialLayout(centerName, pairings, nodes, radius = 280) {
  const positions = new Map();

  // Cap pairings for performance
  const topPairings = pairings.slice(0, MAX_PAIRINGS);

  // Group pairings by dominant taste axis
  const groups = new Map();
  for (const key of TASTE_KEYS) groups.set(key, []);

  for (const pairing of topPairings) {
    const node = nodes.get(pairing.name);
    const { channels } = scoreIngredient(pairing.name, node || {});

    // Find dominant taste channel
    let dominant = 'umami'; // default
    let maxScore = -1;
    for (const key of TASTE_KEYS) {
      if (channels[key] > maxScore) {
        maxScore = channels[key];
        dominant = key;
      }
    }

    groups.get(dominant).push({ ...pairing, dominantTaste: dominant });
  }

  // Position each group along its axis angle
  for (const [taste, items] of groups) {
    if (items.length === 0) continue;
    const baseAngle = TASTE_AXES_2D[taste];

    // Sort by strength descending (stronger = closer to center)
    items.sort((a, b) => b.strength - a.strength);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // Spread within arc: distribute evenly across ±ARC_SPREAD
      const arcOffset = items.length === 1
        ? 0
        : ARC_SPREAD * 2 * (i / (items.length - 1) - 0.5);
      const angle = baseAngle + arcOffset;

      // Distance: stronger pairings closer to center
      // Strength is 0-1; map to [0.3*radius, radius]
      const dist = radius * (0.3 + 0.7 * (1 - item.strength));

      positions.set(item.name, {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        dominantTaste: item.dominantTaste,
        strength: item.strength,
      });
    }
  }

  return positions;
}

export { TASTE_AXES_2D, TASTE_KEYS };
