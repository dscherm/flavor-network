/**
 * UpdateBanner — detects when a newer build has been deployed while this tab
 * was left open (a single-page app never reloads itself, so a long-lived tab
 * keeps running an old bundle after a deploy). Compares the main bundle this
 * tab loaded against the one the server's current index.html references; when
 * they differ, offers a one-tap refresh. Checks on an interval + when the tab
 * is refocused. Non-blocking and dismissible.
 */
import { useEffect, useState } from 'react';

const bundleName = (s) => {
  const m = (s || '').match(/index-[A-Za-z0-9_-]+\.js/);
  return m ? m[0] : null;
};

function loadedBundle() {
  try {
    for (const el of document.querySelectorAll('script[type="module"][src]')) {
      const n = bundleName(el.getAttribute('src'));
      if (n) return n;
    }
  } catch { /* ignore */ }
  return null;
}

async function deployedBundle() {
  try {
    const res = await fetch('/index.html', { cache: 'no-store' });
    if (!res.ok) return null;
    return bundleName(await res.text());
  } catch { return null; }
}

export default function UpdateBanner() {
  const [stale, setStale] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const loaded = loadedBundle();
    if (!loaded) return undefined;
    let active = true;
    const check = async () => {
      if (!active || document.hidden || stale) return;
      const dep = await deployedBundle();
      if (active && dep && dep !== loaded) setStale(true);
    };
    const id = setInterval(check, 90000);
    const onVis = () => { if (!document.hidden) check(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { active = false; clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [stale]);

  if (!stale || dismissed) return null;
  return (
    <div style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)', zIndex: 9999, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: '#1f2937', color: '#f3f4f6', border: '1px solid #374151', borderRadius: 10, padding: '8px 10px', boxShadow: '0 6px 24px rgba(0,0,0,0.4)', fontSize: 13 }}>
        <span>🔄 A new version is available.</span>
        <button onClick={() => window.location.reload()} style={{ background: '#10b981', color: '#04150e', border: 'none', borderRadius: 6, padding: '5px 10px', fontWeight: 600, minHeight: 32 }}>Refresh</button>
        <button onClick={() => setDismissed(true)} aria-label="Dismiss" style={{ background: 'transparent', color: '#9ca3af', border: 'none', fontSize: 16, minHeight: 32 }}>×</button>
      </div>
    </div>
  );
}
