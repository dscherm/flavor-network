/**
 * shareStore.js — the three Firestore calls behind public shares (collection `shared`). Thin on purpose:
 * every function takes `db`, so tests pass a mock and nothing here imports the app's Firebase instance.
 *
 *   publishShare(db, doc, id)   writes shared/{id} (the rules check the shape, the owner and the limits)
 *   getShare(db, id)            the document, or null when it is missing, removed or the id is malformed
 *   unshare(db, id)             sets removed: true (the only update the rules allow)
 *   sendReport(db, report)      adds a report to shareReports (create only; only the site owner can read them, in the console)
 */
import { addDoc, collection, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const COLLECTION = 'shared';
export const SHARE_ID_PATTERN = /^[a-z0-9]{10}$/;

export async function publishShare(db, data, id) {
  if (!SHARE_ID_PATTERN.test(String(id))) throw new Error('Bad share id.');
  await setDoc(doc(db, COLLECTION, id), data);
  return id;
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
}

export async function sendReport(db, report) {
  await addDoc(collection(db, 'shareReports'), report);
}
