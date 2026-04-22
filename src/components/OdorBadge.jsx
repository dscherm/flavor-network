import { getOdorBadge } from '../utils/odorBadge.js';

const TAG_COLORS = {
  citrus: '#facc15',
  lemon: '#facc15',
  orange: '#fb923c',
  fruity: '#f472b6',
  apple: '#fb7185',
  floral: '#c084fc',
  green: '#4ade80',
  grassy: '#86efac',
  herbal: '#86efac',
  minty: '#5eead4',
  mint: '#5eead4',
  peppermint: '#5eead4',
  woody: '#b48366',
  earthy: '#a78bfa',
  spicy: '#f87171',
  pepper: '#f87171',
  sweet: '#fda4af',
  caramel: '#fbbf24',
  vanilla: '#fde68a',
  sour: '#22d3ee',
  buttery: '#fde68a',
  nut: '#d6a875',
  nutty: '#d6a875',
  hazelnut: '#d6a875',
  almond: '#d6a875',
  smoky: '#a1a1aa',
  bitter: '#9d4edd',
  ethereal: '#93c5fd',
  waxy: '#fef3c7',
  fatty: '#fed7aa',
};

export default function OdorBadge({ a, b, bridgeCompounds, compact = false }) {
  const badge = getOdorBadge(a, b, bridgeCompounds);
  if (!badge) return null;

  const color = TAG_COLORS[badge.tag] || '#a5b4fc';

  const compoundList = (badge.compounds || []).slice(0, 4).join(', ');
  const more = (badge.compounds || []).length - 4;
  const title = compoundList
    ? `${badge.count} of ${badge.total} shared molecules carry the "${badge.tag}" note — ${compoundList}${more > 0 ? ` + ${more} more` : ''}`
    : `${badge.count} of ${badge.total} shared bridge compounds carry the "${badge.tag}" note`;

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-1.5 rounded-full border text-[9px] leading-none ${compact ? 'py-[1px]' : 'py-0.5'}`}
      style={{
        color,
        borderColor: `${color}55`,
        background: `${color}11`,
      }}
    >
      <span
        className="inline-block rounded-full"
        style={{ width: 5, height: 5, background: color, boxShadow: `0 0 4px ${color}` }}
      />
      {badge.tag}
      {!compact && <span className="text-gray-500 tabular-nums">·{badge.count}</span>}
    </span>
  );
}
