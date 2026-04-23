import { useMemo, useState } from 'react';
import { matchClassical } from '../data/classicalMatcher.js';

/**
 * ClassicalMatchCard — on-demand "where does this fit?" surface for
 * the Recipe Lab. When the user's recipe matches a classical entry,
 * shows the taxonomy breadcrumb + a directional hint if partial.
 *
 * Collapsed state = single-line pill ("This looks like a Mornay").
 * Expanded state = full breadcrumb + description + sibling variants
 * the user could try by adding ingredient X.
 *
 * When no match (ratio < 0.5), renders null so freeform recipes
 * aren't nagged.
 */

const FONT_FAMILY = 'Caveat, cursive';

export default function ClassicalMatchCard({ labMode, ingredients }) {
  const [expanded, setExpanded] = useState(false);
  const result = useMemo(
    () => matchClassical(labMode, ingredients),
    [labMode, ingredients],
  );

  if (!labMode || (labMode !== 'cocktail' && labMode !== 'sauce')) return null;
  if (!result.complete && !result.partial) return null;

  const anchor = result.complete || result.partial;
  const isComplete = !!result.complete;
  const pathStr = (anchor.path || []).join(' → ');

  return (
    <div className="relative z-20 mx-2 mb-1">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md border transition-colors"
        style={{
          fontFamily: FONT_FAMILY,
          color: isComplete ? '#3a5a2a' : '#5a4a2a',
          backgroundColor: isComplete ? '#e4f1d8' : '#fefae0',
          borderColor: isComplete ? '#8aa87a' : '#c9b99a',
        }}
      >
        <span className="text-xs uppercase tracking-wider opacity-70">
          {isComplete ? 'You built a' : 'This looks like a'}
        </span>
        <span className="text-base font-medium">{anchor.name}</span>
        <span className="text-[10px] opacity-60 tabular-nums ml-auto">
          {Math.round(anchor.ratio * 100)}%
        </span>
        <span className="text-xs opacity-60">{expanded ? '▴' : '▾'}</span>
      </button>

      {expanded && (
        <div
          className="mt-1 px-2.5 py-2 rounded-md border"
          style={{
            fontFamily: FONT_FAMILY,
            backgroundColor: '#fefae0',
            borderColor: '#c9b99a',
            color: '#3a3428',
          }}
        >
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#a09070' }}>
            {result.root?.family || 'Family'}
          </div>
          <div className="text-sm mb-1">{pathStr}</div>
          {anchor.description && (
            <p className="text-xs italic" style={{ color: '#7a6a4a' }}>{anchor.description}</p>
          )}
          {!isComplete && anchor.key_ingredients && (
            <p className="text-[11px] mt-1.5" style={{ color: '#5a4a2a' }}>
              Canonical ingredients: {anchor.key_ingredients.join(', ')}
            </p>
          )}
          {result.allMatches && result.allMatches.length > 1 && (
            <div className="mt-2 pt-2 border-t" style={{ borderColor: '#d8cca8' }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#a09070' }}>
                Nearby variants
              </div>
              <ul className="space-y-0.5">
                {result.allMatches.slice(1, 5).map(m => (
                  <li key={m.name} className="flex items-center gap-1 text-[11px]">
                    <span className="opacity-60">{m.path.slice(0, -1).join(' → ')}{m.path.length > 1 ? ' → ' : ''}</span>
                    <span style={{ color: '#3a3428' }}>{m.name}</span>
                    <span className="text-[9px] opacity-50 tabular-nums ml-auto">
                      {Math.round(m.ratio * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
