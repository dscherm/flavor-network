import { useMemo } from 'react';
import { TASTE_COLORS } from '../utils/color.js';
import { scoreIngredient } from '../data/tastePositioning.js';
import { getNeighbors } from '../data/graph.js';

export default function RecipePanel({
  ingredients,
  nodes,
  edges,
  onRemove,
  onRecenter,
  onClear,
  onSave,
  recipeTitle,
  onTitleChange,
}) {
  // Compute dominant taste badge for each ingredient
  const tasteBadges = useMemo(() => {
    const map = {};
    for (const name of ingredients) {
      const node = nodes?.get(name) || {};
      const { channels } = scoreIngredient(name, node);
      let best = 'umami';
      let max = -1;
      for (const [k, v] of Object.entries(channels)) {
        if (v > max) { max = v; best = k; }
      }
      map[name] = best;
    }
    return map;
  }, [ingredients, nodes]);

  // Compute compatibility score (avg pairwise strength)
  const compatibility = useMemo(() => {
    if (ingredients.length < 2 || !edges) return null;
    let total = 0;
    let count = 0;
    for (let i = 0; i < ingredients.length; i++) {
      const neighbors = getNeighbors(ingredients[i], edges);
      const neighborMap = new Map(neighbors.map(n => [n.name, n.strength]));
      for (let j = i + 1; j < ingredients.length; j++) {
        const strength = neighborMap.get(ingredients[j]) || 0;
        total += strength;
        count++;
      }
    }
    return count > 0 ? Math.round((total / count) * 100) : 0;
  }, [ingredients, edges]);

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: 'Caveat, cursive' }}>
      {/* Title */}
      <div className="px-4 pt-4 pb-2">
        <input
          type="text"
          value={recipeTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Recipe name..."
          className="w-full text-2xl font-bold bg-transparent border-b-2 border-[#c9b99a] outline-none placeholder-[#b8a88a]"
          style={{ color: '#3a3428', fontFamily: 'Caveat, cursive' }}
        />
      </div>

      {/* Ingredient list */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {ingredients.length === 0 && (
          <p className="text-[#9a8a6a] text-lg italic mt-4">
            Click ingredients on the notebook to add them here...
          </p>
        )}
        {ingredients.map((name) => {
          const taste = tasteBadges[name];
          const color = TASTE_COLORS[taste] || TASTE_COLORS.default;
          return (
            <div
              key={name}
              className="flex items-center gap-2 py-1.5 border-b border-[#e8dcc8]"
            >
              <span
                className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-lg flex-1" style={{ color: '#3a3428' }}>
                {name}
              </span>
              <button
                onClick={() => onRecenter(name)}
                className="text-sm px-1.5 py-0.5 rounded hover:bg-[#e8dcc8] transition-colors"
                style={{ color: '#7a6a4a' }}
                title="Re-center on this ingredient"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </button>
              <button
                onClick={() => onRemove(name)}
                className="text-sm px-1.5 py-0.5 rounded hover:bg-red-100 hover:text-red-500 transition-colors"
                style={{ color: '#a08a6a' }}
                title="Remove"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* Compatibility score */}
      {compatibility !== null && (
        <div className="px-4 py-2 border-t border-[#d8cca8]">
          <div className="flex items-center justify-between">
            <span className="text-lg" style={{ color: '#5a4a2a' }}>Compatibility</span>
            <span
              className="text-2xl font-bold"
              style={{
                color: compatibility > 60 ? '#4a8a4a' : compatibility > 30 ? '#8a7a3a' : '#8a4a4a',
              }}
            >
              {compatibility}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#e8dcc8] mt-1">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${compatibility}%`,
                backgroundColor: compatibility > 60 ? '#6aaa6a' : compatibility > 30 ? '#aaa06a' : '#aa6a6a',
              }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t border-[#d8cca8] flex gap-2">
        <button
          onClick={onSave}
          disabled={ingredients.length < 2}
          className="flex-1 py-2 rounded-lg text-lg font-bold transition-colors disabled:opacity-40"
          style={{
            backgroundColor: '#3a3428',
            color: '#fefae0',
          }}
        >
          Save Recipe
        </button>
        <button
          onClick={onClear}
          className="px-4 py-2 rounded-lg text-lg transition-colors hover:bg-[#e8dcc8]"
          style={{ color: '#7a6a4a' }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
