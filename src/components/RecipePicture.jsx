/**
 * RecipePicture — choose a picture for a recipe (PICTURE-2).
 *
 * Three choices: a chalk drawing (a grid for the recipe's kind), a photo turned into a chalk
 * picture, or no picture. This component stores and uploads nothing: it only calls
 *   onChange({ kind: 'icon', icon })                       a drawing, by stable id (pictureArt.jsx)
 *   onChange({ kind: 'chalk', blob, mime, w, h })          the encoded chalk picture
 *   onChange(null)                                         no picture
 * `value` seeds it with the current choice (same shapes). The original photo is decoded in the
 * browser, held in memory only for re-runs, and released when another photo is picked or this
 * unmounts. `filter` injects the filter functions (tests); the default is the real browser one.
 *
 * "Remove background" (PICTURE-8): on a tap it asks filter.findSubject for a subject map (the model
 * is fetched from this site's own hosting at that moment, never before) and the chalk is drawn only
 * there. Nothing about it is stored: only the finished picture goes to onChange. Any failure leaves
 * the picture drawn without a cut-out, with a sentence, and saving still works.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { PictureArt, picturesFor } from './pictureArt.jsx';
import { TEXT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CONTROL_RADIUS } from '../data/chalkTheme.js';
import { FOCUS, SLATE, ACCENT } from './inventUi.jsx';
import { CHALK_DEFAULTS, CHALK_RANGES, ChalkCancelled } from '../data/chalkFilter.js';
import { loadPhoto, runChalk, toCanvas, encodeChalk, findSubject } from '../data/chalkFilterBrowser.js';
import { cropCentre, CROP_SHAPES } from '../data/pictureCrop.js';

const DEFAULT_FILTER = { loadPhoto, runChalk, toCanvas, encodeChalk, findSubject };

const MODES = [
  { id: 'drawing', label: 'A drawing' },
  { id: 'photo', label: 'A photo as chalk' },
  { id: 'none', label: 'No picture' },
];
const SLIDERS = [
  { key: 'weight', label: 'Line weight' },
  { key: 'detail', label: 'Fine detail' },
  { key: 'shading', label: 'Shading' },
  { key: 'colour', label: 'Colour' },
  { key: 'grain', label: 'Chalk grain' },
  { key: 'focus', label: 'Focus', hint: 'Fade the background' },
];
const CROP_LABEL = { square: 'Square', landscape: 'Landscape' };
const UNREADABLE = "That file can't be opened as a picture here. Try a JPEG or PNG photo.";
const FAILED = "The drawing didn't work out. Try again, or pick a different photo.";
const CUT_LIMITS = 'Clear glass and busy backgrounds may cut badly. The first time downloads about 5 MB.';
const CUT_NOTES = {
  'no-wasm': "This browser can't run the cut-out, so the whole picture is drawn. You can still save it.",
  nothing: "I couldn't find a clear subject in this photo, so the whole picture is drawn. You can still save it.",
  fallback: "The cut-out couldn't run on this device, so the whole picture is drawn. You can still save it.",
};
const CUT_STAGES = {
  loading: 'Getting the cut-out model (about 5 MB, first time only)…',
  finding: 'Finding the subject…',
};

const radius = { borderRadius: CONTROL_RADIUS };
const picked = (on) => (on ? { border: `1.5px solid ${ACCENT}` } : { border: `1px solid ${CHALK_RAIL}` });

function initialMode(value) {
  if (value?.kind === 'icon') return 'drawing';
  if (value?.kind === 'chalk') return 'photo';
  return 'none';
}

export default function RecipePicture({
  kind = 'dish', value = null, onChange, color, filter = DEFAULT_FILTER, debounceMs = 250, initialPhoto = null,
}) {
  const [mode, setMode] = useState(() => initialMode(value));
  const [settings, setSettings] = useState({ ...CHALK_DEFAULTS });
  const [crop, setCrop] = useState('square');
  const [adjust, setAdjust] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | loading | drawing | ready | saving
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [hasPhoto, setHasPhoto] = useState(false);
  const [valueUrl, setValueUrl] = useState(null);
  const [cut, setCut] = useState('off'); // off | finding | on
  const [cutStage, setCutStage] = useState('finding');

  const photoRef = useRef(null);       // decoded original pixels, in memory only
  const runRef = useRef(null);         // { cancel }
  const runIdRef = useRef(0);
  const resultRef = useRef(null);      // chalk pixels of the latest finished run
  const previewRef = useRef(null);
  const timerRef = useRef(null);
  const radioRefs = useRef([]);
  const fileRef = useRef(null);
  const settingsRef = useRef(settings);   // latest settings, for work that finishes later
  settingsRef.current = settings;
  const cutRef = useRef(null);            // { cancel } of a running subject search
  const cutIdRef = useRef(0);
  const cutOnRef = useRef(false);
  const masksRef = useRef({});            // crop shape -> subject map for the current photo

  const cancelRun = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (runRef.current) { runRef.current.cancel(); runRef.current = null; }
  }, []);

  const cancelCut = useCallback(() => {
    cutIdRef.current += 1;
    if (cutRef.current) { cutRef.current.cancel(); cutRef.current = null; }
  }, []);

  const start = useCallback((nextSettings, nextCrop) => {
    const photo = photoRef.current;
    if (!photo) return;
    if (runRef.current) { runRef.current.cancel(); runRef.current = null; }
    const id = runIdRef.current + 1;
    runIdRef.current = id;
    setStatus('drawing');
    setProgress(0);
    setMessage('');
    let handle;
    try {
      handle = filter.runChalk(cropCentre(photo, nextCrop), nextSettings, {
        onProgress: (p) => { if (runIdRef.current === id) setProgress(p); },
        mask: cutOnRef.current ? masksRef.current[nextCrop] : undefined,
      });
    } catch {
      setStatus('idle');
      setMessage(FAILED);
      return;
    }
    runRef.current = handle;
    handle.promise.then((res) => {
      if (runIdRef.current !== id) return;
      runRef.current = null;
      resultRef.current = res;
      const holder = previewRef.current;
      if (holder) {
        const canvas = filter.toCanvas(res);
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.style.display = 'block';
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', 'Chalk picture preview');
        holder.replaceChildren(canvas);
      }
      setStatus('ready');
    }, (err) => {
      if (err instanceof ChalkCancelled || err?.name === 'ChalkCancelled') return;
      if (runIdRef.current !== id) return;
      runRef.current = null;
      setStatus('idle');
      setMessage(FAILED);
    });
  }, [filter]);

  const schedule = useCallback((nextSettings, nextCrop) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { timerRef.current = null; start(nextSettings, nextCrop); }, debounceMs);
  }, [start, debounceMs]);

  // Release everything held for the photo when this goes away.
  useEffect(() => () => {
    runIdRef.current += 1;
    cancelRun();
    cancelCut();
    photoRef.current = null;
    resultRef.current = null;
    masksRef.current = {};
  }, [cancelRun, cancelCut]);

  // A seeded chalk picture is shown from its blob; the object URL is revoked when it changes.
  useEffect(() => {
    if (value?.kind !== 'chalk' || !value.blob || typeof URL === 'undefined' || !URL.createObjectURL) {
      setValueUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(value.blob);
    setValueUrl(url);
    return () => { URL.revokeObjectURL(url); };
  }, [value]);

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    await loadFile(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function loadFile(file) {
    if (!file) return;
    cancelRun();
    cancelCut();
    cutOnRef.current = false;
    masksRef.current = {};
    setCut('off');
    runIdRef.current += 1;
    photoRef.current = null;
    resultRef.current = null;
    if (previewRef.current) previewRef.current.replaceChildren();
    setHasPhoto(false);
    setMessage('');
    setStatus('loading');
    try {
      const image = await filter.loadPhoto(file);
      photoRef.current = image;
      setHasPhoto(true);
      start(settings, crop);
    } catch {
      setStatus('idle');
      setMessage(UNREADABLE);
    }
  }

  // A photo the recipe arrived with (a handoff): drawn once at the default look; nothing is kept until "Use this picture".
  const initialPhotoRef = useRef(initialPhoto);
  useEffect(() => {
    const file = initialPhotoRef.current;
    if (!file) return;
    setMode('photo');
    loadFile(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeSetting(key, raw) {
    const next = { ...settings, [key]: Number(raw) };
    setSettings(next);
    schedule(next, crop);
  }

  function reset() {
    const next = { ...CHALK_DEFAULTS };
    setSettings(next);
    schedule(next, crop);
  }

  // Find the subject for this crop, then draw with it. Any failure draws without it and says why.
  function findAndDraw(shape) {
    const photo = photoRef.current;
    if (!photo) return;
    cancelCut();
    setMessage('');
    setCut('finding');
    setCutStage('finding');
    const id = cutIdRef.current;
    const fallBack = (note) => {
      cutOnRef.current = false;
      setCut('off');
      start(settingsRef.current, shape);
      if (note) setMessage(note);
    };
    let handle;
    try {
      handle = filter.findSubject(cropCentre(photo, shape), {
        onStage: (s) => { if (cutIdRef.current === id) setCutStage(s); },
      });
    } catch (err) {
      fallBack(CUT_NOTES[err?.code] || CUT_NOTES.fallback);
      return;
    }
    cutRef.current = handle;
    handle.promise.then((mask) => {
      if (cutIdRef.current !== id) return;
      cutRef.current = null;
      masksRef.current[shape] = mask;
      cutOnRef.current = true;
      setCut('on');
      start(settingsRef.current, shape);
    }, (err) => {
      if (err instanceof ChalkCancelled || err?.name === 'ChalkCancelled') return;
      if (cutIdRef.current !== id) return;
      cutRef.current = null;
      fallBack(CUT_NOTES[err?.code] || CUT_NOTES.fallback);
    });
  }

  function toggleCut() {
    if (cut === 'finding') {
      cancelCut();
      setCut('off');
      cutOnRef.current = false;
      start(settingsRef.current, crop);
      return;
    }
    if (cut === 'on') {
      cancelCut();
      cutOnRef.current = false;
      setCut('off');
      start(settings, crop);
      return;
    }
    if (masksRef.current[crop]) {
      cutOnRef.current = true;
      setCut('on');
      start(settings, crop);
      return;
    }
    findAndDraw(crop);
  }

  function changeCrop(shape) {
    setCrop(shape);
    if (cut === 'off') { schedule(settings, shape); return; }
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (masksRef.current[shape]) { cutOnRef.current = true; setCut('on'); schedule(settings, shape); return; }
    cutOnRef.current = false;
    findAndDraw(shape);
  }

  async function usePicture() {
    const res = resultRef.current;
    if (!res || status !== 'ready') return;
    setStatus('saving');
    try {
      const out = await filter.encodeChalk(filter.toCanvas(res));
      setStatus('ready');
      onChange?.({ kind: 'chalk', blob: out.blob, mime: out.mime, w: out.w, h: out.h });
    } catch {
      setStatus('ready');
      setMessage(FAILED);
    }
  }

  function pickMode(id) {
    setMode(id);
    if (id === 'none') onChange?.(null);
  }

  function onRadioKey(e, index) {
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % MODES.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index + MODES.length - 1) % MODES.length;
    if (next === null) return;
    e.preventDefault();
    pickMode(MODES[next].id);
    radioRefs.current[next]?.focus();
  }

  const drawings = picturesFor(kind);
  const currentIcon = value?.kind === 'icon' ? value.icon : null;
  const busy = status === 'loading' || status === 'drawing';

  const button = `min-h-[44px] px-3 border text-sm ${FOCUS}`;

  return (
    <div
      className="w-full max-w-full text-left"
      style={{ background: SLATE, color: CHALK_CREAM, border: `1px solid ${CHALK_RAIL}`, borderRadius: CONTROL_RADIUS, padding: 12, boxSizing: 'border-box' }}
      data-testid="recipe-picture"
    >
      <div role="radiogroup" aria-label="Picture for this recipe" className="flex flex-wrap gap-2 mb-3">
        {MODES.map((m, i) => {
          const on = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              ref={(el) => { radioRefs.current[i] = el; }}
              onClick={() => pickMode(m.id)}
              onKeyDown={(e) => onRadioKey(e, i)}
              className={`${button} flex-1`}
              style={{
                ...radius, minWidth: 96, ...picked(on),
                color: on ? CHALK_CREAM : CHALK_DIM, fontFamily: TEXT, fontSize: 18,
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {mode === 'drawing' && (
        <div
          role="radiogroup"
          aria-label="Chalk drawings"
          data-testid="picture-grid"
          className="grid gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))' }}
        >
          {drawings.map((p) => {
            const on = currentIcon === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={p.label}
                data-picture-id={p.id}
                onClick={() => onChange?.({ kind: 'icon', icon: p.id })}
                className={`flex flex-col items-center justify-center border ${FOCUS}`}
                style={{ ...radius, minHeight: 76, minWidth: 44, padding: 4, ...picked(on) }}
              >
                <PictureArt id={p.id} size={48} color={color} />
                <span style={{ fontSize: 11, color: CHALK_DIM, marginTop: 2 }}>{p.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {(mode === 'photo' || hasPhoto) && (
        <div data-testid="picture-photo" hidden={mode !== 'photo'}>
          <label
            className={`flex items-center justify-center border cursor-pointer ${FOCUS} focus-within:outline focus-within:outline-2`}
            style={{ ...radius, minHeight: 44, borderColor: CHALK_RAIL, color: CHALK_CREAM, fontFamily: TEXT, fontSize: 18 }}
          >
            {hasPhoto ? 'Choose a different photo' : 'Take or choose a photo'}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onFile}
              className="sr-only"
              aria-label="Photo to turn into chalk"
            />
          </label>
          <p style={{ fontSize: 12, color: CHALK_SUB, margin: '6px 0 0' }}>
            The photo stays on this device. Only the chalk picture is kept.
          </p>

          {message && <p role="alert" data-testid="picture-message" style={{ color: '#f87171', fontSize: 14, margin: '8px 0 0' }}>{message}</p>}

          {busy && (
            <div role="status" aria-live="polite" data-testid="picture-drawing" style={{ margin: '10px 0', color: CHALK_DIM, fontSize: 14 }}>
              {status === 'loading' ? 'Opening the photo…' : `Drawing… ${Math.round(progress * 100)}%`}
              <div style={{ height: 4, background: CHALK_RAIL, borderRadius: 2, marginTop: 6 }}>
                <div style={{ height: 4, width: `${Math.round((status === 'loading' ? 0 : progress) * 100)}%`, background: CHALK_CREAM, borderRadius: 2 }} />
              </div>
            </div>
          )}

          <div
            ref={previewRef}
            data-testid="picture-preview"
            style={{ marginTop: 10, maxWidth: '100%', background: SLATE, borderRadius: 6, overflow: 'hidden', display: hasPhoto ? 'block' : 'none', opacity: status === 'drawing' ? 0.55 : 1 }}
          />

          {!hasPhoto && valueUrl && (
            <img src={valueUrl} alt="Current chalk picture" data-testid="picture-current" style={{ marginTop: 10, maxWidth: '100%', height: 'auto', borderRadius: 6 }} />
          )}

          {hasPhoto && (
            <>
              <div role="group" aria-label="Crop" className="flex gap-2" style={{ marginTop: 10 }}>
                {CROP_SHAPES.map((shape) => (
                  <button
                    key={shape}
                    type="button"
                    aria-pressed={crop === shape}
                    onClick={() => changeCrop(shape)}
                    className={`${button} flex-1`}
                    style={{ ...radius, ...picked(crop === shape), color: CHALK_CREAM }}
                  >
                    {CROP_LABEL[shape]}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  aria-expanded={adjust}
                  onClick={() => setAdjust((a) => !a)}
                  className={`${button} flex-1`}
                  style={{ ...radius, borderColor: CHALK_RAIL, color: CHALK_CREAM }}
                >
                  Adjust
                </button>
                <button
                  type="button"
                  aria-pressed={cut === 'on'}
                  onClick={toggleCut}
                  className={`${button} flex-1`}
                  style={{ ...radius, ...picked(cut === 'on'), color: CHALK_CREAM }}
                >
                  {cut === 'finding' ? 'Cancel cut-out' : 'Remove background'}
                </button>
                <button
                  type="button"
                  onClick={usePicture}
                  disabled={status !== 'ready'}
                  className={`${button} flex-1 disabled:opacity-40`}
                  style={{ ...radius, borderColor: CHALK_RAIL, color: CHALK_CREAM }}
                >
                  {status === 'saving' ? 'Saving…' : 'Use this picture'}
                </button>
              </div>

              {cut === 'finding' && (
                <p role="status" aria-live="polite" data-testid="picture-cutting" style={{ fontSize: 14, color: CHALK_DIM, margin: '8px 0 0' }}>
                  {CUT_STAGES[cutStage] || CUT_STAGES.finding}
                </p>
              )}
              <p data-testid="picture-cut-limits" style={{ fontSize: 12, color: CHALK_SUB, margin: '6px 0 0' }}>
                {CUT_LIMITS}
              </p>

              {adjust && (
                <div data-testid="picture-sliders" style={{ marginTop: 10 }}>
                  {SLIDERS.map(({ key, label, hint }) => {
                    const r = CHALK_RANGES[key];
                    const id = `picture-slider-${key}`;
                    return (
                      <div key={key} style={{ marginBottom: 6 }}>
                        <div className="flex justify-between" style={{ fontSize: 14 }}>
                          <label htmlFor={id}>{label}</label>
                          <output htmlFor={id} data-testid={`${id}-value`} style={{ color: CHALK_DIM }}>{settings[key]}</output>
                        </div>
                        {hint && <div id={`${id}-hint`} style={{ fontSize: 12, color: CHALK_SUB }}>{hint}</div>}
                        <input
                          id={id}
                          aria-describedby={hint ? `${id}-hint` : undefined}
                          type="range"
                          min={r.min}
                          max={r.max}
                          step={r.step}
                          value={settings[key]}
                          onChange={(e) => changeSetting(key, e.target.value)}
                          className={FOCUS}
                          style={{ width: '100%', minHeight: 44, accentColor: CHALK_CREAM }}
                        />
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={reset}
                    className={`${button} w-full`}
                    style={{ ...radius, borderColor: CHALK_RAIL, color: CHALK_DIM }}
                  >
                    Reset
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
