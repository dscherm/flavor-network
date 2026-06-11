/**
 * RecipeCookingMethod — "smart cooking method" for the Recipe Notebook.
 *
 * Given the current bowl, finds the most set-similar REAL RecipeNLG recipes
 * (FM-DIR1 index) and surfaces the cooking METHODS they use (sauté, sear,
 * bake, …) as compact chips — a grounded "how would you cook this?" hint,
 * without dumping full directions. Lazy + null-safe.
 */
import { useEffect, useMemo, useState } from 'react';
import { loadDirectionsIndex, retrieveCookingMethods } from '../ml/directionsRuntime.js';

const FONT_FAMILY = 'Caveat, cursive';
const MIN_BOWL = 3;

let _vocabPromise = null;
function loadRecipeVocab(basePath = '') {
  if (!_vocabPromise) {
    _vocabPromise = fetch(`${basePath}/models/recipe_vocab.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.vocab ?? null)
      .catch(() => null);
  }
  return _vocabPromise;
}

const METHOD_EMOJI = {
  'sauté': '🍳', sear: '🔥', roast: '🔥', bake: '🍞', grill: '🔥', broil: '🔥',
  braise: '🍲', simmer: '🍲', boil: '💧', steam: '♨️', poach: '💧', blanch: '💧',
  fry: '🍳', 'stir-fry': '🥢', 'deep-fry': '🍳', caramelize: '🍯', toast: '🍞',
  marinate: '🧂', whisk: '🥄', blend: '🌀', chill: '❄️',
};

export default function RecipeCookingMethod({ bowlNames = [] }) {
  const [index, setIndex] = useState(null);
  const [vocab, setVocab] = useState(null);

  const enough = Array.isArray(bowlNames) && bowlNames.length >= MIN_BOWL;

  useEffect(() => {
    if (!enough || index) return undefined;
    let cancelled = false;
    Promise.all([loadDirectionsIndex(), loadRecipeVocab()]).then(([idx, vcb]) => {
      if (cancelled) return;
      setIndex(idx);
      setVocab(vcb);
    });
    return () => { cancelled = true; };
  }, [enough, index]);

  const methods = useMemo(() => {
    if (!index || !vocab || !enough) return [];
    return retrieveCookingMethods(bowlNames, index, vocab, { k: 8, topN: 3 }).methods;
  }, [index, vocab, bowlNames, enough]);

  if (!enough || methods.length === 0) return null;

  return (
    <div className="px-4 pt-2 pb-3" style={{ paddingLeft: 48 }}>
      <div className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: '#a09070' }}>
        🍳 Likely cooking method{methods.length === 1 ? '' : 's'}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {methods.map((m) => (
          <span
            key={m.method}
            title={`${Math.round(m.frac * 100)}% of similar recipes`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full"
            style={{
              fontFamily: FONT_FAMILY,
              fontSize: 15,
              color: '#5a4a2a',
              background: '#f0e8d0',
              border: '1.5px solid #c9b99a',
              textTransform: 'capitalize',
            }}
          >
            <span aria-hidden="true">{METHOD_EMOJI[m.method] || '🍳'}</span>
            {m.method}
          </span>
        ))}
      </div>
    </div>
  );
}
