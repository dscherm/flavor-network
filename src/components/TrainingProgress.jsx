import { useEffect, useState, useRef, useMemo } from 'react';

/**
 * TrainingProgress — replays the M3 multitask GNN's training trajectory.
 *
 * Reads /models/training_trace.json (a per-2-epoch snapshot of training
 * loss + 66 compound embeddings projected to 2D via PCA fit at epoch 1).
 *
 * Renders two coordinated views:
 *   - Loss curve: SVG line plot, time cursor advances with playback
 *   - 2D embedding scatter: 66 dots migrate as the model learns to
 *     separate taste classes
 *
 * Each compound is colored by its primary taste/odor label (the first
 * label in the multi-label string returned by the trace generator).
 */

const TASTE_COLORS = {
  sweet: '#ff4fb8',
  bitter: '#9d4edd',
  umami: '#ffd700',
  salty: '#4f9eff',
  sour: '#00ffd0',
  odor_fruity: '#ff8c42',
  odor_floral: '#e879a8',
  odor_green: '#6bcb77',
  odor_woody: '#a67c52',
  odor_spicy: '#ff4444',
  odor_fatty: '#d4aa70',
};

const FRAME_INTERVAL_MS = 350; // playback speed; epoch-to-epoch

function primaryLabel(s) {
  if (!s) return null;
  const first = s.split('+')[0];
  return TASTE_COLORS[first] ? first : null;
}

function shortLabel(s) {
  return (s || '').replace(/odor_/g, '').replace(/\+/g, ' + ');
}

export default function TrainingProgress() {
  const [trace, setTrace] = useState(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetch('/models/training_trace.json')
      .then((r) => r.ok ? r.json() : null)
      .then(setTrace)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!playing || !trace) return;
    intervalRef.current = setInterval(() => {
      setFrameIdx((idx) => {
        if (idx >= trace.frames.length - 1) {
          setPlaying(false);
          return idx;
        }
        return idx + 1;
      });
    }, FRAME_INTERVAL_MS / speed);
    return () => clearInterval(intervalRef.current);
  }, [playing, trace, speed]);

  // Pre-compute the 2D bounding box across ALL frames so the embedding
  // viewport doesn't jiggle frame-to-frame as PCA-projected points move.
  const bounds = useMemo(() => {
    if (!trace) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const f of trace.frames) {
      for (const [x, y] of f.embeddings) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    const padX = (maxX - minX) * 0.1, padY = (maxY - minY) * 0.1;
    return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
  }, [trace]);

  if (!trace) return null;

  const frame = trace.frames[frameIdx];
  const W = 520, H = 200, embW = 520, embH = 280;
  const lossSeries = trace.frames.map((f) => f.loss);
  const minLoss = Math.min(...lossSeries);
  const maxLoss = Math.max(...lossSeries);

  const lossX = (i) => 30 + (i / (trace.frames.length - 1)) * (W - 50);
  const lossY = (l) => H - 25 - ((l - minLoss) / (maxLoss - minLoss + 1e-6)) * (H - 50);

  const embX = (x) => 20 + ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * (embW - 40);
  const embY = (y) => embH - 20 - ((y - bounds.minY) / (bounds.maxY - bounds.minY)) * (embH - 40);

  return (
    <section className="mt-4 p-4 bg-[#13131a] rounded border border-[#2a2a3a]">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm uppercase tracking-wider text-gray-500">Training trajectory</h4>
        <span className="text-xs text-gray-600">
          epoch {frame.epoch} / {trace.frames[trace.frames.length - 1].epoch} · loss {frame.loss.toFixed(3)}
        </span>
      </div>

      {/* Loss curve */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full mb-3">
        <line x1="30" y1={H - 25} x2={W - 20} y2={H - 25} stroke="#2a2a3a" strokeWidth="1" />
        <line x1="30" y1="15" x2="30" y2={H - 25} stroke="#2a2a3a" strokeWidth="1" />
        <text x="6" y="20" style={{ font: '10px ui-monospace, monospace' }} className="fill-gray-500">
          {maxLoss.toFixed(2)}
        </text>
        <text x="6" y={H - 25} style={{ font: '10px ui-monospace, monospace' }} className="fill-gray-500">
          {minLoss.toFixed(2)}
        </text>
        <text x="30" y={H - 8} style={{ font: '10px ui-monospace, monospace' }} className="fill-gray-500">
          ep 1
        </text>
        <text x={W - 50} y={H - 8} style={{ font: '10px ui-monospace, monospace' }} className="fill-gray-500">
          ep {trace.frames[trace.frames.length - 1].epoch}
        </text>
        <polyline
          fill="none"
          stroke="#7c3aed"
          strokeWidth="2"
          points={lossSeries.map((l, i) => `${lossX(i)},${lossY(l)}`).join(' ')}
        />
        {/* Time cursor */}
        <line
          x1={lossX(frameIdx)} y1="15" x2={lossX(frameIdx)} y2={H - 25}
          stroke="#a78bfa" strokeWidth="1" strokeDasharray="3 3" opacity="0.7"
        />
        <circle cx={lossX(frameIdx)} cy={lossY(frame.loss)} r="4" fill="#e9d5ff" />
      </svg>

      {/* Embedding scatter */}
      <svg viewBox={`0 0 ${embW} ${embH}`} className="w-full">
        <rect x="0" y="0" width={embW} height={embH} fill="#0a0a0f" />
        <text x="8" y="14" style={{ font: '10px ui-monospace, monospace' }} className="fill-gray-500">
          2D PCA of compound embeddings · {trace.compound_labels.length} dots
        </text>
        {frame.embeddings.map(([x, y], i) => {
          const label = trace.compound_labels[i];
          const primary = primaryLabel(label);
          const fill = primary ? TASTE_COLORS[primary] : '#666';
          return (
            <circle
              key={i}
              cx={embX(x)} cy={embY(y)} r="4" fill={fill}
              opacity="0.85"
              style={{ transition: 'cx 350ms ease, cy 350ms ease' }}
            >
              <title>{shortLabel(label)}</title>
            </circle>
          );
        })}
      </svg>

      {/* Controls */}
      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          onClick={() => {
            if (frameIdx >= trace.frames.length - 1) setFrameIdx(0);
            setPlaying((p) => !p);
          }}
          className="px-2.5 py-1 text-xs bg-[#1a1a24] border border-[#2a2a3a] rounded hover:border-cyan-500/40 text-gray-200"
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          onClick={() => { setFrameIdx(0); setPlaying(false); }}
          className="px-2.5 py-1 text-xs bg-[#1a1a24] border border-[#2a2a3a] rounded hover:border-cyan-500/40 text-gray-200"
        >
          Reset
        </button>
        <input
          type="range"
          min={0}
          max={trace.frames.length - 1}
          value={frameIdx}
          onChange={(e) => { setPlaying(false); setFrameIdx(Number(e.target.value)); }}
          className="flex-1"
        />
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="px-1.5 py-1 text-[10px] bg-[#1a1a24] border border-[#2a2a3a] rounded text-gray-300"
        >
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>
      </div>

      <p className="mt-2 text-[10px] text-gray-600">
        Each dot is one of {trace.compound_labels.length} representative compounds.
        Colors mark the primary taste/odor label. The model starts random — dots
        cluster as it learns to separate classes.
      </p>
    </section>
  );
}
