/**
 * flavorAromas.js: a hand-tuned table of what each important ingredient SMELLS of, on the ELEVEN aroma axes of the
 * flavor chart, and how far a small amount of it perfumes a dish. First written for six axes (FLAVOR-5, 2026-11-16),
 * widened to eleven and every line re-read (AROMA-3, 2026-11-15).
 *
 * WRITTEN BY THE AI ASSISTANT from common culinary and bartending knowledge. NOT independently checked by a cook or a
 * professional: every number is a judgement. It has been compared with a SECOND source of aroma labels
 * (public/proDataset/flavor_profiles_distilled.json, mostly AI-written too; `node scripts/checkAromaAgreement.mjs
 * --axes eleven`), which is a second opinion, not ground truth. Correct any line you disagree with (how to, just below).
 *
 * WHY IT EXISTS. The model's aroma values were one identical row for 2,062 of 3,432 ingredients, and the published
 * aroma descriptors in gnn_compounds.json turned out not to describe ingredients (docs/flavor-profile.md, "Aroma data
 * assessment"). So the aroma half of every chart comes from this table, the way the taste half comes from
 * flavorStrengths.js. An ingredient with no line here has NO aroma data: it is not counted for aroma and the chart is
 * drawn from the others. (A line here does not need a line in the strength table: taste and aroma are judged apart.)
 *
 * WHY ELEVEN. A blind answer key written before the table was read expected, for 38 of 114 items, aromas the six
 * axes could not show (roasted, nutty, earthy, smoky, savory), and the table used "woody" as a stand-in for roast,
 * nuts and smoke, and had no honest home for fish sauce, anchovy, mushrooms or coffee. See docs/flavor-profile.md,
 * "Aromas on eleven axes".
 *
 * THE AXES (the chart's ids are odor_fruity ... odor_savory; the lines below drop the prefix):
 *   fruity  citrus, berries, orchard and tropical fruit, fruity esters (rum, brandy, wine, orange liqueur)
 *   floral  rose, lavender, violet, elderflower, jasmine, hibiscus, chamomile, honey
 *   green   fresh herbs (mint, basil, parsley, cilantro, dill), cut grass, leafy and raw vegetables, juniper, anise-green,
 *           fresh chili and green pepper, onion and garlic. Mint is green, not its own axis.
 *   woody   oak, vanilla, resin and the dry-wood family (cask, cedar, rosemary, tobacco). Vanilla is woody (decided
 *           2026-11-16 before the aroma test set was tuned). Roast, caramel, nuts, smoke and soil now have their own axes.
 *   spicy   the aroma of aromatic spice: cinnamon, clove, nutmeg, cardamom, black pepper, ginger, cumin, anise,
 *           caraway. NOT chili heat: heat is a TASTE axis (flavorStrengths.js). The chart labels this axis "Spice".
 *   fatty   dairy fat, butter, cream, egg, coconut, rich oils and meats (the app calls it "creamy")
 *   toasty  roasted, caramelised, baked, browned: coffee, cocoa, caramel, brown sugar, maple, malt, toast, roast
 *   nutty   nuts and seeds, almond, sesame, brown butter, sherry, aged cheese
 *   earthy  mushroom, truffle, beet, root vegetables, soil, bitter roots (gentian), turmeric, cumin
 *   smoky   wood smoke, mezcal, peated whisky, smoked paprika, bacon, chipotle, liquid smoke
 *   savory  meaty, marine, fermented and aged: fish sauce, anchovy, soy, miso, parmesan, stocks, shellfish, cured meats
 *
 * THE LINE, one per ingredient: { fruity, floral, green, woody, spicy, fatty, toasty, nutty, earthy, smoky, savory, potency }
 *   Each axis is 0..3 and means "how strongly THIS ingredient smells of it, per gram" (0, leave it out: none;
 *   1 faint, in the background; 2 clear; 3 what the ingredient IS: mint is green 3, fish sauce is savory 3).
 *   potency: how many grams of an ordinary ingredient ONE gram of this counts as for AROMA. 1 = ordinary.
 *     above 1 = a little perfumes a lot: mint leaf 10, cloves 8, vanilla 6, rose water 8, saffron 12, citrus peel 2 to 3,
 *               ground spices 3 to 5, bitters 5 to 6, truffle 8, fish sauce 2.5, soy sauce 2
 *     below 1 = mostly water or alcohol with a mild smell: base spirits 0.5 to 0.7, wine 0.7, milk 0.8, stocks 0.7
 *     0       = no aroma worth charting (water, sugar, salt, flour, vodka, egg white). It still counts as an
 *               ingredient with data, and it waters a dish down a little (AROMALESS_WEIGHT in flavorAroma.js).
 *   An entry with none of the eleven axes is aromaless whatever its potency; write potency: 0 to say so.
 *   Where a thing is smelly but on no axis (garlic's sulphur), it is written with the nearest axis at a low strength;
 *   the chart is about eleven families, not all of smell. Cooking-method aromas (browning, frying) are NOT in the
 *   table: a line says what the ingredient smells of raw or as bought, and the chart does not know how it is cooked.
 *
 * HOW A CHART IS WORKED OUT (flavorAroma.js): for each axis, the sum over ingredients of grams x potency x strength/3,
 * divided by the sum of grams x potency (an aromaless ingredient counts at grams x AROMALESS_WEIGHT instead).
 *
 * HOW TO CORRECT A LINE: edit the numbers on its line below (keep the name exactly as spelled: it is the app's own
 * ingredient name), then run `node scripts/checkAromaAgreement.mjs --axes eleven` (a new disagreement with the second
 * source must be fixed or recorded with a reason in data/review/aroma-accepted.json), `npm run measure:flavor --
 * --aroma-blind --axes eleven --no-holdout-detail` and `npm test -- flavorAromas`, and look at the recipes you care
 * about. Do not add a line to make one recipe come out right: ask whether a cook would agree with the line on its own.
 * A name that is not an ingredient in the app's data fails the test on purpose (list bottles and garnish keys that the
 * graph does not hold in NOT_IN_GRAPH_AROMA).
 */

/** Names the table may use that are not ingredients in the curated graph: bar bottles and mixers. */
export const NOT_IN_GRAPH_AROMA = [
  'licor 43', 'averna', 'genepy', 'strega', 'amarula', 'goldwasser', 'herbal liqueur', 'amaro', 'pastis', 'soju',
  'kirsch', 'slivovitz', 'creme de violette', 'creme de mure', 'creme de peche', 'seltzer', 'club soda',
];

export const AROMAS = {
  // ── Base spirits ───────────────────────────────────────────────────────────────────────────────────
  gin: { woody: 1.3, green: 1.2, fruity: 1.1, spicy: 0.9, floral: 0.5, potency: 0.7 },
  vodka: { potency: 0 },
  rum: { fruity: 1.2, toasty: 1.2, woody: 0.6, potency: 0.7 },
  whiskey: { woody: 2, toasty: 1, fruity: 0.6, spicy: 0.4, potency: 0.7 },
  bourbon: { woody: 2.2, toasty: 1.2, fruity: 0.6, spicy: 0.5, potency: 0.7 },
  rye: { woody: 1.8, spicy: 1.2, toasty: 0.6, fruity: 0.4, potency: 0.7 },
  'rye whiskey': { woody: 1.8, spicy: 1.2, toasty: 0.6, fruity: 0.4, potency: 0.7 },
  scotch: { woody: 2, smoky: 0.8, toasty: 0.5, fruity: 0.5, potency: 0.7 },
  whisky: { woody: 1.8, toasty: 0.6, fruity: 0.6, smoky: 0.4, floral: 0.4, potency: 0.7 },
  'japanese whisky': { woody: 1.8, toasty: 0.6, fruity: 0.6, smoky: 0.4, floral: 0.4, potency: 0.7 },
  tequila: { green: 1.2, fruity: 0.6, earthy: 0.5, spicy: 0.5, potency: 0.6 },
  mezcal: { smoky: 2.4, earthy: 1.2, green: 1, woody: 0.5, potency: 0.7 },
  brandy: { fruity: 1.5, woody: 1.5, toasty: 0.6, floral: 0.4, potency: 0.7 },
  cognac: { fruity: 1.5, woody: 1.5, toasty: 0.6, floral: 0.4, potency: 0.7 },
  'apple brandy': { fruity: 2, woody: 1, potency: 0.7 },
  applejack: { fruity: 2, woody: 1, potency: 0.7 },
  'pear brandy': { fruity: 2.2, potency: 0.7 },
  pisco: { fruity: 1.5, floral: 1, potency: 0.7 },
  cachaca: { green: 1, fruity: 1, potency: 0.7 },
  aquavit: { spicy: 2, green: 0.6, potency: 0.8 },
  ouzo: { spicy: 2.2, green: 0.8, potency: 1.2 },
  pastis: { spicy: 2.2, green: 0.8, potency: 1.2 },
  absinthe: { spicy: 2.5, green: 1.5, floral: 0.5, potency: 3 },
  soju: { potency: 0 },
  kirsch: { fruity: 2, potency: 0.8 },
  slivovitz: { fruity: 1.8, potency: 0.8 },
  spirit: { woody: 0.5, potency: 0.5 },
  sake: { fruity: 1, floral: 1, savory: 1, potency: 0.6 },
  mirin: { savory: 0.7, toasty: 0.7, fruity: 0.5, potency: 0.6 },
  'shaoxing wine': { nutty: 1.2, savory: 0.8, fruity: 0.6, woody: 0.4, potency: 0.8 },

  // ── Wine, vermouth, fortified wine, beer ────────────────────────────────────────────────────────
  'white wine': { fruity: 1.5, floral: 0.6, potency: 0.7 },
  'red wine': { fruity: 1.5, woody: 1, spicy: 0.4, earthy: 0.4, potency: 0.8 },
  wine: { fruity: 1.5, woody: 0.5, potency: 0.7 },
  champagne: { fruity: 1.2, floral: 0.4, toasty: 0.4, potency: 0.6 },
  prosecco: { fruity: 1.2, floral: 0.4, potency: 0.6 },
  'sparkling wine': { fruity: 1.2, floral: 0.4, potency: 0.6 },
  'sweet vermouth': { woody: 1.1, spicy: 1, fruity: 0.7, toasty: 0.6, green: 0.6, floral: 0.4, potency: 0.9 },
  'dry vermouth': { green: 1, floral: 1, spicy: 0.6, potency: 0.9 },
  vermouth: { floral: 1.2, green: 0.8, spicy: 0.7, fruity: 0.4, woody: 0.4, potency: 0.9 },
  'lillet blanc': { fruity: 1.2, floral: 0.8, potency: 0.8 },
  sherry: { nutty: 1.6, woody: 0.6, fruity: 0.6, potency: 0.8 },
  'cream sherry': { nutty: 1.4, toasty: 1.4, fruity: 0.8, woody: 0.4, potency: 0.9 },
  port: { fruity: 1.5, woody: 1, toasty: 0.5, potency: 0.9 },
  'madeira wine': { toasty: 1.4, nutty: 1, fruity: 0.8, woody: 0.5, potency: 0.9 },
  beer: { toasty: 0.9, savory: 0.9, green: 0.8, fruity: 0.4, potency: 0.5 },

  // ── Liqueurs, amari, aperitifs ───────────────────────────────────────────────────────────────────
  liqueur: { fruity: 1, potency: 1 },
  'herbal liqueur': { green: 1.8, spicy: 1, floral: 0.6, potency: 1.4 },
  'triple sec': { fruity: 2.5, potency: 1.4 },
  'orange liqueur': { fruity: 2.5, potency: 1.4 },
  cointreau: { fruity: 2.5, potency: 1.4 },
  'grand marnier': { fruity: 2.3, woody: 0.8, potency: 1.4 },
  'orange curacao': { fruity: 2.5, potency: 1.4 },
  'blue curacao': { fruity: 2, potency: 1.2 },
  'maraschino liqueur': { fruity: 1.8, nutty: 0.8, floral: 0.4, woody: 0.3, potency: 1.4 },
  amaretto: { nutty: 2, toasty: 0.8, fruity: 0.8, potency: 1.3 },
  kahlua: { toasty: 2.2, woody: 0.6, potency: 1.3 },
  'coffee liqueur': { toasty: 2.2, woody: 0.6, potency: 1.3 },
  'baileys irish cream': { fatty: 2, toasty: 1, woody: 0.5, potency: 1.2 },
  'irish cream': { fatty: 2, toasty: 1, woody: 0.5, potency: 1.2 },
  amarula: { fatty: 1.5, fruity: 1, toasty: 0.8, woody: 0.4, potency: 1.2 },
  'licor 43': { woody: 1.5, fruity: 1.2, toasty: 0.5, spicy: 0.5, potency: 1.3 },
  'creme de cacao': { toasty: 1.8, woody: 0.6, potency: 1.3 },
  'creme de cassis': { fruity: 2.8, potency: 1.4 },
  'creme de violette': { floral: 3, potency: 1.5 },
  'creme de mure': { fruity: 2.6, potency: 1.4 },
  'creme de peche': { fruity: 2.6, potency: 1.4 },
  'banana liqueur': { fruity: 2.8, potency: 1.4 },
  'creme de banane': { fruity: 2.8, potency: 1.4 },
  'raspberry liqueur': { fruity: 2.8, potency: 1.4 },
  'peach schnapps': { fruity: 2.6, potency: 1.3 },
  'peppermint schnapp': { green: 2.5, potency: 1.5 },
  'apricot brandy': { fruity: 2.4, potency: 1.3 },
  'cherry brandy': { fruity: 2.4, potency: 1.3 },
  limoncello: { fruity: 2.8, potency: 1.4 },
  'southern comfort': { fruity: 1.5, woody: 0.8, spicy: 0.5, potency: 1.1 },
  goldwasser: { spicy: 1.5, fruity: 1, potency: 1.2 },
  'sloe gin': { fruity: 2, potency: 1.1 },
  drambuie: { woody: 1.2, spicy: 1.2, toasty: 0.6, fruity: 0.6, potency: 1.3 },
  sambuca: { spicy: 2.2, potency: 1.3 },
  'melon liqueur': { fruity: 2.5, potency: 1.4 },
  'fernet branca': { green: 1.8, spicy: 1.2, woody: 0.8, earthy: 0.6, potency: 2 },
  gentian: { earthy: 2, woody: 1.2, green: 0.8, potency: 2 },
  benedictine: { spicy: 1.5, green: 1.2, floral: 0.6, woody: 0.6, potency: 1.5 },
  'green chartreuse': { green: 2.2, spicy: 1.5, floral: 0.6, potency: 1.8 },
  'yellow chartreuse': { spicy: 1.6, floral: 1, green: 1, potency: 1.5 },
  galliano: { spicy: 1.2, floral: 1, green: 1, woody: 0.8, potency: 1.4 },
  strega: { floral: 1, spicy: 1.5, green: 1, potency: 1.4 },
  falernum: { spicy: 1.8, fruity: 1, nutty: 0.6, woody: 0.3, potency: 1.4 },
  'elderflower cordial': { floral: 2.8, fruity: 0.5, potency: 1.5 },
  elderflower: { floral: 2.6, fruity: 0.6, potency: 2 },
  'orange blossom': { floral: 2.8, fruity: 1, potency: 3 },
  campari: { fruity: 1.5, green: 1, spicy: 0.8, potency: 1.5 },
  aperol: { fruity: 2, green: 0.6, floral: 0.4, potency: 1.4 },
  'amaro montenegro': { fruity: 1, floral: 1, spicy: 1, green: 1, woody: 0.6, potency: 1.4 },
  amaro: { woody: 1.2, earthy: 1.2, green: 1, fruity: 0.8, spicy: 0.8, toasty: 0.6, potency: 1.4 },
  averna: { toasty: 1.3, woody: 1, fruity: 1, spicy: 0.8, earthy: 0.6, potency: 1.4 },
  cynar: { green: 1.8, earthy: 1.5, woody: 1, toasty: 0.6, potency: 1.4 },
  suze: { floral: 1.5, green: 1.5, potency: 1.5 },
  jagermeister: { spicy: 1.5, woody: 1, green: 0.8, toasty: 0.5, fruity: 0.4, potency: 1.4 },
  genepy: { green: 2, floral: 1, potency: 1.5 },

  // ── Bitters ────────────────────────────────────────────────────────────────────────────────────────
  bitters: { spicy: 2, woody: 1.5, earthy: 0.8, fruity: 0.6, potency: 6 },
  'angostura bitters': { spicy: 2, woody: 1.5, earthy: 0.8, fruity: 0.6, potency: 6 },
  'orange bitters': { fruity: 2.5, spicy: 1, potency: 5 },
  "peychaud's bitters": { floral: 1, spicy: 1.5, fruity: 1, potency: 5 },

  // ── Citrus and other juices and fruit ────────────────────────────────────────────────────────────
  'lemon juice': { fruity: 2.3, potency: 1.5 },
  'lime juice': { fruity: 2.2, green: 0.5, potency: 1.5 },
  lemon: { fruity: 3, potency: 2.2 },
  lime: { fruity: 2.8, green: 0.5, potency: 2 },
  orange: { fruity: 3, potency: 1.8 },
  'orange juice': { fruity: 2.3, potency: 1.2 },
  'grapefruit juice': { fruity: 2.3, green: 0.4, potency: 1.3 },
  'pineapple juice': { fruity: 2.5, potency: 1.2 },
  'cranberry juice': { fruity: 1.8, potency: 1 },
  'apple juice': { fruity: 2, potency: 0.9 },
  'grape juice': { fruity: 2, floral: 0.3, potency: 0.9 },
  'tomato juice': { fruity: 1, green: 0.9, savory: 0.4, potency: 0.8 },
  lemonade: { fruity: 1.6, potency: 0.6 },
  juice: { fruity: 2, potency: 1 },
  fruit: { fruity: 2.2, potency: 1.2 },
  'maraschino cherry': { fruity: 2, potency: 1 },
  cherry: { fruity: 2.2, potency: 1 },
  pineapple: { fruity: 2.8, potency: 1.3 },
  strawberry: { fruity: 3, floral: 0.3, potency: 1.5 },
  raspberry: { fruity: 2.8, floral: 0.4, potency: 1.5 },
  blueberry: { fruity: 2.4, potency: 1.2 },
  blackberry: { fruity: 2.6, potency: 1.3 },
  banana: { fruity: 3, potency: 1.5 },
  apple: { fruity: 2.4, green: 0.4, potency: 1 },
  pear: { fruity: 2.2, floral: 0.3, potency: 1 },
  peach: { fruity: 2.6, floral: 0.3, potency: 1.2 },
  apricot: { fruity: 2.4, floral: 0.3, potency: 1.2 },
  mango: { fruity: 3, potency: 1.5 },
  grapefruit: { fruity: 2.8, green: 0.4, potency: 1.8 },
  'passion fruit': { fruity: 3, potency: 1.8 },
  watermelon: { fruity: 1.8, green: 1, potency: 0.6 },
  melon: { fruity: 1.8, green: 1, potency: 0.6 },
  fig: { fruity: 1.5, green: 0.6, toasty: 0.3, potency: 1 },
  raisin: { fruity: 1.5, toasty: 0.8, potency: 1 },
  cranberry: { fruity: 1.8, potency: 1 },
  yuzu: { fruity: 3, floral: 0.4, potency: 2 },

  // ── Sweeteners and syrups (sugar itself has no smell) ───────────────────────────────────────────
  'simple syrup': { potency: 0 },
  syrup: { potency: 0 },
  'honey syrup': { floral: 1, fruity: 0.4, potency: 0.6 },
  'cinnamon syrup': { spicy: 2.5, potency: 1.2 },
  'ginger syrup': { spicy: 2.2, potency: 1.2 },
  sugar: { potency: 0 },
  'powdered sugar': { potency: 0 },
  'cane sugar': { potency: 0 },
  'brown sugar': { toasty: 1.4, potency: 0.8 },
  'palm sugar': { toasty: 1.2, earthy: 0.4, potency: 0.8 },
  honey: { floral: 1.2, toasty: 0.5, potency: 1 },
  'maple syrup': { toasty: 1.8, woody: 0.8, potency: 1 },
  'agave syrup': { potency: 0 },
  'raspberry syrup': { fruity: 2.5, potency: 1.2 },
  grenadine: { fruity: 2, potency: 1 },
  'almond syrup': { nutty: 1.8, floral: 0.6, toasty: 0.3, potency: 1.2 },
  molasses: { toasty: 2, woody: 0.8, smoky: 0.4, potency: 1.5 },
  caramel: { toasty: 2.8, fatty: 0.8, potency: 1.2 },

  // ── Sodas, mixers, water ──────────────────────────────────────────────────────────────────────────
  'soda water': { potency: 0 },
  'club soda': { potency: 0 },
  seltzer: { potency: 0 },
  water: { potency: 0 },
  'tonic water': { fruity: 0.5, green: 0.4, potency: 0.5 },
  'ginger ale': { spicy: 1.2, fruity: 0.5, potency: 0.6 },
  'ginger beer': { spicy: 2, potency: 0.9 },
  coffee: { toasty: 3, earthy: 0.6, smoky: 0.5, woody: 0.5, potency: 1.5 },
  'coffee bean': { toasty: 3, earthy: 0.6, woody: 0.6, potency: 3 },
  tea: { woody: 1.4, earthy: 1, floral: 0.6, toasty: 0.4, potency: 1.5 },
  'green tea': { green: 2, earthy: 0.6, woody: 0.4, potency: 1.5 },
  chamomile: { floral: 2.2, fruity: 0.6, potency: 3 },
  hibiscus: { fruity: 1.5, floral: 1.5, potency: 3 },
  cider: { fruity: 2, potency: 0.8 },

  // ── Dairy and eggs ────────────────────────────────────────────────────────────────────────────────
  cream: { fatty: 2.2, potency: 1 },
  'half and half': { fatty: 2, potency: 1 },
  milk: { fatty: 1.5, potency: 0.8 },
  'almond milk': { nutty: 1.4, fatty: 0.8, potency: 0.6 },
  'coconut milk': { fatty: 2.3, fruity: 1, potency: 1.2 },
  'coconut cream': { fatty: 2.4, fruity: 1, potency: 1.2 },
  coconut: { fatty: 2, fruity: 1.2, nutty: 0.8, woody: 0.3, potency: 1.2 },
  butter: { fatty: 3, potency: 1.5 },
  ghee: { fatty: 3, nutty: 1, toasty: 0.6, potency: 1.8 },
  'clarified butter': { fatty: 2.8, nutty: 0.5, potency: 1.3 },
  'egg white': { potency: 0 },
  'egg yolk': { fatty: 2, potency: 1 },
  egg: { fatty: 1.5, potency: 1 },
  buttermilk: { fatty: 1.2, savory: 0.5, potency: 0.7 },
  yogurt: { fatty: 1, savory: 0.5, potency: 0.7 },
  mayonnaise: { fatty: 2, potency: 1 },
  'ice cream': { fatty: 2, woody: 0.6, potency: 1 },
  'sour cream': { fatty: 1.5, potency: 0.9 },
  'cream cheese': { fatty: 1.5, potency: 0.9 },
  'goat cheese': { fatty: 1.4, savory: 0.6, earthy: 0.6, green: 0.4, potency: 1.1 },
  'blue cheese': { savory: 1.8, fatty: 1.4, earthy: 0.6, green: 0.4, potency: 1.5 },
  ricotta: { fatty: 1.3, potency: 0.7 },

  // ── Tomato products, stocks, savory seasonings ──────────────────────────────────────────────────
  tomato: { green: 1.2, fruity: 0.6, savory: 0.3, potency: 0.8 },
  'tomato paste': { toasty: 1.4, green: 1, savory: 0.8, fruity: 0.6, potency: 2.2 },
  'tomato sauce': { fruity: 1.2, savory: 0.6, green: 0.5, toasty: 0.5, potency: 1.1 },
  ketchup: { savory: 0.8, fruity: 0.8, toasty: 0.5, spicy: 0.5, potency: 1 },
  'chicken stock': { savory: 1.6, fatty: 0.8, potency: 0.5 },
  'veal stock': { savory: 1.6, toasty: 0.8, fatty: 0.6, potency: 0.5 },
  'fish stock': { savory: 1.6, potency: 0.4 },
  dashi: { savory: 2, smoky: 0.4, green: 0.4, potency: 0.6 },
  'bonito flakes': { savory: 2.2, smoky: 1.8, potency: 2.5 },
  miso: { savory: 2.2, nutty: 0.8, earthy: 0.6, toasty: 0.4, potency: 2 },
  salt: { potency: 0 },
  'soy sauce': { savory: 2.4, toasty: 1, potency: 2 },
  'fish sauce': { savory: 3, potency: 2.5 },
  'worcestershire sauce': { savory: 2, spicy: 1, toasty: 0.8, fruity: 0.6, potency: 2.5 },
  anchovy: { savory: 3, potency: 2.5 },
  parmesan: { savory: 1.8, nutty: 1.5, fatty: 1.3, potency: 1.5 },
  mozzarella: { fatty: 1.2, potency: 0.8 },
  cheddar: { fatty: 1.6, savory: 1, nutty: 0.6, potency: 1.2 },
  gruyere: { nutty: 1.6, savory: 1.2, fatty: 1.2, potency: 1.2 },
  feta: { fatty: 1.2, savory: 0.6, green: 0.3, potency: 1 },
  olive: { green: 1.2, fatty: 0.8, savory: 0.8, fruity: 0.4, potency: 1.5 },
  caper: { green: 1.5, spicy: 0.8, savory: 0.6, potency: 2 },
  nori: { savory: 1.4, toasty: 0.8, green: 0.8, potency: 1.5 },
  yeast: { savory: 1.5, toasty: 0.8, earthy: 0.6, potency: 1 },

  // ── Acids ─────────────────────────────────────────────────────────────────────────────────────────
  vinegar: { fruity: 0.5, potency: 1 },
  'red wine vinegar': { fruity: 0.8, woody: 0.4, potency: 1 },
  'white wine vinegar': { fruity: 0.6, potency: 1 },
  'rice vinegar': { fruity: 0.4, potency: 0.8 },
  tamarind: { fruity: 1.6, toasty: 1.2, potency: 2 },

  // ── Chilies, peppers, alliums, mustard (the HEAT is a taste; this is the smell) ────────────────
  'hot sauce': { savory: 1, fruity: 0.6, green: 0.6, potency: 1 },
  'pepper sauce': { savory: 1, fruity: 0.6, green: 0.6, potency: 1 },
  chili: { fruity: 1.4, green: 1.2, potency: 1.5 },
  'red chili': { fruity: 1.3, green: 1, potency: 1.5 },
  'green chili pepper': { green: 2, fruity: 0.5, potency: 1.5 },
  'jalapeno chile': { green: 2.2, potency: 1.5 },
  'scotch bonnet': { fruity: 2, green: 1, potency: 1.8 },
  'chili flake': { fruity: 1.3, woody: 0.8, potency: 2 },
  'chili powder': { spicy: 1.4, woody: 1, earthy: 0.8, fruity: 0.4, potency: 2 },
  'cayenne pepper': { spicy: 1, woody: 0.6, earthy: 0.4, potency: 1.5 },
  'red pepper': { green: 1, fruity: 1, potency: 1.2 },
  'ancho chili': { fruity: 1.8, smoky: 0.8, earthy: 0.8, toasty: 0.6, woody: 0.5, potency: 2 },
  'guajillo chili': { fruity: 1.6, smoky: 0.6, earthy: 0.6, toasty: 0.5, woody: 0.5, potency: 2 },
  gochujang: { savory: 1.4, toasty: 0.8, woody: 0.6, fruity: 0.5, potency: 1.5 },
  'curry paste': { spicy: 2.2, green: 1.2, earthy: 0.8, potency: 4 },
  'curry powder': { spicy: 2.6, earthy: 1, woody: 0.6, potency: 5 },
  'black pepper': { spicy: 3, potency: 5 },
  pepper: { spicy: 3, potency: 5 },
  'white pepper': { spicy: 2.6, earthy: 0.4, potency: 4 },
  'sichuan peppercorn': { floral: 2, spicy: 1.6, fruity: 1.2, woody: 0.8, potency: 4 },
  mustard: { spicy: 1.5, potency: 2 },
  garlic: { green: 1, spicy: 0.8, potency: 2 },
  onion: { green: 1, spicy: 0.3, potency: 1.2 },
  'purple onion': { green: 1, spicy: 0.3, potency: 1.2 },
  scallion: { green: 2, potency: 1.5 },
  shallot: { green: 1, potency: 1.2 },
  ginger: { spicy: 3, fruity: 0.4, potency: 3 },
  radish: { green: 1, spicy: 0.5, potency: 1 },

  // ── Spices, herbs, flowers ─────────────────────────────────────────────────────────────────────
  paprika: { earthy: 1, fruity: 0.8, woody: 0.5, smoky: 0.3, potency: 1.5 },
  'smoked paprika': { smoky: 3, earthy: 1, fruity: 0.5, potency: 3 },
  cumin: { spicy: 2.8, earthy: 1.4, woody: 0.4, potency: 5 },
  coriander: { spicy: 1.8, fruity: 1, floral: 0.6, potency: 3 },
  cinnamon: { spicy: 3, woody: 0.8, potency: 5 },
  nutmeg: { spicy: 2.8, woody: 1, potency: 6 },
  vanilla: { woody: 3, fatty: 1, floral: 0.4, potency: 6 },
  clove: { spicy: 3, woody: 0.5, potency: 8 },
  cardamom: { spicy: 2, green: 1.4, floral: 1, fruity: 0.6, potency: 6 },
  turmeric: { earthy: 2, spicy: 1, woody: 0.8, potency: 3 },
  'garam masala': { spicy: 3, woody: 0.8, potency: 6 },
  saffron: { floral: 2, earthy: 1, spicy: 0.6, woody: 0.4, potency: 12 },
  allspice: { spicy: 3, woody: 0.6, potency: 6 },
  'star anise': { spicy: 2.8, potency: 6 },
  fennel: { green: 1.8, spicy: 1.4, potency: 1.8 },
  caraway: { spicy: 2.4, potency: 5 },
  parsley: { green: 2.6, potency: 2 },
  thyme: { green: 2, spicy: 1, potency: 3 },
  oregano: { green: 1.8, spicy: 1.2, potency: 3 },
  cilantro: { green: 2.8, fruity: 0.4, potency: 2.5 },
  basil: { green: 2.6, spicy: 0.8, potency: 3 },
  'thai basil': { green: 2.2, spicy: 1.4, potency: 3 },
  mint: { green: 3, potency: 10 },
  tarragon: { green: 2, spicy: 1.6, potency: 3 },
  'bay leaf': { green: 1.5, spicy: 1, woody: 0.6, potency: 3 },
  'lime leaf': { fruity: 2, green: 1.5, potency: 3 },
  lemongrass: { green: 2, fruity: 1.8, potency: 2.5 },
  rosemary: { woody: 2, green: 1.8, spicy: 1.2, potency: 4 },
  sage: { woody: 1.8, green: 1.6, spicy: 1, potency: 4 },
  dill: { green: 2.6, spicy: 0.6, potency: 3 },
  'curry leaf': { green: 1.5, spicy: 1.5, nutty: 0.6, woody: 0.3, potency: 3 },
  lavender: { floral: 3, potency: 6 },
  'rose water': { floral: 3, potency: 8 },
  rose: { floral: 3, potency: 4 },
  'liquid smoke': { smoky: 3, woody: 0.8, potency: 10 },
  truffle: { earthy: 2.8, savory: 1, woody: 0.5, potency: 8 },

  // ── Proteins and vegetables ─────────────────────────────────────────────────────────────────────
  chicken: { savory: 0.8, fatty: 0.6, potency: 0.6 },
  beef: { savory: 1.2, fatty: 0.8, toasty: 0.5, potency: 0.8 },
  pork: { fatty: 1, savory: 0.9, potency: 0.8 },
  lamb: { fatty: 1.2, savory: 1, potency: 1 },
  shrimp: { savory: 1.4, potency: 0.8 },
  salmon: { fatty: 0.8, savory: 0.8, potency: 0.8 },
  'white fish': { savory: 0.8, potency: 0.5 },
  clam: { savory: 1.6, potency: 0.8 },
  mussel: { savory: 1.6, potency: 0.8 },
  bacon: { smoky: 2.5, fatty: 2, savory: 1.2, toasty: 0.6, potency: 3 },
  mushroom: { earthy: 2.4, savory: 1, woody: 0.4, potency: 1.2 },
  carrot: { earthy: 1, green: 0.8, potency: 0.6 },
  celery: { green: 2, potency: 1.5 },
  'sweet pepper': { green: 2, fruity: 0.5, potency: 1 },
  cucumber: { green: 2, potency: 0.6 },
  vegetable: { green: 1, potency: 0.6 },
  meat: { savory: 1, fatty: 0.8, toasty: 0.4, potency: 0.8 },
  spinach: { green: 1.5, earthy: 0.8, potency: 0.8 },
  eggplant: { earthy: 0.8, green: 0.5, potency: 0.5 },
  avocado: { fatty: 1.6, green: 1.2, potency: 0.7 },
  chocolate: { toasty: 2.8, fatty: 0.8, fruity: 0.6, potency: 2.5 },
  cocoa: { toasty: 3, earthy: 0.6, nutty: 0.4, potency: 2.5 },
  peanut: { nutty: 2.4, toasty: 1.4, fatty: 1, potency: 1 },
  'peanut butter': { nutty: 2.4, toasty: 1.6, fatty: 1.5, potency: 1.2 },
  tahini: { nutty: 2, fatty: 1.2, toasty: 1, potency: 1.5 },
  'sesame seed': { nutty: 2, toasty: 0.8, fatty: 0.6, potency: 1.5 },
  almond: { nutty: 2.4, fatty: 0.8, woody: 0.4, potency: 1.2 },
  'pine nut': { nutty: 1.8, fatty: 1.5, woody: 0.6, potency: 1 },
  walnut: { nutty: 2, fatty: 1, earthy: 0.8, woody: 0.4, potency: 1.2 },
  pecan: { nutty: 2, fatty: 1, toasty: 0.8, potency: 1.2 },
  hazelnut: { nutty: 2.4, toasty: 1.2, fatty: 1, potency: 1.2 },
  lettuce: { green: 1.2, potency: 0.5 },
  'romaine lettuce': { green: 1.2, potency: 0.5 },
  kale: { green: 1.8, earthy: 0.5, potency: 0.8 },
  cabbage: { green: 1.2, potency: 0.7 },
  sausage: { fatty: 1.4, savory: 1.4, spicy: 0.8, smoky: 0.3, potency: 1.2 },
  ham: { savory: 1.4, smoky: 1, fatty: 1, potency: 1 },
  duck: { fatty: 1.8, savory: 0.8, potency: 1 },

  // ── Oils, fats and neutral staples ────────────────────────────────────────────────────────────────
  'olive oil': { fatty: 2, green: 1.5, potency: 0.9 },
  'sesame oil': { nutty: 2.2, toasty: 2.2, fatty: 1, potency: 4 },
  'palm oil': { fatty: 1, potency: 0.5 },
  lard: { fatty: 2, savory: 0.4, potency: 1 },
  flour: { potency: 0 },
  cornstarch: { potency: 0 },
  rice: { potency: 0 },
  pasta: { potency: 0 },
  potato: { potency: 0 },
  tofu: { potency: 0 },

  // ── Savory, earthy, smoky, nutty and toasty things (AROMA-3): aromas that had no home on the six axes ────
  'oyster sauce': { savory: 2.2, toasty: 0.8, potency: 2 },
  hoisin: { savory: 1.4, toasty: 1.2, spicy: 0.6, fruity: 0.4, potency: 1.6 },
  shoyu: { savory: 2.4, toasty: 1, potency: 2 },
  tamari: { savory: 2.4, toasty: 1, potency: 2 },
  'white miso': { savory: 1.8, nutty: 0.8, fruity: 0.4, potency: 1.8 },
  'red miso': { savory: 2.4, earthy: 1, toasty: 0.6, potency: 2 },
  doenjang: { savory: 2.4, earthy: 1.2, potency: 2 },
  'nutritional yeast': { savory: 1.6, nutty: 1.2, potency: 1 },
  kombu: { savory: 2, green: 0.6, earthy: 0.5, potency: 1.5 },
  wakame: { savory: 1.2, green: 1, potency: 0.8 },
  stock: { savory: 1.4, fatty: 0.5, potency: 0.5 },
  broth: { savory: 1.4, fatty: 0.5, potency: 0.5 },
  'beef stock': { savory: 1.8, toasty: 0.8, fatty: 0.5, potency: 0.5 },
  'vegetable stock': { earthy: 0.8, green: 0.7, savory: 0.6, potency: 0.4 },
  pecorino: { savory: 1.6, fatty: 1.2, nutty: 0.6, potency: 1.6 },
  'swiss cheese': { nutty: 1.4, fatty: 1.2, potency: 1 },
  brie: { fatty: 1.6, earthy: 0.8, savory: 0.6, potency: 1 },
  prosciutto: { savory: 2, fatty: 1.2, nutty: 0.4, potency: 1.5 },
  chorizo: { smoky: 1.4, savory: 1.2, fatty: 1.2, spicy: 1, potency: 1.5 },
  oyster: { savory: 2, potency: 1 },
  scallop: { savory: 1.4, potency: 0.8 },
  crab: { savory: 1.6, potency: 0.9 },
  lobster: { savory: 1.6, potency: 0.9 },
  squid: { savory: 1.2, potency: 0.7 },
  shellfish: { savory: 1.5, potency: 0.8 },
  prawn: { savory: 1.4, potency: 0.8 },
  crayfish: { savory: 1.4, potency: 0.8 },
  sardine: { savory: 2, fatty: 0.8, potency: 1.2 },
  tuna: { savory: 0.8, fatty: 0.4, potency: 0.6 },
  cod: { savory: 0.6, potency: 0.5 },
  fish: { savory: 0.8, potency: 0.6 },
  caviar: { savory: 1.8, potency: 1 },
  turkey: { savory: 0.7, fatty: 0.5, potency: 0.6 },
  shiitake: { earthy: 2.2, savory: 1.2, woody: 0.4, potency: 1.5 },
  portobello: { earthy: 2, savory: 1, potency: 1 },
  porcini: { earthy: 2.6, savory: 1.2, nutty: 0.6, potency: 2.5 },
  chanterelle: { earthy: 1.8, fruity: 1.2, potency: 1.5 },
  beet: { earthy: 2.6, green: 0.4, potency: 1.2 },
  beetroot: { earthy: 2.6, green: 0.4, potency: 1.2 },
  parsnip: { earthy: 1.4, spicy: 0.5, potency: 0.8 },
  turnip: { earthy: 1.2, green: 0.6, spicy: 0.4, potency: 0.7 },
  'sweet potato': { earthy: 1, toasty: 0.6, potency: 0.6 },
  chicory: { earthy: 1.2, toasty: 1, potency: 1 },
  chipotle: { smoky: 2.6, fruity: 1, toasty: 0.6, earthy: 0.6, potency: 2 },
  gochugaru: { fruity: 1.4, smoky: 0.6, earthy: 0.4, potency: 1.8 },
  espresso: { toasty: 3, earthy: 0.8, smoky: 0.6, woody: 0.4, potency: 2 },
  'black tea': { woody: 1.4, earthy: 1, floral: 0.6, toasty: 0.5, potency: 1.5 },
  matcha: { green: 2.4, earthy: 1, potency: 2 },
  'brown butter': { fatty: 2.5, nutty: 2, toasty: 2, potency: 1.8 },
  'dark chocolate': { toasty: 2.8, fruity: 0.6, earthy: 0.4, potency: 2.5 },
  'milk chocolate': { toasty: 2, fatty: 1.2, potency: 2 },
  'white chocolate': { fatty: 1.8, woody: 1.2, toasty: 0.4, potency: 1.4 },
  nutella: { nutty: 2, toasty: 1.8, fatty: 1, potency: 1.5 },
  butterscotch: { toasty: 2.4, fatty: 1.2, potency: 1.2 },
  toffee: { toasty: 2.6, fatty: 0.8, nutty: 0.3, potency: 1.2 },
  'dulce de leche': { toasty: 2.4, fatty: 1.6, potency: 1.2 },
  date: { toasty: 1.4, fruity: 1, potency: 0.9 },
  'black treacle': { toasty: 2.2, smoky: 0.3, potency: 1.4 },
  malt: { toasty: 2.2, nutty: 0.6, potency: 1.4 },
  bread: { toasty: 1.4, savory: 0.4, potency: 0.6 },
  'rye bread': { toasty: 1.2, spicy: 0.6, earthy: 0.5, potency: 0.8 },
  popcorn: { toasty: 2, nutty: 1, fatty: 0.8, potency: 1 },
  'balsamic vinegar': { toasty: 1.2, fruity: 1, woody: 0.4, potency: 1.4 },
  'sherry vinegar': { nutty: 0.8, woody: 0.8, fruity: 0.6, potency: 1 },
  frangelico: { nutty: 2.2, toasty: 0.8, fruity: 0.4, potency: 1.3 },
  'hazelnut liqueur': { nutty: 2.2, toasty: 0.8, fruity: 0.4, potency: 1.3 },
  cashew: { nutty: 1.8, fatty: 1.2, potency: 1 },
  pistachio: { nutty: 2, fatty: 1.2, green: 0.6, potency: 1.2 },
  macadamia: { nutty: 1.6, fatty: 1.6, potency: 1.1 },
  'brazil nut': { nutty: 1.8, fatty: 1.2, earthy: 0.4, potency: 1.1 },
  'almond butter': { nutty: 2.2, fatty: 1.4, toasty: 0.6, potency: 1.2 },
  'almond extract': { nutty: 3, fruity: 0.6, potency: 6 },
  chestnut: { nutty: 1.6, toasty: 0.8, earthy: 0.4, potency: 0.9 },
  'sunflower seed': { nutty: 1.4, fatty: 0.8, potency: 0.9 },
  'pumpkin seed': { nutty: 1.6, green: 0.4, earthy: 0.4, potency: 0.9 },
};

/** The eleven axes, as written on a table line (the chart ids are these with an odor_ prefix). */
export const AROMA_LINE_AXES = ['fruity', 'floral', 'green', 'woody', 'spicy', 'fatty', 'toasty', 'nutty', 'earthy', 'smoky', 'savory'];
const AXES = AROMA_LINE_AXES;

/** Spellings a recipe line can carry that mean a table entry here (the strength table's aliases are honoured too). */
export const AROMA_ALIASES = {
  'sparkling water': 'soda water',
  'club soda': 'club soda',
  worcestershire: 'worcestershire sauce',
  tabasco: 'hot sauce',
  'tabasco sauce': 'hot sauce',
  'sugar cube': 'sugar',
  'mint leaf': 'mint',
  'coffee beans': 'coffee bean',
  'toasted sesame oil': 'sesame oil',
  'espresso shot': 'espresso',
};

/** The table entry for an ingredient name, or null. { axes: {eleven 0..3}, potency }. */
export function aromaFor(key) {
  if (typeof key !== 'string') return null;
  const k = key.trim().toLowerCase();
  const e = AROMAS[k] || AROMAS[AROMA_ALIASES[k]];
  if (!e) return null;
  const axes = Object.fromEntries(AXES.map((a) => [a, e[a] || 0]));
  return { axes, potency: e.potency };
}

// ── Garnish text ──────────────────────────────────────────────────────────────────────────────────────

/**
 * A garnish lives in a cocktail's garnish text ("1 lemon twist", "Mint sprig"), not in an ingredient line, but a
 * twist or a mint sprig is most of what the drink smells of. Returns extra lines [{ key, amount }] (grams) that count
 * for AROMA ONLY (they are not ingredients: they do not change the taste chart or the draw rule's ingredient count):
 *   a citrus twist, peel, zest or half wheel: 2 g of that fruit (a wedge or wheel: 1 g)
 *   a mint sprig, leaf or bouquet: 2 g mint; rosemary, basil, thyme or sage the same
 *   nutmeg 0.5 g, cinnamon 1 g, coffee beans 1 g
 * Any other garnish (cherry, olive, celery, cucumber, candy cane) adds nothing.
 */
export function garnishAromaLines(garnish) {
  const text = String(garnish || '').toLowerCase();
  if (!text) return [];
  const out = [];
  const add = (key, amount) => { if (!out.some((o) => o.key === key)) out.push({ key, amount }); };
  for (const fruit of ['lemon', 'lime', 'orange', 'grapefruit']) {
    if (new RegExp(`\\b${fruit}\\b[^,;]*\\b(twist|twists|peel|zest)\\b|\\b(twist|peel|zest)s?\\b[^,;]*\\b${fruit}\\b`).test(text)) add(fruit, 2);
    else if (new RegExp(`\\b${fruit}\\b[^,;]*\\b(wedge|wedges|wheel|wheels|slice|slices|half wheel)\\b`).test(text)) add(fruit, 1);
  }
  if (/\bmint\b/.test(text)) add('mint', 2);
  for (const herb of ['rosemary', 'basil', 'thyme', 'sage']) if (new RegExp(`\\b${herb}\\b`).test(text)) add(herb, 2);
  if (/\bnutmeg\b/.test(text)) add('nutmeg', 0.5);
  if (/\bcinnamon\b/.test(text)) add('cinnamon', 1);
  if (/\bcoffee beans?\b/.test(text)) add('coffee bean', 1);
  return out;
}
