/**
 * FlavorSwipe — CHART-3. Two pages, the tasting note with strips first, the fixed wheel second. Reach the wheel by
 * swiping (pointer events), by the two dots (real buttons, 44px targets) or ArrowLeft / ArrowRight while focused.
 * Both pages sit side by side in one row so the box is as tall as the taller page and never jumps; the page that is
 * off screen is aria-hidden and invisible. No slide under prefers-reduced-motion. A visually hidden ranked list of every
 * note (taste and aroma, strongest first) gives screen readers the same content from either page.
 *
 * Props   bars [{ axis, label, color, score }]   testidPrefix default 'profile'
 * Test ids  {p}-swipe, {p}-page-note, {p}-page-wheel (data-active), {p}-dot-note, {p}-dot-wheel (aria-current),
 *           {p}-bar-{axis} in the hidden list (aria-label "Sweet 42 percent"), plus FlavorNote / FlavorWheel ids.
 */
import { useRef, useState } from 'react';
import FlavorNote from './FlavorNote.jsx';
import FlavorWheel from './FlavorWheel.jsx';
import { CHALK_CREAM, CHALK_DIM, CHALK_RAIL } from './inventUi.jsx';

const PAGES = [{ id: 'note', label: 'Tasting note' }, { id: 'wheel', label: 'Flavor wheel' }];
const SWIPE_PX = 40;

export default function FlavorSwipe({ bars, testidPrefix = 'profile' }) {
  const p = testidPrefix;
  const [page, setPage] = useState(0);
  const start = useRef(null);
  const ranked = [...(bars || [])].filter((b) => b && b.score > 0).sort((a, b) => b.score - a.score);
  const go = (i) => setPage(Math.max(0, Math.min(PAGES.length - 1, i)));

  const onPointerDown = (e) => { start.current = { x: e.clientX, y: e.clientY }; };
  const onPointerUp = (e) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) go(page + (dx < 0 ? 1 : -1));
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(page + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(page - 1); }
  };

  return (
    <div className="min-w-0" data-testid={`${p}-swipe`} onKeyDown={onKeyDown}>
      <div className="overflow-hidden" style={{ touchAction: 'pan-y' }} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { start.current = null; }}>
        <div className="flex items-stretch transition-transform duration-200 motion-reduce:transition-none" style={{ width: '200%', transform: `translateX(${-50 * page}%)` }}>
          {PAGES.map((pg, i) => {
            const active = i === page;
            return (
              <div key={pg.id} data-testid={`${p}-page-${pg.id}`} data-active={active ? 'true' : 'false'} aria-hidden={active ? undefined : 'true'}
                className="min-w-0 flex-none" style={{ width: '50%', visibility: active ? 'visible' : 'hidden', transition: active ? 'visibility 0s' : 'visibility 0s linear 200ms' }}>
                {pg.id === 'note' ? <FlavorNote bars={bars} testidPrefix={p} /> : <FlavorWheel bars={bars} testidPrefix={p} />}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex justify-center" role="group" aria-label="Chart view">
        {PAGES.map((pg, i) => (
          <button key={pg.id} type="button" data-testid={`${p}-dot-${pg.id}`} aria-label={pg.label} aria-current={i === page ? 'true' : undefined}
            onClick={() => go(i)} className="inline-flex items-center justify-center" style={{ minWidth: 44, minHeight: 44 }}>
            <span className="block rounded-full" style={{ width: 10, height: 10, background: i === page ? CHALK_CREAM : 'transparent', border: `1px solid ${i === page ? CHALK_CREAM : CHALK_DIM}`, boxShadow: `0 0 0 1px ${CHALK_RAIL}` }} />
          </button>
        ))}
      </div>
      <ul className="sr-only" role="list" aria-label="Flavor notes, strongest first">
        {ranked.map((b) => (
          <li key={b.axis} role="listitem" aria-label={`${b.label} ${Math.round(Math.min(1, b.score) * 100)} percent`} data-testid={`${p}-bar-${b.axis}`}>
            {b.label} {Math.round(Math.min(1, b.score) * 100)} percent
          </li>
        ))}
      </ul>
    </div>
  );
}
