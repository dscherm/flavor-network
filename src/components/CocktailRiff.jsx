/**
 * CocktailRiff — "Riff on a classic" panel for a Cocktail Lab drink.
 *
 * Lists the drink's lines with their structural role; each swappable line
 * opens a short list of same-role substitutes ranked by how well they
 * pair with the rest of the drink (src/data/cocktailRiff.js). After every
 * change the panel names the closest existing cocktail, so the riff says
 * when it has turned into a Boulevardier.
 */
import { useMemo, useState } from 'react';
import { riffRows, swapCandidates, applySwap, nearestCocktails, ROLE_LABEL } from '../data/cocktailRiff.js';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW, chalkSurfaceStyle } from '../data/chalkTheme.js';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export default function CocktailRiff({
  cocktail,
  cocktails = [],
  roles = {},
  pool,
  pairingIndex,
  color = '#9a8f7a',
  onClose,
  onSelectCocktail,
  onOpenRecipeLab,
}) {
  const names = pairingIndex?.names || new Set();
  const original = useMemo(() => riffRows(cocktail, roles, names), [cocktail, roles, names]);
  const [rows, setRows] = useState(original);
  const [open, setOpen] = useState(null); // index of the line whose swaps are shown

  const changed = rows.some((r) => r.swappedFrom);
  const candidates = useMemo(
    () => (open == null || !pool ? [] : swapCandidates(rows, open, pool, pairingIndex, 6)),
    [rows, open, pool, pairingIndex],
  );
  const nearest = useMemo(
    () => (changed ? nearestCocktails(rows, cocktails, names, { exclude: cocktail?.name, k: 3 }) : []),
    [changed, rows, cocktails, names, cocktail],
  );

  return (
    <div className="fixed inset-x-0 top-0 z-[85] flex flex-col items-center px-4 py-3 overflow-y-auto"
      style={{ ...chalkSurfaceStyle(), bottom: 'var(--tab-bar-h)', color: CHALK_CREAM }}
      data-testid="cocktail-riff" role="dialog" aria-label={`Riff on ${cocktail?.name}`}>
      <div className="w-full max-w-[560px] flex items-center justify-between mb-2">
        <button type="button" onClick={onClose} data-testid="cocktail-riff-close"
          className="px-3 py-2 rounded-lg" style={{ fontFamily: FONT, fontSize: 18, border: `1px solid ${CHALK_RAIL}`, color: CHALK_CREAM }}>
          ← Back to card
        </button>
        {changed && (
          <button type="button" onClick={() => { setRows(original); setOpen(null); }} className="text-[13px] underline underline-offset-2" style={{ color: CHALK_DIM }}>
            Reset to the {cocktail?.name}
          </button>
        )}
      </div>

      <div className="w-full max-w-[560px] rounded-2xl px-5 py-4" style={{ border: `2px double ${CHALK_RAIL}`, background: 'rgba(255,255,255,0.025)' }}>
        <h2 className="text-center text-[34px] leading-tight" style={{ fontFamily: FONT, textShadow: CHALK_SHADOW }}>
          {changed ? `Your ${cocktail?.name} riff` : `Riff on the ${cocktail?.name}`}
        </h2>
        <p className="text-center text-[13px] mb-3" style={{ fontFamily: SANS, color: CHALK_SUB }}>
          Swap one part at a time. Suggestions play the same role and are ranked by how well they pair with the rest of the drink.
        </p>

        <ul className="flex flex-col gap-2" data-testid="cocktail-riff-rows">
          {rows.map((r, i) => (
            <li key={`${i}-${r.name}`}>
              <div className="flex items-center gap-2">
                <span className="text-[13px] w-16 flex-shrink-0 text-right" style={{ fontFamily: SANS, color: CHALK_DIM }}>{r.measure}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[20px] truncate" style={{ fontFamily: FONT, color: r.swappedFrom ? color : CHALK_CREAM, textShadow: CHALK_SHADOW }}>{r.name}</span>
                  <span className="block text-[11px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>
                    {ROLE_LABEL[r.role] || 'other'}{r.swappedFrom ? ` · was ${r.swappedFrom}` : ''}
                  </span>
                </span>
                {r.swappable && r.role && (
                  <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}
                    data-testid={`cocktail-riff-swap-${i}`}
                    className="px-3 py-1 rounded-full text-[15px] border flex-shrink-0 min-h-[36px]"
                    style={{ fontFamily: FONT, color: open === i ? '#0a0a0a' : CHALK_CREAM, background: open === i ? CHALK_CREAM : 'transparent', borderColor: `${CHALK_RAIL}` }}>
                    swap
                  </button>
                )}
              </div>
              {open === i && (
                <div className="mt-1.5 ml-16 flex flex-wrap gap-1.5" data-testid="cocktail-riff-candidates">
                  {candidates.length === 0 && <span className="text-[13px]" style={{ color: CHALK_SUB }}>No same-role swaps found.</span>}
                  {candidates.map((c) => (
                    <button key={c.name} type="button" onClick={() => { setRows(applySwap(rows, i, c.name)); setOpen(null); }}
                      className="px-2.5 py-1 rounded-lg border text-left"
                      style={{ borderColor: `${color}88`, background: `${color}1a` }}>
                      <span className="block text-[17px] leading-tight" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{c.name}</span>
                      <span className="block text-[10px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>{c.reason}</span>
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>

        {changed && (
          <div className="mt-4" data-testid="cocktail-riff-nearest">
            <p className="text-[13px] uppercase tracking-wider mb-1" style={{ color: CHALK_SUB }}>Closest existing cocktails</p>
            {nearest.length === 0 && <p className="text-[15px]" style={{ fontFamily: FONT, color: CHALK_DIM }}>Nothing close in the list — this one might be new.</p>}
            {nearest.map((n, idx) => (
              <button key={n.cocktail.name} type="button" onClick={() => onSelectCocktail?.(n.cocktail.name)}
                className="w-full text-left flex items-baseline gap-2 py-0.5">
                <span className="text-[19px]" style={{ fontFamily: FONT, color: CHALK_CREAM }}>{n.cocktail.name}</span>
                <span className="text-[12px]" style={{ fontFamily: SANS, color: CHALK_DIM }}>
                  {Math.round(n.similarity * 100)}% alike · shares {n.shared.join(', ')}
                  {idx === 0 && n.similarity >= 0.9 ? ' — your riff is basically this drink' : ''}
                </span>
              </button>
            ))}
          </div>
        )}

        {changed && onOpenRecipeLab && (
          <button type="button" onClick={() => onOpenRecipeLab(rows.map((r) => r.key))}
            className="mt-4 w-full px-4 py-2.5 rounded-lg" style={{ fontFamily: FONT, fontSize: 18, color: '#0a0a0a', background: CHALK_CREAM }}>
            Write this riff in the Recipe Notebook →
          </button>
        )}
      </div>
    </div>
  );
}
