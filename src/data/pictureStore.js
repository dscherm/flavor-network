/**
 * pictureStore.js — where a recipe's picture lives (PICTURE-3). Firestore calls take `db`, so tests pass
 * doubles and nothing here imports the app's Firebase instance.
 *
 * What is stored, and where
 *   saved item (profile document)   picture: { kind: 'icon', icon, v } | { kind: 'chalk', v }
 *                                   An icon is only its id. `v` changes whenever the picture changes, so a
 *                                   reader can tell a stale cached copy. The image itself is never in here.
 *   profiles/{uid}/pictures/{itemId}   { data (base64), mime, w, h, updatedAt }  one chalk picture, its own document
 *   sharedPictures/{shareId}           { data, mime, w, h, owner, createdAt }     the copy that goes with a share
 *   shared/{id}                        picture: { kind: 'icon', icon } | { kind: 'chalk' }   (no image data)
 *
 * The ORIGINAL photo never reaches this module: the chooser (RecipePicture) hands over only the encoded
 * chalk result { kind: 'chalk', blob, mime, w, h }. Nothing here uses fetch, XHR, sendBeacon or a socket.
 *
 * Failure is never fatal to the caller: prepareItemPicture / publish helpers return a one-line `reason`
 * and the item or the link goes ahead without the picture.
 *
 * Loading: listing saved items reads NO picture documents. A card with picture.kind === 'chalk' calls
 * loadPicture(db, uid, item.id) when it mounts (and keeps the result in memory keyed by `${id}:${v}`).
 */
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { isIconId, cleanPictureField, sharedPictureField, fieldFromValue } from './pictureField.js';

export { isIconId, cleanPictureField, sharedPictureField, fieldFromValue };

export const PICTURE_LIMITS = Object.freeze({
  dataChars: 210000, // exclusive: a data string must be shorter than this (about 150 KB of image)
  minSide: 16,
  maxSide: 2000,
  iconChars: 40,
});
export const PICTURE_MIMES = Object.freeze(['image/webp', 'image/jpeg']);
const SHARE_ID = /^[a-z0-9]{10}$/;
const ITEM_ID = /^[A-Za-z0-9_-]{1,80}$/;

export const PICTURE_FAILED = 'The picture could not be saved, so it was left out. You can add it again later.';
export const PICTURE_TOO_BIG = 'That picture is too large to store, so it was left out.';
export const PICTURE_SIGNIN = 'Sign in to keep a picture. It was left out.';

// ── pure helpers ───────────────────────────────────────────────────

function toBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function blobBytes(blob) {
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer());
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result));
    r.onerror = () => reject(r.error || new Error('read failed'));
    r.readAsArrayBuffer(blob);
  });
}

/**
 * The chooser's chalk value -> { data, mime, w, h }, checked against the same caps the rules enforce.
 * Throws an Error whose message is a plain one-line reason.
 */
export async function encodeChalk(value) {
  const bad = (m) => { throw new Error(m); };
  if (!value || value.kind !== 'chalk' || !value.blob) bad(PICTURE_FAILED);
  const { blob, w, h } = value;
  const mime = PICTURE_MIMES.includes(value.mime) ? value.mime : PICTURE_MIMES.includes(blob.type) ? blob.type : '';
  if (!mime) bad(PICTURE_FAILED);
  const okSide = (n) => Number.isInteger(n) && n >= PICTURE_LIMITS.minSide && n <= PICTURE_LIMITS.maxSide;
  if (!okSide(w) || !okSide(h)) bad(PICTURE_FAILED);
  // base64 is 4 characters per 3 bytes: refuse before encoding what could not fit.
  if (!(blob.size > 0) || Math.ceil(blob.size / 3) * 4 >= PICTURE_LIMITS.dataChars) bad(PICTURE_TOO_BIG);
  const data = toBase64(await blobBytes(blob));
  if (data.length >= PICTURE_LIMITS.dataChars) bad(PICTURE_TOO_BIG);
  return { data, mime, w, h };
}

/** A stored picture document -> an <img src>. */
export const toDataUrl = (p) => (p && typeof p.data === 'string' && PICTURE_MIMES.includes(p.mime) ? `data:${p.mime};base64,${p.data}` : '');

/** A document read back from Firestore (untrusted) -> { data, mime, w, h } or null. */
function readPicture(d) {
  if (!d || typeof d !== 'object') return null;
  const okSide = (n) => Number.isInteger(n) && n >= PICTURE_LIMITS.minSide && n <= PICTURE_LIMITS.maxSide;
  if (typeof d.data !== 'string' || !d.data || d.data.length >= PICTURE_LIMITS.dataChars) return null;
  if (!PICTURE_MIMES.includes(d.mime) || !okSide(d.w) || !okSide(d.h)) return null;
  return { data: d.data, mime: d.mime, w: d.w, h: d.h, dataUrl: toDataUrl(d) };
}

// ── the user's own picture: profiles/{uid}/pictures/{itemId} ───────

const ownRef = (db, uid, itemId) => doc(db, 'profiles', uid, 'pictures', itemId);
const goodIds = (uid, itemId) => typeof uid === 'string' && !!uid && ITEM_ID.test(String(itemId));

/** Write one chalk picture ({ data, mime, w, h } from encodeChalk). */
export async function savePicture(db, uid, itemId, enc, now = Date.now()) {
  if (!goodIds(uid, itemId)) throw new Error('Bad picture id.');
  await setDoc(ownRef(db, uid, itemId), { data: enc.data, mime: enc.mime, w: enc.w, h: enc.h, updatedAt: now });
}

/** { data, mime, w, h, dataUrl } or null (missing, unreadable or malformed). Never throws. */
export async function loadPicture(db, uid, itemId) {
  if (!goodIds(uid, itemId)) return null;
  try {
    const snap = await getDoc(ownRef(db, uid, itemId));
    return snap.exists() ? readPicture(snap.data()) : null;
  } catch {
    return null;
  }
}

/** Remove the picture document. Never throws: a failed clean-up leaves an orphan the owner alone can read. */
export async function deletePicture(db, uid, itemId) {
  if (!goodIds(uid, itemId)) return false;
  try { await deleteDoc(ownRef(db, uid, itemId)); return true; } catch { return false; }
}

/**
 * Step 1 of saving an item with a picture, BEFORE the item is written locally:
 * work out the item's `picture` field and, for a chalk picture, write its document.
 *
 *   { field, reason?, obsolete }
 *   field     what the item should carry (null = no picture)
 *   reason    one plain line when a chalk write failed; the item then keeps its PREVIOUS picture (or has none)
 *   obsolete  true when a previous chalk document is no longer wanted (call dropPicture after the item is saved)
 *
 * No `value` (undefined) changes nothing and touches no network.
 */
export async function prepareItemPicture({ db, uid, itemId, value, prev, now = Date.now() }) {
  const prevField = cleanPictureField(prev);
  if (value === undefined) return { field: prevField, obsolete: false };
  if (value !== null && value.kind === 'chalk') {
    try {
      if (!uid || !db) throw new Error(PICTURE_SIGNIN);
      const enc = await encodeChalk(value);
      await savePicture(db, uid, itemId, enc, now);
      return { field: { kind: 'chalk', v: now }, obsolete: false };
    } catch (e) {
      const known = e && (e.message === PICTURE_TOO_BIG || e.message === PICTURE_SIGNIN);
      return { field: prevField, reason: known ? e.message : PICTURE_FAILED, obsolete: false };
    }
  }
  const field = fieldFromValue(value, prevField, now);
  return { field, obsolete: prevField?.kind === 'chalk' };
}

/** Step 2: after the item is saved, remove a chalk document the item no longer uses. */
export async function dropPicture({ db, uid, itemId }) {
  if (!db || !uid) return false;
  return deletePicture(db, uid, itemId);
}

// ── a shared copy: sharedPictures/{shareId} ────────────────────────

/** The picture of a LIVE share, or null (missing, removed for the reader, malformed). Never throws. */
export async function loadSharedPicture(db, shareId) {
  if (!SHARE_ID.test(String(shareId))) return null;
  try {
    const snap = await getDoc(doc(db, 'sharedPictures', shareId));
    return snap.exists() ? readPicture(snap.data()) : null;
  } catch {
    return null;
  }
}

/** Best-effort removal of a share's picture (the rules already hide it from others once the share is removed). */
export async function deleteSharedPicture(db, shareId) {
  if (!SHARE_ID.test(String(shareId))) return false;
  try { await deleteDoc(doc(db, 'sharedPictures', shareId)); return true; } catch { return false; }
}

/** The document written to sharedPictures/{shareId}. */
export function sharedPictureDoc(enc, owner, now = Date.now()) {
  return { data: enc.data, mime: enc.mime, w: enc.w, h: enc.h, owner, createdAt: now };
}
