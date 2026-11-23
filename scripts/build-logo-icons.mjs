// One-off: draw the small-size cut of the logo (hat capping the conical flask)
// and write public/favicon.svg plus the PNG icons and public/logo.png, on the
// Slate ground. The hat paths are the same ones ChalkLogo.jsx draws.
//
// Usage:  node scripts/build-logo-icons.mjs
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CREAM = '#f5efde', ORANGE = '#f2a93b', SAGE = '#8fa274', SLATE = '#0a0a0a';
const HAT = {
  puffs: 'M70 96 C48 100 32 88 36 70 C39 52 56 44 72 50 C73 34 90 28 100 28 C110 28 127 34 128 50 C144 44 161 52 164 70 C168 88 152 100 130 96',
  gather: 'M70 96 Q100 103 130 96',
  band: 'M70 98 L68 136 Q100 141 132 136 L130 98 Q100 104 70 98 Z',
};
// "Nf" as chalk strokes: librsvg cannot load the Caveat web font.
const NF = 'M86 128 L86 107 L100 128 L100 107 M108 128 L108 111 Q108 104 116 105 M103 115 L115 115';

const stroke = (d, c, w, k) =>
  `<path d="${d}" fill="none" stroke="${c}" stroke-width="${(w * k).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;

function mark({ k, nf }) {
  const hat = `<g transform="translate(100 148) scale(0.62) translate(-100 -140)">
<path d="${HAT.puffs}" fill="${CREAM}" fill-opacity="0.05"/><path d="${HAT.band}" fill="${CREAM}" fill-opacity="0.07"/>
${stroke(HAT.puffs, CREAM, 3.2, k)}${stroke(HAT.gather, CREAM, 2.2, k)}${stroke(HAT.band, CREAM, 3, k)}${nf ? stroke(NF, ORANGE, 3.4, 1.2) : ''}</g>`;
  const flask = `<g data-part="flask">
<path d="M61 228 Q100 233 139 228 L160 274 Q164 284 150 284 L50 284 Q36 284 40 274 Z" fill="${ORANGE}" fill-opacity="0.6"/>
${stroke('M61 228 Q100 233 139 228', ORANGE, 2.2, k)}
<circle cx="100" cy="266" r="4.5" fill="${CREAM}" fill-opacity="0.85"/>
${stroke('M76 144 Q81 145 82 150 L82 178 L40 272 Q35 286 52 286 L148 286 Q165 286 160 272 L118 178 L118 150 Q119 145 124 144', SAGE, 3.4, k)}
</g>`;
  return flask + hat;
}

// pad < 1 shrinks the mark about the centre of the square (maskable safe zone).
function svg({ k, nf, round, pad = 1 }) {
  const vb = [-9, 74, 218, 218];
  const c = vb[0] + 109, d = vb[1] + 109;
  const rx = round ? 41 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" role="img" aria-label="Neural Flavor">
<title>Neural Flavor</title>
<rect x="${vb[0]}" y="${vb[1]}" width="218" height="218" rx="${rx}" fill="${SLATE}"/>
<g transform="translate(${c} ${d}) scale(${pad}) translate(${-c} ${-d})">${mark({ k, nf })}</g>
</svg>
`;
}

writeFileSync(resolve(root, 'public/favicon.svg'), svg({ k: 2.4, nf: false, round: true }));

const jobs = [
  ['public/icons/icon-192.png', 192, { k: 1.6, nf: true, round: true }],
  ['public/icons/icon-512.png', 512, { k: 1.6, nf: true, round: true }],
  ['public/icons/icon-512-maskable.png', 512, { k: 1.6, nf: true, round: false, pad: 0.78 }],
  ['public/icons/apple-touch-icon.png', 180, { k: 1.6, nf: true, round: false }],
  ['public/logo.png', 640, { k: 1.6, nf: true, round: false }],
];
for (const [file, size, o] of jobs) {
  await sharp(Buffer.from(svg(o)), { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toFile(resolve(root, file));
  console.log(file, size);
}
