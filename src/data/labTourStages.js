/**
 * labTourStages.js — per-lab tour stage configs.
 *
 * Spec §2.J: when the user finishes the main GuidedTour and picks
 * "Recipes / Cocktail / Sauce Tour", they're routed into that lab
 * with a short follow-on overlay walking them through the lab's
 * specific mechanics. Shape matches `guidedTourStages.js`: each stage
 * has copy, gradient, accent, advance trigger, anchor.
 *
 * No scene actions — labs are React-rendered surfaces, not Three.js
 * canvases, so the popups are pure overlays. The user advances via
 * "Got it →" button only.
 */

const baseAdvance = { kind: 'userClick' };

export const RECIPES_LAB_STAGES = [
  {
    id: 'recipes-intro',
    title: 'Recipes — 15 curated dishes',
    copy:
      "These 15 dishes span six culinary traditions. Each card shows the cuisine, top ingredients, and a flavor cluster (savory / baking / seafood / vegetable).",
    gradient: 'linear-gradient(135deg, rgba(236,72,153,0.18), rgba(251,191,36,0.18))',
    accent: '#ec4899',
    advance: baseAdvance,
    popupAnchor: 'tl',
  },
  {
    id: 'recipes-filters',
    title: 'Filter by cuisine or flavor',
    copy:
      "Two filter rows: cuisine (Italian / Mexican / SE Asian / etc.) and flavor cluster (savory / baking / …). Combine to narrow the grid.",
    gradient: 'linear-gradient(135deg, rgba(34,211,238,0.18), rgba(236,72,153,0.18))',
    accent: '#22d3ee',
    advance: baseAdvance,
    popupAnchor: 'tr',
  },
  {
    id: 'recipes-detail',
    title: 'Open a recipe',
    copy:
      "Tap any card to see the full ingredient list. From there you can jump back to the network to explore that recipe's primary ingredient.",
    gradient: 'linear-gradient(135deg, rgba(132,204,22,0.18), rgba(34,211,238,0.18))',
    accent: '#84cc16',
    advance: baseAdvance,
    popupAnchor: 'br',
  },
];

export const COCKTAIL_LAB_STAGES = [
  {
    id: 'cocktail-intro',
    title: 'Cocktail Codex v2',
    copy:
      "441 cocktails grouped by data-driven family (Sour / Spirit-forward / Bitter / etc.). Each sphere is a cocktail; colors mark families and sub-clusters.",
    gradient: 'linear-gradient(135deg, rgba(167,139,250,0.18), rgba(244,114,182,0.18))',
    accent: '#a78bfa',
    advance: baseAdvance,
    popupAnchor: 'tl',
  },
  {
    id: 'cocktail-shapes',
    title: 'Shapes mark base spirit',
    copy:
      "Look at the legend bottom-left — each base spirit (gin, rum, whisky, agave, brandy) has its own shape. Same family + shape = closely related drinks.",
    gradient: 'linear-gradient(135deg, rgba(244,114,182,0.18), rgba(125,211,252,0.18))',
    accent: '#f472b6',
    advance: baseAdvance,
    popupAnchor: 'bl',
  },
  {
    id: 'cocktail-detail',
    title: 'Tap a cocktail',
    copy:
      "Selecting a drink opens a panel with the recipe, closest cousins within its family, and cross-family bridges. From there, send the ingredients to the Recipe Lab.",
    gradient: 'linear-gradient(135deg, rgba(125,211,252,0.18), rgba(132,204,22,0.18))',
    accent: '#7dd3fc',
    advance: baseAdvance,
    popupAnchor: 'tr',
  },
];

export const SAUCE_LAB_STAGES = [
  {
    id: 'sauce-intro',
    title: 'Sauce Codex',
    copy:
      "Mother sauces and their descendants, grouped by family (béchamel / velouté / espagnole / tomato / hollandaise + global). Each cluster is one family.",
    gradient: 'linear-gradient(135deg, rgba(251,146,60,0.18), rgba(251,191,36,0.18))',
    accent: '#fb923c',
    advance: baseAdvance,
    popupAnchor: 'tl',
  },
  {
    id: 'sauce-filters',
    title: 'Filter by cuisine',
    copy:
      "Sauces are tagged by cuisine of origin. Filter to a single tradition to see how that cuisine builds its sauce family from a few core techniques.",
    gradient: 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(132,204,22,0.18))',
    accent: '#fbbf24',
    advance: baseAdvance,
    popupAnchor: 'tr',
  },
  {
    id: 'sauce-detail',
    title: 'Tap a sauce',
    copy:
      "The detail panel shows ingredients with technique annotations, and similar sauces by ingredient overlap. Send the ingredients to the Recipe Lab to riff on it.",
    gradient: 'linear-gradient(135deg, rgba(132,204,22,0.18), rgba(244,114,182,0.18))',
    accent: '#84cc16',
    advance: baseAdvance,
    popupAnchor: 'br',
  },
];

export const LAB_STAGES = {
  recipes: RECIPES_LAB_STAGES,
  cocktail: COCKTAIL_LAB_STAGES,
  sauce: SAUCE_LAB_STAGES,
};
