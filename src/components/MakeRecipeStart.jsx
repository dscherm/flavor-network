import React, { useEffect, useMemo, useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase.js';
import { matchRecipeIngredients } from '../data/parseRecipeIngredient.js';

const CARDS = [
  {
    id: 'existing',
    icon: '📖',
    title: 'Existing recipe',
    subtitle: 'Pick from your Cookbook',
    accent: '#a78bfa',
  },
  {
    id: 'scratch',
    icon: '✏️',
    title: 'Start from scratch',
    subtitle: 'Empty Recipe Lab',
    accent: '#38bdf8',
  },
  {
    id: 'photo',
    icon: '📷',
    title: 'Upload a photo',
    subtitle: "We'll attach the image; you add ingredients by hand",
    accent: '#f472b6',
  },
  {
    id: 'weblink',
    icon: '🔗',
    title: 'From a web link',
    subtitle: 'Paste a recipe URL; we extract the ingredients',
    accent: '#34d399',
  },
];

const STAGE = {
  CARDS: 'cards',
  URL_INPUT: 'url-input',
  PARSING: 'parsing',
  PREVIEW: 'preview',
  ERROR: 'error',
};

export default function MakeRecipeStart({
  setRecipeHandoff,
  setRecipeMounted,
  setActiveTab,
  setCookbookPickerMode,
  nodes = null,
}) {
  const fileInputRef = useRef(null);
  const firstCardRef = useRef(null);
  const urlInputRef = useRef(null);

  // MAKE-WEBLINK-UI (2026-05-30): 4th picker option is a multi-stage
  // flow rather than a one-shot tap. Stage state drives which section
  // renders below the card list (or replaces it).
  const [stage, setStage] = useState(STAGE.CARDS);
  const [url, setUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [parsed, setParsed] = useState(null); // { title, ingredients[], finalUrl }
  const [matched, setMatched] = useState([]); // matchRecipeIngredients output
  const [included, setIncluded] = useState(new Set()); // indices kept for bowl handoff

  useEffect(() => {
    if (stage === STAGE.CARDS) firstCardRef.current?.focus();
    if (stage === STAGE.URL_INPUT) urlInputRef.current?.focus();
  }, [stage]);

  const knownNames = useMemo(() => {
    if (!nodes) return [];
    if (nodes instanceof Map) return Array.from(nodes.keys());
    return Object.keys(nodes);
  }, [nodes]);

  const handleExisting = () => {
    setCookbookPickerMode?.('make');
    setActiveTab('cookbook');
  };

  const handleScratch = () => {
    setRecipeHandoff({
      source: 'make-scratch',
      ingredients: [],
      image: null,
      recipeType: null,
      mode: null,
      ts: Date.now(),
    });
    setRecipeMounted(true);
    setActiveTab('recipe');
  };

  const handlePhotoCardClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file || !file.type || !file.type.startsWith('image/')) return;
    setRecipeHandoff({
      source: 'make-photo',
      ingredients: [],
      image: file,
      recipeType: null,
      mode: null,
      ts: Date.now(),
    });
    setRecipeMounted(true);
    setActiveTab('recipe');
  };

  const resetWebLink = () => {
    setStage(STAGE.CARDS);
    setUrl('');
    setErrorMessage(null);
    setParsed(null);
    setMatched([]);
    setIncluded(new Set());
  };

  const handleParseUrl = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setErrorMessage('Paste a recipe URL first.');
      setStage(STAGE.ERROR);
      return;
    }
    try {
      const parsedUrl = new URL(trimmed);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        setErrorMessage('Only http:// and https:// URLs are supported.');
        setStage(STAGE.ERROR);
        return;
      }
    } catch {
      setErrorMessage("That doesn't look like a valid URL.");
      setStage(STAGE.ERROR);
      return;
    }

    setStage(STAGE.PARSING);
    setErrorMessage(null);
    try {
      const scrapeRecipe = httpsCallable(functions, 'scrapeRecipe');
      const res = await scrapeRecipe({ url: trimmed });
      const result = res?.data;
      if (!result || result.status !== 'ok' || !Array.isArray(result.ingredients)) {
        setErrorMessage(result?.errorMessage || 'Could not parse a recipe from that URL.');
        setStage(STAGE.ERROR);
        return;
      }
      const matchResults = matchRecipeIngredients(result.ingredients, knownNames);
      setParsed({ title: result.title, finalUrl: result.finalUrl });
      setMatched(matchResults);
      // Default-include all rows that matched something.
      const initialIncluded = new Set();
      matchResults.forEach((m, i) => { if (m.matched) initialIncluded.add(i); });
      setIncluded(initialIncluded);
      setStage(STAGE.PREVIEW);
    } catch (err) {
      const msg = err?.message || 'Sign in (the URL parser requires an account) or try a different URL.';
      setErrorMessage(msg);
      setStage(STAGE.ERROR);
    }
  };

  const handleToggleIncluded = (idx) => {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleAddToBowl = () => {
    const names = matched
      .map((m, i) => (included.has(i) ? m.matched : null))
      .filter(Boolean);
    setRecipeHandoff({
      source: 'make-weblink',
      ingredients: names,
      image: null,
      recipeType: null,
      mode: 'recipe',
      title: parsed?.title || '',
      sourceUrl: parsed?.finalUrl || url,
      ts: Date.now(),
    });
    setRecipeMounted(true);
    setActiveTab('recipe');
  };

  const onCardClick = (id) => {
    if (id === 'existing') return handleExisting();
    if (id === 'scratch') return handleScratch();
    if (id === 'photo') return handlePhotoCardClick();
    if (id === 'weblink') { setStage(STAGE.URL_INPUT); return; }
  };

  const refForCard = (id) => (id === 'existing' ? firstCardRef : null);

  const hits = matched.filter((m) => m.matched).length;

  return (
    <div
      role="region"
      aria-label="Make a recipe"
      data-testid="make-recipe-start"
      className="flex flex-col items-center justify-center px-4"
      style={{ minHeight: 'calc(100vh - var(--nav-h))' }}
    >
      <div className="w-full max-w-md flex flex-col gap-4">
        {stage === STAGE.CARDS && CARDS.map((c) => (
          <button
            key={c.id}
            ref={refForCard(c.id)}
            type="button"
            data-testid={`make-card-${c.id}`}
            aria-label={`${c.title}. ${c.subtitle}`}
            onClick={() => onCardClick(c.id)}
            className="relative w-full rounded-xl border border-[#1e1e2e] bg-[#12203b] p-5 sm:p-6 text-left transition-colors hover:bg-[#16284a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
            style={{ minHeight: 44 }}
          >
            <span
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
              style={{ backgroundColor: c.accent }}
              aria-hidden="true"
            />
            <div className="flex items-center gap-4 pl-2">
              <div
                className="flex items-center justify-center w-20 h-20 rounded-lg bg-[#0a1428]/60 text-4xl"
                aria-hidden="true"
              >
                {c.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base sm:text-lg font-semibold text-cyan-100">
                  {c.title}
                </div>
                <div className="text-sm text-cyan-300/80 mt-1">{c.subtitle}</div>
              </div>
            </div>
          </button>
        ))}

        {stage === STAGE.URL_INPUT && (
          <div data-testid="make-weblink-input" className="rounded-xl border border-[#1e1e2e] bg-[#12203b] p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-cyan-100 mb-2">Paste a recipe URL</h2>
            <p className="text-sm text-cyan-300/80 mb-4">
              We'll fetch the page, look for recipe metadata, and match the
              ingredients to your dictionary.
            </p>
            <input
              ref={urlInputRef}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/recipe"
              data-testid="make-weblink-url-input"
              className="w-full rounded-md border border-[#1e1e2e] bg-[#0a1428] px-3 py-2 text-sm text-cyan-100 placeholder:text-cyan-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 mb-4"
              onKeyDown={(e) => { if (e.key === 'Enter') handleParseUrl(); }}
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={resetWebLink}
                className="text-sm text-cyan-300/80 hover:text-cyan-100 underline"
                data-testid="make-weblink-back"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleParseUrl}
                className="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold"
                data-testid="make-weblink-parse-btn"
              >
                Parse recipe
              </button>
            </div>
          </div>
        )}

        {stage === STAGE.PARSING && (
          <div data-testid="make-weblink-parsing" className="rounded-xl border border-[#1e1e2e] bg-[#12203b] p-6 text-center text-cyan-200">
            <div className="text-sm mb-2">Fetching recipe…</div>
            <div className="text-xs text-cyan-300/60">{url}</div>
          </div>
        )}

        {stage === STAGE.ERROR && (
          <div data-testid="make-weblink-error" role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-5">
            <h2 className="text-sm font-semibold text-rose-200 mb-2">Couldn't import that URL</h2>
            <p className="text-sm text-rose-100/80 mb-3">{errorMessage}</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStage(STAGE.URL_INPUT)}
                className="px-3 py-1.5 rounded-md bg-rose-500/30 hover:bg-rose-500/50 text-rose-100 text-xs font-semibold"
                data-testid="make-weblink-error-retry"
              >
                Try a different URL
              </button>
              <button
                type="button"
                onClick={resetWebLink}
                className="text-xs text-rose-100/70 hover:text-rose-50 underline"
              >
                Back to picker
              </button>
            </div>
          </div>
        )}

        {stage === STAGE.PREVIEW && (
          <div data-testid="make-weblink-preview" className="rounded-xl border border-[#1e1e2e] bg-[#12203b] p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-cyan-100 mb-1">
              {parsed?.title || 'Recipe'}
            </h2>
            <p className="text-xs text-cyan-300/60 mb-4">
              We found {hits} known ingredient{hits === 1 ? '' : 's'} out of {matched.length} parsed lines. Tap to include or exclude.
            </p>
            <ul className="space-y-1 mb-4 max-h-[40vh] overflow-y-auto">
              {matched.map((m, i) => {
                const checked = included.has(i);
                const matchedLabel = m.matched
                  ? `${m.matched} (${Math.round((m.confidence || 0) * 100)}%)`
                  : 'no match';
                return (
                  <li key={`m-${i}`} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!m.matched}
                      onChange={() => handleToggleIncluded(i)}
                      data-testid={`make-weblink-row-${i}`}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-cyan-100 truncate">{m.input}</div>
                      <div className={`text-xs ${m.matched ? 'text-emerald-300' : 'text-cyan-300/40'}`}>
                        → {matchedLabel}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={resetWebLink}
                className="text-sm text-cyan-300/80 hover:text-cyan-100 underline"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddToBowl}
                disabled={included.size === 0}
                className="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold"
                data-testid="make-weblink-add-btn"
              >
                Add {included.size} to bowl →
              </button>
            </div>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
        data-testid="make-photo-input"
      />
    </div>
  );
}
