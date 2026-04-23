import { CODEX_TEMPLATES } from '../data/cocktailScoring.js';
import { SAUCE_TEMPLATES } from '../data/sauceScoring.js';

/**
 * RecipeLabTemplates — horizontal strip of canonical starter templates
 * per lab mode. Taps select a template → piped to selectedStructure in
 * RecipeLabMobile → SuggestionDrawer's Balance tab biases suggestions
 * toward filling the template's roles.
 *
 * Mode mapping:
 *   taste → no templates (free-form)
 *   cocktail → CODEX_TEMPLATES (Old Fashioned, Martini, Daiquiri, ...)
 *   sauce → SAUCE_TEMPLATES (Béchamel, Velouté, Espagnole, Tomato, ...)
 */

const FONT_FAMILY = 'Caveat, cursive';

function templatesFor(mode) {
  if (mode === 'cocktail') return CODEX_TEMPLATES;
  if (mode === 'sauce') return SAUCE_TEMPLATES;
  return [];
}

export default function RecipeLabTemplates({ labMode, selected, onSelect, onClear }) {
  const templates = templatesFor(labMode);
  if (templates.length === 0) return null;

  return (
    <div className="relative z-20 mx-2 pb-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      <div className="flex items-center gap-1 flex-nowrap">
        <span
          className="text-xs uppercase tracking-wider pr-1 whitespace-nowrap flex-shrink-0"
          style={{ color: '#a09070', fontFamily: FONT_FAMILY }}
        >Start from</span>
        {templates.map(t => {
          const isActive = selected === t.name;
          return (
            <button
              key={t.name}
              onClick={() => (isActive ? onClear?.() : onSelect?.(t.name))}
              title={`${t.description} · technique: ${t.technique}`}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-sm whitespace-nowrap min-h-[32px] flex-shrink-0 transition-colors"
              style={{
                fontFamily: FONT_FAMILY,
                color: isActive ? '#3a3428' : '#7a6a4a',
                backgroundColor: isActive ? '#e8dcc0' : '#fefae0',
                border: `1px solid ${isActive ? '#8a7a5a' : '#c9b99a'}`,
              }}
            >
              {t.name}
              {isActive && <span className="text-[10px]" style={{ color: '#7a6a4a' }}>×</span>}
            </button>
          );
        })}
      </div>
      {selected && (
        <p
          className="text-[11px] mt-1 px-1"
          style={{ fontFamily: FONT_FAMILY, color: '#5a4a2a' }}
        >
          Building a <span className="font-medium">{selected}</span> — suggestions favor the roles this style needs.
        </p>
      )}
    </div>
  );
}
