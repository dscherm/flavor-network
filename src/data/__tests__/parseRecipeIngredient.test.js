import { describe, it, expect } from 'vitest';
import {
  parseIngredientLine,
  matchIngredientName,
  matchRecipeIngredients,
} from '../parseRecipeIngredient.js';

// Sample dictionary representing the known-ingredient list. Real list is
// ~3,847 names from public/proDataset/ingredients.json; this slice is
// chosen so the fuzzy matcher tests hit both exact + near + miss cases.
const KNOWN_NAMES = [
  'tomato', 'basil', 'garlic', 'olive oil', 'parmesan',
  'oregano', 'salt', 'pepper', 'pasta', 'butter',
  'onion', 'carrot', 'celery', 'red wine', 'thyme',
  'red wine vinegar', 'dijon mustard', 'chicken breast',
  'lemon', 'mint', 'cilantro', 'cucumber', 'feta cheese',
  'flour', 'sugar', 'vanilla', 'cinnamon', 'eggs',
];

describe('parseIngredientLine', () => {
  it('parses qty + known unit + noun', () => {
    expect(parseIngredientLine('1 cup flour')).toEqual({
      raw: '1 cup flour', noun: 'flour', unit: 'cup', quantity: 1,
    });
    expect(parseIngredientLine('2 tbsp olive oil')).toEqual({
      raw: '2 tbsp olive oil', noun: 'olive oil', unit: 'tbsp', quantity: 2,
    });
    // Tail modifier ", minced" is stripped by preprocessLine (v2).
    expect(parseIngredientLine('4 cloves garlic, minced')).toEqual({
      raw: '4 cloves garlic, minced', noun: 'garlic', unit: 'cloves', quantity: 4,
    });
  });

  it('parses unicode fractions (½ ¼ ⅔ ¾ ⅛)', () => {
    expect(parseIngredientLine('½ cup sugar')?.quantity).toBe(0.5);
    expect(parseIngredientLine('¼ tsp salt')?.quantity).toBe(0.25);
    expect(parseIngredientLine('⅔ cup milk')?.quantity).toBeCloseTo(2 / 3);
    expect(parseIngredientLine('¾ pound butter')?.quantity).toBe(0.75);
    expect(parseIngredientLine('⅛ tsp nutmeg')?.quantity).toBe(0.125);
  });

  it('parses mixed fractions ("1 1/2 cups")', () => {
    expect(parseIngredientLine('1 1/2 cups water')?.quantity).toBe(1.5);
    expect(parseIngredientLine('2 1/4 lbs beef')?.quantity).toBe(2.25);
  });

  it('parses pure-decimal fractions ("1/2 cup")', () => {
    expect(parseIngredientLine('1/2 cup milk')?.quantity).toBe(0.5);
    expect(parseIngredientLine('3/4 tsp salt')?.quantity).toBe(0.75);
  });

  it('handles missing unit (qty + noun directly)', () => {
    const r = parseIngredientLine('2 eggs');
    expect(r?.quantity).toBe(2);
    expect(r?.noun).toBe('eggs');
    expect(r?.unit).toBeUndefined();
  });

  it('handles no qty at all', () => {
    const r = parseIngredientLine('salt and pepper to taste');
    expect(r?.noun).toMatch(/salt and pepper/);
    expect(r?.quantity).toBeUndefined();
    expect(r?.unit).toBeUndefined();
  });

  it('strips additional descriptors after the noun', () => {
    const r = parseIngredientLine('3 tbsp olive oil (extra virgin)');
    expect(r?.unit).toBe('tbsp');
    expect(r?.quantity).toBe(3);
    expect(r?.noun).toMatch(/olive oil/);
  });

  it('treats unknown leading word as part of the noun, not a unit', () => {
    // WEBLINK-6: this used "1 stick butter" as the example, but "stick" was
    // promoted into KNOWN_UNITS alongside the other container/count words —
    // and "1 stick butter" -> unit "stick", noun "butter" is the better
    // parse, so the example was refreshed rather than the behaviour reverted.
    const r = parseIngredientLine('1 glug olive oil');
    expect(r?.quantity).toBe(1);
    expect(r?.unit).toBeUndefined();
    expect(r?.noun).toMatch(/glug olive oil/);
  });

  it('recognises container and count words as units (WEBLINK-6)', () => {
    // "2 cans tomato paste" previously kept "cans" in the noun, so the
    // candidate cascade never produced plain "tomato" and the line matched
    // "italian tomatoe" against the real dictionary.
    expect(parseIngredientLine('2 cans tomato paste')).toMatchObject({
      quantity: 2, unit: 'cans', noun: 'tomato paste',
    });
    expect(parseIngredientLine('1 stick butter')).toMatchObject({
      quantity: 1, unit: 'stick', noun: 'butter',
    });
    expect(parseIngredientLine('1 bunch parsley')).toMatchObject({
      quantity: 1, unit: 'bunch', noun: 'parsley',
    });
  });

  it('returns null on empty input', () => {
    expect(parseIngredientLine('')).toBeNull();
    expect(parseIngredientLine('   ')).toBeNull();
    expect(parseIngredientLine(null)).toBeNull();
    expect(parseIngredientLine(undefined)).toBeNull();
  });

  it('passes single-word input through (no qty / unit / split)', () => {
    expect(parseIngredientLine('salt')).toEqual({ raw: 'salt', noun: 'salt' });
  });
});

describe('matchIngredientName', () => {
  it('exact match → high confidence', () => {
    const r = matchIngredientName('tomato', KNOWN_NAMES);
    expect(r?.name).toBe('tomato');
    expect(r?.confidence).toBeGreaterThan(0.9);
  });

  it('fuzzy hit ("tomatos" → "tomato")', () => {
    const r = matchIngredientName('tomatos', KNOWN_NAMES);
    expect(r?.name).toBe('tomato');
    expect(r?.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('multi-word match ("olive oil" exact)', () => {
    const r = matchIngredientName('olive oil', KNOWN_NAMES);
    expect(r?.name).toBe('olive oil');
    expect(r?.confidence).toBeGreaterThan(0.9);
  });

  it('multi-word fuzzy ("red wine vinegar" exact)', () => {
    const r = matchIngredientName('red wine vinegar', KNOWN_NAMES);
    expect(r?.name).toBe('red wine vinegar');
  });

  it('miss → returns null (confidence below floor)', () => {
    const r = matchIngredientName('quinoa', KNOWN_NAMES);
    expect(r).toBeNull();
  });

  it('miss → returns null (gibberish input)', () => {
    const r = matchIngredientName('xyzzy123', KNOWN_NAMES);
    expect(r).toBeNull();
  });

  it('case-insensitive match', () => {
    const r = matchIngredientName('BASIL', KNOWN_NAMES);
    expect(r?.name).toBe('basil');
  });

  it('returns null on empty input', () => {
    expect(matchIngredientName('', KNOWN_NAMES)).toBeNull();
    expect(matchIngredientName('   ', KNOWN_NAMES)).toBeNull();
    expect(matchIngredientName(null, KNOWN_NAMES)).toBeNull();
  });

  it('returns null on empty dictionary', () => {
    expect(matchIngredientName('tomato', [])).toBeNull();
  });
});

describe('matchRecipeIngredients', () => {
  it('returns one entry per input line with parsed + matched fields', () => {
    const lines = ['1 cup flour', '2 tbsp olive oil', '4 cloves garlic'];
    const out = matchRecipeIngredients(lines, KNOWN_NAMES);
    expect(out).toHaveLength(3);
    expect(out[0].matched).toBe('flour');
    expect(out[0].parsed.unit).toBe('cup');
    expect(out[0].parsed.quantity).toBe(1);
    expect(out[1].matched).toBe('olive oil');
    expect(out[2].matched).toBe('garlic');
  });

  it('accepts pre-parsed { raw, noun, unit?, quantity? } objects from scrapeRecipe', () => {
    const parsed = [
      { raw: '1 cup flour', noun: 'flour', unit: 'cup', quantity: 1 },
      { raw: '2 lbs beef', noun: 'beef', unit: 'lbs', quantity: 2 },
    ];
    const out = matchRecipeIngredients(parsed, KNOWN_NAMES);
    expect(out).toHaveLength(2);
    expect(out[0].matched).toBe('flour');
    expect(out[1].matched).toBeNull(); // beef not in dictionary
  });

  it('passes through unmatched ingredients with matched=null', () => {
    const out = matchRecipeIngredients(['1 cup quinoa'], KNOWN_NAMES);
    expect(out[0].matched).toBeNull();
    expect(out[0].confidence).toBeNull();
    expect(out[0].parsed.noun).toBe('quinoa');
  });

  it('returns [] on empty input', () => {
    expect(matchRecipeIngredients([], KNOWN_NAMES)).toEqual([]);
    expect(matchRecipeIngredients(null, KNOWN_NAMES)).toEqual([]);
  });

  it('survives garbage entries (numbers, undefined) without throwing', () => {
    const out = matchRecipeIngredients([123, undefined, '1 cup flour'], KNOWN_NAMES);
    expect(out).toHaveLength(3);
    expect(out[2].matched).toBe('flour');
  });

  // ===== MAKE-WEBLINK-MATCH-V2 cases =====
  // Real-world failing inputs reported after MAKE-WEBLINK-UI shipped.
  // Each documents a phrasing the v1 matcher missed.

  it('v2: "1 tablespoon light brown sugar, packed" → brown sugar (tail strip + adjective cascade)', () => {
    const names = ['brown sugar', 'sugar', 'flour', 'salt'];
    const out = matchRecipeIngredients(['1 tablespoon light brown sugar, packed'], names);
    expect(out[0].parsed.unit).toBe('tablespoon');
    expect(out[0].parsed.noun).toBe('light brown sugar');
    expect(out[0].matched).toBe('brown sugar');
  });

  it('v2: "1 teaspoon garlic paste (or 1 clove garlic, minced)" → garlic (parenthetical strip + form suffix cascade)', () => {
    // garlic paste NOT in dict (mirrors real ingredient dict) → cascade to garlic.
    const names = ['garlic', 'ginger', 'salt', 'pepper'];
    const out = matchRecipeIngredients(['1 teaspoon garlic paste (or 1 clove garlic, minced)'], names);
    expect(out[0].parsed.noun).toBe('garlic paste');
    expect(out[0].matched).toBe('garlic');
  });

  it('v2: "1 teaspoon ginger paste (or 1-inch knob fresh garlic, peeled)" → ginger paste (canonical compound preserved)', () => {
    // ginger paste IS in dict → must beat the form-stripped "ginger" candidate.
    const names = ['ginger paste', 'ginger', 'garlic', 'salt'];
    const out = matchRecipeIngredients(['1 teaspoon ginger paste (or 1-inch knob fresh garlic, peeled)'], names);
    expect(out[0].parsed.noun).toBe('ginger paste');
    expect(out[0].matched).toBe('ginger paste');
  });

  it('v2: "4 (4-ounce) salmon fillets" → salmon fillet (parenthetical strip + singularize)', () => {
    const names = ['salmon fillet', 'salmon', 'pink salmon', 'salt'];
    const out = matchRecipeIngredients(['4 (4-ounce) salmon fillets'], names);
    expect(out[0].parsed.quantity).toBe(4);
    expect(out[0].parsed.noun).toBe('salmon fillets');
    expect(out[0].matched).toBe('salmon fillet');
  });

  it('v2: "tomato paste" preserved (does NOT collapse to "tomato")', () => {
    const names = ['tomato paste', 'tomato', 'crushed tomatoes', 'salt'];
    const m = matchIngredientName('tomato paste', names);
    expect(m?.name).toBe('tomato paste');
  });

  it('v2: form-stripped candidate only wins when scoring strictly higher than full noun', () => {
    // "ginger paste" exact in dict → full noun wins at confidence 1.0.
    // "garlic paste" NOT in dict → form-strip to "garlic" should win.
    const names = ['ginger paste', 'garlic'];
    expect(matchIngredientName('ginger paste', names)?.name).toBe('ginger paste');
    expect(matchIngredientName('garlic paste', names)?.name).toBe('garlic');
  });

  it('v2: "1 large yellow onion, diced" → onion (adjective + tail-modifier cascade)', () => {
    const names = ['yellow onion', 'onion', 'red onion', 'salt'];
    const out = matchRecipeIngredients(['1 large yellow onion, diced'], names);
    // "yellow onion" IS in dict — cascade prefers it over "onion" head.
    expect(out[0].matched).toBe('yellow onion');
  });

  it('v2: exact dict key short-circuits to confidence=1.0', () => {
    const m = matchIngredientName('basil', KNOWN_NAMES);
    expect(m?.confidence).toBe(1);
  });

  it('v2: parenthetical-only content (qty inside parens) does not break parsing', () => {
    expect(parseIngredientLine('(optional) 1 tsp vanilla')?.noun).toMatch(/vanilla/);
  });

  it('v2: typical mix from a real recipe — most lines now match against a small dict', () => {
    const names = [
      'brown sugar', 'garlic', 'ginger paste', 'salmon fillet', 'salmon',
      'onion', 'salt', 'pepper', 'olive oil', 'soy sauce',
    ];
    const lines = [
      '1 tablespoon light brown sugar, packed',
      '1 teaspoon garlic paste (or 1 clove garlic, minced)',
      '1 teaspoon ginger paste',
      '4 (4-ounce) salmon fillets',
      '1 large yellow onion, diced',
      'salt and pepper to taste',
      '2 tbsp olive oil',
      '1 tbsp soy sauce',
    ];
    const out = matchRecipeIngredients(lines, names);
    const hits = out.filter((e) => e.matched !== null);
    expect(out).toHaveLength(8);
    // 6+ of 8 must match (salt-and-pepper line + maybe one other can miss).
    expect(hits.length).toBeGreaterThanOrEqual(6);
  });

  it('typical mix: 8 lines, ≥30% match on a small fixture dictionary', () => {
    // Small dictionaries + Fuse's strict threshold (0.4) mean
    // descriptor-laden lines ("4 cloves garlic, minced", "1 can
    // crushed tomatoes", "fresh basil leaves") often miss because
    // the parsed noun retains extra words that drive fuse's
    // Levenshtein score above threshold. Production runs against
    // a ~3,847-name dictionary where the matcher has many more
    // synonyms to lock onto. This fixture asserts a floor — real
    // recipe sites land in the 60-80% range against the full
    // dictionary.
    const lines = [
      '1 cup flour',
      '2 tbsp olive oil',
      '4 cloves garlic, minced',
      '1 can crushed tomatoes',
      '½ cup fresh basil leaves',
      '1 lb chicken breast',
      'salt and pepper to taste',
      'quinoa (optional)',
    ];
    const out = matchRecipeIngredients(lines, KNOWN_NAMES);
    const hits = out.filter((e) => e.matched !== null);
    expect(out).toHaveLength(8);
    expect(hits.length).toBeGreaterThanOrEqual(3);
  });
});

// WEBLINK-6 (2026-08-01). Found by an end-to-end UI run, not by tests —
// every layer's suite was green while the composed system imported Serious
// Eats' "Classic Panzanella Salad (Tuscan-Style Tomato and Bread Salad)" as
// allspice + cubed cheese + lettuce. tomato, bread and basil were all in the
// dictionary and none was chosen.
//
// Root cause: deriveCandidates offered the bare last token as a candidate
// even when it was a shape word. Against the real 3,891-name dictionary,
// "pieces" -> allspice (0.76), "cubes" -> cubed cheese (0.99),
// "leaves" -> leaves lettuce (0.99) — all beating the real ingredient.
describe('WEBLINK-6 — real recipe lines must not match shape words', () => {
  // Verbatim from seriouseats.com/classic-panzanella-salad-recipe.
  const PANZANELLA = [
    '2 1/2 pounds (1.1kg) mixed ripe tomatoes, cut into bite-size pieces',
    '3/4 pound (340g) ciabatta or rustic sourdough bread, cut into 1 1/2-inch cubes (about 6 cups bread cubes)',
    '1/2 cup (1/2 ounce) packed basil leaves, roughly chopped',
  ];
  const DICT = [
    'tomato', 'bread', 'basil', 'olive oil', 'shallot', 'garlic', 'salt',
    // The decoys that actually won before the fix.
    'allspice', 'cubed cheese', 'leaves lettuce', 'thai basil leave',
  ];

  it('matches the ingredient, not the shape it was cut into', () => {
    const [tomatoes, bread, basil] = matchRecipeIngredients(
      PANZANELLA.map((raw) => ({ raw, noun: raw })), DICT,
    );
    expect(tomatoes.matched).toBe('tomato');
    expect(bread.matched).toBe('bread');
    expect(basil.matched).toBe('basil');
  });

  it('never returns one of the shape-word decoys', () => {
    const decoys = ['allspice', 'cubed cheese', 'leaves lettuce'];
    const matched = matchRecipeIngredients(
      PANZANELLA.map((raw) => ({ raw, noun: raw })), DICT,
    ).map((r) => r.matched);
    decoys.forEach((d) => expect(matched).not.toContain(d));
  });

  it('strips trailing preparation clauses from the noun', () => {
    expect(parseIngredientLine(PANZANELLA[0]).noun).toBe('mixed ripe tomatoes');
    expect(parseIngredientLine(PANZANELLA[1]).noun).toBe('ciabatta or rustic sourdough bread');
  });

  it('singularizes -oes plurals correctly (tomatoes -> tomato, not tomatoe)', () => {
    const [r] = matchRecipeIngredients(
      [{ raw: '2 pounds ripe tomatoes', noun: '2 pounds ripe tomatoes' }],
      ['tomato', 'tomatoe'],
    );
    expect(r.matched).toBe('tomato');
  });

  it('still preserves canonical compounds', () => {
    const dict = ['tomato', 'tomato paste', 'ginger', 'ginger paste'];
    const [paste] = matchRecipeIngredients(
      [{ raw: '2 cans tomato paste', noun: '2 cans tomato paste' }], dict,
    );
    expect(paste.matched).toBe('tomato paste');
  });
});

// WEBLINK-7 (2026-08-01). Measured over a 102-line corpus scraped from 7
// live recipes. Two rules, and the second matters more than the first:
// generalize only to EXACT hits, and decline when the dictionary has no
// right answer. A wrong ingredient silently changes the recipe's computed
// flavor profile; a declined one the user simply adds.
describe('WEBLINK-7 — generalize only on exact hits', () => {
  const DICT = [
    'mozzarella', 'feta', 'ricotta', 'parmesan', 'mushroom', 'vanilla',
    'tomato', 'tomato paste', 'tomato sauce', 'water chestnut', 'panko',
    'italian sausage', 'black olive', 'egg yolk', 'red wine vinegar',
    // Decoys that won before the fix, each a genuinely different food.
    'soda water', 'lemon extract', 'baking potatoe', 'baby eggplant',
    'crumbled cornbread', 'lump crabmeat', 'hotsauce', 'crumb crust',
    'boneless skinless chicken breast',
  ];
  const match = (raw) => matchRecipeIngredients([{ raw, noun: raw }], DICT)[0].matched;

  it('reduces a compound to the bare form the dictionary carries', () => {
    expect(match('Feta cheese, crumbled')).toBe('feta');
    expect(match('Fresh soft mozzarella cheese, separated into small clumps')).toBe('mozzarella');
    expect(match('0.75 cup grated Parmesan cheese')).toBe('parmesan');
    expect(match('2 tsp. vanilla extract')).toBe('vanilla');
    expect(match('1 cup panko bread crumbs')).toBe('panko');
  });

  it('singularizes a single-token noun', () => {
    expect(match('Mushrooms, very thinly sliced if raw, otherwise first sauteed')).toBe('mushroom');
  });

  it('keeps the qualifier when it is part of the dictionary name', () => {
    expect(match('1 (8 ounce) can sliced water chestnuts, drained')).toBe('water chestnut');
    expect(match('2 (6.5 ounce) cans canned tomato sauce')).toBe('tomato sauce');
    expect(match('Sliced black olives')).toBe('black olive');
  });

  it('handles abbreviated units written with a period', () => {
    // "2 tsp. vanilla extract" used to keep "tsp." in the noun.
    expect(parseIngredientLine('2 tsp. vanilla extract')).toMatchObject({
      quantity: 2, unit: 'tsp', noun: 'vanilla extract',
    });
    expect(parseIngredientLine('6 oz. chocolate')).toMatchObject({ unit: 'oz', noun: 'chocolate' });
  });

  it('DECLINES when the dictionary has no right answer', () => {
    // Neither "baking soda" nor "soda" is in the dictionary. Returning
    // "soda water" (0.99 before the fix) was worse than returning nothing.
    expect(match('3/4 tsp. baking soda')).toBeNull();
    // "arugula" absent — must not become "baby eggplant" on a shared "baby".
    expect(match('Baby arugula, tossed in a little olive oil')).toBeNull();
  });

  it('refuses a match that shares only a modifier, not the head word', () => {
    // Chicken thigh is not chicken breast — a different cut is a wrong
    // ingredient, not a near miss.
    expect(match('5 boneless, skinless chicken thighs')).toBeNull();
  });

  it('a fuzzy hit must mention the head word', () => {
    expect(matchIngredientName('baking soda', ['baking potatoe'])).toBeNull();
    expect(matchIngredientName('baby arugula', ['baby eggplant'])).toBeNull();
    // …but plural/singular head pairs still count as sharing.
    expect(matchIngredientName('ripe tomatoes', ['tomato'])?.name).toBe('tomato');
  });

  it('still preserves canonical compounds and the WEBLINK-6 behaviour', () => {
    expect(match('2 cans tomato paste')).toBe('tomato paste');
    expect(match('2 tablespoons red wine vinegar')).toBe('red wine vinegar');
    expect(match('2 large egg yolks')).toBe('egg yolk');
  });
});

// WEBLINK-13 (2026-08-02). Third accuracy pass, found by scraping a wider
// corpus (3 sites, 348 lines) and reading every matched row.
describe('WEBLINK-13 — units are not food, generic heads need a modifier', () => {
  const DICT = [
    'tomato', 'tomato paste', 'red wine vinegar', 'sesame oil', 'soy sauce',
    'chicken stock', 'vegetable broth', 'maple syrup', 'orange juice',
    'vanilla', 'garlic', 'salt',
    // Real dictionary entries that unit fragments matched at high
    // confidence before this fix.
    'bilberry', 'mozzarella', 'cupcake', 'arrowhead', 'gelatin powder',
  ];
  const match = (raw) => matchRecipeIngredients([{ raw, noun: raw }], DICT)[0].matched;

  it('rejects a noun that is nothing but a measurement', () => {
    // These arise when the heuristic parser misfires on a page that is not
    // a recipe and emits table/nav fragments. Every decoy below is a real
    // dictionary entry, which is why they matched so confidently.
    expect(match('lb.')).toBeNull();
    expect(match('lb')).toBeNull();
    expect(match('oz.')).toBeNull();
    expect(match('cup')).toBeNull();
    expect(match('cups')).toBeNull();
    expect(match('head')).toBeNull();
    expect(match('2 cups')).toBeNull();
    expect(match('tsp.')).toBeNull();
  });

  it('specifically refuses the four that shipped wrong', () => {
    // lb. -> bilberry, oz. -> mozzarella, cup -> cupcake, head -> arrowhead
    ['lb.', 'oz.', 'cup', 'head'].forEach((u) => {
      expect(match(u)).toBeNull();
    });
  });

  it('declines when only a GENERIC head word is shared', () => {
    // "baking powder" is absent from the dictionary; "gelatin powder" is
    // present. They share "powder" — but a wrong leavening agent silently
    // changes the recipe's computed profile.
    expect(match('1 tsp baking powder')).toBeNull();
  });

  it('still matches generic-head phrases the dictionary actually has', () => {
    expect(match('2 cans tomato paste')).toBe('tomato paste');
    expect(match('2 tablespoons red wine vinegar')).toBe('red wine vinegar');
    expect(match('2 Tbsp sesame oil')).toBe('sesame oil');
    expect(match('1 tsp soy sauce')).toBe('soy sauce');
    expect(match('1 cup chicken stock')).toBe('chicken stock');
    expect(match('2 cups vegetable broth')).toBe('vegetable broth');
    expect(match('1 tbsp maple syrup')).toBe('maple syrup');
    expect(match('1 cup orange juice')).toBe('orange juice');
  });

  it('leaves the form-suffix path alone — vanilla extract still reduces', () => {
    // 'extract' is a FORM_SUFFIX, so this resolves by exact hit on the
    // stripped candidate, not by the fuzzy branch the guard sits on.
    expect(match('2 tsp. vanilla extract')).toBe('vanilla');
  });

  it('does not disturb ordinary single-word ingredients', () => {
    expect(match('2 cloves garlic')).toBe('garlic');
    expect(match('1 tsp salt')).toBe('salt');
  });
});
