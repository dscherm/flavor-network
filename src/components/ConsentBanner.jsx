import { useEffect, useState } from 'react';
import { getConsent, setConsent, subscribeConsent } from '../data/usage.js';

/** One-time, non-blocking question. Hidden once either answer is stored. */
export default function ConsentBanner() {
  const [answer, setAnswer] = useState(() => getConsent());
  useEffect(() => subscribeConsent((v) => setAnswer(v)), []);
  if (answer) return null;
  return (
    <div
      data-testid="consent-banner"
      role="region"
      aria-label="Usage data"
      style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)', zIndex: 9998, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}
    >
      <div style={{ pointerEvents: 'auto', maxWidth: 420, width: '100%', boxSizing: 'border-box', background: '#1b2a24', color: '#f1efe6', border: '1px solid #4a5d54', borderRadius: 10, padding: '10px 12px', boxShadow: '0 6px 24px rgba(0,0,0,0.45)', fontSize: 13, lineHeight: 1.4 }}>
        <div style={{ fontWeight: 600 }}>Help improve Neural Flavor?</div>
        <div style={{ opacity: 0.85, marginTop: 2 }}>
          Anonymous usage data, no ads.{' '}
          <a href="/privacy" style={{ color: '#9ed8b8', textDecoration: 'underline' }}>What is collected</a>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => setConsent('yes')}
            style={{ flex: 1, minHeight: 44, background: '#9ed8b8', color: '#06150e', border: 'none', borderRadius: 8, fontWeight: 600 }}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setConsent('no')}
            style={{ flex: 1, minHeight: 44, background: 'transparent', color: '#f1efe6', border: '1px solid #6b7d74', borderRadius: 8 }}
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
}
