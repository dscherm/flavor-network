import { describe, it, expect } from 'vitest';
import {
  findDuplicates, findNonFood, findPackaged, findCategoryInconsistencies, categorySplits,
  findTasteNeutralSweet, findTasteVocabulary, findTasteOutliers, tasteDistribution,
  cocktailChecks, isCreamOrEggDrink, sauceChecks, dishChecks, normalizeName, partitionReviewed,
} from './dataAudit.js';

const ing = (spec) => Object.fromEntries(Object.entries(spec).map(([n, v]) => [n, typeof v === 'string' ? { category: v, taste: 'sweet' } : v]));
const items = (list) => list.map((f) => f.item).sort();

describe('findDuplicates', () => {
  const data = ing({ tomato: 'vegetable', tomatoe: 'vegetable', olive: 'fruit', peach: 'fruit', peache: 'fruit', 'grape tomatoe': 'vegetable',
    beef: 'protein', 'lean beef': 'protein', 'ground beef': 'protein', milk: 'dairy', 'whole milk': 'dairy', 'new potato': 'vegetable',
    potato: 'vegetable', 'freshly pepper': 'spice', pepper: 'spice', 'extra virgin olive oil': 'fat', capers: 'condiment', caper: 'condiment',
    molasses: 'sweetener', swiss: 'dairy', 'instant tea': 'liquid' });

  it('finds misspelt singulars and says merge or rename', () => {
    const f = findDuplicates(data);
    const t = f.find((x) => x.item === 'tomatoe');
    expect(t.rule).toBe('duplicate-misspelling');
    expect(t.confidence).toBe('HIGH');
    expect(t.suggestion).toBe("merge into 'tomato'");
    expect(f.find((x) => x.item === 'grape tomatoe').suggestion).toBe("rename to 'grape tomato'");
    expect(f.find((x) => x.item === 'peache').suggestion).toBe("merge into 'peach'");
  });

  it("does not treat 'olive' (or other real -e words) as a misspelling", () => {
    expect(items(findDuplicates(data))).not.toContain('olive');
    expect(items(findDuplicates(data))).not.toContain('molasses');
    expect(items(findDuplicates(data))).not.toContain('swiss');
  });

  it('strips high-confidence preparation words and marks genuine distinctions LOW', () => {
    const f = findDuplicates(data);
    expect(f.find((x) => x.item === 'lean beef')).toMatchObject({ confidence: 'HIGH', suggestion: "merge into 'beef'" });
    expect(f.find((x) => x.item === 'freshly pepper').confidence).toBe('HIGH');
    expect(f.find((x) => x.item === 'ground beef').confidence).toBe('LOW');
    expect(f.find((x) => x.item === 'whole milk').confidence).toBe('LOW');
  });

  it('finds a plural whose singular exists, but not a name that merely ends in s', () => {
    const f = findDuplicates(data);
    expect(f.find((x) => x.item === 'capers').rule).toBe('duplicate-plural');
    expect(items(f)).not.toContain('molasses');
  });

  it('does not report a LOW prefix when there is nothing to merge into, nor words that are not prefixes', () => {
    const f = findDuplicates(ing({ 'dried figgy': 'fruit', 'new potato': 'vegetable', potato: 'vegetable' }));
    expect(items(f)).toEqual([]);
  });

  it("treats 'extra virgin' and 'extra sharp' as grades, not removable fillers", () => {
    expect(findDuplicates(ing({ 'extra virgin olive oil': 'fat', 'olive oil': 'fat', 'extra sharp cheese': 'dairy', 'sharp cheese': 'dairy' }))).toEqual([]);
  });
  it("still strips a plain 'extra'", () => {
    const f = findDuplicates(ing({ 'extra sugar': 'sweetener', sugar: 'sweetener' }));
    expect(f[0]).toMatchObject({ confidence: 'HIGH', suggestion: "merge into 'sugar'" });
  });

  it('honours the keep list', () => {
    const f = findDuplicates(data, { keep: new Set(['ground beef', 'whole milk', 'extra virgin olive oil']) });
    expect(items(f)).not.toContain('ground beef');
    expect(items(f)).not.toContain('whole milk');
    expect(items(f)).toContain('lean beef');
  });
});

describe('findNonFood', () => {
  const f = findNonFood(ing({ cheesecloth: 'other', 'cookie cutter': 'other', unsalted: 'other', 'orange flavor': 'other',
    'vanilla flavoring': 'other', x: 'other', cheesecake: 'baked', 'cheese cracker': 'baked', 'epsom salt': 'other', 'cookie dough': 'baked', 'cookie': 'baked' }));
  it('finds equipment, bare adjectives, bare flavour words, tiny names', () => {
    expect(items(f)).toEqual(expect.arrayContaining(['cheesecloth', 'cookie cutter', 'unsalted', 'orange flavor', 'x', 'epsom salt']));
    expect(f.find((x) => x.item === 'vanilla flavoring').confidence).toBe('LOW');
  });
  it('does not flag real foods that share a word', () => {
    expect(items(f)).not.toContain('cheesecake');
    expect(items(f)).not.toContain('cheese cracker');
    expect(items(f)).not.toContain('cookie dough');
    expect(items(f)).not.toContain('cookie');
  });
});

describe('findPackaged', () => {
  const f = findPackaged(ing({ velveeta: 'dairy', 'velveeta cheese': 'dairy', 'yellow cake mix': 'baked', 'cream of mushroom soup': 'liquid',
    'cream of celery': 'liquid', 'cream of tartar': 'baking', 'cream of wheat': 'grain', 'cream of coconut': 'sweetener', 'strawberry flavored gelatin': 'confection',
    'unflavored gelatin': 'thickener', 'instant vanilla pudding': 'confection', 'rotel': 'vegetable', 'spam': 'protein', 'spaghetti': 'grain', 'mix': 'other', 'pancake mix': 'baked' }));
  it('finds brands, mixes, condensed soups and flavored products', () => {
    expect(items(f)).toEqual(expect.arrayContaining(['velveeta', 'velveeta cheese', 'yellow cake mix', 'cream of mushroom soup', 'cream of celery',
      'strawberry flavored gelatin', 'instant vanilla pudding', 'spam', 'pancake mix']));
    expect(f.find((x) => x.item === 'strawberry flavored gelatin').confidence).toBe('LOW');
  });
  it("does not flag cream of tartar, wheat or coconut, unflavored gelatin, or 'spaghetti'", () => {
    for (const n of ['cream of tartar', 'cream of wheat', 'cream of coconut', 'unflavored gelatin', 'spaghetti', 'mix']) expect(items(f)).not.toContain(n);
  });
});

describe('category rules', () => {
  const data = {
    cheddar: { category: 'dairy' }, brie: { category: 'dairy' }, 'goat cheese': { category: 'dairy' }, 'blue cheese': { category: 'dairy' },
    parmesan: { category: 'umami' }, cheesecake: { category: 'baked' }, cheesecloth: { category: 'other' }, 'romano bean': { category: 'protein' },
    'lemon juice': { category: 'citrus' }, 'lime juice': { category: 'citrus' }, 'pineapple juice': { category: 'liquid' }, 'orange juice': { category: 'citrus' },
    'wheat flour': { category: 'grain' }, 'rice flour': { category: 'grain' }, 'flour tortilla': { category: 'baked' }, 'corn flour': { category: 'thickener' },
    sherry: { category: 'spirit' }, 'red wine': { category: 'liquid' }, 'white wine': { category: 'liquid' }, 'dry sherry': { category: 'spirit' }, 'rose wine': { category: 'liquid' }, 'wine vinegar': { category: 'acid' },
    beer: { category: 'liquid' }, 'ginger beer': { category: 'mixer' }, 'root beer': { category: 'liquid' }, cider: { category: 'liquid' }, vodka: { category: 'spirit' }, 'peanut butter': { category: 'nut' },
  };
  it('puts members in the family and reports the minority', () => {
    const s = Object.fromEntries(categorySplits(data).map((x) => [x.family, x]));
    expect(s.cheese.minority).toEqual(['parmesan']);
    expect(s.cheese.total).toBe(5);
    expect(s.juice.majority).toBe('citrus');
    expect(s.juice.minority).toEqual(['pineapple juice']);
    expect(s.flour.minority).toEqual(['corn flour']);
    expect(s.wine.minority.sort()).toEqual(['dry sherry', 'sherry']);
  });
  it('does not count cheesecake, cheesecloth, romano bean as cheese, or a vinegar as wine', () => {
    const s = Object.fromEntries(categorySplits(data).map((x) => [x.family, x]));
    expect(s.cheese.total).toBe(5);
    expect(s.wine.total).toBe(5);
    expect(s.juice.total).toBe(4);
  });
  it('treats ginger beer and root beer as soft drinks, not beer', () => {
    const s = Object.fromEntries(categorySplits(data).map((x) => [x.family, x]));
    expect(s.beer.total).toBe(2);
    expect(s.beer.minority).toEqual([]);
  });
  it('pineapple juice is a juice; findings name the category used by most', () => {
    const f = findCategoryInconsistencies(data);
    const p = f.find((x) => x.item === 'pineapple juice');
    expect(p.rule).toBe('category-juice');
    expect(p.suggestion).toBe("consider category 'citrus'");
  });
  it("lists every entry in the 'umami' category", () => {
    const f = findCategoryInconsistencies(data).filter((x) => x.rule === 'category-umami');
    expect(items(f)).toEqual(['parmesan']);
  });
});

describe('taste rules', () => {
  const data = {
    flour: { category: 'grain', taste: 'sweet' }, rice: { category: 'grain', taste: 'sweet' }, 'sweet rice': { category: 'grain', taste: 'sweet' },
    'rice vinegar': { category: 'acid', taste: 'sour sweet' }, butter: { category: 'fat', taste: 'sweet' }, 'peanut butter': { category: 'nut', taste: 'sweet' },
    'salad oil': { category: 'fat', taste: 'sweet' }, 'soda water': { category: 'liquid', taste: 'sweet' }, 'coconut water': { category: 'liquid', taste: 'sweet' },
    vodka: { category: 'spirit', taste: 'sweet bitter' }, gin: { category: 'spirit', taste: 'sweet' }, bread: { category: 'baked', taste: 'umami' },
    weird: { category: 'other', taste: 'sweet fruity' }, none: { category: 'other', taste: '' },
  };
  it('finds starches, plain fats, water and neutral spirits labelled sweet', () => {
    expect(items(findTasteNeutralSweet(data))).toEqual(['butter', 'flour', 'rice', 'salad oil', 'soda water', 'vodka']);
  });
  it("does not flag peanut butter, coconut water, gin, 'sweet rice', rice vinegar, or a starch not labelled sweet", () => {
    const names = items(findTasteNeutralSweet(data));
    for (const n of ['peanut butter', 'coconut water', 'gin', 'sweet rice', 'rice vinegar', 'bread']) expect(names).not.toContain(n);
  });
  it('flags words outside the vocabulary and missing labels', () => {
    const f = findTasteVocabulary(data);
    expect(f.find((x) => x.item === 'weird')).toMatchObject({ rule: 'taste-vocab', detail: expect.stringContaining('fruity') });
    expect(f.find((x) => x.item === 'none').rule).toBe('taste-missing');
    expect(items(f)).not.toContain('flour');
  });
  it('counts the first taste word per category and flags rare ones in large categories only', () => {
    const big = {};
    for (let i = 0; i < 40; i++) big[`s${i}`] = { category: 'spice', taste: 'pungent' };
    big.odd = { category: 'spice', taste: 'sweet' };
    big.tiny = { category: 'small', taste: 'sweet' };
    expect(tasteDistribution(big).spice).toEqual({ pungent: 40, sweet: 1 });
    const f = findTasteOutliers(big);
    expect(items(f)).toEqual(['odd']);
  });
});

describe('cocktailChecks', () => {
  const line = (name, amount_ml = 30) => ({ raw: name, name, amount_ml, measure: amount_ml ? '1 oz' : '' });
  const codex = {
    families: [{ id: 0, name: 'Sour Family' }, { id: 1, name: 'Boozy Sippers' }],
    subclusters: [{ id: '0.0', family_id: 0, size: 3, exemplars: ['A'] }, { id: '1.0', family_id: 1, name: 'Named', size: 1 }],
    cocktails: [
      { name: 'White Russian', canonical: 'white russian', family_id: 0, ingredients_raw: [line('vodka'), line('coffee liqueur'), line('cream')] },
      { name: 'Whiskey Sour', canonical: 'whiskey sour', family_id: 0, ingredients_raw: [line('bourbon'), line('lemon juice'), line('egg white')] },
      { name: 'Eggnog', canonical: 'eggnog', family_id: 0, ingredients_raw: [{ raw: 'Whole egg' }, line('milk')] },
      { name: 'Mojito', canonical: 'mojito', family_id: 1, ingredients_raw: [line('light rum'), line('lime')] },
      { name: 'Old Fashioned', canonical: 'old fashioned', family_id: 1, ingredients_raw: [line('bourbon'), line('bitters')] },
      { name: 'Old-Fashioned', canonical: 'old-fashioned', family_id: 1, ingredients_raw: [line('rye'), line('bitters')] },
      { name: 'Raw Only', canonical: 'raw only', family_id: 1, ingredients_raw: [{ raw: 'Gin' }, { raw: 'Vermouth' }] },
      { name: 'Coladaish', canonical: 'coladaish', family_id: 1, ingredients_raw: [line('rum'), line('coconut cream')] },
    ],
  };
  const r = cocktailChecks(codex);
  const by = (rule) => r.findings.filter((f) => f.rule === rule).map((f) => f.item);

  it('finds cream and egg drinks, including lines with only raw text, but not egg white, coconut cream or cream of tartar', () => {
    expect(by('cocktail-cream-egg').sort()).toEqual(['Eggnog', 'White Russian']);
    expect(r.byFamily['Sour Family']).toEqual({ total: 3, creamEgg: 2 });
    expect(isCreamOrEggDrink({ ingredients_raw: [line('cream of tartar'), line('cream soda'), line('egg white')] })).toBe(false);
    expect(isCreamOrEggDrink({ ingredients_raw: [{ raw: '2 oz heavy cream' }] })).toBe(true);
  });
  it('finds lemon or lime only in the stirred and boozy families', () => {
    expect(by('cocktail-citrus-stirred')).toEqual(['Mojito']);
  });
  it('finds drinks with no amount on any line', () => {
    expect(by('cocktail-no-amounts')).toEqual(['Raw Only']);
  });
  it('finds duplicate names after ignoring punctuation and accents', () => {
    expect(by('cocktail-duplicate')).toEqual(['Old Fashioned']);
    expect(normalizeName('Piña Colada')).toBe(normalizeName('Pina  colada'));
  });
  it('finds unnamed sub-groups', () => {
    expect(by('cocktail-subgroup-unnamed')).toEqual(['sub-group 0.0']);
  });
  it('reports missing classics and not present ones', () => {
    const missing = by('cocktail-missing-classic');
    expect(missing).toContain('negroni');
    expect(missing).not.toContain('mojito');
    expect(missing).not.toContain('old fashioned');
    expect(missing).not.toContain('whiskey sour');
  });
});

describe('sauceChecks', () => {
  it("lists sauces under 'Independent' and gives the share", () => {
    const r = sauceChecks([{ name: 'A', motherSauce: 'Independent', cuisine: 'French' }, { name: 'B', motherSauce: 'Mole', cuisine: 'Mexican' }, { name: 'C', motherSauce: 'Independent' }]);
    expect(r.findings.map((f) => f.item)).toEqual(['A', 'C']);
    expect(r.independent).toBe(2);
    expect(r.motherSauce).toEqual({ Independent: 2, Mole: 1 });
    expect(r.cuisine).toEqual({ French: 1, Mexican: 1, '(none)': 1 });
  });
  it('reports nothing when no sauce is in the catch-all', () => {
    expect(sauceChecks([{ name: 'B', motherSauce: 'Mole' }]).findings).toEqual([]);
  });
});

describe('dishChecks', () => {
  const input = {
    dishTypes: { a: 'soup', b: 'soup', c: 'pizza', d: 'wok' },
    cookbookTypes: { soup: 'Soup', pizza: 'Pizza', wok: 'Stir-fry', dip: 'Dip' },
    inventTypes: [{ id: 'soup', label: 'Soup', dishType: 'soup' }, { id: 'stir-fry', label: 'Stir-fry', dishType: 'wok' }],
  };
  const r = dishChecks(input);
  it('finds Cookbook types with one dish', () => {
    expect(r.findings.filter((f) => f.rule === 'dish-singleton').map((f) => f.item)).toEqual(['Pizza (pizza)', 'Stir-fry (wok)']);
  });
  it('finds Cookbook types with no Invent equivalent, and not the covered ones', () => {
    const names = r.findings.filter((f) => f.rule === 'dish-no-invent-equivalent').map((f) => f.item);
    expect(names).toEqual(['Pizza (pizza)', 'Dip (dip)']);
  });
});

describe('partitionReviewed', () => {
  const f = (rule, item) => ({ rule, item });
  const decided = { aliased: new Set(['tomatoe']), hidden: new Set(['fryer']), packaged: new Set(['cool whip']), kept: new Set(['new potato']) };
  it('a candidate already aliased, hidden, flagged packaged or kept is reviewed; the rest is not', () => {
    const { unreviewed, handledItems } = partitionReviewed([
      f('duplicate-misspelling', 'tomatoe'), f('non-food', 'fryer'), f('packaged-brand', 'cool whip'), f('duplicate-prefix', 'new potato'),
      f('duplicate-prefix', 'lean beef'), f('packaged-mix', 'cake mix'),
    ], decided);
    expect(unreviewed.map((x) => x.item)).toEqual(['lean beef', 'cake mix']);
    expect([...handledItems.aliased]).toEqual(['tomatoe']);
    expect([...handledItems.hidden]).toEqual(['fryer']);
    expect([...handledItems.packaged]).toEqual(['cool whip']);
    expect([...handledItems.kept]).toEqual(['new potato']);
  });
  it('a name flagged by two rules is counted once per group', () => {
    const { handledItems, unreviewed } = partitionReviewed([f('duplicate-prefix', 'cool whip'), f('packaged-brand', 'cool whip')], decided);
    expect(unreviewed).toEqual([]);
    expect(handledItems.packaged.size).toBe(1);
  });
  it('never treats a category or taste finding as reviewed, even for a decided name', () => {
    const { unreviewed } = partitionReviewed([f('category-cheese', 'cool whip'), f('taste-outlier', 'fryer')], decided);
    expect(unreviewed).toHaveLength(2);
  });
  it('a near miss: a name that merely contains a decided name is still unreviewed', () => {
    expect(partitionReviewed([f('duplicate-prefix', 'freshly tomatoe')], decided).unreviewed).toHaveLength(1);
  });
});
