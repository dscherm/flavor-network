import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import TasteRadar from './TasteRadar.jsx';
import OdorBadge from './OdorBadge.jsx';
import PredictedProfile from './PredictedProfile.jsx';
import SharedMoleculesCard from './SharedMoleculesCard.jsx';
import ProfileRadarCarousel from './ProfileRadarCarousel.jsx';
import FlavorPathCard from './FlavorPathCard.jsx';
import MoleculeTasteMap from './MoleculeTasteMap.jsx';
import { scoreRecipeAroma, AROMA_LABELS, AROMA_COLORS } from '../data/recipeScoring.js';

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

/**
 * CollapsibleSection — default-collapsed info section. Avoids overwhelming
 * the user with long panels; they opt in per section. Essentials (Name,
 * Properties, Profile Radar) stay un-collapsed and use plain <section>.
 */
function CollapsibleSection({ title, badge, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mt-5 first:mt-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 text-[11px] uppercase tracking-widest text-gray-500 font-semibold mb-2 hover:text-gray-300 transition-colors"
      >
        <span className="opacity-60 text-[10px] leading-none w-3">
          {open ? '▾' : '▸'}
        </span>
        <span>{title}</span>
        {badge != null && (
          <span className="text-[10px] text-gray-600 normal-case tracking-normal font-normal">
            {badge}
          </span>
        )}
      </button>
      {open && <div>{children}</div>}
    </section>
  );
}

function AromaProfileSection({ aroma }) {
  if (!aroma || !aroma.hasSignal) return null;
  const entries = Object.keys(AROMA_LABELS).map((key, i) => ({
    key,
    label: AROMA_LABELS[key],
    color: AROMA_COLORS[key],
    p: aroma.profile[i] || 0,
  })).sort((a, b) => b.p - a.p);
  return (
    <section className="mb-3">
      <SectionHeading>Aroma Profile</SectionHeading>
      <div className="space-y-1">
        {entries.map(e => (
          <div key={e.key} className="flex items-center gap-2">
            <span className="w-12 text-[10px] uppercase text-gray-500">{e.label}</span>
            <div className="flex-1 h-2 bg-[#1a1a24] rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500"
                style={{ width: `${Math.max(0, Math.min(1, e.p)) * 100}%`, background: e.color }}
              />
            </div>
            <span className="w-8 text-right text-[10px] text-gray-400 tabular-nums">
              {Math.round(e.p * 100)}%
            </span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-500 mt-1.5">
        Aggregate of GNN-predicted aromas across the selected ingredients
        {aroma.confidence < 1 && ` · ${Math.round(aroma.confidence * 100)}% coverage`}
      </p>
    </section>
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

export default function IngredientPanel({ node, neighbors, onClose, onSelectIngredient, onHighlightPairings, onBuildRecipe, flavorPath, commonPairings = [], selectedNodes = [], selectedNodesData = [], selectedCount = 0, isFavorite, onToggleFavorite, embedded = false, graphNodes, bridgeCompounds, gnnEntropy, odorThresholds, ingredientThresholds, compoundTastes }) {
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

  // Aroma profile across selected ingredients — replaces the old
  // Taste Balance %, which was a misleading single-number summary
  // over only 5 taste channels. Aroma is the dominant flavor signal
  // and the GNN's odor heads are reasonably calibrated.
  const aromaProfile = useMemo(() => {
    if (selectedCount < 2) return null;
    return scoreRecipeAroma(selectedNodesData);
  }, [selectedNodesData, selectedCount]);

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
        <AromaProfileSection aroma={aromaProfile} />
        {flavorPath && flavorPath.length > 2 && selectedCount === 2 && (
          <section className="mb-3">
            <SectionHeading>Flavor Path</SectionHeading>
            <FlavorPathCard
              path={flavorPath}
              bridgeCompounds={bridgeCompounds}
              selectedNodes={selectedNodes}
              onSelectIngredient={onSelectIngredient}
            />
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
        {node.name && gnnEntropy && ingredientThresholds && (
          <CollapsibleSection title="Predicted profile">
            <PredictedProfile
              name={node.name}
              gnnEntropy={gnnEntropy}
              ingredientThresholds={ingredientThresholds}
            />
            <p className="text-[10px] text-gray-500 mt-1.5">
              Predicted by the molecular GNN from compound structure. Tags flag the top ~15% of ingredients for each trait.
            </p>
          </CollapsibleSection>
        )}
        {node.clusterLabel && (
          <CollapsibleSection title="Flavor Cluster" badge={node.clusterLabel}>
            <p className="text-xs text-gray-300 mb-1">
              This ingredient is in the <span className="text-cyan-300 font-medium">{node.clusterLabel}</span> cluster
            </p>
            <p className="text-[10px] text-gray-500">
              Ingredients cluster by how often they appear together in recipes and how similar their molecular structures are.
            </p>
          </CollapsibleSection>
        )}
        {node.gnnProbs && (
          <CollapsibleSection title="Why it tastes this way">
            {node.gnnCompounds && (
              <div className="mb-2">
                <p className="text-[11px] text-gray-400 mb-1.5">
                  Contains {node.gnnCompounds.total_compounds} flavor compounds. Each molecule below links to the tastes and aromas it's known for:
                </p>
                <MoleculeTasteMap
                  compounds={(node.gnnCompounds.top_compounds || []).slice(0, 5)}
                  compoundTastes={compoundTastes}
                />
                {/* Legacy list kept hidden — MoleculeTasteMap above replaces it.
                    Remove this block once R14 ships. */}
                <div className="space-y-1 mb-2 hidden">
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
          </CollapsibleSection>
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
          <CollapsibleSection title="Cuisines" badge={`(${cuisines.length})`}>
            <div className="flex flex-wrap gap-1.5">
              {cuisines.map((cuisine) => (
                <span key={cuisine} className="inline-block px-2 py-0.5 rounded border text-xs font-medium bg-indigo-500/15 text-indigo-300 border-indigo-500/25">{cuisine}</span>
              ))}
            </div>
          </CollapsibleSection>
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
                    <OdorBadge a={node?.name} b={neighbor.name} bridgeCompounds={bridgeCompounds} compact />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {selectedCount < 2 && sortedNeighbors.length > 0 && (
          <CollapsibleSection title="Top Pairings" badge={`(${sortedNeighbors.length})`}>
            <button
              onClick={(e) => { e.stopPropagation(); onHighlightPairings && onHighlightPairings(sortedNeighbors.map(n => n.name)); }}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 mb-1.5"
              title="Highlight all top pairings on the network"
            >Highlight all on network ↗</button>
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
                    <OdorBadge a={node?.name} b={neighbor.name} bridgeCompounds={bridgeCompounds} compact />
                  </button>
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        )}
        {affinities && affinities.length > 0 && (
          <CollapsibleSection title="Affinities" badge={`(${affinities.length})`}>
            <div className="space-y-1.5">
              {affinities.map((combo, idx) => {
                const display = Array.isArray(combo) ? combo.join(' + ') : String(combo);
                return <div key={idx} className="px-2 py-1.5 rounded-md bg-gray-800/40 border border-gray-700/30 text-sm text-gray-300">{display}</div>;
              })}
            </div>
          </CollapsibleSection>
        )}
        {tips && tips.length > 0 && (
          <CollapsibleSection title="Tips">
            {Array.isArray(tips) ? (
              <ul className="space-y-1.5 text-sm text-gray-400 list-disc list-inside">
                {tips.map((tip, idx) => <li key={idx}>{tip}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">{tips}</p>
            )}
          </CollapsibleSection>
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
    <div
      className={`fixed right-0 z-40 flex items-stretch select-none transition-transform duration-300 ease-in-out ${
        collapsed ? 'translate-x-80' : 'translate-x-0'
      }`}
      style={{ top: 'var(--nav-h)', bottom: 'var(--bottom-safe)' }}
    >
      {/* Tab — when the container slides right by w-80 (panel width),
          the panel goes off-screen and this button lands flush with
          the viewport's right edge. */}
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
        className="w-80 overflow-y-auto bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] rounded-lg p-4 focus:outline-none"
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
        <AromaProfileSection aroma={aromaProfile} />

        {flavorPath && flavorPath.length > 2 && selectedCount === 2 && (
          <section className="mb-3">
            <SectionHeading>Flavor Path</SectionHeading>
            <FlavorPathCard
              path={flavorPath}
              bridgeCompounds={bridgeCompounds}
              selectedNodes={selectedNodes}
              onSelectIngredient={onSelectIngredient}
            />
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

        {/* Molecular Profile — collapsed by default; the Profile Radar
            Carousel below shows the same data graphically. Kept for
            users who want numeric probabilities. */}
        {node.gnnProbs && (
          <CollapsibleSection title="Molecular Profile">
            <div className="space-y-1">
              {Object.entries(node.gnnProbs).map(([t, p]) => {
                const label = t.startsWith('odor_') ? t.slice(5) : t;
                const color = t === 'sweet' ? '#ff4fb8'
                  : t === 'bitter' ? '#9d4edd'
                  : t === 'umami' ? '#ffd700'
                  : t === 'salty' ? '#4f9eff'
                  : t === 'sour' ? '#00ffd0'
                  : t === 'odor_fruity' ? '#ff8c42'
                  : t === 'odor_floral' ? '#e879a8'
                  : t === 'odor_green' ? '#6bcb77'
                  : t === 'odor_woody' ? '#a67c52'
                  : t === 'odor_spicy' ? '#ff4444'
                  : t === 'odor_fatty' ? '#d4aa70'
                  : '#00ffd0';
                return (
                  <div key={`dt-mp-${t}`} className="flex items-center gap-2">
                    <span className="w-14 text-[10px] uppercase text-gray-500">{label}</span>
                    <div className="flex-1 h-2 bg-[#1a1a24] rounded overflow-hidden">
                      <div className="h-full rounded transition-all duration-500" style={{
                        width: `${Math.max(0, Math.min(1, p)) * 100}%`,
                        background: color,
                      }} />
                    </div>
                    <span className="w-8 text-right text-[10px] text-gray-400 tabular-nums">{Math.round(p * 100)}%</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-600 mt-1">GNN-predicted taste + aroma from molecular structure</p>
          </CollapsibleSection>
        )}

        {/* Profile Radars — swipe between Taste / Aroma / Combined */}
        {graphNodes && (
          <section>
            <SectionHeading>Profile Radar</SectionHeading>
            <ProfileRadarCarousel
              ingredientName={node?.name}
              ingredients={radarIngredients}
              graphNodes={graphNodes}
              gnnEntropy={gnnEntropy}
            />
          </section>
        )}

        {/* Cuisines */}
        {cuisines && cuisines.length > 0 && (
          <CollapsibleSection title="Cuisines" badge={`(${cuisines.length})`}>
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
          </CollapsibleSection>
        )}

        {/* Shared Molecules — chemistry explanation when exactly 2 ingredients
            are selected. Folds FlavorBridge's per-segment bridge-compound
            panel into the IngredientPanel inline (R13 Phase 2a). */}
        {selectedCount === 2 && bridgeCompounds && selectedNodes.length >= 2 && (
          <section>
            <SectionHeading>Shared Molecules</SectionHeading>
            <SharedMoleculesCard
              a={selectedNodes[0]}
              b={selectedNodes[1]}
              bridgeCompounds={bridgeCompounds}
            />
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
                    <OdorBadge a={node?.name} b={neighbor.name} bridgeCompounds={bridgeCompounds} compact />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {selectedCount < 2 && sortedNeighbors.length > 0 && (
          <CollapsibleSection title="Top Pairings" badge={`(${sortedNeighbors.length})`}>
            <button
              onClick={(e) => { e.stopPropagation(); onHighlightPairings && onHighlightPairings(sortedNeighbors.map(n => n.name)); }}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 mb-1.5"
              title="Highlight all top pairings on the network"
            >Highlight all on network ↗</button>
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
                    <OdorBadge a={node?.name} b={neighbor.name} bridgeCompounds={bridgeCompounds} compact />
                  </button>
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        )}

        {/* Affinities */}
        {affinities && affinities.length > 0 && (
          <CollapsibleSection title="Affinities" badge={`(${affinities.length})`}>
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
          </CollapsibleSection>
        )}

        {/* Tips */}
        {tips && tips.length > 0 && (
          <CollapsibleSection title="Tips">
            {Array.isArray(tips) ? (
              <ul className="space-y-1.5 text-sm text-gray-400 list-disc list-inside">
                {tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">{tips}</p>
            )}
          </CollapsibleSection>
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
