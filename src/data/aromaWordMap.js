/**
 * aromaWordMap.js — AROMA-1. The outside answer key: the chef-sourced entries of
 * public/proDataset/flavor_profiles_distilled.json name aromas in 17 words; the charts use eleven aromas
 * (and today only six of them). This is the one reviewable table that turns the 17 words into either set.
 * Pure: no file access. `toEleven` / `toSix` give the home of each word; `null` means the six-axis chart has none.
 */
export const AROMAS_ELEVEN = ['fruity', 'floral', 'green', 'woody', 'spice', 'fatty', 'toasty', 'nutty', 'earthy', 'smoky', 'savory'];
export const AROMAS_SIX = ['fruity', 'floral', 'green', 'woody', 'spice', 'fatty'];

/** word -> [eleven-aroma home, six-axis home or null] */
export const AROMA_WORD_MAP = {
  'alliaceous green': ['green', 'green'],
  caramel: ['toasty', null],
  citrusy: ['fruity', 'fruity'],
  creamy: ['fatty', 'fatty'],
  earthy: ['earthy', null],
  fatty: ['fatty', 'fatty'],
  fermented: ['savory', null],
  floral: ['floral', 'floral'],
  fruity: ['fruity', 'fruity'],
  green: ['green', 'green'],
  marine: ['savory', null],
  meaty: ['savory', null],
  nutty: ['nutty', null],
  roasted: ['toasty', null],
  smoky: ['smoky', null],
  spicy: ['spice', 'spice'],
  woody: ['woody', 'woody'],
};

export const AROMA_WORDS = Object.keys(AROMA_WORD_MAP);

const uniq = (list) => [...new Set(list.filter(Boolean))];

/** Words -> distinct eleven-aroma names (unknown words are dropped). */
export const toEleven = (words = []) => uniq(words.map((w) => AROMA_WORD_MAP[w]?.[0]));
/** Words -> distinct six-axis names; words with no six-axis home are dropped. */
export const toSix = (words = []) => uniq(words.map((w) => AROMA_WORD_MAP[w]?.[1]));

/**
 * chefTruthItems(distilled) -> [{ key, expect, expect6 }] for every entry with source "chef".
 * `expect` is an UNORDERED set (the word lists carry no order): an item passes when the chart's strongest
 * aroma is in the set. Entries whose words all map to nothing are skipped.
 */
export function chefTruthItems(distilled) {
  const out = [];
  for (const [key, e] of Object.entries(distilled?.ingredients || {})) {
    if (e.source !== 'chef') continue;
    const expect = toEleven(e.aromas);
    if (!expect.length) continue;
    out.push({ key, expect, expect6: toSix(e.aromas) });
  }
  return out;
}
