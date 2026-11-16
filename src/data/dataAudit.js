/**
 * dataAudit.js (DATA-1). Pure rules for the repeatable data audit. No file or
 * network access: scripts/auditData.mjs loads the real files and calls these.
 *
 * Every rule returns a list of findings { item, rule, confidence, detail, suggestion }.
 * A finding is a candidate for a person to review, never a verdict.
 * confidence is 'HIGH' (very likely a real problem) or 'LOW' (often a real
 * distinction a cook would care about, so a person must decide).
 */

export const TASTE_VOCAB = ['sweet', 'sour', 'bitter', 'salty', 'umami', 'spicy', 'pungent', 'astringent', 'neutral', 'rich'];

const finding = (item, rule, confidence, detail, suggestion = '') => ({ item, rule, confidence, detail, suggestion });
const tokens = (s) => String(s || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Lower-case, accent-free, punctuation-free form used to compare drink names. */
export function normalizeName(s) {
  return strip(s).toLowerCase().replace(/whisky/g, 'whiskey').replace(/[^a-z0-9]+/g, '');
}

// ---------------------------------------------------------------- duplicates

export const MISSPELLINGS = {
  tomatoe: 'tomato', potatoe: 'potato', mangoe: 'mango', peache: 'peach', chilie: 'chili',
  candie: 'candy', pattie: 'patty', tarter: 'tartar', cherrie: 'cherry', berrie: 'berry',
};

// Words that never change what the ingredient is.
export const HIGH_PREFIXES = [
  'freshly squeezed', 'freshly ground', 'freshly cracked', 'freshly', 'extra lean', 'lean',
  'boneless skinless', 'boneless', 'skinless', 'cooked', 'instant', 'additional', 'extra',
  'favorite', 'leftover',
];
// Words that often DO make a different ingredient (ground beef, dried apricot, whole milk).
export const LOW_PREFIXES = [
  'fresh', 'ripe', 'plain', 'unsalted', 'salted', 'prepared', 'mashed', 'chopped', 'diced', 'sliced',
  'minced', 'grated', 'shredded', 'large', 'small', 'medium', 'frozen', 'canned', 'dried', 'ground',
  'whole', 'crushed', 'melted', 'softened', 'raw',
];

// 'extra virgin', 'extra sharp' ... name a grade, so 'extra' is not a removable filler there.
const EXTRA_GRADE = /^extra (virgin|sharp|firm|wide|thick|crunchy|creamy|large|dark|hot|fine|coarse)\b/;
const NOT_PLURAL = /(ss|us|is|ous)$/;

function singularOf(word) {
  if (word.length < 4 || NOT_PLURAL.test(word) || !word.endsWith('s')) return null;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (/(oes|ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2);
  return word.slice(0, -1);
}

/**
 * Names that duplicate another ingredient under a different spelling.
 * @param {Record<string, object>} ingredients name -> entry
 * @param {{keep?: Set<string>}} opts keep: reviewed non-merges that are not reported
 */
export function findDuplicates(ingredients, { keep = new Set() } = {}) {
  const names = Object.keys(ingredients);
  const exists = new Set(names);
  const vocab = new Set(names.flatMap(tokens));
  const out = [];
  for (const name of names) {
    if (keep.has(name)) continue;
    let words = tokens(name);
    const steps = [];
    let low = false;
    let misspelt = false;

    words = words.map((w) => {
      const fix = MISSPELLINGS[w] || (/oe$/.test(w) && w.length >= 5 && vocab.has(w.slice(0, -1)) ? w.slice(0, -1) : null);
      if (fix) { steps.push(`'${w}' is a misspelling of '${fix}'`); misspelt = true; return fix; }
      return w;
    });

    // Strip leading preparation / quality words, longest phrase first.
    let stripped = true;
    while (stripped && words.length > 1) {
      stripped = false;
      const head = words.join(' ');
      for (const [list, isLow] of [[HIGH_PREFIXES, false], [LOW_PREFIXES, true]]) {
        const p = list.find((x) => head.startsWith(x + ' ') && !(x === 'extra' && EXTRA_GRADE.test(head)));
        if (p) {
          words = words.slice(p.split(' ').length);
          steps.push(`leading '${p}'`);
          if (isLow) low = true;
          stripped = true;
          break;
        }
      }
    }

    let target = words.join(' ');
    let plural = false;
    if (!exists.has(target) || target === name) {
      const last = words[words.length - 1];
      const sing = singularOf(last);
      const alt = sing ? [...words.slice(0, -1), sing].join(' ') : null;
      if (alt && exists.has(alt)) { target = alt; plural = true; steps.push(`'${last}' is the plural of '${sing}'`); }
    }
    if (!steps.length || target === name) continue;

    const hasTarget = exists.has(target);
    if (!hasTarget && low) continue; // only a low-confidence prefix and nothing to merge into: not a duplicate
    const rule = misspelt ? 'duplicate-misspelling' : plural && steps.length === 1 ? 'duplicate-plural' : 'duplicate-prefix';
    out.push(finding(
      name, rule, low ? 'LOW' : 'HIGH',
      `${steps.join('; ')}. '${target}' ${hasTarget ? 'exists, so this would be a merge' : 'does not exist, so this would be a rename'}.`,
      hasTarget ? `merge into '${target}'` : `rename to '${target}'`,
    ));
  }
  return out;
}

// ----------------------------------------------------------------- non-food

const EQUIPMENT = /\b(cheesecloth|cheese cloth|cookie cutter|cookie sheet|baking sheet|cupcake liner|muffin liner|paper liner|fryer|roaster|kitchen twine|twine|toothpicks?|skewers?|parchment paper|aluminum foil|plastic wrap|wax paper|waxed paper|paper towels?|cream maker|ice cream maker|epsom salt|paraffin|cutter|spatula|whisk|saucepan|colander|thermometer)\b/;
const BARE_WORDS = new Set([
  'unsalted', 'salted', 'milky', 'buttery', 'european', 'cream-style', 'sugar-free', 'leaf', 'root',
  'vanilla-flavored', 'strawberry flavored', 'sweet', 'sour', 'bitter', 'fresh', 'dried', 'whole',
  'ground', 'plain', 'large', 'small', 'medium', 'hot', 'cold', 'warm', 'ripe', 'raw', 'frozen', 'canned',
]);
const FLAVOR_WORD = /^[a-z' -]+ flavou?r$/;
const FLAVORING = /^[a-z' -]+ flavou?ring$/;

/** Kitchen equipment and supplies, bare adjectives, bare flavour words, one- and two-letter names. */
export function findNonFood(ingredients) {
  const out = [];
  for (const name of Object.keys(ingredients)) {
    const n = name.toLowerCase().trim();
    if (n.length <= 2) out.push(finding(name, 'fragment', 'HIGH', 'a name of one or two characters', 'hide'));
    else if (BARE_WORDS.has(n)) out.push(finding(name, 'fragment', 'HIGH', 'a bare adjective or word, not an ingredient', 'hide'));
    else if (EQUIPMENT.test(n)) out.push(finding(name, 'non-food', 'HIGH', 'kitchen equipment or a supply', 'hide'));
    else if (FLAVOR_WORD.test(n)) out.push(finding(name, 'fragment', 'HIGH', 'a bare flavour word', 'hide or merge into the plain ingredient'));
    else if (FLAVORING.test(n)) out.push(finding(name, 'fragment', 'LOW', 'a flavouring (a real product, but not a food in its own right)', 'review'));
  }
  return out;
}

// ----------------------------------------------------------------- packaged

// Reviewable: add or remove a brand here and the audit follows.
export const BRANDS = [
  'velveeta', 'cool whip', 'oreo', 'jell-o', 'jello', 'kraft', 'bisquick', 'spam', 'crisco', 'tabasco',
  'cheez whiz', 'ritz', 'dorito', 'doritos', 'pillsbury', 'betty crocker', 'duncan hines', 'lipton',
  'campbell', 'campbells', 'hershey', 'hersheys', 'reese', 'reeses', 'snickers', 'twix', 'kit kat',
  'nutella', 'heinz', 'hellmann', 'hellmanns', 'miracle whip', 'ro-tel', 'rotel', 'kool-aid', 'kool aid',
  'cheerios', 'fritos', 'cheetos', 'nilla', 'oscar mayer', 'knorr', 'stove top', 'uncle ben', 'philadelphia',
  'tostitos', 'mcbutter', 'dream whip', 'rice krispies', 'lucky charms', 'pop-tarts', 'pop tarts',
  'bacos', 'mccormick', 'lawry', 'lawrys', 'old bay', 'tater tots', 'hidden valley',
  'ragu', 'prego', 'bertolli', 'swanson', 'progresso',
];
const BRAND_RE = new RegExp(`(^|[^a-z])(${BRANDS.map(escapeRe).join('|')})($|[^a-z])`);
const MIX = /\b(cake|pudding|dressing|gravy|soup|seasoning|biscuit|baking|pancake|muffin|brownie|stuffing|coating|dip|taco|salad|cornbread|bread|chili|chocolate) mix\b|\bdream whip topping mix\b/;
const PUDDING = /\binstant\b.*\bpudding\b|\bpudding mix\b/;
const SOUP_FLAVORS = 'mushroom|celery|chicken|onion|shrimp|potato|asparagus|broccoli|tomato|golden mushroom|cheddar cheese';
const CONDENSED = new RegExp(`^(cream of (${SOUP_FLAVORS})( soup)?|condensed .*soup)$`);
const FLAVORED = /\bflavou?red\b/;

/** Brand names, cake/pudding/dressing mixes, canned condensed soups, flavoured products. */
export function findPackaged(ingredients) {
  const out = [];
  for (const name of Object.keys(ingredients)) {
    const n = name.toLowerCase().trim();
    if (BRAND_RE.test(n)) out.push(finding(name, 'packaged-brand', 'HIGH', 'contains a brand name', 'flag as packaged'));
    else if (CONDENSED.test(n)) out.push(finding(name, 'packaged-soup', 'HIGH', 'a canned condensed soup', 'flag as packaged'));
    else if (PUDDING.test(n) || MIX.test(n)) out.push(finding(name, 'packaged-mix', 'HIGH', 'a boxed mix', 'flag as packaged'));
    else if (FLAVORED.test(n) && !/\bunflavou?red\b/.test(n)) {
      out.push(finding(name, 'packaged-flavored', 'LOW', "a 'flavored' product", 'review'));
    }
  }
  return out;
}

// ----------------------------------------------------------------- category
//
// The category scheme (src/data/categoryScheme.js, written down in docs/data-quality.md) is enforced here:
// each family below names the one category its members belong to. The audit is run over the CURATED data,
// so a finding means the data still disagrees with the scheme.

const CHEESE_WORDS = /\b(cheese|cheddar|parmesan|parmigiano|romano|mozzarella|mozarella|gouda|brie|camembert|feta|gruyere|provolone|havarti|fontina|gorgonzola|ricotta|mascarpone|colby|muenster|asiago|manchego|halloumi|paneer)\b/;
const NOT_CHEESE = /(cake|cloth|cracker|soup|sauce|dressing|frosting|spread|ball|flavor|dorito|puff|straw|popcorn|bread|biscuit|pizza|ravioli|tortellini|manicotti|sandwich|dip|filled|stuffed|burger|steak|chip|roll|chocolate|filling|icing|romano bean|romano pepper)/;
// Vermouth is an aromatised wine, but the bar and the cocktail slots treat it as a liqueur-shelf modifier:
// it has its own family below and stays in 'liqueur' (DATA-4 decision).
const WINE_WORDS = /\b(wine|sherry|port|marsala|sake|prosecco|champagne|madeira|sauternes|riesling|chardonnay|merlot|cabernet|pinot|chianti|zinfandel|moscato|cava|lambrusco|mirin|sangria|rioja|malbec|syrah|shiraz|sauvignon)\b/;
const NOT_WINE = /(vinegar|vinaigrette|jelly|sauce|glaze|cake|gelatin|syrup|extract|flavor|cookie|\bham\b|soup|dressing|spritzer|cooler)/;
const BEER_WORDS = /\b(beer|ale|lager|stout|porter|cider|pilsner)\b/;
// Ginger beer, root beer and ginger ale are soft drinks; apple cider is pressed apple juice in a recipe.
const NOT_BEER = /(ginger|root|birch|cream) (beer|ale)|\b(vinegar|batter|bread|cake|sauce|marinade)\b|\bapple cider$/;
const SPIRIT_WORDS = /^(vodka|gin|rum|light rum|dark rum|white rum|spiced rum|tequila|whiskey|whisky|bourbon|scotch|rye whiskey|brandy|cognac|mezcal|grain alcohol|everclear|armagnac|pisco)$/;
// A juice is the juice of a fruit or vegetable. Brines (pickle, olive), clam juice and a salted lemon juice are
// not; three bare fragments ("juice from", "with juice", "reserved juice") are not named juices either.
const NOT_JUICE = /\b(juice of|jelly|bar|box|sparkler|pickle|pickled|olive|clam|salt)\b|^(juice from|with juice|reserved juice)$/;
// Citrus juices stay with citrus: the cocktail sour slot and the sauce acid slot read that category, and
// lemon and lime juice must keep working as the sour.
const CITRUS_WORD = /\b(lemons?|limes?|orange|grapefruit|mandarin|tangerine|clementine|yuzu|citrus|realemon)\b/;

const isJuice = (n) => (/\bjuice\b/.test(n) && !NOT_JUICE.test(n)) || /\bapple cider$/.test(n);

/** Each family: which names belong to it, and the one category the scheme files each of them under. */
export const CATEGORY_FAMILIES = {
  cheese: { test: (n) => CHEESE_WORDS.test(n) && !NOT_CHEESE.test(n), expected: () => 'dairy' },
  juice: { test: isJuice, expected: (n) => (CITRUS_WORD.test(n) && /\bjuice\b/.test(n) ? 'citrus' : 'juice') },
  flour: { test: (n) => /(^|\s)flour$/.test(n), expected: () => 'grain' },
  wine: { test: (n) => WINE_WORDS.test(n) && !NOT_WINE.test(n), expected: () => 'wine' },
  vermouth: { test: (n) => /\bvermouth\b/.test(n) && !NOT_WINE.test(n), expected: () => 'liqueur' },
  beer: { test: (n) => BEER_WORDS.test(n) && !NOT_BEER.test(n), expected: () => 'beer' },
  spirit: { test: (n) => SPIRIT_WORDS.test(n), expected: () => 'spirit' },
};

/** Per family: how many entries sit in each category, and who is outside the category the scheme gives them. */
export function categorySplits(ingredients, families = CATEGORY_FAMILIES) {
  const out = [];
  for (const [family, { test, expected }] of Object.entries(families)) {
    const members = Object.keys(ingredients).filter((n) => !n.startsWith('_') && test(n.toLowerCase()));
    const byCategory = {};
    for (const m of members) {
      const c = ingredients[m].category || '(none)';
      byCategory[c] = (byCategory[c] || 0) + 1;
    }
    const target = [...new Set(members.map((m) => expected(m.toLowerCase())))];
    const outside = members.filter((m) => (ingredients[m].category || '(none)') !== expected(m.toLowerCase()));
    out.push({ family, total: members.length, byCategory, target, outside });
  }
  return out;
}

/** Findings for each member outside the category the scheme gives it, plus every entry still filed under 'umami'. */
export function findCategoryInconsistencies(ingredients, families = CATEGORY_FAMILIES) {
  const out = [];
  for (const [family, { test, expected }] of Object.entries(families)) {
    for (const m of Object.keys(ingredients)) {
      if (m.startsWith('_') || !test(m.toLowerCase())) continue;
      const want = expected(m.toLowerCase());
      const have = ingredients[m].category || '(none)';
      if (have === want) continue;
      out.push(finding(m, `category-${family}`, 'HIGH', `a ${family} filed under '${have}'; the scheme files it under '${want}'`, `set category '${want}'`));
    }
  }
  for (const [name, e] of Object.entries(ingredients)) {
    if (e && e.category === 'umami') {
      out.push(finding(name, 'category-umami', 'HIGH', "filed under 'umami', which is a taste, not a kind of food; the scheme calls this category 'savory seasoning'", "set category 'savory seasoning' (or its real category)"));
    }
  }
  return out;
}

// -------------------------------------------------------------------- taste

const STARCH_LAST = new Set(['flour', 'cornstarch', 'starch', 'rice', 'bread', 'pasta', 'noodle', 'noodles', 'spaghetti', 'macaroni',
  'oat', 'oats', 'oatmeal', 'couscous', 'bran', 'cornmeal', 'polenta', 'semolina', 'barley', 'quinoa', 'breadcrumbs', 'tortilla']);
const SWEET_STARCH_NOT = /(sweet|sugar|cake|pudding|cookie|candy|syrup|pie|dessert|chocolate|honey|cinnamon|raisin)/;
const PLAIN_FAT = /^(?:(?:unsalted |salted |sweet |sweet cream |clarified |lite |light |whipped |stick )*(?:butter|margarine)|(?:extra[- ]virgin |virgin |vegetable |salad |cooking |canola |corn |olive |safflower |sunflower |soybean |grapeseed |light |pure )?oil|shortening|vegetable shortening|lard|ghee)$/;
const PLAIN_WATER = /^(?:(?:hot|cold|warm|boiling|ice|ice-cold|lukewarm|sparkling|mineral|distilled|filtered|tap) )*water$|^(?:ice|ice cubes?|crushed ice|club soda|soda water|seltzer(?: water)?|carbonated water)$/;
const NEUTRAL_SPIRIT = /^(?:vodka|grain alcohol|everclear)$/;

export const TASTE_GROUPS = {
  starch: (n) => {
    const w = tokens(n);
    return STARCH_LAST.has(w[w.length - 1]) && !SWEET_STARCH_NOT.test(n);
  },
  'plain fat': (n) => PLAIN_FAT.test(n),
  water: (n) => PLAIN_WATER.test(n),
  'neutral spirit': (n) => NEUTRAL_SPIRIT.test(n),
};

/** Starches, plain fats and oils, water/ice/soda, and neutral spirits whose taste label includes 'sweet'. */
export function findTasteNeutralSweet(ingredients) {
  const out = [];
  for (const [name, e] of Object.entries(ingredients)) {
    if (!tokens(e.taste).includes('sweet')) continue;
    for (const [group, test] of Object.entries(TASTE_GROUPS)) {
      if (test(name.toLowerCase())) {
        out.push(finding(name, 'taste-neutral-sweet', 'HIGH', `a ${group} labelled '${e.taste}'`, "label it 'neutral' (starch, water, neutral spirit) or 'rich' (plain fat): neither is sweet"));
        break;
      }
    }
  }
  return out;
}

/** Taste words outside the known vocabulary, and entries with no taste label at all. */
export function findTasteVocabulary(ingredients, vocab = TASTE_VOCAB) {
  const out = [];
  for (const [name, e] of Object.entries(ingredients)) {
    const words = tokens(e.taste);
    if (!words.length) { out.push(finding(name, 'taste-missing', 'LOW', 'no taste label', 'label it or leave it unlabelled on purpose')); continue; }
    const bad = words.filter((w) => !vocab.includes(w));
    if (bad.length) out.push(finding(name, 'taste-vocab', 'HIGH', `unknown taste word(s): ${bad.join(', ')}`, 'use the known vocabulary'));
  }
  return out;
}

/** Per category: how often each first taste word is used. */
export function tasteDistribution(ingredients) {
  const out = {};
  for (const e of Object.values(ingredients)) {
    const c = e.category || '(none)';
    const first = tokens(e.taste)[0] || '(none)';
    out[c] = out[c] || {};
    out[c][first] = (out[c][first] || 0) + 1;
  }
  return out;
}

/** Entries whose first taste word is used by at most `maxShare` of a category of at least `minSize`. */
export function findTasteOutliers(ingredients, { minSize = 30, maxShare = 0.03 } = {}) {
  const dist = tasteDistribution(ingredients);
  const out = [];
  for (const [name, e] of Object.entries(ingredients)) {
    const c = e.category || '(none)';
    const total = Object.values(dist[c]).reduce((a, b) => a + b, 0);
    const first = tokens(e.taste)[0];
    if (!first || total < minSize) continue;
    const n = dist[c][first];
    if (n / total <= maxShare) {
      out.push(finding(name, 'taste-outlier', 'LOW', `first taste word '${first}' is used by ${n} of ${total} '${c}' entries`, 'check the label'));
    }
  }
  return out;
}

// ---------------------------------------------------------------- cocktails

const CREAM_LINE = /(^|\b)(cream|heavy cream|light cream|whipping cream|single cream|double cream|half and half|half-and-half|milk|ice cream|eggnog|irish cream|baileys|egg yolk|egg yolks|whole egg|egg|eggs)(\b|$)/;
const CREAM_NOT = /(cream of tartar|cream soda|creme|crème|coconut|cream sherry|egg white|egg whites|almond milk|oat milk|soy milk)/;
const CITRUS_LINE = /\b(lemon|lime) juice\b|^(fresh )?(lemon|lime)$/;
export const CREAM_FAMILY = 'Flips & Cream Drinks';
const STIRRED = new Set(['Boozy Sippers', 'Aromatic Stirred']);

export const CLASSICS = [
  'negroni', 'martini', 'manhattan', 'old fashioned', 'daiquiri', 'margarita', 'mojito', 'whiskey sour',
  'cosmopolitan', 'mai tai', 'moscow mule', 'aperol spritz', 'espresso martini', 'paloma', 'sazerac',
  'boulevardier', 'french 75', 'pina colada', 'bloody mary', 'sidecar', 'gimlet', 'tom collins',
  'mint julep', 'caipirinha', 'pisco sour', 'americano', 'last word', 'paper plane', 'penicillin',
  'white russian', 'irish coffee', 'long island iced tea', 'sex on the beach', 'tequila sunrise',
  'aviation', 'vesper', 'bellini', 'mimosa',
];

const lines = (c) => c.ingredients_raw || [];
// Some lines carry only the raw text ("2 oz heavy cream"), so fall back to it, minus a leading amount.
const lineText = (l) => String(l.name || l.raw || '').toLowerCase().replace(/^[\d\s./¼-¾-]+(oz|ml|cl|dash(es)?|tsp|tbsp|parts?|drops?)?\s+/, '').trim();
// A line has an amount when it carries one in its fields OR starts with a quantity of something poured ("1½ ounces vodka",
// "3/4 oz", "2 dashes", "1 shot"). A bare count of things ("1 egg white", "3 coffee beans") is not an amount of the drink.
const QUANTITY_LINE = /^\s*(juice of\s+)?[\d½¼¾⅓⅔⅛][\d\s./½¼¾⅓⅔⅛-]*\s*(fl\.?\s*)?(oz|ounces?|ml|cl|dl|l\b|litres?|liters?|dash(es)?|tsp|teaspoons?|tbsp|tblsp|tablespoons?|shots?|parts?|cups?|drops?|scoops?|splash(es)?|glass|bar\s?spoons?|pinch)/i;
const hasAmount = (l) => l.amount_ml != null || /\d/.test(l.measure || '') || QUANTITY_LINE.test(String(l.raw || ''));

/** Is this a cream or whole-egg drink? (Egg white alone is a sour's foam, so it does not count.) */
export function isCreamOrEggDrink(cocktail) {
  return lines(cocktail).some((l) => {
    const n = lineText(l);
    return CREAM_LINE.test(n) && !CREAM_NOT.test(n);
  });
}
const hasCitrus = (c) => lines(c).some((l) => CITRUS_LINE.test(lineText(l)));

/**
 * @param {{families: {id:number,name:string}[], subclusters: object[], cocktails: object[]}} codex
 * @returns {{findings: object[], byFamily: Record<string, {total:number, creamEgg:number}>}}
 */
export function cocktailChecks(codex, { creamKeep = new Set() } = {}) {
  const fam = Object.fromEntries((codex.families || []).map((f) => [f.id, f.name]));
  const cocktails = codex.cocktails || [];
  const findings = [];
  const byFamily = {};
  for (const f of Object.values(fam)) byFamily[f] = { total: 0, creamEgg: 0 };

  for (const c of cocktails) {
    const family = fam[c.family_id] ?? `family ${c.family_id}`;
    byFamily[family] = byFamily[family] || { total: 0, creamEgg: 0 };
    byFamily[family].total += 1;
    if (isCreamOrEggDrink(c)) byFamily[family].creamEgg += 1;
    if (isCreamOrEggDrink(c) && family !== CREAM_FAMILY && !creamKeep.has(c.name)) {
      const citrus = hasCitrus(c);
      findings.push(finding(c.name, 'cocktail-cream-egg', citrus ? 'LOW' : 'HIGH',
        `cream or egg drink filed under '${family}'${citrus ? ' (it also has citrus)' : ' (no citrus)'}`,
        'a family for cream and egg drinks (decision 4)'));
    }
    if (STIRRED.has(family) && hasCitrus(c)) {
      findings.push(finding(c.name, 'cocktail-citrus-stirred', 'LOW', `has lemon or lime and is filed under '${family}'`, 'check the family (a sour?)'));
    }
    if (lines(c).length && !lines(c).some(hasAmount)) {
      findings.push(finding(c.name, 'cocktail-no-amounts', 'HIGH', `no amount on any of its ${lines(c).length} ingredient lines (family '${family}')`, 'add amounts'));
    }
  }

  const seen = new Map();
  for (const c of cocktails) {
    const k = normalizeName(c.canonical || c.name);
    if (!k) continue;
    seen.set(k, [...(seen.get(k) || []), c.name]);
  }
  for (const names of seen.values()) {
    if (names.length > 1) findings.push(finding(names[0], 'cocktail-duplicate', 'HIGH', `appears ${names.length} times as: ${names.join(' / ')}`, 'keep one'));
  }

  for (const s of codex.subclusters || []) {
    if (!s.name) {
      findings.push(finding(`sub-group ${s.id}`, 'cocktail-subgroup-unnamed', 'HIGH',
        `no name (family '${fam[s.family_id] ?? s.family_id}', ${s.size ?? '?'} drinks; e.g. ${(s.exemplars || []).slice(0, 3).join(', ')})`, 'give it a name'));
    }
  }

  const have = new Set(cocktails.flatMap((c) => [normalizeName(c.name), normalizeName(c.canonical)]));
  for (const k of CLASSICS) {
    if (!have.has(normalizeName(k))) findings.push(finding(k, 'cocktail-missing-classic', 'HIGH', 'a classic with no matching drink name', 'add it'));
  }
  return { findings, byFamily };
}

// ------------------------------------------------------------------- sauces

/** Share and list of sauces under 'Independent', plus the mother-sauce and cuisine distribution. */
export function sauceChecks(sauces) {
  const motherSauce = {};
  const cuisine = {};
  const findings = [];
  for (const s of sauces) {
    const m = s.motherSauce || '(none)';
    motherSauce[m] = (motherSauce[m] || 0) + 1;
    cuisine[s.cuisine || '(none)'] = (cuisine[s.cuisine || '(none)'] || 0) + 1;
    if (m === 'Independent') {
      findings.push(finding(s.name, 'sauce-independent', 'LOW', `mother sauce 'Independent' (cuisine ${s.cuisine || 'none'})`, 'assign a technique group'));
    }
  }
  return { findings, motherSauce, cuisine, total: sauces.length, independent: motherSauce.Independent || 0 };
}

// ------------------------------------------------------------------- dishes

/**
 * @param {{dishTypes: Record<string,string>, cookbookTypes: Record<string,string>, inventTypes: {id:string,label:string,dishType:string}[]}} d
 *   dishTypes: dish name -> Cookbook type id; cookbookTypes: id -> label; inventTypes: Invent skeletons.
 *   typeList (optional, dishTypes.js): { id, skeleton, why } per type. A type with its own skeleton, a nearest one, or a
 *   written reason for having none counts as having an Invent equivalent (DATA-7).
 */
export function dishChecks({ dishTypes, cookbookTypes, inventTypes, typeList = [] }) {
  const count = {};
  for (const t of Object.values(dishTypes)) count[t] = (count[t] || 0) + 1;
  const findings = [];
  for (const [t, n] of Object.entries(count)) {
    if (n === 1) {
      const dish = Object.keys(dishTypes).find((d) => dishTypes[d] === t);
      findings.push(finding(`${cookbookTypes[t] || t} (${t})`, 'dish-singleton', 'LOW', `only one dish has this type: ${dish}`, 'merge into a neighbouring type'));
    }
  }
  const covered = new Set(inventTypes.map((i) => i.dishType));
  for (const t of typeList) if (t.skeleton || t.why) covered.add(t.id);
  for (const [id, label] of Object.entries(cookbookTypes)) {
    if (!covered.has(id)) findings.push(finding(`${label} (${id})`, 'dish-no-invent-equivalent', 'LOW', 'no Invent a recipe dish type maps to this Cookbook type', 'add an Invent type or merge the Cookbook type'));
  }
  return { findings, count, cookbookTypes, inventTypes };
}

// ----------------------------------------------------------------- reviewed or not

const HYGIENE_RULE = /^(duplicate|non-food|fragment|packaged)/;

/**
 * Split findings into the ones nobody has decided and the ones already decided. Only the ingredient
 * hygiene rules (duplicates, non-food and fragments, packaged) are decided by name: an item is reviewed when
 * it is in a curation table (aliased, hidden, packaged) or on the keep list. Category and taste findings are
 * never treated as reviewed here.
 * @param {Array<{rule: string, item: string}>} findings
 * @param {{ aliased?: Set<string>, hidden?: Set<string>, packaged?: Set<string>, kept?: Set<string> }} decided
 * @returns {{ unreviewed: Array, handledItems: Record<string, Set<string>> }}
 */
export function partitionReviewed(findings, decided = {}) {
  const kinds = ['aliased', 'hidden', 'packaged', 'kept'];
  const handledItems = Object.fromEntries(kinds.map((k) => [k, new Set()]));
  const unreviewed = [];
  for (const f of findings) {
    const by = HYGIENE_RULE.test(f.rule) ? kinds.find((k) => decided[k] && decided[k].has(f.item)) : null;
    if (by) handledItems[by].add(f.item);
    else unreviewed.push(f);
  }
  return { unreviewed, handledItems };
}
