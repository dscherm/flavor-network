/**
 * SharedMoleculesCard — inline chemistry explanation for a direct pairing.
 *
 * When 2 ingredients are selected, this surfaces the shared bridge
 * compounds (name + aroma tags) that justify the pairing — addressing
 * user feedback "the odor badges aren't clear, I want chemistry".
 *
 * Reads bridge_compounds.json (already loaded in useProData). Renders
 * inline in IngredientPanel so the user doesn't need to open a separate
 * FlavorBridge modal for the most common case.
 */

const TAG_COLORS = {
  citrus: '#facc15', lemon: '#facc15', orange: '#fb923c',
  fruity: '#f472b6', apple: '#fb7185', floral: '#c084fc',
  green: '#4ade80', grassy: '#86efac', herbal: '#86efac',
  minty: '#5eead4', mint: '#5eead4', peppermint: '#5eead4',
  woody: '#b48366', earthy: '#a78bfa', spicy: '#f87171', pepper: '#f87171',
  sweet: '#fda4af', caramel: '#fbbf24', vanilla: '#fde68a',
  sour: '#22d3ee', buttery: '#fde68a',
  nut: '#d6a875', nutty: '#d6a875', hazelnut: '#d6a875', almond: '#d6a875',
  smoky: '#a1a1aa', bitter: '#9d4edd', ethereal: '#93c5fd', fatty: '#fed7aa',
};

function tagColor(tag) { return TAG_COLORS[tag] || '#a5b4fc'; }

export default function SharedMoleculesCard({ a, b, bridgeCompounds }) {
  if (!a || !b || !bridgeCompounds) return null;
  const entry = bridgeCompounds[`${a}|${b}`] || bridgeCompounds[`${b}|${a}`];
  if (!entry || !Array.isArray(entry.bridges) || entry.bridges.length === 0) {
    return (
      <p className="text-[11px] text-gray-500">
        No molecular data found for this specific pair. Try two ingredients that frequently co-occur in recipes.
      </p>
    );
  }

  const bridges = entry.bridges;
  const totalShared = entry.shared_count ?? entry.distinctive_count ?? bridges.length;

  // Aggregate all tags across the bridges, count frequency
  const tagCounts = new Map();
  for (const br of bridges) {
    for (const t of br.tags || []) {
      if (t === 'odorless' || t === 'tasteless' || t === 'unknown') continue;
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 5);

  return (
    <div className="space-y-2">
      {entry.narrative && (
        <p className="text-[11px] text-gray-300 italic leading-relaxed">{entry.narrative}</p>
      )}

      {topTags.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-1">Aroma signature</div>
          <div className="flex flex-wrap gap-1">
            {topTags.map(([tag, n]) => {
              const c = tagColor(tag);
              return (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px]"
                  style={{ color: c, borderColor: `${c}55`, background: `${c}11` }}
                >
                  <span className="inline-block rounded-full" style={{ width: 5, height: 5, background: c }} />
                  {tag}
                  <span className="text-gray-500 tabular-nums">·{n}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-1">
          Shared compounds ({bridges.length}{totalShared !== bridges.length ? ` of ${totalShared}` : ''})
        </div>
        <ul className="space-y-1">
          {bridges.slice(0, 5).map((br, i) => (
            <li key={br.name || i} className="px-2 py-1.5 bg-[#12121a] rounded border border-[#2a2a3a]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-cyan-300 font-medium truncate">{br.name}</span>
                {typeof br.rarity === 'number' && (
                  <span className="text-[9px] text-gray-500 tabular-nums">rarity {br.rarity.toFixed(2)}</span>
                )}
              </div>
              {(br.tags || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {br.tags.slice(0, 4).map((t) => {
                    const c = tagColor(t);
                    return (
                      <span
                        key={t}
                        className="text-[9px] px-1 py-0 rounded"
                        style={{ color: c, background: `${c}11`, border: `1px solid ${c}33` }}
                      >
                        {t}
                      </span>
                    );
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
        {bridges.length > 5 && (
          <p className="text-[9px] text-gray-500 mt-1">+ {bridges.length - 5} more shared compound{bridges.length - 5 > 1 ? 's' : ''}</p>
        )}
      </div>
    </div>
  );
}
