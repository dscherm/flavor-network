/**
 * SharedRecipePage — the public page behind /r/<kind>/<slug>. Opens signed out,
 * without the landing picker and without the pairing dataset: it loads only the
 * recipe's own source file and the per-ingredient flavor values.
 *
 * Props
 *   route      { kind, slug } | { id }   from parseSharePath. { id } is a user's published copy (shared/{id}),
 *                                        read through loadShared; missing or removed shows "no longer shared".
 *   loadData   (kind) => Promise<{ cocktails?, families?, sauces?, dishes?, dishDetails? }>
 *   loadShared (id) => Promise<document|null>; default reads shared/{id} from Firestore (loaded only for an id route)
 *   loadNodes  () => Promise<Map name → { gnnProbs }|null>; a failure drops the chart, nothing else.
 *   sendReport (report) => Promise; default writes shareReports in Firestore. Tests pass a mock.
 *   actions    optional node rendered in the actions area after the built-in buttons.
 *   onHome     optional; default is a plain link to "/".
 *   navigate   (url) => void; "Make it your own" goes through it (default: window.location.assign).
 * The page sits outside <App/>, so RecipeActions uses useAuth / useUserProfile itself.
 * Test ids: shared-page, shared-header, shared-name, shared-line, shared-method, shared-glass,
 *   shared-by, shared-report-slot (holds the Report link, ShareReport.jsx; only on a user's copy),
 *   shared-actions, shared-gone, shared-home, shared-loading, shared-save, shared-own,
 *   shared-save-note, shared-invite, shared-invite-button.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import InventFlavorProfile from './InventFlavorProfile.jsx';
import InventSaveOverlay from './InventSaveOverlay.jsx';
import { ShareButton } from './ShareSheet.jsx';
import ShareImages from './ShareImages.jsx';
import ShareReport from './ShareReport.jsx';
import useAuth from '../hooks/useAuth.js';
import useUserProfile from '../hooks/useUserProfile.js';
import useSaveInvention from '../hooks/useSaveInvention.js';
import {
  alreadySaved, profileListFor, saveLabel, savedKindFor, savedNoun, sharedFromFor, sharedSaveInput,
} from '../data/sharedSave.js';
import { clearPendingSave, LAB_PATH, readPendingSave, setPendingSave, stashInventSeed } from '../data/sharedHandoff.js';
import { resolveBuiltIn } from '../data/sharedRecipe.js';
import { fromSharedDoc } from '../data/sharePublish.js';
import { defaultLoadData, defaultLoadNodes } from '../data/sharedLoaders.js';
import { buildFlavorProfile } from '../data/inventProfile.js';
import { resolveIngredientName } from '../data/recipePairingMatch.js';
import { SHARE_CHARTS_ENABLED } from '../data/shareTargets.js';
import { chalkSurfaceStyle } from '../data/chalkTheme.js';
import { FONT, SANS, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, ACCENT, btn, heading, small } from './inventUi.jsx';

const KIND_NOUN = { cocktail: 'drink', sauce: 'sauce', dish: 'dish' };
const KIND_WORD = { cocktail: 'Cocktail', sauce: 'Sauce', dish: 'Dish' };

export { defaultLoadData, defaultLoadNodes };

const SAVE_WHY = { title: 'Create a free account to keep this recipe', body: 'Your account keeps what you save and shows it on every device. This recipe is saved the moment you are in.' };
const INVITE_WHY = { title: 'Create a free account', body: 'Save recipes, and build your own drinks, sauces and dishes from what pairs well. It is free.' };
const tap = { minHeight: 44 };

/**
 * Save, Make it your own, Share, and (signed out) the invitation. Mounted only once the
 * recipe is on screen. A Save asked for while signed out waits in the sign-in prompt and
 * completes by itself when the account arrives: in this page (popup sign-in) or, after the
 * redirect sign-in reloads it, from the pending-save marker in sessionStorage.
 */
function RecipeActions({ recipe, nodes, navigate }) {
  const auth = useAuth();
  const userProfile = useUserProfile(auth.user);
  const save = useSaveInvention({ kind: savedKindFor(recipe.kind), userProfile, auth });
  const sharedFrom = sharedFromFor(recipe);
  const shareLink = recipe.shareId ? `/r/${recipe.shareId}` : `/r/${recipe.kind}/${recipe.slug}`;
  const noun = savedNoun(recipe.kind);
  const saved = !!auth.user && alreadySaved(profileListFor(userProfile.profile, recipe.kind), sharedFrom);
  const [note, setNote] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [restored] = useState(() => {
    const p = readPendingSave();
    return p && p.kind === recipe.kind && p.slug === recipe.slug ? p : null;
  });
  const restoredDone = useRef(false);

  const report = (res) => {
    if (res.status === 'saved') { setJustSaved(true); setNote({ status: 'saved', message: res.message }); }
    else if (res.status === 'error') setNote({ status: 'error', message: res.message });
  };

  // Back from the redirect sign-in with a Save waiting: finish it once, without another tap.
  // Signed out once auth has settled means the sign-in did not complete: drop the marker.
  useEffect(() => {
    if (!restored || restoredDone.current || auth.loading) return;
    restoredDone.current = true;
    clearPendingSave();
    if (!auth.user) return;
    const input = sharedSaveInput(recipe);
    if (!input) return;
    if (alreadySaved(profileListFor(userProfile.profile, recipe.kind), sharedFrom)) {
      setNote({ status: 'info', message: `Already in your ${noun}` });
      return;
    }
    Promise.resolve(save.onSave(input)).then(report);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, auth.loading, auth.user]);

  // Signed in (popup path: the hook saves the queued copy itself): the marker and any open prompt are done.
  useEffect(() => {
    if (!auth.user) return;
    setInviteOpen(false);
    if (!restored) clearPendingSave();
  }, [auth.user, restored]);

  // A failed sign-in clears the marker; the prompt stays so the error shows and the cook can retry.
  useEffect(() => { if (auth.authError) clearPendingSave(); }, [auth.authError]);

  useEffect(() => { if (save.toast?.status === 'saved') setJustSaved(true); }, [save.toast]);

  const onSave = async () => {
    setNote(null);
    if (auth.user && saved) { setNote({ status: 'info', message: `Already in your ${noun}` }); return; }
    const input = sharedSaveInput(recipe);
    if (!input) return;
    report(await save.onSave(input));
  };

  const startSignIn = (login) => async () => {
    if (save.pending) setPendingSave({ kind: recipe.kind, slug: recipe.slug });
    const ok = await login?.();
    if (ok === false) clearPendingSave();
  };
  const overlayAuth = { ...auth, loginWithGoogle: startSignIn(auth.loginWithGoogle), loginWithApple: startSignIn(auth.loginWithApple) };
  const cancel = () => { save.cancelPending(); clearPendingSave(); setInviteOpen(false); };
  const overlaySave = { ...save, pending: save.pending || (inviteOpen ? {} : null), cancelPending: cancel };

  const makeOwn = async () => {
    setNote(null);
    const { inventSeedForShared } = await import('../data/sharedSeed.js');
    const res = inventSeedForShared(recipe);
    if (!res || !stashInventSeed(res.lab, res.seed)) { setNote({ status: 'error', message: 'Could not open this in the editor. Try again.' }); return; }
    navigate(`/?path=${LAB_PATH[res.lab]}`);
  };

  const saveText = saved ? (justSaved ? 'Saved' : `Already in your ${noun}`) : saveLabel(recipe.kind);
  return (
    <>
      <button type="button" onClick={onSave} data-testid="shared-save" data-saved={saved ? 'true' : 'false'}
        className="inline-flex items-center justify-center rounded-lg px-4"
        style={{ ...btn({ background: `${ACCENT}55`, borderColor: ACCENT }), ...tap }}>
        {saveText}
      </button>
      <button type="button" onClick={makeOwn} data-testid="shared-own"
        className="inline-flex items-center justify-center rounded-lg px-4" style={{ ...btn({ background: `${ACCENT}22` }), ...tap }}>
        Make it your own
      </button>
      <ShareButton recipe={recipe} link={shareLink}
        imagesSlot={<ShareImages link={shareLink} recipe={recipe} nodes={nodes} />} />
      {note && (
        <p role="status" data-testid="shared-save-note" data-status={note.status} className="basis-full text-[14px]"
          style={{ fontFamily: SANS, color: note.status === 'error' ? '#fda4af' : CHALK_DIM }}>{note.message}</p>
      )}
      {!auth.loading && !auth.user && (
        <aside data-testid="shared-invite" className="basis-full mt-4 rounded-lg p-4" style={{ border: `1px solid ${CHALK_RAIL}` }}>
          <p className="text-[15px]" style={{ fontFamily: SANS, color: CHALK_CREAM }}>
            Neural Flavor helps you build drinks, sauces and dishes from what pairs well.
          </p>
          <button type="button" onClick={() => setInviteOpen(true)} data-testid="shared-invite-button"
            className="mt-3 inline-flex items-center justify-center rounded-lg px-4" style={{ ...btn({ background: `${ACCENT}22` }), ...tap }}>
            Create a free account
          </button>
        </aside>
      )}
      <InventSaveOverlay save={overlaySave} auth={overlayAuth} copy={save.pending ? SAVE_WHY : INVITE_WHY} />
    </>
  );
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

const assignLocation = (url) => window.location.assign(url);

// Firestore is reached only for a /r/<id> link: the built-in recipe path never calls this.
async function defaultLoadShared(id) {
  const [{ getShare }, { db }] = await Promise.all([import('../data/shareStore.js'), import('../firebase.js')]);
  return getShare(db, id);
}

export default function SharedRecipePage({ route, loadData = defaultLoadData, loadShared = defaultLoadShared, loadNodes = defaultLoadNodes, sendReport = undefined, actions = null, onHome = null, navigate = assignLocation }) {
  const [state, setState] = useState({ status: 'loading', recipe: null });
  const [nodes, setNodes] = useState(null);
  const kind = route?.kind;
  const slug = route?.slug;
  const shareId = typeof route?.id === 'string' ? route.id.toLowerCase() : '';

  useEffect(() => {
    let live = true;
    if (shareId) {
      setState({ status: 'loading', recipe: null });
      Promise.resolve()
        .then(() => loadShared(shareId))
        .then((doc) => {
          if (!live) return;
          const recipe = fromSharedDoc(doc, shareId);
          setState(recipe ? { status: 'ready', recipe } : { status: 'gone', recipe: null });
        })
        .catch(() => { if (live) setState({ status: 'gone', recipe: null }); });
      return () => { live = false; };
    }
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
  }, [kind, slug, shareId, loadData, loadShared]);

  const ready = state.status === 'ready';
  useEffect(() => {
    if (!ready || !SHARE_CHARTS_ENABLED) return undefined;
    let live = true;
    Promise.resolve()
      .then(() => loadNodes())
      .then((n) => { if (live) setNodes(n instanceof Map ? n : null); })
      .catch(() => { if (live) setNodes(null); });
    return () => { live = false; };
  }, [ready, loadNodes]);

  const recipe = state.recipe;
  const profile = useMemo(() => {
    if (!SHARE_CHARTS_ENABLED || !recipe || !nodes) return null;
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
            {recipe.by ? <p data-testid="shared-by" className="mt-1 text-[14px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>Shared by {recipe.by}</p> : null}
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

            {SHARE_CHARTS_ENABLED && profile && (
              <section className="mt-6" aria-label="Flavor profile">
                <InventFlavorProfile profile={profile} title="Flavor profile (visual guide)" testidPrefix="shared-profile" />
              </section>
            )}

            <section data-testid="shared-actions" aria-label="Actions" className="mt-6 flex flex-wrap gap-2 empty:hidden">
              <RecipeActions recipe={recipe} nodes={nodes} navigate={navigate} />
              {actions}
            </section>
            {recipe.shareId && (
              <div data-testid="shared-report-slot" className="mt-4 empty:hidden">
                <ShareReport shareId={recipe.shareId} sendReport={sendReport} />
              </div>
            )}
          </article>
        )}
      </main>
    </div>
  );
}
