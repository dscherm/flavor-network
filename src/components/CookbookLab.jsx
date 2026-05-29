/**
 * CookbookLab — Phase 4 + F-6 (pipeline 2026-05-16).
 *
 * Renamed from RecipesLab 2026-05-29 (DOCS-RL-COOKBOOK-RENAME) to
 * disambiguate from Recipes Notebook (the authoring surface in
 * RecipeLabMobile). The shipped behavior is unchanged — just the
 * file/export/labKey/URL identity is the new canonical name.
 *
 * Two-mode browseable surface for the 15 hand-curated seed recipes:
 *   - Explore (default): 3D NetworkScene with one sphere per recipe,
 *     anchored by `position3D` on cuisine-quadrant directions. Colors
 *     are keyed by cuisine via CUISINE_COLOR. Mirrors the Cocktail
 *     and Sauce labs.
 *   - Browse: filterable card grid (v1).
 *
 * Filters: cuisine / cluster / single-ingredient search box.
 * `externalFilter` prop (from Phase 5 Build → Recipes bridge)
 * pre-selects filters on mount.
 */
import { useEffect, useMemo, useState } from 'react';
import NetworkScene from './NetworkScene.jsx';
import MultiAxisRadarStack from './MultiAxisRadarStack.jsx';
import { SEED_RECIPES, CUISINE_COLOR, buildRecipesScene } from '../data/seedRecipes.js';

function RecipeCard({ recipe, onClick }) {
  const color = CUISINE_COLOR[recipe.cuisine] || '#94a3b8';
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col items-stretch text-left rounded-xl border border-[#1d3158] bg-[#12203b] p-4 transition-all hover:border-cyan-400/60 hover:bg-[#16284a] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
    >
      <span
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ background: color }}
        aria-hidden="true"
      />
      <div className="pl-2">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-base font-semibold text-white leading-tight">{recipe.name}</h3>
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap"
            style={{ color, borderColor: `${color}88`, background: `${color}22` }}
          >
            {recipe.cuisine}
          </span>
        </div>
        <p className="text-xs text-[#9bb6da] leading-snug mb-2">{recipe.description}</p>
        <div className="flex flex-wrap gap-1">
          {recipe.ingredients.slice(0, 5).map((ing) => (
            <span
              key={ing}
              className="text-[10px] px-1.5 py-0.5 rounded bg-[#0a1428] text-gray-400 border border-[#1d3158]/60"
            >
              {ing}
            </span>
          ))}
          {recipe.ingredients.length > 5 && (
            <span className="text-[10px] text-gray-500">+{recipe.ingredients.length - 5} more</span>
          )}
        </div>
      </div>
    </button>
  );
}

function RecipeDetail({ recipe, ctx, onClose, onOpenInNetwork, onOpenRecipeLab }) {
  const color = CUISINE_COLOR[recipe.cuisine] || '#94a3b8';
  const nodes = ctx?.graph?.nodes;
  // Match recipe ingredient strings to actual nodes in the ingredient
  // graph so the radar has real taste/aroma/season/etc. data to plot.
  // Only ingredients that resolve get a chip in the "matched" row;
  // unmatched ones fall to the "raw" row so the user still sees them.
  const { matched, unmatched } = useMemo(() => {
    if (!nodes) return { matched: [], unmatched: recipe.ingredients };
    const ok = [];
    const miss = [];
    for (const ing of recipe.ingredients) {
      const key = ing.toLowerCase();
      if (nodes.get(key) || nodes.get(ing)) ok.push(ing);
      else miss.push(ing);
    }
    return { matched: ok, unmatched: miss };
  }, [recipe.ingredients, nodes]);

  // Focal = first matched ingredient. The radar averages across all
  // matched ingredients so the chart reflects the whole recipe.
  const focalName = matched[0] || null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-label={`${recipe.name} details`}
    >
      <div
        className="w-full max-w-2xl rounded-xl border bg-[#0d1f38] shadow-2xl max-h-[85vh] overflow-y-auto"
        style={{ borderColor: `${color}66` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b border-[#1d3158]">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">{recipe.name}</h2>
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full border inline-block"
              style={{ color, borderColor: `${color}88`, background: `${color}22` }}
            >
              {recipe.cuisine}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-200 text-xl leading-none p-1"
          >
            ×
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-[#bfd5f0] leading-relaxed">{recipe.description}</p>

          <div>
            <h3 className="text-[11px] uppercase tracking-widest text-gray-500 mb-2">
              Ingredients ({recipe.ingredients.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {matched.map((ing) => (
                <span
                  key={ing}
                  className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-100 border border-emerald-400/30"
                  title="matched in the ingredient graph"
                >
                  {ing}
                </span>
              ))}
              {unmatched.map((ing) => (
                <span
                  key={ing}
                  className="text-xs px-2 py-1 rounded-full bg-[#12203b] text-gray-400 border border-[#1d3158]"
                  title="not found in the ingredient graph"
                >
                  {ing}
                </span>
              ))}
            </div>
          </div>

          {/* Flavor / taste / aroma / season / cuisine / method radar.
              Averaged across all matched ingredients so the chart
              reads as the recipe's profile, not just one ingredient. */}
          {focalName && nodes ? (
            <div>
              <h3 className="text-[11px] uppercase tracking-widest text-gray-500 mb-2">
                Flavor profile
              </h3>
              <MultiAxisRadarStack
                ingredients={matched}
                nodes={nodes}
                focalName={focalName}
              />
            </div>
          ) : (
            <p className="text-[11px] text-gray-500 italic">
              No matched ingredients — radar unavailable.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            {onOpenRecipeLab && (
              <button
                type="button"
                onClick={() => onOpenRecipeLab('recipe', recipe.ingredients)}
                className="px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium border border-emerald-300 transition-colors"
              >
                Open in Recipe Notebook →
              </button>
            )}
            {onOpenInNetwork && (
              <button
                type="button"
                onClick={() => onOpenInNetwork(matched[0] || recipe.ingredients[0])}
                className="px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white font-medium border border-cyan-300 transition-colors"
              >
                Explore in Network →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Default flavor-axis filter. The "cluster" field on each recipe IS
// the flavor signal (savory / baking / seafood / vegetable). Spec §4A
// asked for a default flavor filter so the lab opens with a focused
// view, not an undifferentiated grid. "savory" wins by recipe count.
const DEFAULT_CLUSTER_FILTER = 'savory';

export default function CookbookLab({
  externalFilter = null,
  onOpenInNetwork,
  // Recipe-notebook handoff — same callback shape as CocktailLabV2 /
  // SauceLab so App.jsx can wire all three through one handler.
  onOpenRecipeLab,
  // ctx = useProData result. Provides graph.nodes so the detail
  // panel can render real radar charts from the recipe's ingredients.
  ctx = null,
}) {
  const [cuisineFilter, setCuisineFilter] = useState(null);
  const [clusterFilter, setClusterFilter] = useState(DEFAULT_CLUSTER_FILTER);
  const [selected, setSelected] = useState(null);
  // 'explore' = 3D NetworkScene; 'browse' = 2D card grid.
  const [viewMode, setViewMode] = useState('explore');
  // Camera fly-to target for the 3D scene. Stamped with ts so
  // re-clicking the same recipe re-triggers the fly-in.
  const [flyToTarget, setFlyToTarget] = useState(null);

  // Apply external filter on mount (Phase 5 Build → Recipes bridge).
  // When the user arrived via Build, their explicit cuisine pick is a
  // stronger signal than the default flavor filter — clear the
  // cluster default so their cuisine pick isn't intersected with it.
  useEffect(() => {
    if (!externalFilter) return;
    if (externalFilter.cuisine) {
      setCuisineFilter(externalFilter.cuisine);
      setClusterFilter(null);
    }
    if (externalFilter.cluster) setClusterFilter(externalFilter.cluster);
  }, [externalFilter]);

  const cuisines = useMemo(
    () => [...new Set(SEED_RECIPES.map((r) => r.cuisine))].sort(),
    [],
  );
  const clusters = useMemo(
    () => [...new Set(SEED_RECIPES.map((r) => r.cluster))].sort(),
    [],
  );

  const filtered = useMemo(
    () =>
      SEED_RECIPES.filter((r) => {
        if (cuisineFilter && r.cuisine !== cuisineFilter) return false;
        if (clusterFilter && r.cluster !== clusterFilter) return false;
        if (externalFilter?.ingredients?.length) {
          const reqs = externalFilter.ingredients.map((s) => s.toLowerCase());
          const has = r.ingredients.map((s) => s.toLowerCase());
          if (!reqs.every((req) => has.some((h) => h.includes(req) || req.includes(h)))) return false;
        }
        return true;
      }),
    [cuisineFilter, clusterFilter, externalFilter],
  );

  // 3D scene contract — built once, name-keyed. Filters are applied as
  // a name-allow-list so the scene dims non-matching nodes instead of
  // re-laying-out the geometry.
  const sceneData = useMemo(() => buildRecipesScene(), []);
  const filteredNames = useMemo(
    () => filtered.map((r) => r.name),
    [filtered],
  );

  return (
    <div
      className="flex flex-col items-center w-full min-h-screen px-4 pt-6 pb-12"
      style={{ backgroundColor: '#0d1f38' }}
      data-testid="recipes-lab"
    >
      <div className="w-full max-w-5xl">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl sm:text-3xl text-white font-bold flex-1 text-center">
            Recipes
          </h1>
          {/* View toggle (3D / grid) — pinned right of the title. */}
          <div className="inline-flex rounded-full border border-[#1d3158] overflow-hidden text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode('explore')}
              className={`px-3 py-1 transition-colors ${
                viewMode === 'explore'
                  ? 'bg-cyan-500/20 text-cyan-200'
                  : 'bg-[#0a1428] text-gray-400 hover:bg-[#16284a]'
              }`}
            >
              3D
            </button>
            <button
              type="button"
              onClick={() => setViewMode('browse')}
              className={`px-3 py-1 transition-colors ${
                viewMode === 'browse'
                  ? 'bg-cyan-500/20 text-cyan-200'
                  : 'bg-[#0a1428] text-gray-400 hover:bg-[#16284a]'
              }`}
            >
              Grid
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-gray-500 mb-6">
          15 hand-curated dishes spanning 6 culinary traditions
        </p>

        {/* Filter pills */}
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">Cuisine:</span>
            <div className="inline-flex flex-wrap gap-1.5">
              <button
                onClick={() => setCuisineFilter(null)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  !cuisineFilter
                    ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40'
                    : 'bg-[#0a1428] text-gray-400 border-[#1d3158] hover:bg-[#16284a]'
                }`}
              >
                All
              </button>
              {cuisines.map((c) => {
                const active = cuisineFilter === c;
                const color = CUISINE_COLOR[c] || '#94a3b8';
                return (
                  <button
                    key={c}
                    onClick={() => setCuisineFilter(active ? null : c)}
                    className="px-3 py-1 text-xs rounded-full border transition-colors"
                    style={{
                      background: active ? `${color}33` : 'rgba(10, 20, 40, 1)',
                      borderColor: active ? color : '#1d3158',
                      color: active ? '#fff' : '#9ca3af',
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">Type:</span>
            <div className="inline-flex flex-wrap gap-1.5">
              <button
                onClick={() => setClusterFilter(null)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  !clusterFilter
                    ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40'
                    : 'bg-[#0a1428] text-gray-400 border-[#1d3158] hover:bg-[#16284a]'
                }`}
              >
                All
              </button>
              {clusters.map((c) => {
                const active = clusterFilter === c;
                return (
                  <button
                    key={c}
                    onClick={() => setClusterFilter(active ? null : c)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors capitalize ${
                      active
                        ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                        : 'bg-[#0a1428] text-gray-400 border-[#1d3158] hover:bg-[#16284a]'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {viewMode === 'explore' ? (
          <div
            className="relative w-full rounded-xl border border-[#1d3158] overflow-hidden bg-[#05080f]"
            style={{ height: 'min(72vh, 640px)' }}
          >
            <NetworkScene
              data={sceneData}
              onNodeClick={(node) => {
                // NetworkScene passes the full node object (not just
                // the name string). Resolve back to the seed recipe by
                // node.name → recipe.name.
                if (!node) return;
                const r = SEED_RECIPES.find((x) => x.name === node.name);
                if (r) {
                  setSelected(r);
                  // Camera fly-to the picked cookbook. Distance is
                  // explicit (8 units from the node) because the 15-
                  // recipe cloud spans only ~22 units across — the
                  // default 30-unit floor would put the camera past
                  // the far edge of the scene.
                  setFlyToTarget({
                    position: r.position3D,
                    distance: 8,
                    ts: Date.now(),
                  });
                }
              }}
              onNodeHover={() => {}}
              selectedNode={selected?.name || null}
              selectedNodes={selected ? [selected.name] : []}
              showEdges={false}
              showParticles={false}
              filterCuisine=""
              filterTaste=""
              profileWeights={null}
              treeFilterIngredients={filteredNames}
              showNodeLabels={true}
              labelNodeNames={filteredNames}
              scaleMultiplier={2.5}
              shapeAssignments={sceneData.shapeAssignments}
              flyToTarget={flyToTarget}
            />
            {filtered.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-sm text-gray-400 bg-[#0a1428]/80 px-3 py-2 rounded">
                  No recipes match your filters.
                </p>
              </div>
            )}
          </div>
        ) : (
          filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-12">
              No recipes match your filters.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((r) => (
                <RecipeCard key={r.id} recipe={r} onClick={() => setSelected(r)} />
              ))}
            </div>
          )
        )}

        <p className="text-center text-[10px] text-gray-600 mt-3">
          {viewMode === 'explore'
            ? 'Tap a sphere for the full recipe. Drag to orbit, scroll to zoom.'
            : 'Tap a card for the full recipe.'}
        </p>
      </div>

      {selected && (
        <RecipeDetail
          recipe={selected}
          ctx={ctx}
          onClose={() => setSelected(null)}
          onOpenInNetwork={onOpenInNetwork}
          onOpenRecipeLab={onOpenRecipeLab}
        />
      )}
    </div>
  );
}
