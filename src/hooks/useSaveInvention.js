import { useCallback, useEffect, useRef, useState } from 'react';

const NOUN = { cocktail: 'cocktails', sauce: 'sauces', recipe: 'recipes' };

/**
 * The onSave an invent panel calls ("name it and add it to my list"), for one lab.
 *
 *   const save = useSaveInvention({ kind: 'cocktail', userProfile, auth });
 *   <InventCocktail onSave={save.onSave} … />
 *   <InventSaveOverlay save={save} auth={auth} />
 *   save.cancelPending()   // when the panel closes
 *
 * onSave(input) resolves { status: 'saved' | 'signin' | 'error', message }.
 *  - signed in: written through userProfile.saveInvention (the profile writer);
 *  - signed out: the invention is queued ONCE and the sign-in prompt shows; when
 *    sign-in completes the same invention is saved exactly once and a toast says so.
 *    The queue is dropped by cancelPending(), by "Not now", and on unmount;
 *  - a failed write resolves 'error' with a plain message and nothing is lost.
 * Without a profile writer onSave is null (the panel hides its save row).
 */
export default function useSaveInvention({ kind, userProfile, auth }) {
  const user = auth?.user || null;
  const writer = userProfile?.saveInvention || null;
  const writerRef = useRef(writer);
  writerRef.current = writer;
  const kindRef = useRef(kind);
  kindRef.current = kind;
  const userRef = useRef(user);
  userRef.current = user;
  const pendingRef = useRef(null);
  const [pending, setPending] = useState(null);
  const [toast, setToast] = useState(null);

  const write = useCallback((input) => {
    const noun = NOUN[kindRef.current] || 'list';
    try {
      const res = writerRef.current({ ...input, kind: kindRef.current });
      if (res && res.ok) return { status: 'saved', message: `Saved to your ${noun}` };
      return { status: 'error', message: res?.reason || 'Could not save this. Nothing was lost; try again.' };
    } catch {
      return { status: 'error', message: 'Could not save this. Nothing was lost; try again.' };
    }
  }, []);

  const onSave = useCallback(async (input) => {
    if (!writerRef.current) return { status: 'error', message: 'Saving is not available here.' };
    if (!userRef.current) {
      pendingRef.current = input;
      setPending(input);
      return { status: 'signin', message: 'Sign in to save this.' };
    }
    pendingRef.current = null;
    setPending(null);
    return write(input);
  }, [write]);

  // Sign-in completed with an invention waiting: save it once.
  useEffect(() => {
    if (!user || !pendingRef.current) return;
    const input = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    setToast(write(input));
  }, [user, write]);

  const cancelPending = useCallback(() => { pendingRef.current = null; setPending(null); }, []);
  const dismissToast = useCallback(() => setToast(null), []);
  useEffect(() => () => { pendingRef.current = null; }, []);

  return { onSave: writer ? onSave : null, pending, toast, cancelPending, dismissToast };
}
