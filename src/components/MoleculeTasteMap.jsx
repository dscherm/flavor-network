/**
 * MoleculeTasteMap — visual connector between a compound and the tastes
 * / odors it contributes to. Renders a small row per compound with
 * colored pips for each known association. Clicking a compound can
 * cascade to show the shared-compound explanation elsewhere.
 *
 * Data source: public/proDataset/compound_tastes.json (ground-truth
 * binary labels from chemDataset, joined to FooDB names by SMILES +
 * InChI key). Coverage ≈ 65% of names users encounter; missing
 * compounds render without pips.
 *
 * Props:
 *   compounds: [{ name, tags: [], smiles? }]  (from node.gnnCompounds.top_compounds)
 *   compoundTastes: data.compoundTastes from useProData
 */

const TASTE_AXES = ['sweet', 'bitter', 'umami', 'salty', 'sour'];
const ODOR_AXES = ['odor_fruity', 'odor_floral', 'odor_green', 'odor_woody', 'odor_spicy', 'odor_fatty'];

const TASTE_COLORS = {
  sweet: '#ff4fb8',
  bitter: '#9d4edd',
  umami: '#ffd700',
  salty: '#4f9eff',
  sour: '#00ffd0',
};
const ODOR_COLORS = {
  odor_fruity: '#f472b6',
  odor_floral: '#c084fc',
  odor_green: '#4ade80',
  odor_woody: '#b48366',
  odor_spicy: '#f87171',
  odor_fatty: '#fed7aa',
};

function displayOdor(t) { return t.replace('odor_', ''); }

function Pip({ label, color, title }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-0.5 px-1 rounded text-[9px]"
      style={{ color, background: `${color}18`, border: `1px solid ${color}55` }}
    >
      <span
        className="inline-block rounded-full"
        style={{ width: 4, height: 4, background: color, boxShadow: `0 0 3px ${color}` }}
      />
      {label}
    </span>
  );
}

export default function MoleculeTasteMap({ compounds = [], compoundTastes }) {
  if (!Array.isArray(compounds) || compounds.length === 0) return null;
  const ct = compoundTastes?.compounds || compoundTastes || {};

  return (
    <div className="space-y-1.5">
      {compounds.map((c, i) => {
        const key = (c.name || '').toLowerCase().trim();
        const labels = ct[key] || null;
        const tasteTags = labels ? TASTE_AXES.filter(t => labels[t] === 1) : [];
        // Prefer DB odor labels when available, fall back to the string
        // tags the compound already carries (from FlavorDB/bridge data).
        const odorTags = labels
          ? ODOR_AXES.filter(t => labels[t] === 1).map(displayOdor)
          : (Array.isArray(c.tags) ? c.tags.slice(0, 4) : []);

        return (
          <div key={c.name || i} className="flex items-start gap-2 px-1.5 py-1 rounded bg-[#0f0f18] border border-[#1f1f2e]">
            <span className="text-[11px] text-cyan-200 font-medium truncate max-w-[45%]">{c.name}</span>
            <div className="flex-1 flex flex-wrap gap-1 justify-end items-center">
              {tasteTags.length === 0 && odorTags.length === 0 ? (
                <span className="text-[9px] text-gray-600 italic">no taste data</span>
              ) : (
                <>
                  {tasteTags.map(t => (
                    <Pip key={t} label={t} color={TASTE_COLORS[t]} title={`${c.name} contributes to ${t} taste`} />
                  ))}
                  {odorTags.map(t => {
                    const col = ODOR_COLORS[`odor_${t}`] || '#a5b4fc';
                    return <Pip key={`o-${t}`} label={t} color={col} title={`${c.name} carries a ${t} aroma note`} />;
                  })}
                </>
              )}
            </div>
          </div>
        );
      })}
      <p className="text-[9px] text-gray-600 italic leading-tight">
        Each row: a molecule in this ingredient and the taste/aroma classes it's known for.
        Coverage is partial — some compounds lack ground-truth annotations.
      </p>
    </div>
  );
}
