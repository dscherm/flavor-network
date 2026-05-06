#!/usr/bin/env node
/**
 * Cocktail Codex v2 — Phase 3: build the structural-slot dictionary.
 *
 * Reads corpus_v2.json, extracts every unique ingredient that appears
 * in any cocktail, and assigns each to one of seven structural slots
 * (per spec §5.1):
 *   spirit | sweet | sour | bitter | vermouth | amaro_liqueur | aromatic
 *
 * Approach: deterministic name-pattern rules first; flag ambiguous /
 * unknown for manual review. Output is a CSV the user can edit by hand.
 *
 * Inputs:
 *   proDataset/cocktails_v2/raw/corpus_v2.json
 *
 * Outputs:
 *   proDataset/cocktails_v2/data/cocktail_ingredient_slots.csv
 *   proDataset/cocktails_v2/data/cocktail_ingredient_slots_report.txt
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const IN_PATH = path.join(ROOT, 'proDataset/cocktails_v2/raw/corpus_v2.json');
const OUT_DIR = path.join(ROOT, 'proDataset/cocktails_v2/data');
const CSV_PATH = path.join(OUT_DIR, 'cocktail_ingredient_slots.csv');
const REPORT_PATH = path.join(OUT_DIR, 'cocktail_ingredient_slots_report.txt');

// Slot detection rules. Order matters — first match wins.
// Each rule: { slot, confidence, regex | exact }
//
// "confidence" is the auto-classifier's signal:
//   high   = canonical match (e.g. "gin" → spirit)
//   medium = pattern match (e.g. "*-flavored vodka" → spirit)
//   low    = guess from category (e.g. anything ending in "liqueur" → amaro_liqueur)
//   unknown = no rule matched, flag for human review
const RULES = [
  // ── Measurement leak normalizer (low priority — applied last) ──
  // Strip leading measure tokens that occasionally leak from upstream
  // parsers, e.g. "1 ounce white creme de cacao". The regex captures
  // these but classifies based on the residue.
  // (Handled before classify() instead — see classify() below.)

  // ── Spirit ──────────────────────────────────────────────────────
  { slot: 'spirit', confidence: 'high', exact: ['gin', 'vodka', 'rum', 'tequila', 'mezcal', 'whiskey', 'whisky', 'bourbon', 'rye whiskey', 'rye', 'scotch', 'scotch whisky', 'scotch whiskey', 'irish whiskey', 'cognac', 'brandy', 'cachaca', 'cachaça', 'pisco', 'aguardiente', 'calvados', 'grappa', 'absinthe', 'genever', 'akvavit', 'aquavit', 'sherry', 'fino sherry', 'amontillado sherry', 'manzanilla sherry', 'oloroso sherry', 'pedro ximenez sherry', 'cream sherry', 'applejack', 'armagnac', 'bas-armagnac', 'bas armagnac', 'rhum agricole', 'rhum agricole blanc', 'cachaca', 'amburana cachaca', 'tequila reposado', 'tequila anejo', 'tequila blanco', 'mezcal joven', 'rainwater madeira', 'madeira', 'dry sack sherry', 'solera sherry', 'palo cortado', 'crown royal', 'jack daniels', 'jack daniel', 'jameson', 'bulleit', 'maker mark', 'bacardi', 'bacardi limon', 'havana club', 'el dorado', 'mount gay', 'plantation rum', 'flor de cana', 'el tesoro', 'don julio', 'patron', 'casamigos', 'tanqueray', 'beefeater', 'hendricks', 'plymouth gin', 'old tom gin', 'navy strength gin', 'genever', 'everclear', 'pisco quebranta', 'kirsch', 'eau de vie', 'eau-de-vie', 'akvavit', 'aquavit'] },
  { slot: 'spirit', confidence: 'high', regex: /^(white|gold|dark|spiced|aged|silver|añejo|anejo|reposado|blanco|navy|jamaican|demerara|martinique|agricole|overproof|151)\s+(rum|tequila|whiskey|whisky|bourbon|gin|vodka|rye|scotch|cognac|brandy)$/i },
  { slot: 'spirit', confidence: 'high', regex: /\b(rum|tequila|whiskey|whisky|bourbon|gin|vodka|rye|scotch|cognac|brandy|pisco|cachaca|cachaça|mezcal|grappa|absinthe|calvados)\b/i },
  { slot: 'spirit', confidence: 'medium', regex: /flavored\s+(vodka|gin|rum|whiskey)/i },
  { slot: 'spirit', confidence: 'medium', regex: /^(rye|bourbon|scotch|tequila|gin|vodka|rum|brandy|cognac|whisky|whiskey)\s/i },

  // ── Sour (citrus & acid) ────────────────────────────────────────
  { slot: 'sour', confidence: 'high', exact: ['lemon juice', 'lime juice', 'orange juice', 'grapefruit juice', 'yuzu juice', 'lemon', 'lime', 'orange', 'grapefruit', 'yuzu', 'fresh lemon juice', 'fresh lime juice', 'fresh orange juice', 'fresh grapefruit juice'] },
  { slot: 'sour', confidence: 'high', regex: /\b(lemon|lime|orange|grapefruit|yuzu|verjus)\s+(juice|juice\s+fresh|fresh|cordial|wedge)\b/i },
  { slot: 'sour', confidence: 'medium', regex: /^(lemon|lime|orange|grapefruit)$/i },
  { slot: 'sour', confidence: 'high', exact: ['lime cordial', 'lemon cordial'] }, // even though they're sweetened, the citrus dominates
  { slot: 'sour', confidence: 'medium', regex: /\bcitric acid\b|\bphosphoric acid\b|\bmalic acid\b|\blactic acid\b/i },

  // ── Sweet (syrups & sugars) ─────────────────────────────────────
  { slot: 'sweet', confidence: 'high', exact: ['simple syrup', 'sugar syrup', 'demerara syrup', 'honey syrup', 'agave syrup', 'agave nectar', 'orgeat', 'grenadine', 'gum syrup', 'cane sugar syrup', 'brown sugar', 'caster sugar', 'powdered sugar', 'sugar', 'sugar cube', 'rich simple syrup', 'maple syrup', 'pineapple gum syrup', 'raisin honey syrup', 'white honey syrup', 'ginger syrup', 'cinnamon syrup', 'spiced almond demerara gum syrup'] },
  { slot: 'sweet', confidence: 'medium', regex: /\bsyrup\b|\bnectar\b|\bcordial\b/i },
  { slot: 'sweet', confidence: 'medium', regex: /\b(honey|agave|sugar)\b/i },

  // ── Bitter (bitters) ────────────────────────────────────────────
  { slot: 'bitter', confidence: 'high', exact: ['angostura bitters', 'angostura', 'peychaud bitters', 'peychauds bitters', "peychaud's bitters", 'orange bitters', 'aromatic bitters', 'chocolate bitters', 'celery bitters', 'mole bitters', 'lavender bitters', 'cardamom bitters', 'tiki bitters'] },
  { slot: 'bitter', confidence: 'high', regex: /\bbitters\b/i },

  // ── Vermouth ────────────────────────────────────────────────────
  { slot: 'vermouth', confidence: 'high', exact: ['sweet vermouth', 'dry vermouth', 'blanc vermouth', 'bianco vermouth', 'rosso vermouth', 'red vermouth', 'white vermouth', 'punt e mes', 'punt e mes vermouth', 'cocchi americano', 'cocchi torino', 'lillet', 'lillet blanc', 'lillet rouge', 'lillet rosé', 'kina lillet'] },
  { slot: 'vermouth', confidence: 'high', regex: /\bvermouth\b/i },

  // ── Amaro / liqueur (modifiers) ─────────────────────────────────
  { slot: 'amaro_liqueur', confidence: 'high', exact: ['campari', 'aperol', 'fernet', 'fernet branca', 'fernet-branca', 'cynar', 'suze', 'amaro nonino', 'amaro montenegro', 'amaro averna', 'averna', 'amaro lucano', 'amaro ramazzotti', 'amaro nardini', 'amaro meletti', 'amaro abano', 'amaro angeleno', 'amaro ciociaro', 'china china', 'china martini', 'braulio', 'zucca', 'salers', 'gentian', 'maraschino', 'maraschino liqueur', 'luxardo maraschino', 'kirschwasser', 'chartreuse', 'green chartreuse', 'yellow chartreuse', 'benedictine', 'curacao', 'orange curacao', 'blue curacao', 'dry curacao', 'cointreau', 'grand marnier', 'triple sec', 'amaretto', 'frangelico', 'galliano', 'creme de cacao', 'white creme de cacao', 'dark creme de cacao', 'creme de menthe', 'white creme de menthe', 'green creme de menthe', 'creme de violette', 'creme de cassis', 'creme de mure', 'creme de framboise', 'creme yvette', 'st germain', 'st-germain', 'elderflower liqueur', 'sloe gin', 'pimms', "pimm's", "pimm's no 1", 'pimms no 1', 'midori', 'cynar 70', 'unicum', 'becherovka', 'kümmel', 'kummel', 'kahlua', 'kahlúa', 'sambuca', 'drambuie', 'southern comfort', 'jagermeister', 'jägermeister', 'goldschlager', 'goldschläger', 'falernum', 'hot damn', 'baileys', 'bailey irish cream', 'irish cream', 'tia maria', 'amaretto disaronno', 'disaronno', 'cherry heering', 'heering', 'amer picon', 'picon', 'old tom', 'kirsch', 'kirschwasser', 'rumchata', 'fireball', 'jeppson malort', 'malort', 'caraway liqueur', 'aniseed liqueur', 'pastis', 'pernod', 'ricard', 'sambuca black', 'tuaca', 'strega', 'creme de banana', 'creme de pamplemousse', 'velvet falernum', 'green tea liqueur', 'limoncello', 'lillet', 'cocchi americano', 'kina lillet', 'verjus rouge', 'rosolio', 'aperitivo', 'bitter red aperitif', 'rabarbaro'] },
  { slot: 'amaro_liqueur', confidence: 'medium', regex: /\bliqueur\b/i },
  { slot: 'amaro_liqueur', confidence: 'medium', regex: /\b(amaro|chartreuse|maraschino|benedictine|cointreau|curacao|curaçao)\b/i },
  { slot: 'amaro_liqueur', confidence: 'medium', regex: /\b(creme de|crème de)\b/i },

  // ── Wine / fortified (boundary) ─────────────────────────────────
  { slot: 'amaro_liqueur', confidence: 'medium', exact: ['port', 'tawny port', 'ruby port', 'white port', 'sherry', 'manzanilla', 'amontillado'] },
  { slot: 'amaro_liqueur', confidence: 'medium', regex: /\b(prosecco|champagne|cava|sparkling wine|wine)\b/i },

  // ── Aromatic (garnishes, herbs, spices, sauces) ─────────────────
  { slot: 'aromatic', confidence: 'high', exact: ['mint', 'fresh mint', 'mint leaves', 'mint sprig', 'basil', 'fresh basil', 'rosemary', 'thyme', 'sage', 'lemon peel', 'orange peel', 'lemon twist', 'orange twist', 'grapefruit peel', 'lime peel', 'cinnamon stick', 'cinnamon', 'nutmeg', 'cocktail cherry', 'maraschino cherry', 'maraschino cherries', 'cocktail onion', 'olive', 'olives', 'cucumber', 'salt rim', 'salted rim', 'salt', 'pepper', 'celery stalk', 'celery', 'edible flower', 'flower', 'vanilla extract', 'vanilla', 'cloves', 'clove', 'star anise', 'cardamom', 'allspice', 'ginger', 'fresh ginger', 'tabasco', 'tabasco sauce', 'hot sauce', 'worcestershire', 'worcestershire sauce', 'salt solution', 'sel gris solution', 'saline', 'saline solution', 'anis', 'anise', 'fennel seed', 'caraway', 'star fruit', 'lavender', 'chamomile', 'cardamom pod', 'pink peppercorn', 'black pepper', 'white pepper', 'horseradish', 'wasabi', 'tincture'] },
  { slot: 'aromatic', confidence: 'medium', regex: /\b(twist|peel|garnish|sprig|leaf|leaves)\b/i },
  { slot: 'aromatic', confidence: 'medium', regex: /\b(extract|tincture|essence|infusion|reduction)\b/i },
  { slot: 'aromatic', confidence: 'medium', regex: /\b(berries|fruits|herbs|spice|flower|petal|zest)\b/i },

  // ── Modifier / mixer (water-like, often non-flavor) ─────────────
  { slot: 'modifier', confidence: 'high', exact: ['soda water', 'club soda', 'tonic water', 'tonic', 'ginger beer', 'ginger ale', 'cola', 'coca cola', 'coca-cola', 'coke', 'cold cola', 'pepsi', 'pepsi cola', 'sprite', '7up', '7-up', 'surge', 'champagne', 'prosecco', 'sparkling water', 'carbonated water', 'seltzer', 'cold seltzer', 'water', 'still water', 'cream', 'heavy cream', 'whipping cream', 'half and half', 'half-and-half', 'milk', 'coconut cream', 'coconut milk', 'egg', 'egg white', 'egg yolk', 'whole egg', 'ice', 'crushed ice', 'cracked ice', 'beer', 'lager', 'corona', 'budweiser', 'pilsner', 'ipa', 'stout', 'guinness', 'cider', 'lemonade', 'fruit punch', 'sweet and sour', 'sour mix', 'kool-aid', 'zima', 'schweppes russchian', 'tomato juice', 'pineapple juice', 'cranberry juice', 'apple juice', 'pomegranate juice', 'cucumber juice', 'celery juice', 'beet juice', 'carrot juice', 'ginger juice', 'root beer', 'cold coffee', 'coffee', 'espresso', 'cold brew', 'iced coffee', 'iced tea', 'tea', 'green tea', 'black tea', 'matcha', 'red bull'] },
  { slot: 'modifier', confidence: 'medium', regex: /\b(soda|tonic|ginger\s*beer|ginger\s*ale|club|sparkling)\b/i },
  { slot: 'modifier', confidence: 'medium', regex: /\b(cream|milk|egg|yolk|albumen)\b/i },
  { slot: 'modifier', confidence: 'medium', regex: /\b(coffee|tea|cold brew|espresso|matcha)\b/i },
  { slot: 'modifier', confidence: 'medium', regex: /\b(juice|nectar|water|cola|beer|lager|stout|ale|cider|punch|lemonade|seltzer)\b/i },

  // ── Fruit (boundary slot — catch-all for fresh fruit) ──────────
  { slot: 'sour', confidence: 'low', regex: /\b(lemon|lime|orange|grapefruit|cranberry|pomegranate|passion\s*fruit|verjus)\b/i },
  { slot: 'sweet', confidence: 'low', regex: /\b(peach|raspberry|strawberry|strawberries|blueberry|pineapple|mango|banana|apple|pear|cherry|cherries|coconut|melon|watermelon|fig|figs|rose|blackberry|blackberries)\b/i },

  // ── Final batch: edge cases for ~67 remaining unknowns ─────────
  // Fortified / aperitif wines
  { slot: 'amaro_liqueur', confidence: 'medium', exact: ['dubonnet', 'dubonnet rouge', 'dubonnet blanc', 'lillet rose', 'lillet rosé', 'americano bianco', 'pineau des charentes', 'puerto fino sherry'] },
  { slot: 'amaro_liqueur', confidence: 'low', regex: /\b(chardonnay|riesling|sauvignon|pinot|moscato|gewurztraminer|gewürztraminer|chenin|verdejo)\b/i },
  // Branded niche liqueurs / schnapps / spirits
  { slot: 'amaro_liqueur', confidence: 'medium', exact: ['advocaat', 'anisette', 'butterscotch schnapps', 'pisang ambon', 'apfelkorn', 'passoa', 'black sambuca', 'wormwood', 'sirup of roses', 'cherry heering'] },
  { slot: 'amaro_liqueur', confidence: 'medium', regex: /\bschnapps\b/i },
  // Branded spirits (vodka aliases, fortified)
  { slot: 'spirit', confidence: 'medium', exact: ['absolut peppar', 'absolut citron', 'absolut kurant', 'singani', 'aged rhum agricole', 'grain alcohol', 'firewater'] },
  // Branded sodas / mixers
  { slot: 'modifier', confidence: 'medium', exact: ['mountain dew', 'dr pepper', 'fresca', 'sarsaparilla', 'co2', 'co2 bottle', 'hot chocolate', 'cocoa powder', 'caramel coloring', 'soy sauce', 'olive brine', 'pina colada mix', 'daiquiri mix', 'basic bloody mary mix', 'tom and jerry batter', 'house grenadine', 'oreo cookie', 'rumchata'] },
  // Sweet/sour and sweetener fallthroughs
  { slot: 'sweet', confidence: 'medium', regex: /\b(sirup|nectar|cordial|grenadine)\b/i },
  // Aromatic / spice catch-all
  { slot: 'aromatic', confidence: 'medium', regex: /\b(chili|chile|red\s*chili|pepper\s*flakes|chili\s*flakes|spear|brine|salt|wedge|slices?)\b/i },
  // Verjus is a citrus-acid juice
  { slot: 'sour', confidence: 'high', exact: ['verjus blanc', 'verjus rouge'] },
];

function normalizeName(name) {
  return name
    .toLowerCase()
    // Decompose accented characters (é → e + combining mark), then strip
    // the combining marks so "bénédictine" → "benedictine" instead of
    // "bndictine" (the [^\w] regex below was eating the é entirely).
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’'`]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Strip leading measurement tokens that occasionally leak into the
// ingredient name from upstream parsers, e.g. "1 ounce X" → "X" or
// "2 dashes X" → "X".
function stripMeasureLeak(name) {
  return name
    .replace(/^\d+(\.\d+)?\s*\/\s*\d+/, '') // "1/2"
    .replace(/^\d+(\.\d+)?\s*(oz|ounce|ml|cl|dash|dashes|drop|drops|splash|splashes|barspoon|tsp|tablespoon|tbsp|part|parts|cup|cups|pint|pints)\s+/i, '')
    .trim();
}

function classify(rawName) {
  let name = normalizeName(rawName);
  if (!name) return { slot: null, confidence: 'unknown', rule: 'empty' };
  // First try as-is, then with measurement prefix stripped.
  for (const candidate of [name, stripMeasureLeak(name)]) {
    if (!candidate) continue;
    for (const r of RULES) {
      if (r.exact && r.exact.includes(candidate)) {
        return { slot: r.slot, confidence: r.confidence, rule: `exact:${candidate}` };
      }
      if (r.regex && r.regex.test(candidate)) {
        return { slot: r.slot, confidence: r.confidence, rule: `regex:${r.regex.source.slice(0, 40)}` };
      }
    }
  }
  return { slot: null, confidence: 'unknown', rule: 'no-match' };
}

function main() {
  const data = JSON.parse(fs.readFileSync(IN_PATH, 'utf-8'));
  const ingredientCounts = new Map();
  const ingredientFirstSeen = new Map();

  for (const c of data.cocktails) {
    for (const ing of c.ingredients_raw || []) {
      const name = normalizeName(ing.name || ing.raw || '');
      if (!name) continue;
      ingredientCounts.set(name, (ingredientCounts.get(name) || 0) + 1);
      if (!ingredientFirstSeen.has(name)) ingredientFirstSeen.set(name, c.name);
    }
  }

  const rows = [];
  const stats = { high: 0, medium: 0, low: 0, unknown: 0 };
  const slotStats = {};

  for (const [name, count] of [...ingredientCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const r = classify(name);
    rows.push({
      ingredient: name,
      slot: r.slot || '',
      confidence: r.confidence,
      occurrences: count,
      rule: r.rule,
      first_cocktail: ingredientFirstSeen.get(name) || '',
    });
    stats[r.confidence] = (stats[r.confidence] || 0) + 1;
    if (r.slot) slotStats[r.slot] = (slotStats[r.slot] || 0) + 1;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  // CSV output: ingredient,slot,confidence,occurrences,rule,first_cocktail
  const csv = ['ingredient,slot,confidence,occurrences,rule,first_cocktail'];
  for (const r of rows) {
    const escape = (s) => `"${String(s).replace(/"/g, '""')}"`;
    csv.push([escape(r.ingredient), r.slot, r.confidence, r.occurrences, escape(r.rule), escape(r.first_cocktail)].join(','));
  }
  fs.writeFileSync(CSV_PATH, csv.join('\n'));

  // Report
  const lines = [];
  lines.push('Cocktail v2 Phase 3 — slot dictionary report');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Unique ingredients across ${data.cocktails.length} cocktails: ${rows.length}`);
  lines.push('');
  lines.push('Confidence distribution:');
  for (const [k, v] of Object.entries(stats)) lines.push(`  ${k.padEnd(8)} ${v}`);
  lines.push('');
  lines.push('Slot distribution:');
  for (const [k, v] of Object.entries(slotStats).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${k.padEnd(15)} ${v}`);
  }
  lines.push('');
  lines.push('--- UNKNOWN ingredients (need manual review) ---');
  const unknowns = rows.filter((r) => r.confidence === 'unknown').sort((a, b) => b.occurrences - a.occurrences);
  for (const u of unknowns) {
    lines.push(`  ${u.occurrences.toString().padStart(4)}× ${u.ingredient.padEnd(35)} (e.g. ${u.first_cocktail})`);
  }
  lines.push('');
  lines.push('--- LOW confidence (verify) ---');
  const lows = rows.filter((r) => r.confidence === 'low').sort((a, b) => b.occurrences - a.occurrences);
  for (const u of lows.slice(0, 30)) {
    lines.push(`  ${u.occurrences.toString().padStart(4)}× ${u.ingredient.padEnd(35)} -> ${u.slot}  (e.g. ${u.first_cocktail})`);
  }
  fs.writeFileSync(REPORT_PATH, lines.join('\n'));

  console.log(`Wrote ${rows.length} ingredient classifications to ${CSV_PATH}`);
  console.log(`Confidence: high=${stats.high} medium=${stats.medium} low=${stats.low} unknown=${stats.unknown}`);
  console.log(`Report at ${REPORT_PATH}`);
}

main();
