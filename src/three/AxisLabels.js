import * as THREE from 'three';

/**
 * AxisLabels — Creates text sprites positioned at axis extremes in 3D space.
 * Sprites always face the camera, so labels stay readable from any angle.
 */

function createTextSprite(text, color = '#ffffff', fontSize = 48) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Measure text to size canvas
  ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;

  canvas.width = Math.ceil(textWidth) + 24;
  canvas.height = fontSize + 16;

  // Re-set font after resize
  ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Subtle background pill
  ctx.fillStyle = 'rgba(10, 10, 15, 0.5)';
  const rx = canvas.width / 2;
  const ry = canvas.height / 2;
  ctx.beginPath();
  ctx.roundRect(2, 2, canvas.width - 4, canvas.height - 4, canvas.height / 3);
  ctx.fill();

  // Text
  ctx.fillStyle = color;
  ctx.fillText(text, rx, ry);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.7,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const sprite = new THREE.Sprite(material);

  // Scale sprite to reasonable world-space size
  const aspect = canvas.width / canvas.height;
  const scale = 2;
  sprite.scale.set(scale * aspect, scale, 1);

  return sprite;
}

/**
 * Create a small label sprite for a node (50% of axis label size).
 * @param {string} text - Ingredient name
 * @param {number[]} position - [x, y, z] world position
 * @returns {THREE.Sprite}
 */
export function createNodeLabel(text, position) {
  const sprite = createTextSprite(text, 'rgba(255, 255, 255, 0.95)', 36);
  const aspect = sprite.scale.x / sprite.scale.y;
  const scale = 1; // 50% of axis label scale (2)
  sprite.scale.set(scale * aspect, scale, 1);
  sprite.position.set(position[0], position[1] + 2.5, position[2]);
  return sprite;
}

/**
 * Build axis label sprites for the Cocktail Lab Codex axes.
 * @param {number} spread - Spatial spread used in positioning (default 45)
 * @returns {THREE.Group} Group containing all axis label sprites
 */
export function createCocktailAxisLabels(spread = 45) {
  const group = new THREE.Group();
  const offset = spread * 1.43; // Place labels just beyond the node cloud

  // X axis: Spirit-forward (negative) ↔ Modified (positive)
  const spiritLabel = createTextSprite('Spirit-forward', 'rgba(248, 113, 113, 0.9)');
  spiritLabel.position.set(-offset, 0, 0);
  group.add(spiritLabel);

  const modifiedLabel = createTextSprite('Modified', 'rgba(248, 113, 113, 0.9)');
  modifiedLabel.position.set(offset, 0, 0);
  group.add(modifiedLabel);

  // Y axis: Short (negative) ↔ Long (positive)
  const shortLabel = createTextSprite('Short', 'rgba(74, 222, 128, 0.9)');
  shortLabel.position.set(0, -offset, 0);
  group.add(shortLabel);

  const longLabel = createTextSprite('Long', 'rgba(74, 222, 128, 0.9)');
  longLabel.position.set(0, offset, 0);
  group.add(longLabel);

  // Z axis: Simple (negative) ↔ Complex (positive)
  const simpleLabel = createTextSprite('Simple', 'rgba(96, 165, 250, 0.9)');
  simpleLabel.position.set(0, 0, -offset);
  group.add(simpleLabel);

  const complexLabel = createTextSprite('Complex', 'rgba(96, 165, 250, 0.9)');
  complexLabel.position.set(0, 0, offset);
  group.add(complexLabel);

  return group;
}

/**
 * Build axis label sprites for the main Network taste axes.
 * @param {number} spread - Spatial spread used in positioning (default 50)
 * @returns {THREE.Group} Group containing all axis label sprites
 */
export function createTasteAxisLabels(spread = 50) {
  const group = new THREE.Group();
  const offset = spread * 1.43;

  // X axis: Sweet (negative) ↔ Salty/Umami (positive)
  const sweetLabel = createTextSprite('Sweet', 'rgba(248, 113, 113, 0.9)');
  sweetLabel.position.set(-offset, 0, 0);
  group.add(sweetLabel);

  const saltyLabel = createTextSprite('Salty / Umami', 'rgba(248, 113, 113, 0.9)');
  saltyLabel.position.set(offset, 0, 0);
  group.add(saltyLabel);

  // Y axis: Mild (negative) ↔ Spicy/Pungent (positive)
  const mildLabel = createTextSprite('Mild', 'rgba(74, 222, 128, 0.9)');
  mildLabel.position.set(0, -offset, 0);
  group.add(mildLabel);

  const spicyLabel = createTextSprite('Spicy', 'rgba(74, 222, 128, 0.9)');
  spicyLabel.position.set(0, offset, 0);
  group.add(spicyLabel);

  // Z axis: Light/Fresh (negative) ↔ Rich/Bitter (positive)
  const lightLabel = createTextSprite('Light / Fresh', 'rgba(96, 165, 250, 0.9)');
  lightLabel.position.set(0, 0, -offset);
  group.add(lightLabel);

  const richLabel = createTextSprite('Rich / Bitter', 'rgba(96, 165, 250, 0.9)');
  richLabel.position.set(0, 0, offset);
  group.add(richLabel);

  return group;
}
