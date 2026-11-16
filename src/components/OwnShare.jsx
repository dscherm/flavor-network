/**
 * OwnShare — sharing a recipe the cook made (SHARE-6). A frozen public copy is written to shared/{id}
 * only when the cook taps "Create link", after the sheet has shown exactly what will become public.
 *
 * ShareOwnContext   { userProfile, auth, nodes? } provided once by App (userProfile = useUserProfile's result,
 *                   auth = { user, authError, loginWithGoogle, loginWithApple }, nodes = optional Map of flavor
 *                   values for the card's chart). Without it the button renders nothing.
 * OwnShareButton    props: kind ('cocktail'|'sauce'|'recipe'), item (saved-item shape, see inventSaved.js;
 *                   a Cookbook recipe goes through itemFromRecipe first), label, className, style, testid.
 *                   Renders nothing while SHARE_OWN_ENABLED is false.
 * The sheet has three states: signed out (sign-in first), review + name choice + Create link, and then the
 * normal share actions for /r/<id>. An item whose content is unchanged since it was shared reuses its link.
 * Test ids: own-share-button, own-signin, own-signin-google, own-signin-apple, own-preview, own-preview-name,
 *   own-preview-line, own-preview-method, own-by-none, own-by-first, own-by-nick, own-nick-input, own-by-shown,
 *   own-create, own-status, own-live.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ShareSheet } from './ShareSheet.jsx';
import ShareImages from './ShareImages.jsx';
import { SHARE_OWN_ENABLED } from '../data/shareTargets.js';
import { SHARE_LIMITS, firstName, fromSharedDoc, newShareId, shareFingerprint, toSharedDoc } from '../data/sharePublish.js';
import { publishShare } from '../data/shareStore.js';
import { barsFor } from '../data/shareCardData.js';
import { loadLabelNodes } from '../data/sharedLoaders.js';
import { SANS, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, ACCENT, btn, heading, inputStyle } from './inventUi.jsx';

export const ShareOwnContext = createContext(null);

const tap = { minHeight: 44 };
const PAGE_KIND = { cocktail: 'cocktail', sauce: 'sauce', recipe: 'dish' };
export const LIMIT_MESSAGE = `You already have ${SHARE_LIMITS.live} shared links, the most one account can have. Unshare one in Profile first.`;

async function defaultGetDb() {
  const mod = await import('../firebase.js');
  return mod.db;
}

async function barsForItem(item, kind, nodes) {
  try {
    const map = nodes instanceof Map && nodes.size ? nodes : await loadLabelNodes();
    const doc = toSharedDoc(item, { kind, uid: 'x', bars: [] });
    if (!doc || !map) return [];
    return barsFor({ kind: PAGE_KIND[kind], lines: doc.lines.map((l) => ({ key: l.key })) }, map, { stored: true });
  } catch {
    return [];
  }
}

function SignIn({ auth }) {
  return (
    <div className="mt-3" data-testid="own-signin">
      <p className="text-[16px]" style={{ fontFamily: SANS, color: CHALK_CREAM }}>Sign in to share a recipe you made</p>
      <p className="text-[14px] mt-1" style={{ fontFamily: SANS, color: CHALK_DIM }}>
        A shared recipe gets a public link, so it is tied to your account. You can take it down at any time.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <button type="button" onClick={auth?.loginWithGoogle} data-testid="own-signin-google" className="w-full rounded-lg px-4"
          style={{ ...btn({ background: `${ACCENT}22` }), ...tap }}>Sign in with Google</button>
        <button type="button" onClick={auth?.loginWithApple} data-testid="own-signin-apple" className="w-full rounded-lg px-4"
          style={{ ...btn({ background: 'rgba(255,255,255,0.05)' }), ...tap }}>Sign in with Apple</button>
      </div>
      {auth?.authError && <p role="alert" className="mt-2 text-[14px]" style={{ fontFamily: SANS, color: '#fda4af' }}>{auth.authError}</p>}
    </div>
  );
}

function Preview({ doc }) {
  return (
    <section data-testid="own-preview" aria-label="What will be public" className="mt-3 rounded-lg p-3 min-w-0"
      style={{ border: `1px solid ${CHALK_RAIL}`, background: 'rgba(255,255,255,0.03)' }}>
      <p className="text-[13px] uppercase tracking-wide" style={{ fontFamily: SANS, color: CHALK_SUB }}>This will be public</p>
      <p data-testid="own-preview-name" className="break-words" style={{ ...heading, fontSize: 24 }}>{doc.name}</p>
      <ul className="mt-1 overflow-y-auto" style={{ maxHeight: 160 }} role="list">
        {doc.lines.map((l, i) => (
          <li key={`${l.key}-${i}`} data-testid="own-preview-line" className="flex gap-2 py-0.5 min-w-0 text-[15px]" style={{ fontFamily: SANS }}>
            <span className="w-20 flex-shrink-0 text-right" style={{ color: ACCENT }}>{l.amount}</span>
            <span className="min-w-0 break-words" style={{ color: CHALK_CREAM }}>{l.key}</span>
          </li>
        ))}
      </ul>
      {doc.method ? (
        <p data-testid="own-preview-method" className="mt-2 text-[14px] whitespace-pre-wrap break-words overflow-y-auto"
          style={{ fontFamily: SANS, color: CHALK_DIM, maxHeight: 112 }}>{doc.method}</p>
      ) : null}
      {doc.glass ? <p className="mt-1 text-[14px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>Glass: {doc.glass}</p> : null}
      <p data-testid="own-by-shown" className="mt-2 text-[14px]" style={{ fontFamily: SANS, color: CHALK_CREAM }}>
        {doc.by ? `Shared by ${doc.by}` : 'No name is shown'}
      </p>
    </section>
  );
}

function NameChoice({ choice, onChoice, nick, onNick, first }) {
  const radio = (id, label, testid, disabled = false) => (
    <label className="flex items-center gap-2 rounded-lg px-3" style={{ ...tap, border: `1px solid ${choice === id ? ACCENT : CHALK_RAIL}`, opacity: disabled ? 0.5 : 1, fontFamily: SANS, fontSize: 16, color: CHALK_CREAM }}>
      <input type="radio" name="own-by" checked={choice === id} disabled={disabled} onChange={() => onChoice(id)} data-testid={testid} />
      <span className="min-w-0 break-words">{label}</span>
    </label>
  );
  return (
    <fieldset className="mt-3 flex flex-col gap-2 min-w-0" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="text-[14px] mb-1" style={{ fontFamily: SANS, color: CHALK_DIM }}>Show a name with it?</legend>
      {radio('none', "Don't show a name", 'own-by-none')}
      {radio('first', first ? `My first name (${first})` : 'My first name (not available)', 'own-by-first', !first)}
      {radio('nick', 'A nickname', 'own-by-nick')}
      {choice === 'nick' && (
        <input type="text" value={nick} onChange={(e) => onNick(e.target.value)} maxLength={SHARE_LIMITS.by} placeholder="Nickname"
          aria-label="Nickname" data-testid="own-nick-input" autoComplete="off" className="w-full min-w-0 px-3 rounded-lg" style={{ ...inputStyle, ...tap }} />
      )}
    </fieldset>
  );
}

function PublishStep({ kind, item, ctx, onPublished, getDb }) {
  const { auth, userProfile } = ctx;
  const [choice, setChoice] = useState('none');
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const first = firstName(auth?.user?.displayName);
  const by = choice === 'first' ? first : choice === 'nick' ? nick : '';
  const uid = auth?.user?.uid || '';
  const doc = useMemo(() => toSharedDoc(item, { kind, uid: uid || 'pending', by, bars: [] }), [item, kind, uid, by]);
  const needsNick = choice === 'nick' && !doc?.by;

  const create = async () => {
    if (busy || !doc || needsNick) return;
    const live = Array.isArray(userProfile?.profile?.shares) ? userProfile.profile.shares.length : 0;
    if (live >= SHARE_LIMITS.live) { setError(LIMIT_MESSAGE); return; }
    setBusy(true); setError('');
    try {
      const bars = await barsForItem(item, kind, ctx.nodes);
      const finalDoc = toSharedDoc(item, { kind, uid, by, bars });
      const id = newShareId();
      await publishShare(await getDb(), finalDoc, id);
      userProfile?.addShare?.({
        id, kind, sourceId: String(item.id || ''), fingerprint: shareFingerprint({ ...item, kind }), name: finalDoc.name, createdAt: finalDoc.createdAt,
      });
      onPublished({ id, doc: finalDoc });
    } catch {
      setError('Could not create the link. Nothing was shared; try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!doc) {
    return <p data-testid="own-status" role="alert" className="mt-3 text-[15px]" style={{ fontFamily: SANS, color: '#fda4af' }}>
      Add a name and at least one ingredient before sharing this.
    </p>;
  }
  return (
    <div className="mt-1" data-testid="own-review">
      <Preview doc={doc} />
      <NameChoice choice={choice} onChoice={setChoice} nick={nick} onNick={setNick} first={first} />
      <p className="mt-3 text-[13px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>
        Anyone with the link can read this. It is a copy: editing your recipe later will not change it.
      </p>
      <button type="button" onClick={create} disabled={busy || needsNick} data-testid="own-create" className="mt-2 w-full rounded-lg px-4"
        style={{ ...btn({ background: `${ACCENT}33` }), ...tap, opacity: busy || needsNick ? 0.55 : 1 }}>
        {busy ? 'Creating...' : 'Create link'}
      </button>
      {error && <p role="alert" data-testid="own-status" className="mt-2 text-[14px]" style={{ fontFamily: SANS, color: '#fda4af' }}>{error}</p>}
    </div>
  );
}

export function OwnShareButton({ kind, item, label = 'Share', className = '', style, testid = 'own-share-button', getDb = defaultGetDb }) {
  const ctx = useContext(ShareOwnContext);
  const [open, setOpen] = useState(false);
  const [published, setPublished] = useState(null);
  const fingerprint = useMemo(() => (item ? shareFingerprint({ ...item, kind }) : ''), [item, kind]);
  const shares = ctx?.userProfile?.profile?.shares;
  const existing = useMemo(
    () => (Array.isArray(shares) ? shares.find((s) => s.fingerprint && s.fingerprint === fingerprint) || null : null),
    [shares, fingerprint],
  );
  // A link from this session counts only for the content it was made from.
  const fresh = published && published.fingerprint === fingerprint ? published : null;
  // Once the profile has listed the new link and later drops it (unshared from Profile while this button is mounted), it no longer counts.
  const seenListed = useRef(null);
  useEffect(() => {
    if (!published || !Array.isArray(shares)) return;
    const listed = shares.some((x) => x.id === published.id);
    if (listed) seenListed.current = published.id;
    else if (seenListed.current === published.id) { seenListed.current = null; setPublished(null); }
  }, [shares, published]);
  const shareId = fresh?.id || existing?.id || null;

  const recipe = useMemo(() => {
    if (!shareId || !item) return null;
    const doc = toSharedDoc(item, { kind, uid: 'x', bars: [] });
    return doc ? fromSharedDoc(doc, shareId) : null;
  }, [shareId, item, kind]);

  if (!SHARE_OWN_ENABLED || !ctx || !item) return null;

  const link = shareId ? `/r/${shareId}` : '';
  const live = !!ctx.auth?.user;
  const ownSlot = live
    ? <PublishStep kind={kind} item={item} ctx={ctx} getDb={getDb} onPublished={({ id, doc }) => setPublished({ id, bars: doc.bars, fingerprint })} />
    : <SignIn auth={ctx.auth} />;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid={testid} aria-haspopup="dialog"
        className={`inline-flex items-center justify-center rounded-lg px-4 ${className}`}
        style={{ ...btn({ background: `${ACCENT}22` }), ...tap, ...style }}>
        {label}
      </button>
      {link && recipe ? (
        <ShareSheet open={open} onClose={() => setOpen(false)} recipe={{ kind: recipe.kind, name: recipe.name }} link={link}
          imagesSlot={(
            <>
              <p data-testid="own-live" className="text-[14px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>
                Your link is live. Take it down any time from Profile, under Shared links.
              </p>
              <ShareImages link={link} recipe={recipe} bars={fresh ? fresh.bars : undefined} />
            </>
          )} />
      ) : (
        <ShareSheet open={open} onClose={() => setOpen(false)} recipe={{ kind: PAGE_KIND[kind], name: item.name }} ownItem ownSlot={ownSlot} />
      )}
    </>
  );
}

export default OwnShareButton;
