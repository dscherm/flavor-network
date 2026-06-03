/**
 * MakeRecipeCardsGrid — chalkboard-styled ingredient card grid.
 * (B-version P4 §MAKE-RECIPE-CARDS.)
 *
 * Renders the current recipe's ingredients as a responsive grid of
 * chalkboard-menu cards. Cluster-color hero disc + ingredient name
 * (Caveat handwriting + chalk text-shadow). Tap a card → fires
 * onCardTap(name) which the parent routes to PairingMode.
 *
 * Empty state shows a chalk-styled hint pointing to the "+ Add"
 * affordance in the parent chrome.
 */

import React from 'react';

const FONT_HAND = 'Caveat, cursive';
const CHALK_BG = `
  radial-gradient(ellipse at center, #1c1c1c 0%, #0a0a0a 75%, #050505 100%),
  #0a0a0a
`;
const CHALK_CREAM = '#f5efde';
const CHALK_DIM = '#bdb6a3';
const CHALK_SUB = '#8a8478';
const CHALK_TEXT_SHADOW = '0 0 1px rgba(245,239,222,0.55), 0 0 3px rgba(245,239,222,0.22)';

const CLUSTER_COLORS = [
  '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7',
  '#84cc16', '#fb7185', '#0ea5e9', '#facc15', '#14b8a6',
  '#fde68a', '#94a3b8',
];
function clusterColor(node) {
  const cid = typeof node?.cluster === 'number' ? node.cluster : 0;
  return CLUSTER_COLORS[cid % CLUSTER_COLORS.length];
}

function HeroDisc({ node, size = 48 }) {
  const ch = (node?.name || '?').trim().charAt(0).toUpperCase();
  const fill = clusterColor(node);
  return (
    <div
      className="flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: fill,
        boxShadow: `0 0 12px ${fill}66`,
        color: '#0a0a0f',
        fontSize: size * 0.5,
        fontWeight: 700,
        fontFamily: FONT_HAND,
      }}
      aria-hidden="true"
    >
      {ch}
    </div>
  );
}

// Category → default portion suggestion. Used when total recipe size
// ≥ MIN_FOR_SUGGEST AND the category lookup matches. Heuristic only;
// production version would consult recipe_pairs.json median quantities.
const PORTION_BY_CATEGORY = {
  Spice: '1 tsp',
  Herb: '1 tbsp',
  Aromatic: '1 clove',
  Vegetable: '1 cup, chopped',
  Fruit: '1/2 cup',
  Protein: '1 lb',
  Dairy: '1/2 cup',
  Fat: '2 tbsp',
  Sweetener: '2 tbsp',
  Grain: '1 cup',
  Other: 'to taste',
};
const MIN_FOR_SUGGEST = 3;
export function suggestPortion(node, recipeCount) {
  if (recipeCount < MIN_FOR_SUGGEST) return null;
  const cat = node?.category;
  if (typeof cat === 'string' && PORTION_BY_CATEGORY[cat]) {
    return PORTION_BY_CATEGORY[cat];
  }
  return 'to taste';
}

function PortionCard({ node, portion, onChange, onSuggest, recipeCount }) {
  if (!node || !node.name) return null;
  const canSuggest = recipeCount >= MIN_FOR_SUGGEST;
  return (
    <div
      className="rounded-xl flex flex-col gap-1.5 px-3 py-2"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: `1px dashed #4a4a4a`,
      }}
      data-testid={`make-recipe-portion-${node.name}`}
    >
      <label
        className="text-[11px] uppercase tracking-[0.16em] text-center"
        style={{ color: CHALK_DIM, fontFamily: FONT_HAND, letterSpacing: '0.06em', textShadow: CHALK_TEXT_SHADOW }}
      >
        Portion
      </label>
      <input
        type="text"
        value={portion || ''}
        placeholder="amount…"
        onChange={(e) => onChange?.(node.name, e.target.value)}
        data-testid={`make-recipe-portion-input-${node.name}`}
        className="w-full text-center bg-transparent outline-none border-0"
        style={{
          color: CHALK_CREAM,
          fontFamily: FONT_HAND,
          fontSize: 17,
          textShadow: CHALK_TEXT_SHADOW,
          borderBottom: `1px dotted ${CHALK_DIM}66`,
        }}
      />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSuggest?.(node.name); }}
        disabled={!canSuggest}
        data-testid={`make-recipe-suggest-${node.name}`}
        className="rounded-md py-1 px-2"
        style={{
          color: canSuggest ? CHALK_CREAM : CHALK_SUB,
          background: canSuggest ? 'rgba(134, 239, 172, 0.10)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${canSuggest ? '#6ee7b7' : CHALK_SUB}55`,
          fontFamily: FONT_HAND,
          fontSize: 14,
          textShadow: CHALK_TEXT_SHADOW,
          cursor: canSuggest ? 'pointer' : 'not-allowed',
        }}
      >
        {canSuggest ? 'Suggest portion' : 'Choose more ingredients'}
      </button>
    </div>
  );
}

function IngredientCard({ node, onTap, onRemove }) {
  if (!node || !node.name) return null;
  const cuisine = Array.isArray(node.cuisines) && node.cuisines.length > 0
    ? node.cuisines[0]
    : '';
  return (
    <div
      className="relative rounded-xl flex flex-col items-center justify-center px-3 py-4 cursor-pointer hover:brightness-110 transition-all"
      style={{
        background: CHALK_BG,
        border: `2px double #4a4a4a`,
        boxShadow: `inset 0 0 0 1px #6a6a6a55, 0 4px 12px rgba(0,0,0,0.45)`,
        minHeight: 140,
      }}
      onClick={() => onTap?.(node.name)}
      role="button"
      aria-label={`Open ${node.name} pairings`}
      data-testid={`make-recipe-card-${node.name}`}
    >
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(node.name); }}
          aria-label={`Remove ${node.name} from recipe`}
          data-testid={`make-recipe-remove-${node.name}`}
          className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-base leading-none"
          style={{
            color: CHALK_SUB,
            background: 'rgba(0,0,0,0.4)',
            border: `1px solid ${CHALK_SUB}55`,
            fontFamily: FONT_HAND,
          }}
        >
          ×
        </button>
      )}
      <HeroDisc node={node} />
      <h4
        className="text-center mt-2"
        style={{
          color: CHALK_CREAM,
          fontFamily: FONT_HAND,
          fontSize: 20,
          lineHeight: 1.05,
          textShadow: CHALK_TEXT_SHADOW,
        }}
      >
        {node.name}
      </h4>
      {cuisine && (
        <span
          className="text-[11px] mt-1"
          style={{ color: CHALK_DIM, fontFamily: FONT_HAND, textShadow: CHALK_TEXT_SHADOW }}
        >
          {cuisine}
        </span>
      )}
    </div>
  );
}

export default function MakeRecipeCardsGrid({
  ingredients = [],
  nodes = null,
  portions = {},
  onCardTap,
  onRemove,
  onPortionChange,
  onSuggestPortion,
}) {
  const resolved = ingredients
    .map((name) => {
      if (!name) return null;
      if (nodes && typeof nodes.get === 'function') {
        const node = nodes.get(name);
        if (node) return node;
      }
      return { name };
    })
    .filter(Boolean);

  if (resolved.length === 0) {
    return (
      <div
        className="rounded-xl flex flex-col items-center justify-center px-6 py-12 text-center"
        style={{
          background: CHALK_BG,
          border: `2px dashed #4a4a4a`,
          minHeight: 220,
        }}
        data-testid="make-recipe-empty"
      >
        <p
          className="text-2xl mb-2"
          style={{ color: CHALK_CREAM, fontFamily: FONT_HAND, textShadow: CHALK_TEXT_SHADOW }}
        >
          Today's specials —
        </p>
        <p
          className="text-base"
          style={{ color: CHALK_DIM, fontFamily: FONT_HAND, textShadow: CHALK_TEXT_SHADOW }}
        >
          tap "+ Add" above to chalk your first ingredient on the board.
        </p>
      </div>
    );
  }

  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
      }}
      data-testid="make-recipe-cards-grid"
      data-count={resolved.length}
    >
      {resolved.map((node) => (
        <div key={node.name} className="flex flex-col gap-1.5">
          <IngredientCard
            node={node}
            onTap={onCardTap}
            onRemove={onRemove}
          />
          <PortionCard
            node={node}
            portion={portions?.[node.name] || ''}
            onChange={onPortionChange}
            onSuggest={onSuggestPortion}
            recipeCount={resolved.length}
          />
        </div>
      ))}
    </div>
  );
}

export { clusterColor };
