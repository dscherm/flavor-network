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
import { TEXT, CHALK_SUB } from '../data/chalkTheme.js';
import { FOCUS, ACCENT, btn } from './inventUi.jsx';

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

export default function RecipeCookingMethod({ bowlNames = [], selected = null, onToggle = null }) {
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
      <div data-testid="cooking-method-chips">
        <div className="text-[13px] mb-1" style={{ fontFamily: TEXT, color: CHALK_SUB }}>
          Likely cooking method{methods.length === 1 ? '' : 's'}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {methods.map((m) => {
            const on = Array.isArray(selected) && selected.includes(m.method);
            return (
              <button
                key={m.method}
                type="button"
                aria-pressed={on}
                data-testid="cooking-method-chip"
                data-method={m.method}
                onClick={() => onToggle?.(m.method)}
                title={`${Math.round(m.frac * 100)}% of similar recipes`}
                className={`inline-flex items-center gap-1 px-3 min-h-[44px] ${FOCUS}`}
                style={btn({ fontSize: 17, textTransform: 'capitalize', ...(on ? { border: `1.5px solid ${ACCENT}` } : {}) })}
              >
                {m.method}
              </button>
            );
          })}
        </div>
      </div>
  );
}
