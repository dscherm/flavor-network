/**
 * RecipeDirections — "Suggested directions" for the Recipe Notebook.
 *
 * Given the current bowl, retrieves the most set-similar REAL RecipeNLG recipe
 * (FM-DIR1, src/ml/directionsRuntime.js) and shows its verbatim cooking steps,
 * with provenance: which of your ingredients it matches, and which extra
 * ingredients the source recipe also used. Grounded real directions — no
 * generation. Lazy + null-safe: the 2.7MB index loads only when a bowl with
 * enough ingredients exists; any load failure renders nothing.
 */
import { useEffect, useMemo, useState } from 'react';
import { loadDirectionsIndex, retrieveDirections } from '../ml/directionsRuntime.js';

const FONT_FAMILY = 'Caveat, cursive';
const MIN_BOWL = 3; // below this, retrieval matches are too generic to be useful

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

export default function RecipeDirections({ bowlNames = [] }) {
  const [index, setIndex] = useState(null);
  const [vocab, setVocab] = useState(null);
  const [loading, setLoading] = useState(false);

  const enoughIngredients = Array.isArray(bowlNames) && bowlNames.length >= MIN_BOWL;

  // Lazy-load the index + vocab once the bowl is substantial enough to bother.
  useEffect(() => {
    if (!enoughIngredients || index) return undefined;
    let cancelled = false;
    setLoading(true);
    Promise.all([loadDirectionsIndex(), loadRecipeVocab()])
      .then(([idx, vcb]) => {
        if (cancelled) return;
        setIndex(idx);
        setVocab(vcb);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enoughIngredients, index]);

  const match = useMemo(() => {
    if (!index || !vocab || !enoughIngredients) return null;
    const results = retrieveDirections(bowlNames, index, vocab, { k: 1, minOverlap: 2 });
    return results[0] || null;
  }, [index, vocab, bowlNames, enoughIngredients]);

  if (!enoughIngredients) return null;

  return (
    <div className="px-4 pt-3 pb-4" style={{ paddingLeft: 48 }}>
      <div
        className="text-[11px] uppercase tracking-wider mb-1"
        style={{ color: '#a09070', fontFamily: 'inherit' }}
      >
        📋 Suggested directions
      </div>

      {loading && !match && (
        <p className="text-base" style={{ fontFamily: FONT_FAMILY, color: '#b8a88a' }}>
          Finding a similar recipe…
        </p>
      )}

      {!loading && !match && (
        <p className="text-base" style={{ fontFamily: FONT_FAMILY, color: '#b8a88a' }}>
          No close recipe match yet — add a few more ingredients.
        </p>
      )}

      {match && (
        <div>
          <p className="text-sm mb-2" style={{ fontFamily: FONT_FAMILY, color: '#7a6a4a' }}>
            Based on <span style={{ color: '#3a3428' }}>“{match.title}”</span> — matches{' '}
            {match.matchedNames.length} of your ingredient{match.matchedNames.length === 1 ? '' : 's'}
            {' '}({match.matchedNames.join(', ')}).
          </p>
          <ol className="space-y-1.5 list-decimal" style={{ paddingLeft: 20 }}>
            {match.steps.map((step, i) => (
              <li
                key={i}
                className="text-base"
                style={{ fontFamily: FONT_FAMILY, color: '#3a3428', lineHeight: 1.35 }}
              >
                {step}
              </li>
            ))}
          </ol>
          <p className="text-[11px] mt-2" style={{ fontFamily: 'inherit', color: '#b8a88a' }}>
            Real steps from a similar recipe — adapt quantities and ingredients to your bowl.
          </p>
        </div>
      )}
    </div>
  );
}
