import { useEffect, useRef, useState } from 'react';

/**
 * TrainingProgress — plays back the GNN training trajectory.
 *
 * Reads /models/training_trace.json (written by flavor-gnn/src/train/train_multitask.py
 * --trace) and animates two linked views:
 *   - a line chart of the training loss across frames
 *   - a 2-D scatter of 30 representative compounds whose PCA-projected
 *     embeddings migrate as the network learns
 *
 * Minimal, dependency-free SVG + canvas; mounted lazily inside App's Lab area.
 */

const TASTE_COLORS = {
  sweet: '#ff4fb8',
  bitter: '#9d4edd',
  umami: '#ffd700',
  salty: '#4f9eff',
  sour: '#00ffd0',
  none: '#aaaaaa',
};

function colorForLabel(label) {
  if (!label) return TASTE_COLORS.none;
  const parts = label.split('+');
  return TASTE_COLORS[parts[0]] || TASTE_COLORS.none;
}

export default function TrainingProgress() {
  const [trace, setTrace] = useState(null);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(true);
  const [frameIdx, setFrameIdx] = useState(0);
  const [speed, setSpeed] = useState(1);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const lastTickRef = useRef(0);

  useEffect(() => {
    fetch('/models/training_trace.json')
      .then((r) => {
        if (!r.ok) throw new Error(`training_trace.json: HTTP ${r.status}`);
        return r.json();
      })
      .then(setTrace)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!playing || !trace) return;
    const frames = trace.frames || [];
    const totalFrames = frames.length;
    if (totalFrames === 0) return;

    const step = (t) => {
      const dt = lastTickRef.current ? t - lastTickRef.current : 16;
      lastTickRef.current = t;
      // ~6 frames/sec at speed=1
      const framesThisTick = (dt / 1000) * 6 * speed;
      setFrameIdx((i) => {
        const next = i + framesThisTick;
        if (next >= totalFrames) return 0; // loop
        return next;
      });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastTickRef.current = 0;
    };
  }, [playing, trace, speed]);

  // Draw compound scatter on canvas each time frameIdx changes
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !trace) return;
    const frames = trace.frames || [];
    if (frames.length === 0) return;
    const i0 = Math.floor(frameIdx) % frames.length;
    const i1 = (i0 + 1) % frames.length;
    const t = frameIdx - Math.floor(frameIdx);
    const f0 = frames[i0];
    const f1 = frames[i1];
    if (!f0?.embeddings?.length) return;

    // Compute bounds across all frames so the scatter stays stable
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const f of frames) {
      for (const [x, y] of f.embeddings || []) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    const dx = maxX - minX || 1;
    const dy = maxY - minY || 1;
    const W = c.width = c.clientWidth * window.devicePixelRatio;
    const H = c.height = c.clientHeight * window.devicePixelRatio;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, W, H);
    const labels = trace.compound_labels || [];

    for (let k = 0; k < f0.embeddings.length; k++) {
      const [x0, y0] = f0.embeddings[k];
      const [x1, y1] = (f1.embeddings || [])[k] || [x0, y0];
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      const px = ((x - minX) / dx) * (W - 40) + 20;
      const py = H - (((y - minY) / dy) * (H - 40) + 20);
      ctx.fillStyle = colorForLabel(labels[k]);
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(px, py, 6 * window.devicePixelRatio, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, [frameIdx, trace]);

  if (error) return <div className="p-6 text-red-400">Training trace failed to load: {error}</div>;
  if (!trace) return <div className="p-6 text-gray-400">Loading training trace…</div>;

  const frames = trace.frames || [];
  const cur = frames[Math.floor(frameIdx) % frames.length] || {};
  const maxLoss = Math.max(...frames.map((f) => f.loss || 0)) || 1;
  const W = 600;
  const H = 160;
  const path = frames.map((f, i) => {
    const x = (i / (frames.length - 1 || 1)) * (W - 20) + 10;
    const y = H - ((f.loss || 0) / maxLoss) * (H - 20) - 10;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  const curX = ((Math.floor(frameIdx) % frames.length) / (frames.length - 1 || 1)) * (W - 20) + 10;

  return (
    <div className="p-6 text-white bg-[#0a0a0f] min-h-full">
      <h2 className="text-2xl font-bold mb-2">GNN Training Trajectory</h2>
      <p className="text-sm text-gray-400 mb-6">
        Loss curve and PCA-projected compound embeddings across 30 epochs. Each dot
        is a real molecule; watch it drift toward its taste cluster as the network learns.
      </p>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setPlaying(!playing)}
          className="px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded text-sm"
        >{playing ? 'Pause' : 'Play'}</button>
        <label className="text-sm">
          Speed:{' '}
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="bg-[#1a1a24] text-white rounded px-2 py-0.5 text-sm"
          >
            <option value="0.5">0.5x</option>
            <option value="1">1x</option>
            <option value="2">2x</option>
            <option value="4">4x</option>
          </select>
        </label>
        <span className="text-sm text-gray-400 ml-auto">
          epoch {cur.epoch ?? '—'} / loss {(cur.loss ?? 0).toFixed(4)}
        </span>
      </div>

      <div className="mb-6">
        <h3 className="text-sm uppercase tracking-wider text-gray-500 mb-1">Training loss</h3>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="bg-[#13131a] rounded">
          <path d={path} stroke="#a78bfa" strokeWidth="2" fill="none" />
          <line x1={curX} y1="0" x2={curX} y2={H} stroke="#ff4fb8" strokeWidth="1" />
          <circle cx={curX} cy={H - ((cur.loss || 0) / maxLoss) * (H - 20) - 10} r="4" fill="#ff4fb8" />
        </svg>
      </div>

      <div className="mb-6">
        <h3 className="text-sm uppercase tracking-wider text-gray-500 mb-1">Compound embeddings (PCA 2-D)</h3>
        <canvas ref={canvasRef} style={{ width: '100%', height: 400 }} className="rounded bg-[#0a0a0f]" />
        <div className="flex gap-3 flex-wrap text-xs mt-2">
          {Object.entries(TASTE_COLORS).filter(([k]) => k !== 'none').map(([k, c]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: c }} />
              {k}
            </span>
          ))}
        </div>
      </div>

      <div className="text-sm text-gray-400">
        Per-task F1 at current epoch:{' '}
        {trace.tasks.map((t) => (
          <span key={t} className="mr-3">
            <span className="text-white">{t}</span> {(cur.f1?.[t] ?? 0).toFixed(3)}
          </span>
        ))}
      </div>
    </div>
  );
}
