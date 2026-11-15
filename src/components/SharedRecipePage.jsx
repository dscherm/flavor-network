/**
 * SharedRecipePage — the public page behind /r/<kind>/<slug>. Opens signed out,
 * without the landing picker and without the pairing dataset: it loads only the
 * recipe's own source file and the per-ingredient flavor values.
 *
 * Props
 *   route      { kind, slug } | { id }   from parseSharePath. { id } (a user's published copy) is
 *                                        not resolvable yet and shows "no longer shared".
 *   loadData   (kind) => Promise<{ cocktails?, families?, sauces?, dishes?, dishDetails? }>
 *   loadNodes  () => Promise<Map name → { gnnProbs }|null>; a failure drops the chart, nothing else.
 *   actions    optional node rendered in the actions area (SHARE-2/3 put their buttons here).
 *   onHome     optional; default is a plain link to "/".
 * Test ids: shared-page, shared-header, shared-name, shared-line, shared-method, shared-glass,
 *   shared-actions, shared-gone, shared-home, shared-loading.
 */
import { useEffect, useMemo, useState } from 'react';
import InventFlavorProfile from './InventFlavorProfile.jsx';
import { ShareButton } from './ShareSheet.jsx';
import { resolveBuiltIn } from '../data/sharedRecipe.js';
import { buildFlavorProfile } from '../data/inventProfile.js';
import { resolveIngredientName } from '../data/recipePairingMatch.js';
import { chalkSurfaceStyle } from '../data/chalkTheme.js';
import { FONT, SANS, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, ACCENT, btn, heading, small } from './inventUi.jsx';

const KIND_NOUN = { cocktail: 'drink', sauce: 'sauce', dish: 'dish' };
const KIND_WORD = { cocktail: 'Cocktail', sauce: 'Sauce', dish: 'Dish' };

export async function defaultLoadData(kind) {
  if (kind === 'cocktail') {
    const res = await fetch('/data/cocktail_codex_v2.json');
    if (!res.ok) throw new Error(`cocktail data ${res.status}`);
    const raw = await res.json();
    return { cocktails: raw.cocktails || [], families: raw.families || [] };
  }
  if (kind === 'sauce') {
    const res = await fetch('/data/sauce_augment.json');
    if (!res.ok) throw new Error(`sauce data ${res.status}`);
    const raw = await res.json();
    return { sauces: raw.sauces || [] };
  }
  if (kind === 'dish') {
    const [{ SEED_RECIPES }, { RECIPE_DETAILS }] = await Promise.all([
      import('../data/seedRecipes.js'),
      import('../data/seedRecipeDetails.js'),
    ]);
    return { dishes: SEED_RECIPES, dishDetails: RECIPE_DETAILS };
  }
  return {};
}

export async function defaultLoadNodes() {
  const res = await fetch('/proDataset/gnn_entropy.json');
  if (!res.ok) throw new Error(`flavor data ${res.status}`);
  const raw = await res.json();
  const nodes = new Map();
  for (const [name, info] of Object.entries(raw)) {
    if (name.startsWith('_') || !info?.probs) continue;
    nodes.set(name, { gnnProbs: info.probs });
  }
  return nodes;
}

function Gone({ onHome }) {
  const homeProps = onHome ? { onClick: onHome, href: '/' } : { href: '/' };
  return (
    <div data-testid="shared-gone" className="text-center py-10">
      <p style={{ ...heading, fontSize: 28 }}>This recipe is no longer shared</p>
      <p className="mt-2 text-[15px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>
        The link may have been removed or mistyped.
      </p>
      <a {...homeProps} data-testid="shared-home" className="mt-5 inline-flex items-center justify-center px-5 rounded-lg min-h-[44px]"
        style={btn({ textDecoration: 'none', background: `${ACCENT}22` })}>
        Go to the starting page
      </a>
    </div>
  );
}

export default function SharedRecipePage({ route, loadData = defaultLoadData, loadNodes = defaultLoadNodes, actions = null, onHome = null }) {
  const [state, setState] = useState({ status: 'loading', recipe: null });
  const [nodes, setNodes] = useState(null);
  const kind = route?.kind;
  const slug = route?.slug;

  useEffect(() => {
    let live = true;
    if (!kind || !slug) { setState({ status: 'gone', recipe: null }); return undefined; }
    setState({ status: 'loading', recipe: null });
    Promise.resolve()
      .then(() => loadData(kind))
      .then((data) => {
        if (!live) return;
        const recipe = resolveBuiltIn(kind, slug, data);
        setState(recipe ? { status: 'ready', recipe } : { status: 'gone', recipe: null });
      })
      .catch(() => { if (live) setState({ status: 'gone', recipe: null }); });
    return () => { live = false; };
  }, [kind, slug, loadData]);

  const ready = state.status === 'ready';
  useEffect(() => {
    if (!ready) return undefined;
    let live = true;
    Promise.resolve()
      .then(() => loadNodes())
      .then((n) => { if (live) setNodes(n instanceof Map ? n : null); })
      .catch(() => { if (live) setNodes(null); });
    return () => { live = false; };
  }, [ready, loadNodes]);

  const recipe = state.recipe;
  const profile = useMemo(() => {
    if (!recipe || !nodes) return null;
    const names = new Set(nodes.keys());
    const keys = recipe.lines.map((l) => resolveIngredientName(l.label || l.key, names) || l.key);
    return buildFlavorProfile(keys, nodes, { noun: KIND_NOUN[recipe.kind] || 'recipe' });
  }, [recipe, nodes]);

  const steps = recipe?.method ? recipe.method.split('\n').map((s) => s.trim()).filter(Boolean) : [];

  return (
    <div data-testid="shared-page" className="fixed inset-0 overflow-y-auto overflow-x-hidden" style={{ ...chalkSurfaceStyle(), color: CHALK_CREAM }}>
      <header data-testid="shared-header" className="px-4 pt-3 pb-2 flex items-center" style={{ borderBottom: `1px solid ${CHALK_RAIL}` }}>
        <a href="/" onClick={onHome || undefined} className="inline-flex items-center min-h-[44px]" style={{ fontFamily: FONT, fontSize: 26, color: CHALK_CREAM, textDecoration: 'none' }}>
          Neural Flavor
        </a>
      </header>
      <main className="px-4 py-5 mx-auto w-full min-w-0" style={{ maxWidth: 560, paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
        {state.status === 'loading' && (
          <p data-testid="shared-loading" className="text-center py-10" style={{ fontFamily: SANS, color: CHALK_DIM }}>Loading the recipe...</p>
        )}
        {state.status === 'gone' && <Gone onHome={onHome} />}
        {ready && recipe && (
          <article className="min-w-0">
            <p className="text-[13px] uppercase tracking-wide" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid="shared-kind">
              {KIND_WORD[recipe.kind]}{recipe.category ? ` · ${recipe.category}` : ''}
            </p>
            <h1 data-testid="shared-name" className="break-words" style={{ fontFamily: FONT, fontSize: 40, lineHeight: 1.1, color: CHALK_CREAM }}>{recipe.name}</h1>
            {recipe.meta ? <p className="mt-1 text-[14px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>{recipe.meta}</p> : null}
            {recipe.glass ? (
              <p className="mt-1 text-[14px]" style={{ fontFamily: SANS, color: CHALK_DIM }} data-testid="shared-glass">Glass: {recipe.glass}</p>
            ) : null}

            <section className="mt-5" aria-label="Ingredients">
              <h2 style={heading}>Ingredients</h2>
              <ul className="mt-1 flex flex-col" role="list">
                {recipe.lines.map((l, i) => (
                  <li key={`${l.key}-${i}`} data-testid="shared-line" className="flex gap-3 py-1.5 min-w-0" style={{ borderBottom: `1px dashed ${CHALK_RAIL}`, fontFamily: SANS, fontSize: 16 }}>
                    <span className="w-24 flex-shrink-0 text-right" style={{ color: l.suggested ? CHALK_SUB : ACCENT }}>{l.amount || ''}</span>
                    <span className="min-w-0 break-words" style={{ color: CHALK_CREAM }}>{l.label || l.key}</span>
                  </li>
                ))}
              </ul>
              {recipe.lines.some((l) => l.suggested) && (
                <p className="mt-1" style={small}>Amounts with ~ are typical for this kind of drink; the source gives none.</p>
              )}
              {recipe.garnish ? <p className="mt-2 text-[14px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>Garnish: {recipe.garnish}</p> : null}
            </section>

            {steps.length > 0 && (
              <section className="mt-5" aria-label="Method">
                <h2 style={heading}>Method</h2>
                {steps.length === 1
                  ? <p data-testid="shared-method" className="mt-1 text-[16px]" style={{ fontFamily: SANS, color: CHALK_CREAM }}>{steps[0]}</p>
                  : (
                    <ol data-testid="shared-method" className="mt-1 flex flex-col gap-2 list-decimal pl-5" style={{ fontFamily: SANS, fontSize: 16, color: CHALK_CREAM }}>
                      {steps.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                  )}
              </section>
            )}

            {profile && (
              <section className="mt-6" aria-label="Flavor profile">
                <InventFlavorProfile profile={profile} title="Flavor profile (visual guide)" testidPrefix="shared-profile" />
              </section>
            )}

            <section data-testid="shared-actions" aria-label="Actions" className="mt-6 flex flex-wrap gap-2 empty:hidden">
              <ShareButton recipe={recipe} link={`/r/${recipe.kind}/${recipe.slug}`} />
              {actions}
            </section>
          </article>
        )}
      </main>
    </div>
  );
}
