// Render a synthetic recipe PNG for end-to-end testing the import
// endpoint without needing a real photo on disk.
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000">
  <rect width="800" height="1000" fill="#ffffff"/>
  <style>
    .title { font: 700 32px sans-serif; fill: #111; }
    .h     { font: 700 22px sans-serif; fill: #111; }
    .body  { font: 18px sans-serif; fill: #222; }
  </style>
  <text x="50" y="60"  class="title">Classic Whiskey Sour</text>
  <text x="50" y="110" class="body">Serves 1 · Prep 2 min · Total 3 min</text>

  <text x="50" y="170" class="h">Ingredients</text>
  <text x="50" y="205" class="body">2 oz bourbon</text>
  <text x="50" y="235" class="body">3/4 oz fresh lemon juice</text>
  <text x="50" y="265" class="body">3/4 oz simple syrup</text>
  <text x="50" y="295" class="body">1 egg white (optional)</text>
  <text x="50" y="325" class="body">Garnish: lemon peel and brandied cherry</text>

  <text x="50" y="395" class="h">Instructions</text>
  <text x="50" y="430" class="body">1. Add bourbon, lemon juice, simple syrup, and egg white</text>
  <text x="50" y="455" class="body">   to a shaker without ice. Dry-shake for 15 seconds.</text>
  <text x="50" y="495" class="body">2. Add ice and shake again until well-chilled.</text>
  <text x="50" y="535" class="body">3. Strain into a chilled rocks glass over fresh ice.</text>
  <text x="50" y="575" class="body">4. Garnish with the lemon peel and a brandied cherry.</text>
</svg>
`;

await sharp(Buffer.from(svg)).png().toFile('.playwright-shots/test-recipe.png');
console.log('Wrote .playwright-shots/test-recipe.png');
