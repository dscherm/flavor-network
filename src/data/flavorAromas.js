/**
 * flavorAromas.js — a hand-tuned table of what each important ingredient SMELLS of, on the six aroma axes of the
 * flavor chart, and how far a small amount of it perfumes a dish (FLAVOR-5, 2026-11-16).
 *
 * WRITTEN BY THE ASSISTANT from common culinary and bartending knowledge on 2026-11-16. NOT independently
 * checked. Every number is a judgement; correct any line you disagree with (how to, just below).
 *
 * WHY IT EXISTS. The model's aroma values were one identical row for 2,062 of 3,432 ingredients, and the published
 * aroma descriptors in gnn_compounds.json turned out not to describe ingredients (docs/flavor-profile.md, "Aroma data
 * assessment": 4 compounds appear in 68 to 72% of ingredients, 439 ingredients share one identical list, lemon has
 * one specific compound, butter and coffee none). So the aroma half of every chart comes from this table, the way
 * the taste half comes from flavorStrengths.js. An ingredient with no line here has NO aroma data: it is not counted
 * for aroma and the chart is drawn from the others.
 *
 * THE AXES (the chart keeps the ids odor_fruity ... odor_fatty; the lines below drop the prefix):
 *   fruity  citrus, berries, orchard and tropical fruit, fruity esters (rum, brandy, wine, orange liqueur)
 *   floral  rose, lavender, violet, elderflower, jasmine, hibiscus, chamomile, honey
 *   green   fresh herbs (mint, basil, parsley, cilantro, dill), cut grass, leafy and raw vegetables, juniper, anise-green,
 *           fresh chili and green pepper. Mint is green, not its own axis.
 *   woody   oak, vanilla and the SWEET-WOODY family (caramel, toast, roast, coffee, cocoa, nuts, malt), smoke, earth
 *           (mushroom, truffle, tobacco). Vanilla is woody, decided on 2026-11-16 before the aroma test set was tuned.
 *   spicy   the aroma of aromatic spice: cinnamon, clove, nutmeg, cardamom, black pepper, ginger, cumin, anise,
 *           caraway. NOT chili heat: heat is a TASTE axis (flavorStrengths.js). The chart labels this axis "Spice".
 *   fatty   dairy fat, butter, cream, egg, coconut, cheese, rich oils and meats (the app calls it "creamy")
 *
 * THE LINE, one per ingredient: { fruity, floral, green, woody, spicy, fatty, potency }
 *   Each axis is 0..3 and means "how strongly THIS ingredient smells of it, per gram" (0, leave it out: none;
 *   1 faint, in the background; 2 clear; 3 what the ingredient IS: mint is green 3, lavender is floral 3).
 *   potency: how many grams of an ordinary ingredient ONE gram of this counts as for AROMA. 1 = ordinary.
 *     above 1 = a little perfumes a lot: mint leaf 10, cloves 8, vanilla 6, rose water 8, saffron 12, citrus peel 2 to 3,
 *               ground spices 3 to 5, bitters 5 to 6, truffle 8
 *     below 1 = mostly water or alcohol with a mild smell: base spirits 0.5 to 0.7, wine 0.7, milk 0.8
 *     0       = no aroma worth charting (water, sugar, salt, flour, vodka, egg white). It still counts as an
 *               ingredient with data, and it waters a dish down a little (AROMALESS_WEIGHT in flavorAroma.js).
 *   An entry with none of the six axes is aromaless whatever its potency; write potency: 0 to say so.
 *   Where a thing is smelly but on no axis (fish, shellfish, garlic's sulphur), it is written as aromaless or with
 *   the nearest axis at a low strength; the chart is about six families, not all of smell.
 *
 * HOW A CHART IS WORKED OUT (flavorAroma.js): for each axis, the sum over ingredients of grams x potency x strength/3,
 * divided by the sum of grams x potency (an aromaless ingredient counts at grams x AROMALESS_WEIGHT instead).
 *
 * HOW TO CORRECT A LINE: edit the numbers on its line below (keep the name exactly as spelled: it is the app's own
 * ingredient name), then run `npm run measure:flavor -- --aroma` and `npm test -- flavorAromas` and look at the
 * recipes you care about. Do not add a line to make one recipe come out right: ask whether a cook would agree with
 * the line on its own. A name that is not an ingredient in the app's data fails the test on purpose (list bottles and
 * garnish keys that the graph does not hold in NOT_IN_GRAPH_AROMA).
 */

/** Names the table may use that are not ingredients in the curated graph: bar bottles and mixers. */
export const NOT_IN_GRAPH_AROMA = [
  'licor 43', 'averna', 'genepy', 'strega', 'amarula', 'goldwasser', 'herbal liqueur', 'amaro', 'pastis', 'soju',
  'kirsch', 'slivovitz', 'creme de violette', 'creme de mure', 'creme de peche', 'seltzer', 'club soda',
];

export const AROMAS = {
  // ── Base spirits ───────────────────────────────────────────────────────────────────────────────────
  gin: { green: 1.5, floral: 0.6, fruity: 0.6, spicy: 0.5, potency: 0.7 },
  vodka: { potency: 0 },
  rum: { fruity: 1.2, woody: 0.8, potency: 0.7 },
  whiskey: { woody: 2, fruity: 0.6, spicy: 0.4, potency: 0.7 },
  bourbon: { woody: 2.2, fruity: 0.6, spicy: 0.5, potency: 0.7 },
  rye: { woody: 1.8, spicy: 1.2, fruity: 0.4, potency: 0.7 },
  'rye whiskey': { woody: 1.8, spicy: 1.2, fruity: 0.4, potency: 0.7 },
  scotch: { woody: 2, fruity: 0.5, potency: 0.7 },
  whisky: { woody: 1.8, fruity: 0.6, floral: 0.4, potency: 0.7 },
  'japanese whisky': { woody: 1.8, fruity: 0.6, floral: 0.4, potency: 0.7 },
  tequila: { green: 1.2, fruity: 0.6, spicy: 0.5, potency: 0.6 },
  mezcal: { woody: 2, green: 1, potency: 0.7 },
  brandy: { fruity: 1.5, woody: 1.5, floral: 0.4, potency: 0.7 },
  cognac: { fruity: 1.5, woody: 1.5, floral: 0.4, potency: 0.7 },
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
  sake: { fruity: 1, floral: 1, potency: 0.6 },
  mirin: { fruity: 0.5, potency: 0.6 },
  'shaoxing wine': { woody: 1.2, fruity: 0.6, potency: 0.8 },

  // ── Wine, vermouth, fortified wine, beer ────────────────────────────────────────────────────────
  'white wine': { fruity: 1.5, floral: 0.6, potency: 0.7 },
  'red wine': { fruity: 1.5, woody: 1, spicy: 0.4, potency: 0.8 },
  wine: { fruity: 1.5, woody: 0.5, potency: 0.7 },
  champagne: { fruity: 1.2, floral: 0.4, potency: 0.6 },
  prosecco: { fruity: 1.2, floral: 0.4, potency: 0.6 },
  'sparkling wine': { fruity: 1.2, floral: 0.4, potency: 0.6 },
  'sweet vermouth': { spicy: 1.2, woody: 0.8, fruity: 0.6, green: 0.6, floral: 0.4, potency: 0.9 },
  'dry vermouth': { green: 1, floral: 1, spicy: 0.6, potency: 0.9 },
  vermouth: { floral: 0.8, spicy: 1, green: 0.6, potency: 0.9 },
  'lillet blanc': { fruity: 1.2, floral: 0.8, potency: 0.8 },
  sherry: { woody: 1.5, fruity: 0.6, potency: 0.8 },
  'cream sherry': { woody: 1.5, fruity: 0.8, potency: 0.9 },
  port: { fruity: 1.5, woody: 1, potency: 0.9 },
  'madeira wine': { woody: 1.5, fruity: 0.8, potency: 0.9 },
  beer: { woody: 0.6, green: 0.8, fruity: 0.4, potency: 0.5 },

  // ── Liqueurs, amari, aperitifs ───────────────────────────────────────────────────────────────────
  liqueur: { fruity: 1, potency: 1 },
  'herbal liqueur': { green: 1.8, spicy: 1, floral: 0.6, potency: 1.4 },
  'triple sec': { fruity: 2.5, potency: 1.4 },
  'orange liqueur': { fruity: 2.5, potency: 1.4 },
  cointreau: { fruity: 2.5, potency: 1.4 },
  'grand marnier': { fruity: 2.3, woody: 0.8, potency: 1.4 },
  'orange curacao': { fruity: 2.5, potency: 1.4 },
  'blue curacao': { fruity: 2, potency: 1.2 },
  'maraschino liqueur': { fruity: 1.8, woody: 0.6, floral: 0.4, potency: 1.4 },
  amaretto: { woody: 1.8, fruity: 0.8, potency: 1.3 },
  kahlua: { woody: 2.5, potency: 1.3 },
  'coffee liqueur': { woody: 2.5, potency: 1.3 },
  'baileys irish cream': { fatty: 2, woody: 1, potency: 1.2 },
  'irish cream': { fatty: 2, woody: 1, potency: 1.2 },
  amarula: { fatty: 1.5, fruity: 1, woody: 0.8, potency: 1.2 },
  'licor 43': { woody: 1.5, fruity: 1.2, spicy: 0.5, potency: 1.3 },
  'creme de cacao': { woody: 2.5, potency: 1.3 },
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
  drambuie: { woody: 1.2, spicy: 1.2, fruity: 0.6, potency: 1.3 },
  sambuca: { spicy: 2.2, potency: 1.3 },
  'melon liqueur': { fruity: 2.5, potency: 1.4 },
  'fernet branca': { green: 1.8, spicy: 1.2, woody: 0.8, potency: 2 },
  gentian: { woody: 1.5, green: 1, potency: 2 },
  benedictine: { spicy: 1.5, green: 1.2, floral: 0.6, woody: 0.6, potency: 1.5 },
  'green chartreuse': { green: 2.2, spicy: 1.5, floral: 0.6, potency: 1.8 },
  'yellow chartreuse': { spicy: 1.6, floral: 1, green: 1, potency: 1.5 },
  galliano: { spicy: 1.2, floral: 1, green: 1, woody: 0.8, potency: 1.4 },
  strega: { floral: 1, spicy: 1.5, green: 1, potency: 1.4 },
  falernum: { spicy: 1.8, fruity: 1, woody: 0.4, potency: 1.4 },
  'elderflower cordial': { floral: 2.8, fruity: 0.5, potency: 1.5 },
  campari: { fruity: 1.5, green: 1, spicy: 0.8, potency: 1.5 },
  aperol: { fruity: 2, green: 0.6, floral: 0.4, potency: 1.4 },
  'amaro montenegro': { fruity: 1, floral: 1, spicy: 1, green: 1, woody: 0.6, potency: 1.4 },
  amaro: { woody: 1.2, green: 1, fruity: 0.8, spicy: 0.8, potency: 1.4 },
  averna: { woody: 1.3, fruity: 1, spicy: 0.8, potency: 1.4 },
  cynar: { green: 1.8, woody: 1, potency: 1.4 },
  suze: { floral: 1.5, green: 1.5, potency: 1.5 },
  jagermeister: { spicy: 1.5, woody: 1, green: 0.8, fruity: 0.4, potency: 1.4 },
  genepy: { green: 2, floral: 1, potency: 1.5 },

  // ── Bitters ────────────────────────────────────────────────────────────────────────────────────────
  bitters: { spicy: 2, woody: 1.5, fruity: 0.6, potency: 6 },
  'angostura bitters': { spicy: 2, woody: 1.5, fruity: 0.6, potency: 6 },
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
  'tomato juice': { green: 1.2, fruity: 0.4, potency: 0.8 },
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
  fig: { fruity: 1.5, woody: 0.6, potency: 1 },
  raisin: { fruity: 1.5, woody: 0.6, potency: 1 },
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
  'brown sugar': { woody: 1, potency: 0.8 },
  'palm sugar': { woody: 0.8, potency: 0.8 },
  honey: { floral: 1.2, woody: 0.4, potency: 1 },
  'maple syrup': { woody: 1.8, potency: 1 },
  'agave syrup': { potency: 0 },
  'raspberry syrup': { fruity: 2.5, potency: 1.2 },
  grenadine: { fruity: 2, potency: 1 },
  'almond syrup': { woody: 1.8, floral: 0.6, potency: 1.2 },
  molasses: { woody: 2, potency: 1.5 },
  caramel: { woody: 2.2, fatty: 0.8, potency: 1.2 },

  // ── Sodas, mixers, water ──────────────────────────────────────────────────────────────────────────
  'soda water': { potency: 0 },
  'club soda': { potency: 0 },
  seltzer: { potency: 0 },
  water: { potency: 0 },
  'tonic water': { fruity: 0.5, green: 0.4, potency: 0.5 },
  'ginger ale': { spicy: 1.2, fruity: 0.5, potency: 0.6 },
  'ginger beer': { spicy: 2, potency: 0.9 },
  coffee: { woody: 3, potency: 1.5 },
  'coffee bean': { woody: 3, potency: 3 },
  tea: { woody: 1.8, floral: 0.6, potency: 1.5 },
  'green tea': { green: 2, woody: 0.5, potency: 1.5 },
  chamomile: { floral: 2.2, fruity: 0.6, potency: 3 },
  hibiscus: { fruity: 1.5, floral: 1.5, potency: 3 },
  cider: { fruity: 2, potency: 0.8 },

  // ── Dairy and eggs ────────────────────────────────────────────────────────────────────────────────
  cream: { fatty: 2.2, potency: 1 },
  'half and half': { fatty: 2, potency: 1 },
  milk: { fatty: 1.5, potency: 0.8 },
  'almond milk': { woody: 1, fatty: 0.8, potency: 0.6 },
  'coconut milk': { fatty: 2.3, fruity: 1, potency: 1.2 },
  'coconut cream': { fatty: 2.4, fruity: 1, potency: 1.2 },
  coconut: { fatty: 2, fruity: 1.2, woody: 0.6, potency: 1.2 },
  butter: { fatty: 3, potency: 1.5 },
  ghee: { fatty: 3, woody: 0.4, potency: 1.8 },
  'clarified butter': { fatty: 2.8, potency: 1.3 },
  'egg white': { potency: 0 },
  'egg yolk': { fatty: 2, potency: 1 },
  egg: { fatty: 1.5, potency: 1 },
  buttermilk: { fatty: 1.2, potency: 0.7 },
  yogurt: { fatty: 1, potency: 0.7 },
  mayonnaise: { fatty: 2, potency: 1 },
  'ice cream': { fatty: 2, woody: 0.6, potency: 1 },
  'sour cream': { fatty: 1.5, potency: 0.9 },
  'cream cheese': { fatty: 1.5, potency: 0.9 },
  'goat cheese': { fatty: 1.4, green: 0.4, potency: 1.1 },
  'blue cheese': { fatty: 1.6, green: 0.4, potency: 1.5 },
  ricotta: { fatty: 1.3, potency: 0.7 },

  // ── Tomato products, stocks, savory seasonings ──────────────────────────────────────────────────
  tomato: { green: 1.2, fruity: 0.6, potency: 0.8 },
  'tomato paste': { green: 1.2, woody: 1, fruity: 0.6, potency: 2.2 },
  'tomato sauce': { green: 1.2, woody: 0.6, potency: 1.1 },
  ketchup: { fruity: 0.8, spicy: 0.5, woody: 0.4, potency: 1 },
  'chicken stock': { fatty: 0.8, potency: 0.7 },
  'veal stock': { fatty: 0.6, woody: 0.4, potency: 0.7 },
  'fish stock': { potency: 0 },
  dashi: { green: 0.8, woody: 0.5, potency: 0.8 },
  'bonito flakes': { woody: 2, potency: 2.5 },
  miso: { woody: 1.2, fatty: 0.5, potency: 2 },
  salt: { potency: 0 },
  'soy sauce': { woody: 1.5, potency: 2 },
  'fish sauce': { potency: 0 },
  'worcestershire sauce': { spicy: 1, woody: 0.8, fruity: 0.6, potency: 2.5 },
  anchovy: { potency: 0 },
  parmesan: { fatty: 1.6, woody: 0.6, potency: 1.5 },
  mozzarella: { fatty: 1.2, potency: 0.8 },
  cheddar: { fatty: 1.6, woody: 0.4, potency: 1.2 },
  gruyere: { fatty: 1.6, woody: 1, potency: 1.2 },
  feta: { fatty: 1.2, green: 0.3, potency: 1 },
  olive: { green: 1.2, fatty: 0.8, potency: 1.5 },
  caper: { green: 1.5, spicy: 0.8, potency: 2 },
  nori: { green: 1, woody: 1, potency: 1.5 },
  yeast: { woody: 1, potency: 1 },

  // ── Acids ─────────────────────────────────────────────────────────────────────────────────────────
  vinegar: { fruity: 0.5, potency: 1 },
  'red wine vinegar': { fruity: 0.8, woody: 0.4, potency: 1 },
  'white wine vinegar': { fruity: 0.6, potency: 1 },
  'rice vinegar': { fruity: 0.4, potency: 0.8 },
  tamarind: { fruity: 1.5, woody: 0.6, potency: 2 },

  // ── Chilies, peppers, alliums, mustard (the HEAT is a taste; this is the smell) ────────────────
  'hot sauce': { fruity: 0.6, green: 0.6, potency: 1 },
  'pepper sauce': { fruity: 0.6, green: 0.6, potency: 1 },
  chili: { green: 1.5, fruity: 0.8, potency: 1.5 },
  'red chili': { green: 1.2, fruity: 1, potency: 1.5 },
  'green chili pepper': { green: 2, fruity: 0.5, potency: 1.5 },
  'jalapeno chile': { green: 2.2, potency: 1.5 },
  'scotch bonnet': { fruity: 2, green: 1, potency: 1.8 },
  'chili flake': { woody: 1, fruity: 0.8, potency: 2 },
  'chili powder': { woody: 1.2, spicy: 1, potency: 2 },
  'cayenne pepper': { woody: 0.6, spicy: 1, potency: 1.5 },
  'red pepper': { green: 1, fruity: 1, potency: 1.2 },
  'ancho chili': { woody: 1.8, fruity: 1.2, potency: 2 },
  'guajillo chili': { woody: 1.5, fruity: 1.2, potency: 2 },
  gochujang: { woody: 1, fruity: 0.5, potency: 1.5 },
  'curry paste': { spicy: 2.2, green: 1.2, potency: 4 },
  'black pepper': { spicy: 3, potency: 5 },
  pepper: { spicy: 3, potency: 5 },
  'white pepper': { spicy: 2.6, potency: 4 },
  'sichuan peppercorn': { spicy: 2, floral: 1.5, fruity: 1, potency: 4 },
  mustard: { spicy: 1.5, potency: 2 },
  garlic: { green: 1, spicy: 0.8, potency: 2 },
  onion: { green: 1, spicy: 0.3, potency: 1.2 },
  'purple onion': { green: 1, spicy: 0.3, potency: 1.2 },
  scallion: { green: 2, potency: 1.5 },
  shallot: { green: 1, potency: 1.2 },
  ginger: { spicy: 3, fruity: 0.4, potency: 3 },
  radish: { green: 1, spicy: 0.5, potency: 1 },

  // ── Spices, herbs, flowers ─────────────────────────────────────────────────────────────────────
  paprika: { woody: 1, fruity: 0.6, potency: 1.5 },
  'smoked paprika': { woody: 2.8, potency: 3 },
  cumin: { spicy: 2.8, woody: 0.8, potency: 5 },
  coriander: { spicy: 1.8, fruity: 1, floral: 0.6, potency: 3 },
  cinnamon: { spicy: 3, woody: 0.8, potency: 5 },
  nutmeg: { spicy: 2.8, woody: 1, potency: 6 },
  vanilla: { woody: 3, fatty: 1, floral: 0.4, potency: 6 },
  clove: { spicy: 3, woody: 0.5, potency: 8 },
  cardamom: { spicy: 2.2, floral: 1, fruity: 0.6, potency: 6 },
  turmeric: { woody: 1, spicy: 1, potency: 3 },
  'garam masala': { spicy: 3, woody: 0.8, potency: 6 },
  saffron: { floral: 2, woody: 1, spicy: 0.6, potency: 12 },
  allspice: { spicy: 3, woody: 0.6, potency: 6 },
  'star anise': { spicy: 2.8, potency: 6 },
  fennel: { spicy: 2, green: 1, potency: 2 },
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
  lemongrass: { fruity: 2.2, green: 1.5, potency: 2.5 },
  rosemary: { green: 2, woody: 1.2, spicy: 1.2, potency: 4 },
  sage: { green: 1.8, woody: 1.2, spicy: 1, potency: 4 },
  dill: { green: 2.6, spicy: 0.6, potency: 3 },
  'curry leaf': { green: 1.5, spicy: 1.5, woody: 0.5, potency: 3 },
  lavender: { floral: 3, potency: 6 },
  'rose water': { floral: 3, potency: 8 },
  rose: { floral: 3, potency: 4 },
  'liquid smoke': { woody: 3, potency: 10 },
  truffle: { woody: 2.8, potency: 8 },

  // ── Proteins and vegetables ─────────────────────────────────────────────────────────────────────
  chicken: { fatty: 0.6, potency: 0.6 },
  beef: { fatty: 0.8, woody: 0.6, potency: 0.8 },
  pork: { fatty: 1, potency: 0.8 },
  lamb: { fatty: 1.2, potency: 1 },
  shrimp: { potency: 0 },
  salmon: { fatty: 0.8, potency: 0.8 },
  'white fish': { potency: 0 },
  clam: { potency: 0 },
  mussel: { potency: 0 },
  bacon: { woody: 2.5, fatty: 2, potency: 3 },
  mushroom: { woody: 1.8, potency: 1.2 },
  carrot: { green: 0.8, potency: 0.6 },
  celery: { green: 2, potency: 1.5 },
  'sweet pepper': { green: 2, fruity: 0.5, potency: 1 },
  cucumber: { green: 2, potency: 0.6 },
  vegetable: { green: 1, potency: 0.6 },
  meat: { fatty: 0.8, woody: 0.4, potency: 0.8 },
  spinach: { green: 1.5, potency: 0.8 },
  eggplant: { green: 0.5, potency: 0.5 },
  avocado: { fatty: 1.6, green: 1.2, potency: 0.7 },
  chocolate: { woody: 2.8, fruity: 0.6, potency: 2.5 },
  cocoa: { woody: 3, potency: 2.5 },
  peanut: { woody: 1.8, fatty: 1, potency: 1 },
  'peanut butter': { woody: 2, fatty: 1.5, potency: 1.2 },
  tahini: { woody: 1.8, fatty: 1.2, potency: 1.5 },
  'sesame seed': { woody: 2, fatty: 0.6, potency: 1.5 },
  almond: { woody: 2, fatty: 0.8, potency: 1.2 },
  'pine nut': { woody: 1, fatty: 1.5, potency: 1 },
  walnut: { woody: 1.8, fatty: 1, potency: 1.2 },
  pecan: { woody: 1.8, fatty: 1, potency: 1.2 },
  hazelnut: { woody: 2, fatty: 1, potency: 1.2 },
  lettuce: { green: 1.2, potency: 0.5 },
  'romaine lettuce': { green: 1.2, potency: 0.5 },
  kale: { green: 1.8, potency: 0.8 },
  cabbage: { green: 1.2, potency: 0.7 },
  sausage: { fatty: 1.4, spicy: 0.8, woody: 0.6, potency: 1.2 },
  ham: { woody: 1.2, fatty: 1, potency: 1 },
  duck: { fatty: 1.8, potency: 1 },

  // ── Oils, fats and neutral staples ────────────────────────────────────────────────────────────────
  'olive oil': { fatty: 2, green: 1.5, potency: 0.9 },
  'sesame oil': { woody: 2.5, fatty: 1, potency: 4 },
  'palm oil': { fatty: 1, potency: 0.5 },
  lard: { fatty: 2, potency: 1 },
  flour: { potency: 0 },
  cornstarch: { potency: 0 },
  rice: { potency: 0 },
  pasta: { potency: 0 },
  potato: { potency: 0 },
  tofu: { potency: 0 },
};

const AXES = ['fruity', 'floral', 'green', 'woody', 'spicy', 'fatty'];

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
};

/** The table entry for an ingredient name, or null. { axes: {six 0..3}, potency }. */
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
