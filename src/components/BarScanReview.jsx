/**
 * BarScanReview — the list the user ticks before anything reaches My bar.
 *
 * Controlled: the parent holds `rows` ({ id, label, type, barKey, checked,
 * confidence, inBar, editable }, from toReviewRows / mergeReviewRows) and
 * `other` ([{ label, kitchenKey, checked }]) and writes nothing itself.
 * Nothing is added until onAdd, called with the checked rows and items.
 */
import { barKey as toBarKey, isBooze } from '../data/myBar.js';
import { TEXT, HAND, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL } from '../data/chalkTheme.js';

const LONG_LIST = 25;
const btn = { fontFamily: TEXT, border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM };
const field = { fontFamily: TEXT, background: 'rgba(255,255,255,0.06)', border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM };

/**
 * @param {{ rows: object[], other: object[], bar: string[], names?: Set<string>, roles?: object, vocab?: string[],
 *   onRowsChange: (rows: object[]) => void, onOtherChange: (other: object[]) => void,
 *   onAdd: (rows: object[], other: object[]) => void, onAnother?: () => void, onCancel?: () => void, busy?: boolean }} props
 */
export default function BarScanReview({
  rows, other = [], bar = [], names = new Set(), roles = {}, vocab = [],
  onRowsChange, onOtherChange, onAdd, onAnother, onCancel, busy = false,
}) {
  const inBar = new Set(bar);
  const effective = rows.map((r) => ({ ...r, inBar: !!r.barKey && inBar.has(r.barKey) }));
  const ready = effective.filter((r) => r.checked && r.barKey && !r.inBar);
  const otherReady = other.filter((o) => o.checked);
  const total = ready.length + otherReady.length;

  const patch = (id, change) => onRowsChange(rows.map((r) => (r.id === id ? { ...r, ...change } : r)));
  const rename = (r, value) => {
    const k = toBarKey(value, names);
    const key = k && isBooze(k, roles) ? k : '';
    patch(r.id, { typed: value, barKey: key, checked: key ? r.checked : false });
  };

  return (
    <section className="w-full rounded-xl px-3 py-3 mt-3" style={{ border: `1px solid ${CHALK_RAIL}`, background: 'rgba(255,255,255,0.03)', fontFamily: TEXT, color: CHALK_CREAM }}
      data-testid="bar-scan-review" aria-label="Bottles found in the photo">
      <h3 className="text-[22px]" style={{ fontFamily: HAND }}>Found in your photo</h3>
      <p className="text-[13px]" style={{ color: CHALK_SUB }}>One shelf at a time, labels facing you.</p>
      {effective.length > LONG_LIST && (
        <p className="text-[13px] mt-1" data-testid="bar-scan-long-note" style={{ color: CHALK_DIM }}>
          That is a long list. Untick anything that is not really on your shelf.
        </p>
      )}
      <datalist id="bar-scan-vocab">{vocab.map((v) => <option key={v} value={v} />)}</datalist>

      <ul className="mt-2 flex flex-col gap-1" data-testid="bar-scan-rows">
        {effective.map((r) => {
          const disabled = r.inBar || !r.barKey;
          return (
            <li key={r.id} data-testid="bar-scan-row" data-bar-key={r.barKey} className="flex items-start gap-2 py-1 border-b" style={{ borderColor: 'rgba(245,239,222,0.12)', opacity: r.inBar ? 0.6 : 1 }}>
              <input type="checkbox" checked={!disabled && r.checked} disabled={disabled}
                onChange={(e) => patch(r.id, { checked: e.target.checked })}
                aria-label={`Add ${r.label} to my bar`} data-testid="bar-scan-check"
                className="shrink-0" style={{ width: 44, height: 44, margin: 0 }} />
              <div className="flex-1 min-w-0 pt-1">
                <div className="text-[16px] break-words">{r.label}</div>
                {r.inBar ? (
                  <div className="text-[13px]" style={{ color: CHALK_DIM }}>already in your bar ({r.barKey})</div>
                ) : r.editable ? (
                  <label className="block text-[13px]" style={{ color: CHALK_DIM }}>
                    added as
                    <input type="text" value={r.typed ?? r.barKey} list="bar-scan-vocab" onChange={(e) => rename(r, e.target.value)}
                      placeholder="type a bottle name" aria-label={`Bar name for ${r.label}`} data-testid="bar-scan-name"
                      className="block w-full mt-0.5 px-2 py-1.5 rounded-md text-[16px]" style={field} />
                  </label>
                ) : (
                  <div className="text-[13px]" style={{ color: CHALK_DIM }}>added as {r.barKey}</div>
                )}
                {!r.inBar && r.confidence !== 'high' && (
                  <div className="text-[12px]" data-testid="bar-scan-unsure" style={{ color: '#e8c98a' }}>not sure</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {other.length > 0 && (
        <div className="mt-3" data-testid="bar-scan-other">
          <h4 className="text-[18px]" style={{ fontFamily: HAND }}>Also spotted</h4>
          <p className="text-[12px]" style={{ color: CHALK_SUB }}>Not alcohol: these go to your kitchen list, not the bar.</p>
          <ul>
            {other.map((o) => (
              <li key={o.kitchenKey} className="flex items-center gap-2">
                <input type="checkbox" checked={!!o.checked} aria-label={`Add ${o.label} to my kitchen`} data-testid="bar-scan-other-check"
                  onChange={(e) => onOtherChange(other.map((x) => (x.kitchenKey === o.kitchenKey ? { ...x, checked: e.target.checked } : x)))}
                  className="shrink-0" style={{ width: 44, height: 44, margin: 0 }} />
                <span className="text-[16px]">{o.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={total === 0 || busy} data-testid="bar-scan-add"
          onClick={() => onAdd(ready, otherReady)} className="px-4 rounded-md min-h-[44px] disabled:opacity-40"
          style={{ fontFamily: TEXT, color: '#0a0a0a', background: CHALK_CREAM }}>
          Add {ready.length} to my bar
        </button>
        {onAnother && <button type="button" disabled={busy} data-testid="bar-scan-another" onClick={onAnother} className="px-4 rounded-md min-h-[44px] disabled:opacity-40" style={btn}>Add another photo</button>}
        {onCancel && <button type="button" data-testid="bar-scan-cancel" onClick={onCancel} className="px-4 rounded-md min-h-[44px]" style={btn}>Cancel</button>}
      </div>
      {otherReady.length > 0 && (
        <p className="text-[12px] mt-1" style={{ color: CHALK_DIM }}>and {otherReady.length} to your kitchen</p>
      )}
    </section>
  );
}
