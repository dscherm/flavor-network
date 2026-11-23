/**
 * BarScanSetup — the one-time card for "Add from a photo": how to connect to
 * the reading. Two choices, each saying where the photo goes and what stays
 * on this device. Storage and format checks live in src/data/barScan.js.
 *
 * Whatever is saved is shown masked (last 4 characters only); the paste box
 * is emptied after saving, so the secret is never in the page again.
 */
import { useState } from 'react';
import {
  loadScanKey, saveScanKey, clearScanKey, loadScanCode, saveScanCode, clearScanCode,
  looksLikeGeminiKey, looksLikeScanCode, maskSecret,
} from '../data/barScan.js';
import { TEXT, HAND, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL } from '../data/chalkTheme.js';

const box = { border: `1px solid ${CHALK_RAIL}`, background: 'rgba(255,255,255,0.03)' };
const field = { fontFamily: TEXT, background: 'rgba(255,255,255,0.06)', border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM };
const btn = { fontFamily: TEXT, border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM };

/** @param {{ onSaved?: (mode: 'key'|'code') => void, onClose?: () => void, storage?: object }} props */
export default function BarScanSetup({ onSaved, onClose, storage }) {
  const st = storage; // undefined → barScan.js uses localStorage
  const [saved, setSaved] = useState(() => ({ key: loadScanKey(st), code: loadScanCode(st) }));
  const [code, setCode] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const refresh = () => setSaved({ key: loadScanKey(st), code: loadScanCode(st) });

  const saveCode = (e) => {
    e.preventDefault();
    if (!looksLikeScanCode(code)) { setError('That does not look like a code: 8 to 64 letters, numbers or dashes.'); return; }
    if (!saveScanCode(code, st)) { setError('This browser would not keep it, so it could not be saved.'); return; }
    clearScanKey(st); // one way at a time: the own key would otherwise win silently
    setCode(''); setError(''); refresh();
    onSaved?.('code');
  };
  const saveKey = (e) => {
    e.preventDefault();
    if (!looksLikeGeminiKey(key)) { setError('That does not look like a Google key: one string of 20 to 100 characters, no spaces.'); return; }
    if (!saveScanKey(key, st)) { setError('This browser would not keep it, so it could not be saved.'); return; }
    clearScanCode(st);
    setKey(''); setError(''); refresh();
    onSaved?.('key');
  };

  return (
    <section className="w-full rounded-xl px-3 py-3 mt-3" style={{ ...box, fontFamily: TEXT, color: CHALK_CREAM }}
      data-testid="bar-scan-setup" aria-label="Set up photo reading">
      <h3 className="text-[22px] mb-1" style={{ fontFamily: HAND }}>Add bottles from a photo</h3>
      <p className="text-[13px] mb-2" style={{ color: CHALK_SUB }}>
        Reading labels uses Google's photo reader. Choose how to connect to it; you only do this once.
      </p>

      {(saved.key || saved.code) && (
        <p className="text-[14px] mb-2 flex items-center gap-2 flex-wrap" data-testid="bar-scan-saved">
          <span>{saved.key ? 'Using your own Google key' : 'Using your code'}: <span data-testid="bar-scan-masked">{maskSecret(saved.key || saved.code)}</span></span>
          <button type="button" data-testid="bar-scan-remove" className="px-3 rounded-md min-h-[44px]" style={btn}
            onClick={() => { clearScanKey(st); clearScanCode(st); refresh(); }}>Remove</button>
        </p>
      )}

      <form onSubmit={saveCode} className="rounded-lg px-3 py-3 mb-2" style={box} data-testid="bar-scan-code-block">
        <h4 className="text-[18px]" style={{ fontFamily: HAND }}>I have a code</h4>
        <p className="text-[13px] mb-2" style={{ color: CHALK_DIM }}>
          The photo is read using the app owner's Google key, through this app's server, and is not stored.
        </p>
        <div className="flex gap-2">
          <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste your code"
            aria-label="Invite code" autoComplete="off" autoCapitalize="off" spellCheck={false} data-testid="bar-scan-code-input"
            className="flex-1 min-w-0 px-2.5 py-2 rounded-md text-[16px]" style={field} />
          <button type="submit" data-testid="bar-scan-code-save" className="px-4 rounded-md min-h-[44px]" style={btn}>Save code</button>
        </div>
      </form>

      <form onSubmit={saveKey} className="rounded-lg px-3 py-3" style={box} data-testid="bar-scan-key-block">
        <h4 className="text-[18px]" style={{ fontFamily: HAND }}>Use my own Google key</h4>
        <p className="text-[13px] mb-1" style={{ color: CHALK_DIM }}>
          A key is a long password that lets this app ask Google's Gemini model to read a photo for you. It is free.{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" data-testid="bar-scan-key-link"
            style={{ color: CHALK_CREAM, textDecoration: 'underline' }}>Get a key from Google AI Studio</a>
        </p>
        <div className="flex gap-2">
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Paste your key"
            aria-label="Google key" autoComplete="off" autoCapitalize="off" spellCheck={false} data-testid="bar-scan-key-input"
            className="flex-1 min-w-0 px-2.5 py-2 rounded-md text-[16px]" style={field} />
          <button type="submit" data-testid="bar-scan-key-save" className="px-4 rounded-md min-h-[44px]" style={btn}>Save key</button>
        </div>
        <ul className="text-[13px] mt-2 list-disc pl-5" style={{ color: CHALK_DIM }}>
          <li>The key stays on this device and is sent only to Google.</li>
          <li>The photo goes from your browser straight to Google, and Google's terms for your key apply.</li>
          <li>A free key allows about 20 scans a day.</li>
        </ul>
      </form>

      {error && <p role="alert" data-testid="bar-scan-setup-error" className="text-[14px] mt-2" style={{ color: '#f2b8a8' }}>{error}</p>}
      {onClose && (
        <button type="button" onClick={onClose} data-testid="bar-scan-setup-close" className="mt-2 px-3 rounded-md min-h-[44px]" style={btn}>Not now</button>
      )}
    </section>
  );
}
