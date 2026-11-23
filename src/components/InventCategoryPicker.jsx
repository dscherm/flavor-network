/**
 * InventCategoryPicker — the collapsed, optional row "Going for a particular
 * style? (optional)". Opening it lists the categories with their one-line blurbs
 * and a "No particular style" choice. Controlled: the panel owns value and open.
 *
 * Props
 *   title         string
 *   options       [{ id, label, blurb?, art? }]     art is any node (an icon / swatch)
 *   value         id | null                          the chosen category
 *   onChange      (idOrNull)
 *   open          bool
 *   onToggle      ()
 *   labels        { none, noneBlurb }
 *   testidPrefix  default 'category'
 * Test ids: {p} root, {p}-toggle, {p}-option-{id} (aria-pressed), {p}-none.
 */
import { btn, FOCUS, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, ACCENT } from './inventUi.jsx';
import { ChevronDown, ChevronUp } from './ChalkIcons.jsx';

import { TEXT } from '../data/chalkTheme.js';
export default function InventCategoryPicker({
  title, options = [], value = null, onChange, open = false, onToggle, labels = {}, testidPrefix = 'category',
}) {
  const L = { none: 'No particular style', noneBlurb: 'Choose your own ingredients; we suggest as you go.', ...labels };
  const p = testidPrefix;
  const chosen = options.find((o) => o.id === value);
  const row = (id, label, blurb, art, testid) => (
    <li key={String(id)}>
      <button type="button" onClick={() => onChange(id)} aria-pressed={value === id || (id == null && value == null)} data-testid={testid}
        className={`w-full flex items-center gap-2 px-3 min-h-[44px] text-left ${FOCUS}`}
        style={{ borderRadius: 8, border: `${(value === id || (id == null && value == null)) ? '1.5px' : '1px'} solid ${(value === id || (id == null && value == null)) ? ACCENT : CHALK_RAIL}`, background: 'transparent' }}>
        {art ? <span className="flex-shrink-0" aria-hidden="true">{art}</span> : null}
        <span className="flex-1 min-w-0">
          <span className="block text-[18px]" style={{ fontFamily: TEXT, color: CHALK_CREAM }}>{label}</span>
          {blurb ? <span className="block text-[12px]" style={{ fontFamily: TEXT, color: CHALK_DIM }}>{blurb}</span> : null}
        </span>
      </button>
    </li>
  );
  return (
    <div data-testid={p} className="min-w-0">
      <button type="button" onClick={onToggle} aria-expanded={open} data-testid={`${p}-toggle`}
        className={`w-full flex items-center justify-between gap-2 px-3 min-h-[44px] text-left ${FOCUS}`} style={btn({ fontSize: 18 })}>
        <span className="min-w-0 flex flex-col leading-tight">
          <span className="truncate">{title}</span>
          {chosen ? <span className="truncate" style={{ color: CHALK_CREAM }} data-testid={`${p}-chosen`}>{chosen.label}<span style={{ color: CHALK_SUB, fontSize: 13 }}> chosen</span></span> : null}
        </span>
        <span aria-hidden="true" style={{ color: CHALK_SUB, lineHeight: 0 }}>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>
      {open && (
        <ul className="flex flex-col gap-1.5 mt-2" data-testid={`${p}-options`}>
          {row(null, L.none, L.noneBlurb, null, `${p}-none`)}
          {options.map((o) => row(o.id, o.label, o.blurb, o.art, `${p}-option-${o.id}`))}
        </ul>
      )}
    </div>
  );
}
