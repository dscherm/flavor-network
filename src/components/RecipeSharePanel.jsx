import { useState, useMemo, useCallback } from 'react';
import { buildIngredientIndex, parseIngredients } from '../data/recipeParser.js';

const API_BASE = 'http://localhost:3001';

/**
 * RecipeSharePanel — paste a recipe URL or text, preview extracted ingredients,
 * and add them to the user's profile as a recipe.
 *
 * Supports:
 * - Recipe URL scraping via /api/recipe/scrape endpoint
 * - Direct text paste fallback using local recipeParser
 * - Ingredient preview with confirm/reject per ingredient
 */
function RecipeSharePanel({ ingredientList, onSave, onClose }) {
  const [url, setUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [mode, setMode] = useState('url'); // 'url' | 'paste'
  const [recipeName, setRecipeName] = useState('');
  const [extracted, setExtracted] = useState([]); // { name, confirmed }[]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scraped, setScraped] = useState(false);

  const parserIndex = useMemo(
    () => buildIngredientIndex(ingredientList || []),
    [ingredientList],
  );

  const isValidUrl = useCallback((str) => {
    try {
      const parsed = new URL(str);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, []);

  const handleScrapeUrl = useCallback(async () => {
    if (!url.trim() || !isValidUrl(url.trim())) {
      setError('Please enter a valid URL');
      return;
    }
    setLoading(true);
    setError('');
    setExtracted([]);
    setScraped(false);

    try {
      const res = await fetch(`${API_BASE}/api/recipe/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      if (data.title) setRecipeName(data.title);

      const matched = (data.ingredients || [])
        .map((ing) => {
          const results = parserIndex.search(ing, { limit: 1 });
          if (results.length > 0 && results[0].score < 0.35) {
            return { name: results[0].item.name, raw: ing, confirmed: true };
          }
          return null;
        })
        .filter(Boolean);

      // Deduplicate by name
      const seen = new Set();
      const unique = matched.filter((m) => {
        if (seen.has(m.name)) return false;
        seen.add(m.name);
        return true;
      });

      setExtracted(unique);
      setScraped(true);

      if (unique.length === 0) {
        setError('No known ingredients found in this recipe. Try pasting the ingredient list instead.');
      }
    } catch (err) {
      // API not available — prompt user to paste text instead
      setError(
        'Could not fetch recipe from URL. The scrape API may not be running. ' +
        'Try pasting the recipe text directly instead.'
      );
    } finally {
      setLoading(false);
    }
  }, [url, isValidUrl, parserIndex]);

  const handleParseText = useCallback(() => {
    if (!pasteText.trim()) return;
    setError('');
    setExtracted([]);

    const found = parseIngredients(pasteText, parserIndex);
    const items = found.map((name) => ({ name, raw: name, confirmed: true }));

    setExtracted(items);
    setScraped(true);

    if (items.length === 0) {
      setError('No known ingredients matched. Try a longer ingredient list.');
    }
  }, [pasteText, parserIndex]);

  const toggleIngredient = useCallback((name) => {
    setExtracted((prev) =>
      prev.map((item) =>
        item.name === name ? { ...item, confirmed: !item.confirmed } : item,
      ),
    );
  }, []);

  const confirmedIngredients = useMemo(
    () => extracted.filter((i) => i.confirmed).map((i) => i.name),
    [extracted],
  );

  const handleAdd = useCallback(() => {
    if (confirmedIngredients.length === 0) return;
    const name = recipeName.trim() || 'Imported Recipe';
    onSave(name, confirmedIngredients);
    onClose();
  }, [recipeName, confirmedIngredients, onSave, onClose]);

  const handleReset = useCallback(() => {
    setExtracted([]);
    setScraped(false);
    setError('');
    setRecipeName('');
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[440px] max-h-[80vh] bg-[#12121a] border border-[#1e1e2e] rounded-lg flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[#1e1e2e]">
          <h2 className="text-sm font-medium text-gray-200 tracking-wide flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.813a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.374" />
            </svg>
            Import Recipe
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Mode tabs */}
          {!scraped && (
            <>
              <div className="flex border-b border-[#1e1e2e]">
                <button
                  onClick={() => { setMode('url'); setError(''); }}
                  className={`flex-1 py-1.5 text-[10px] transition-colors ${
                    mode === 'url'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Paste URL
                </button>
                <button
                  onClick={() => { setMode('paste'); setError(''); }}
                  className={`flex-1 py-1.5 text-[10px] transition-colors ${
                    mode === 'paste'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Paste Text
                </button>
              </div>

              {/* URL mode */}
              {mode === 'url' && (
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">
                    Recipe URL
                  </label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://www.allrecipes.com/recipe/..."
                    className="w-full text-xs bg-[#1a1a2e] border border-[#2a2a3e] text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
                    onKeyDown={(e) => e.key === 'Enter' && handleScrapeUrl()}
                  />
                  <p className="text-[10px] text-gray-600 mt-1">
                    Supports AllRecipes, Food Network, NYT Cooking, and sites with structured recipe data
                  </p>
                  <button
                    onClick={handleScrapeUrl}
                    disabled={!url.trim() || loading}
                    className="mt-2 w-full text-[11px] bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-30 disabled:cursor-default rounded py-1.5 transition-colors flex items-center justify-center gap-1.5"
                  >
                    {loading ? (
                      <>
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Fetching recipe...
                      </>
                    ) : (
                      'Extract Ingredients'
                    )}
                  </button>
                </div>
              )}

              {/* Paste mode */}
              {mode === 'paste' && (
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">
                    Recipe Text
                  </label>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={"Paste recipe ingredient list here...\ne.g.\n2 cups flour\n3 cloves garlic\n1 tbsp olive oil\n1 lb chicken breast"}
                    rows={6}
                    className="w-full text-xs bg-[#1a1a2e] border border-[#2a2a3e] text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600 resize-none"
                  />
                  <button
                    onClick={handleParseText}
                    disabled={!pasteText.trim()}
                    className="mt-1.5 w-full text-[11px] bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-30 disabled:cursor-default rounded py-1.5 transition-colors"
                  >
                    Extract Ingredients
                  </button>
                </div>
              )}
            </>
          )}

          {/* Error message */}
          {error && (
            <div className="text-[11px] text-amber-400/80 bg-amber-500/5 border border-amber-500/10 rounded px-2.5 py-2">
              {error}
            </div>
          )}

          {/* Extracted results preview */}
          {scraped && extracted.length > 0 && (
            <div className="space-y-3">
              {/* Recipe name */}
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">
                  Recipe Name
                </label>
                <input
                  type="text"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  placeholder="Name this recipe"
                  className="w-full text-xs bg-[#1a1a2e] border border-[#2a2a3e] text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
                />
              </div>

              {/* Ingredient checklist */}
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">
                  Found Ingredients ({confirmedIngredients.length} / {extracted.length} selected)
                </label>
                <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded max-h-48 overflow-y-auto">
                  {extracted.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => toggleIngredient(item.name)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors border-b border-[#2a2a3e] last:border-b-0 ${
                        item.confirmed
                          ? 'text-blue-300 bg-blue-500/5'
                          : 'text-gray-500 line-through'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                        item.confirmed
                          ? 'border-blue-400 bg-blue-500/20'
                          : 'border-gray-600'
                      }`}>
                        {item.confirmed && (
                          <svg className="w-2.5 h-2.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="flex-1 text-left">{item.name}</span>
                      {item.raw !== item.name && (
                        <span className="text-[10px] text-gray-600 truncate max-w-[140px]">
                          {item.raw}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start over link */}
              <button
                onClick={handleReset}
                className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                Start over
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-3 border-t border-[#1e1e2e]">
          <button
            onClick={onClose}
            className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5"
          >
            Cancel
          </button>
          {scraped && (
            <button
              onClick={handleAdd}
              disabled={confirmedIngredients.length === 0}
              className="text-[11px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-30 disabled:cursor-default rounded px-4 py-1.5 transition-colors"
            >
              Add to Profile ({confirmedIngredients.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default RecipeSharePanel;
