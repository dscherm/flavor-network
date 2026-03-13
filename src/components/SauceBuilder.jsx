import { useState, useCallback, useMemo } from 'react';

/**
 * SauceBuilder — Bidirectional sauce builder.
 * Add ingredients by searching or clicking nodes on the network.
 * Shows selected ingredients with quantity fields and compatibility scoring.
 */
export default function SauceBuilder({
  sauceNodes,
  sauceEdges,
  ingredientList,
  onAddIngredient,
  onRemoveIngredient,
  onClearIngredients,
  builderIngredients,
  sauceTemplate,
  compatibilityScore,
  suggestions,
  onSave,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [quantities, setQuantities] = useState({});
  const [sauceName, setSauceName] = useState('');
  const [saved, setSaved] = useState(false);

  const filteredIngredients = useMemo(() => {
    if (!searchQuery.trim() || !ingredientList) return [];
    const q = searchQuery.toLowerCase();
    return ingredientList
      .filter(name =>
        name.toLowerCase().includes(q) &&
        !builderIngredients.includes(name)
      )
      .slice(0, 8);
  }, [searchQuery, ingredientList, builderIngredients]);

  const handleAddFromSearch = useCallback((name) => {
    onAddIngredient?.(name);
    setSearchQuery('');
  }, [onAddIngredient]);

  const handleQuantityChange = useCallback((name, field, value) => {
    setQuantities(prev => ({
      ...prev,
      [name]: { ...prev[name], [field]: value },
    }));
  }, []);

  const scoreColor = compatibilityScore > 7
    ? 'text-green-400'
    : compatibilityScore > 4
    ? 'text-yellow-400'
    : 'text-red-400';

  const scoreBarColor = compatibilityScore > 7
    ? '#4ade80'
    : compatibilityScore > 4
    ? '#facc15'
    : '#f87171';

  return (
    <div className="p-3 space-y-3">
      {/* Search to add */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search ingredients to add..."
          className="w-full text-xs bg-[#1a1a2e] border border-[#2a2a3e] text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-gray-600"
        />
        {filteredIngredients.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a2e] border border-[#2a2a3e] rounded shadow-lg z-10 max-h-40 overflow-y-auto">
            {filteredIngredients.map(name => (
              <button
                key={name}
                onClick={() => handleAddFromSearch(name)}
                className="w-full text-left text-[11px] text-gray-300 hover:bg-amber-500/10 hover:text-amber-300 px-2 py-1.5 transition-colors"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Compatibility score */}
      {builderIngredients.length >= 2 && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-gray-600 uppercase tracking-wider">Compatibility</span>
          <div className="flex-1 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, (compatibilityScore || 0) * 10)}%`,
                backgroundColor: scoreBarColor,
              }}
            />
          </div>
          <span className={`text-xs font-medium ${scoreColor}`}>
            {compatibilityScore?.toFixed(1) || '—'}
          </span>
        </div>
      )}

      {/* Template badge */}
      {sauceTemplate && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded">
          <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          <span className="text-[10px] text-amber-300">
            {sauceTemplate.name}
          </span>
          <span className="text-[8px] text-gray-500">
            {sauceTemplate.confidence}% match
          </span>
        </div>
      )}

      {/* Selected ingredients */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[9px] text-gray-600 uppercase tracking-wider">
            Your Ingredients ({builderIngredients.length})
          </p>
          {builderIngredients.length > 0 && (
            <button
              onClick={onClearIngredients}
              className="text-[8px] text-gray-600 hover:text-red-400 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {builderIngredients.length === 0 ? (
          <p className="text-[10px] text-gray-600 text-center py-6">
            Click nodes on the network or search above to add ingredients
          </p>
        ) : (
          <div className="space-y-1">
            {builderIngredients.map((name) => {
              const q = quantities[name] || {};
              return (
                <div
                  key={name}
                  className="flex items-center gap-1.5 px-2 py-1 bg-[#1a1a2e]/50 rounded group"
                >
                  <span className="text-[11px] text-gray-300 flex-1 truncate">{name}</span>
                  <input
                    type="text"
                    value={q.amount || ''}
                    onChange={(e) => handleQuantityChange(name, 'amount', e.target.value)}
                    placeholder="qty"
                    className="w-10 text-[9px] bg-[#12121a] border border-[#2a2a3e] text-gray-400 rounded px-1 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <select
                    value={q.unit || 'tbsp'}
                    onChange={(e) => handleQuantityChange(name, 'unit', e.target.value)}
                    className="text-[9px] bg-[#12121a] border border-[#2a2a3e] text-gray-400 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="tbsp">tbsp</option>
                    <option value="tsp">tsp</option>
                    <option value="cup">cup</option>
                    <option value="oz">oz</option>
                    <option value="ml">ml</option>
                    <option value="g">g</option>
                    <option value="pinch">pinch</option>
                    <option value="whole">whole</option>
                    <option value="to taste">to taste</option>
                  </select>
                  <button
                    onClick={() => onRemoveIngredient?.(name)}
                    className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <div>
          <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">
            Suggested Next
          </p>
          <div className="flex flex-wrap gap-1">
            {suggestions.slice(0, 6).map((sug) => (
              <button
                key={sug.name}
                onClick={() => onAddIngredient?.(sug.name)}
                className="text-[9px] text-gray-400 hover:text-amber-300 bg-[#1a1a2e]/50 hover:bg-amber-500/10 border border-[#2a2a3e] hover:border-amber-500/20 rounded px-1.5 py-0.5 transition-all"
                title={`Score: ${sug.score} · ${sug.reason || sug.category}`}
              >
                + {sug.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Save sauce */}
      {builderIngredients.length >= 2 && onSave && (
        <div className="border-t border-[#1e1e2e] pt-2 space-y-1.5">
          <input
            type="text"
            value={sauceName}
            onChange={(e) => { setSauceName(e.target.value); setSaved(false); }}
            placeholder="Name your sauce..."
            className="w-full text-xs bg-[#1a1a2e] border border-[#2a2a3e] text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-gray-600"
          />
          <button
            onClick={() => {
              onSave(sauceName || 'My Sauce');
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
            className={`w-full text-[10px] py-1.5 rounded transition-colors ${
              saved
                ? 'bg-green-500/20 text-green-300'
                : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
            }`}
          >
            {saved ? 'Saved!' : 'Save Sauce'}
          </button>
        </div>
      )}
    </div>
  );
}
