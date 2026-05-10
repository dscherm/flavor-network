// One-shot: take public/logo.png (640x640) and produce the iOS App
// Store icon at 1024x1024, alpha flattened to the brand navy. Also
// peek the source's top-left pixel so we use the actual brand color
// rather than a guess.
//
// Usage:  node scripts/build-icon.mjs

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const SRC = resolve(root, 'public/logo.png');
const IOS_ICON = resolve(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');

// Sample top-left pixel for the actual brand navy.
const { data: samplePx } = await sharp(SRC).extract({ left: 2, top: 2, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
const [r, g, b] = samplePx;
const brandNavy = { r, g, b, alpha: 1 };
const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
console.log(`Brand navy sampled from logo top-left: rgb(${r}, ${g}, ${b}) ${hex}`);

await sharp(SRC)
  .resize(1024, 1024, { fit: 'cover', kernel: 'lanczos3' })
  .flatten({ background: brandNavy })
  .png({ compressionLevel: 9 })
  .toFile(IOS_ICON);

console.log(`Wrote iOS icon: ${IOS_ICON}`);
console.log(`Brand navy hex (use this in CSS / theme-color): ${hex}`);
