import { useEffect, useState } from 'react';
import { getConsent, setConsent, subscribeConsent } from '../data/usage.js';

/** Profile row: shows the stored answer and lets the person change it. */
export default function UsageSetting() {
  const [answer, setAnswer] = useState(() => getConsent());
  useEffect(() => subscribeConsent((v) => setAnswer(v)), []);
  const on = answer === 'yes';
  return (
    <div data-testid="usage-setting" className="mb-2 px-2 py-2 rounded bg-[#1a1a2e]/50 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-xs text-gray-300">Share anonymous usage data</div>
        <a href="/privacy" className="text-[10px] text-blue-400 underline">What is collected</a>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Share anonymous usage data"
        onClick={() => setConsent(on ? 'no' : 'yes')}
        className={`min-w-[64px] min-h-[44px] px-3 rounded text-xs border ${on ? 'bg-blue-500/20 border-blue-400 text-blue-300' : 'border-[#2a2a3e] text-gray-400'}`}
      >
        {on ? 'On' : 'Off'}
      </button>
    </div>
  );
}
