/**
 * FlavorGraphTree — renders the v3 chef-curated flavor graph for one
 * ingredient as a layered chip cloud:
 *
 *   Tier-1 aroma   → BRISCIONE_AROMA palette
 *   Tier-2 taste   → BRISCIONE_TASTE palette
 *   Tier-3 mouthfeel → slate (no color contract)
 *   Adjective leaves → slate (no color contract)
 *
 * Dual-tier terms (current corpus: only "pungent") carry a TierBadge
 * so a reader can tell the T2 chip from the T3 chip when both render.
 *
 * Consumes `node.flavorGraph` set by useProData (chef path only — 89
 * verified ingredients in v3). Returns null for long-tail nodes so the
 * panel section can hide itself cleanly.
 */
import { BRISCIONE_AROMA, BRISCIONE_TASTE } from '../data/briscionePalette.js';
import TierBadge from './TierBadge.jsx';

const T3_LEAF_BG = '#1f2937'; // slate-800 background, slate-200 text

function Chip({ label, hex, tier, dualTier }) {
  const style = hex
    ? { background: `${hex}33`, color: hex, borderColor: `${hex}80` }
    : { background: T3_LEAF_BG, color: '#cbd5e1', borderColor: '#334155' };
  return (
    <span
      className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border"
      style={style}
    >
      {label}
      {dualTier && tier && <TierBadge tier={tier} />}
    </span>
  );
}

function Row({ label, items, paletteFor, tier, dualTierSet }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex items-baseline gap-2 mb-1.5">
      <span className="w-16 text-[9px] uppercase tracking-widest text-gray-500 shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {items.map(item => (
          <Chip
            key={`${label}-${item}`}
            label={item}
            hex={paletteFor ? paletteFor(item) : null}
            tier={tier}
            dualTier={dualTierSet?.has(item)}
          />
        ))}
      </div>
    </div>
  );
}

export default function FlavorGraphTree({ node }) {
  const fg = node?.flavorGraph;
  if (!fg) return null;
  const { tier1 = [], tier2 = [], tier3 = [], leaves = [], source } = fg;
  if (!tier1.length && !tier2.length && !tier3.length && !leaves.length) {
    return null;
  }

  // Surface dual-tier terms (T2 ∩ T3) so the badge renders on both chips.
  const dualTier = new Set(tier2.filter(t => tier3.includes(t)));

  return (
    <div data-testid="flavor-graph-tree">
      <Row
        label="Aroma"
        items={tier1}
        paletteFor={k => BRISCIONE_AROMA[k] || null}
        tier={1}
      />
      <Row
        label="Taste"
        items={tier2}
        paletteFor={k => BRISCIONE_TASTE[k] || null}
        tier={2}
        dualTierSet={dualTier}
      />
      <Row
        label="Mouthfeel"
        items={tier3}
        tier={3}
        dualTierSet={dualTier}
      />
      <Row label="Leaves" items={leaves} />
      {source === 'chef' && (
        <p className="text-[10px] text-gray-500 mt-1.5">
          Chef-curated — verified flavor graph from the top-500 corpus.
        </p>
      )}
    </div>
  );
}
