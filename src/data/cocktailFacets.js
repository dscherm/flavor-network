/**
 * cocktailFacets.js — search facets for the Cocktail Lab, derived from the
 * data each cocktail already carries (ingredient slots, build method, ice,
 * glass, family) rather than hand-tagged. Everything here is a rule; the
 * rules are the documentation.
 *
 * deriveFacets(cocktail, ctx) → {
 *   glass:       one of GLASS_TYPES (normalised from 40+ spellings)
 *   strength:    'light' | 'medium' | 'strong'
 *   effort:      'easy' | 'moderate' | 'involved'
 *   equipment:   'none' | 'shaker' | 'blender'
 *   temperature: 'cold' | 'frozen' | 'hot'
 *   batchable:   boolean
 *   dietary:     { egg, dairy }
 *   seasons:     subset of SEASONS
 *   occasions:   subset of OCCASIONS
 *   character:   subset of CHARACTERS  (sweet / sour / bitter / boozy / creamy / bubbly)
 * }
 * ctx = { slotOf(name) → slot|null, seasonOf(name) → season|null }
 */
import { normalizeIngredient } from './normalizeIngredient.js';

export const GLASS_TYPES = ['coupe', 'rocks', 'highball', 'flute', 'wine', 'mug', 'beer', 'hurricane', 'punch', 'shot'];
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const OCCASIONS = ['brunch', 'aperitivo', 'dinner party', 'nightcap', 'poolside', 'holiday', 'big batch'];
export const CHARACTERS = ['sweet', 'sour', 'bitter', 'boozy', 'creamy', 'bubbly'];
export const STRENGTHS = ['light', 'medium', 'strong'];
export const EFFORTS = ['easy', 'moderate', 'involved'];

// Raw glass string (lower-cased) → normalised type. First matching rule wins.
const GLASS_RULES = [
  [/coupe|cocktail glass|martini|nick and nora|cordial|whiskey sour|coupette|margarita/, 'coupe'],
  [/old.?fashioned|rocks|tumbler|whiskey glass|double/, 'rocks'],
  [/highball|collins|copper mug/, 'highball'],
  [/flute/, 'flute'],
  [/wine|balloon|snifter/, 'wine'],
  [/coffee|irish|mug/, 'mug'],
  [/beer|pilsner|pint/, 'beer'],
  [/hurricane|tiki/, 'hurricane'],
  [/punch|pitcher|jar/, 'punch'],
  [/shot/, 'shot'],
];

export function normalizeGlass(raw, { ice = null, build = null } = {}) {
  const s = String(raw || '').toLowerCase();
  for (const [rx, type] of GLASS_RULES) if (rx.test(s)) return type;
  // No glass recorded: infer from how it is served.
  if (ice === 'up') return 'coupe';
  if (ice === 'tall') return 'highball';
  if (ice === 'rocks' || ice === 'crushed') return 'rocks';
  if (build === 'blend') return 'hurricane';
  if (build === 'shake' || build === 'stir') return 'coupe';
  if (build === 'build') return 'highball';
  if (build === 'muddle' || build === 'swizzle') return 'rocks';
  return null;
}

const EGG_RE = /\begg\b|\beggs\b|eggnog|\bflip\b/;
const DAIRY_RE = /\bcream\b|\bmilk\b|half.and.half|creme de cacao|irish cream|baileys|advocaat|condensed/;
const HOT_RE = /\bhot\b|coffee|\btea\b|toddy|mulled|cocoa|chocolate/;
const BUBBLY_RE = /champagne|prosecco|cava|sparkling|soda|seltzer|tonic|ginger beer|ginger ale|cola|beer|spritz|fizz/;
const SYRUP_WORK_RE = /infus|house.?made|homemade|tincture|solution|batter|cordial|shrub|oleo/;

// Slot guess from the name alone, used when the slot dictionary has no
// entry (or has not loaded). Order matters: "lime juice" is sour before
// "juice" is a modifier; "sweet vermouth" is vermouth before "sweet".
const SLOT_GUESS = [
  [/bitters/, 'bitter'],
  [/vermouth|lillet|cocchi|dubonnet|quinquina/, 'vermouth'],
  [/campari|aperol|amaro|chartreuse|benedictine|fernet|cynar|liqueur|curacao|triple sec|cointreau|maraschino|creme de|schnapp|kahlua|baileys|sambuca|absinthe|st germain|elderflower/, 'amaro_liqueur'],
  [/lemon juice|lime juice|grapefruit juice|citrus|lemon$|lime$|verjus|vinegar|shrub/, 'sour'],
  [/syrup|sugar|honey|agave|grenadine|orgeat|falernum|cordial/, 'sweet'],
  [/\bgin\b|vodka|\brum\b|rhum|cachaca|whisk|bourbon|\brye\b|scotch|tequila|mezcal|brandy|cognac|armagnac|pisco|calvados|aquavit|grappa|singani|everclear|sake|soju|baijiu|port\b|sherry|madeira/, 'spirit'],
  [/juice|soda|tonic|cola|beer|ale|champagne|prosecco|cava|wine|cream|milk|coffee|tea|water|coconut|egg|puree|nectar|cider/, 'modifier'],
  [/mint|basil|twist|peel|zest|salt|pepper|nutmeg|cinnamon|clove|tincture|solution|garnish|cherry|olive|rosemary|thyme/, 'aromatic'],
];
export function guessSlot(name) {
  const n = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  for (const [rx, slot] of SLOT_GUESS) if (rx.test(n)) return slot;
  return null;
}

function seasonsFromIngredient(season) {
  // season_region.json uses values like 'summer', 'autumn-winter', 'late spring'.
  const s = String(season || '').toLowerCase();
  if (!s || s === 'year-round') return [];
  return SEASONS.filter((name) => s.includes(name));
}

export function deriveFacets(cocktail, ctx = {}) {
  const slotOf = ctx.slotOf || (() => null);
  const seasonOf = ctx.seasonOf || (() => null);
  const raws = (cocktail?.ingredients_raw || []).map((r) => (typeof r === 'string' ? r : r?.raw || '')).filter(Boolean);
  const names = raws.map((r) => normalizeIngredient(r)).filter(Boolean);
  const text = `${cocktail?.name || ''} ${raws.join(' ')}`.toLowerCase();
  const build = cocktail?.build_method || null;
  const ice = cocktail?.ice_format || null;

  const slots = names.map((n) => slotOf(n) || slotOf(n.split(' ').slice(-1)[0]) || guessSlot(n));
  const count = (slot) => slots.filter((s) => s === slot).length;
  const spirits = count('spirit');
  const sours = count('sour');
  const sweets = count('sweet');
  const bitters = count('bitter') + count('amaro_liqueur');
  const modifiers = count('modifier');
  const bubbly = BUBBLY_RE.test(text);
  const dairy = DAIRY_RE.test(text);
  const egg = EGG_RE.test(text);
  const hot = HOT_RE.test(text) && !/iced|cold brew|frozen/.test(text) && !bubbly;

  // Strength: spirit-forward stirred/built drinks are strong; anything
  // lengthened with soda, juice, cream or wine is light; shaken sours sit
  // in the middle.
  let strength = 'medium';
  const lengthened = modifiers > 0 || bubbly || dairy;
  if (spirits + bitters >= 2 && sours === 0 && !lengthened && (build === 'stir' || build === 'build' || build == null)) strength = 'strong';
  else if ((spirits <= 1 && lengthened) || (spirits === 0)) strength = 'light';

  // Effort: ingredient count, technique, and whether something has to be
  // made first (infusions, tinctures, batters).
  const prepWork = SYRUP_WORK_RE.test(text) || egg;
  let effort = 'easy';
  if (prepWork || names.length >= 6 || build === 'blend') effort = 'involved';
  else if (names.length >= 4 || build === 'shake' || build === 'muddle' || build === 'swizzle') effort = 'moderate';

  const equipment = build === 'blend' ? 'blender' : (build === 'shake' ? 'shaker' : 'none');
  const temperature = hot ? 'hot' : (build === 'blend' || ice === 'crushed' ? 'frozen' : 'cold');
  const batchable = !egg && build !== 'blend' && (/punch|pitcher|sangria/.test(text) || normalizeGlass(cocktail?.glass) === 'punch' || (build === 'build' && names.length <= 3));

  const character = [];
  if (sweets >= 2 || dairy || /liqueur|cream|chocolate|coconut/.test(text)) character.push('sweet');
  if (sours >= 1) character.push('sour');
  if (bitters >= 1 || /campari|aperol|amaro|bitters/.test(text)) character.push('bitter');
  if (strength === 'strong') character.push('boozy');
  if (dairy || egg) character.push('creamy');
  if (bubbly) character.push('bubbly');

  const seasonSet = new Set();
  for (const n of names) for (const s of seasonsFromIngredient(seasonOf(n))) seasonSet.add(s);
  if (hot) { seasonSet.add('winter'); seasonSet.add('autumn'); }
  if (temperature === 'frozen' || /tropical|pineapple|coconut|mango|passion/.test(text)) seasonSet.add('summer');
  if (bubbly && strength === 'light') { seasonSet.add('spring'); seasonSet.add('summer'); }
  if (strength === 'strong' && !bubbly) { seasonSet.add('autumn'); seasonSet.add('winter'); }
  const seasons = SEASONS.filter((s) => seasonSet.has(s));

  const fam = cocktail?.family_id;
  const sub = String(cocktail?.subcluster_id || '');
  const occ = new Set();
  if (/coffee|mimosa|bellini|bloody|screwdriver|greyhound|salty dog|orange juice|grapefruit juice|tomato juice/.test(text) || sub === '5.1' || sub === '1.0') occ.add('brunch');
  if (fam === 5 || (/spritz|campari|aperol|vermouth|americano/.test(text) && strength !== 'strong') || (bubbly && bitters >= 1)) occ.add('aperitivo');
  if (strength === 'strong' || dairy || /coffee|chocolate|cognac|brandy|amaro|chartreuse|stinger|nightcap/.test(text)) occ.add('nightcap');
  if (cocktail?.iba_official || cocktail?.is_root || sub === '2.3' || sub === '4.1' || sub === '2.1') occ.add('dinner party');
  if (fam === 0 || temperature === 'frozen' || /pineapple|coconut|rum|tiki|mango|passion|tequila|paloma|mojito/.test(text) && strength !== 'strong') occ.add('poolside');
  if (hot || egg && dairy || /eggnog|mulled|cranberry|gingerbread|peppermint|spiced|cinnamon|nutmeg|clove/.test(text)) occ.add('holiday');
  if (batchable) occ.add('big batch');
  const occasions = OCCASIONS.filter((o) => occ.has(o));

  return {
    glass: normalizeGlass(cocktail?.glass, { ice, build }),
    strength, effort, equipment, temperature, batchable,
    dietary: { egg, dairy },
    seasons, occasions, character,
    ingredientCount: names.length,
  };
}

/** Group labels + chip values for the filter rail, in display order. */
export const FACET_GROUPS = [
  { key: 'occasions', label: 'Occasion', values: OCCASIONS, multi: true },
  { key: 'seasons', label: 'Season', values: SEASONS, multi: true },
  { key: 'strength', label: 'Strength', values: STRENGTHS },
  { key: 'character', label: 'Character', values: CHARACTERS, multi: true },
  { key: 'effort', label: 'Effort', values: EFFORTS },
  { key: 'glass', label: 'Glass', values: GLASS_TYPES },
];

/** Does a facet record satisfy the active filter { key → value }? */
export function matchesFacetFilter(facets, filter) {
  if (!filter) return true;
  for (const [key, value] of Object.entries(filter)) {
    if (value == null || value === '') continue;
    if (key === 'temperature' || key === 'strength' || key === 'effort' || key === 'glass' || key === 'equipment') {
      if (facets?.[key] !== value) return false;
    } else if (key === 'noEgg') {
      if (facets?.dietary?.egg) return false;
    } else if (key === 'noDairy') {
      if (facets?.dietary?.dairy) return false;
    } else if (Array.isArray(facets?.[key])) {
      if (!facets[key].includes(value)) return false;
    }
  }
  return true;
}

// ── Context loaders (cached) ──────────────────────────────────────────
let _ctxPromise = null;
/**
 * Loads cocktail_roles.json + season_region.json once and returns the
 * { slotOf, seasonOf } context deriveFacets wants. Never rejects; missing
 * files just mean fewer facets fire.
 */
export function loadFacetContext(base = '') {
  if (!_ctxPromise) {
    _ctxPromise = Promise.all([
      fetch(`${base}data/cocktail_roles.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${base}data/season_region.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([roles, seasons]) => {
      const byIng = roles?.byIngredient || {};
      return {
        slotOf: (name) => byIng[name]?.role || null,
        seasonOf: (name) => seasons?.[name]?.season || null,
      };
    });
  }
  return _ctxPromise;
}
