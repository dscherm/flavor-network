import { getPredictedProfile } from '../utils/predictedProfile.js';

const TASK_COLORS = {
  sweet: '#ff4fb8',
  bitter: '#9d4edd',
  umami: '#ffd700',
  salty: '#4f9eff',
  sour: '#00ffd0',
  odor_fruity: '#f472b6',
  odor_floral: '#c084fc',
  odor_green: '#4ade80',
  odor_woody: '#b48366',
  odor_spicy: '#f87171',
  odor_fatty: '#fed7aa',
};

const TASK_LABELS = {
  odor_fruity: 'fruity',
  odor_floral: 'floral',
  odor_green: 'green',
  odor_woody: 'woody',
  odor_spicy: 'spicy',
  odor_fatty: 'fatty',
};

export default function PredictedProfile({ name, gnnEntropy, odorThresholds }) {
  const tags = getPredictedProfile(name, gnnEntropy, odorThresholds);
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map(tag => {
        const color = TASK_COLORS[tag.task] || '#a5b4fc';
        const label = TASK_LABELS[tag.task] || tag.task;
        const isOdor = tag.task.startsWith('odor_');
        return (
          <span
            key={tag.task}
            title={`${label}: predicted probability ${(tag.prob * 100).toFixed(0)}% (threshold ${(tag.threshold * 100).toFixed(0)}%)`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] leading-none"
            style={{
              color,
              borderColor: `${color}55`,
              background: `${color}11`,
            }}
          >
            <span
              className="inline-block rounded-full"
              style={{ width: 6, height: 6, background: color, boxShadow: `0 0 4px ${color}` }}
            />
            {label}
            {isOdor && <span className="text-gray-500 text-[9px]">aroma</span>}
          </span>
        );
      })}
    </div>
  );
}
