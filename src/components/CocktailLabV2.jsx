import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import NetworkScene from './NetworkScene.jsx';
import LabNodeCard from './LabNodeCard.jsx';
import CocktailBrowse from './CocktailBrowse.jsx';
import {
  loadCodexV2,
  placeCocktailInFamily,
  topSimilar,
  crossFamilySimilar,
  cocktailSimilarity,
} from '../data/cocktailCodexV2.js';
import { createClusterLabels, createGlowSprite } from '../three/AxisLabels.js';
import ClusterJoystick from './ClusterJoystick.jsx';
import ShapeLegend from './ShapeLegend.jsx';
import { cocktailBaseSpiritShape, COCKTAIL_SPIRIT_LEGEND } from '../data/cocktailBaseSpirit.js';
import { formatSimilarityBadge } from '../data/recipeAromaSimilarity.js';

/**
 * CocktailLabV2 — data-driven taxonomy view.
 *
 * Replaces the legacy 7-archetype Cocktail Codex view with the K=6
 * data-driven family taxonomy from `cocktail_codex_v2.json`. See
 * `docs/cocktail-codex-v2/v2.5-impl-spec.md`.
 *
 * Click a cocktail → detail panel with engineering metadata + closest
 * cousins (within-family) + cross-family bridges.
 */
export default function CocktailLabV2({
  onSelectionChange,
  onOpenRecipeLab,
  // Phase 5 bridge: Build path → Cocktail Lab. Shape:
  //   { family?: string, spirit?: string }
  // Pre-selects filter pills on mount so the user lands in the slice
  // matching their Build picks. Optional; null = no pre-filter.
  externalFilter = null,
  // P7: aroma-match context from RecipeLab. When non-null, renders
  // only the matched cocktails instead of the full browse view.
  // Shape: { recipeName: string, items: AromaMatchResult[] }
  matchesContext = null,
  onExitMatches = () => {},
}) {
  const [graph, setGraph] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCocktail, setSelectedCocktail] = useState(null);
  const [filterFamily, setFilterFamily] = useState(null);
  const [filterSpirit, setFilterSpirit] = useState(null);
  const [flyToTarget, setFlyToTarget] = useState(null);

  // Apply Build → Lab pre-filter on mount.
  useEffect(() => {
    if (!externalFilter) return;
    if (externalFilter.family) setFilterFamily(externalFilter.family);
    if (externalFilter.spirit) setFilterSpirit(externalFilter.spirit);
  }, [externalFilter]);
  // Explore = the 3D NetworkScene cluster view (existing behavior).
  // Browse = the 2D mini-map + filterable list view (new). Detail
  // panel + cocktail selection state are shared across both modes.
  const [viewMode, setViewMode] = useState('explore');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}data/cocktail_codex_v2.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        const g = loadCodexV2(raw);
        if (cancelled) return;
        if (!g) throw new Error('Invalid cocktail_codex_v2.json schema');
        setGraph(g);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // NetworkScene-compatible data shape: Map<name, node> + positions
  // dictionary keyed by name. Each cocktail's 3D position is computed
  // by `placeCocktailInFamily` (Fibonacci sphere shell + inner-orbit
  // sub-cluster rings).
  const networkData = useMemo(() => {
    if (!graph) return null;
    const nodes = new Map();
    const positionDict = {};
    for (const fam of graph.families) {
      const members = graph.byFamily.get(fam.id) || [];
      // Index sub-clusters within this family so each gets a distinct
      // color tint (lightness shift). Even-indexed subs darken, odd
      // lighten — keeps the family hue but separates the rings.
      const subIds = [...new Set(members.map((m) => m.subcluster_id))].sort();
      const subShade = new Map();
      subIds.forEach((sid, i) => {
        const lightness = i === 0 ? 0 : (i % 2 === 1 ? -18 : 14);
        subShade.set(sid, shiftColorLightness(fam.color, lightness));
      });
      for (const m of members) {
        const pos = placeCocktailInFamily(m, fam, members);
        positionDict[m.name] = [pos.x, pos.y, pos.z];
        const tinted = subShade.get(m.subcluster_id) || fam.color;
        nodes.set(m.name, {
          name: m.name,
          family_id: m.family_id,
          subcluster_id: m.subcluster_id,
          isRoot: m.is_root,
          iba_official: m.iba_official,
          // NodeMesh.getColorForNode short-circuits on `clusterColor`
          // — that's how the cocktail/sauce labs paint per-cluster
          // hues. `color` alone was being ignored and every node fell
          // through to the taste path, which was hard-coded to 'sweet'
          // (= pink) for all 441 cocktails.
          clusterColor: tinted,
          color: tinted,
          taste: '',
          pairingCount: 1,
          cuisines: [],
          // Cocktail nodes 50% larger (1.0 → 1.5); cultural Root
          // doubled on top of that (4.0 = 2× the new regular). Root
          // also gets a permanent activation in CocktailLabV2 so it
          // glows continuously, not just on selection.
          scaleBoost: m.is_root ? 4.0 : 1.5,
        });
      }
    }
    // No edges in v2: NetworkScene's selection effect dims everything
    // and re-brightens the selected node + every edge-connected
    // neighbor. With ~8-12 cosine ≥ 0.85 neighbors per cocktail in our
    // within-family graph, a single click would light up most of the
    // surrounding cluster, making it impossible to tell what was
    // actually selected. Cluster identity is already conveyed by the
    // family color; "similar cocktails" lives in the detail panel.
    const edges = [];
    return {
      graph: {
        nodes,
        edges,
        ingredientList: [],
      },
      positions: { positions: positionDict },
      codex: { clusters: graph.families.map((f) => ({ id: f.id, name: f.name, color: f.color })) },
    };
  }, [graph]);

  // Family centroid lookup (3D position) for camera fly-to + 3D labels.
  // Built from the actual rendered cocktail positions — the abstract
  // sphere-shell point from `placeFamilyOnSphere` is not where any
  // cocktail actually sits, so flying there lands the camera in empty
  // space. We use the Root cocktail's placed position instead.
  const familyCentroids = useMemo(() => {
    if (!graph || !networkData) return null;
    const m = new Map();
    const positions = networkData.positions.positions;
    for (const f of graph.families) {
      const root = graph.rootByFamily.get(f.id);
      const pos = root ? positions[root.name] : null;
      if (pos) {
        m.set(f.id, pos);
      } else {
        const members = graph.byFamily.get(f.id) || [];
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const c of members) {
          const p = positions[c.name];
          if (!p) continue;
          sx += p[0]; sy += p[1]; sz += p[2]; n++;
        }
        if (n > 0) m.set(f.id, [sx / n, sy / n, sz / n]);
      }
    }
    return m;
  }, [graph, networkData]);

  const familyCentroidAdapter = useMemo(() => {
    if (!familyCentroids) return null;
    return () => {
      const out = [];
      for (const [id, position] of familyCentroids) {
        if (Array.isArray(position) && position.length >= 3) {
          out.push({ id, position });
        }
      }
      return out;
    };
  }, [familyCentroids]);

  const familyMemberCount = useMemo(() => {
    if (!graph) return null;
    const m = new Map();
    for (const f of graph.families) m.set(f.id, f.signature.size);
    return m;
  }, [graph]);

  // Map<name, shapeKey> — base spirit drives shape (gin=cube, whiskey=
  // cylinder, rum=torus, etc.). Built once when the graph loads;
  // NetworkScene's NodeMesh uses this to render multi-shape instances.
  const shapeAssignments = useMemo(() => {
    if (!graph) return null;
    const m = new Map();
    for (const c of graph.cocktails) {
      m.set(c.name, cocktailBaseSpiritShape(c.ingredients_raw));
    }
    return m.size > 0 ? m : null;
  }, [graph]);

  const sceneExtras = useMemo(() => {
    if (!graph || !familyCentroids || !networkData) return null;
    const clusters = graph.families.map((f) => ({
      id: f.id,
      label: f.name,
      color: f.color,
    }));
    const labels = createClusterLabels(clusters, familyCentroids);
    // Add a permanent glow halo around each Cultural Root cocktail
    // — colored by its family hue so the centroid pulses with cluster
    // identity without us having to fight NodeMesh's activation reset
    // on every selection / filter change.
    const positions = networkData.positions.positions;
    for (const f of graph.families) {
      const root = graph.rootByFamily.get(f.id);
      if (!root) continue;
      const pos = positions[root.name];
      if (!pos) continue;
      labels.add(createGlowSprite(pos, f.color, 14));
    }
    return labels;
  }, [graph, familyCentroids, networkData]);

  useEffect(() => {
    if (onSelectionChange) onSelectionChange(selectedCocktail ? [selectedCocktail] : []);
  }, [selectedCocktail, onSelectionChange]);

  const selectedNode = useMemo(() => {
    if (!selectedCocktail || !graph) return null;
    return graph.byCanonical.get(canonicalize(selectedCocktail))
      || [...graph.byCanonical.values()].find((c) => c.name === selectedCocktail)
      || null;
  }, [selectedCocktail, graph]);

  // Within-family closest cousins (cosine ≥ 0.55).
  const similarCocktails = useMemo(() => {
    if (!selectedNode || !graph) return [];
    const within = topSimilar(selectedNode, graph.cocktails, 8, { withinFamily: true });
    const familyById = new Map(graph.families.map((f) => [f.id, f]));
    return within.map(({ cocktail, similarity }) => ({
      name: cocktail.name,
      similarity,
      family_id: cocktail.family_id,
      color: familyById.get(cocktail.family_id)?.color || '#888',
    }));
  }, [selectedNode, graph]);

  // Cross-family bridges — the "where this cocktail breaks ranks" panel.
  const crossFamilyCousins = useMemo(() => {
    if (!selectedNode || !graph) return [];
    const across = crossFamilySimilar(selectedNode, graph.cocktails, 3);
    const familyById = new Map(graph.families.map((f) => [f.id, f]));
    return across.map(({ cocktail, similarity }) => ({
      name: cocktail.name,
      similarity,
      family_id: cocktail.family_id,
      family_name: familyById.get(cocktail.family_id)?.name,
      color: familyById.get(cocktail.family_id)?.color || '#888',
    }));
  }, [selectedNode, graph]);

  const familyForSelected = useMemo(() => {
    if (!selectedNode || !graph) return null;
    return graph.families.find((f) => f.id === selectedNode.family_id) || null;
  }, [selectedNode, graph]);

  const familyFilteredNames = useMemo(() => {
    if (filterFamily == null || !graph) return null;
    const names = (graph.byFamily.get(filterFamily) || []).map((c) => c.name);
    return names.length > 0 ? names : null;
  }, [filterFamily, graph]);

  // Spirit-shape filter: ShapeLegend now acts as a fly-to wheel.
  // Maps selected category ('Gin') → its shape ('cube') → all cocktails
  // whose base-spirit shape matches. Combines with familyFilteredNames
  // when both filters are active (intersection — show only family X
  // cocktails that also use spirit Y).
  const spiritFilteredNames = useMemo(() => {
    if (!filterSpirit || !shapeAssignments) return null;
    const targetShape = COCKTAIL_SPIRIT_LEGEND.find((l) => l.category === filterSpirit)?.shape;
    if (!targetShape) return null;
    const names = [];
    for (const [name, shape] of shapeAssignments) {
      if (shape === targetShape) names.push(name);
    }
    return names.length > 0 ? names : null;
  }, [filterSpirit, shapeAssignments]);

  const combinedFilterNames = useMemo(() => {
    if (familyFilteredNames && spiritFilteredNames) {
      const set = new Set(spiritFilteredNames);
      const inter = familyFilteredNames.filter((n) => set.has(n));
      return inter.length > 0 ? inter : null;
    }
    return familyFilteredNames || spiritFilteredNames;
  }, [familyFilteredNames, spiritFilteredNames]);

  const handleNodeClick = useCallback((node) => {
    if (!node) return;
    setSelectedCocktail(node.name);
  }, []);

  // aria-live announcement when matchesContext becomes active.
  const prevMatchesRef = useRef(null);
  const [liveMsg, setLiveMsg] = useState('');
  useEffect(() => {
    if (matchesContext && prevMatchesRef.current === null) {
      setLiveMsg(
        `Showing ${matchesContext.items.length} cocktails matched to ${matchesContext.recipeName}`,
      );
    } else if (!matchesContext) {
      setLiveMsg('');
    }
    prevMatchesRef.current = matchesContext;
  }, [matchesContext]);

  // ── Matches mode — replaces the full browse view entirely ──────────
  // Short-circuit BEFORE loading/error guards: the card list renders
  // purely from matchesContext.items and needs no codex data.
  if (matchesContext !== null) {
    return (
      <div className="absolute inset-0 overflow-y-auto bg-neural-bg text-neural-text">
        {/* aria-live region for screen-reader announcements */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">{liveMsg}</div>

        {/* Header strip */}
        <div className="sticky top-0 z-30 bg-[#12121a]/95 backdrop-blur-md border-b border-[#1e1e2e] px-4 py-3 flex items-center gap-3">
          {/* "Matches for …" header chip — reuses same pill style as
              the spirit/family chips in the browse filter bar */}
          <span className="px-2.5 py-1 rounded-full text-[11px] border bg-cyan-500/20 border-cyan-400/60 text-cyan-200 whitespace-nowrap">
            Matches for {matchesContext.recipeName}
          </span>
          <span className="text-[11px] text-gray-500">{matchesContext.items.length} cocktails</span>
          <div className="flex-1" />
          <button
            type="button"
            aria-label="Exit matches and browse all cocktails"
            onClick={onExitMatches}
            className="px-2.5 py-1 rounded-full text-[11px] border bg-[#12121a] border-[#2a2a3a] text-gray-400 hover:text-gray-200 hover:border-[#3a3a4a] transition-colors whitespace-nowrap"
          >
            Show all cocktails
          </button>
        </div>

        {/* Matched cocktail cards */}
        <div className="px-4 py-4 max-w-4xl mx-auto pb-24">
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {matchesContext.items.map(({ item, similarity, matchedAromas }, idx) => {
              const isSelected = selectedCocktail === item.name;
              return (
                <li key={`${item.name}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedCocktail(item.name)}
                    className={`w-full flex flex-col gap-1.5 px-3 py-2.5 rounded-md text-left text-[12px] transition-colors ${
                      isSelected
                        ? 'bg-cyan-500/15 border border-cyan-400/40 text-white'
                        : 'border border-[#1e1e2e] hover:bg-[#161622] text-gray-200'
                    }`}
                  >
                    {/* Row 1: name + similarity badge */}
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate font-medium">{item.name}</span>
                      <span className="text-[10px] px-1.5 py-px rounded border border-cyan-400/40 text-cyan-300 bg-cyan-500/10 flex-shrink-0">
                        {formatSimilarityBadge(similarity)}
                      </span>
                    </div>
                    {/* Row 2: matched aroma chips */}
                    {matchedAromas.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {matchedAromas.map((aromaKey) => (
                          <span
                            key={aromaKey}
                            className="text-[9px] px-1.5 py-px rounded-full border border-[#2a2a3a] text-gray-400 bg-[#12121a]"
                          >
                            {formatAromaKey(aromaKey)}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Card mode — also available in matches mode */}
        {selectedCocktail && graph && networkData && (
          <LabNodeCard
            kind="cocktail"
            name={selectedNode?.name || selectedCocktail}
            clusterName={familyForSelected?.name}
            clusterColor={familyForSelected?.color || '#9a8f7a'}
            clusterTag={selectedNode?.subcluster_id || familyForSelected?.signature || null}
            details={selectedNode ? [
              { label: 'Glass', value: selectedNode.glass },
              { label: 'Build', value: selectedNode.build_method },
              { label: 'Ice', value: selectedNode.ice_format },
              { label: 'Aeration', value: selectedNode.aeration },
            ] : []}
            ingredients={selectedNode?.ingredients_raw || []}
            prep={selectedNode?.recipe_text || ''}
            likeThis={similarCocktails}
            bridges={crossFamilyCousins}
            onSelect={(name) => setSelectedCocktail(name)}
            onClose={() => setSelectedCocktail(null)}
          />
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neural-bg pt-10">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-2 border-purple-400/30 rounded-full animate-ping" />
            <div className="absolute inset-2 border-2 border-purple-400/50 rounded-full animate-spin" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-[30%] bg-purple-400/80 rounded-full animate-pulse" />
          </div>
          <p className="text-gray-400 text-sm">Loading Cocktail Lab v2…</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-neural-bg pt-10">
        <div className="text-center panel p-6">
          <p className="text-red-400 mb-2">Failed to load v2 cocktail data</p>
          <p className="text-neural-muted text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Explore (3D) ↔ Browse (2D) toggle. Sits just below the
          global nav (top-10) and is the entry point for the new
          selection-friendly view. State is lab-local. */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-40 flex items-center gap-0.5 p-0.5 rounded-lg bg-[#12121a]/95 backdrop-blur-md border border-[#1e1e2e]"
        style={{ top: 'calc(var(--nav-h, 4.5rem) + 0.5rem)' }}
      >
        {[
          { id: 'explore', label: 'Explore (3D)' },
          { id: 'browse',  label: 'Browse (2D)' },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setViewMode(m.id)}
            className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${
              viewMode === m.id
                ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-400/40'
                : 'text-gray-400 hover:text-gray-200 border border-transparent'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {viewMode === 'explore' ? (
        <NetworkScene
          data={networkData}
          onNodeClick={handleNodeClick}
          onNodeHover={() => {}}
          selectedNode={selectedCocktail}
          selectedNodes={selectedCocktail ? [selectedCocktail] : []}
          showEdges={true}
          showParticles={true}
          filterCuisine=""
          filterTaste=""
          profileWeights={null}
          treeFilterIngredients={combinedFilterNames}
          sceneExtras={sceneExtras}
          showNodeLabels={true}
          labelNodeNames={combinedFilterNames}
          flyToTarget={flyToTarget}
          scaleMultiplier={2.5}
          centroidAdapter={familyCentroidAdapter}
          shapeAssignments={shapeAssignments}
          disableClusterTour={true}
        />
      ) : (
        <CocktailBrowse
          graph={graph}
          selectedCocktail={selectedCocktail}
          onSelectCocktail={(name) => setSelectedCocktail(name)}
          filterFamily={filterFamily}
          onFilterFamily={setFilterFamily}
          filterSpirit={filterSpirit}
          onFilterSpirit={setFilterSpirit}
        />
      )}

      {/* Top-of-screen family banner when a family is filtered. Only
          in Explore mode — Browse view shows family context inline. */}
      {viewMode === 'explore' && familyForSelected && selectedCocktail && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-lg bg-[#12121a]/90 backdrop-blur-md border border-[#1e1e2e] text-xs text-gray-300 select-none">
          <span className="font-medium" style={{ color: familyForSelected.color }}>
            {familyForSelected.name}
          </span>
          <span className="text-gray-500 mx-2">·</span>
          <span>Root: <span className="text-white">{familyForSelected.cultural_root}</span></span>
          <span className="text-gray-500 mx-2">·</span>
          <span>Sub-cluster: {selectedNode?.subcluster_id || '?'}</span>
        </div>
      )}

      {selectedCocktail && (
        <LabNodeCard
          kind="cocktail"
          name={selectedNode?.name || selectedCocktail}
          clusterName={familyForSelected?.name}
          clusterColor={familyForSelected?.color || '#9a8f7a'}
          clusterTag={selectedNode?.subcluster_id || familyForSelected?.signature || null}
          details={selectedNode ? [
            { label: 'Glass', value: selectedNode.glass },
            { label: 'Build', value: selectedNode.build_method },
            { label: 'Ice', value: selectedNode.ice_format },
            { label: 'Aeration', value: selectedNode.aeration },
          ] : []}
          ingredients={selectedNode?.ingredients_raw || []}
          prep={selectedNode?.recipe_text || ''}
          likeThis={similarCocktails}
          bridges={crossFamilyCousins}
          onSelect={(name) => setSelectedCocktail(name)}
          onClose={() => setSelectedCocktail(null)}
        />
      )}

      {/* Card mode (LabNodeCard) is a full-screen overlay with its own
          Back button, so the floating Clear-Selection button is gone. */}

      {/* ClusterJoystick + ShapeLegend are 3D-scene affordances — the
          Browse view has its own family bubbles and spirit chips, so
          we hide both overlays in Browse mode to avoid duplicate UI. */}
      {viewMode === 'explore' && (
        <ClusterJoystick
          clusters={graph.families.map((f) => ({ id: f.id, name: f.name, color: f.color }))}
          mode="ml"
          focusedClusterId={filterFamily}
          onClusterFocus={(id) => setFilterFamily(id)}
          onFlyTo={(family) => {
            const pos = familyCentroids?.get(family.id);
            if (!pos) return;
            setFlyToTarget({
              position: pos,
              memberCount: familyMemberCount?.get(family.id) || 1,
              ts: Date.now(),
            });
          }}
        />
      )}

      {viewMode === 'explore' && (
        <ShapeLegend
          title="Base spirit shapes"
          legend={COCKTAIL_SPIRIT_LEGEND}
          selectedKey={filterSpirit}
          onSelect={setFilterSpirit}
        />
      )}
    </>
  );
}

// Strip the "odor_" prefix and capitalize the first letter for display.
// e.g. "odor_fruity" → "Fruity", "fruity" → "Fruity"
function formatAromaKey(key) {
  const stripped = (key || '').replace(/^odor_/, '');
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

function canonicalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['''`]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Shift the lightness of a hex color by ±N percentage points so each
// sub-cluster within a family reads as a distinct ring (visually) without
// breaking the family hue identity. Positive = lighter, negative = darker.
function shiftColorLightness(hex, deltaPct) {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l0 = (max + min) / 2;
  const d = max - min;
  let s = 0;
  let h = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l0 - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = Math.max(0, Math.min(100, l0 * 100 + deltaPct)) / 100;
  // HSL → RGB
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0, gp = 0, bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  const to2 = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${to2(rp)}${to2(gp)}${to2(bp)}`;
}
