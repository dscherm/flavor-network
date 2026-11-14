/**
 * InventChecklist — "A Sour usually has": the parts a chosen category asks for,
 * ticked as the cook's list satisfies them. Required parts first. An unticked part
 * opens suggestions for it; nothing is added until the cook picks one. Lab-agnostic.
 *
 * Props
 *   title         string                          e.g. "A Sour usually has"
 *   items         [{ slotId, label, required, done, key, why? }]   from inventBuild.checklist(build)
 *   onOpen        (slotId)                        an unticked part was tapped (the panel sets openId; tapping the open one again should clear it)
 *   openId        string | null                   the part whose options are showing
 *   optionsFor    (slotId) → [{ key, have?, note? }]
 *   onPick        (slotId, key)
 *   labels        { required, usual, none, have, close }
 *   testidPrefix  default 'checklist'
 * Test ids: {p} root, {p}-item-{slotId} (data-done, data-required), {p}-open-{slotId} (unticked parts only),
 * {p}-why-{slotId}, {p}-options-{slotId}, {p}-option (data-key), {p}-none-{slotId}.
 */
import { Chip, heading, small, SANS, FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, ACCENT } from './inventUi.jsx';

export default function InventChecklist({
  title, items = [], onOpen, openId = null, optionsFor = () => [], onPick, labels = {}, testidPrefix = 'checklist',
}) {
  const L = { required: 'needed', usual: 'usual', none: 'Nothing on your list fits. Type one above.', have: 'have', ...labels };
  const p = testidPrefix;
  if (!items.length) return null;
  const ordered = [...items.filter((i) => i.required), ...items.filter((i) => !i.required)];
  return (
    <div data-testid={p} className="min-w-0">
      {title && <p className="mb-1" style={heading}>{title}</p>}
      <ul className="flex flex-col gap-1.5">
        {ordered.map((it) => {
          const open = openId === it.slotId && !it.done;
          const options = open ? optionsFor(it.slotId) || [] : [];
          const tag = it.required ? L.required : L.usual;
          const row = (
            <>
              <span aria-hidden="true" className="w-6 text-center text-[20px] flex-shrink-0" style={{ fontFamily: FONT, color: it.done ? ACCENT : CHALK_SUB }}>{it.done ? '✓' : '○'}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[20px] truncate" style={{ fontFamily: FONT, color: it.done ? CHALK_CREAM : CHALK_DIM }}>
                  {it.label}{it.done && it.key ? <span style={{ color: CHALK_SUB }}> — {it.key}</span> : null}
                </span>
                <span className="block text-[11px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>{tag}</span>
              </span>
            </>
          );
          return (
            <li key={it.slotId} data-testid={`${p}-item-${it.slotId}`} data-done={it.done ? 'true' : 'false'} data-required={it.required ? 'true' : 'false'}
              className="rounded-lg" style={{ border: `1px ${it.done ? 'solid' : 'dashed'} ${CHALK_RAIL}` }}>
              {it.done
                ? <div className="flex items-center gap-2 px-2 min-h-[44px]">{row}</div>
                : (
                  <button type="button" onClick={() => onOpen(it.slotId)} aria-expanded={open} data-testid={`${p}-open-${it.slotId}`}
                    className="w-full flex items-center gap-2 px-2 min-h-[44px] text-left">{row}</button>
                )}
              {!it.done && it.required && it.why && (
                <p className="px-2 pb-1.5 text-[13px]" style={{ ...small, fontSize: 13, color: CHALK_DIM }} data-testid={`${p}-why-${it.slotId}`}>{it.why}</p>
              )}
              {open && (
                <div className="px-2 pb-2" data-testid={`${p}-options-${it.slotId}`}>
                  {options.length === 0
                    ? <p className="text-[13px]" style={{ fontFamily: SANS, color: CHALK_DIM }} data-testid={`${p}-none-${it.slotId}`}>{L.none}</p>
                    : (
                      <div className="flex flex-wrap gap-1.5">
                        {options.map((o) => <Chip key={o.key} item={o} testid={`${p}-option`} haveLabel={L.have} onClick={() => onPick(it.slotId, o.key)} />)}
                      </div>
                    )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
