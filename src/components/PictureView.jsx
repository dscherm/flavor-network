/**
 * PictureView — shows a recipe's picture (PICTURE-4): a chalk drawing from the registry, or a chalk picture made
 * from a photo (stored as its own document, so it is fetched when the card mounts and kept in memory).
 *
 * <PictureView picture itemId | shareId | value | src  size color load />
 *   picture   the stored field of a saved item or shared doc: { kind:'icon', icon, v? } | { kind:'chalk', v? }
 *   itemId    with picture.kind 'chalk': the saved item's id; its image is read from profiles/{uid}/pictures/{itemId}
 *             (uid = the signed-in account, from ShareOwnContext)
 *   shareId   with picture.kind 'chalk': read from sharedPictures/{shareId} instead
 *   value     a chooser value (RecipePicture): { kind:'icon', icon } | { kind:'chalk', blob, ... }; drawn straight away, no read
 *   src       a ready image address for a chalk picture (skips the read)
 *   size      px square; below MIN_PICTURE_SIZE (40) nothing is drawn: the drawings are made for a larger box and
 *             turn into faint shapes smaller than that (PICTURE-2 finding), so a list row either uses 40+ or has no picture
 *   load      ({ shareId, itemId, uid }) => Promise<{ dataUrl }|null>; default reads Firestore (loaded only when needed). Tests inject it.
 * A chalk picture that cannot be read draws nothing once the read has finished; while it loads a quiet box holds the space.
 * Test ids: picture-view (data-picture-kind = icon | chalk | loading).
 *
 * Also: useCardPicture(args) -> a { src, w, h, kind } for the share-card drawing, or null; blobFromStored; clearPictureCache.
 */
import { useContext, useEffect, useMemo, useState } from 'react';
import { PictureArt } from './pictureArt.jsx';
import { ShareOwnContext } from './shareOwnContext.js';
import { CHALK_RAIL } from '../data/chalkTheme.js';
import { isIconId } from '../data/pictureField.js';

export const MIN_PICTURE_SIZE = 40;

const cache = new Map(); // key -> Promise<{ dataUrl, w, h }|null>
export function clearPictureCache() { cache.clear(); }

async function defaultLoad({ shareId, itemId, uid }) {
  const [store, { db }] = await Promise.all([import('../data/pictureStore.js'), import('../firebase.js')]);
  return shareId ? store.loadSharedPicture(db, shareId) : store.loadPicture(db, uid, itemId);
}

function cacheKey({ shareId, itemId, uid, v }) {
  return shareId ? `s:${shareId}` : `u:${uid}:${itemId}:${v ?? 0}`;
}

/** Reads (once) the chalk picture for these ids; resolves { dataUrl, w, h } or null. Never rejects. */
function readChalk(args, load) {
  const key = cacheKey(args);
  if (!cache.has(key)) {
    cache.set(key, Promise.resolve().then(() => load(args)).then(
      (p) => (p && p.dataUrl ? { dataUrl: p.dataUrl, w: p.w, h: p.h } : null),
      () => null,
    ).then((r) => { if (!r) cache.delete(key); return r; }));
  }
  return cache.get(key);
}

/** { status: 'none'|'icon'|'loading'|'ready'|'missing', icon?, src?, w?, h? } for a stored picture field. */
export function usePictureData({ picture, itemId, shareId, src, load = defaultLoad }) {
  const ctx = useContext(ShareOwnContext);
  const uid = ctx?.auth?.user?.uid || '';
  const kind = picture?.kind;
  const icon = kind === 'icon' && isIconId(picture.icon) ? picture.icon : null;
  const v = picture?.v;
  const [state, setState] = useState({ key: '', data: null });
  const wanted = kind === 'chalk' && !src && (shareId || (itemId && uid)) ? cacheKey({ shareId, itemId, uid, v }) : '';

  useEffect(() => {
    if (!wanted) return undefined;
    let live = true;
    readChalk({ shareId, itemId, uid, v }, load).then((data) => { if (live) setState({ key: wanted, data }); });
    return () => { live = false; };
  }, [wanted]); // eslint-disable-line react-hooks/exhaustive-deps

  if (icon) return { status: 'icon', icon };
  if (kind !== 'chalk') return { status: 'none' };
  if (src) return { status: 'ready', src };
  if (!wanted) return { status: 'missing' };
  if (state.key !== wanted) return { status: 'loading' };
  return state.data ? { status: 'ready', src: state.data.dataUrl, w: state.data.w, h: state.data.h } : { status: 'missing' };
}

/** An object URL for a chooser's blob, revoked when it changes or the component goes away. */
function useBlobUrl(blob) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!blob || typeof URL === 'undefined' || !URL.createObjectURL) { setUrl(''); return undefined; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => { URL.revokeObjectURL(u); };
  }, [blob]);
  return url;
}

function Frame({ size, kind, children, testid }) {
  return (
    <span data-testid={testid} data-picture-kind={kind} className="inline-flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}>
      {children}
    </span>
  );
}

export default function PictureView({ picture, itemId, shareId, value, src, size = 96, color, load, testid = 'picture-view', alt = '' }) {
  const stored = value ? (value.kind === 'chalk' ? { kind: 'chalk' } : value) : picture;
  const blobUrl = useBlobUrl(value && value.kind === 'chalk' ? value.blob : null);
  const data = usePictureData({ picture: stored, itemId, shareId, src: src || (value?.kind === 'chalk' ? blobUrl : undefined), load });
  if (size < MIN_PICTURE_SIZE) return null;
  if (data.status === 'icon') {
    return <Frame size={size} kind="icon" testid={testid}><PictureArt id={data.icon} size={size} color={color} /></Frame>;
  }
  if (data.status === 'loading' || (value?.kind === 'chalk' && !blobUrl)) {
    return <Frame size={size} kind="loading" testid={testid}><span style={{ width: size * 0.6, height: size * 0.6, border: `2px dashed ${CHALK_RAIL}`, borderRadius: 12 }} /></Frame>;
  }
  if (data.status === 'ready') {
    return (
      <Frame size={size} kind="chalk" testid={testid}>
        <img src={data.src} alt={alt} width={size} height={size} draggable={false}
          style={{ width: size, height: size, objectFit: 'cover', borderRadius: 10, border: `1px solid ${CHALK_RAIL}` }} />
      </Frame>
    );
  }
  return null;
}

/** base64 text -> Blob (no network: a data: address is not fetched). */
export function blobFromStored({ data, mime }) {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * The picture as the share cards draw it: { src, w, h, kind } or null while it is not ready or there is none.
 * Drawings are fetched from the generated SVG map in a lazy chunk (about 60 KB), only when a card is going to be drawn.
 */
export function useCardPicture({ picture, itemId, shareId, src, load }) {
  const data = usePictureData({ picture, itemId, shareId, src, load });
  const [card, setCard] = useState(null);
  const icon = data.status === 'icon' ? data.icon : '';
  const chalkSrc = data.status === 'ready' ? data.src : '';
  const w = data.w;
  const h = data.h;
  useEffect(() => {
    let live = true;
    if (chalkSrc) { setCard({ src: chalkSrc, w: w || 600, h: h || 600, kind: 'chalk' }); return undefined; }
    if (!icon) { setCard(null); return undefined; }
    import('../data/pictureSvgs.generated.js').then((m) => {
      const svg = m.PICTURE_SVGS[icon];
      if (live) setCard(svg ? { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, w: 256, h: 256, kind: 'icon' } : null);
    }).catch(() => { if (live) setCard(null); });
    return () => { live = false; };
  }, [icon, chalkSrc, w, h]);
  return useMemo(() => card, [card]);
}
