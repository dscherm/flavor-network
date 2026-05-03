import { useRef, useCallback } from 'react';
import { hapticSelection } from '../utils/native.js';

const FONT_FAMILY = 'Caveat, cursive';

/**
 * SuggestionDrawerToggle — segmented [ADD] [REPLACE] pill that owns
 * the visible mode of the SuggestionDrawer chip area.
 *
 * Pure presentational. Parent owns the resolved `mode` and the
 * `manualMode` setter that this calls via `onChange`.
 *
 * Props:
 *   mode: 'ADD' | 'REPLACE' — currently active mode
 *   onChange: ('ADD' | 'REPLACE') => void
 *   effectiveBowlSize: number — drives REPLACE disabled state when 0
 *   panelId: string — id of the role=tabpanel below; used by aria-controls
 */
export default function SuggestionDrawerToggle({ mode, onChange, effectiveBowlSize, panelId }) {
  const addRef = useRef(null);
  const replaceRef = useRef(null);

  const replaceDisabled = effectiveBowlSize === 0;

  const handleAddClick = useCallback(() => {
    if (mode !== 'ADD') {
      hapticSelection();
      onChange('ADD');
    }
  }, [mode, onChange]);

  const handleReplaceClick = useCallback(() => {
    if (replaceDisabled) {
      return;
    }
    if (mode !== 'REPLACE') {
      hapticSelection();
      onChange('REPLACE');
    }
  }, [mode, onChange, replaceDisabled]);

  // ←/→ flip the focused tab AND move DOM focus to the other tab.
  const handleKeyDown = useCallback((e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    if (mode === 'ADD' && !replaceDisabled) {
      hapticSelection();
      onChange('REPLACE');
      replaceRef.current?.focus();
    } else if (mode === 'REPLACE') {
      hapticSelection();
      onChange('ADD');
      addRef.current?.focus();
    }
  }, [mode, onChange, replaceDisabled]);

  const baseBtn = 'min-h-[44px] px-3 py-1.5 text-xs rounded-md transition-colors';
  const activeStyle = (active) => ({
    fontFamily: FONT_FAMILY,
    color: active ? '#3a3428' : '#a09070',
    backgroundColor: active ? '#e8dcc0' : 'transparent',
    border: `1px solid ${active ? '#c9b99a' : 'transparent'}`,
  });

  return (
    <div
      role="tablist"
      aria-label="Suggestion mode"
      data-mode={mode}
      className="flex-shrink-0 px-2 pb-1 flex items-center gap-1.5"
    >
      <span
        className="text-[10px] uppercase tracking-wider"
        style={{ color: '#a09070', fontFamily: FONT_FAMILY }}
      >
        Mode
      </span>
      <button
        ref={addRef}
        id={`${panelId}-tab-add`}
        role="tab"
        type="button"
        aria-selected={mode === 'ADD'}
        aria-controls={panelId}
        tabIndex={mode === 'ADD' ? 0 : -1}
        onClick={handleAddClick}
        onKeyDown={handleKeyDown}
        className={baseBtn}
        style={activeStyle(mode === 'ADD')}
      >
        ADD
      </button>
      <button
        ref={replaceRef}
        id={`${panelId}-tab-replace`}
        role="tab"
        type="button"
        aria-selected={mode === 'REPLACE'}
        aria-controls={panelId}
        aria-disabled={replaceDisabled}
        tabIndex={mode === 'REPLACE' ? 0 : -1}
        onClick={handleReplaceClick}
        onKeyDown={handleKeyDown}
        className={baseBtn}
        style={{
          ...activeStyle(mode === 'REPLACE'),
          opacity: replaceDisabled ? 0.5 : 1,
          cursor: replaceDisabled ? 'not-allowed' : 'pointer',
        }}
        data-omc-event={replaceDisabled ? 'replace-disabled-click' : undefined}
      >
        REPLACE
      </button>
    </div>
  );
}
