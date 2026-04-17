import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import TasteRadar from './TasteRadar.jsx';
import { scoreRecipe, verdictForScore } from '../data/recipeScoring.js';

const TASTE_COLORS = {
  sweet: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  sour: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  salty: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  bitter: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  umami: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  pungent: 'bg-red-500/20 text-red-300 border-red-500/30',
  spicy: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  hot: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  mild: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  neutral: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

const PROPERTY_BADGE = 'bg-gray-700/40 text-gray-300 border-gray-600/30';

function getTasteBadgeClass(taste) {
  if (!taste) return PROPERTY_BADGE;
  const key = taste.toLowerCase().trim();
  return TASTE_COLORS[key] || PROPERTY_BADGE;
}

function PropertyBadge({ label, value, isTaste }) {
  if (!value) return null;
  const colorClass = isTaste ? getTasteBadgeClass(value) : PROPERTY_BADGE;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${colorClass}`}
    >
      <span className="text-gray-500 uppercase tracking-wider text-[10px]">{label}</span>
      {value}
    </span>
  );
}

function StrengthBar({ strength }) {
  const pct = Math.round(Math.max(0, Math.min(1, strength)) * 100);
  return (
    <div className="flex-1 h-1.5 rounded-full bg-gray-700/50 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <h3 className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold mb-2 mt-5 first:mt-0">
      {children}
    </h3>
  );
}

const TASTE_OPPOSITES = {
  sweet: 'bitter',
  bitter: 'sweet',
  sour: 'umami',
  umami: 'sour',
  salty: 'sweet',
  spicy: 'astringent',
  astringent: 'spicy',
  pungent: 'sour',
};

function getDiscoveryFact(node, neighbors) {
  if (!node) return null;
  const { name, pairingCount, cuisines, taste } = node;
  const sortedNeighbors = neighbors
    ? [...neighbors].sort((a, b) => b.strength - a.strength)
    : [];

  if (pairingCount > 100) {
    return `${name} is a network hub -- it connects to ${pairingCount} other ingredients`;
  }
  if (cuisines && cuisines.length >= 3) {
    return `${name} bridges ${cuisines.length} different cuisines`;
  }
  if (sortedNeighbors.length > 0 && sortedNeighbors[0].strength > 0.9) {
    return `${name}'s strongest bond is with ${sortedNeighbors[0].name} at ${Math.round(sortedNeighbors[0].strength * 100)}%`;
  }
  if (taste) {
    const key = taste.toLowerCase().trim();
    const opposite = TASTE_OPPOSITES[key];
    if (opposite) {
      return `As a ${key} ingredient, ${name} contrasts well with ${opposite} flavors`;
    }
  }
  if (pairingCount != null) {
    return `${name} has ${pairingCount} pairings across the flavor network`;
  }
  return null;
}

export default function IngredientPanel({ node, neighbors, onClose, onSelectIngredient, onHighlightPairings, onBuildRecipe, commonPairings = [], selectedNodes = [], selectedNodesData = [], selectedCount = 0, isFavorite, onToggleFavorite, embedded = false, graphNodes }) {
  const panelRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    },
    [onClose],
  );

  // Auto-expand when a new node is selected
  useEffect(() => {
    if (node) {
      setCollapsed(false);
      if (panelRef.current) panelRef.current.focus();
    }
  }, [node]);

  // Build ingredient list for TasteRadar: all selected + top shared/individual pairings
  const radarIngredients = useMemo(() => {
    if (!node) return [];
    const items = selectedNodes.length >= 2
      ? [...selectedNodes]
      : [node.name];
    const pairings = selectedNodes.length >= 2 && commonPairings.length > 0
      ? commonPairings
      : (neighbors ? [...neighbors].sort((a, b) => b.strength - a.strength) : []);
    for (const n of pairings.slice(0, 5)) items.push(n.name);
    return [...new Set(items)];
  }, [node, neighbors, selectedNodes, commonPairings]);

  const balanceScore = useMemo(() => {
    if (selectedCount < 2) return null;
    return scoreRecipe(selectedNodesData);
  }, [selectedNodesData, selectedCount]);

  const balanceVerdict = balanceScore ? verdictForScore(balanceScore) : null;

  const tasteSuggestion = useMemo(() => {
    if (!balanceScore || !balanceScore.profile || selectedCount < 2) return null;
    const TASTES = ['sweet', 'bitter', 'umami', 'salty', 'sour'];
    let weakest = null, weakestVal = Infinity;
    for (let i = 0; i < TASTES.length; i++) {
      if (balanceScore.profile[i] < weakestVal) {
        weakestVal = balanceScore.profile[i];
        weakest = TASTES[i];
      }
    }
    if (!weakest || weakestVal > 0.15) return null;
    const filler = (commonPairings || []).find(p => {
      const n = graphNodes?.get(p.name);
      return n && (n.taste || '').toLowerCase().includes(weakest);
    });
    return { taste: weakest, ingredient: filler?.name || null };
  }, [balanceScore, commonPairings, graphNodes, selectedCount]);

  if (!node) return null;

  const { name, cuisines, taste, weight, volume, season, tips, pairingCount, affinities } = node;

  const sortedNeighbors = neighbors
    ? [...neighbors].sort((a, b) => b.strength - a.strength)
    : [];

  const discoveryFact = getDiscoveryFact(node, neighbors);

  // Embedded mode: just render content without fixed positioning
  if (embedded) {
    return (
      <div>
        {/* Ingredient name + favorite */}
        <div className="flex items-start gap-2 pr-8 mb-1">
          <h2
            className="text-2xl font-bold text-gray-100"
            style={{ textShadow: '0 0 20px rgba(56, 189, 248, 0.4), 0 0 40px rgba(139, 92, 246, 0.2)' }}
          >
            {name}
          </h2>
          {onToggleFavorite && (
            <button
              onClick={() => onToggleFavorite(name)}
              className={`mt-1 flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors ${isFavorite ? 'text-pink-400 hover:text-pink-300' : 'text-gray-600 hover:text-pink-400'}`}
              aria-label={isFavorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          )}
        </div>
        {pairingCount != null && <p className="text-xs text-gray-500 mb-1">{pairingCount} pairing{pairingCount !== 1 ? 's' : ''}</p>}
        {selectedCount >= 2 && (
          <section className="mb-3">
            <SectionHeading>Selected Ingredients ({selectedCount})</SectionHeading>
            <div className="flex flex-wrap gap-1.5">
              {selectedNodesData.map((n) => (
                <span
                  key={n.name}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${
                    n.name === name
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                      : 'bg-gray-800/60 text-gray-300 border-gray-700/40'
                  }`}
                >
                  {n.name}
                  {n.taste && <span className="text-gray-500 text-[10px]">{n.taste}</span>}
                </span>
              ))}
            </div>
          </section>
        )}
        {balanceScore && selectedCount >= 2 && (
          <section className="mb-3">
            <SectionHeading>Taste Balance</SectionHeading>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex-1 h-2 bg-[#1a1a24] rounded overflow-hidden">
                <div className="h-full rounded" style={{
                  width: `${Math.round(balanceScore.balance * 100)}%`,
                  background: balanceScore.balance > 0.6 ? '#34d399' : balanceScore.balance > 0.3 ? '#fbbf24' : '#f87171',
                }} />
              </div>
              <span className="text-[10px] text-gray-400 w-8 text-right">{Math.round(balanceScore.balance * 100)}%</span>
            </div>
            <p className="text-xs text-gray-300">{balanceVerdict}</p>
            {tasteSuggestion && (
              <p className="text-[11px] text-cyan-400/80 mt-1">
                Missing {tasteSuggestion.taste}
                {tasteSuggestion.ingredient && (
                  <> — try <button onClick={() => onSelectIngredient?.(tasteSuggestion.ingredient)} className="underline hover:text-cyan-300">{tasteSuggestion.ingredient}</button></>
                )}
              </p>
            )}
          </section>
        )}
        {discoveryFact && (
          <div className="text-[11px] text-cyan-400/60 italic mb-3">
            {discoveryFact}
          </div>
        )}
        {(taste || weight || volume || season) && (
          <section>
            <SectionHeading>Properties</SectionHeading>
            <div className="flex flex-wrap gap-1.5">
              <PropertyBadge label="taste" value={taste} isTaste />
              <PropertyBadge label="weight" value={weight} />
              <PropertyBadge label="volume" value={volume} />
              <PropertyBadge label="season" value={season} />
            </div>
          </section>
        )}
        {node.clusterLabel && (
          <section>
            <SectionHeading>Flavor Cluster</SectionHeading>
            <p className="text-xs text-gray-300 mb-1">
              This ingredient is in the <span className="text-cyan-300 font-medium">{node.clusterLabel}</span> cluster
            </p>
            <p className="text-[10px] text-gray-500">
              Ingredients cluster by how often they appear together in recipes and how similar their molecular structures are.
            </p>
          </section>
        )}
        {node.gnnProbs && (
          <section>
            <SectionHeading>Why it tastes this way</SectionHeading>
            {node.gnnCompounds && (
              <div className="mb-2">
                <p className="text-[11px] text-gray-400 mb-1.5">
                  Contains {node.gnnCompounds.total_compounds} flavor compounds.
                  {node.gnnCompounds.top_compounds?.length > 0 && ' Key molecules:'}
                </p>
                <div className="space-y-1 mb-2">
                  {(node.gnnCompounds.top_compounds || []).slice(0, 3).map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="text-gray-200 font-medium truncate max-w-[40%]">{c.name}</span>
                      {c.tags?.length > 0 && (
                        <span className="text-gray-500">{c.tags.slice(0, 2).join(', ')}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[10px] text-gray-500 mb-1">Our AI analyzed these molecular structures and predicts:</p>
            <div className="space-y-1">
              {Object.entries(node.gnnProbs).filter(([t]) => !t.startsWith('odor_')).map(([t, p]) => (
                <div key={t} className="flex items-center gap-2">
                  <span className="w-12 text-[10px] uppercase text-gray-500">{t}</span>
                  <div className="flex-1 h-2 bg-[#1a1a24] rounded overflow-hidden">
                    <div className="h-full rounded transition-all duration-500" style={{
                      width: `${Math.max(0, Math.min(1, p)) * 100}%`,
                      background: t === 'sweet' ? '#ff4fb8' : t === 'bitter' ? '#9d4edd' : t === 'umami' ? '#ffd700' : t === 'salty' ? '#4f9eff' : '#00ffd0',
                    }} />
                  </div>
                  <span className="w-8 text-right text-[10px] text-gray-400 tabular-nums">{Math.round(p * 100)}%</span>
                </div>
              ))}
            </div>
            {Object.entries(node.gnnProbs).some(([t]) => t.startsWith('odor_')) && (
              <>
                <p className="text-[10px] text-gray-500 mt-2 mb-1">Predicted aroma:</p>
                <div className="space-y-1">
                  {Object.entries(node.gnnProbs).filter(([t]) => t.startsWith('odor_')).map(([t, p]) => (
                    <div key={t} className="flex items-center gap-2">
                      <span className="w-12 text-[10px] uppercase text-gray-500">{t.replace('odor_', '')}</span>
                      <div className="flex-1 h-2 bg-[#1a1a24] rounded overflow-hidden">
                        <div className="h-full rounded transition-all duration-500" style={{
                          width: `${Math.max(0, Math.min(1, p)) * 100}%`,
                          background: t === 'odor_fruity' ? '#ff8c42' : t === 'odor_floral' ? '#e879a8' : t === 'odor_green' ? '#6bcb77' : t === 'odor_woody' ? '#a67c52' : t === 'odor_spicy' ? '#ff4444' : '#d4aa70',
                        }} />
                      </div>
                      <span className="w-8 text-right text-[10px] text-gray-400 tabular-nums">{Math.round(p * 100)}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
        {graphNodes && (
          <section>
            <SectionHeading>Taste Radar</SectionHeading>
            <div className="flex justify-center">
              <TasteRadar
                ingredients={radarIngredients}
                nodes={graphNodes}
                compact
                theme="dark"
              />
            </div>
          </section>
        )}
        {cuisines && cuisines.length > 0 && (
          <section>
            <SectionHeading>Cuisines</SectionHeading>
            <div className="flex flex-wrap gap-1.5">
              {cuisines.map((cuisine) => (
                <span key={cuisine} className="inline-block px-2 py-0.5 rounded border text-xs font-medium bg-indigo-500/15 text-indigo-300 border-indigo-500/25">{cuisine}</span>
              ))}
            </div>
          </section>
        )}
        {selectedCount >= 2 && commonPairings.length > 0 && (
          <section>
            <SectionHeading>
              <button
                onClick={() => onHighlightPairings && onHighlightPairings(commonPairings.map(n => n.name))}
                className="hover:text-cyan-300 transition-colors cursor-pointer"
                title="Highlight common pairings on the network"
              >Common Pairings ({commonPairings.length}) ↗</button>
            </SectionHeading>
            <ul className="space-y-1.5">
              {commonPairings.map((neighbor) => (
                <li key={`common-${neighbor.name}`}>
                  <button
                    onClick={() => onSelectIngredient && onSelectIngredient(neighbor.name)}
                    className="w-full min-h-[44px] flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm text-gray-200 hover:bg-gray-700/40 transition-colors group"
                  >
                    <span className="truncate flex-shrink-0 min-w-0 max-w-[45%] group-hover:text-emerald-300 transition-colors">{neighbor.name}</span>
                    <StrengthBar strength={neighbor.strength} />
                    <span className="text-[10px] text-gray-500 tabular-nums flex-shrink-0 w-8 text-right">{Math.round(neighbor.strength * 100)}%</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {selectedCount < 2 && sortedNeighbors.length > 0 && (
          <section>
            <SectionHeading>
              <button
                onClick={() => onHighlightPairings && onHighlightPairings(sortedNeighbors.map(n => n.name))}
                className="hover:text-cyan-300 transition-colors cursor-pointer"
                title="Highlight all top pairings on the network"
              >Top Pairings ↗</button>
            </SectionHeading>
            <ul className="space-y-1.5">
              {sortedNeighbors.map((neighbor) => (
                <li key={neighbor.name}>
                  <button
                    onClick={() => onSelectIngredient && onSelectIngredient(neighbor.name)}
                    className="w-full min-h-[44px] flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm text-gray-200 hover:bg-gray-700/40 transition-colors group"
                  >
                    <span className="truncate flex-shrink-0 min-w-0 max-w-[45%] group-hover:text-cyan-300 transition-colors">{neighbor.name}</span>
                    <StrengthBar strength={neighbor.strength} />
                    <span className="text-[10px] text-gray-500 tabular-nums flex-shrink-0 w-8 text-right">{Math.round(neighbor.strength * 100)}%</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {affinities && affinities.length > 0 && (
          <section>
            <SectionHeading>Affinities</SectionHeading>
            <div className="space-y-1.5">
              {affinities.map((combo, idx) => {
                const display = Array.isArray(combo) ? combo.join(' + ') : String(combo);
                return <div key={idx} className="px-2 py-1.5 rounded-md bg-gray-800/40 border border-gray-700/30 text-sm text-gray-300">{display}</div>;
              })}
            </div>
          </section>
        )}
        {tips && tips.length > 0 && (
          <section>
            <SectionHeading>Tips</SectionHeading>
            {Array.isArray(tips) ? (
              <ul className="space-y-1.5 text-sm text-gray-400 list-disc list-inside">
                {tips.map((tip, idx) => <li key={idx}>{tip}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">{tips}</p>
            )}
          </section>
        )}
        {onBuildRecipe && (
          <button
            onClick={onBuildRecipe}
            className="w-full mt-4 px-4 py-2.5 min-h-[44px] bg-gradient-to-r from-purple-600/30 to-cyan-600/30 hover:from-purple-600/50 hover:to-cyan-600/50 border border-purple-500/30 rounded-lg text-sm text-gray-200 font-medium transition-all"
          >
            Build a recipe with {selectedCount >= 2 ? `these ${selectedCount} ingredients` : name} →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="fixed right-0 z-40 flex items-stretch select-none" style={{ top: 'var(--nav-h)', bottom: 'var(--bottom-safe)' }}>
      {/* Tab */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className={`self-start mt-8 min-w-[44px] min-h-[44px] flex items-center justify-center bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] border-r-0 rounded-l-lg px-1.5 py-3 transition-colors ${
          collapsed ? 'text-cyan-400' : 'text-gray-500 hover:text-gray-300'
        }`}
        aria-label={collapsed ? 'Show details' : 'Hide details'}
        title={name}
      >
        <span className="text-[10px] uppercase tracking-widest font-medium" style={{ writingMode: 'vertical-rl' }}>
          Details
        </span>
      </button>

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label={`Details for ${name}`}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`w-80 overflow-y-auto bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg p-4 focus:outline-none transition-transform duration-300 ease-in-out ${
          collapsed ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'
        }`}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-100 hover:bg-gray-700/50 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>

        {/* Ingredient name + favorite */}
        <div className="flex items-start gap-2 pr-8 mb-1">
          <h2
            className="text-2xl font-bold text-gray-100"
            style={{
              textShadow: '0 0 20px rgba(56, 189, 248, 0.4), 0 0 40px rgba(139, 92, 246, 0.2)',
            }}
          >
            {name}
          </h2>
          {onToggleFavorite && (
            <button
              onClick={() => onToggleFavorite(name)}
              className={`mt-1 flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors ${
                isFavorite
                  ? 'text-pink-400 hover:text-pink-300'
                  : 'text-gray-600 hover:text-pink-400'
              }`}
              aria-label={isFavorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
              title={isFavorite ? 'Remove from profile' : 'Add to profile'}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          )}
        </div>

        {pairingCount != null && (
          <p className="text-xs text-gray-500 mb-1">
            {pairingCount} pairing{pairingCount !== 1 ? 's' : ''}
          </p>
        )}

        {selectedCount >= 2 && (
          <section className="mb-3">
            <SectionHeading>Selected Ingredients ({selectedCount})</SectionHeading>
            <div className="flex flex-wrap gap-1.5">
              {selectedNodesData.map((n) => (
                <span
                  key={`dt-${n.name}`}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${
                    n.name === name
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                      : 'bg-gray-800/60 text-gray-300 border-gray-700/40'
                  }`}
                >
                  {n.name}
                  {n.taste && <span className="text-gray-500 text-[10px]">{n.taste}</span>}
                </span>
              ))}
            </div>
          </section>
        )}
        {balanceScore && selectedCount >= 2 && (
          <section className="mb-3">
            <SectionHeading>Taste Balance</SectionHeading>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex-1 h-2 bg-[#1a1a24] rounded overflow-hidden">
                <div className="h-full rounded" style={{
                  width: `${Math.round(balanceScore.balance * 100)}%`,
                  background: balanceScore.balance > 0.6 ? '#34d399' : balanceScore.balance > 0.3 ? '#fbbf24' : '#f87171',
                }} />
              </div>
              <span className="text-[10px] text-gray-400 w-8 text-right">{Math.round(balanceScore.balance * 100)}%</span>
            </div>
            <p className="text-xs text-gray-300">{balanceVerdict}</p>
            {tasteSuggestion && (
              <p className="text-[11px] text-cyan-400/80 mt-1">
                Missing {tasteSuggestion.taste}
                {tasteSuggestion.ingredient && (
                  <> — try <button onClick={() => onSelectIngredient?.(tasteSuggestion.ingredient)} className="underline hover:text-cyan-300">{tasteSuggestion.ingredient}</button></>
                )}
              </p>
            )}
          </section>
        )}

        {discoveryFact && (
          <div className="text-[11px] text-cyan-400/60 italic mb-3">
            {discoveryFact}
          </div>
        )}

        {/* Properties */}
        {(taste || weight || volume || season) && (
          <section>
            <SectionHeading>Properties</SectionHeading>
            <div className="flex flex-wrap gap-1.5">
              <PropertyBadge label="taste" value={taste} isTaste />
              <PropertyBadge label="weight" value={weight} />
              <PropertyBadge label="volume" value={volume} />
              <PropertyBadge label="season" value={season} />
            </div>
          </section>
        )}

        {/* Molecular Profile — GNN-predicted taste from molecular structure */}
        {node.gnnProbs && (
          <section>
            <SectionHeading>Molecular Profile</SectionHeading>
            <div className="space-y-1">
              {Object.entries(node.gnnProbs).map(([t, p]) => (
                <div key={`dt-mp-${t}`} className="flex items-center gap-2">
                  <span className="w-12 text-[10px] uppercase text-gray-500">{t}</span>
                  <div className="flex-1 h-2 bg-[#1a1a24] rounded overflow-hidden">
                    <div className="h-full rounded transition-all duration-500" style={{
                      width: `${Math.max(0, Math.min(1, p)) * 100}%`,
                      background: t === 'sweet' ? '#ff4fb8' : t === 'bitter' ? '#9d4edd' : t === 'umami' ? '#ffd700' : t === 'salty' ? '#4f9eff' : '#00ffd0',
                    }} />
                  </div>
                  <span className="w-8 text-right text-[10px] text-gray-400 tabular-nums">{Math.round(p * 100)}%</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-1">GNN-predicted taste from molecular structure</p>
          </section>
        )}

        {/* Taste Radar */}
        {graphNodes && (
          <section>
            <SectionHeading>Taste Radar</SectionHeading>
            <div className="flex justify-center">
              <TasteRadar
                ingredients={radarIngredients}
                nodes={graphNodes}
                compact
                theme="dark"
              />
            </div>
          </section>
        )}

        {/* Cuisines */}
        {cuisines && cuisines.length > 0 && (
          <section>
            <SectionHeading>Cuisines</SectionHeading>
            <div className="flex flex-wrap gap-1.5">
              {cuisines.map((cuisine) => (
                <span
                  key={cuisine}
                  className="inline-block px-2 py-0.5 rounded border text-xs font-medium bg-indigo-500/15 text-indigo-300 border-indigo-500/25"
                >
                  {cuisine}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Common Pairings (multi-select) or Top Pairings (single-select) */}
        {selectedCount >= 2 && commonPairings.length > 0 && (
          <section>
            <SectionHeading>
              <button
                onClick={() => onHighlightPairings && onHighlightPairings(commonPairings.map(n => n.name))}
                className="hover:text-cyan-300 transition-colors cursor-pointer"
                title="Highlight common pairings on the network"
              >Common Pairings ({commonPairings.length}) ↗</button>
            </SectionHeading>
            <ul className="space-y-1.5">
              {commonPairings.map((neighbor) => (
                <li key={`dtc-${neighbor.name}`}>
                  <button
                    onClick={() => onSelectIngredient && onSelectIngredient(neighbor.name)}
                    className="w-full min-h-[44px] flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm text-gray-200 hover:bg-gray-700/40 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500 group"
                  >
                    <span className="truncate flex-shrink-0 min-w-0 max-w-[45%] group-hover:text-emerald-300 transition-colors">{neighbor.name}</span>
                    <StrengthBar strength={neighbor.strength} />
                    <span className="text-[10px] text-gray-500 tabular-nums flex-shrink-0 w-8 text-right">{Math.round(neighbor.strength * 100)}%</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {selectedCount < 2 && sortedNeighbors.length > 0 && (
          <section>
            <SectionHeading>
              <button
                onClick={() => onHighlightPairings && onHighlightPairings(sortedNeighbors.map(n => n.name))}
                className="hover:text-cyan-300 transition-colors cursor-pointer"
                title="Highlight all top pairings on the network"
              >Top Pairings ↗</button>
            </SectionHeading>
            <ul className="space-y-1.5">
              {sortedNeighbors.map((neighbor) => (
                <li key={neighbor.name}>
                  <button
                    onClick={() => onSelectIngredient && onSelectIngredient(neighbor.name)}
                    className="w-full min-h-[44px] flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm text-gray-200 hover:bg-gray-700/40 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500 group"
                  >
                    <span className="truncate flex-shrink-0 min-w-0 max-w-[45%] group-hover:text-cyan-300 transition-colors">{neighbor.name}</span>
                    <StrengthBar strength={neighbor.strength} />
                    <span className="text-[10px] text-gray-500 tabular-nums flex-shrink-0 w-8 text-right">{Math.round(neighbor.strength * 100)}%</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Affinities */}
        {affinities && affinities.length > 0 && (
          <section>
            <SectionHeading>Affinities</SectionHeading>
            <div className="space-y-1.5">
              {affinities.map((combo, idx) => {
                const display = Array.isArray(combo) ? combo.join(' + ') : String(combo);
                return (
                  <div
                    key={idx}
                    className="px-2 py-1.5 rounded-md bg-gray-800/40 border border-gray-700/30 text-sm text-gray-300"
                  >
                    {display}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Tips */}
        {tips && tips.length > 0 && (
          <section>
            <SectionHeading>Tips</SectionHeading>
            {Array.isArray(tips) ? (
              <ul className="space-y-1.5 text-sm text-gray-400 list-disc list-inside">
                {tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">{tips}</p>
            )}
          </section>
        )}

        {/* Build a recipe CTA */}
        {onBuildRecipe && (
          <button
            onClick={onBuildRecipe}
            className="w-full mt-4 px-4 py-2.5 min-h-[44px] bg-gradient-to-r from-purple-600/30 to-cyan-600/30 hover:from-purple-600/50 hover:to-cyan-600/50 border border-purple-500/30 rounded-lg text-sm text-gray-200 font-medium transition-all"
          >
            Build a recipe with {selectedCount >= 2 ? `these ${selectedCount} ingredients` : name} →
          </button>
        )}
      </div>
    </div>
  );
}
