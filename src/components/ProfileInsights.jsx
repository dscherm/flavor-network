import { useMemo } from 'react';
import {
  computeProfileWeights,
  getTopIngredients,
  getSuggestions,
  getTasteSignature,
  getCuisineAffinity,
} from '../data/profileWeights.js';
import { TASTE_COLORS, colorForCuisine } from '../utils/color.js';

/**
 * ProfileInsights — shows top ingredients, suggestions, taste signature, and cuisine affinity.
 *
 * Props:
 *   - profile: { cuisines, ingredients, recipes }
 *   - nodes: Map<string, Object> from graph
 *   - isOpen: boolean
 *   - onClose: () => void
 *   - onSelectIngredient: (name) => void
 *   - onAddIngredient: (name) => void
 */
export default function ProfileInsights({ profile, nodes, isOpen, onClose, onSelectIngredient, onAddIngredient }) {
  const weights = useMemo(() => {
    if (!profile || !nodes) return new Map();
    return computeProfileWeights(profile, nodes);
  }, [profile, nodes]);

  const topIngredients = useMemo(() => getTopIngredients(weights, 10), [weights]);
  const suggestions = useMemo(() => getSuggestions(weights, profile?.ingredients || [], 8), [weights, profile]);
  const tasteSignature = useMemo(() => getTasteSignature(weights, nodes), [weights, nodes]);
  const cuisineAffinity = useMemo(() => getCuisineAffinity(weights, nodes).slice(0, 8), [weights, nodes]);

  const hasData = profile && (profile.ingredients.length > 0 || profile.cuisines.length > 0 || profile.recipes.length > 0);

  if (!isOpen) return null;

  return (
    <div className="fixed top-4 right-4 z-40 w-80 max-h-[calc(100vh-2rem)] overflow-y-auto panel rounded-lg border border-neural-glow/20 bg-neural-bg/95 backdrop-blur-md shadow-xl">
      {/* Header */}
      <div className="sticky top-0 bg-neural-bg/95 backdrop-blur-md p-4 pb-2 border-b border-neural-glow/10 flex items-center justify-between">
        <h2 className="text-neural-text font-semibold text-sm tracking-wide">Profile Insights</h2>
        <button
          onClick={onClose}
          className="text-neural-muted hover:text-neural-text transition-colors text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {!hasData ? (
        <div className="p-6 text-center">
          <p className="text-neural-muted text-sm mb-2">No profile data yet.</p>
          <p className="text-neural-muted text-xs">Add ingredients, cuisines, or recipes to see your flavor insights.</p>
        </div>
      ) : (
        <div className="p-4 space-y-5">
          {/* Taste Signature */}
          <Section title="Flavor Signature">
            {Object.keys(tasteSignature).length === 0 ? (
              <p className="text-neural-muted text-xs">No taste data available.</p>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(tasteSignature)
                  .sort((a, b) => b[1] - a[1])
                  .map(([taste, proportion]) => (
                    <div key={taste} className="flex items-center gap-2">
                      <span className="text-xs text-neural-muted w-12 text-right capitalize">{taste}</span>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.round(proportion * 100)}%`,
                            background: TASTE_COLORS[taste] || TASTE_COLORS.default,
                            boxShadow: `0 0 6px ${TASTE_COLORS[taste] || TASTE_COLORS.default}60`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-neural-muted w-8">{Math.round(proportion * 100)}%</span>
                    </div>
                  ))}
              </div>
            )}
          </Section>

          {/* Top Ingredients */}
          <Section title="Top 10 Ingredients">
            {topIngredients.length === 0 ? (
              <p className="text-neural-muted text-xs">Add ingredients to see your top picks.</p>
            ) : (
              <div className="space-y-1">
                {topIngredients.map(({ name, weight }, i) => (
                  <button
                    key={name}
                    onClick={() => onSelectIngredient?.(name)}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 transition-colors text-left group"
                  >
                    <span className="text-neural-glow/60 text-xs w-4 text-right">{i + 1}</span>
                    <span className="flex-1 text-neural-text text-xs capitalize group-hover:text-neural-glow transition-colors">
                      {name}
                    </span>
                    <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-neural-glow/70"
                        style={{ width: `${Math.round(weight * 100)}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Section>

          {/* You Might Like */}
          <Section title="You Might Like">
            {suggestions.length === 0 ? (
              <p className="text-neural-muted text-xs">Add more preferences for personalized suggestions.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map(({ name }) => (
                  <button
                    key={name}
                    onClick={() => onAddIngredient?.(name)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border border-neural-glow/20 text-neural-text/80 hover:border-neural-glow/50 hover:text-neural-glow transition-colors bg-white/5"
                    title={`Add ${name} to profile`}
                  >
                    <span className="text-neural-glow/60">+</span>
                    <span className="capitalize">{name}</span>
                  </button>
                ))}
              </div>
            )}
          </Section>

          {/* Cuisine Affinity */}
          <Section title="Cuisine Affinity">
            {cuisineAffinity.length === 0 ? (
              <p className="text-neural-muted text-xs">No cuisine data available.</p>
            ) : (
              <div className="space-y-1.5">
                {cuisineAffinity.map(({ cuisine, score }) => (
                  <div key={cuisine} className="flex items-center gap-2">
                    <span className="text-xs text-neural-muted w-24 text-right capitalize truncate">{cuisine}</span>
                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.round(score * 100)}%`,
                          background: colorForCuisine(cuisine),
                          boxShadow: `0 0 6px ${colorForCuisine(cuisine)}60`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-neural-muted w-8">{Math.round(score * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-neural-glow/80 text-xs font-medium uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  );
}
