import { useState, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';
import { buildIngredientIndex, parseIngredients } from '../data/recipeParser.js';

function RecipeBuilder({ ingredientList, onSave, onClose }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [mode, setMode] = useState('select'); // 'select' | 'paste' | 'url'
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState('');

  const ingredientFuse = useMemo(() => {
    const docs = (ingredientList || []).map((n) => ({ name: n }));
    return new Fuse(docs, { keys: ['name'], threshold: 0.4 });
  }, [ingredientList]);

  const parserIndex = useMemo(
    () => buildIngredientIndex(ingredientList || []),
    [ingredientList],
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return ingredientFuse
      .search(searchQuery, { limit: 8 })
      .map((r) => r.item.name);
  }, [searchQuery, ingredientFuse]);

  const toggleIngredient = useCallback((ing) => {
    setSelected((prev) =>
      prev.includes(ing) ? prev.filter((i) => i !== ing) : [...prev, ing],
    );
  }, []);

  const handleAutoExtract = useCallback(() => {
    if (!name.trim()) return;
    const found = parseIngredients(name, parserIndex);
    if (found.length > 0) {
      setSelected((prev) => {
        const combined = new Set([...prev, ...found]);
        return [...combined];
      });
    }
  }, [name, parserIndex]);

  const handleParsePaste = useCallback(() => {
    if (!pasteText.trim()) return;
    const found = parseIngredients(pasteText, parserIndex);
    if (found.length > 0) {
      setSelected((prev) => {
        const combined = new Set([...prev, ...found]);
        return [...combined];
      });
    }
    setPasteText('');
    setMode('select');
  }, [pasteText, parserIndex]);

  const handleImportUrl = useCallback(async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      setUrlError('Please enter a valid URL');
      return;
    }
    setUrlLoading(true);
    setUrlError('');
    try {
      const res = await fetch('/api/recipe/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to scrape (${res.status})`);
      }
      const data = await res.json();
      // Re-match against known ingredients using local Fuse for better accuracy
      const matchFuse = new Fuse(
        (ingredientList || []).map((n) => ({ name: n })),
        { keys: ['name'], threshold: 0.35 },
      );
      const matched = [];
      for (const raw of data.ingredients || []) {
        const results = matchFuse.search(raw, { limit: 1 });
        if (results.length > 0) matched.push(results[0].item.name);
      }
      // Also include server-side matched names
      if (data.matchedNames) {
        for (const n of data.matchedNames) {
          if (!matched.includes(n)) matched.push(n);
        }
      }
      if (matched.length > 0) {
        setSelected((prev) => [...new Set([...prev, ...matched])]);
      }
      if (data.title && !name.trim()) {
        setName(data.title);
      }
      setUrlInput('');
      setMode('select');
    } catch (err) {
      setUrlError(err.message || 'Failed to import recipe');
    } finally {
      setUrlLoading(false);
    }
  }, [urlInput, ingredientList, name]);

  const handleSave = useCallback(() => {
    if (!name.trim() || selected.length === 0) return;
    onSave(name.trim(), selected);
    onClose();
  }, [name, selected, onSave, onClose]);

  const canSave = name.trim().length > 0 && selected.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[420px] max-h-[80vh] bg-[#12121a] border border-[#1e1e2e] rounded-lg flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[#1e1e2e]">
          <h2 className="text-sm font-medium text-gray-200 tracking-wide">
            Recipe Builder
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
            aria-label="Close recipe builder"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Recipe name */}
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">
              Recipe Name
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Garlic Butter Shrimp Pasta"
                className="flex-1 text-xs bg-[#1a1a2e] border border-[#2a2a3e] text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
              />
              <button
                onClick={handleAutoExtract}
                disabled={!name.trim()}
                className="text-[10px] bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-30 disabled:cursor-default rounded px-2 py-1 transition-colors whitespace-nowrap"
                title="Auto-detect ingredients from recipe name"
              >
                Auto-detect
              </button>
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex border-b border-[#1e1e2e]">
            <button
              onClick={() => setMode('select')}
              className={`flex-1 py-1.5 text-[10px] transition-colors ${
                mode === 'select'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Search &amp; Select
            </button>
            <button
              onClick={() => setMode('paste')}
              className={`flex-1 py-1.5 text-[10px] transition-colors ${
                mode === 'paste'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Paste Ingredients
            </button>
            <button
              onClick={() => setMode('url')}
              className={`flex-1 py-1.5 text-[10px] transition-colors ${
                mode === 'url'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Import URL
            </button>
          </div>

          {/* Search & select mode */}
          {mode === 'select' && (
            <div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ingredients..."
                className="w-full text-xs bg-[#1a1a2e] border border-[#2a2a3e] text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
              />
              {searchResults.length > 0 && (
                <ul className="mt-1 bg-[#1a1a2e] border border-[#2a2a3e] rounded max-h-32 overflow-y-auto">
                  {searchResults.map((ing) => {
                    const isSelected = selected.includes(ing);
                    return (
                      <li key={ing}>
                        <button
                          onClick={() => {
                            toggleIngredient(ing);
                            setSearchQuery('');
                          }}
                          className={`w-full text-left px-2 py-1 text-xs transition-colors ${
                            isSelected
                              ? 'text-blue-300 bg-blue-500/10'
                              : 'text-gray-300 hover:bg-blue-500/10 hover:text-blue-300'
                          }`}
                        >
                          {isSelected ? `\u2713 ${ing}` : ing}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Paste mode */}
          {mode === 'paste' && (
            <div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"Paste ingredient list here...\ne.g.\n2 cups flour\n1 tsp vanilla extract\n3 cloves garlic"}
                rows={5}
                className="w-full text-xs bg-[#1a1a2e] border border-[#2a2a3e] text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600 resize-none"
              />
              <button
                onClick={handleParsePaste}
                disabled={!pasteText.trim()}
                className="mt-1.5 w-full text-[11px] bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-30 disabled:cursor-default rounded py-1.5 transition-colors"
              >
                Parse &amp; Add Ingredients
              </button>
            </div>
          )}

          {/* URL import mode */}
          {mode === 'url' && (
            <div>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => { setUrlInput(e.target.value); setUrlError(''); }}
                placeholder="https://www.allrecipes.com/recipe/..."
                className="w-full text-xs bg-[#1a1a2e] border border-[#2a2a3e] text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
                disabled={urlLoading}
              />
              {urlError && (
                <p className="text-[10px] text-red-400 mt-1">{urlError}</p>
              )}
              <button
                onClick={handleImportUrl}
                disabled={!urlInput.trim() || urlLoading}
                className="mt-1.5 w-full text-[11px] bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-30 disabled:cursor-default rounded py-1.5 transition-colors"
              >
                {urlLoading ? 'Importing...' : 'Import from URL'}
              </button>
              <p className="text-[10px] text-gray-600 mt-1">
                Supports AllRecipes, Food Network, NYT Cooking, and most recipe sites.
              </p>
            </div>
          )}

          {/* Selected ingredients */}
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">
              Ingredients ({selected.length})
            </label>
            {selected.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selected.map((ing) => (
                  <button
                    key={ing}
                    onClick={() => toggleIngredient(ing)}
                    className="text-[10px] bg-blue-500/15 text-blue-300 rounded px-1.5 py-0.5 hover:bg-red-500/15 hover:text-red-300 transition-colors group"
                    title={`Remove ${ing}`}
                  >
                    {ing}
                    <span className="ml-0.5 opacity-50 group-hover:opacity-100">
                      &times;
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-gray-600">
                No ingredients added yet. Use search or paste to add some.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-3 border-t border-[#1e1e2e]">
          <button
            onClick={onClose}
            className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="text-[11px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-30 disabled:cursor-default rounded px-4 py-1.5 transition-colors"
          >
            Save Recipe
          </button>
        </div>
      </div>
    </div>
  );
}

export default RecipeBuilder;
