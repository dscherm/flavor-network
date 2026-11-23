/**
 * SharedLinks — Profile section listing the cook's live public links (profile.shares), with Copy link and
 * Unshare (one confirm tap). Unshare sets shared/{id}.removed = true and drops the entry from the profile.
 * Renders nothing when there are no shares.
 *
 * Props
 *   shares      profile.shares: [{ id, kind, name, createdAt }]
 *   onRemoved   (id) called after the document was marked removed (the caller drops it from the profile)
 *   getDb       () => Promise<db>; default is the app's Firestore
 *   unshareFn   (db, id) => Promise; default is shareStore.unshare (tests inject)
 *   origin      defaults to window.location.origin
 * Test ids: shared-links, shared-link-row, shared-link-copy, shared-link-unshare, shared-link-confirm,
 *   shared-link-keep, shared-link-status.
 */
import { useState } from 'react';
import { unshare as defaultUnshare } from '../data/shareStore.js';

async function defaultGetDb() {
  const mod = await import('../firebase.js');
  return mod.db;
}

const dateOf = (t) => {
  if (typeof t !== 'number' || !t) return '';
  try { return new Date(t).toLocaleDateString(); } catch { return ''; }
};

export default function SharedLinks({ shares, onRemoved, getDb = defaultGetDb, unshareFn = defaultUnshare, origin }) {
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(null);
  const [status, setStatus] = useState(null);
  if (!Array.isArray(shares) || shares.length === 0) return null;
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');

  const copy = async (id) => {
    try {
      await navigator.clipboard.writeText(`${base}/r/${id}`);
      setStatus({ id, text: 'Link copied', error: false });
    } catch {
      setStatus({ id, text: 'Could not copy. The link is shown above.', error: true });
    }
  };
  const confirmUnshare = async (id) => {
    setBusy(id);
    try {
      await unshareFn(await getDb(), id);
      onRemoved?.(id);
      setConfirming(null);
      setStatus(null);
    } catch {
      setStatus({ id, text: 'Could not unshare right now. The link is still live; try again.', error: true });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section data-testid="shared-links" aria-label="Shared links" className="min-w-0">
      <h3 className="text-neural-glow/80 text-[13px] font-medium mb-1">Shared links</h3>
      <ul className="max-h-44 overflow-y-auto flex flex-col gap-1.5" role="list">
        {shares.map((s) => (
          <li key={s.id} data-testid="shared-link-row" className="rounded border border-[#2a2a3e] bg-[#1a1a2e] p-2 min-w-0">
            <p className="text-xs text-gray-200 break-words">{s.name || 'Recipe'}</p>
            <p className="text-[10px] text-gray-500 break-all">{`${base}/r/${s.id}`}</p>
            {dateOf(s.createdAt) ? <p className="text-[10px] text-gray-500">{dateOf(s.createdAt)}</p> : null}
            {confirming === s.id ? (
              <div className="mt-1">
                <p className="text-[11px] text-gray-300">Unshare this? The link will stop working.</p>
                <div className="flex gap-2 mt-1">
                  <button type="button" onClick={() => confirmUnshare(s.id)} disabled={busy === s.id} data-testid="shared-link-confirm"
                    className="flex-1 min-h-[44px] text-[11px] rounded bg-red-500/15 text-red-300 hover:bg-red-500/25 disabled:opacity-60">
                    {busy === s.id ? 'Unsharing...' : 'Yes, unshare'}
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} data-testid="shared-link-keep"
                    className="flex-1 min-h-[44px] text-[11px] rounded text-gray-400 hover:text-gray-200">Keep it</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => copy(s.id)} data-testid="shared-link-copy"
                  className="flex-1 min-h-[44px] text-[11px] rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20">Copy link</button>
                <button type="button" onClick={() => { setStatus(null); setConfirming(s.id); }} data-testid="shared-link-unshare"
                  className="flex-1 min-h-[44px] text-[11px] rounded text-gray-400 hover:text-red-300">Unshare</button>
              </div>
            )}
            {status?.id === s.id && (
              <p role={status.error ? 'alert' : 'status'} data-testid="shared-link-status" className="text-[11px] mt-1"
                style={{ color: status.error ? '#fda4af' : '#93c5fd' }}>{status.text}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
