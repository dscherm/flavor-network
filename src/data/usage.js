/**
 * Usage data (USAGE-1): consent store + track().
 *
 * Nothing is sent, and no analytics code is even downloaded, until the visitor
 * answers Yes. The answer lives on this device only:
 *   localStorage['nf.analytics.consent'] = 'yes' | 'no'   (absent = not asked yet)
 *
 * track(event, params) never throws and is a no-op when consent is not 'yes',
 * on localhost (unless localStorage['nf.usage.debug'] === '1'), when Firebase
 * Analytics is unsupported or blocked, or when the Firebase config has no
 * measurementId. No user id, email or name is ever set or sent.
 */

export const CONSENT_KEY = 'nf.analytics.consent';
export const DEBUG_KEY = 'nf.usage.debug';

const BANNED_PARAMS = new Set(['uid', 'user_id', 'userid', 'email', 'name', 'displayname', 'display_name']);

const listeners = new Set();
let handlePromise = null;
let handle = null;

let loader = defaultLoader;
let localCheck = defaultIsLocal;

function defaultIsLocal() {
  try {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost');
  } catch { return false; }
}

function debugOn() {
  try { return window.localStorage.getItem(DEBUG_KEY) === '1'; } catch { return false; }
}

/** The analytics module is only imported here, and this function is only called after a Yes. */
async function defaultLoader() {
  const [{ isSupported, getAnalytics, logEvent, setAnalyticsCollectionEnabled }, { app }] = await Promise.all([
    import('firebase/analytics'),
    import('../firebase.js'),
  ]);
  if (!app?.options?.measurementId) return null;
  if (!(await isSupported())) return null;
  const analytics = getAnalytics(app);
  return {
    logEvent: (name, params) => logEvent(analytics, name, params),
    setEnabled: (on) => setAnalyticsCollectionEnabled(analytics, on),
  };
}

export function getConsent() {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === 'yes' || v === 'no' ? v : null;
  } catch { return null; }
}

export function subscribeConsent(fn) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function allowedHere() {
  return !localCheck() || debugOn();
}

function ensureHandle() {
  if (!handlePromise) {
    handlePromise = Promise.resolve()
      .then(() => loader())
      .then((h) => { handle = h || null; return handle; })
      .catch(() => { handle = null; return null; });
  }
  return handlePromise;
}

/** Record the visitor's answer. 'yes' starts loading analytics; 'no' stops sending at once. */
export function setConsent(value) {
  const v = value === 'yes' ? 'yes' : 'no';
  try { window.localStorage.setItem(CONSENT_KEY, v); } catch { /* private mode: lasts this page only */ }
  try {
    if (v === 'yes') {
      if (allowedHere()) {
        ensureHandle().then((h) => { if (h && getConsent() === 'yes') { try { h.setEnabled(true); } catch { /* ignore */ } } });
      }
    } else if (handle) {
      try { handle.setEnabled(false); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  for (const fn of [...listeners]) { try { fn(v); } catch { /* ignore */ } }
}

/** Call once at start-up: restores analytics for someone who already said Yes. */
export function initUsage() {
  try {
    if (getConsent() === 'yes' && allowedHere()) ensureHandle();
  } catch { /* ignore */ }
}

export function track(event, params) {
  try {
    if (typeof event !== 'string' || !event) return;
    if (getConsent() !== 'yes' || !allowedHere()) return;
    const clean = {};
    for (const [k, val] of Object.entries(params || {})) {
      if (!BANNED_PARAMS.has(k.toLowerCase())) clean[k] = val;
    }
    ensureHandle().then((h) => {
      if (!h || getConsent() !== 'yes') return;
      try { h.logEvent(event, clean); } catch { /* ignore */ }
    });
  } catch { /* never throws */ }
}

/** Test seam: swap the analytics loader / localhost check and forget loaded state. */
export function __resetUsageForTests({ loader: l, isLocal } = {}) {
  loader = l || defaultLoader;
  localCheck = isLocal || defaultIsLocal;
  handlePromise = null;
  handle = null;
  listeners.clear();
}
