/**
 * shareStore.js — the three Firestore calls behind public shares (collection `shared`). Thin on purpose:
 * every function takes `db`, so tests pass a mock and nothing here imports the app's Firebase instance.
 *
 *   publishShare(db, doc, id)   writes shared/{id} (the rules check the shape, the owner and the limits)
 *   getShare(db, id)            the document, or null when it is missing, removed or the id is malformed
 *   publishShareWithPicture(db, doc, id, { chalk, owner })
 *                               publishShare plus, for a chalk picture, sharedPictures/{id} in ONE batch (below)
 *   unshare(db, id)             sets removed: true (the only update the rules allow) and best-effort deletes sharedPictures/{id}
 *   sendReport(db, report)      adds a report to shareReports (create only; only the site owner can read them, in the console)
 */
import { addDoc, collection, deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { PICTURE_FAILED, PICTURE_TOO_BIG, encodeChalk, sharedPictureDoc } from './pictureStore.js';

const COLLECTION = 'shared';
const PICTURES = 'sharedPictures';
export const SHARE_ID_PATTERN = /^[a-z0-9]{10}$/;

export async function publishShare(db, data, id) {
  if (!SHARE_ID_PATTERN.test(String(id))) throw new Error('Bad share id.');
  await setDoc(doc(db, COLLECTION, id), data);
  return id;
}

/**
 * Publish a share whose document says picture: { kind: 'chalk' }, together with its picture.
 *   chalk  the encoded chooser value { kind:'chalk', blob, mime, w, h }
 *   owner  the signed-in uid (must equal data.owner)
 * Write order: the rules read shared/{id} AFTER the write (getAfter), so shared/{id} and sharedPictures/{id}
 * go in ONE batch: both land or neither does, and a share that promises a chalk picture can never exist
 * without one. If the batch fails, or the picture cannot be encoded, the share is published WITHOUT the
 * picture key (an icon is unaffected) and `reason` says so in one line; only if that also fails does it throw.
 * Returns { id, picture: 'chalk'|'icon'|null, reason? }.
 */
export async function publishShareWithPicture(db, data, id, { chalk, owner } = {}) {
  if (!SHARE_ID_PATTERN.test(String(id))) throw new Error('Bad share id.');
  if (data?.picture?.kind !== 'chalk') {
    await publishShare(db, data, id);
    return { id, picture: data?.picture?.kind === 'icon' ? 'icon' : null };
  }
  const withoutPicture = () => { const rest = { ...data }; delete rest.picture; return rest; };
  let reason = PICTURE_FAILED;
  try {
    const enc = await encodeChalk(chalk);
    const batch = writeBatch(db);
    batch.set(doc(db, COLLECTION, id), data);
    batch.set(doc(db, PICTURES, id), sharedPictureDoc(enc, owner, data.createdAt));
    await batch.commit();
    return { id, picture: 'chalk' };
  } catch (e) {
    if (e?.message === PICTURE_TOO_BIG) reason = PICTURE_TOO_BIG;
  }
  await publishShare(db, withoutPicture(), id);
  return { id, picture: null, reason };
}

export async function getShare(db, id) {
  if (!SHARE_ID_PATTERN.test(String(id))) return null;
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (!data || data.removed === true) return null;
  return data;
}

export async function unshare(db, id) {
  if (!SHARE_ID_PATTERN.test(String(id))) throw new Error('Bad share id.');
  await updateDoc(doc(db, COLLECTION, id), { removed: true });
  // The rules already hide the picture from everyone but the owner once removed is true; deleting it is clean-up.
  try { await deleteDoc(doc(db, PICTURES, id)); } catch { /* an orphan only its owner can read */ }
}

export async function sendReport(db, report) {
  await addDoc(collection(db, 'shareReports'), report);
}

/** USAGE-4: one anonymous feedback note. `at` becomes the server's clock; nothing else is added. Create only. */
export async function sendFeedback(db, fb) {
  const { serverTimestamp } = await import('firebase/firestore');
  await addDoc(collection(db, 'feedback'), { note: fb.note, goal: fb.goal, lab: fb.lab, at: serverTimestamp() });
}
