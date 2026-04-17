import { useEffect, useState } from 'react';
import MessagePassingDiagram from './MessagePassingDiagram.jsx';

/**
 * MoleculeLab — preset picker for GNN taste predictions.
 *
 * Reads /models/preset_predictions.json (offline predictions from the M3
 * multi-task GNN on canonical flavor molecules). When the user clicks a
 * preset, the five taste bars animate to the predicted probabilities.
 *
 * Future: wire onnxruntime-web + rdkit-js so arbitrary SMILES strings get
 * live inference. Today's static presets demonstrate what the trained model
 * has learned on recognizable molecules.
 */

const BAR_COLORS = {
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

const TASTE_TASKS = ['sweet', 'bitter', 'umami', 'salty', 'sour'];
const ODOR_TASKS = ['odor_fruity', 'odor_floral', 'odor_green', 'odor_woody', 'odor_spicy', 'odor_fatty'];
const LABEL = { odor_fruity: 'fruity', odor_floral: 'floral', odor_green: 'green', odor_woody: 'woody', odor_spicy: 'spicy', odor_fatty: 'fatty' };

export default function MoleculeLab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [compareWith, setCompareWith] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [smilesInput, setSmilesInput] = useState('');
  const [predicting, setPredicting] = useState(false);
  const [customResult, setCustomResult] = useState(null);

  useEffect(() => {
    fetch('/models/preset_predictions.json')
      .then((r) => {
        if (!r.ok) throw new Error(`preset_predictions.json: HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        setSelected(d.presets?.[0] || null);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <div className="p-6 text-red-400">Preset predictions failed to load: {error}</div>;
  }
  if (!data || !selected) {
    return <div className="p-6 text-gray-400">Loading Molecule Lab…</div>;
  }

  return (
    <div className="p-6 text-white bg-[#0a0a0f] min-h-full">
      <h2 className="text-2xl font-bold mb-2">Molecule Lab</h2>
      <p className="text-sm text-gray-400 mb-4 max-w-2xl">
        The M3 multi-task GNN has never seen these molecules during training.
        Each prediction is the model reading an atomic graph it's never encountered
        and guessing a taste profile. Classical examples like caffeine (bitter),
        citric acid (sour), and MSG (umami) come out confidently right.
      </p>
      {/* Custom SMILES input — calls /api/gnn/predict (requires `npm run api`) */}
      <div className="mb-4 p-3 bg-[#13131a] rounded border border-[#2a2a3a]">
        <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
          Try your own SMILES <span className="text-gray-600">(requires API: npm run api)</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={smilesInput}
            onChange={(e) => setSmilesInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && smilesInput.trim()) {
                setPredicting(true);
                setCustomResult(null);
                fetch(`/api/gnn/predict?smiles=${encodeURIComponent(smilesInput.trim())}`)
                  .then((r) => r.json())
                  .then((r) => {
                    if (r.valid) {
                      setCustomResult(r);
                      setSelected({ name: 'Custom', smiles: r.smiles, intuition: 'User-provided SMILES', predictions: r.predictions });
                    } else {
                      setCustomResult({ error: r.error || 'Invalid SMILES' });
                    }
                  })
                  .catch((e) => setCustomResult({ error: `API unreachable: ${e.message}` }))
                  .finally(() => setPredicting(false));
              }
            }}
            placeholder="e.g. CCO (ethanol)"
            className="flex-1 bg-[#0a0a0f] text-white text-sm px-3 py-1.5 rounded border border-[#2a2a3a] focus:border-purple-500/50 outline-none"
          />
          <button
            disabled={predicting || !smilesInput.trim()}
            onClick={() => {
              if (!smilesInput.trim()) return;
              setPredicting(true);
              setCustomResult(null);
              fetch(`/api/gnn/predict?smiles=${encodeURIComponent(smilesInput.trim())}`)
                .then((r) => r.json())
                .then((r) => {
                  if (r.valid) {
                    setCustomResult(r);
                    setSelected({ name: 'Custom', smiles: r.smiles, intuition: 'User-provided SMILES', predictions: r.predictions });
                  } else {
                    setCustomResult({ error: r.error || 'Invalid SMILES' });
                  }
                })
                .catch((e) => setCustomResult({ error: `API unreachable: ${e.message}` }))
                .finally(() => setPredicting(false));
            }}
            className="px-3 py-1.5 bg-purple-700/40 hover:bg-purple-600/50 border border-purple-500/40 rounded text-xs text-purple-100 transition-colors disabled:opacity-40"
          >
            {predicting ? 'Running…' : 'Predict'}
          </button>
        </div>
        {customResult?.error && (
          <div className="mt-1 text-xs text-red-400">{customResult.error}</div>
        )}
      </div>

      <div className="mb-4">
        <button
          onClick={() => {
            const next = !compareMode;
            setCompareMode(next);
            if (next && !compareWith) {
              const first = (data.presets || []).find((p) => p.name !== selected?.name);
              if (first) setCompareWith(first);
            }
          }}
          className={`px-3 py-1 text-xs rounded border transition-colors ${
            compareMode
              ? 'bg-purple-700/40 border-purple-500/40 text-purple-100'
              : 'bg-[#13131a] border-[#2a2a3a] text-gray-400 hover:text-gray-200'
          }`}
        >
          {compareMode ? 'Exit comparison' : 'Compare two molecules'}
        </button>
      </div>

      <div className={`grid grid-cols-1 gap-6 ${compareMode ? 'md:grid-cols-[180px_1fr_180px_1fr]' : 'md:grid-cols-[260px_1fr]'}`}>
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">A</div>
          {data.presets.map((p) => (
            <button
              key={p.name}
              onClick={() => setSelected(p)}
              className={`w-full text-left px-3 py-2 rounded transition-colors ${
                selected.name === p.name
                  ? 'bg-purple-900/50 border border-purple-500/40'
                  : 'bg-[#13131a] hover:bg-[#1a1a24] border border-transparent'
              }`}
            >
              <div className="text-sm font-medium">{p.name}</div>
              {!compareMode && <div className="text-xs text-gray-500">{p.intuition}</div>}
            </button>
          ))}
        </div>

        <div>
          <div className="mb-4">
            <h3 className="text-lg font-semibold">{selected.name}</h3>
            <code className="text-xs text-cyan-300 break-all block mt-1 bg-[#13131a] p-2 rounded">
              {selected.smiles}
            </code>
            <p className="text-xs text-gray-400 mt-2">{selected.intuition}</p>
          </div>

          <h4 className="text-sm uppercase tracking-wider text-gray-500 mb-2">Predicted taste</h4>
          <div className="space-y-2">
            {TASTE_TASKS.map((t) => {
              const p = Math.max(0, Math.min(1, selected.predictions[t] ?? 0));
              return (
                <div key={t} className="flex items-center gap-3">
                  <div className="w-16 text-sm capitalize">{t}</div>
                  <div className="flex-1 h-4 bg-[#1a1a24] rounded overflow-hidden">
                    <div className="h-full rounded transition-all duration-500 ease-out" style={{ width: `${p * 100}%`, background: BAR_COLORS[t], boxShadow: `0 0 8px ${BAR_COLORS[t]}` }} />
                  </div>
                  <div className="w-14 text-right text-sm tabular-nums text-gray-300">{(p * 100).toFixed(0)}%</div>
                </div>
              );
            })}
          </div>
          <h4 className="text-sm uppercase tracking-wider text-gray-500 mt-4 mb-2">Predicted aroma</h4>
          <div className="space-y-2">
            {ODOR_TASKS.map((t) => {
              const p = Math.max(0, Math.min(1, selected.predictions[t] ?? 0));
              return (
                <div key={t} className="flex items-center gap-3">
                  <div className="w-16 text-sm capitalize">{LABEL[t] || t}</div>
                  <div className="flex-1 h-4 bg-[#1a1a24] rounded overflow-hidden">
                    <div className="h-full rounded transition-all duration-500 ease-out" style={{ width: `${p * 100}%`, background: BAR_COLORS[t], boxShadow: `0 0 8px ${BAR_COLORS[t]}` }} />
                  </div>
                  <div className="w-14 text-right text-sm tabular-nums text-gray-300">{(p * 100).toFixed(0)}%</div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 text-xs text-gray-500 max-w-xl">
            Remember: the training set over-represents bitter (BitterDB contributed
            ~1000 positives-only) and ChemTasteDB is curated toward compounds with
            notable taste. The model leans confident on classical cases and hedges
            on ambiguous ones — a real uncertainty signal, not a verdict.
          </div>

          <MessagePassingDiagram
            predictions={selected.predictions}
            tasks={data.tasks}
            moleculeName={selected.name}
          />
        </div>

        {compareMode && (
          <>
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">B</div>
              {data.presets.map((p) => (
                <button
                  key={`cmp-${p.name}`}
                  onClick={() => setCompareWith(p)}
                  className={`w-full text-left px-3 py-2 rounded transition-colors ${
                    compareWith?.name === p.name
                      ? 'bg-cyan-900/50 border border-cyan-500/40'
                      : 'bg-[#13131a] hover:bg-[#1a1a24] border border-transparent'
                  }`}
                >
                  <div className="text-sm font-medium">{p.name}</div>
                </button>
              ))}
            </div>
            <div>
              {compareWith ? (
                <>
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold">{compareWith.name}</h3>
                    <code className="text-xs text-cyan-300 break-all block mt-1 bg-[#13131a] p-2 rounded">
                      {compareWith.smiles}
                    </code>
                    <p className="text-xs text-gray-400 mt-2">{compareWith.intuition}</p>
                  </div>
                  <h4 className="text-sm uppercase tracking-wider text-gray-500 mb-2">Predicted taste</h4>
                  <div className="space-y-2">
                    {data.tasks.map((t) => {
                      const pA = selected.predictions[t] ?? 0;
                      const pB = compareWith.predictions[t] ?? 0;
                      const diff = pB - pA;
                      return (
                        <div key={t} className="flex items-center gap-3">
                          <div className="w-16 text-sm capitalize">{t}</div>
                          <div className="flex-1 h-4 bg-[#1a1a24] rounded overflow-hidden">
                            <div
                              className="h-full rounded transition-all duration-500 ease-out"
                              style={{
                                width: `${Math.max(0, Math.min(1, pB)) * 100}%`,
                                background: BAR_COLORS[t],
                                boxShadow: `0 0 8px ${BAR_COLORS[t]}`,
                              }}
                            />
                          </div>
                          <div className="w-14 text-right text-sm tabular-nums text-gray-300">
                            {(pB * 100).toFixed(0)}%
                          </div>
                          <div
                            className={`w-12 text-right text-xs tabular-nums ${
                              diff > 0.05 ? 'text-green-400' : diff < -0.05 ? 'text-red-400' : 'text-gray-500'
                            }`}
                            title="B − A"
                          >
                            {diff > 0 ? '+' : ''}{(diff * 100).toFixed(0)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <MessagePassingDiagram
                    predictions={compareWith.predictions}
                    tasks={data.tasks}
                  />
                </>
              ) : (
                <div className="text-gray-500 text-sm">Select a molecule to compare →</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
