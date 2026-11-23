/**
 * IngredientCardProvider — one place that owns the tap-an-ingredient card (BUILDER-4).
 *
 * Mounted once near the app root. A surface only renders <IngredientName name="garlic" /> (a button that opens
 * the card) or <IngredientInfoButton name="garlic" /> (a small "i" beside something whose own tap does another
 * job, such as a suggestion chip that adds). Nothing else is needed on the surface.
 *
 * Provider props
 *   data               useProData() payload; the card reads data.graph (nodes, edges) from it
 *   loadData           optional () => Promise<data>. Only used when `data` has no graph yet: the first tap
 *                      calls it once, shows "Loading the flavor data…", then the card. The app does not pass
 *                      it (the app only mounts its surfaces after the dataset has loaded), so inside the app
 *                      opening a card never fetches anything.
 *   onOpenPairingLab   (name) => void   the "Open in Pairing Lab" button; the button is absent without it
 *
 * Without a provider (a surface rendered on its own, as in most tests, and the public shared recipe page)
 * IngredientName renders plain text and IngredientInfoButton renders nothing.
 *
 * IngredientBuilderScope wraps a builder: names inside it offer "Add to this recipe" (onAdd) and know what is
 * already in the recipe (has).
 */
import { Info } from './ChalkIcons.jsx';
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { resolveCardIngredient } from '../data/ingredientCard.js';

// The card pulls in the Pairing Lab's chalk card; it loads the first time a name is tapped, not with the app.
const IngredientCard = lazy(() => import('./IngredientCard.jsx'));

const CardContext = createContext(null);
const ScopeContext = createContext(null);

export function IngredientBuilderScope({ onAdd, has, addLabel, children }) {
  const value = useMemo(() => ({ onAdd, has, addLabel }), [onAdd, has, addLabel]);
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function IngredientCardProvider({ data = null, loadData = null, onOpenPairingLab = null, children }) {
  const [req, setReq] = useState(null);       // { asked, loose, builder, opener }
  const [view, setView] = useState(null);     // { name, from, strength } after tapping a partner chip
  const [loaded, setLoaded] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const startedRef = useRef(false);
  const lastOpener = useRef(null);

  const effective = data?.graph?.nodes ? data : loaded;
  const nodes = effective?.graph?.nodes || null;

  const known = useCallback((raw, loose = false) => {
    if (!nodes) return null;
    return resolveCardIngredient(raw, nodes, { loose }) !== null;
  }, [nodes]);

  const open = useCallback((raw, opts = {}) => {
    const opener = opts.opener ?? (typeof document !== 'undefined' ? document.activeElement : null);
    lastOpener.current = opener;
    setView(null);
    setReq({ asked: String(raw ?? ''), loose: Boolean(opts.loose), builder: opts.builder || null });
  }, []);

  const close = useCallback(() => { setReq(null); setView(null); }, []);

  // The first tap before the graph exists asks for it, once.
  useEffect(() => {
    if (!req || nodes || !loadData || startedRef.current) return;
    startedRef.current = true;
    Promise.resolve()
      .then(() => loadData())
      .then((d) => { if (d?.graph?.nodes) setLoaded(d); else setLoadFailed(true); })
      .catch(() => setLoadFailed(true));
  }, [req, nodes, loadData]);

  // Closing hands focus back to the name that opened the card.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (req) { wasOpen.current = true; return; }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const el = lastOpener.current;
    lastOpener.current = null;
    if (el && el.isConnected && typeof el.focus === 'function') el.focus();
  }, [req]);

  const resolved = req && nodes ? resolveCardIngredient(req.asked, nodes, { loose: req.loose }) : null;
  const name = view?.name || resolved;
  const status = !req ? 'ready' : nodes ? (name ? 'ready' : 'unknown') : (loadFailed ? 'unknown' : 'loading');

  const ctx = useMemo(() => ({ open, close, known, enabled: true }), [open, close, known]);

  const builder = req?.builder || null;
  const navigate = useCallback((to, strength, from) => setView({ name: to, from, strength }), []);

  return (
    <CardContext.Provider value={ctx}>
      {children}
      {req && (
        <Suspense fallback={null}>
        <IngredientCard
          name={status === 'ready' ? name : null}
          status={status}
          asked={req.asked}
          from={view?.from || null}
          strength={view?.strength ?? null}
          data={effective}
          builder={builder}
          onClose={close}
          onNavigate={navigate}
          onOpenPairingLab={onOpenPairingLab ? (n) => { close(); onOpenPairingLab(n); } : null}
        />
        </Suspense>
      )}
    </CardContext.Provider>
  );
}

const NOOP = { open: () => {}, close: () => {}, known: () => false, enabled: false };

export function useIngredientCard() {
  return useContext(CardContext) || NOOP;
}

function useOpener({ name, loose, onAdd, onSwap, swapFor, addLabel }) {
  const card = useContext(CardContext);
  const scope = useContext(ScopeContext);
  const isKnown = card ? card.known(name, loose) : false;
  const open = (e) => {
    const builder = {
      onAdd: onAdd ?? (onSwap ? undefined : scope?.onAdd),
      has: scope?.has,
      addLabel: addLabel ?? scope?.addLabel,
      onSwap,
      swapFor,
    };
    card.open(name, { loose, opener: e?.currentTarget, builder: (builder.onAdd || builder.onSwap) ? builder : null });
  };
  return { card, isKnown, open };
}

const TEXT_BUTTON = {
  background: 'none', border: 'none', margin: 0, padding: 0, font: 'inherit', color: 'inherit', textAlign: 'inherit',
  cursor: 'pointer', textDecoration: 'underline dotted', textDecorationColor: 'rgba(245,239,222,0.5)', textUnderlineOffset: 4,
  maxWidth: '100%',
};

/**
 * A tappable ingredient name. Plain text when there is no provider, when the name is empty, or when the
 * dataset has loaded and the app has no card for it (a free-text line).
 *   loose    also accept recipe-line text ("2 oz gin, London dry") and loosely matched names
 *   tall     give the button a 44 px target (rows where the name is the main control)
 *   variant  'text' (default: looks like the text around it, dotted underline) | 'raw' (the caller styles it)
 *   onAdd / onSwap / swapFor / addLabel   what the card offers; defaults to the enclosing builder scope's add
 */
export function IngredientName({
  name, children, loose = false, tall = false, variant = 'text', className = '', style, testid,
  onAdd, onSwap, swapFor, addLabel, ariaName, ...rest
}) {
  const { card, isKnown, open } = useOpener({ name, loose, onAdd, onSwap, swapFor, addLabel });
  const label = children ?? name;
  if (!card || !name || isKnown === false) return <span className={className} style={style} data-testid={testid} {...rest}>{label}</span>;
  const base = variant === 'raw' ? {} : { ...TEXT_BUTTON, ...(tall ? { minHeight: 44, display: 'inline-flex', alignItems: 'center' } : {}) };
  return (
    <button type="button" onClick={open} aria-label={`About ${ariaName || name}`} data-testid={testid} data-ingredient-link={name}
      className={`${className} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`.trim()}
      style={{ outlineColor: '#f5efde', ...base, ...style }} {...rest}>
      {label}
    </button>
  );
}

/** A small "i" button beside something whose own tap does another job. Renders nothing when there is no card. */
export function IngredientInfoButton({ name, loose = false, onAdd, onSwap, swapFor, addLabel, testid, className = '', style }) {
  const { card, isKnown, open } = useOpener({ name, loose, onAdd, onSwap, swapFor, addLabel });
  if (!card || !name || isKnown === false) return null;
  return (
    <button type="button" onClick={open} aria-label={`About ${name}`} data-testid={testid} data-ingredient-info={name}
      className={`inline-flex items-center justify-center rounded-full flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`.trim()}
      style={{ minWidth: 44, minHeight: 44, background: 'none', border: 'none', color: '#bdb6a3', cursor: 'pointer', outlineColor: '#f5efde', ...style }}>
      <Info size={20} />
    </button>
  );
}
