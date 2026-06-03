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
  // MAKE-PHOTO-NON-IMAGE-FEEDBACK: surface a friendly error when the
  // file picker returns a non-image (PDF, Pages doc, etc. — common on
  // iOS when 'Browse' is wider than the photo library). Was silently
  // early-returning, so the user had no idea anything happened.
  const [photoError, setPhotoError] = useState(null);
  // MAKE-PHOTO-PREVIEW-BEFORE-COMMIT: hold the picked image so the user
  // can confirm it before we jump them to Recipe Lab. pickedFileUrl is
  // an object URL that needs revoking on change/unmount.
  const [pickedFile, setPickedFile] = useState(null);
  const [pickedFileUrl, setPickedFileUrl] = useState(null);
  // MAKE-WEBLINK-MATCH-V2: per-row user edits. Map<idx, string>. A row
  // missing from the map uses the auto-match result; a row present uses
  // the user-typed value (which may be a known ingredient name or not).
  const [userEdits, setUserEdits] = useState(new Map());

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
    setPhotoError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) {
      // User cancelled the picker — no-op, leave any existing error alone.
      return;
    }
    if (!file.type || !file.type.startsWith('image/')) {
      // Picked something — but not an image. Surface inline feedback
      // instead of the previous silent early-return.
      setPhotoError(
        `That looks like a "${file.type || 'unknown'}" file. Pick a photo (jpg, png, heic) and try again.`,
      );
      return;
    }
    setPhotoError(null);
    // MAKE-PHOTO-PREVIEW-BEFORE-COMMIT: stage the pick — don't fire the
    // handoff yet. Show a preview so the user can confirm or swap before
    // we jump them to Recipe Lab. Revoke any previous URL first so we
    // don't leak object URLs across re-picks.
    if (pickedFileUrl) URL.revokeObjectURL(pickedFileUrl);
    const url = typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(file)
      : null;
    setPickedFile(file);
    setPickedFileUrl(url);
  };

  const handleConfirmPhoto = () => {
    if (!pickedFile) return;
    setRecipeHandoff({
      source: 'make-photo',
      ingredients: [],
      image: pickedFile,
      recipeType: null,
      mode: null,
      ts: Date.now(),
    });
    setRecipeMounted(true);
    setActiveTab('recipe');
  };

  const clearPickedPhoto = () => {
    if (pickedFileUrl) URL.revokeObjectURL(pickedFileUrl);
    setPickedFile(null);
    setPickedFileUrl(null);
  };

  const handlePickAnother = () => {
    clearPickedPhoto();
    fileInputRef.current?.click();
  };

  // Revoke the object URL on unmount or when it changes — without this
  // the browser holds the File reference for the page lifetime.
  useEffect(() => {
    const current = pickedFileUrl;
    return () => {
      if (current) URL.revokeObjectURL(current);
    };
  }, [pickedFileUrl]);

  const resetWebLink = () => {
    setStage(STAGE.CARDS);
    setUrl('');
    setErrorMessage(null);
    setParsed(null);
    setMatched([]);
    setIncluded(new Set());
    setUserEdits(new Map());
  };

  // MAKE-WEBLINK-MATCH-V2: dictionary membership check, case-insensitive.
  const knownNameSet = useMemo(
    () => new Set(knownNames.map((n) => String(n).toLowerCase())),
    [knownNames],
  );
  const isKnownName = (s) => {
    const t = String(s ?? '').trim().toLowerCase();
    return !!t && knownNameSet.has(t);
  };

  const getRowName = (i) => {
    if (userEdits.has(i)) return userEdits.get(i);
    return matched[i]?.matched || '';
  };

  const getRowStatus = (i) => {
    const edited = userEdits.has(i);
    const current = getRowName(i);
    if (!current) return 'empty';
    if (!edited) return matched[i]?.matched ? 'auto' : 'empty';
    return isKnownName(current) ? 'user-known' : 'user-unknown';
  };

  const handleEditRow = (i, value) => {
    setUserEdits((prev) => {
      const next = new Map(prev);
      next.set(i, value);
      return next;
    });
    setIncluded((prev) => {
      const next = new Set(prev);
      const trimmed = String(value ?? '').trim();
      if (trimmed && isKnownName(trimmed)) next.add(i);
      else next.delete(i);
      return next;
    });
  };

  const handleResetRow = (i) => {
    setUserEdits((prev) => {
      const next = new Map(prev);
      next.delete(i);
      return next;
    });
    setIncluded((prev) => {
      const next = new Set(prev);
      if (matched[i]?.matched) next.add(i);
      else next.delete(i);
      return next;
    });
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
      // B-version (2026-06-03): add a 25s timeout so the loading screen
      // can't hang indefinitely when the Cloud Function call never
      // resolves (auth-init race, cold-start hang, network drop, etc.).
      const PARSE_TIMEOUT_MS = 25000;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), PARSE_TIMEOUT_MS);
      });
      const res = await Promise.race([
        scrapeRecipe({ url: trimmed }),
        timeoutPromise,
      ]);
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
      // Firebase callable SDK surfaces errors as { code, message, details }
      // where `code` is a gRPC-style string (e.g. 'functions/unauthenticated',
      // 'functions/internal') and `message` is the HttpsError message we
      // threw server-side. Some failure modes (network, app-check) collapse
      // message to the raw code — surface code + message together so the
      // user can tell auth-failure ("unauthenticated") apart from a real
      // server crash ("internal").
      const code = err?.code || '';
      const rawMsg = err?.message || '';
      let msg;
      if (rawMsg === 'timeout') {
        msg = 'The recipe parser timed out after 25 seconds. The site might be slow to respond — try a different recipe URL or paste the ingredients into the cards-grid directly.';
      } else if (code.includes('unauthenticated') || /sign in/i.test(rawMsg)) {
        msg = 'Sign in (the URL parser requires an account), then try again.';
      } else if (code.includes('invalid-argument')) {
        msg = rawMsg || 'That URL was rejected — only http(s) URLs to public recipe pages are allowed.';
      } else if (rawMsg && rawMsg !== 'internal') {
        msg = rawMsg;
      } else {
        msg = `The recipe parser failed (${code || 'unknown error'}). Try a different URL or check the page for a recipe-card meta block.`;
      }
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
      .map((_m, i) => (included.has(i) ? getRowName(i) : null))
      .filter((n) => typeof n === 'string' && n.trim().length > 0);
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
        {stage === STAGE.CARDS && pickedFile && (
          <div
            data-testid="make-photo-preview"
            className="rounded-xl border border-[#1e1e2e] bg-[#12203b] p-5 sm:p-6"
          >
            <h2 className="text-lg font-semibold text-cyan-100 mb-1">
              Use this photo?
            </h2>
            <p className="text-xs text-cyan-300/60 mb-4">
              We'll attach it to your bowl and open Recipe Lab so you can
              add ingredients alongside it.
            </p>
            {pickedFileUrl && (
              <img
                src={pickedFileUrl}
                alt="Selected recipe photo"
                data-testid="make-photo-preview-img"
                className="block w-full max-w-[280px] mx-auto rounded-md object-cover mb-4"
                style={{ maxHeight: 280 }}
              />
            )}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handlePickAnother}
                data-testid="make-photo-preview-pick-another"
                className="text-sm text-cyan-300/80 hover:text-cyan-100 underline"
              >
                Pick another
              </button>
              <button
                type="button"
                onClick={handleConfirmPhoto}
                data-testid="make-photo-preview-confirm"
                className="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold"
              >
                Use this photo →
              </button>
            </div>
          </div>
        )}
        {stage === STAGE.CARDS && !pickedFile && CARDS.map((c) => (
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
        {stage === STAGE.CARDS && !pickedFile && photoError && (
          <div
            role="alert"
            data-testid="make-photo-error"
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-100 text-sm px-4 py-3 flex items-start gap-3"
          >
            <span aria-hidden="true" className="text-lg leading-none">⚠️</span>
            <div className="flex-1 min-w-0">
              <div>{photoError}</div>
              <button
                type="button"
                onClick={handlePhotoCardClick}
                data-testid="make-photo-error-retry"
                className="mt-2 text-amber-200 underline hover:text-amber-50"
              >
                Try again
              </button>
            </div>
          </div>
        )}

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
            <datalist id="make-weblink-ingredient-names">
              {knownNames.slice(0, 2000).map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <ul className="space-y-1 mb-4 max-h-[40vh] overflow-y-auto">
              {matched.map((m, i) => {
                const checked = included.has(i);
                const status = getRowStatus(i);
                const current = getRowName(i);
                const edited = userEdits.has(i);
                const checkboxDisabled = status === 'empty';
                let hint = '';
                let hintColor = 'text-cyan-300/40';
                if (status === 'auto') {
                  const pct = Math.round((m.confidence || 0) * 100);
                  hint = `auto-matched (${pct}%)`;
                  hintColor = 'text-emerald-300/80';
                } else if (status === 'user-known') {
                  hint = 'edited — known ingredient';
                  hintColor = 'text-emerald-300/80';
                } else if (status === 'user-unknown') {
                  hint = 'edited — not in dictionary (include at your own risk)';
                  hintColor = 'text-amber-300/80';
                } else {
                  hint = 'no match — type one in';
                  hintColor = 'text-cyan-300/40';
                }
                return (
                  <li key={`m-${i}`} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={checkboxDisabled}
                      onChange={() => handleToggleIncluded(i)}
                      data-testid={`make-weblink-row-${i}`}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-cyan-100 truncate">{m.input}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-cyan-300/60 text-xs">→</span>
                        <input
                          type="text"
                          list="make-weblink-ingredient-names"
                          value={current}
                          onChange={(e) => handleEditRow(i, e.target.value)}
                          placeholder="ingredient name"
                          data-testid={`make-weblink-row-name-${i}`}
                          className={`flex-1 min-w-0 bg-[#0a1830] border rounded px-2 py-1 text-xs focus:outline-none focus:border-cyan-400 ${
                            status === 'user-unknown'
                              ? 'border-amber-500/50 text-amber-100'
                              : status === 'empty'
                              ? 'border-[#1e1e2e] text-cyan-300/40'
                              : 'border-[#1e1e2e] text-emerald-100'
                          }`}
                        />
                        {edited && (
                          <button
                            type="button"
                            onClick={() => handleResetRow(i)}
                            data-testid={`make-weblink-row-reset-${i}`}
                            title="Reset to auto-match"
                            className="text-xs text-cyan-300/60 hover:text-cyan-100"
                          >
                            ↻
                          </button>
                        )}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${hintColor}`}>
                        {hint}
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
