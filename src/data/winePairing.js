/**
 * winePairing.js — rank wine styles (public/data/wine_styles.json) for a
 * dish, using the classic pairing rules a sommelier applies, made explicit:
 *
 *   1. Weight: the wine's body should match the dish's richness.
 *   2. Acid: the wine needs at least as much acid as the dish; high acid
 *      cuts fat, cream and fried food.
 *   3. Sweetness: a dessert needs a wine at least as sweet. A dry wine
 *      with dessert tastes sour; a sweet wine with a savoury main cloys.
 *   4. Tannin wants protein and fat (steak), clashes with fish (metallic),
 *      chili heat (burns) and strong umami (bitter).
 *   5. Heat: low alcohol and a touch of sweetness calm chili; high alcohol
 *      amplifies it.
 *   6. Bubbles and acid love salt and fried food.
 *   7. Flavour bridges: earthy wine with mushrooms, peppery Syrah with
 *      black pepper, herbal Sauvignon with green herbs …
 *   8. Region: "what grows together goes together".
 *   9. Classic matches listed for the style (small weight, so the rules
 *      above do the work and the list cannot carry a wine on its own).
 *
 * Dish traits come from ingredient names (regex lexicons) plus the
 * ingredient category in proData (`ctx.categoryOf`), optionally the
 * cooking-method text (fry / braise / grill) and the dish type.
 *
 * Evaluated with scripts/evalWinePairing.mjs against an answer key of
 * sommelier pairings written before this file.
 */

// ── Ingredient lexicons ───────────────────────────────────────────────
const RX = {
  redMeat: /\b(beef|lamb|venison|veal|mutton|steak|brisket|oxtail|short rib|bison|goat)\b/,
  pork: /\b(pork|bacon|ham|sausage|chorizo|prosciutto|pancetta|andouille|guanciale|salami|pork rib|pork belly)\b/,
  poultry: /\b(chicken|turkey|hen|quail)\b/,
  duck: /\b(duck|goose)\b/,
  oilyFish: /\b(salmon|tuna|mackerel|sardine|anchov|trout|eel)/,
  whiteFish: /\b(white fish|cod|halibut|sole|sea bass|snapper|tilapia|haddock|fish)\b/,
  shellfish: /\b(shrimp|prawn|clam|mussel|oyster|scallop|lobster|crab|squid|octopus|langoustine)/,
  cheese: /\b(cheese|cheddar|parmesan|pecorino|gruyere|mozzarella|ricotta|feta|brie|paneer|mascarpone|cotija|monterey jack|gorgonzola|roquefort|stilton|manchego|halloumi)\b/,
  cream: /\b(cream|butter|ghee|half and half|coconut milk|coconut cream|mayonnaise|egg yolk|bechamel|creme)\b/,
  fat: /\b(oil|lard|bacon|pork belly|duck fat|goose fat|peanut butter)\b/,
  acid: /\b(lemon|lime|vinegar|tamarind|yogurt|buttermilk|verjus|pickle|sherry vinegar|balsamic|capers?)\b/,
  tomato: /\btomato/,
  sweet: /\b(sugar|honey|syrup|molasses|caramel|chocolate|jam|condensed milk|marshmallow|maple|brown sugar|palm sugar|toffee|ladyfinger|cookie|cake|pie crust|puff pastry|phyllo|custard|meringue)\b/,
  chili: /\b(chili|chile|chilli|chipotle|jalapeno|serrano|cayenne|gochujang|sichuan|curry paste|red pepper|hot sauce|harissa|sriracha|doubanjiang|chili oil|guajillo|ancho|poblano|habanero|green chili)\b/,
  umami: /\b(soy sauce|miso|fish sauce|mushroom|parmesan|anchovy|dashi|oyster sauce|worcestershire|shiitake|porcini|kombu|nori|tomato paste|bonito)\b/,
  salty: /\b(soy sauce|fish sauce|anchovy|olive|caper|feta|parmesan|pecorino|bacon|ham|prosciutto|chorizo|miso|salt)\b/,
  smoky: /\b(barbecue|bbq|chipotle|smoked|paprika|bacon|chorizo|liquid smoke)\b/,
  earthy: /\b(mushroom|truffle|beet|lentil|porcini|morel|shiitake|chickpea|black bean)\b/,
  herbal: /\b(basil|thyme|rosemary|oregano|sage|parsley|cilantro|mint|dill|tarragon|chive|bay leaf|herb|pesto|scallion|green bean|pea|asparagus)\b/,
  warmSpice: /\b(cinnamon|cumin|coriander|garam masala|star anise|five.spice|clove|cardamom|allspice|nutmeg|ginger|turmeric|fenugreek|curry)\b/,
  pepper: /\bblack pepper|white pepper|peppercorn\b/,
  citrus: /\b(lemon|lime|orange|grapefruit|yuzu|lemongrass)\b/,
  nutty: /\b(almond|walnut|hazelnut|pecan|pistachio|peanut|sesame|pine nut|cashew)\b/,
  chocolate: /\b(chocolate|cocoa|espresso|coffee|mocha)\b/,
  fruit: /\b(apple|pear|peach|apricot|plum|cherry|berry|strawberry|raspberry|mango|pineapple|fig|date|raisin|quince|papaya|coconut)\b(?!.*\b(vinegar|cider vinegar)\b)/,
  tropical: /\b(coconut|mango|pineapple|papaya|passion fruit|lychee)\b/,
};
const CATEGORY_HINT = {
  protein: null, // too broad; the name lexicons decide the protein type
  dairy: 'cream', fat: 'fat', acid: 'acid', citrus: 'citrus', sweetener: 'sweet', confection: 'sweet',
  // No 'spice' hint: the category also holds paprika and black pepper, and
  // a dry rub is not a curry. warmSpice comes from its name lexicon only.
  chili: 'chili', umami: 'umami', herb: 'herbal', nut: 'nutty', fruit: 'fruit',
};

// Stocks, broths and sauces name a protein without being one.
const NOT_PROTEIN = /\b(stock|broth|bouillon|consomme|gravy|base|fat|sauce|paste|seasoning)\b/;
const PROTEIN_KEYS = new Set(['redMeat', 'pork', 'poultry', 'duck', 'oilyFish', 'whiteFish', 'shellfish']);
// Mild or smoky dried chilies add flavour more than burn.
const MILD_CHILI = /\b(ancho|guajillo|poblano|paprika|chipotle|aleppo|pasilla|mulato|cayenne|chili powder)\b/;
// A baked dish with one of these and some sugar is a dessert.
const DESSERT_MARKER = /\b(vanilla|chocolate|cocoa|caramel|custard|cream|mascarpone|ladyfinger|honey|maple|cinnamon|apple|pear|peach|berry|strawberry|raspberry|lemon curd|nut|almond|walnut|pistachio|pecan|chocolate chip|gelatin)\b/;
const CURED_PORK = /\b(bacon|pancetta|guanciale|prosciutto|ham|chorizo|salami|andouille)\b/;
const SAVOURY_MARKER = /\b(garlic|onion|salt|cheese|cheddar|parmesan|gruyere|feta|cumin|yeast|spinach|potato|pea)\b/;

const has = (key, name) => (PROTEIN_KEYS.has(key) && NOT_PROTEIN.test(name) ? false : RX[key].test(name));

/**
 * Dish traits on 0..1 scales (protein is a label).
 * @param {string[]} ingredients
 * @param {{ categoryOf?: (name:string)=>string|null, methodText?: string, dishType?: string }} ctx
 */
export function dishProfile(ingredients, ctx = {}) {
  const names = (ingredients || []).map((i) => String(i || '').toLowerCase().trim()).filter(Boolean);
  const n = Math.max(names.length, 1);
  const count = (key) => names.filter((nm) => has(key, nm) || CATEGORY_HINT[ctx.categoryOf?.(nm)] === key).length;
  const method = String(ctx.methodText || '').toLowerCase();

  // Cured pork used as seasoning (bacon in chowder, chorizo in paella) only
  // decides the protein when nothing else does: the main protein decides.
  const mainPork = names.some((x) => has('pork', x) && !CURED_PORK.test(x));
  const protein = names.some((x) => has('redMeat', x)) ? 'red meat'
    : names.some((x) => has('duck', x)) ? 'duck'
      : mainPork ? 'pork'
        : names.some((x) => has('poultry', x)) ? 'poultry'
          : names.some((x) => has('shellfish', x)) ? 'shellfish'
            : names.some((x) => has('oilyFish', x)) ? 'oily fish'
              : names.some((x) => has('whiteFish', x)) ? 'white fish'
                : names.some((x) => has('pork', x)) ? 'pork'
                  : 'none';

  const sweetCount = count('sweet');
  const savouryProtein = protein !== 'none';
  const hasSugar = names.some((x) => /\b(sugar|honey|syrup|maple)\b/.test(x));
  const dessertMarkers = names.filter((x) => DESSERT_MARKER.test(x)).length;
  const savouryMarkers = names.filter((x) => SAVOURY_MARKER.test(x)).length;
  const dessert = !savouryProtein && (
    (ctx.dishType === 'baking' && hasSugar && dessertMarkers >= 1 && savouryMarkers <= 1)
    || sweetCount >= 3);

  const fried = /\b(deep.fr|fry|fried|frying)\b/.test(method);
  const braised = /\b(braise|braising|stew)\b/.test(method);
  const soup = /\b(soup|broth|ladle|chowder)\b/.test(method) || names.some((x) => /\b(broth|stock|dashi)\b/.test(x)) && /\bladle|simmer\b/.test(method);
  const grilled = /\b(grill|char|charred|barbecue|smok)/.test(method);
  // Real char and smoke (grill, barbecue sauce, chipotle) — not bacon or paprika.
  const charred = grilled || names.some((x) => /\b(barbecue|bbq|chipotle|smoked|liquid smoke)\b/.test(x));
  const cookedWith = {
    red: names.some((x) => /\bred wine\b/.test(x)),
    white: names.some((x) => /\b(white wine|dry white)\b/.test(x)),
  };
  const hotChili = names.filter((x) => (has('chili', x) || ctx.categoryOf?.(x) === 'chili') && !MILD_CHILI.test(x)).length;
  const mildChili = names.filter((x) => MILD_CHILI.test(x)).length;

  const sat = (x, k = 2) => Math.min(1, x / k);
  const richness = Math.min(1,
    sat(count('cream') + count('cheese') * 0.8 + count('fat') * 0.5, 2.5) * 0.7
    + (protein === 'red meat' ? 0.35 : protein === 'duck' || protein === 'pork' ? 0.25 : 0)
    + (fried ? 0.2 : 0) + (braised ? 0.15 : 0) - (soup ? 0.15 : 0));

  return {
    protein,
    dessert,
    richness,
    acidity: Math.min(1, sat(count('acid') + count('tomato') * 0.8 + count('citrus') * 0.5, 2)),
    sweetness: dessert ? Math.max(0.7, sat(sweetCount, 3)) : Math.min(0.5, sat(sweetCount, 4)),
    heat: sat(hotChili + mildChili * 0.25, 2),
    umami: sat(count('umami'), 2.5),
    salty: sat(count('salty'), 2.5),
    smoky: Math.min(1, sat(count('smoky'), 2) + (grilled ? 0.3 : 0)),
    earthy: sat(count('earthy'), 2),
    herbal: sat(count('herbal'), 2.5),
    spice: sat(count('warmSpice'), 2.5),
    pepper: sat(names.filter((x) => has('pepper', x)).length, 1),
    citrus: sat(count('citrus'), 2),
    nutty: sat(count('nutty'), 2),
    chocolate: sat(names.filter((x) => has('chocolate', x)).length, 1),
    fruit: sat(count('fruit'), 3),
    tropical: sat(names.filter((x) => has('tropical', x)).length, 1),
    tomato: names.some((x) => has('tomato', x)),
    fried,
    braised,
    grilled,
    charred,
    soup,
    cookedWith,
  };
}

/** Dish weight on the wines' 1–5 body scale. */
export function dishWeight(p) {
  const base = { 'red meat': 3.4, duck: 3.1, pork: 2.8, poultry: 2.5, 'oily fish': 2.5, 'white fish': 2, shellfish: 1.8, none: 2.2 }[p.protein];
  return Math.max(1, Math.min(5, base + p.richness * 1.4 + (p.braised ? 0.4 : 0)
    - (p.soup ? 0.8 : 0) - (p.acidity > 0.6 && !p.dessert ? 0.2 : 0)));
}

// Wine aroma tag → dish trait it echoes, with the reason text.
const BRIDGES = [
  [['earthy', 'mushroom', 'truffle'], 'earthy', 'earthy notes echo the mushrooms'],
  [['herbal'], 'herbal', 'green, herbal notes meet the herbs'],
  [['pepper', 'white pepper'], 'pepper', 'peppery wine for a peppery dish'],
  [['spice', 'ginger'], 'spice', 'spice in the glass mirrors the spices'],
  [['smoky', 'toast'], 'smoky', 'smoky, toasty notes meet the char'],
  [['citrus'], 'citrus', 'citrus lift matches the citrus'],
  [['nutty', 'almond', 'hazelnut'], 'nutty', 'nutty notes echo the nuts'],
  [['chocolate'], 'chocolate', 'dark-fruit and cocoa meet the chocolate'],
  [['caramel', 'honey', 'dried fruit', 'raisin'], 'sweetness', 'caramel and honey tones meet the dessert'],
  [['stone fruit', 'apricot', 'peach', 'apple', 'pear', 'quince'], 'fruit', 'orchard fruit echoes the fruit'],
  [['tropical', 'passion fruit', 'lychee'], 'tropical', 'tropical notes meet the tropical fruit'],
  [['butter', 'vanilla'], 'richness', 'buttery texture meets the cream'],
];

/**
 * The ideal wine for a dish on the wines' own scales — what a sommelier
 * is looking for before picking a bottle. scoreWine measures each wine's
 * distance from this, one dimension at a time, so no wine can win by
 * collecting many small bonuses.
 */
export function idealWine(p) {
  const clamp = (v, lo = 1, hi = 5) => Math.max(lo, Math.min(hi, v));
  if (p.dessert) {
    return {
      body: clamp(3 + p.richness * 1.5), acidity: 3.5, tannin: p.chocolate > 0.5 ? 2.5 : 0.5,
      sweetness: clamp(4 + p.sweetness * 0.8), alcohol: 3, oak: p.nutty > 0.3 || p.chocolate > 0.3 ? 1.5 : 0.5,
      colour: p.chocolate > 0.5 ? 'red' : 'any', sparkling: 0, heat: 0,
    };
  }
  const meat = p.protein === 'red meat';
  const fish = p.protein === 'shellfish' || p.protein === 'white fish' || p.protein === 'oily fish';
  // Smoke and char on meat call for more structure (BBQ wants Zinfandel, not Chenin).
  const charredMeat = (meat || p.protein === 'pork' || p.protein === 'duck') && p.charred ? 1 : 0;
  const tanninBase = charredMeat * 1.2 + (meat ? 2.2 + 2.3 * p.richness + (p.grilled ? 0.5 : 0)
    : p.protein === 'duck' ? 2.4 + p.richness
      : p.protein === 'pork' ? 1.6 + p.richness
        : p.protein === 'poultry' ? 1.4 + 0.6 * p.richness
          : p.protein === 'oily fish' ? 0.8
            : fish ? 0.2
              : 1.2 + p.earthy + p.richness * 0.5);
  // Chili heat burns with tannin and alcohol; spice and umami make tannin bitter.
  const tannin = clamp(tanninBase - 2.2 * p.heat - 1.2 * p.umami * (meat ? 0.4 : 1) - 1.4 * p.spice, 0, 5);
  return {
    body: Math.min(5, dishWeight(p) + charredMeat * 0.5),
    acidity: clamp(2.6 + 1.6 * p.acidity + 0.9 * p.richness * (p.fried ? 1.3 : 0.7) + 0.6 * p.salty + (p.tomato ? 0.8 : 0)),
    tannin,
    sweetness: clamp(1 + 2 * p.heat + 1.3 * p.sweetness + 0.6 * p.spice * (p.heat > 0.2 ? 1 : 0.4)),
    alcohol: clamp(3 + 0.8 * p.richness - 1.8 * p.heat),
    oak: Math.max(0, Math.min(2, (p.smoky > 0.4 ? 1.2 : 0) + (p.richness > 0.5 && !fish ? 0.6 : 0) + (p.braised ? 0.3 : 0) - (fish && p.richness < 0.4 ? 1 : 0))),
    colour: p.cookedWith.red ? 'red' : p.cookedWith.white ? 'white'
      : meat || p.protein === 'duck' ? 'red'
        : fish && p.protein !== 'oily fish' ? 'white' : 'any',
    sparkling: Math.min(1, (p.fried ? 0.7 : 0) + p.salty * 0.6),
    heat: p.heat,
  };
}

/**
 * Score one wine for a dish profile.
 * @returns {{ score: number, reasons: string[] }}
 */
export function scoreWine(wine, p, ctx = {}, recipeIngredients = []) {
  const t = idealWine(p);
  const reasons = []; // [weight, text]
  const red = wine.colour === 'red';
  let score = 1;

  // Structure: penalise distance from the ideal, asymmetrically where it
  // matters (too little acid, too much tannin, too dry for a dessert).
  const d = (a, b) => Math.abs(a - b);
  score -= 0.28 * d(wine.body, t.body);
  score -= wine.acidity < t.acidity ? 0.3 * (t.acidity - wine.acidity) : 0.08 * (wine.acidity - t.acidity);
  score -= wine.tannin > t.tannin ? 0.32 * (wine.tannin - t.tannin) : 0.12 * (t.tannin - wine.tannin);
  score -= wine.sweetness < t.sweetness ? 0.55 * (t.sweetness - wine.sweetness) : 0.45 * (wine.sweetness - t.sweetness);
  score -= (t.heat > 0.2 ? 0.25 : 0.06) * Math.max(0, wine.alcohol - t.alcohol);
  score -= 0.12 * d(wine.oak, t.oak);
  if (t.colour === 'white' && red) score -= wine.tannin <= 2 ? 0.3 : 0.6;
  if (t.colour === 'red' && !red) score -= wine.body >= 4 && wine.colour === 'white' ? 0.25 : 0.45;
  if (wine.sparkling && wine.sweetness <= 2) score += 0.25 * t.sparkling - (t.body >= 4 ? 0.2 : 0);

  // Reasons for the structural fit, strongest first.
  if (p.dessert && wine.sweetness >= t.sweetness - 0.5) reasons.push([0.9, 'sweeter than the dessert, so neither tastes flat']);
  if (!p.dessert && t.heat > 0.2 && wine.sweetness >= 2 && wine.alcohol <= 3) reasons.push([0.8, 'off-dry and low in alcohol, it calms the chili heat']);
  if (!p.dessert && t.tannin >= 3.5 && wine.tannin >= 3.5) reasons.push([0.7, 'firm tannin meets the red meat and fat']);
  if (!p.dessert && p.tomato && red && wine.acidity >= 4) reasons.push([0.6, 'bright acid stands up to the tomato']);
  if (!p.dessert && (p.fried || p.richness > 0.5) && wine.acidity >= 4) reasons.push([0.5, p.fried ? 'high acid cuts the fried richness' : 'high acid cuts the richness']);
  if (wine.sparkling && t.sparkling > 0.3 && wine.sweetness <= 2) reasons.push([0.55, p.fried ? 'bubbles scrub the fried batter' : 'bubbles and acid refresh the salt']);
  if (p.spice > 0.4 && wine.tannin <= 1 && (wine.family === 'aromatic-white' || wine.family === 'rose')) reasons.push([0.5, 'aromatic, low-tannin wine for a spiced dish']);
  if (t.colour === 'white' && !red && wine.tannin === 0 && wine.acidity >= 4) reasons.push([0.35, 'crisp white for the seafood']);
  if (d(wine.body, t.body) <= 0.6) reasons.push([0.3, t.body >= 3.8 ? 'full body matches a rich dish' : t.body <= 2.2 ? 'light enough not to swamp it' : 'its weight matches the dish']);
  if (wine.oak >= 2 && t.oak >= 1) reasons.push([0.3, p.smoky > 0.4 ? 'toasty oak meets the smoke and char' : 'buttery oak meets the cream']);

  // Cook with it, drink it.
  if (p.cookedWith.red && red && wine.body <= 4 && !wine.sparkling && wine.sweetness <= 2) { score += 0.3; reasons.push([0.75, 'the red wine in the pot points to a red in the glass']); }
  if (p.cookedWith.white && wine.colour === 'white' && wine.sweetness <= 2) { score += 0.2; reasons.push([0.6, 'the white wine in the pot points to a white in the glass']); }

  // Flavour bridges (cap 3).
  let bridges = 0;
  for (const [tags, trait, text] of BRIDGES) {
    if (bridges >= 3) break;
    const v = trait === 'richness' ? p.richness : trait === 'sweetness' ? (p.dessert ? 1 : 0) : p[trait];
    if (v > 0.3 && tags.some((tag) => wine.aromas.includes(tag))) {
      score += 0.1 * v + 0.03; bridges += 1; reasons.push([0.4 + 0.1 * v, text]);
    }
  }
  if (wine.aromas.includes('saline') && p.protein === 'shellfish') { score += 0.15; reasons.push([0.45, 'a briny edge for the shellfish']); }

  // Region.
  if (ctx.cuisine && wine.cuisine === ctx.cuisine) { score += 0.12; reasons.push([0.35, `${ctx.cuisine} wine with ${ctx.cuisine} food`]); }

  // Classic matches (small, capped — the structure does the work).
  const recipe = new Set((recipeIngredients || []).map((x) => String(x).toLowerCase()));
  const classic = (wine.classicMatches || []).filter((m) => recipe.has(m));
  if (classic.length) { score += Math.min(0.2, 0.07 * classic.length); reasons.push([0.42, `a classic match for ${classic.slice(0, 2).join(' and ')}`]); }

  const texts = reasons.sort((a, b) => b[0] - a[0]).map(([, r]) => r);
  return { score, reasons: [...new Set(texts)].slice(0, 2) };
}

/**
 * Rank wines for a recipe. Result shape matches the other "goes well
 * with" rankers: { item, similarity (0..1), reasons, pairedVia: [] }.
 */
export function rankWinesForRecipe(recipeIngredients, wines, ctx = {}, topN = 8) {
  const p = dishProfile(recipeIngredients, ctx);
  const scored = (wines || []).map((wine) => {
    const { score, reasons } = scoreWine(wine, p, ctx, recipeIngredients);
    return { item: wine, score, reasons };
  }).sort((a, b) => b.score - a.score);
  const top = scored[0]?.score ?? 0;
  return scored.slice(0, topN).map(({ item, score, reasons }) => ({
    item,
    // Relative to this dish's best wine, so the badge reads "how close to
    // the top pick", not an absolute probability.
    similarity: top > 0 ? Math.max(0, Math.min(1, score / top)) : 0,
    reasons,
    pairedVia: [],
  }));
}

/** Words for the 1–5 scales on wine cards. */
export function scaleWord(kind, v) {
  const words = {
    body: ['', 'very light', 'light', 'medium', 'full', 'very full'],
    acidity: ['', 'soft', 'gentle', 'fresh', 'crisp', 'racy'],
    tannin: ['none', 'barely there', 'soft', 'medium', 'firm', 'grippy'],
    sweetness: ['', 'bone dry', 'off-dry', 'medium-sweet', 'sweet', 'lusciously sweet'],
  }[kind];
  return words?.[v] ?? String(v);
}
