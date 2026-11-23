/**
 * ShareImages — the "pictures" part of the share sheet (SHARE-5). Instagram and TikTok take no tappable
 * link in a post, so the recipe travels as card images with the short link printed on them.
 *
 * Props
 *   link         "/r/cocktail/negroni" (a built-in's share path) or "/r/<id>" (a user's published copy, which needs `recipe`);
 *                anything else renders nothing
 *   recipe       optional full normalised recipe ({ kind, name, lines, method, ... }); loaded from `link` when absent
 *   bars         optional ready-made chart bars (a user's published copy stores its own); else worked out from `nodes`
 *   picture      optional { src, w, h, kind } (PICTURE-4, from useCardPicture): the recipe's picture, drawn on the cards; absent: no picture
 *   nodes        optional Map of flavor values; when absent only an already-cached copy is used (never a new
 *                download), and the cards are drawn without the chart if there is none
 *   origin       defaults to window.location.origin
 *   loadData / loadNodes / renderFiles   injectable for tests
 * Test ids: share-images, share-choice-count, share-choice-format, share-images-action, share-images-status,
 *   share-caption, share-caption-status, share-story-copy.
 * A failure to draw shows one plain line; Copy link and the rest of the sheet are not touched.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { absoluteShareUrl, captionFor, printedLinkFor, SHARE_CHARTS_ENABLED } from '../data/shareTargets.js';
import { parseSharePath, resolveBuiltIn } from '../data/sharedRecipe.js';
import { barsFor } from '../data/shareCardData.js';
import { defaultLoadData, loadLabelNodes } from '../data/sharedLoaders.js';
import { CHALK_DIM, CHALK_SUB, CHALK_RAIL, ACCENT, FOCUS, btn, heading, textAction } from './inventUi.jsx';
import { chalkRule } from './ChalkIcons.jsx';

import { TEXT } from '../data/chalkTheme.js';
const tap = { minHeight: 44 };
const COUNTS = [{ id: 'one', label: 'One card' }, { id: 'set', label: 'Set of 3' }];
const FORMATS = [{ id: 'portrait', label: 'Feed' }, { id: 'tall', label: 'Story or TikTok' }];

async function defaultRenderFiles(opts) {
  const { renderCardFiles } = await import('../data/shareCardCanvas.js');
  return renderCardFiles(opts);
}

function Choice({ legend, options, value, onChange, testid }) {
  return (
    <div role="group" aria-label={legend} data-testid={testid} className="grid grid-cols-2 gap-2">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)} aria-pressed={value === o.id}
          data-testid={`${testid}-${o.id}`} className={`px-2 ${FOCUS}`}
          style={{ ...btn({ fontSize: 17, ...(value === o.id ? { border: `1.5px solid ${ACCENT}` } : {}) }), ...tap }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function ShareImages({ link = '', recipe: given = null, bars: givenBars = null, picture = null, nodes: givenNodes, origin, loadData = defaultLoadData, loadNodes = loadLabelNodes, renderFiles = defaultRenderFiles }) {
  const route = useMemo(() => parseSharePath(link), [link]);
  const builtIn = route && route.kind && route.slug ? route : null;
  // A user's own published copy (/r/<id>) is drawn from the recipe passed in; there is nothing to load for it.
  const givenKind = given && Array.isArray(given.lines) ? given.kind : null;
  const userCopy = useMemo(() => (!builtIn && route && route.id && givenKind ? { kind: givenKind, slug: route.id } : null), [builtIn, route, givenKind]);
  const target = builtIn || userCopy;
  const [loaded, setLoaded] = useState(null);
  const [loadedNodes, setLoadedNodes] = useState(null);
  const [count, setCount] = useState('one');
  const [format, setFormat] = useState('portrait');
  const [files, setFiles] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [captionNote, setCaptionNote] = useState('');
  const [storyNote, setStoryNote] = useState('');
  const urlsRef = useRef([]);

  const recipe = given && Array.isArray(given.lines) ? given : loaded;

  useEffect(() => {
    if (!target || (given && Array.isArray(given.lines))) return undefined;
    let live = true;
    Promise.resolve().then(() => loadData(target.kind))
      .then((data) => { if (live) setLoaded(resolveBuiltIn(target.kind, target.slug, data)); })
      .catch(() => { if (live) setError('Could not get this recipe ready for pictures.'); });
    return () => { live = false; };
  }, [target, given, loadData]);

  useEffect(() => {
    if (givenNodes !== undefined || !SHARE_CHARTS_ENABLED) return undefined;
    let live = true;
    Promise.resolve().then(() => loadNodes()).then((n) => { if (live) setLoadedNodes(n instanceof Map ? n : null); }).catch(() => { if (live) setLoadedNodes(null); });
    return () => { live = false; };
  }, [givenNodes, loadNodes]);

  const nodes = givenNodes !== undefined ? givenNodes : loadedNodes;
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const fullLink = target ? absoluteShareUrl(link, base) : '';
  const printed = target ? printedLinkFor(link, base) : '';

  // Draw ahead of the tap: navigator.share must be called straight from the tap, with nothing awaited first.
  useEffect(() => {
    if (!recipe || !target) return undefined;
    let live = true;
    setFiles(null); setError(''); setNote('');
    Promise.resolve()
      .then(() => renderFiles({ recipe: picture ? { ...recipe, picture } : recipe, bars: !SHARE_CHARTS_ENABLED ? [] : Array.isArray(givenBars) ? givenBars : barsFor(recipe, nodes), link: printed, count, format, slug: target.slug }))
      .then((f) => { if (live) setFiles(f); })
      .catch(() => { if (live) setError('Could not draw the pictures. The link still works.'); });
    return () => { live = false; };
  }, [recipe, picture, nodes, givenBars, printed, count, format, target, renderFiles]);

  useEffect(() => () => { urlsRef.current.forEach((u) => URL.revokeObjectURL(u)); urlsRef.current = []; }, []);

  if (!target) return null;

  const canShareFiles = !!files && typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
    && (() => { try { return navigator.canShare({ files }); } catch { return false; } })();

  const share = async () => {
    if (!files) return;
    try { await navigator.share({ files, title: recipe?.name || 'Recipe' }); } catch { /* cancelled (AbortError) or refused */ }
  };
  const download = () => {
    if (!files) return;
    files.forEach((f) => {
      const url = URL.createObjectURL(f);
      urlsRef.current.push(url);
      const a = document.createElement('a');
      a.href = url; a.download = f.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => { URL.revokeObjectURL(url); urlsRef.current = urlsRef.current.filter((u) => u !== url); }, 4000);
    });
    setNote(files.length > 1 ? 'Saved 3 pictures' : 'Saved the picture');
  };
  const copyText = async (text, setter, done) => {
    try { await navigator.clipboard.writeText(text); setter(done); } catch { setter('Could not copy. Select the text yourself.'); }
  };

  const waiting = !files && !error;
  return (
    <section data-testid="share-images" aria-label="Share as pictures" className="mt-4 min-w-0">
      <div style={{ color: CHALK_RAIL }} aria-hidden="true">{chalkRule()}</div>
      <h3 className="mt-3" style={{ ...heading, fontSize: 22 }}>As pictures</h3>
      <p className="text-[14px] mt-0.5" style={{ fontFamily: TEXT, color: CHALK_DIM }}>
        For Instagram and TikTok. The link is printed on every card.
      </p>
      <div className="mt-2 flex flex-col gap-2">
        <Choice legend="How many cards" options={COUNTS} value={count} onChange={setCount} testid="share-choice-count" />
        <Choice legend="Where you will post" options={FORMATS} value={format} onChange={setFormat} testid="share-choice-format" />
        <button type="button" onClick={canShareFiles ? share : download} disabled={!files} data-testid="share-images-action"
          className={`w-full px-4 ${FOCUS}`} style={{ ...btn(), ...tap, opacity: files ? 1 : 0.55 }}>
          {canShareFiles ? 'Share images' : 'Download images'}
        </button>
        <p role="status" data-testid="share-images-status" className="text-[14px] min-h-[1.25rem]"
          style={{ fontFamily: TEXT, color: error ? '#f87171' : CHALK_SUB }}>
          {error || (waiting ? 'Drawing the pictures...' : note)}
        </p>
        <button type="button" onClick={() => copyText(captionFor(recipe || { name: '', kind: target.kind }, fullLink), setCaptionNote, 'Caption copied')}
          data-testid="share-caption" className={FOCUS} style={textAction({ fontSize: 17, alignSelf: 'flex-start' })}>
          Copy caption
        </button>
        <p role="status" data-testid="share-caption-status" className="text-[14px] min-h-[1.25rem]" style={{ fontFamily: TEXT, color: CHALK_DIM }}>{captionNote}</p>
        <p className="text-[14px]" style={{ fontFamily: TEXT, color: CHALK_DIM }}>
          Posting a Story? Copy the link and add it as a link sticker.{' '}
          <button type="button" onClick={() => copyText(fullLink, setStoryNote, 'Link copied')} data-testid="share-story-copy"
            className={FOCUS} style={textAction({ fontSize: 14 })}>
            Copy the link
          </button>
          <span role="status" data-testid="share-story-status" style={{ color: CHALK_DIM }}>{storyNote}</span>
        </p>
      </div>
    </section>
  );
}
