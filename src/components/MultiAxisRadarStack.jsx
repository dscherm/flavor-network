/**
 * MultiAxisRadarStack — Phase 3 (pipeline 2026-05-16).
 *
 * Renders 5 ProfileAxisRadars (taste / aroma / season / cuisine /
 * method) stacked in a responsive grid. Each radar shows the same
 * recipe (`ingredients[]`) scored on a different axis. Each card
 * has a click handler that drills into the network's guided tour
 * with the radar's axis as the entry filter.
 *
 * Layout: 1 col mobile, 2 cols tablet, 3 cols desktop. Last two
 * radars take 1.5 columns each on the 3-col grid for symmetry.
 *
 * Sits below the bubble-stack chip strip and above the CTA row
 * inside GuidedDiscoveryResults.
 */
import ProfileAxisRadar from './ProfileAxisRadar.jsx';

const AXES = ['taste', 'aroma', 'season', 'cuisine', 'method'];

const AXIS_BLURB = {
  taste:   'sweet / sour / bitter / salty / umami balance',
  aroma:   'fruity / floral / green / woody / spicy / fatty',
  season:  'spring / summer / fall / winter lean',
  cuisine: 'top regional traditions overlapping',
  method:  'grill / roast / sauté / bake / steam fit',
};

export default function MultiAxisRadarStack({
  ingredients = [],
  nodes,
  focalName = null,
  onAxisSelect,         // (axis) => void — entry into Phase 6 tour
  className = '',
}) {
  if (!ingredients || ingredients.length === 0) {
    return (
      <div className={`text-center text-sm text-gray-400 px-6 py-12 ${className}`}>
        Pick an ingredient on the previous screen to populate the radars.
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <p className="text-center text-sm sm:text-base text-[#bfd5f0] mb-4">
        Click a Pairing Radar to see how the model found these pairings.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {AXES.map((axis) => (
          <button
            key={axis}
            type="button"
            onClick={() => onAxisSelect?.(axis)}
            data-axis={axis}
            data-testid={`multi-radar-${axis}`}
            className="flex flex-col items-center gap-2 rounded-xl border border-[#1d3158] bg-[#0a1428]/80 p-3 sm:p-4 transition-all hover:border-cyan-400/60 hover:bg-[#0f1d33] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
            aria-label={`Explore in network — ${axis} axis`}
          >
            <div className="w-full flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-cyan-200 capitalize">{axis}</span>
              <span className="text-[10px] text-gray-500">Tap to tour →</span>
            </div>
            <div className="w-full pointer-events-none">
              <ProfileAxisRadar
                ingredients={ingredients}
                nodes={nodes}
                axis={axis}
                focalName={focalName}
                width={260}
                theme="dark"
              />
            </div>
            <p className="text-[11px] text-gray-500 text-center leading-tight">
              {AXIS_BLURB[axis]}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
