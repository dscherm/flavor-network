import { useState, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';

function ProfilePanel({ profile, actions, ingredientList, cuisines, isOpen, onClose }) {
  const [tab, setTab] = useState('ingredients');
  const [searchQuery, setSearchQuery] = useState('');

  const ingredientFuse = useMemo(() => {
    const docs = (ingredientList || []).map((name) => ({ name }));
    return new Fuse(docs, { keys: ['name'], threshold: 0.4 });
  }, [ingredientList]);

  const cuisineFuse = useMemo(() => {
    const docs = (cuisines || []).map((name) => ({ name }));
    return new Fuse(docs, { keys: ['name'], threshold: 0.4 });
  }, [cuisines]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const fuse = tab === 'cuisines' ? cuisineFuse : ingredientFuse;
    return fuse.search(searchQuery, { limit: 6 }).map((r) => r.item.name);
  }, [searchQuery, tab, ingredientFuse, cuisineFuse]);

  const handleAdd = useCallback(
    (name) => {
      if (tab === 'cuisines') {
        actions.addCuisine(name);
      } else {
        actions.addIngredient(name);
      }
      setSearchQuery('');
    },
    [tab, actions],
  );

  const handleRemove = useCallback(
    (name) => {
      if (tab === 'cuisines') {
        actions.removeCuisine(name);
      } else {
        actions.removeIngredient(name);
      }
    },
    [tab, actions],
  );

  if (!isOpen) return null;

  const tabs = [
    { key: 'ingredients', label: 'Ingredients', count: profile.ingredients.length },
    { key: 'cuisines', label: 'Cuisines', count: profile.cuisines.length },
    { key: 'recipes', label: 'Recipes', count: profile.recipes.length },
  ];

  const currentItems =
    tab === 'cuisines'
      ? profile.cuisines
      : tab === 'ingredients'
        ? profile.ingredients
        : null; // recipes handled separately

  return (
    <div className="fixed left-4 top-16 bottom-4 w-72 z-40 bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg flex flex-col select-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[#1e1e2e]">
        <h2 className="text-sm font-medium text-gray-200 tracking-wide">My Profile</h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">
            {profile.ingredients.length + profile.cuisines.length + profile.recipes.length} items
          </span>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
            aria-label="Close profile panel"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1e1e2e]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearchQuery(''); }}
            className={`flex-1 py-2 text-[11px] transition-colors ${
              tab === t.key
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1 text-[9px] bg-blue-500/20 text-blue-300 rounded-full px-1.5 py-0.5">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search (for ingredients and cuisines tabs) */}
      {tab !== 'recipes' && (
        <div className="p-2 border-b border-[#1e1e2e]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Add ${tab === 'cuisines' ? 'cuisine' : 'ingredient'}...`}
            className="w-full text-xs bg-[#1a1a2e] border border-[#2a2a3e] text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
          />
          {searchResults.length > 0 && (
            <ul className="mt-1 bg-[#1a1a2e] border border-[#2a2a3e] rounded max-h-36 overflow-y-auto">
              {searchResults.map((name) => {
                const alreadyAdded =
                  tab === 'cuisines'
                    ? profile.cuisines.includes(name)
                    : profile.ingredients.includes(name);
                return (
                  <li key={name}>
                    <button
                      onClick={() => handleAdd(name)}
                      disabled={alreadyAdded}
                      className={`w-full text-left px-2 py-1 text-xs transition-colors ${
                        alreadyAdded
                          ? 'text-gray-600 cursor-default'
                          : 'text-gray-300 hover:bg-blue-500/10 hover:text-blue-300'
                      }`}
                    >
                      {alreadyAdded ? `${name} (added)` : name}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Item List */}
      <div className="flex-1 overflow-y-auto p-2">
        {tab === 'recipes' ? (
          <RecipeList
            recipes={profile.recipes}
            onRemove={actions.removeRecipe}
          />
        ) : currentItems && currentItems.length > 0 ? (
          <ul className="space-y-1">
            {currentItems.map((name) => (
              <li
                key={name}
                className="flex items-center justify-between px-2 py-1 rounded bg-[#1a1a2e]/50 group"
              >
                <span className="text-xs text-gray-300 truncate">{name}</span>
                <button
                  onClick={() => handleRemove(name)}
                  className="text-gray-600 hover:text-red-400 transition-colors text-xs opacity-0 group-hover:opacity-100"
                  aria-label={`Remove ${name}`}
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-gray-600 text-center mt-6">
            No {tab} added yet.
            <br />
            Use the search above to add some.
          </p>
        )}
      </div>

      {/* Footer actions */}
      {(profile.ingredients.length > 0 || profile.cuisines.length > 0 || profile.recipes.length > 0) && (
        <div className="p-2 border-t border-[#1e1e2e]">
          <button
            onClick={actions.clearProfile}
            className="w-full text-[10px] text-gray-500 hover:text-red-400 transition-colors py-1"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}

function RecipeList({ recipes, onRemove }) {
  if (recipes.length === 0) {
    return (
      <p className="text-[11px] text-gray-600 text-center mt-6">
        No recipes added yet.
        <br />
        Use the Recipe Builder to create one.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {recipes.map((recipe, index) => (
        <li
          key={index}
          className="px-2 py-1.5 rounded bg-[#1a1a2e]/50 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-200 font-medium truncate">
              {recipe.name}
            </span>
            <button
              onClick={() => onRemove(index)}
              className="text-gray-600 hover:text-red-400 transition-colors text-xs opacity-0 group-hover:opacity-100"
              aria-label={`Remove recipe ${recipe.name}`}
            >
              &times;
            </button>
          </div>
          {recipe.ingredients.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {recipe.ingredients.map((ing) => (
                <span
                  key={ing}
                  className="text-[9px] bg-blue-500/10 text-blue-300/70 rounded px-1 py-0.5"
                >
                  {ing}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default ProfilePanel;
