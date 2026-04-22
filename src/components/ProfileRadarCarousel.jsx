import { useMemo, useRef, useState, useEffect } from 'react';
import TasteRadar from './TasteRadar.jsx';
import ProfileRadar from './ProfileRadar.jsx';

/**
 * ProfileRadarCarousel — swipe/scroll between 3 radar views for the
 * currently-selected ingredient: curated tastes, GNN-predicted aromas,
 * and combined tastes+aromas.
 *
 * Only renders cards that have data. If gnnEntropy has no entry for
 * the ingredient, only the curated Taste radar is shown.
 */

const TASTE_AXES = ['sweet', 'bitter', 'umami', 'salty', 'sour'];
const AROMA_AXES = ['odor_fruity', 'odor_floral', 'odor_green', 'odor_woody', 'odor_spicy', 'odor_fatty'];
const COMBINED_AXES = [...TASTE_AXES, ...AROMA_AXES];

export default function ProfileRadarCarousel({ ingredientName, ingredients, graphNodes, gnnEntropy }) {
  const scrollRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Build per-radar value maps
  const entry = ingredientName && gnnEntropy ? gnnEntropy[ingredientName] : null;
  const probs = entry?.probs;

  const tasteValues = useMemo(() => {
    if (!probs) return null;
    const m = {};
    for (const ax of TASTE_AXES) m[ax] = probs[ax] ?? 0;
    return m;
  }, [probs]);

  const aromaValues = useMemo(() => {
    if (!probs) return null;
    const m = {};
    // Scale aroma axes to [0..1] relative to their own max so the polygon
    // visibly fills when probabilities are small (many aroma probs sit
    // under 0.4 due to mean-pooling).
    let max = 0;
    for (const ax of AROMA_AXES) max = Math.max(max, probs[ax] ?? 0);
    const scale = max > 0 ? 1 / max : 1;
    for (const ax of AROMA_AXES) m[ax] = Math.min(1, (probs[ax] ?? 0) * scale);
    return m;
  }, [probs]);

  const combinedValues = useMemo(() => {
    if (!probs) return null;
    const m = {};
    // For combined, normalize tastes and aromas to their own max so both
    // sides of the chart are visible.
    let tasteMax = 0, aromaMax = 0;
    for (const ax of TASTE_AXES) tasteMax = Math.max(tasteMax, probs[ax] ?? 0);
    for (const ax of AROMA_AXES) aromaMax = Math.max(aromaMax, probs[ax] ?? 0);
    const tasteScale = tasteMax > 0 ? 1 / tasteMax : 1;
    const aromaScale = aromaMax > 0 ? 1 / aromaMax : 1;
    for (const ax of TASTE_AXES) m[ax] = Math.min(1, (probs[ax] ?? 0) * tasteScale);
    for (const ax of AROMA_AXES) m[ax] = Math.min(1, (probs[ax] ?? 0) * aromaScale);
    return m;
  }, [probs]);

  // Track active card via scroll position for the dot indicator
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const cardWidth = el.clientWidth;
      const idx = Math.round(el.scrollLeft / cardWidth);
      setActiveIdx(idx);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const cards = [];
  cards.push({ key: 'taste-curated', label: 'Taste' });
  if (tasteValues) cards.push({ key: 'taste-gnn', label: 'Taste (predicted)' });
  if (aromaValues) cards.push({ key: 'aroma', label: 'Aroma' });
  if (combinedValues) cards.push({ key: 'combined', label: 'Taste + Aroma' });

  const showDots = cards.length > 1;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        ref={scrollRef}
        className="w-full overflow-x-auto flex snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'none' }}
      >
        {cards.map(card => (
          <div key={card.key} className="snap-center flex-shrink-0 w-full flex justify-center py-1">
            {card.key === 'taste-curated' && (
              <TasteRadar
                ingredients={ingredients}
                nodes={graphNodes}
                compact
                theme="dark"
              />
            )}
            {card.key === 'taste-gnn' && tasteValues && (
              <ProfileRadar
                axes={TASTE_AXES}
                values={tasteValues}
                label="Taste (predicted)"
                color="#a855f7"
                size={180}
              />
            )}
            {card.key === 'aroma' && aromaValues && (
              <ProfileRadar
                axes={AROMA_AXES}
                values={aromaValues}
                label="Aroma"
                color="#f472b6"
                size={180}
              />
            )}
            {card.key === 'combined' && combinedValues && (
              <ProfileRadar
                axes={COMBINED_AXES}
                values={combinedValues}
                label="Taste + Aroma"
                color="#34d399"
                size={200}
              />
            )}
          </div>
        ))}
      </div>
      {showDots && (
        <div className="flex gap-1.5 mt-1">
          {cards.map((c, i) => (
            <button
              key={c.key}
              onClick={() => {
                const el = scrollRef.current;
                if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
              }}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === activeIdx ? 'bg-cyan-400' : 'bg-gray-600'
              }`}
              aria-label={`Show ${c.label} radar`}
            />
          ))}
        </div>
      )}
      <div className="text-[9px] text-gray-600">← swipe →</div>
    </div>
  );
}
