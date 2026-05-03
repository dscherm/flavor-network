/**
 * Phase 5: bloom strength is downscaled to 0.6× on mobile-narrow
 * viewports (<640 px). When bloom is enabled at all, this trades a
 * little glow for steadier frame time on phones. Pure function so
 * consumers can unit-test the policy without spinning up WebGL.
 *
 * @param {number} baseStrength desktop bloom strength (default 1.5)
 * @param {number} viewportWidth viewport pixel width (e.g. window.innerWidth)
 * @returns {number}
 */
export function computeBloomStrength(baseStrength, viewportWidth) {
  const base = typeof baseStrength === 'number' ? baseStrength : 1.5;
  if (typeof viewportWidth !== 'number') return base;
  return viewportWidth < 640 ? base * 0.6 : base;
}
