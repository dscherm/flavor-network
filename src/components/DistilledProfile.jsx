import { BRISCIONE_AROMA, BRISCIONE_TASTE } from '../data/briscionePalette.js';

// The distilled aroma vocab (17 terms) is wider than BRISCIONE_AROMA's GNN/chef
// wheel set. Fill the gaps so every distilled aroma chip gets a sensible color
// instead of falling back to slate. Keys mirror the controlled vocab used by
// flavor-gnn/scripts/pilot_odor_labels/*.
const AROMA_COLOR = {
  ...BRISCIONE_AROMA,
  citrusy: BRISCIONE_AROMA.citrus,           // vocab uses "citrusy"
  fatty: '#f5c77e',                          // buttery tan (distinct from creamy)
  spicy: '#f87171',                          // warm baking-spice (odor_spicy)
  smoky: '#475569',                          // slate smoke
  nutty: '#a16207',                          // amber-brown
  meaty: '#7f1d1d',                          // deep maroon
  'alliaceous green': '#65a30d',             // allium-leaf green
};

function chipStyle(color, lowConf) {
  return {
    color: '#e5e7eb',
    backgroundColor: `${color}${lowConf ? '14' : '33'}`,
    borderColor: `${color}${lowConf ? '44' : '88'}`,
    borderStyle: lowConf ? 'dashed' : 'solid',
    opacity: lowConf ? 0.7 : 1,
  };
}

function Chip({ term, color, lowConf }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium"
      style={chipStyle(color, lowConf)}
      title={lowConf ? `${term} — lower-confidence axis (surfaced, not a strong claim)` : term}
    >
      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {term}
      {lowConf && <span className="text-gray-500 text-[9px] leading-none">?</span>}
    </span>
  );
}

/**
 * DistilledProfile — ingredient-level aroma + taste chips from the LLM-distilled
 * profile (flavor_profiles_distilled.json). This is the ingredient-level signal
 * (pilot 11-head macro-F1 0.710 vs the molecular model's 0.101); the molecular
 * gnnProbs remain a separate "Molecular Profile" surface.
 *
 * `low_confidence` entries (salty taste / odor_spicy aroma — the two axes the
 * molecular model also can't do and the pilot's only sub-0.6 heads) render
 * dimmed + dashed so they're visible but not presented as strong claims.
 */
export default function DistilledProfile({ profile }) {
  if (!profile) return null;
  const aromas = Array.isArray(profile.aromas) ? profile.aromas : [];
  const tastes = Array.isArray(profile.tastes) ? profile.tastes : [];
  if (aromas.length === 0 && tastes.length === 0) return null;

  const lc = new Set(profile.low_confidence || []);
  const aromaLow = (a) => lc.has(a) || lc.has(`odor_${a}`);
  const tasteLow = (t) => lc.has(t);
  const isChef = profile.source === 'chef';

  return (
    <div>
      {aromas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <span className="text-gray-500 uppercase tracking-wider text-[10px] w-10">aroma</span>
          {aromas.map((a, i) => (
            <Chip key={`a-${a}-${i}`} term={a} color={AROMA_COLOR[String(a).toLowerCase()] || '#64748b'} lowConf={aromaLow(a)} />
          ))}
        </div>
      )}
      {tastes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-gray-500 uppercase tracking-wider text-[10px] w-10">taste</span>
          {tastes.map((t, i) => (
            <Chip key={`t-${t}-${i}`} term={t} color={BRISCIONE_TASTE[String(t).toLowerCase()] || '#64748b'} lowConf={tasteLow(t)} />
          ))}
        </div>
      )}
      <p className="text-[10px] text-gray-500 mt-1.5">
        {isChef
          ? 'Chef-curated flavor profile.'
          : 'Distilled flavor profile (LLM, 3-sample consensus). '}
        {!isChef && 'Dashed chips mark lower-confidence axes (salty / spicy).'}
      </p>
    </div>
  );
}
