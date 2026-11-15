import { useEffect } from 'react';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_RAIL } from '../data/chalkTheme.js';

/**
 * The two small notices a lab shows while saving an invention (see
 * useSaveInvention): the sign-in prompt for a save that is waiting on an
 * account, and the confirmation once that save has gone through.
 * Fixed above the tab bar, over the invent panel.
 * `copy` ({ title, body }) replaces the sign-in wording where a page has its own reason to give.
 */
export default function InventSaveOverlay({ save, auth, copy = null }) {
  const { pending, toast, cancelPending, dismissToast } = save || {};
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => dismissToast?.(), 4000);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);
  if (!pending && !toast) return null;
  const button = { fontFamily: FONT, color: '#0a0a0a', background: CHALK_CREAM, border: `1px solid ${CHALK_CREAM}` };
  return (
    <div className="fixed inset-x-0 z-[95] flex flex-col items-center gap-2 px-4 pointer-events-none"
      style={{ bottom: 'calc(var(--tab-bar-h, 0px) + 12px)' }}>
      {pending && (
        <div role="dialog" aria-label="Sign in to save" data-testid="invent-save-signin"
          className="w-full max-w-md rounded-lg p-4 pointer-events-auto"
          style={{ border: `1px solid ${CHALK_RAIL}`, background: 'rgba(10,10,10,0.96)', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
          <div className="text-[20px] mb-1" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{copy?.title || 'Sign in to save this'}</div>
          <p className="text-sm mb-3" style={{ color: CHALK_DIM }}>
            {copy?.body || 'Saved ideas live in your account, so they show on every device. Yours is kept here and saves as soon as you are in.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={auth?.loginWithGoogle} data-testid="invent-save-signin-google"
              className="px-4 py-2 rounded-md text-base min-h-[44px]" style={button}>Sign in with Google</button>
            <button type="button" onClick={auth?.loginWithApple} data-testid="invent-save-signin-apple"
              className="px-4 py-2 rounded-md text-base min-h-[44px]" style={button}>Sign in with Apple</button>
            <button type="button" onClick={cancelPending} data-testid="invent-save-signin-cancel"
              className="px-4 py-2 rounded-md text-base min-h-[44px] underline" style={{ fontFamily: FONT, color: CHALK_DIM }}>Not now</button>
          </div>
          {auth?.authError && (
            <p className="text-sm mt-3" style={{ color: '#fda4af' }} role="alert" data-testid="invent-save-signin-error">{auth.authError}</p>
          )}
        </div>
      )}
      {toast && (
        <div role="status" data-testid="invent-save-toast" data-status={toast.status}
          className="rounded-full px-4 py-2 pointer-events-auto"
          style={{ fontFamily: FONT, fontSize: 18, color: toast.status === 'saved' ? '#0a0a0a' : '#fda4af', background: toast.status === 'saved' ? CHALK_CREAM : 'rgba(10,10,10,0.96)', border: `1px solid ${CHALK_RAIL}` }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
