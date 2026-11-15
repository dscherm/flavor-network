/**
 * flavorStrengths.js — a hand-tuned table of how STRONGLY each important ingredient tastes of each of the six
 * chart tastes, and how much a given amount of it counts (FLAVOR-4, 2026-11-16).
 *
 * WRITTEN BY THE ASSISTANT from common bartending and cooking knowledge on 2026-11-16. NOT independently
 * checked. Every number is a judgement; correct any line you disagree with (how to, just below).
 *
 * WHY IT EXISTS. The curated taste label of an ingredient says WHICH tastes it has ("sweet bitter") but not how
 * strong they are, so the biggest pour wins: 2 oz of tequila ("bitter") beat 3/4 oz of lime juice ("sour"), and
 * two dashes of bitters weighed two grams against 57 g of whiskey. This table fixes that for the ingredients
 * that matter most. An ingredient with an entry here REPLACES the label-derived weights; any other ingredient
 * keeps the label (see LABEL_STRENGTH_PER_WEIGHT in flavorTaste.js for how a label is put on this scale).
 *
 * THE SCALE, one line per ingredient: { sweet, sour, bitter, salty, umami, heat, potency }
 *   Each of the six tastes is 0..3 and means "how strongly THIS ingredient tastes of it, per gram":
 *     0 (leave it out)  none            1  faint, in the background
 *     2  clearly there                  3  what the ingredient IS: sugar is sweet 3, lime juice is sour 3
 *   potency: how many grams of an ordinary ingredient ONE gram of this counts as, for taste. 1 = ordinary.
 *     above 1 = a little goes a long way (bitters 6, hot sauce 10, chili 8, fish sauce 6, soy sauce 4,
 *               salt 25, citrus juice 2.5, sugar and syrup 2 to 2.5, strong liqueurs 1.5)
 *     below 1 = mostly water or alcohol with a mild character (base spirits 0.5 to 0.7, stock 1)
 *     0       = no taste worth charting (soda water, water, oils, flour). It still counts as an ingredient with
 *               data and it still waters a drink down a little (TASTELESS_WEIGHT), it just adds no taste.
 *   An entry with none of the six tastes is tasteless whatever its potency; write potency: 0 to say so.
 *
 * HOW A CHART IS WORKED OUT (flavorTaste.js): for each taste, the sum over ingredients of
 *   grams x potency x strength/3, divided by the total grams, capped at 1.
 *
 * HOW TO CORRECT A LINE: edit the numbers on its line below (keep the name exactly as it is spelled: the name is
 * the app's own ingredient name), then run `npm run measure:flavor` and `npm test -- flavorStrengths` and look at
 * the recipes you care about. Do not add a line to make one recipe come out right: ask whether a bartender or a
 * cook would agree with the line on its own. docs/flavor-profile.md ("After FLAVOR-4") says how to read the output.
 * A name that is not an ingredient in the app's data fails the test on purpose.
 */

/** Names the table may use that are not ingredients in the curated graph: bottles on the bar shelf and mixers. */
export const NOT_IN_GRAPH = [
  'licor 43', 'averna', 'genepy', 'strega', 'amarula', 'goldwasser', 'herbal liqueur', 'amaro', 'pastis', 'soju',
  'kirsch', 'slivovitz', 'creme de violette', 'creme de mure', 'creme de peche', 'seltzer', 'club soda',
];

export const STRENGTHS = {
  // ── Base spirits: mostly ethanol and water with a mild character ──────────────────────────────────────
  gin: { bitter: 0.4, potency: 0.6 },
  vodka: { potency: 0 },
  rum: { sweet: 0.6, potency: 0.6 },
  whiskey: { sweet: 0.6, bitter: 0.4, potency: 0.6 },
  bourbon: { sweet: 0.8, bitter: 0.3, potency: 0.6 },
  rye: { sweet: 0.4, bitter: 0.5, potency: 0.6 },
  'rye whiskey': { sweet: 0.4, bitter: 0.5, potency: 0.6 },
  scotch: { sweet: 0.3, bitter: 0.6, potency: 0.6 },
  tequila: { bitter: 0.3, sweet: 0.2, potency: 0.6 },
  mezcal: { bitter: 0.6, potency: 0.6 },
  brandy: { sweet: 0.7, bitter: 0.2, potency: 0.6 },
  cognac: { sweet: 0.7, bitter: 0.2, potency: 0.6 },
  'apple brandy': { sweet: 0.7, potency: 0.6 },
  applejack: { sweet: 0.7, potency: 0.6 },
  'pear brandy': { sweet: 0.6, potency: 0.6 },
  pisco: { sweet: 0.4, bitter: 0.2, potency: 0.6 },
  cachaca: { sweet: 0.5, bitter: 0.3, potency: 0.6 },
  aquavit: { bitter: 0.6, potency: 0.6 },
  ouzo: { sweet: 0.8, bitter: 0.5, potency: 0.7 },
  pastis: { sweet: 0.8, bitter: 0.5, potency: 0.7 },
  absinthe: { bitter: 1.6, sweet: 0.4, potency: 8 },
  soju: { sweet: 0.4, potency: 0.5 },
  kirsch: { sweet: 0.3, potency: 0.6 },
  slivovitz: { sweet: 0.3, potency: 0.6 },
  spirit: { sweet: 0.4, bitter: 0.3, potency: 0.6 },
  whisky: { sweet: 0.4, bitter: 0.5, potency: 0.6 },
  'japanese whisky': { sweet: 0.5, bitter: 0.4, potency: 0.6 },
  sake: { sweet: 0.8, umami: 0.4, potency: 0.7 },
  mirin: { sweet: 2, umami: 0.4, potency: 1.2 },
  'shaoxing wine': { sweet: 0.8, umami: 0.8, sour: 0.4, potency: 0.8 },

  // ── Wine, vermouth, fortified wine, beer ─────────────────────────────────────────────────────────────
  'white wine': { sour: 1.5, sweet: 0.4, potency: 0.9 },
  'red wine': { sour: 1, bitter: 1, sweet: 0.3, potency: 0.9 },
  wine: { sour: 1.2, bitter: 0.6, sweet: 0.3, potency: 0.9 },
  champagne: { sour: 1.3, sweet: 0.3, potency: 0.8 },
  prosecco: { sour: 1, sweet: 0.8, potency: 0.8 },
  'sparkling wine': { sour: 1.1, sweet: 0.6, potency: 0.8 },
  'sweet vermouth': { sweet: 2, bitter: 1.2, sour: 0.2, potency: 1.2 },
  'dry vermouth': { sour: 1, bitter: 1.2, sweet: 0.3, potency: 1 },
  vermouth: { sweet: 1.5, bitter: 1.2, sour: 0.5, potency: 1.1 },
  'lillet blanc': { sweet: 1.3, bitter: 0.8, sour: 0.5, potency: 1 },
  sherry: { sweet: 1, bitter: 0.6, sour: 0.4, potency: 1 },
  'cream sherry': { sweet: 2, bitter: 0.3, potency: 1.1 },
  port: { sweet: 2, bitter: 0.5, potency: 1.1 },
  'madeira wine': { sweet: 1.5, bitter: 0.5, sour: 0.3, potency: 1 },
  beer: { bitter: 1.2, sweet: 0.4, potency: 0.8 },

  // ── Liqueurs, amari, aperitifs (a gram counts for more than a gram of spirit) ────────────────────────
  liqueur: { sweet: 2.2, bitter: 0.3, potency: 1.5 },
  'herbal liqueur': { sweet: 1.8, bitter: 1.5, potency: 1.5 },
  'triple sec': { sweet: 2.3, bitter: 0.6, potency: 1.5 },
  'orange liqueur': { sweet: 2.3, bitter: 0.6, potency: 1.5 },
  cointreau: { sweet: 2.3, bitter: 0.6, potency: 1.5 },
  'grand marnier': { sweet: 2.3, bitter: 0.5, potency: 1.5 },
  'orange curacao': { sweet: 2.3, bitter: 0.6, potency: 1.5 },
  'blue curacao': { sweet: 2.5, bitter: 0.3, potency: 1.5 },
  'maraschino liqueur': { sweet: 2, bitter: 0.5, potency: 1.5 },
  amaretto: { sweet: 2.5, bitter: 0.5, potency: 1.5 },
  kahlua: { sweet: 2.2, bitter: 1.2, potency: 1.5 },
  'coffee liqueur': { sweet: 2.2, bitter: 1.2, potency: 1.5 },
  'baileys irish cream': { sweet: 2, bitter: 0.2, potency: 1.2 },
  'irish cream': { sweet: 2, bitter: 0.2, potency: 1.2 },
  amarula: { sweet: 2.2, potency: 1.3 },
  'licor 43': { sweet: 2.5, potency: 1.5 },
  'creme de cacao': { sweet: 2.5, bitter: 0.4, potency: 1.5 },
  'creme de cassis': { sweet: 2.5, sour: 1, potency: 1.6 },
  'creme de violette': { sweet: 2.5, potency: 1.5 },
  'creme de mure': { sweet: 2.5, sour: 0.8, potency: 1.6 },
  'creme de peche': { sweet: 2.5, potency: 1.5 },
  'banana liqueur': { sweet: 2.5, potency: 1.5 },
  'creme de banane': { sweet: 2.5, potency: 1.5 },
  'raspberry liqueur': { sweet: 2.5, sour: 0.5, potency: 1.5 },
  'peach schnapps': { sweet: 2.5, potency: 1.4 },
  'peppermint schnapp': { sweet: 2.2, heat: 0.8, potency: 1.4 },
  'apricot brandy': { sweet: 2.3, bitter: 0.2, potency: 1.5 },
  'cherry brandy': { sweet: 2.2, bitter: 0.3, potency: 1.5 },
  limoncello: { sweet: 2.2, sour: 0.8, potency: 1.4 },
  'southern comfort': { sweet: 2, potency: 1.3 },
  goldwasser: { sweet: 2, potency: 1.3 },
  'sloe gin': { sweet: 2, sour: 1, potency: 1.3 },
  drambuie: { sweet: 2.2, bitter: 0.4, potency: 1.5 },
  sambuca: { sweet: 2, bitter: 0.4, potency: 1.5 },
  'melon liqueur': { sweet: 2.5, potency: 1.5 },
  'fernet branca': { bitter: 3, sweet: 0.8, potency: 1.5 },
  gentian: { bitter: 3, potency: 3 },
  benedictine: { sweet: 2, bitter: 1, potency: 1.5 },
  'green chartreuse': { bitter: 1.6, sweet: 1.6, potency: 1.5 },
  'yellow chartreuse': { sweet: 2, bitter: 1, potency: 1.5 },
  galliano: { sweet: 2, bitter: 0.8, potency: 1.5 },
  strega: { sweet: 2.2, bitter: 0.8, potency: 1.5 },
  falernum: { sweet: 2.2, sour: 0.3, potency: 1.5 },
  'elderflower cordial': { sweet: 2.5, sour: 0.4, potency: 1.5 },
  campari: { bitter: 3, sweet: 1.5, potency: 1.5 },
  aperol: { bitter: 1.6, sweet: 2, potency: 1.4 },
  'amaro montenegro': { bitter: 1.8, sweet: 1.8, potency: 1.5 },
  amaro: { bitter: 2, sweet: 1.8, potency: 1.5 },
  averna: { bitter: 1.8, sweet: 2.2, potency: 1.5 },
  cynar: { bitter: 2.2, sweet: 1.5, potency: 1.5 },
  suze: { bitter: 2.5, sweet: 1, potency: 1.5 },
  jagermeister: { sweet: 1.8, bitter: 1.5, potency: 1.4 },
  genepy: { sweet: 1.8, bitter: 1.5, potency: 1.5 },

  // ── Bitters ──────────────────────────────────────────────────────────────────────────────────────────
  bitters: { bitter: 3, potency: 6 },
  'angostura bitters': { bitter: 3, potency: 6 },
  'orange bitters': { bitter: 2.5, potency: 5 },
  "peychaud's bitters": { bitter: 2.5, potency: 5 },

  // ── Citrus and other juices ──────────────────────────────────────────────────────────────────────────
  'lemon juice': { sour: 3, bitter: 0.2, potency: 2.5 },
  'lime juice': { sour: 3, bitter: 0.2, potency: 2.5 },
  lemon: { sour: 2, bitter: 0.5, potency: 1 },
  lime: { sour: 2, bitter: 0.4, potency: 1 },
  orange: { sweet: 1.5, sour: 1, bitter: 0.4, potency: 1 },
  'orange juice': { sweet: 2, sour: 1.5, potency: 1.2 },
  'grapefruit juice': { sour: 2, bitter: 1.4, sweet: 1, potency: 1.5 },
  'pineapple juice': { sweet: 2, sour: 1.5, potency: 1.3 },
  'cranberry juice': { sour: 2.2, sweet: 1.5, bitter: 0.4, potency: 1.3 },
  'apple juice': { sweet: 2, sour: 0.7, potency: 1 },
  'grape juice': { sweet: 2.3, sour: 0.5, potency: 1 },
  'tomato juice': { umami: 2, sour: 1, sweet: 0.8, salty: 0.4, potency: 1 },
  lemonade: { sweet: 1.5, sour: 1.5, potency: 1 },
  juice: { sweet: 1.5, sour: 1.3, potency: 1.2 },
  fruit: { sweet: 1.5, sour: 1, potency: 1 },
  'maraschino cherry': { sweet: 2.5, sour: 0.3, potency: 1 },
  cherry: { sweet: 1.8, sour: 1, potency: 1 },
  pineapple: { sweet: 1.8, sour: 1.5, potency: 1 },

  // ── Sweeteners and syrups ────────────────────────────────────────────────────────────────────────────
  'simple syrup': { sweet: 3, potency: 2 },
  syrup: { sweet: 3, potency: 2 },
  'honey syrup': { sweet: 3, potency: 2 },
  'cinnamon syrup': { sweet: 2.8, heat: 0.2, potency: 2 },
  'ginger syrup': { sweet: 2.8, heat: 0.8, potency: 2 },
  sugar: { sweet: 3, potency: 2.5 },
  'powdered sugar': { sweet: 3, potency: 2.5 },
  'cane sugar': { sweet: 3, potency: 2.5 },
  'brown sugar': { sweet: 3, bitter: 0.1, potency: 2.5 },
  'palm sugar': { sweet: 3, potency: 2.5 },
  honey: { sweet: 3, potency: 2.5 },
  'maple syrup': { sweet: 3, potency: 2.5 },
  'agave syrup': { sweet: 3, potency: 2.5 },
  'raspberry syrup': { sweet: 2.8, sour: 0.5, potency: 2 },
  grenadine: { sweet: 2.6, sour: 0.8, potency: 1.8 },

  // ── Sodas, mixers, water ─────────────────────────────────────────────────────────────────────────────
  'soda water': { potency: 0 },
  'club soda': { potency: 0 },
  seltzer: { potency: 0 },
  water: { potency: 0 },
  'tonic water': { sweet: 0.9, bitter: 1.2, potency: 0.8 },
  'ginger ale': { sweet: 1.8, heat: 0.5, potency: 0.8 },
  'ginger beer': { sweet: 1.5, heat: 1, potency: 1 },
  coffee: { bitter: 2.2, sour: 0.5, potency: 1.3 },

  // ── Dairy and eggs ───────────────────────────────────────────────────────────────────────────────────
  cream: { sweet: 0.6, potency: 1 },
  'half and half': { sweet: 0.6, potency: 1 },
  milk: { sweet: 0.6, potency: 1 },
  'almond milk': { sweet: 0.5, potency: 1 },
  'coconut milk': { sweet: 1, potency: 1 },
  butter: { potency: 0 },
  ghee: { potency: 0 },
  'clarified butter': { potency: 0 },
  'egg white': { potency: 0 },
  'egg yolk': { umami: 0.3, potency: 1 },
  egg: { umami: 0.5, potency: 1 },
  buttermilk: { sour: 1.2, potency: 1 },
  yogurt: { sour: 1.5, sweet: 0.3, potency: 1 },
  mayonnaise: { sour: 0.8, salty: 0.3, potency: 1 },

  // ── Tomato products, stocks and the salty or umami seasonings ────────────────────────────────────────
  tomato: { umami: 2, sour: 1.5, sweet: 0.8, potency: 1 },
  'tomato paste': { umami: 3, sour: 1.8, sweet: 1.2, potency: 3 },
  'tomato sauce': { umami: 2, sour: 1.3, sweet: 1, potency: 1.2 },
  ketchup: { sweet: 2, sour: 1.5, umami: 1.5, salty: 1, potency: 1.5 },
  'chicken stock': { umami: 1.2, salty: 0.5, potency: 1 },
  'veal stock': { umami: 1.4, salty: 0.5, potency: 1 },
  'fish stock': { umami: 1.2, salty: 0.6, potency: 1 },
  dashi: { umami: 2, salty: 0.8, potency: 1 },
  'bonito flakes': { umami: 3, salty: 1, potency: 2 },
  miso: { umami: 3, salty: 2.5, sweet: 0.5, potency: 3 },
  salt: { salty: 3, potency: 25 },
  'soy sauce': { salty: 3, umami: 2.5, sweet: 0.3, potency: 4 },
  'fish sauce': { salty: 3, umami: 3, potency: 6 },
  'worcestershire sauce': { umami: 2.5, sour: 1.5, sweet: 1.5, salty: 1.5, potency: 5 },
  anchovy: { umami: 3, salty: 3, potency: 4 },
  parmesan: { umami: 2.5, salty: 2, potency: 2 },
  mozzarella: { salty: 0.8, umami: 0.5, potency: 1 },
  cheddar: { umami: 1.5, salty: 1.5, potency: 1.2 },
  gruyere: { umami: 1.8, salty: 1.3, potency: 1.2 },
  feta: { salty: 2.5, sour: 1, potency: 1.5 },
  olive: { salty: 2, bitter: 1, sour: 0.5, potency: 2 },
  caper: { salty: 2.5, sour: 2, potency: 3 },
  nori: { umami: 2, salty: 1, potency: 1.5 },
  yeast: { umami: 1, potency: 1 },

  // ── Acids ────────────────────────────────────────────────────────────────────────────────────────────
  vinegar: { sour: 3, potency: 3 },
  'red wine vinegar': { sour: 3, potency: 3 },
  'white wine vinegar': { sour: 3, potency: 3 },
  'rice vinegar': { sour: 2.2, sweet: 0.5, potency: 2.5 },
  tamarind: { sour: 3, sweet: 1, potency: 3 },

  // ── Heat: chilies, hot sauces, peppers, alliums, mustard ─────────────────────────────────────────────
  'hot sauce': { heat: 3, sour: 1, salty: 0.5, potency: 10 },
  'pepper sauce': { heat: 3, sour: 1, salty: 0.5, potency: 10 },
  chili: { heat: 3, potency: 8 },
  'red chili': { heat: 3, potency: 8 },
  'green chili pepper': { heat: 2.5, potency: 6 },
  'jalapeno chile': { heat: 2, potency: 4 },
  'scotch bonnet': { heat: 3, potency: 8 },
  'chili flake': { heat: 3, potency: 8 },
  'chili powder': { heat: 2.5, bitter: 0.3, potency: 6 },
  'cayenne pepper': { heat: 3, potency: 8 },
  'red pepper': { heat: 2.5, potency: 6 },
  'ancho chili': { heat: 1, sweet: 1, bitter: 0.5, potency: 3 },
  'guajillo chili': { heat: 1.5, sweet: 0.8, bitter: 0.5, potency: 3 },
  gochujang: { heat: 2, sweet: 1.5, umami: 1.5, salty: 1, potency: 3 },
  'curry paste': { heat: 3, salty: 1, umami: 1, potency: 5 },
  'black pepper': { heat: 2, potency: 5 },
  pepper: { heat: 2, potency: 5 },
  'white pepper': { heat: 2, potency: 5 },
  'sichuan peppercorn': { heat: 1.5, bitter: 0.5, potency: 5 },
  mustard: { heat: 2, sour: 1.5, salty: 0.5, potency: 3 },
  garlic: { heat: 1, umami: 0.4, sweet: 0.2, potency: 1.5 },
  onion: { sweet: 1.2, heat: 0.5, umami: 0.4, potency: 1 },
  'purple onion': { sweet: 1, heat: 0.8, potency: 1 },
  scallion: { heat: 0.8, sweet: 0.3, potency: 1 },
  shallot: { sweet: 1, heat: 0.6, potency: 1 },
  ginger: { heat: 1.8, sweet: 0.3, potency: 1.5 },
  radish: { heat: 1, bitter: 0.3, potency: 1 },

  // ── Herbs and spices (little taste of the six; their work is aroma) ──────────────────────────────────
  paprika: { sweet: 0.5, potency: 1 },
  'smoked paprika': { sweet: 0.4, bitter: 0.3, potency: 2 },
  cumin: { bitter: 0.5, potency: 2 },
  coriander: { sweet: 0.2, potency: 1.5 },
  cinnamon: { sweet: 0.8, potency: 2 },
  nutmeg: { sweet: 0.5, bitter: 0.3, potency: 3 },
  vanilla: { sweet: 0.6, bitter: 0.2, potency: 3 },
  clove: { heat: 1.5, bitter: 1, potency: 6 },
  cardamom: { sweet: 0.5, bitter: 0.3, potency: 3 },
  turmeric: { bitter: 0.8, potency: 3 },
  'garam masala': { heat: 0.5, bitter: 0.4, potency: 3 },
  saffron: { bitter: 0.5, potency: 10 },
  parsley: { bitter: 0.3, potency: 1 },
  thyme: { bitter: 0.3, potency: 2 },
  oregano: { bitter: 0.4, potency: 2 },
  cilantro: { bitter: 0.2, potency: 1 },
  basil: { sweet: 0.2, potency: 1 },
  'thai basil': { sweet: 0.2, bitter: 0.2, potency: 1 },
  mint: { bitter: 0.3, potency: 1 },
  tarragon: { bitter: 0.3, potency: 1.5 },
  'bay leaf': { bitter: 0.3, potency: 1 },
  'lime leaf': { bitter: 0.3, potency: 1 },
  lemongrass: { sour: 0.5, potency: 1 },

  // ── Proteins and vegetables: umami at a believable strength, not the top of the scale ───────────────
  chicken: { umami: 0.6, potency: 1 },
  beef: { umami: 1, potency: 1 },
  pork: { umami: 0.8, potency: 1 },
  lamb: { umami: 1, potency: 1 },
  shrimp: { umami: 1, sweet: 0.5, salty: 0.3, potency: 1 },
  salmon: { umami: 0.8, salty: 0.3, potency: 1 },
  'white fish': { umami: 0.5, salty: 0.2, potency: 1 },
  clam: { umami: 1.2, salty: 0.8, potency: 1 },
  mussel: { umami: 1.2, salty: 0.8, potency: 1 },
  bacon: { salty: 1.5, umami: 1.5, potency: 2 },
  mushroom: { umami: 1.5, potency: 1 },
  carrot: { sweet: 1.2, potency: 1 },
  celery: { bitter: 0.3, salty: 0.2, potency: 1 },
  'sweet pepper': { sweet: 1.2, potency: 1 },
  cucumber: { bitter: 0.2, sweet: 0.2, potency: 0.5 },
  vegetable: { sweet: 0.6, umami: 0.3, potency: 1 },
  meat: { umami: 0.8, potency: 1 },
  spinach: { bitter: 0.5, potency: 1 },
  eggplant: { bitter: 0.3, umami: 0.3, potency: 1 },
  chocolate: { sweet: 1.8, bitter: 1.2, potency: 1.5 },
  peanut: { sweet: 0.3, umami: 0.2, potency: 1 },
  tahini: { bitter: 0.5, potency: 1.5 },
  'sesame seed': { bitter: 0.3, sweet: 0.2, potency: 1 },

  // ── No taste worth charting (they still count as data and still water a recipe down a little) ───────
  'olive oil': { potency: 0 },
  'sesame oil': { potency: 0 },
  'palm oil': { potency: 0 },
  lard: { potency: 0 },
  flour: { potency: 0 },
  cornstarch: { potency: 0 },
  rice: { potency: 0 },
  pasta: { potency: 0 },
  potato: { potency: 0 },
  tofu: { potency: 0 },
};

/** Alternative spellings a recipe line can carry that mean a table entry (same rule as the bar keys). */
export const STRENGTH_ALIASES = {
  'club soda': 'club soda',
  'sparkling water': 'soda water',
  'worcestershire': 'worcestershire sauce',
  tabasco: 'hot sauce',
  'tabasco sauce': 'hot sauce',
  'sugar cube': 'sugar',
};

const AXES = ['sweet', 'sour', 'bitter', 'salty', 'umami', 'heat'];

/** The table entry for an ingredient name, or null. { axes: {six 0..3}, potency }. */
export function strengthFor(key) {
  if (typeof key !== 'string') return null;
  const k = key.trim().toLowerCase();
  const e = STRENGTHS[k] || STRENGTHS[STRENGTH_ALIASES[k]];
  if (!e) return null;
  const axes = Object.fromEntries(AXES.map((a) => [a, e[a] || 0]));
  return { axes, potency: e.potency };
}

// ── Typical amounts for lines that carry none ──────────────────────────────────────────────────────────

/**
 * A line with no usable amount ("1", "to taste", "1 stick", a bare dash) used to count as the MEAN weight of the
 * recipe's measured lines. With potency that goes wrong: a Bloody Mary's unmeasured Tabasco became a quarter of
 * the drink and one chili in nuoc cham a third of the sauce. So a table entry with a typical single portion says so
 * here, in grams (what one of it weighs, or what a cook adds when no amount is given). Any other table entry with
 * potency above 1.5 counts POTENT_DEFAULT_GRAMS. Ingredients not in the table keep the mean-of-the-recipe rule.
 * A bare count multiplies it ("6" chilies is 6 x 8 g; "8 limes" of lime juice is 8 x 30 g, the juice of one lime).
 */
export const DEFAULT_GRAMS = {
  'hot sauce': 2, 'pepper sauce': 2, 'worcestershire sauce': 2, bitters: 1, 'angostura bitters': 1, 'orange bitters': 1,
  "peychaud's bitters": 1, absinthe: 2, salt: 1.5, 'black pepper': 1, 'white pepper': 1, 'chili flake': 1, 'cayenne pepper': 1,
  'chili powder': 1.5, chili: 8, 'red chili': 8, 'green chili pepper': 10, 'jalapeno chile': 15, 'scotch bonnet': 8,
  sugar: 4, garlic: 3, onion: 110, 'purple onion': 90, scallion: 12, shallot: 30, ginger: 10,
  lime: 20, lemon: 25, orange: 60, 'lime juice': 30, 'lemon juice': 45, egg: 50, 'egg yolk': 18, 'egg white': 30, cinnamon: 3,
};
export const POTENT_DEFAULT_GRAMS = 3;

const VULGAR = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

/** The leading count of an amount ("6, rehydrated" is 6, "½" is 0.5), or null when it has none. */
function leadingCount(amount) {
  if (amount && typeof amount === 'object') return amount.unit == null && Number.isFinite(amount.qty) ? amount.qty : null;
  const m = String(amount ?? '').trim().match(/^(\d+(?:\.\d+)?|\d+\/\d+|[¼½¾⅓⅔])/);
  if (!m) return null;
  if (VULGAR[m[1]] != null) return VULGAR[m[1]];
  if (m[1].includes('/')) { const [a, b] = m[1].split('/').map(Number); return b ? a / b : null; }
  return Number(m[1]);
}

/** Grams to use for a line whose amount cannot be read, or null (the caller then uses the recipe's mean). */
export function defaultGrams(key, amount) {
  if (typeof key !== 'string') return null;
  const k = key.trim().toLowerCase();
  const name = STRENGTHS[k] ? k : STRENGTH_ALIASES[k];
  const e = name ? STRENGTHS[name] : null;
  if (!e) return null;
  const each = DEFAULT_GRAMS[name] ?? (e.potency > 1.5 ? POTENT_DEFAULT_GRAMS : null);
  if (each == null) return null;
  return each * (leadingCount(amount) ?? 1);
}

// ── Garnish and rim text ────────────────────────────────────────────────────────────────────────────────

/**
 * A rim lives in a cocktail's garnish text ("Kosher salt", "Kosher salt and pepper"), not in an ingredient line.
 * It is a thin dusting: a salt rim counts as half a gram of salt, a sugar rim as a gram of sugar, a chili or
 * tajin rim as half a gram of chili powder. Only those three are read; any other garnish adds nothing.
 * Returns extra lines [{ key, amount }] (amount in grams) for the chart.
 */
export function garnishTasteLines(garnish) {
  const text = String(garnish || '').toLowerCase();
  if (!text) return [];
  const out = [];
  if (/\bsalt(ed)?\b/.test(text)) out.push({ key: 'salt', amount: 0.5 });
  if (/\bsugar(ed)?\b/.test(text) && /\b(rim|rimmed|sugared)\b|\bsugar\b/.test(text)) out.push({ key: 'sugar', amount: 1 });
  if (/\b(tajin|chili|chile)\b/.test(text)) out.push({ key: 'chili powder', amount: 0.5 });
  return out;
}
