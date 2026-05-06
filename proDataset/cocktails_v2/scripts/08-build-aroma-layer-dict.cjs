#!/usr/bin/env node
/**
 * Cocktail Codex v2 — Phase 4: aroma layer dictionary (perfumery).
 *
 * Per Peterson's perfumer lens, every ingredient sits on one of three
 * volatility layers:
 *   top    — volatile, smelled first (citrus, herbs, soda, sambuca)
 *   middle — body / heart (spirit, vermouth, fruit liqueurs)
 *   bass   — lingering (amaro, syrups, cream, oak-aged spirits)
 *
 * Approach: derive layer from the slot dictionary (Phase 3) with
 * specific overrides for ingredients whose slot doesn't fully predict
 * their layer (e.g. Chartreuse is amaro_liqueur but acts as a middle
 * note; sambuca is amaro_liqueur but is firmly top).
 *
 * Inputs:
 *   proDataset/cocktails_v2/data/cocktail_ingredient_slots.csv
 *
 * Outputs:
 *   proDataset/cocktails_v2/data/cocktail_aroma_layers.csv
 *   proDataset/cocktails_v2/data/cocktail_aroma_layers_report.txt
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const SLOTS_CSV = path.join(ROOT, 'proDataset/cocktails_v2/data/cocktail_ingredient_slots.csv');
const OUT_DIR = path.join(ROOT, 'proDataset/cocktails_v2/data');
const CSV_PATH = path.join(OUT_DIR, 'cocktail_aroma_layers.csv');
const REPORT_PATH = path.join(OUT_DIR, 'cocktail_aroma_layers_report.txt');

// Default layer per slot (the easy cases)
const SLOT_DEFAULT_LAYER = {
  spirit: 'middle',
  sour: 'top',
  bitter: 'top',
  vermouth: 'middle',
  aromatic: 'top',
  sweet: 'bass',
  amaro_liqueur: 'bass',
  modifier: 'top', // most modifiers are sodas / tonic / sparkling — top
  '': null,
};

// Specific overrides where slot default doesn't fit. These take
// precedence over slot defaults.
const TOP_OVERRIDES = new Set([
  // Anise-family liqueurs are highly volatile
  'sambuca', 'anisette', 'pastis', 'pernod', 'ricard', 'absinthe', 'star anise',
  'black sambuca', 'fennel seed', 'caraway', 'kummel',
  // Floral / herbal liqueurs
  'st germain', 'st-germain', 'elderflower liqueur', 'creme de violette',
  'creme yvette',
  // Sodas and sparkling (modifier slot, but explicit top)
  'soda water', 'club soda', 'tonic water', 'tonic', 'ginger beer',
  'ginger ale', 'sparkling water', 'carbonated water', 'seltzer',
  'cold seltzer', 'cola', 'coca cola', 'coca-cola', 'coke', 'cold cola',
  'pepsi', 'pepsi cola', 'sprite', '7up', '7-up', 'mountain dew',
  'dr pepper', 'fresca', 'sarsaparilla', 'champagne', 'prosecco', 'cava',
  'sparkling wine', 'co2', 'co2 bottle',
  'mountain dew', 'red bull',
]);

const MIDDLE_OVERRIDES = new Set([
  // Spice/aromatic liqueurs that are middle (woody, body-of-drink)
  'chartreuse', 'green chartreuse', 'yellow chartreuse',
  'cointreau', 'triple sec', 'orange curacao', 'curacao', 'blue curacao',
  'dry curacao', 'maraschino', 'maraschino liqueur', 'luxardo maraschino',
  'cherry heering', 'heering', 'kirsch', 'kirschwasser',
  'benedictine', 'drambuie', 'galliano', 'falernum',
  'grand marnier', 'amaretto', 'disaronno', 'amaretto disaronno',
  // Fruit liqueurs are middle
  'creme de cassis', 'creme de mure', 'creme de framboise', 'creme de banana',
  'creme de pamplemousse', 'sloe gin', 'midori', 'apricot brandy',
  'peach brandy', 'cherry brandy',
  // Mid-body sweeteners
  'simple syrup', 'sugar syrup', 'cane sugar syrup', 'rich simple syrup',
  'gum syrup',
  // Aperitif wines / fortified that are middle (not bitter enough for bass)
  'lillet', 'lillet blanc', 'lillet rose', 'lillet rosé', 'kina lillet',
  'cocchi americano', 'americano bianco', 'cocchi torino', 'punt e mes',
  'punt e mes vermouth',
  // Beer/cider have body
  'beer', 'lager', 'pilsner', 'corona', 'budweiser', 'cider',
]);

const BASS_OVERRIDES = new Set([
  // Bass-leaning sweeteners (deep / aged)
  'demerara syrup', 'honey syrup', 'agave syrup', 'agave nectar', 'orgeat',
  'grenadine', 'maple syrup', 'pineapple gum syrup', 'raisin honey syrup',
  'white honey syrup', 'cinnamon syrup', 'spiced almond demerara gum syrup',
  'house grenadine', 'ginger syrup',
  // Cream / dairy / egg add bass weight
  'cream', 'heavy cream', 'whipping cream', 'half and half', 'half-and-half',
  'milk', 'coconut cream', 'coconut milk', 'egg', 'egg white', 'egg yolk',
  'whole egg', 'rumchata', 'baileys', 'irish cream', 'tia maria',
  // Coffee / cocoa / vanilla — long-tail bass
  'coffee', 'espresso', 'cold brew', 'cold coffee', 'iced coffee', 'tea',
  'green tea', 'matcha', 'kahlua', 'kahlúa', 'creme de cacao',
  'white creme de cacao', 'dark creme de cacao', 'creme de menthe',
  'green creme de menthe', 'white creme de menthe', 'cocoa powder',
  'hot chocolate', 'frangelico',
  // Bitter amaros — these linger on the palate
  'campari', 'aperol', 'fernet', 'fernet branca', 'fernet-branca', 'cynar',
  'suze', 'amaro nonino', 'amaro montenegro', 'amaro averna', 'averna',
  'amaro lucano', 'amaro ramazzotti', 'amaro nardini', 'amaro meletti',
  'braulio', 'zucca', 'salers', 'china china', 'china martini',
  'unicum', 'becherovka', 'amer picon', 'picon', 'malort', 'jeppson malort',
  // Heavy oak-aged / fortified
  'sherry', 'manzanilla', 'amontillado', 'oloroso sherry',
  'pedro ximenez sherry', 'cream sherry', 'fino sherry', 'amontillado sherry',
  'manzanilla sherry', 'palo cortado', 'palo cortado sherry',
  'puerto fino sherry', 'dry sack sherry', 'solera sherry',
  'port', 'tawny port', 'ruby port', 'white port',
  'madeira', 'rainwater madeira',
  // Dark spirits get a bass weighting
  'rum', 'dark rum', 'aged rum', 'spiced rum', 'demerara rum', 'jamaican rum',
  'navy rum', 'overproof rum', 'plantation rum', 'mezcal', 'mezcal joven',
  'islay scotch', 'peated scotch', 'aged whiskey', 'cognac', 'aged cognac',
  // Tabasco / worcestershire are saline/umami bass
  'tabasco', 'tabasco sauce', 'hot sauce', 'worcestershire',
  'worcestershire sauce', 'soy sauce', 'tomato juice',
]);

function classifyLayer(ingredient, slot) {
  if (TOP_OVERRIDES.has(ingredient)) return { layer: 'top', confidence: 'high', source: 'override-top' };
  if (MIDDLE_OVERRIDES.has(ingredient)) return { layer: 'middle', confidence: 'high', source: 'override-middle' };
  if (BASS_OVERRIDES.has(ingredient)) return { layer: 'bass', confidence: 'high', source: 'override-bass' };
  // Slot-based default
  const def = SLOT_DEFAULT_LAYER[slot || ''];
  if (def) return { layer: def, confidence: 'medium', source: `slot-default-${slot}` };
  return { layer: null, confidence: 'unknown', source: 'no-rule' };
}

function main() {
  const lines = fs.readFileSync(SLOTS_CSV, 'utf-8').split('\n');
  const header = lines[0];
  const rows = [];
  const layerStats = {};
  const confStats = { high: 0, medium: 0, unknown: 0 };
  const slotXLayer = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const m = line.match(/^"([^"]+)",([^,]*),([^,]*),(\d+)/);
    if (!m) continue;
    const [, ingredient, slot, slotConf, occ] = m;
    const cls = classifyLayer(ingredient, slot);
    rows.push({ ingredient, slot, layer: cls.layer || '', confidence: cls.confidence, source: cls.source, occurrences: parseInt(occ, 10) });
    if (cls.layer) layerStats[cls.layer] = (layerStats[cls.layer] || 0) + 1;
    confStats[cls.confidence]++;
    const key = `${slot || 'none'}/${cls.layer || 'none'}`;
    slotXLayer[key] = (slotXLayer[key] || 0) + 1;
  }

  const escape = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const csv = ['ingredient,slot,layer,confidence,source,occurrences'];
  for (const r of rows) {
    csv.push([escape(r.ingredient), r.slot, r.layer, r.confidence, escape(r.source), r.occurrences].join(','));
  }
  fs.writeFileSync(CSV_PATH, csv.join('\n'));

  const report = [];
  report.push('Cocktail v2 Phase 4 — aroma layer dictionary report');
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push(`Ingredients: ${rows.length}`);
  report.push('');
  report.push('Layer distribution:');
  for (const [k, v] of Object.entries(layerStats).sort((a, b) => b[1] - a[1])) report.push(`  ${k.padEnd(8)} ${v}`);
  report.push('');
  report.push('Confidence distribution:');
  for (const [k, v] of Object.entries(confStats)) report.push(`  ${k.padEnd(8)} ${v}`);
  report.push('');
  report.push('Slot × Layer crosstab:');
  for (const [k, v] of Object.entries(slotXLayer).sort()) report.push(`  ${k.padEnd(30)} ${v}`);
  fs.writeFileSync(REPORT_PATH, report.join('\n'));

  console.log(`Wrote ${rows.length} aroma-layer rows`);
  console.log(`Layers: ${JSON.stringify(layerStats)}`);
  console.log(`Confidence: ${JSON.stringify(confStats)}`);
}

main();
