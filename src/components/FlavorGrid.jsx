import { TEXT } from '../data/chalkTheme.js';
/**
 * FlavorGrid — the fixed grid chart: six tastes in a row, then eleven aromas in rows of six and five. Every note
 * always sits in the same place. A filled dot in the note's colour grows with the note (area follows the score);
 * an empty ring means the note is absent. Takes the result of flavorCharts.flavorGrid.
 *
 * Props:
 *   grid        flavorGrid(...) result
 *   marks       axes to flag as changed: { axis: 'up' | 'down' } (a Set or array marks without a direction).
 *               A marked cell gets a cream ring and a caret (up or down), so direction never depends on colour.
 *   showLabels  true: a label under every cell (absent ones dimmed). An array/Set of axes: labels under only those.
 *   title       optional small heading above the grid ("Now")
 */
const CREAM = '#f5efde';
const DIM = '#8a8478';
const FAINT = '#6a6a6a';

/** A present note is clearly a dot (never smaller than DOT_MIN), a strong one fills most of the cell; an absent one is a 2.5 ring. */
const DOT_MIN = 4.5;
const dotRadius = (c) => (c.on ? DOT_MIN + 7.5 * c.radius : 2.5);

function markOf(marks, axis) {
  if (!marks) return null;
  if (marks instanceof Set) return marks.has(axis) ? 'mark' : null;
  if (Array.isArray(marks)) return marks.includes(axis) ? 'mark' : null;
  return marks[axis] || null;
}

function Cell({ c, mark, label }) {
  return (
    <div
      className="flex flex-col items-center min-w-0"
      data-testid="flavor-grid-cell"
      data-axis={c.axis}
      data-on={c.on ? 'true' : 'false'}
      data-mark={mark || ''}
      data-radius={c.radius.toFixed(3)}
    >
      <svg viewBox="0 0 28 28" aria-hidden="true" style={{ width: '100%', maxWidth: 34, display: 'block' }}>
        {c.on
          ? <circle cx="14" cy="14" r={dotRadius(c)} fill={c.color || '#a09070'} />
          : <circle cx="14" cy="14" r="2.5" fill="none" stroke={FAINT} strokeWidth="1" />}
        {mark && <circle cx="14" cy="14" r="13" fill="none" stroke={CREAM} strokeWidth="1.2" strokeDasharray={mark === 'down' ? '2.5 2' : undefined} />}
        {mark === 'up' && <polygon points="21.5,0 28,10 15,10" fill={CREAM} />}
        {mark === 'down' && <polygon points="21.5,10 28,0 15,0" fill={CREAM} />}
      </svg>
      <span
        className="leading-none text-center whitespace-nowrap"
        style={{ fontFamily: TEXT, fontSize: 11, height: 11, color: c.on || mark ? CREAM : DIM, opacity: c.on || mark ? 1 : 0.55 }}
        data-testid={label ? 'flavor-grid-label' : undefined}
      >
        {label ? c.label : ' '}
      </span>
    </div>
  );
}

export default function FlavorGrid({ grid, marks = null, showLabels = false, title = null, testId = 'flavor-grid' }) {
  if (!grid) return null;
  const labelled = (c) => (showLabels === true ? true : showLabels ? (showLabels instanceof Set ? showLabels.has(c.axis) : showLabels.includes(c.axis)) : false);
  const rows = [];
  let at = 0;
  for (const n of grid.rows) { rows.push(grid.cells.slice(at, at + n)); at += n; }
  const heading = (t) => (
    <div className="text-left" style={{ fontFamily: TEXT, fontSize: 13, color: DIM }}>{t}</div>
  );
  return (
    <div className="w-full min-w-0" data-testid={testId}>
      {title && <div className="text-center mb-1" style={{ fontFamily: TEXT, fontSize: 'clamp(15px, 3.6vw, 20px)', color: CREAM, lineHeight: 1.05 }}>{title}</div>}
      {rows.map((cells, r) => (
        <div key={r}>
          {r === 0 && heading('Taste')}
          {r === 1 && heading('Aroma')}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '2px 2px', marginBottom: 2 }}>
            {cells.map((c) => <Cell key={c.axis} c={c} mark={markOf(marks, c.axis)} label={labelled(c)} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
