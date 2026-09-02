import { useState, useMemo, useCallback, useRef } from 'react';
import Fuse from 'fuse.js';
import {
  computeProfileWeights,
  getTopIngredients,
  getSuggestions,
  getTasteSignature,
  getCuisineAffinity,
} from '../data/profileWeights.js';
import {
  computeFrequencyScores,
  classifyByFrequency,
  getTopByFrequency,
} from '../data/frequencyWeights.js';
import { TASTE_COLORS, colorForCuisine } from '../utils/color.js';
import RecipeImport from './RecipeImport.jsx';

function ProfilePanel({ profile, actions, ingredientList, cuisines, onClose, graphNodes, onSelectIngredient, onLoadRecipe, user, authError, authDebug, onLogin, onLoginWithApple, onLogout, onReplayTour }) {
  const [tab, setTab] = useState('recipes');
  const [searchQuery, setSearchQuery] = useState('');
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);

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

  const handleExport = useCallback(() => {
    const json = actions.exportProfile();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flavor-profile.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [actions]);

  const handleImport = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    const reader = new FileReader();
    reader.onload = () => {
      const ok = actions.importProfile(reader.result);
      if (!ok) setImportError('Invalid profile file.');
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [actions]);

  // Insights computations
  const weights = useMemo(() => {
    if (!profile || !graphNodes) return new Map();
    return computeProfileWeights(profile, graphNodes);
  }, [profile, graphNodes]);

  const topIngredients = useMemo(() => getTopIngredients(weights, 10), [weights]);
  const suggestions = useMemo(() => getSuggestions(weights, profile?.ingredients || [], 8), [weights, profile]);
  const tasteSignature = useMemo(() => getTasteSignature(weights, graphNodes), [weights, graphNodes]);
  const cuisineAffinity = useMemo(() => getCuisineAffinity(weights, graphNodes).slice(0, 8), [weights, graphNodes]);

  const recipes = profile?.recipes || [];
  const hasEnoughRecipes = recipes.length >= 2;
  const frequencyData = useMemo(() => {
    if (!hasEnoughRecipes) return null;
    const scores = computeFrequencyScores(recipes);
    const classified = classifyByFrequency(scores);
    const top15 = getTopByFrequency(recipes, 15);
    return { scores, classified, top15, uniqueCount: scores.size };
  }, [recipes, hasEnoughRecipes]);

  const hasInsightsData = profile && (profile.ingredients.length > 0 || profile.cuisines.length > 0 || profile.recipes.length > 0);

  const tabs = [
    { key: 'recipes', label: 'Recipes', count: profile.recipes.length },
    { key: 'pairings', label: 'Favorite Pairings', count: (profile.pairings || []).length },
  ];

  const currentItems =
    tab === 'cuisines'
      ? profile.cuisines
      : tab === 'ingredients'
        ? profile.ingredients
        : null;

  return (
    <div className="fixed inset-0 pt-10 z-[80] select-none bg-[#0a0a0f]">
      {/* Profile screen — full-width on mobile, capped width on desktop */}
      <div className="h-full mx-auto max-w-2xl bg-[#12121a] border-x border-[#1e1e2e] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[#1e1e2e]">
        <h2 className="text-sm font-medium text-gray-200 tracking-wide">My Profile</h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">
            {profile.ingredients.length + profile.cuisines.length + profile.recipes.length} items
          </span>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
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
            className={`flex-1 min-h-[44px] py-2 text-[11px] transition-colors flex items-center justify-center ${
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
      {(tab === 'ingredients' || tab === 'cuisines') && (
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

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Ingredients / Cuisines list */}
        {(tab === 'ingredients' || tab === 'cuisines') && (
          currentItems && currentItems.length > 0 ? (
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
          )
        )}

        {/* Recipes list — with PDF / photo importer above */}
        {tab === 'recipes' && (
          <>
            <RecipeImport
              onSave={(name, ingredients) => actions.addRecipe(name, ingredients)}
            />
            <RecipeList
              recipes={profile.recipes}
              onRemove={actions.removeRecipe}
              onLoad={onLoadRecipe}
            />
          </>
        )}

        {/* Favorite Pairings — list of starred ingredient pairs */}
        {tab === 'pairings' && (
          <PairingsList
            pairings={profile.pairings || []}
            onRemove={(p) => actions.removePairing(p.a, p.b)}
            onSelect={onSelectIngredient}
          />
        )}

        {/* Insights tab */}
        {tab === 'insights' && (
          !hasInsightsData ? (
            <div className="text-center mt-6">
              <p className="text-neural-muted text-xs">Add ingredients, cuisines, or recipes to see your flavor insights.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Taste Signature */}
              <InsightSection title="Flavor Signature">
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
              </InsightSection>

              {/* Top Ingredients */}
              <InsightSection title="Top 10 Ingredients">
                {topIngredients.length === 0 ? (
                  <p className="text-neural-muted text-xs">Add ingredients to see your top picks.</p>
                ) : (
                  <div className="space-y-1">
                    {topIngredients.map(({ name, weight }, i) => (
                      <button
                        key={name}
                        onClick={() => onSelectIngredient?.(name)}
                        className="w-full flex items-center gap-2 px-1 py-0.5 rounded hover:bg-white/5 transition-colors text-left group"
                      >
                        <span className="text-neural-glow/60 text-xs w-4 text-right">{i + 1}</span>
                        <span className="flex-1 text-neural-text text-xs capitalize group-hover:text-neural-glow transition-colors">
                          {name}
                        </span>
                        <div className="w-12 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-neural-glow/70"
                            style={{ width: `${Math.round(weight * 100)}%` }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </InsightSection>

              {/* You Might Like */}
              <InsightSection title="You Might Like">
                {suggestions.length === 0 ? (
                  <p className="text-neural-muted text-xs">Add more preferences for suggestions.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {suggestions.map(({ name }) => (
                      <button
                        key={name}
                        onClick={() => actions.addIngredient(name)}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] border border-neural-glow/20 text-neural-text/80 hover:border-neural-glow/50 hover:text-neural-glow transition-colors bg-white/5"
                        title={`Add ${name} to profile`}
                      >
                        <span className="text-neural-glow/60">+</span>
                        <span className="capitalize">{name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </InsightSection>

              {/* Cuisine Affinity */}
              <InsightSection title="Cuisine Affinity">
                {cuisineAffinity.length === 0 ? (
                  <p className="text-neural-muted text-xs">No cuisine data available.</p>
                ) : (
                  <div className="space-y-1.5">
                    {cuisineAffinity.map(({ cuisine, score }) => (
                      <div key={cuisine} className="flex items-center gap-2">
                        <span className="text-xs text-neural-muted w-20 text-right capitalize truncate">{cuisine}</span>
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
                        <span className="text-[10px] text-neural-muted w-7">{Math.round(score * 100)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </InsightSection>

              {/* Ingredient Frequency */}
              {frequencyData && (
                <InsightSection title="Most Used Ingredients">
                  <div className="grid grid-cols-4 gap-1 mb-2">
                    <FrequencyStat label="Unique" value={frequencyData.uniqueCount} />
                    <FrequencyStat label="Signature" value={frequencyData.classified.signature.length} color="#22c55e" />
                    <FrequencyStat label="Regular" value={frequencyData.classified.regular.length} color="#3b82f6" />
                    <FrequencyStat label="Occasional" value={frequencyData.classified.occasional.length} color="#6b7280" />
                  </div>
                  <div className="space-y-1">
                    {frequencyData.top15.map(({ name, frequency }) => {
                      const pct = Math.round(frequency * 100);
                      const barColor = frequency >= 0.7 ? '#22c55e' : frequency >= 0.3 ? '#3b82f6' : '#6b7280';
                      return (
                        <button
                          key={name}
                          onClick={() => onSelectIngredient?.(name)}
                          className="w-full text-left group rounded px-1 py-0.5 hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] text-neural-text capitalize group-hover:text-neural-glow transition-colors truncate flex-1">
                              {name}
                            </span>
                            <span className="text-[9px] text-neural-muted ml-1 shrink-0">{pct}%</span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: barColor }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </InsightSection>
              )}
            </div>
          )
        )}
      </div>

      {/* Footer actions */}
      <div className="p-2 border-t border-[#1e1e2e] space-y-1">
        {/* Auth */}
        {user ? (
          <div className="flex items-center gap-2 px-1 py-1">
            <img src={user.photoURL || ''} alt="" className="w-4 h-4 rounded-full" referrerPolicy="no-referrer" />
            <span className="text-[10px] text-gray-400 truncate flex-1">{user.displayName || user.email}</span>
            <button onClick={onLogout} className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors">
              Sign Out
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Sign in with Apple — required by App Store Review
                Guideline 4.8 since we also offer Google. Apple HIG
                requires a black button with the Apple logo and the
                exact "Sign in with Apple" wording. */}
            {onLoginWithApple && (
              <button
                onClick={onLoginWithApple}
                className="w-full min-h-[44px] text-[11px] bg-black text-white hover:bg-gray-900 rounded py-1.5 transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.05 12.04c-.03-3.04 2.49-4.5 2.6-4.57-1.42-2.07-3.62-2.36-4.4-2.39-1.87-.19-3.66 1.1-4.61 1.1-.97 0-2.43-1.08-4-1.05-2.06.03-3.97 1.2-5.03 3.05-2.15 3.72-.55 9.21 1.54 12.22 1.02 1.47 2.23 3.12 3.81 3.06 1.54-.06 2.12-.99 3.97-.99 1.85 0 2.38.99 4 .96 1.65-.03 2.7-1.49 3.71-2.97 1.17-1.7 1.65-3.36 1.68-3.45-.04-.01-3.23-1.24-3.27-4.92zM14.04 3.96c.85-1.04 1.43-2.47 1.27-3.91-1.23.05-2.72.82-3.6 1.85-.79.92-1.49 2.39-1.3 3.79 1.37.11 2.78-.69 3.63-1.73z" />
                </svg>
                Sign in with Apple
              </button>
            )}
            <button
              onClick={onLogin}
              className="w-full min-h-[44px] text-[11px] bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded py-1.5 transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>
            {/* WEBLINK-14: these buttons were completely silent on failure.
                authError was added to useAuth in WEBLINK-10 and surfaced in
                the weblink sign-in panel, but never here — and this is where
                the buttons actually live. A failed sign-in set the error and
                nothing rendered it, which on a phone is indistinguishable
                from a dead button. Reported from the iOS app as "I click the
                sign in buttons and nothing happens". */}
            {/* WEBLINK-18: sign-in progress breadcrumb. Deliberately plain
                and always-on while native sign-in is unverified — the
                packaged app has no console reachable from Windows, so this
                is the only diagnostic channel off the device. */}
            {authDebug && (
              <div
                data-testid="auth-debug"
                className="mt-2 text-[10px] font-mono opacity-60 break-all"
              >
                {authDebug}
              </div>
            )}
            {authError && (
              <p
                className="text-[11px] mt-2 leading-snug"
                style={{ color: '#fda4af' }}
                data-testid="profile-signin-error"
                role="alert"
              >
                {authError}
              </p>
            )}
          </div>
        )}
        {/* Replay tour */}
        {onReplayTour && (
          <button
            onClick={onReplayTour}
            className="w-full min-h-[44px] text-[10px] text-gray-500 hover:text-gray-300 transition-colors py-1 flex items-center justify-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
            Replay Guided Tour
          </button>
        )}
        {/* Export/Import */}
        <div className="flex gap-1">
          <button
            onClick={handleExport}
            disabled={profile.ingredients.length === 0 && profile.cuisines.length === 0 && profile.recipes.length === 0}
            className="flex-1 min-h-[44px] text-[10px] text-gray-500 hover:text-blue-400 disabled:text-gray-700 disabled:cursor-default transition-colors py-1 flex items-center justify-center gap-1"
            title="Download profile as JSON"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 min-h-[44px] text-[10px] text-gray-500 hover:text-blue-400 transition-colors py-1 flex items-center justify-center gap-1"
            title="Import profile from JSON"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </div>
        {importError && (
          <p className="text-[10px] text-red-400 text-center">{importError}</p>
        )}
        {(profile.ingredients.length > 0 || profile.cuisines.length > 0 || profile.recipes.length > 0) && (
          <button
            onClick={actions.clearProfile}
            className="w-full text-[10px] text-gray-500 hover:text-red-400 transition-colors py-1"
          >
            Clear All
          </button>
        )}
      </div>
      </div>
    </div>
  );
}

function InsightSection({ title, children }) {
  return (
    <div>
      <h3 className="text-neural-glow/80 text-[10px] font-medium uppercase tracking-wider mb-1.5">{title}</h3>
      {children}
    </div>
  );
}

function FrequencyStat({ label, value, color }) {
  return (
    <div className="text-center rounded bg-white/5 py-1 px-0.5">
      <div className="text-xs font-semibold text-neural-text" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="text-[8px] text-neural-muted uppercase tracking-wide">{label}</div>
    </div>
  );
}

function PairingsList({ pairings, onRemove, onSelect }) {
  if (!pairings || pairings.length === 0) {
    return (
      <p className="text-[11px] text-gray-600 text-center mt-6">
        No favorite pairings yet.
        <br />
        Tap the ☆ next to any ingredient pairing in the network to save it.
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {pairings.map((p) => (
        <li
          key={`${p.a}|${p.b}`}
          className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#1a1a2e]/50 group"
        >
          <button
            onClick={() => onSelect?.(p.a)}
            className="text-xs text-gray-200 hover:text-blue-300 capitalize transition-colors"
            aria-label={`Open ${p.a} in network`}
          >
            {p.a}
          </button>
          <span className="text-[10px] text-gray-600">+</span>
          <button
            onClick={() => onSelect?.(p.b)}
            className="text-xs text-gray-200 hover:text-blue-300 capitalize transition-colors"
            aria-label={`Open ${p.b} in network`}
          >
            {p.b}
          </button>
          <span className="text-amber-400 ml-1" aria-hidden="true">★</span>
          <button
            onClick={() => onRemove?.(p)}
            className="ml-auto text-gray-600 hover:text-red-400 transition-colors text-xs opacity-0 group-hover:opacity-100"
            aria-label={`Remove pairing ${p.a} + ${p.b}`}
          >
            &times;
          </button>
        </li>
      ))}
    </ul>
  );
}

function RecipeList({ recipes, onRemove, onLoad }) {
  if (recipes.length === 0) {
    return (
      <p className="text-[11px] text-gray-600 text-center mt-6">
        No recipes added yet.
        <br />
        Use the Recipe Notebook or Make a recipe to create one.
      </p>
    );
  }

  const loadable = typeof onLoad === 'function';

  return (
    <ul className="space-y-2">
      {recipes.map((recipe, index) => (
        <li
          key={index}
          className="px-2 py-1.5 rounded bg-[#1a1a2e]/50 group"
        >
          <div className="flex items-center justify-between gap-2">
            {loadable ? (
              <button
                onClick={() => onLoad(recipe)}
                className="text-xs text-gray-200 font-medium truncate text-left flex-1 hover:text-blue-300 transition-colors"
                aria-label={`Load recipe ${recipe.name} into Recipe Lab`}
              >
                {recipe.name}
              </button>
            ) : (
              <span className="text-xs text-gray-200 font-medium truncate">
                {recipe.name}
              </span>
            )}
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
              {recipe.ingredients.map((ing) => {
                const name = typeof ing === 'string' ? ing : ing.name;
                const qty = typeof ing === 'object' && ing.quantity != null
                  ? `${ing.quantity}${ing.unit ? ' ' + ing.unit : ''} `
                  : '';
                return (
                  <span
                    key={name}
                    className="text-[9px] bg-blue-500/10 text-blue-300/70 rounded px-1 py-0.5"
                  >
                    {qty}{name}
                  </span>
                );
              })}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default ProfilePanel;
