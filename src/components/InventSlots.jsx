/**
 * InventSlots — renders an inventBuild Build (slots + extras) and reports the
 * user's intent upward. Lab-agnostic: it knows nothing about cocktails,
 * sauces or dishes; the lab supplies rankings, amounts and refusal text.
 *
 * Props
 *   build            Build from src/data/inventBuild.js
 *   shortlistFor     (slotId) → [{ key, have?, note? }]   ranked candidates, called when a slot is opened
 *   amountFor        (key) → string | undefined            shown beside the pick
 *   onPick           (slotId, textOrKey) → void | false    a shortlist pick or typed text (raw; the lab normalises).
 *                                                           Return false when refused to keep the slot open.
 *   onClear          (slotId)
 *   onAddExtra       (text) → void | false                 typed text (raw)
 *   onRemoveExtra    (key)
 *   notice           string | null                         a refusal reason to show
 *   color            accent colour (defaults to chalk cream)
 *   labels           copy overrides (see DEFAULT_LABELS); `notHave` (no default) marks a line whose `have` is false, e.g. "you'd need"
 *   testidPrefix     default 'slots'
 */
import { useState } from 'react';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL } from '../data/chalkTheme.js';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const DEFAULT_LABELS = {
  needed: 'needed',
  optional: 'empty — optional',
  choose: 'Change',
  fill: 'Choose',
  close: 'Close',
  fromSearch: 'from your search',
  locked: 'locked',
  inBar: 'have',
  clear: 'Clear',
  typePlaceholder: 'or type any ingredient',
  use: 'Use',
  noCandidates: 'Nothing on the list fits — type one below.',
  extras: 'Extras',
  extrasEmpty: 'None yet.',
  addPlaceholder: '+ add an ingredient',
  add: 'Add',
  remove: 'Remove',
};

const btn = (extra = {}) => ({ fontFamily: FONT, fontSize: 18, border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM, ...extra });
const inputStyle = { fontFamily: SANS, fontSize: 16, color: CHALK_CREAM, background: 'rgba(255,255,255,0.05)', border: `1px solid ${CHALK_RAIL}` };

function TextAdd({ placeholder, buttonLabel, onSubmit, testid, buttonTestid, label }) {
  const [text, setText] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    if (onSubmit(t) !== false) setText('');
  };
  return (
    <form onSubmit={submit} className="flex gap-1.5 min-w-0">
      <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={label}
        data-testid={testid} className="flex-1 min-w-0 px-3 rounded-lg min-h-[44px]" style={inputStyle} />
      <button type="submit" data-testid={buttonTestid} className="px-3 rounded-lg min-h-[44px] flex-shrink-0" style={btn()}>{buttonLabel}</button>
    </form>
  );
}

function SlotRow({ slot, amount, shortlistFor, onPick, onClear, L, p, color }) {
  const [open, setOpen] = useState(false);
  const line = slot.line;
  const empty = !line;
  const options = open ? shortlistFor(slot.id) || [] : [];
  const pick = (value) => {
    const r = onPick(slot.id, value);
    if (r !== false) setOpen(false);
    return r;
  };
  const mark = line && slot.locked ? (line.source === 'search' ? L.fromSearch : L.locked) : null;
  return (
    <li className="rounded-lg px-2 py-1.5" data-testid={`${p}-slot-${slot.id}`} data-empty={empty ? 'true' : 'false'}
      style={{ border: `1px ${empty && slot.required ? 'dashed' : 'solid'} ${empty && slot.required ? color : CHALK_RAIL}` }}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[13px] w-16 flex-shrink-0 text-right" style={{ fontFamily: SANS, color: CHALK_DIM }} data-testid={`${p}-amount-${slot.id}`}>
          {line ? amount || '' : ''}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[20px] truncate" style={{ fontFamily: FONT, color: line ? CHALK_CREAM : CHALK_DIM }} data-testid={`${p}-line-${slot.id}`}>
            {line ? line.key : (slot.required ? L.needed : L.optional)}
          </span>
          <span className="block text-[11px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>
            {slot.label}{mark ? ` · 🔒 ${mark}` : ''}{line?.have ? ` · ${L.inBar}` : ''}
            {line && line.have === false && L.notHave ? <span data-testid={`${p}-need`}> · {L.notHave}</span> : null}
          </span>
        </span>
        {line && (
          <button type="button" onClick={() => onClear(slot.id)} aria-label={`${L.clear} ${slot.label}`} data-testid={`${p}-clear-${slot.id}`}
            className="min-h-[44px] min-w-[44px] rounded-lg flex-shrink-0" style={btn({ fontSize: 20 })}>✕</button>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`${line ? L.choose : L.fill} ${slot.label}`}
          data-testid={`${p}-open-${slot.id}`} className="min-h-[44px] px-3 rounded-lg flex-shrink-0" style={btn()}>
          {open ? L.close : (line ? L.choose : L.fill)}
        </button>
      </div>
      {open && (
        <div className="mt-2" data-testid={`${p}-shortlist-${slot.id}`}>
          {options.length === 0
            ? <p className="text-[13px] mb-2" style={{ fontFamily: SANS, color: CHALK_DIM }}>{L.noCandidates}</p>
            : (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {options.map((o) => (
                  <button key={o.key} type="button" onClick={() => pick(o.key)} data-testid={`${p}-option`}
                    className="px-3 rounded-full min-h-[44px] inline-flex items-center gap-1" style={btn({ background: o.have ? `${color}33` : 'transparent' })}>
                    {o.key}
                    {o.have ? <span className="text-[11px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>· {L.inBar}</span> : null}
                    {o.note ? <span className="text-[11px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>· {o.note}</span> : null}
                  </button>
                ))}
              </div>
            )}
          <TextAdd placeholder={L.typePlaceholder} buttonLabel={L.use} label={`Type an ingredient for ${slot.label}`}
            onSubmit={pick} testid={`${p}-type-${slot.id}`} buttonTestid={`${p}-use-${slot.id}`} />
        </div>
      )}
    </li>
  );
}

export default function InventSlots({
  build, shortlistFor = () => [], amountFor = () => undefined, onPick, onClear, onAddExtra, onRemoveExtra,
  notice = null, color = CHALK_CREAM, labels = {}, testidPrefix = 'slots',
}) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const p = testidPrefix;
  return (
    <div data-testid={p} className="min-w-0">
      <ul className="flex flex-col gap-1.5" data-testid={`${p}-lines`}>
        {build.slots.map((slot) => (
          <SlotRow key={slot.id} slot={slot} amount={slot.line ? amountFor(slot.line.key) : undefined}
            shortlistFor={shortlistFor} onPick={onPick} onClear={onClear} L={L} p={p} color={color} />
        ))}
      </ul>

      <p className="mt-3 text-[12px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>{L.extras}</p>
      <ul className="flex flex-col gap-1" data-testid={`${p}-extras`}>
        {build.extras.length === 0 && <li className="text-[13px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>{L.extrasEmpty}</li>}
        {build.extras.map((x) => (
          <li key={x.key} className="flex items-center gap-2 min-w-0" data-testid={`${p}-extra`}>
            <span className="text-[13px] w-16 flex-shrink-0 text-right" style={{ fontFamily: SANS, color: CHALK_DIM }}>{amountFor(x.key) || ''}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[20px] truncate" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{x.key}</span>
              {x.source === 'search' && <span className="block text-[11px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>🔒 {L.fromSearch}</span>}
              {x.have === false && L.notHave ? <span className="block text-[11px]" style={{ fontFamily: SANS, color: CHALK_SUB }} data-testid={`${p}-need`}>{L.notHave}</span> : null}
            </span>
            <button type="button" onClick={() => onRemoveExtra(x.key)} aria-label={`${L.remove} ${x.key}`} data-testid={`${p}-remove-${x.key}`}
              className="min-h-[44px] min-w-[44px] rounded-lg flex-shrink-0" style={btn({ fontSize: 20 })}>✕</button>
          </li>
        ))}
      </ul>
      <div className="mt-1.5">
        <TextAdd placeholder={L.addPlaceholder} buttonLabel={L.add} label="Add an ingredient" onSubmit={onAddExtra}
          testid={`${p}-add-input`} buttonTestid={`${p}-add`} />
      </div>

      {notice && (
        <p role="alert" className="mt-2 text-[14px] rounded-lg px-3 py-2" style={{ fontFamily: SANS, color: CHALK_CREAM, border: `1px dashed ${color}` }} data-testid={`${p}-notice`}>
          {notice}
        </p>
      )}
    </div>
  );
}
