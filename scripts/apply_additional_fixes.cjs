'use strict';
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('D:/Projects/flavor-network/public/proDataset/ingredients.json'));

const additionalFixes = [
  ['avocado', 'fruit', 'avocado is a fruit'],
  ['beetroot', 'vegetable', 'beet/beetroot is a vegetable'],
  ['beet', 'vegetable', 'beet is a vegetable'],
  ['cantaloupe', 'fruit', 'cantaloupe is a fruit'],
  ['currant', 'fruit', 'currant is a fruit'],
  ['durian', 'fruit', 'durian is a fruit'],
  ['edamame', 'vegetable', 'edamame (immature soybeans) is a vegetable'],
  ['fennel', 'vegetable', 'fennel is a vegetable'],
  ['fettuccine', 'grain', 'fettuccine is pasta'],
  ['honeydew', 'fruit', 'honeydew is a fruit'],
  ['hot sauce', 'condiment', 'hot sauce is a condiment'],
  ['jackfruit', 'fruit', 'jackfruit is a fruit'],
  ['jicama', 'vegetable', 'jicama is a vegetable'],
  ['lotus root', 'vegetable', 'lotus root is a vegetable'],
  ['lychee', 'fruit', 'lychee is a fruit'],
  ['macadamia', 'nut', 'macadamia is a nut'],
  ['mandarin', 'citrus', 'mandarin is citrus'],
  ['nectarine', 'fruit', 'nectarine is a fruit'],
  ['parsnip', 'vegetable', 'parsnip is a vegetable'],
  ['pumpkin', 'vegetable', 'pumpkin is a vegetable'],
  ['rambutan', 'fruit', 'rambutan is a fruit'],
  ['roasted garlic', 'aromatic', 'garlic is an aromatic'],
  ['rye', 'grain', 'rye is a grain'],
  ['savory', 'herb', 'savory is an herb'],
  ['self rising flour', 'grain', 'self-rising flour is a grain product'],
  ['seitan', 'protein', 'seitan is plant-based protein'],
  ['shelled edamame', 'vegetable', 'edamame is a vegetable'],
  ['shiso', 'herb', 'shiso is an herb'],
  ['spelt', 'grain', 'spelt is a grain'],
  ['starfruit', 'fruit', 'starfruit is a fruit'],
  ['summer savory', 'herb', 'savory is an herb'],
  ['vermicelli', 'grain', 'vermicelli is pasta/noodle'],
  ['whisky', 'spirit', 'whisky is a spirit'],
  ['winter savory', 'herb', 'savory is an herb'],
  ['worcestershire', 'condiment', 'worcestershire is a condiment'],
  ['agar', 'thickener', 'agar is a thickener/gelling agent'],
  ['brazil nut', 'nut', 'brazil nut is a nut'],
  ['butternut pumpkin', 'vegetable', 'butternut squash/pumpkin is a vegetable'],
  ['creme de cacao', 'liqueur', 'creme de cacao is a liqueur'],
  ['creme de banane', 'liqueur', 'creme de banane is a liqueur'],
  ['fennel pollen', 'spice', 'fennel pollen is a spice/seasoning'],
  ['fully ripe avocado', 'fruit', 'avocado is a fruit'],
  ['green chutney', 'condiment', 'chutney is a condiment'],
  ['hass avocado', 'fruit', 'avocado is a fruit'],
  ['mace', 'spice', 'mace is a spice'],
  ['orange blossom', 'spice', 'orange blossom water is a flavoring'],
  ['peppercorn', 'spice', 'peppercorn is a spice'],
  ['black peppercorn', 'spice', 'peppercorn is a spice'],
  ['white peppercorn', 'spice', 'peppercorn is a spice'],
  ['green peppercorn', 'spice', 'peppercorn is a spice'],
  ['pink peppercorn', 'spice', 'peppercorn is a spice'],
  ['sichuan peppercorn', 'spice', 'peppercorn is a spice'],
  ['pumpkin puree', 'vegetable', 'pumpkin puree is a vegetable product'],
  ['canadian whisky', 'spirit', 'whisky is a spirit'],
  ['finnish whisky', 'spirit', 'whisky is a spirit'],
  ['japanese whisky', 'spirit', 'whisky is a spirit'],
  ['malt whisky', 'spirit', 'whisky is a spirit'],
  ['anchovy filet', 'protein', 'anchovy is a protein/seafood'],
  ['anchovy fillet', 'protein', 'anchovy is a protein/seafood'],
  ['bluefish fillet', 'protein', 'bluefish is a protein/seafood'],
  ['silken tofu', 'protein', 'tofu is a plant protein'],
  ['extra-firm tofu', 'protein', 'tofu is a plant protein'],
  ['tofu', 'protein', 'tofu is a plant protein'],
  ['black pepper', 'spice', 'black pepper is a spice'],
  ['coconut water', 'liquid', 'coconut water is a liquid/beverage'],
  ['water chestnut', 'vegetable', 'water chestnut is a vegetable/corm'],
  ['sugar snap pea', 'vegetable', 'sugar snap pea is a vegetable'],
  ['gelatin', 'thickener', 'gelatin is a thickener'],
  ['unflavored gelatin', 'thickener', 'gelatin is a thickener'],
  ['unflavored gelatin powder', 'thickener', 'gelatin is a thickener'],
  ['gelatin mix', 'thickener', 'gelatin is a thickener'],
  ['gelatin powder', 'thickener', 'gelatin is a thickener'],
  ['gelatin sheet', 'thickener', 'gelatin is a thickener'],
  ['jello gelatin', 'thickener', 'jello/gelatin is a thickener'],
  ['flavored gelatin', 'thickener', 'gelatin is a thickener'],
  ['unflavored powdered gelatin', 'thickener', 'gelatin is a thickener'],
  ['o gelatin', 'thickener', 'gelatin is a thickener'],
  ['fruit pectin', 'thickener', 'pectin is a thickener/gelling agent'],
  ['liquid fruit pectin', 'thickener', 'pectin is a thickener'],
];

let changed = 0;
const skipped = [];
for (const [name, cat] of additionalFixes) {
  if (d[name]) {
    if (d[name].category !== cat) {
      console.log('FIX:', name, d[name].category, '->', cat);
      d[name].category = cat;
      changed++;
    }
  } else {
    skipped.push(name);
  }
}

console.log('\nTotal additional fixes:', changed);
if (skipped.length) console.log('Not found:', skipped.join(', '));
fs.writeFileSync('D:/Projects/flavor-network/public/proDataset/ingredients.json', JSON.stringify(d, null, 2));
console.log('Written.');
