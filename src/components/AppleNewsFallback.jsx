import React, { useState } from 'react';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW } from '../data/chalkTheme.js';

// WEBLINK-17 (2026-11-07): what the user sees when an Apple News link can't
// be turned into the publisher's recipe page automatically.
//
// It names the recipe and publisher (proof we read the right article), says
// why the import stopped, and gives two ways forward: a web search the USER
// opens (a plain link — the server never runs a search-engine query), and a
// box to paste the recipe's own web link.

/** Publishers whose sites refuse automated reads, so a pasted link fails too. */
const BLOCKING_REASONS = new Set(['blocks-automated-access', 'publisher-page-failed']);

export function webSearchHref(query) {
  return `https://www.google.com/search?q=${encodeURIComponent(query || 'recipe')}`;
}

function hostLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export default function AppleNewsFallback({ info, onImportUrl, onBack, inputStyle, buttonStyle, panelStyle }) {
  const [pasted, setPasted] = useState('');
  const title = info?.title || null;
  const publisher = info?.publisher || null;
  const blocked = BLOCKING_REASONS.has(info?.reason);
  const linked = info?.publisherUrl ? hostLabel(info.publisherUrl) : null;

  const submit = () => {
    const v = pasted.trim();
    if (v) onImportUrl(v);
  };

  return (
    <div data-testid="make-weblink-applenews" className="rounded-xl p-5 sm:p-6" style={panelStyle}>
      <h2
        className="text-2xl mb-2"
        style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}
        data-testid="make-weblink-applenews-found"
      >
        {title ? (
          <>We found <strong>{title}</strong>{publisher ? <> from {publisher}</> : null}</>
        ) : (
          <>We found the Apple News article{publisher ? <> from {publisher}</> : null}</>
        )}
      </h2>

      <p className="text-sm mb-2" style={{ color: CHALK_DIM }} data-testid="make-weblink-applenews-why">
        Apple News doesn't share the original recipe link, so we couldn't read the ingredients
        {blocked && publisher ? ` — and ${publisher} blocks automatic imports` : ''}.
        {info?.paywalled && publisher ? ` ${publisher} is subscriber-only, so the full recipe may need an account.` : ''}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <a
          href={webSearchHref(info?.searchQuery)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 rounded-md text-base"
          style={buttonStyle}
          data-testid="make-weblink-applenews-search"
        >
          Find it on the web ↗
        </a>
        {linked && (
          <a
            href={info.publisherUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 rounded-md text-base underline"
            style={{ fontFamily: FONT, color: CHALK_DIM }}
            data-testid="make-weblink-applenews-publisher"
          >
            Open it on {linked} ↗
          </a>
        )}
      </div>

      <label className="block text-sm mb-1" style={{ color: CHALK_CREAM }} htmlFor="make-weblink-applenews-paste">
        Paste the recipe's web link
      </label>
      <div className="flex gap-2 mb-3">
        <input
          id="make-weblink-applenews-paste"
          type="url"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="https://…"
          className="flex-1 min-w-0 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
          style={inputStyle}
          data-testid="make-weblink-applenews-paste"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!pasted.trim()}
          className="px-4 py-2 rounded-md text-base disabled:opacity-40 disabled:cursor-not-allowed"
          style={buttonStyle}
          data-testid="make-weblink-applenews-import"
        >
          Import
        </button>
      </div>

      <p className="text-xs mb-4" style={{ color: CHALK_SUB }} data-testid="make-weblink-applenews-tip">
        Tip: in Apple News, tap Share → Open in Safari, then share that page's link instead.
      </p>

      <div className="flex items-center justify-between gap-2" style={{ borderTop: `1px solid ${CHALK_RAIL}`, paddingTop: 12 }}>
        <button
          type="button"
          onClick={onBack}
          className="text-base underline"
          style={{ fontFamily: FONT, color: CHALK_DIM }}
          data-testid="make-weblink-applenews-back"
        >
          ← Back to picker
        </button>
      </div>
    </div>
  );
}
