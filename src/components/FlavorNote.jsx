/**
 * FlavorNote — CHART-3, design D. The tasting-note sentence with each note word underlined in its colour, then a Taste
 * strip and an Aroma strip on one shared scale (segments as wide as their `length`, labelled when flavorStrips says so).
 * Everything comes from data/flavorCharts.js; no scoring here.
 *
 * Props   bars [{ axis, label?, color?, score }]   testidPrefix default 'profile'
 * Test ids  {p}-sentence (data-note: the plain text), {p}-strip-taste, {p}-strip-aroma, {p}-seg-{axis}
 */
import { flavorNote, flavorStrips } from '../data/flavorCharts.js';
import { FONT, SANS, CHALK_CREAM, CHALK_SUB } from './inventUi.jsx';

/** The sentence as pieces, underlining each note word where it occurs, in order. Falls back to plain text. */
export function noteParts(note) {
  const parts = [];
  let rest = note.text;
  for (const w of note.words) {
    const at = rest.toLowerCase().indexOf(w.label.toLowerCase());
    if (at < 0) return [{ text: note.text }];
    if (at > 0) parts.push({ text: rest.slice(0, at) });
    parts.push({ text: rest.slice(at, at + w.label.length), color: w.color });
    rest = rest.slice(at + w.label.length);
  }
  if (rest) parts.push({ text: rest });
  return parts;
}

function Strip({ title, row, id, p }) {
  if (!row.segments.length) return null;
  return (
    <div className="grid items-start gap-2 min-w-0" style={{ gridTemplateColumns: '3.6em 1fr' }}>
      <span className="text-[13px] pt-[1px]" style={{ fontFamily: SANS, color: CHALK_SUB }}>{title}</span>
      <div className="flex min-w-0" style={{ gap: 2 }} data-testid={`${p}-strip-${id}`} aria-hidden="true">
        {row.segments.map((s) => (
          <div key={s.axis} data-testid={`${p}-seg-${s.axis}`} className="flex flex-col min-w-0" style={{ width: `${(s.length * 100).toFixed(2)}%`, gap: 4 }}>
            <i className="block" style={{ height: 10, borderRadius: 2, background: s.color || CHALK_SUB }} />
            {s.labelled ? <small className="text-[11px] whitespace-nowrap" style={{ fontFamily: SANS, color: CHALK_SUB }}>{s.label}</small> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FlavorNote({ bars, testidPrefix = 'profile' }) {
  const p = testidPrefix;
  const note = flavorNote(bars);
  const strips = flavorStrips(bars);
  return (
    <div className="flex flex-col gap-3 min-w-0">
      {note.text ? (
        <p className="m-0" style={{ fontFamily: FONT, fontSize: 22, lineHeight: 1.3, color: CHALK_CREAM }} data-testid={`${p}-sentence`} data-note={note.text}>
          {noteParts(note).map((part, i) => (part.color
            ? <span key={i} style={{ borderBottom: `3px solid ${part.color}`, paddingBottom: 1 }}>{part.text}</span>
            : <span key={i}>{part.text}</span>))}
        </p>
      ) : null}
      <Strip title="Taste" row={strips.taste} id="taste" p={p} />
      <Strip title="Aroma" row={strips.aroma} id="aroma" p={p} />
    </div>
  );
}
