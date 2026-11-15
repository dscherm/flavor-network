/**
 * ShareSheet — bottom sheet for sharing a recipe link, plus ShareButton, the small
 * button that opens it.
 *
 * ShareSheet props
 *   open, onClose
 *   recipe      { kind, name }
 *   link        path such as "/r/cocktail/negroni" (made absolute with the page's origin)
 *   ownItem     a recipe the person made: no link is produced here (SHARE-6 adds publishing);
 *               the sheet offers onPublish instead
 *   onPublish   called from the own-item sheet
 *   imagesSlot  node rendered in data-testid="share-images-slot"; when omitted, a built-in recipe gets
 *               <ShareImages> (the card pictures, SHARE-5)
 *   origin      override for tests; defaults to window.location.origin
 * ShareButton props: the same, minus open/onClose, plus label, className, style, testid.
 *   Renders nothing for an own item while SHARE_OWN_ENABLED is false, and nothing
 *   for a built-in item with no link.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { absoluteShareUrl, shareTargetUrls, shareTextFor, SHARE_OWN_ENABLED } from '../data/shareTargets.js';
import ShareImages from './ShareImages.jsx';
import { SANS, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, ACCENT, btn, heading } from './inventUi.jsx';

const NETWORKS = [
  { key: 'x', label: 'X' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'pinterest', label: 'Pinterest' },
  { key: 'whatsapp', label: 'WhatsApp' },
];

const tap = { minHeight: 44 };

export function ShareSheet({ open, onClose, recipe, link = '', ownItem = false, onPublish, imagesSlot, origin }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setCopied(false); setCopyFailed(false);
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); } };
    window.addEventListener('keydown', onKey, true);
    closeRef.current?.focus?.();
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  if (!open) return null;

  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const url = ownItem ? '' : absoluteShareUrl(link, base);
  const title = recipe?.name || 'Recipe';
  const text = shareTextFor(recipe);
  const targets = url ? shareTargetUrls({ title, text, url }) : null;
  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const nativeShare = async () => {
    try { await navigator.share({ title, text, url }); } catch { /* cancelled (AbortError) or unavailable: the other buttons are still there */ }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyFailed(false); setCopied(true);
    } catch {
      setCopied(false); setCopyFailed(true);
    }
  };

  const row = { ...btn({ textDecoration: 'none', background: 'rgba(255,255,255,0.05)' }), ...tap };
  const sheet = (
    <div className="fixed inset-0 z-[120] flex items-end justify-center" data-testid="share-sheet" role="dialog" aria-modal="true" aria-label={`Share ${title}`}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose} data-testid="share-backdrop" />
      <div className="relative w-full min-w-0 overflow-x-hidden overflow-y-auto rounded-t-2xl px-4 pt-3"
        style={{ maxWidth: 480, maxHeight: '85vh', background: '#14120f', border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM, paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex items-center justify-between gap-2">
          <h2 style={{ ...heading, fontSize: 24 }} className="min-w-0 break-words">Share {title}</h2>
          <button type="button" ref={closeRef} onClick={onClose} aria-label="Close" data-testid="share-close"
            className="flex-shrink-0 rounded-lg px-3" style={{ ...btn(), ...tap, minWidth: 44 }}>×</button>
        </div>

        {ownItem ? (
          <div className="mt-3" data-testid="share-own">
            <p className="text-[15px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>
              To share your own recipe it first needs a public link.
            </p>
            <button type="button" onClick={onPublish} disabled={!onPublish} data-testid="share-publish"
              className="mt-3 w-full rounded-lg px-4" style={{ ...btn({ background: `${ACCENT}22` }), ...tap, opacity: onPublish ? 1 : 0.5 }}>
              Make a public link
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {canNative && (
              <button type="button" onClick={nativeShare} data-testid="share-native"
                className="w-full rounded-lg px-4" style={{ ...btn({ background: `${ACCENT}22` }), ...tap }}>
                Share
              </button>
            )}
            <button type="button" onClick={copy} data-testid="share-copy" className="w-full rounded-lg px-4" style={row}>
              Copy link
            </button>
            <p role="status" data-testid="share-copy-status" className="text-[14px] min-h-[1.25rem]" style={{ fontFamily: SANS, color: ACCENT }}>
              {copied ? 'Link copied' : ''}
            </p>
            {copyFailed && (
              <div data-testid="share-copy-fallback">
                <label className="block text-[13px] mb-1" style={{ fontFamily: SANS, color: CHALK_SUB }} htmlFor="share-link-field">
                  Could not copy. Select the link below:
                </label>
                <input id="share-link-field" readOnly value={url} data-testid="share-link-field"
                  onFocus={(e) => e.target.select()} onClick={(e) => e.target.select()}
                  className="w-full min-w-0 rounded-lg px-3"
                  style={{ fontFamily: SANS, fontSize: 16, color: CHALK_CREAM, background: 'rgba(255,255,255,0.05)', border: `1px solid ${CHALK_RAIL}`, ...tap }} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {NETWORKS.map((n) => (
                <a key={n.key} href={targets[n.key]} target="_blank" rel="noopener noreferrer" data-testid={`share-${n.key}`}
                  className="inline-flex items-center justify-center rounded-lg px-3" style={row}>
                  {n.label}
                </a>
              ))}
            </div>
          </div>
        )}

        <div data-testid="share-images-slot" className="mt-3">
          {imagesSlot !== undefined ? imagesSlot : (!ownItem && link ? <ShareImages link={link} origin={origin} /> : null)}
        </div>
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(sheet, document.body) : sheet;
}

export function ShareButton({ recipe, link = '', ownItem = false, onPublish, imagesSlot, origin, label = 'Share', className = '', style, testid = 'share-button' }) {
  const [open, setOpen] = useState(false);
  if (ownItem ? !SHARE_OWN_ENABLED : !link) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid={testid} aria-haspopup="dialog"
        className={`inline-flex items-center justify-center rounded-lg px-4 ${className}`}
        style={{ ...btn({ background: `${ACCENT}22` }), ...tap, ...style }}>
        {label}
      </button>
      <ShareSheet open={open} onClose={() => setOpen(false)} recipe={recipe} link={link} ownItem={ownItem}
        onPublish={onPublish} imagesSlot={imagesSlot} origin={origin} />
    </>
  );
}

export default ShareSheet;
