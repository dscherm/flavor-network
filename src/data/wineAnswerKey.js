/**
 * wineAnswerKey.js — sommelier answer keys for the Wine Lab ranker
 * (src/data/winePairing.js). Used by scripts/evalWinePairing.mjs and the
 * regression floor in src/data/__tests__/winePairing.test.js.
 *
 * ANSWER_KEY was written on 2026-11-07 BEFORE the ranker existed, from
 * standard sommelier pairings. Each dish lists every style a sommelier
 * would happily pour, not one right answer. Do not edit entries to make a
 * number go up; add dishes instead.
 */
export const ANSWER_KEY = {
  'beef-bourguignon': ['red-burgundy', 'pinot-noir-nw', 'cotes-du-rhone', 'merlot', 'bordeaux'],
  'coq-au-vin': ['red-burgundy', 'pinot-noir-nw', 'beaujolais', 'merlot'],
  'moules-marinieres': ['muscadet', 'chablis', 'albarino', 'sancerre', 'pinot-grigio'],
  'spaghetti-carbonara': ['pinot-grigio', 'vermentino', 'chablis', 'white-burgundy', 'barbera', 'champagne'],
  'margherita-pizza': ['chianti', 'barbera', 'valpolicella', 'lambrusco', 'montepulciano'],
  'beef-bolognese': ['chianti', 'barbera', 'montepulciano', 'valpolicella', 'cotes-du-rhone', 'merlot'],
  lasagna: ['chianti', 'montepulciano', 'barbera', 'valpolicella'],
  'risotto-saffron': ['white-burgundy', 'chablis', 'rhone-white', 'pinot-grigio', 'vermentino', 'champagne'],
  'pad-thai': ['riesling-offdry', 'gewurztraminer', 'riesling-dry', 'gruner', 'nz-sauvignon'],
  'thai-green-curry': ['riesling-offdry', 'gewurztraminer', 'viognier', 'riesling-dry'],
  'chicken-tikka': ['riesling-offdry', 'gewurztraminer', 'viognier', 'rosado'],
  'butter-chicken': ['riesling-offdry', 'gewurztraminer', 'viognier', 'rosado', 'chardonnay-oaked'],
  'bbq-ribs': ['zinfandel', 'shiraz', 'malbec', 'rosado'],
  cheeseburger: ['zinfandel', 'malbec', 'merlot', 'shiraz', 'cab-napa'],
  'clam-chowder': ['chardonnay-oaked', 'chablis', 'white-burgundy', 'muscadet'],
  tiramisu: ['vin-santo', 'moscato-dasti', 'tawny-port', 'madeira'],
  'chocolate-chip-cookies': ['tawny-port', 'ruby-port', 'madeira', 'vin-santo'],
  'apple-pie': ['sauternes', 'tokaji', 'moscato-dasti', 'madeira', 'chenin-blanc', 'tawny-port'],
  'creme-brulee': ['sauternes', 'tawny-port', 'tokaji', 'vin-santo'],
  baklava: ['tokaji', 'sauternes', 'madeira', 'tawny-port', 'vin-santo'],
  paella: ['albarino', 'rosado', 'cava', 'rioja', 'provence-rose'],
  gazpacho: ['fino-sherry', 'albarino', 'provence-rose', 'vinho-verde', 'sancerre'],
  'greek-salad': ['assyrtiko', 'sancerre', 'provence-rose', 'nz-sauvignon', 'vermentino'],
  moussaka: ['cotes-du-rhone', 'rioja', 'montepulciano', 'merlot', 'syrah-rhone'],
  'osso-buco': ['barolo', 'chianti', 'barbera', 'white-burgundy'],
  'tacos-al-pastor': ['riesling-offdry', 'rosado', 'zinfandel', 'gruner', 'malbec'],
  'mole-poblano': ['zinfandel', 'malbec', 'shiraz', 'rioja'],
  guacamole: ['nz-sauvignon', 'sancerre', 'vinho-verde', 'albarino', 'gruner'],
  'shrimp-ceviche': ['nz-sauvignon', 'albarino', 'vinho-verde', 'muscadet', 'sancerre', 'gruner'],
  'sushi-roll': ['riesling-dry', 'riesling-offdry', 'champagne', 'gruner', 'chablis', 'sparkling-rose'],
  'teriyaki-salmon': ['pinot-noir-nw', 'red-burgundy', 'riesling-offdry', 'sparkling-rose', 'beaujolais'],
  pho: ['riesling-offdry', 'gruner', 'beaujolais', 'pinot-noir-nw'],
  'mapo-tofu': ['riesling-offdry', 'gewurztraminer', 'beaujolais'],
  'lamb-kofta': ['rioja', 'syrah-rhone', 'cotes-du-rhone', 'malbec', 'rosado'],
  'chicken-shawarma': ['rosado', 'cotes-du-rhone', 'viognier', 'provence-rose', 'rioja'],
  bouillabaisse: ['provence-rose', 'rhone-white', 'albarino', 'vermentino'],
  'fried-chicken': ['champagne', 'cava', 'riesling-offdry', 'chardonnay-oaked', 'beaujolais', 'prosecco'],
  'mac-and-cheese': ['chardonnay-oaked', 'white-burgundy', 'champagne', 'beaujolais'],
  'french-onion-soup': ['beaujolais', 'red-burgundy', 'chablis', 'amontillado', 'cotes-du-rhone'],
  'caesar-salad': ['chablis', 'sancerre', 'champagne', 'pinot-grigio', 'cava', 'fino-sherry'],
  'quiche-lorraine': ['chablis', 'white-burgundy', 'gruner', 'riesling-dry', 'champagne'],
  'miso-ramen': ['riesling-offdry', 'gruner', 'amontillado', 'pinot-noir-nw', 'beaujolais'],
};

// HELD_OUT was written on 2026-11-07 after two tuning rounds had been run
// against ANSWER_KEY and before the third. It is scored but never tuned
// on: a change that helps ANSWER_KEY and hurts HELD_OUT is overfitting.
export const HELD_OUT = {
  'linguine-vongole': ['vermentino', 'pinot-grigio', 'muscadet', 'albarino', 'assyrtiko', 'chablis'],
  'pesto-genovese': ['vermentino', 'pinot-grigio', 'sancerre', 'gruner', 'nz-sauvignon'],
  'caprese-salad': ['vermentino', 'sancerre', 'provence-rose', 'pinot-grigio', 'prosecco'],
  'salade-nicoise': ['provence-rose', 'sancerre', 'rosado', 'albarino', 'vermentino'],
  ratatouille: ['provence-rose', 'cotes-du-rhone', 'rosado', 'beaujolais', 'rhone-white'],
  'tom-yum': ['riesling-offdry', 'gewurztraminer', 'gruner', 'nz-sauvignon'],
  'kung-pao-chicken': ['riesling-offdry', 'gewurztraminer', 'beaujolais', 'sparkling-rose'],
  'beef-bulgogi': ['pinot-noir-nw', 'zinfandel', 'beaujolais', 'riesling-offdry', 'rosado', 'shiraz'],
  'chana-masala': ['riesling-offdry', 'gewurztraminer', 'viognier', 'rosado', 'gruner'],
  'goan-fish-curry': ['riesling-offdry', 'viognier', 'gewurztraminer', 'chenin-blanc'],
  'chicken-enchiladas': ['rosado', 'zinfandel', 'beaujolais', 'riesling-offdry', 'malbec', 'gruner'],
  'pork-souvlaki': ['assyrtiko', 'provence-rose', 'rosado', 'beaujolais', 'cotes-du-rhone'],
  spanakopita: ['assyrtiko', 'sancerre', 'gruner', 'chablis', 'nz-sauvignon'],
  'tarte-tatin': ['sauternes', 'tokaji', 'chenin-blanc', 'moscato-dasti', 'madeira', 'tawny-port'],
  'panna-cotta': ['moscato-dasti', 'sauternes', 'tokaji', 'vin-santo'],
  laksa: ['riesling-offdry', 'gewurztraminer', 'viognier', 'gruner'],
};
