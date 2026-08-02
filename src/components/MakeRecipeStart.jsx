import React, { useEffect, useMemo, useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase.js';
import { matchRecipeIngredients } from '../data/parseRecipeIngredient.js';
import useAuth from '../hooks/useAuth.js';
import {
  FONT,
  CHALK_CREAM,
  CHALK_DIM,
  CHALK_SUB,
  CHALK_RAIL,
  CHALK_SHADOW,
} from '../data/chalkTheme.js';

// Chalk line-art glyphs for the picker cards (replaces emoji). Stroked in
// the card's accent color — matches the KitchenIcon / SubgroupGlyph style.
function MakeGlyph({ kind, color, size = 44 }) {
  const s = {
    fill: 'none',
    stroke: color,
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  let inner;
  switch (kind) {
    case 'book': // open book
      inner = (
        <>
          <path d="M12 6 C9.5 4.5 6 4.5 4 5.5 L4 18 C6 17 9.5 17 12 18.5" {...s} />
          <path d="M12 6 C14.5 4.5 18 4.5 20 5.5 L20 18 C18 17 14.5 17 12 18.5" {...s} />
          <path d="M12 6 L12 18.5" {...s} />
        </>
      );
      break;
    case 'pencil': // pencil / edit
      inner = (
        <>
          <path d="M5 19 L5 16 L15 6 L18 9 L8 19 Z" {...s} />
          <path d="M14 7 L17 10" {...s} />
          <path d="M5 19 L8 19" {...s} />
        </>
      );
      break;
    case 'camera':
      inner = (
        <>
          <path d="M4 8 L8 8 L9.5 6 L14.5 6 L16 8 L20 8 L20 18 L4 18 Z" {...s} />
          <circle cx="12" cy="13" r="3.2" {...s} />
        </>
      );
      break;
    case 'link': // chain link
      inner = (
        <>
          <path d="M9.5 14.5 L14.5 9.5" {...s} />
          <path d="M8 11 L6 13 a3 3 0 0 0 4.2 4.2 L12 15.5" {...s} />
          <path d="M16 13 L18 11 a3 3 0 0 0 -4.2 -4.2 L12 8.5" {...s} />
        </>
      );
      break;
    default:
      inner = <circle cx="12" cy="12" r="4" {...s} />;
      break;
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {inner}
    </svg>
  );
}

// Shared chalk-slate panel style for the inner stages (URL input, parsing,
// preview, error, photo preview).
const slatePanelStyle = {
  background: 'rgba(255,255,255,0.025)',
  border: `2px double ${CHALK_RAIL}`,
  boxShadow: 'inset 0 0 0 1px #6a6a6a55, 0 8px 24px rgba(0,0,0,0.55)',
};

// Chalk cream primary action button style.
const creamButtonStyle = {
  fontFamily: FONT,
  color: '#0a0a0a',
  background: CHALK_CREAM,
  border: `1px solid ${CHALK_CREAM}`,
};

// Dark slate text-input style (readable sans, not Caveat).
const slateInputStyle = {
  background: 'rgba(255,255,255,0.05)',
  border: `1px solid ${CHALK_RAIL}`,
  color: CHALK_CREAM,
};

const CARDS = [
  {
    id: 'existing',
    glyph: 'book',
    title: 'Existing recipe',
    subtitle: 'Pick from your Cookbook',
    accent: '#a78bfa',
  },
  {
    id: 'scratch',
    glyph: 'pencil',
    title: 'Start from scratch',
    subtitle: 'Empty Recipe Lab',
    accent: '#38bdf8',
  },
  {
    id: 'photo',
    glyph: 'camera',
    title: 'Upload a photo',
    subtitle: "We'll attach the image; you add ingredients by hand",
    accent: '#f472b6',
  },
  {
    id: 'weblink',
    glyph: 'link',
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

/**
 * WEBLINK-4: turn a server errorMessage into copy that tells the user what
 * to do next. The two failures they'll actually hit are "the site refused
 * us" and "the page has no recipe card", and those want different advice —
 * try another site vs. this isn't a recipe page. Everything else falls
 * through to the server's own wording, which is already user-facing.
 */
export function describeServerFailure(serverMessage, result = null) {
  const msg = serverMessage || '';
  // WEBLINK-8: Apple News is its own failure, keyed on the structured field
  // rather than on prose. apple.news serves an "open in the News app"
  // interstitial that names the recipe but never links the publisher's page,
  // so there is nothing to import — but we can prove we read the right
  // article, which is the difference between a bug and a limitation.
  if (result?.appleNews) {
    return msg || 'Apple News links don\'t include the original recipe page, so we can\'t read the ingredients.';
  }
  if (/blocked the import|HTTP \d{3}/i.test(msg)) {
    return 'That site blocked the import — it refuses automated requests. Try the recipe on a different site, or add the ingredients by hand.';
  }
  if (/no recipe markup/i.test(msg)) {
    return msg;
  }
  return msg || 'Could not parse a recipe from that URL.';
}

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
  const signInPanelRef = useRef(null);

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
  // WEBLINK-4 (2026-07-31): the parse used to fire before we knew whether
  // the user was signed in, so a signed-out user watched a 25s spinner and
  // then hit a dead-end error screen. Hold the URL instead and let the
  // auth-resolution effect below decide: parse it, or ask them to sign in
  // and parse it for them afterwards. `null` means nothing is waiting.
  // WEBLINK-9 (2026-08-01): a fresh object per attempt, not a bare string.
  // Re-tapping Parse with the SAME url wrote identical state, React bailed
  // out, and the effect below never re-ran — so the retry silently did
  // nothing. The nonce guarantees every tap is a new attempt.
  const [pendingParse, setPendingParse] = useState(null);
  const parseAttempt = useRef(0);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  const { user, loading: authLoading, authError, loginWithGoogle, loginWithApple } = useAuth();

  useEffect(() => {
    if (stage === STAGE.CARDS) firstCardRef.current?.focus();
    if (stage === STAGE.URL_INPUT) urlInputRef.current?.focus();
  }, [stage]);

  // WEBLINK-4: a queued URL waits here until auth is known. Signed in ->
  // parse it. Signed out -> show the inline sign-in prompt and keep waiting;
  // when sign-in resolves, `user` flips and this fires again with the URL
  // still queued, so the parse resumes without the user retyping anything.
  useEffect(() => {
    if (!pendingParse || authLoading) return;
    if (!user) {
      setNeedsSignIn(true);
      // WEBLINK-17: the panel renders BELOW the URL input, so on a phone it
      // can appear entirely off-screen — the tap then looks like it did
      // nothing at all, which is exactly how it was reported. Bring it into
      // view so the state change is visible.
      requestAnimationFrame(() => {
        signInPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }
    setNeedsSignIn(false);
    setPendingParse(null);
    runParse(pendingParse.url);
    // runParse is intentionally out of deps: it's recreated every render and
    // including it would re-fire the parse on unrelated state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingParse, authLoading, user]);

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
    setPendingParse(null);
    setNeedsSignIn(false);
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

  const handleParseUrl = () => {
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
    // The URL is well-formed. Whether it gets parsed now or after sign-in is
    // the auth effect's call — queue it either way so the typed URL survives
    // a sign-in round trip.
    setErrorMessage(null);
    parseAttempt.current += 1;
    setPendingParse({ url: trimmed, attempt: parseAttempt.current });
  };

  const runParse = async (trimmed) => {
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
        setErrorMessage(describeServerFailure(result?.errorMessage, result));
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
            className="rounded-xl p-5 sm:p-6"
            style={slatePanelStyle}
          >
            <h2
              className="text-2xl mb-1"
              style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}
            >
              Use this photo?
            </h2>
            <p className="text-xs mb-4" style={{ color: CHALK_SUB }}>
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
                className="text-base underline"
                style={{ fontFamily: FONT, color: CHALK_DIM }}
              >
                Pick another
              </button>
              <button
                type="button"
                onClick={handleConfirmPhoto}
                data-testid="make-photo-preview-confirm"
                className="px-4 py-2 rounded-md text-base"
                style={creamButtonStyle}
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
            className="relative w-full rounded-xl p-5 sm:p-6 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            style={{
              minHeight: 44,
              background: 'radial-gradient(ellipse at center, #1c1c1c 0%, #0e0e0e 100%)',
              border: `2px double ${c.accent}`,
              boxShadow: 'inset 0 0 0 1px #6a6a6a55, 0 8px 24px rgba(0,0,0,0.55)',
            }}
          >
            <span
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ background: c.accent }}
              aria-hidden="true"
            />
            <div className="flex items-center gap-4 pl-2">
              <div
                className="flex items-center justify-center w-20 h-20 rounded-lg"
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid #6a6a6a55',
                }}
                aria-hidden="true"
              >
                <MakeGlyph kind={c.glyph} color={c.accent} size={44} />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-2xl"
                  style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}
                >
                  {c.title}
                </div>
                <div className="text-lg mt-0.5" style={{ fontFamily: FONT, color: CHALK_DIM }}>
                  {c.subtitle}
                </div>
              </div>
            </div>
          </button>
        ))}
        {stage === STAGE.CARDS && !pickedFile && photoError && (
          <div
            role="alert"
            data-testid="make-photo-error"
            className="rounded-lg text-amber-100 text-sm px-4 py-3 flex items-start gap-3"
            style={{
              background: 'rgba(255,255,255,0.025)',
              border: '2px double rgba(245,158,11,0.5)',
              boxShadow: 'inset 0 0 0 1px #6a6a6a55, 0 8px 24px rgba(0,0,0,0.55)',
            }}
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
          <div data-testid="make-weblink-input" className="rounded-xl p-5 sm:p-6" style={slatePanelStyle}>
            <h2
              className="text-2xl mb-2"
              style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}
            >
              Paste a recipe URL
            </h2>
            <p className="text-sm mb-4" style={{ color: CHALK_DIM }}>
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
              className="w-full rounded-md px-3 py-2 text-sm placeholder:text-[#8a8478] focus:outline-none focus:ring-2 focus:ring-white/20 mb-4"
              style={slateInputStyle}
              onKeyDown={(e) => { if (e.key === 'Enter') handleParseUrl(); }}
            />
            {/* WEBLINK-4: shown only after a parse is queued and auth has
                resolved to signed-out. The URL stays in the input, and the
                queued parse resumes on its own once sign-in completes. */}
            {needsSignIn && (
              <div
                ref={signInPanelRef}
                data-testid="make-weblink-signin"
                className="rounded-lg p-4 mb-4"
                style={{ border: `1px solid ${CHALK_RAIL}`, background: 'rgba(0,0,0,0.15)' }}
              >
                <div className="text-base mb-1" style={{ fontFamily: FONT, color: CHALK_CREAM }}>
                  Sign in to import from a link
                </div>
                <p className="text-sm mb-3" style={{ color: CHALK_DIM }}>
                  Importing fetches the page on your behalf, so it needs an
                  account. Your URL is saved — we'll pick up right where you
                  left off.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={loginWithGoogle}
                    className="px-4 py-2 rounded-md text-base"
                    style={creamButtonStyle}
                    data-testid="make-weblink-signin-google"
                  >
                    Sign in with Google
                  </button>
                  <button
                    type="button"
                    onClick={loginWithApple}
                    className="px-4 py-2 rounded-md text-base"
                    style={creamButtonStyle}
                    data-testid="make-weblink-signin-apple"
                  >
                    Sign in with Apple
                  </button>
                </div>
                {/* WEBLINK-10: sign-in used to fail silently — the rejection
                    went to console.error and the panel never changed, which
                    on a phone is indistinguishable from a dead button. */}
                {authError && (
                  <p
                    className="text-sm mt-3"
                    style={{ color: '#fda4af' }}
                    data-testid="make-weblink-signin-error"
                    role="alert"
                  >
                    {authError}
                  </p>
                )}
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={resetWebLink}
                className="text-base underline"
                style={{ fontFamily: FONT, color: CHALK_DIM }}
                data-testid="make-weblink-back"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleParseUrl}
                className="px-4 py-2 rounded-md text-base"
                style={creamButtonStyle}
                data-testid="make-weblink-parse-btn"
              >
                Parse recipe
              </button>
            </div>
          </div>
        )}

        {stage === STAGE.PARSING && (
          <div data-testid="make-weblink-parsing" className="rounded-xl p-6 text-center" style={slatePanelStyle}>
            <div className="text-2xl mb-2" style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}>Fetching recipe…</div>
            <div className="text-xs break-all" style={{ color: CHALK_SUB }}>{url}</div>
          </div>
        )}

        {stage === STAGE.ERROR && (
          <div
            data-testid="make-weblink-error"
            role="alert"
            className="rounded-xl p-5"
            style={{
              background: 'rgba(255,255,255,0.025)',
              border: '2px double rgba(244,63,94,0.5)',
              boxShadow: 'inset 0 0 0 1px #6a6a6a55, 0 8px 24px rgba(0,0,0,0.55)',
            }}
          >
            <h2 className="text-xl mb-2" style={{ fontFamily: FONT, color: '#fda4af' }}>Couldn't import that URL</h2>
            <p className="text-sm mb-3 text-rose-100/80">{errorMessage}</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStage(STAGE.URL_INPUT)}
                className="px-3 py-1.5 rounded-md bg-rose-500/30 hover:bg-rose-500/50 text-rose-100 text-base"
                style={{ fontFamily: FONT }}
                data-testid="make-weblink-error-retry"
              >
                Try a different URL
              </button>
              <button
                type="button"
                onClick={resetWebLink}
                className="text-base text-rose-100/70 hover:text-rose-50 underline"
                style={{ fontFamily: FONT }}
              >
                Back to picker
              </button>
            </div>
          </div>
        )}

        {stage === STAGE.PREVIEW && (
          <div data-testid="make-weblink-preview" className="rounded-xl p-5 sm:p-6" style={slatePanelStyle}>
            <h2
              className="text-2xl mb-1"
              style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}
            >
              {parsed?.title || 'Recipe'}
            </h2>
            <p className="text-xs mb-4" style={{ color: CHALK_SUB }}>
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
                let hintColor = 'text-[#8a8478]';
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
                  hintColor = 'text-[#8a8478]';
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
                      <div className="truncate" style={{ color: CHALK_CREAM }}>{m.input}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs" style={{ color: CHALK_SUB }}>→</span>
                        <input
                          type="text"
                          list="make-weblink-ingredient-names"
                          value={current}
                          onChange={(e) => handleEditRow(i, e.target.value)}
                          placeholder="ingredient name"
                          data-testid={`make-weblink-row-name-${i}`}
                          className={`flex-1 min-w-0 rounded px-2 py-1 text-xs focus:outline-none focus:border-white/40 ${
                            status === 'user-unknown'
                              ? 'border-amber-500/50 text-amber-100'
                              : status === 'empty'
                              ? 'text-[#8a8478]'
                              : 'text-emerald-100'
                          }`}
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: status === 'user-unknown' ? undefined : `1px solid ${CHALK_RAIL}`,
                          }}
                        />
                        {edited && (
                          <button
                            type="button"
                            onClick={() => handleResetRow(i)}
                            data-testid={`make-weblink-row-reset-${i}`}
                            title="Reset to auto-match"
                            className="text-xs"
                            style={{ color: CHALK_DIM }}
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
                className="text-base underline"
                style={{ fontFamily: FONT, color: CHALK_DIM }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddToBowl}
                disabled={included.size === 0}
                className="px-4 py-2 rounded-md text-base disabled:opacity-40 disabled:cursor-not-allowed"
                style={creamButtonStyle}
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
