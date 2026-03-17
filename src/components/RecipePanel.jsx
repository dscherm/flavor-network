import { useState, useMemo } from 'react';
import { TASTE_COLORS } from '../utils/color.js';
import { scoreIngredient } from '../data/tastePositioning.js';
import { getNeighbors } from '../data/graph.js';
import { scoreStructures } from '../data/structureScoring.js';
import { analyzeRecipe } from '../data/recipeAnalysis.js';
import RecipeAnalysis from './RecipeAnalysis.jsx';

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
  centerIngredient,
  techniques = [],
  labMode = 'taste',
  selectedStructure,
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

  // Structure scoring — only for cocktail/sauce modes
  const structureScores = useMemo(() => {
    if (labMode === 'taste' || ingredients.length === 0) return null;
    return scoreStructures(ingredients, nodes, labMode);
  }, [ingredients, nodes, labMode]);

  const [showAnalysis, setShowAnalysis] = useState(false);

  const analysis = useMemo(() => {
    if (!showAnalysis || ingredients.length < 3) return null;
    return analyzeRecipe(ingredients, nodes, edges, labMode, selectedStructure);
  }, [showAnalysis, ingredients, nodes, edges, labMode, selectedStructure]);

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
          const isCenter = name === centerIngredient;
          return (
            <div
              key={name}
              className={`flex items-center gap-2 py-1.5 border-b transition-colors ${
                isCenter ? 'border-[#c9b99a] bg-[#f5edd0]/60' : 'border-[#e8dcc8]'
              }`}
            >
              {/* Taste color indicator — diamond for center, circle for others */}
              {isCenter ? (
                <span
                  className="inline-block flex-shrink-0"
                  style={{ width: 14, height: 14, transform: 'rotate(45deg)', backgroundColor: color, borderRadius: 2 }}
                />
              ) : (
                <span
                  className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
              )}
              <span
                className={`text-lg flex-1 ${isCenter ? 'font-bold' : ''}`}
                style={{ color: '#3a3428' }}
              >
                {name}
              </span>
              {isCenter && (
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: '#8a7a5a', backgroundColor: '#e8dcc0' }}>
                  center
                </span>
              )}
              <button
                onClick={() => onRecenter(name)}
                className={`text-sm px-1.5 py-0.5 rounded hover:bg-[#e8dcc8] transition-colors ${
                  isCenter ? 'opacity-30 pointer-events-none' : ''
                }`}
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

      {/* Analysis toggle + panel */}
      {ingredients.length >= 3 && (
        <div className="px-4 py-2 border-t border-[#d8cca8]">
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="flex items-center gap-1.5 text-sm py-1 px-2 rounded-md transition-colors hover:bg-[#e8dcc8]"
            style={{ color: showAnalysis ? '#3a3428' : '#7a6a4a' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            Analyze
            <span className="text-xs" style={{ color: '#9a8a6a' }}>{showAnalysis ? '\u25B4' : '\u25BE'}</span>
          </button>
          {showAnalysis && (
            <div className="mt-1">
              <RecipeAnalysis analysis={analysis} />
            </div>
          )}
        </div>
      )}

      {/* Common Techniques */}
      {techniques.length > 0 && (
        <div className="px-4 py-2 border-t border-[#d8cca8]">
          <p className="text-sm font-bold mb-1" style={{ color: '#7a6a4a' }}>Common Techniques</p>
          <div className="flex flex-wrap gap-1.5">
            {techniques.map((t) => (
              <span
                key={t}
                className="inline-block text-sm px-2 py-0.5 rounded-md"
                style={{ backgroundColor: '#e8dcc0', color: '#5a4a2a' }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Structure scoring — cocktail/sauce modes */}
      {structureScores && structureScores.length > 0 && ingredients.length >= 2 && (() => {
        const selected = selectedStructure
          ? structureScores.find(s => s.key === selectedStructure)
          : null;
        const best = structureScores[0];
        const second = structureScores[1];
        // Show "starting to look like" for the best match
        const showLooksLike = best && best.confidence >= 40 && (!selected || selected.key !== best.key);

        return (
          <div className="px-4 py-2 border-t border-[#d8cca8]">
            {/* Selected structure adherence */}
            {selected && (
              <div className="mb-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#5a4a2a' }}>{selected.name} adherence</span>
                  <span
                    className="text-xl font-bold"
                    style={{ color: selected.confidence > 60 ? '#4a8a4a' : selected.confidence > 30 ? '#8a7a3a' : '#8a4a4a' }}
                  >
                    {selected.confidence}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#e8dcc8] mt-0.5">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${selected.confidence}%`,
                      backgroundColor: selected.confidence > 60 ? '#6aaa6a' : selected.confidence > 30 ? '#aaa06a' : '#aa6a6a',
                    }}
                  />
                </div>
                {selected.missing.length > 0 && (
                  <p className="text-xs mt-1" style={{ color: '#8a7a5a' }}>
                    Missing: {selected.missing.join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* "Starting to look like..." hint */}
            {showLooksLike && (
              <p className="text-sm italic" style={{ color: '#7a6a4a' }}>
                {best.confidence >= 70
                  ? `This is a ${best.name}! (${best.confidence}%)`
                  : `Starting to look like a ${best.name}... (${best.confidence}%)`}
                {second && second.confidence >= 40 && second.key !== best.key && (
                  <span style={{ color: '#9a8a6a' }}>{' '}or a {second.name} ({second.confidence}%)</span>
                )}
              </p>
            )}
          </div>
        );
      })()}

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
