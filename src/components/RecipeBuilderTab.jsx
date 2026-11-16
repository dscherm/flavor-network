/**
 * RecipeBuilderTab — the Recipe Notebook tab (and Make a recipe's "Invent a recipe") is the chalkboard
 * recipe builder, InventRecipe. This is its one host.
 *
 * One instance, kept alive: App mounts this once and hides it with CSS when another tab is active, so a
 * build in progress survives switching tabs, opening the cocktail / sauce / wine matches and coming back.
 * A new `handoff` (any way into the Notebook: the Network panel, Profile, a Cocktail or Sauce card, the
 * Pairing Lab, Make a recipe, a link import, an invention) re-keys the builder on the handoff's `ts`, which
 * starts it on that recipe; with no handoff it opens at its first question and keeps what the cook left.
 *
 * Saving goes through saveInvention (amounts, picture, share), the same path the other builders use.
 * A recipe the old Notebook saved with names only is reopened with `replaces`, so saving replaces it by name.
 *
 * Props
 *   active       is this tab showing (re-reads the kitchen from the device when it becomes active)
 *   handoff      App's recipeHandoff { ts, ingredients, title, steps, stepsFrom, image, type, cuisine, editId, replaces, seed }
 *   nodes, edges the ingredient graph and pairing edges (the builder waits for them)
 *   userProfile  the profile hook (saveInvention); absent = no save row
 *   onFindCocktail, onFindSauce, onFindWine   App's aroma-match handlers, (names, title); they return to this tab
 *   onBack       Back button; onEditKitchen   opens My kitchen
 */
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import useAuth from '../hooks/useAuth.js';
import useSaveInvention from '../hooks/useSaveInvention.js';
import InventSaveOverlay from './InventSaveOverlay.jsx';
import { ChalkLoader } from './chalkArt.jsx';
import { chalkSurfaceStyle } from '../data/chalkTheme.js';
import { loadKitchen } from '../data/myKitchen.js';
import { seedFromHandoff } from '../data/inventRecipe.js';

const InventRecipe = lazy(() => import('./InventRecipe.jsx'));

export default function RecipeBuilderTab({
  active = true, handoff = null, nodes = null, edges = null, userProfile = null,
  onFindCocktail = null, onFindSauce = null, onFindWine = null, onBack, onEditKitchen,
}) {
  const [kitchen, setKitchen] = useState(() => loadKitchen());
  useEffect(() => { if (active) setKitchen(loadKitchen()); }, [active]);

  const { user, authError, loginWithGoogle, loginWithApple } = useAuth();
  const saveAuth = { user, authError, loginWithGoogle, loginWithApple };
  const save = useSaveInvention({ kind: 'recipe', userProfile, auth: saveAuth });

  const seed = useMemo(() => seedFromHandoff(handoff), [handoff]);

  return (
    <div data-testid="recipe-builder-tab">
      {nodes ? (
        <Suspense fallback={(
          <div className="fixed inset-x-0 top-0 z-[83]" style={{ bottom: 'var(--tab-bar-h)', ...chalkSurfaceStyle() }}>
            <ChalkLoader label="Opening the recipe builder…" color="#a3e635" />
          </div>
        )}>
          <InventRecipe
            key={handoff?.ts ?? 'none'}
            seed={seed}
            kitchen={kitchen}
            nodes={nodes}
            edges={edges}
            onFindCocktail={onFindCocktail}
            onFindSauce={onFindSauce}
            onFindWine={onFindWine}
            onEditKitchen={onEditKitchen}
            onSave={save.onSave}
            onClose={() => { save.cancelPending(); onBack?.(); }}
          />
        </Suspense>
      ) : (
        <div className="fixed inset-x-0 top-0 z-[83]" style={{ bottom: 'var(--tab-bar-h)', ...chalkSurfaceStyle() }}>
          <ChalkLoader label="Loading the ingredients…" color="#a3e635" />
        </div>
      )}
      <InventSaveOverlay save={save} auth={saveAuth} />
    </div>
  );
}
