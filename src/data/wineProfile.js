/**
 * wineProfile.js — what a wine card shows about a style's flavour profile
 * and how that profile maps to food (bead WINE-6).
 *
 *   wineProfileAxes(wine)  → structure axes for a radar (0–1) + aroma families
 *   wineFoodMapping(wine)  → "this wine → food" rules in plain words, each
 *                            with the trait it serves, example foods from the
 *                            style's classic matches, and what to avoid
 *
 * The rules restate the pairing engine's logic (src/data/winePairing.js) at
 * the same thresholds, so the card explains the ranking rather than a second
 * opinion. The engine is the source of truth: if its thresholds move, the
 * consistency tests in src/data/__tests__/wineProfile.test.js should fail.
 */

// Structure axes on the wine data's own scales.
export const STRUCTURE_AXES = [
  { key: 'body', label: 'Body', lo: 1, hi: 5 },
  { key: 'acidity', label: 'Acidity', lo: 1, hi: 5 },
  { key: 'tannin', label: 'Tannin', lo: 0, hi: 5 },
  { key: 'sweetness', label: 'Sweetness', lo: 1, hi: 5 },
  { key: 'alcohol', label: 'Alcohol', lo: 1, hi: 5 },
  { key: 'oak', label: 'Oak', lo: 0, hi: 2 },
];

// Aroma families, in display order. Every aroma tag in
// public/data/wine_styles.json belongs to exactly one (checked by test).
export const AROMA_FAMILIES = [
  { id: 'fruit', label: 'Fruit', color: '#f87171', tags: ['citrus', 'green apple', 'apple', 'pear', 'quince', 'melon', 'stone fruit', 'apricot', 'peach', 'orange', 'tropical', 'passion fruit', 'lychee', 'grape', 'red fruit', 'strawberry', 'raspberry', 'cherry', 'black fruit', 'blackberry', 'plum', 'jam', 'dried fruit', 'raisin'] },
  { id: 'floral', label: 'Floral', color: '#f9a8d4', tags: ['floral'] },
  { id: 'herbal', label: 'Herbal', color: '#86efac', tags: ['herbal', 'olive', 'tomato', 'mint'] },
  { id: 'earthy', label: 'Earthy', color: '#a8a29e', tags: ['earthy', 'mushroom', 'truffle', 'leather'] },
  { id: 'spice', label: 'Spice', color: '#fb923c', tags: ['spice', 'pepper', 'white pepper', 'ginger'] },
  { id: 'oak-toast', label: 'Oak & toast', color: '#d6a46c', tags: ['toast', 'vanilla', 'butter', 'smoky', 'chocolate', 'yeasty'] },
  { id: 'nutty-oxidative', label: 'Nutty & oxidative', color: '#fbbf24', tags: ['nutty', 'almond', 'hazelnut', 'caramel', 'honey'] },
  { id: 'mineral-saline', label: 'Mineral & saline', color: '#93c5fd', tags: ['mineral', 'saline'] },
];
const FAMILY_OF = new Map(AROMA_FAMILIES.flatMap((f) => f.tags.map((t) => [t, f.id])));

/** The aroma family an aroma tag belongs to, or null. */
export function aromaFamilyOf(tag) {
  return FAMILY_OF.get(String(tag || '').toLowerCase()) || null;
}

// Value / scale top, so the bottom of a 1–5 scale reads as 0.2 rather than
// collapsing to the centre: a light, dry wine still draws a visible shape.
const norm = (v, lo, hi) => Math.max(0, Math.min(1, (Number(v) || 0) / hi));

/**
 * Radar axes and aroma breakdown for one wine.
 * @returns {{
 *   axes: { key, label, raw, value }[],        // value in 0..1
 *   values: Record<string, number>,             // key → value, for a radar
 *   aromaFamilies: { id, label, color, tags: string[], share }[], // non-empty, strongest first
 *   unmappedAromas: string[],
 * }}
 */
export function wineProfileAxes(wine) {
  const w = wine || {};
  const axes = STRUCTURE_AXES.map(({ key, label, lo, hi }) => ({ key, label, raw: w[key] ?? lo, value: norm(w[key] ?? lo, lo, hi) }));
  const values = Object.fromEntries(axes.map((a) => [a.key, a.value]));
  const aromas = (w.aromas || []).map((a) => String(a).toLowerCase());
  const total = aromas.length || 1;
  const aromaFamilies = AROMA_FAMILIES
    .map((f) => {
      const tags = aromas.filter((a) => FAMILY_OF.get(a) === f.id);
      return { id: f.id, label: f.label, color: f.color, tags, share: tags.length / total };
    })
    .filter((f) => f.tags.length > 0)
    .sort((a, b) => b.share - a.share); // stable: ties keep display order
  const unmappedAromas = aromas.filter((a) => !FAMILY_OF.has(a));
  return { axes, values, aromaFamilies, unmappedAromas };
}

// Foods from a style's classicMatches that illustrate each rule.
const FOOD = {
  acidFoods: /\b(tomato|pizza sauce|lemon|lime|goat cheese|feta|cream|butter|brie|gruyere|ricotta|mozzarella|pork|sausage|ham|prosciutto|potato chip|popcorn|duck|salmon|avocado)\b/,
  redMeat: /\b(beef|lamb|venison|veal|steak|brisket|rabbit|duck|sausage|chorizo|pork rib)\b/,
  lightRed: /\b(chicken|turkey|pork|ham|sausage|duck|mushroom|salmon|tuna|rabbit|prosciutto|truffle)\b/,
  oxidative: /\b(mushroom|soy sauce|miso|parmesan|almond|walnut|pecan|caramel|toffee|fig|cheddar|beef stock)\b/,
  midMeat: /\b(pork|duck|lamb|sausage|chicken|turkey|rabbit|mushroom|veal|chorizo)\b/,
  fishSpice: /\b(fish|oyster|mussel|clam|shrimp|scallop|crab|lobster|squid|sardine|trout|tuna|salmon|curry|chili|ginger|lemongrass|fish sauce|five-spice|cilantro|caviar|anchovy)\b/,
  heat: /\b(chili|curry|ginger|lemongrass|fish sauce|tamarind|five-spice|cilantro|lime)\b/,
  saltyFried: /\b(potato chip|popcorn|oyster|caviar|olive|prosciutto|ham|chorizo|parmesan|manchego|anchovy|shrimp|sausage|pizza sauce)\b/,
  rich: /\b(beef|lamb|venison|duck|lobster|cream|butter|mushroom|truffle|porcini|cheddar|gorgonzola|parmesan|pork rib|brisket|lasagna|lamb shank|pumpkin)\b/,
  delicate: /\b(oyster|mussel|clam|white fish|shrimp|scallop|crab|trout|sardine|pea|asparagus|cucumber|zucchini|melon|ricotta|mozzarella|chive|goat cheese|prosciutto)\b/,
  smokeButter: /\b(barbecue|bbq|smoked|bacon|pork rib|brisket|butter|cream|corn|lobster|steak|lamb|chorizo|paprika|mushroom|caramel|pecan|walnut)\b/,
  dessert: /\b(blue cheese|roquefort|stilton|gorgonzola|custard|cake|caramel|toffee|chocolate|fig|almond|hazelnut|walnut|pecan|peach|apricot|strawberry|raspberry|lemon curd|ladyfinger|mascarpone|honey|christmas pudding|pumpkin|pear|orange)\b/,
};
const examplesFor = (wine, rx, k = 4) => (wine.classicMatches || []).filter((m) => rx.test(String(m).toLowerCase())).slice(0, k);

// Aroma tag → the dish trait it bridges to, mirroring the engine's BRIDGES.
const BRIDGES = [
  [['earthy', 'mushroom', 'truffle'], 'mushrooms, truffle, lentils'],
  [['herbal'], 'green herbs, pesto, asparagus'],
  [['pepper', 'white pepper'], 'black-pepper crusts'],
  [['spice', 'ginger'], 'warm spices'],
  [['smoky', 'toast'], 'grilled and smoked food'],
  [['citrus'], 'lemon, lime and citrus dressings'],
  [['nutty', 'almond', 'hazelnut'], 'nuts'],
  [['chocolate'], 'chocolate'],
  [['caramel', 'honey', 'dried fruit', 'raisin'], 'caramel and honeyed desserts'],
  [['stone fruit', 'apricot', 'peach', 'apple', 'pear', 'quince'], 'orchard fruit'],
  [['tropical', 'passion fruit', 'lychee'], 'tropical fruit'],
  [['butter', 'vanilla'], 'creamy, buttery dishes'],
];

/**
 * Plain-word "this wine → food" rules for one wine, at the engine's thresholds.
 * @returns {{
 *   rules: { id, trait, text, examples: string[] }[],
 *   bridges: string[],      // aroma → food echoes
 *   avoid: { id, text }[],
 *   goodWith: string[],     // the style's classic matches
 * }}
 */
export function wineFoodMapping(wine) {
  const w = wine || {};
  const sweetWine = (w.sweetness ?? 1) >= 4;
  const rules = [];
  const avoid = [];
  const rule = (id, trait, text, rx) => rules.push({ id, trait, text, examples: rx ? examplesFor(w, rx) : [] });

  // Sweetness — engine: a dessert's ideal sweetness is 4+; a dry wine with
  // sugar loses 0.55 per point short; a sweet wine with a savoury main loses
  // 0.45 per point over.
  if (sweetWine) {
    rule('dessert', 'sweet', 'Desserts at least as sweet as the wine, blue cheese, foie gras', FOOD.dessert);
    avoid.push({ id: 'savoury-main', text: 'Savoury mains — the sweetness cloys' });
  } else if ((w.sweetness ?? 1) <= 1) {
    avoid.push({ id: 'dessert', text: 'Desserts — a dry wine tastes sour next to sugar' });
  }

  // Heat — engine: off-dry (≥2) and low alcohol (≤3) "calms the chili heat";
  // alcohol above the dish's ideal is penalised harder when there is heat.
  if (!sweetWine && (w.sweetness ?? 1) >= 2 && (w.alcohol ?? 3) <= 3 && (w.tannin ?? 0) <= 2) {
    rule('heat', 'off-dry, low alcohol', 'Calms chili heat: Thai, Sichuan, curries', FOOD.heat);
  }
  if ((w.alcohol ?? 3) >= 4) {
    avoid.push({ id: 'hot-chili', text: 'Hot chili — high alcohol makes the burn worse' });
  }

  // Tannin — engine: firm tannin (≥3.5) "meets the red meat and fat"; the
  // ideal tannin drops with heat, umami and spice, and fish wants almost none.
  // Sweet reds (port) keep the warning but not the meat rule: the sweetness
  // decides what they go with.
  if ((w.tannin ?? 0) >= 4) {
    if (!sweetWine) rule('tannin', 'firm tannin', 'Wants red meat and fat: steak, lamb, braised beef, hard cheese', FOOD.redMeat);
    avoid.push({ id: 'tannin-fish', text: 'Fish, chili and strong umami — tannin turns metallic and bitter' });
  } else if ((w.tannin ?? 0) === 3) {
    if (!sweetWine) rule('tannin', 'medium tannin', 'Pork, duck, lamb, sausages and mushroom dishes', FOOD.midMeat);
    avoid.push({ id: 'tannin-fish', text: 'Delicate white fish — the tannin clashes' });
  } else if ((w.tannin ?? 0) === 2 && w.colour === 'red' && !sweetWine) {
    rule('tannin', 'soft tannin', 'Chicken, pork, duck, mushrooms — even salmon and tuna', FOOD.lightRed);
  } else if ((w.tannin ?? 0) <= 1 && !sweetWine) {
    rule('no-tannin', 'little or no tannin', 'Safe with fish, shellfish and spiced dishes', FOOD.fishSpice);
  }

  // Acid — engine: "high acid cuts the (fried) richness" at acidity ≥4, and
  // a red with acidity ≥4 "stands up to the tomato"; too little acid for the
  // dish is the steepest structural penalty.
  if ((w.acidity ?? 3) >= 4 && !sweetWine) {
    rule('acid', 'high acidity', w.colour === 'red'
      ? 'Cuts fat and richness; stands up to tomato sauce'
      : 'Cuts fat, cream and fried food; matches tomato, citrus and goat cheese', FOOD.acidFoods);
  } else if ((w.acidity ?? 3) <= 2) {
    avoid.push({ id: 'acid-dish', text: 'Sharp dishes (tomato, vinaigrette, citrus) — they make a soft wine taste flat' });
  }

  // Bubbles — engine: a dry sparkling wine gets a bonus for fried and salty food.
  if (w.sparkling && (w.sweetness ?? 1) <= 2) {
    rule('bubbles', 'bubbles', 'Salty and fried food: chips, tempura, fried chicken, cured ham', FOOD.saltyFried);
  }

  // Body — engine: body should match the dish's weight.
  if ((w.body ?? 3) >= 4 && !sweetWine) {
    rule('body', 'full body', 'Rich, braised and roasted dishes that would swamp a lighter wine', FOOD.rich);
  } else if ((w.body ?? 3) <= 2 && !sweetWine) {
    rule('body', 'light body', 'Delicate dishes: raw bar, salads, light fish', FOOD.delicate);
    avoid.push({ id: 'heavy', text: 'Heavy stews and roasts — they swamp it' });
  }

  // Oak — engine: pronounced oak (2) "meets the smoke and char" or "the cream".
  // Fortified and sweet styles carry their "oak" as years in old casks:
  // nutty and oxidative rather than toasty, so the card says so.
  if ((w.oak ?? 0) >= 2) {
    if (w.family === 'fortified' || w.family === 'sweet') {
      rule('oak', 'long cask age', 'Nutty, caramel and savoury-aged flavours: mushrooms, nuts, aged cheese', FOOD.oxidative);
    } else {
      rule('oak', 'pronounced oak', 'Smoke, char and butter: grilled meat, barbecue, cream sauces', FOOD.smokeButter);
    }
  }

  const aromas = (w.aromas || []).map((a) => String(a).toLowerCase());
  const bridges = BRIDGES.filter(([tags]) => tags.some((t) => aromas.includes(t))).map(([, food]) => food);
  if (aromas.includes('saline')) bridges.push('shellfish (a briny edge)');

  return { rules, bridges, avoid, goodWith: [...(w.classicMatches || [])] };
}

/**
 * The aroma families wine reviewers mention for a style noticeably more
 * often than for wine in general (public/data/wine_review_aromas.json,
 * aggregated from 130k Wine Enthusiast reviews). Null when the style has
 * too few reviews to say.
 * @returns {{ reviews: number, families: { family, share, lift }[] } | null}
 */
export function reviewHighlights(entry, { minShare = 0.1, minLift = 1.3, max = 4 } = {}) {
  if (!entry || !Array.isArray(entry.families) || !(entry.reviews >= 30)) return null;
  const families = entry.families
    .filter((f) => f.share >= minShare && f.lift >= minLift)
    .sort((a, b) => b.share - a.share)
    .slice(0, max);
  return families.length ? { reviews: entry.reviews, families } : null;
}
