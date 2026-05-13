import { useEffect, useState, useMemo } from 'react';
import MoleculeViewer3D from './MoleculeViewer3D.jsx';
import MessagePassingDiagram from './MessagePassingDiagram.jsx';

/**
 * MoleculeLab — Pairing Chemistry card.
 *
 * Adapts to the current selection:
 *   1 ingredient → Ingredient Chemistry (key compounds + "also found in")
 *   2 ingredients → Pairing Explainer (shared compounds + why they pair)
 *   0 ingredients → Compound Explorer (browse presets)
 *
 * Renders as a slide-out card, not a full-screen tab.
 */

const BAR_COLORS = {
  sweet: '#ff4fb8', bitter: '#9d4edd', umami: '#ffd700',
  salty: '#4f9eff', sour: '#00ffd0',
};
const TASTE_TASKS = ['sweet', 'bitter', 'umami', 'salty', 'sour'];
const ODOR_TASKS = ['odor_fruity', 'odor_floral', 'odor_green', 'odor_woody', 'odor_spicy', 'odor_fatty'];
const ODOR_LABEL = { odor_fruity: 'fruity', odor_floral: 'floral', odor_green: 'green', odor_woody: 'woody', odor_spicy: 'spicy', odor_fatty: 'fatty' };
const ODOR_COLORS = { odor_fruity: '#ff8c42', odor_floral: '#e879a8', odor_green: '#6bcb77', odor_woody: '#a67c52', odor_spicy: '#ff4444', odor_fatty: '#d4aa70' };

// Curated "interesting contrast" pairs for compare mode. Each
// teaches a single concept: structural isomerism, methyl-group effect,
// near-variant artificial sweeteners, etc. Kept short so the chip strip
// fits at the slide-out card width.
const CURATED_PAIRS = [
  { name: 'Caffeine vs Theobromine', a: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C', b: 'CN1C=NC2=C1C(=O)NC(=O)N2C', why: 'one fewer methyl' },
  { name: 'Glucose vs Fructose', a: 'OC[C@@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O', b: 'OCC1(O)OC[C@@H](O)[C@@H](O)[C@H]1O', why: 'aldose vs ketose isomers' },
  { name: 'Aspartame vs Sucralose', a: 'COC(=O)[C@H](Cc1ccccc1)NC(=O)[C@H](N)CC(=O)O', b: 'OC[C@H]1O[C@H](O[C@]2(CCl)CO[C@@H](CCl)[C@@H]2O)[C@H](Cl)[C@@H](O)[C@@H]1O', why: 'two artificial sweeteners' },
  { name: 'Citric vs Malic', a: 'OC(=O)CC(O)(C(=O)O)CC(=O)O', b: 'OC(CC(=O)O)C(=O)O', why: 'two sour acids' },
];

function CompareDiff({ probsA, probsB }) {
  if (!probsA || !probsB) return null;
  const ALL = [...TASTE_TASKS, ...ODOR_TASKS];
  const COL = { ...BAR_COLORS, ...ODOR_COLORS };
  const LABEL = { ...Object.fromEntries(TASTE_TASKS.map((t) => [t, t])), ...ODOR_LABEL };
  return (
    <div className="space-y-1 mt-2 p-2 bg-[#0d0d14] border border-[#2a2a3a] rounded">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Δ A − B</p>
      {ALL.map((t) => {
        const a = Math.max(0, Math.min(1, probsA[t] ?? 0));
        const b = Math.max(0, Math.min(1, probsB[t] ?? 0));
        const d = a - b;
        if (Math.abs(d) < 0.05) return null;
        const mag = Math.min(1, Math.abs(d));
        const sign = d > 0 ? '+' : '−';
        return (
          <div key={t} className="flex items-center gap-2">
            <span className="w-10 text-[10px] uppercase text-gray-500">{LABEL[t]}</span>
            <div className="flex-1 h-1.5 bg-[#1a1a24] rounded overflow-hidden relative flex">
              <div className="w-1/2 flex justify-end">
                {d < 0 && (
                  <div className="h-full" style={{ width: `${mag * 100}%`, background: COL[t], opacity: 0.6 }} />
                )}
              </div>
              <div className="w-1/2">
                {d > 0 && (
                  <div className="h-full" style={{ width: `${mag * 100}%`, background: COL[t] }} />
                )}
              </div>
            </div>
            <span className="w-9 text-right text-[10px] text-gray-300 tabular-nums">{sign}{Math.round(Math.abs(d) * 100)}%</span>
          </div>
        );
      })}
      <p className="text-[9px] text-gray-600 mt-1.5">
        Right = A higher · Left = B higher · Hidden if |Δ| &lt; 5%
      </p>
    </div>
  );
}

function TasteBars({ probs, label }) {
  if (!probs) return null;
  return (
    <div className="space-y-1">
      {label && <p className="text-[10px] text-gray-500 mb-1">{label}</p>}
      {TASTE_TASKS.map((t) => {
        const p = Math.max(0, Math.min(1, probs[t] ?? 0));
        if (p < 0.05) return null;
        return (
          <div key={t} className="flex items-center gap-2">
            <span className="w-10 text-[10px] uppercase text-gray-500">{t}</span>
            <div className="flex-1 h-1.5 bg-[#1a1a24] rounded overflow-hidden">
              <div className="h-full rounded" style={{ width: `${p * 100}%`, background: BAR_COLORS[t] }} />
            </div>
            <span className="w-7 text-right text-[10px] text-gray-400 tabular-nums">{Math.round(p * 100)}%</span>
          </div>
        );
      })}
      {ODOR_TASKS.map((t) => {
        const p = Math.max(0, Math.min(1, probs[t] ?? 0));
        if (p < 0.05) return null;
        return (
          <div key={t} className="flex items-center gap-2">
            <span className="w-10 text-[10px] uppercase text-gray-500">{ODOR_LABEL[t]}</span>
            <div className="flex-1 h-1.5 bg-[#1a1a24] rounded overflow-hidden">
              <div className="h-full rounded" style={{ width: `${p * 100}%`, background: ODOR_COLORS[t] }} />
            </div>
            <span className="w-7 text-right text-[10px] text-gray-400 tabular-nums">{Math.round(p * 100)}%</span>
          </div>
        );
      })}
    </div>
  );
}

export default function MoleculeLab({ isOpen, onClose, selectedNodes = [], selectedNodesData = [], graphNodes, onSelectIngredient, initialSmiles = '' }) {
  const [moleculeData, setMoleculeData] = useState(null);
  const [presetData, setPresetData] = useState(null);
  // Live in-browser SMILES → GNN inference (count === 0 mode only).
  const [smilesInput, setSmilesInput] = useState('');
  // When opened with an `initialSmiles` (e.g. from Molecule of the Day),
  // seed the SMILES input on each open transition so re-opening with a
  // new preset re-fires inference.
  useEffect(() => {
    if (isOpen && initialSmiles) setSmilesInput(initialSmiles);
  }, [isOpen, initialSmiles]);
  const [livePrediction, setLivePrediction] = useState(null);
  const [predictStatus, setPredictStatus] = useState('idle'); // idle | loading | ok | invalid | error
  // Compare mode: a second SMILES input + prediction so the user can
  // see two molecules' taste/odor profiles side-by-side and read the
  // per-task delta. Demonstrates the GNN distinguishing structural
  // isomers (caffeine vs theobromine, glucose vs fructose).
  const [compareMode, setCompareMode] = useState(false);
  const [smilesInput2, setSmilesInput2] = useState('');
  const [livePrediction2, setLivePrediction2] = useState(null);
  const [predictStatus2, setPredictStatus2] = useState('idle');
  // Read ?compareA & ?compareB on mount → enable compare mode and seed
  // both SMILES inputs. URL-decoded so reserved chars (=, #, +) survive.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const a = params.get('compareA');
    const b = params.get('compareB');
    if (a && b) {
      setCompareMode(true);
      setSmilesInput(decodeURIComponent(a));
      setSmilesInput2(decodeURIComponent(b));
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/models/preset_molecules.json').then(r => r.ok ? r.json() : null),
      fetch('/models/preset_predictions.json').then(r => r.ok ? r.json() : null),
    ]).then(([molecules, predictions]) => {
      setMoleculeData(molecules);
      setPresetData(predictions);
    }).catch(() => {});
  }, []);

  // Debounced live prediction. Lazy-loads ~18MB of WASM (rdkit + ort)
  // on first call only; subsequent predictions reuse the open session.
  useEffect(() => {
    const trimmed = smilesInput.trim();
    if (!trimmed) { setLivePrediction(null); setPredictStatus('idle'); return; }
    let cancelled = false;
    const handle = setTimeout(async () => {
      setPredictStatus('loading');
      try {
        const { predict } = await import('../ml/flavorGnnRuntime.js');
        const result = await predict(trimmed);
        if (cancelled) return;
        if (!result) { setLivePrediction(null); setPredictStatus('invalid'); return; }
        setLivePrediction(result);
        setPredictStatus('ok');
      } catch (err) {
        if (cancelled) return;
        console.error('[molecule-lab] predict failed:', err);
        setPredictStatus('error');
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [smilesInput]);

  // Second debounced prediction for compare mode. Mirror of the first.
  useEffect(() => {
    if (!compareMode) return;
    const trimmed = smilesInput2.trim();
    if (!trimmed) { setLivePrediction2(null); setPredictStatus2('idle'); return; }
    let cancelled = false;
    const handle = setTimeout(async () => {
      setPredictStatus2('loading');
      try {
        const { predict } = await import('../ml/flavorGnnRuntime.js');
        const result = await predict(trimmed);
        if (cancelled) return;
        if (!result) { setLivePrediction2(null); setPredictStatus2('invalid'); return; }
        setLivePrediction2(result);
        setPredictStatus2('ok');
      } catch (err) {
        if (cancelled) return;
        console.error('[molecule-lab] predict B failed:', err);
        setPredictStatus2('error');
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [smilesInput2, compareMode]);

  // Find shared compounds between 2 selected ingredients
  const sharedCompounds = useMemo(() => {
    if (selectedNodes.length !== 2) return [];
    const a = selectedNodesData[0];
    const b = selectedNodesData[1];
    if (!a?.gnnCompounds?.top_compounds || !b?.gnnCompounds?.top_compounds) return [];
    const bNames = new Set(b.gnnCompounds.top_compounds.map(c => c.name.toLowerCase()));
    return a.gnnCompounds.top_compounds.filter(c => bNames.has(c.name.toLowerCase()));
  }, [selectedNodes, selectedNodesData]);

  // Find "also found in" for single ingredient's compounds
  const alsoFoundIn = useMemo(() => {
    if (selectedNodes.length !== 1 || !graphNodes) return [];
    const node = selectedNodesData[0];
    if (!node?.gnnCompounds?.top_compounds) return [];
    const myCompoundNames = new Set(node.gnnCompounds.top_compounds.map(c => c.name.toLowerCase()));
    const matches = [];
    for (const [name, n] of graphNodes) {
      if (name === selectedNodes[0]) continue;
      if (!n.gnnCompounds?.top_compounds) continue;
      const shared = n.gnnCompounds.top_compounds.filter(c => myCompoundNames.has(c.name.toLowerCase()));
      if (shared.length > 0) {
        matches.push({ name, sharedCount: shared.length, shared, taste: n.taste });
      }
    }
    return matches.sort((a, b) => b.sharedCount - a.sharedCount).slice(0, 8);
  }, [selectedNodes, selectedNodesData, graphNodes]);

  const node1 = selectedNodesData[0];
  const node2 = selectedNodesData[1];
  const count = selectedNodes.length;

  // All hooks MUST be called before any conditional return (React rules of
  // hooks). Previously this useMemo sat after `if (!isOpen) return null`,
  // which crashed with error #310 when isOpen toggled.
  const viewerMolecule = useMemo(() => {
    if (!moleculeData) return null;
    if (count === 2 && sharedCompounds.length > 0) {
      for (const c of sharedCompounds) {
        for (const [, mol] of Object.entries(moleculeData)) {
          if (mol.name.toLowerCase() === c.name.toLowerCase()) return mol;
        }
      }
    }
    if (count >= 1 && node1?.gnnCompounds?.top_compounds) {
      for (const c of node1.gnnCompounds.top_compounds) {
        for (const [, mol] of Object.entries(moleculeData)) {
          if (mol.name.toLowerCase() === c.name.toLowerCase()) return mol;
        }
      }
    }
    return Object.values(moleculeData)[0] || null;
  }, [moleculeData, count, node1, sharedCompounds]);

  // Predictions to feed the message-passing diagram — prefer the matching
  // preset's pre-baked predictions (these line up with the same molecule
  // the activations were traced from), fall back to the selected
  // ingredient's gnnProbs so the diagram still shows something useful when
  // the user is hovering an ingredient instead of a preset.
  const diagramData = useMemo(() => {
    if (!viewerMolecule) return null;
    const target = viewerMolecule.name?.toLowerCase();
    if (presetData?.presets && target) {
      const match = presetData.presets.find((p) => p.name.toLowerCase() === target);
      if (match) return { predictions: match.predictions, name: match.name };
    }
    if (count === 1 && node1?.gnnProbs) {
      return { predictions: node1.gnnProbs, name: viewerMolecule.name };
    }
    return null;
  }, [viewerMolecule, presetData, count, node1]);

  if (!isOpen) return null;

  return (
    <div className="fixed left-0 top-10 bottom-0 z-[58] w-80 sm:w-96 bg-[#0a0a0f]/95 backdrop-blur-md border-r border-[#2a2a3a] overflow-y-auto transition-transform duration-300"
         style={{ transform: isOpen ? 'translateX(0)' : 'translateX(-100%)' }}>
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-white">
            {count === 2 ? 'Pairing Chemistry' : count === 1 ? 'Flavor Chemistry' : 'Molecule Lab'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl min-w-[44px] min-h-[44px] flex items-center justify-center">×</button>
        </div>

        {/* 2 ingredients: Pairing Explainer */}
        {count === 2 && node1 && node2 && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded text-xs">{selectedNodes[0]}</span>
              <span className="text-gray-500">←→</span>
              <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded text-xs">{selectedNodes[1]}</span>
            </div>

            {sharedCompounds.length > 0 ? (
              <section className="mb-4">
                <h3 className="text-sm text-gray-300 font-medium mb-2">Why this pairing works</h3>
                <p className="text-xs text-gray-400 mb-2">
                  These ingredients share {sharedCompounds.length} flavor compound{sharedCompounds.length !== 1 ? 's' : ''}:
                </p>
                {sharedCompounds.map((c, i) => (
                  <div key={i} className="p-2 mb-1.5 bg-[#13131a] rounded border border-[#2a2a3a]">
                    <div className="text-xs text-cyan-300 font-medium">{c.name}</div>
                    {c.tags?.length > 0 && (
                      <div className="text-[10px] text-gray-500 mt-0.5">{c.tags.slice(0, 3).join(', ')}</div>
                    )}
                  </div>
                ))}
              </section>
            ) : (
              <section className="mb-4">
                <h3 className="text-sm text-gray-300 font-medium mb-2">Complementary pairing</h3>
                <p className="text-xs text-gray-400">
                  These ingredients don't share identified compounds — they pair through
                  taste contrast rather than molecular overlap.
                </p>
              </section>
            )}

            <section className="mb-4">
              <h3 className="text-sm text-gray-300 font-medium mb-2">Combined taste profile</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-500 mb-1">{selectedNodes[0]}</p>
                  <TasteBars probs={node1.gnnProbs} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 mb-1">{selectedNodes[1]}</p>
                  <TasteBars probs={node2.gnnProbs} />
                </div>
              </div>
            </section>
          </>
        )}

        {/* 1 ingredient: Ingredient Chemistry */}
        {count === 1 && node1 && (
          <>
            <div className="mb-3">
              <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded text-xs">{selectedNodes[0]}</span>
              {node1.clusterLabel && (
                <span className="ml-2 text-[10px] text-gray-500">{node1.clusterLabel} cluster</span>
              )}
            </div>

            {node1.gnnCompounds && (
              <section className="mb-4">
                <h3 className="text-sm text-gray-300 font-medium mb-2">Key flavor compounds</h3>
                <p className="text-xs text-gray-400 mb-2">
                  Contains {node1.gnnCompounds.total_compounds} compounds.
                </p>
                {(node1.gnnCompounds.top_compounds || []).slice(0, 4).map((c, i) => (
                  <div key={i} className="p-2 mb-1.5 bg-[#13131a] rounded border border-[#2a2a3a]">
                    <div className="text-xs text-cyan-300 font-medium">{c.name}</div>
                    {c.tags?.length > 0 && (
                      <div className="text-[10px] text-gray-500 mt-0.5">{c.tags.slice(0, 3).join(', ')}</div>
                    )}
                  </div>
                ))}
              </section>
            )}

            {node1.gnnProbs && (
              <section className="mb-4">
                <h3 className="text-sm text-gray-300 font-medium mb-2">AI taste prediction</h3>
                <TasteBars probs={node1.gnnProbs} />
              </section>
            )}

            {alsoFoundIn.length > 0 && (
              <section className="mb-4">
                <h3 className="text-sm text-gray-300 font-medium mb-2">Pairs well with (shared compounds)</h3>
                <div className="space-y-1">
                  {alsoFoundIn.map((m) => (
                    <button
                      key={m.name}
                      onClick={() => onSelectIngredient?.(m.name)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs hover:bg-gray-700/40 transition-colors"
                    >
                      <span className="text-gray-200 flex-1 truncate">{m.name}</span>
                      <span className="text-gray-500 text-[10px]">{m.sharedCount} shared</span>
                      {m.taste && <span className="text-gray-600 text-[10px]">{m.taste}</span>}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* 0 ingredients: Compound Explorer with live SMILES + presets */}
        {count === 0 && presetData && (
          <>
            <section className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm text-gray-300 font-medium">
                  {compareMode ? 'Compare two molecules' : 'Live SMILES prediction'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    const next = !compareMode;
                    setCompareMode(next);
                    if (!next) {
                      setSmilesInput2('');
                      setLivePrediction2(null);
                      setPredictStatus2('idle');
                    }
                  }}
                  aria-pressed={compareMode}
                  className={`px-2 py-1 text-[10px] uppercase tracking-wider rounded border transition-colors ${
                    compareMode
                      ? 'border-cyan-500/60 text-cyan-300 bg-cyan-500/10'
                      : 'border-[#2a2a3a] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {compareMode ? 'Single' : 'Compare'}
                </button>
              </div>
              <p className="text-[10px] text-gray-500 mb-2">
                {compareMode
                  ? 'Two SMILES → side-by-side taste/odor + per-task delta.'
                  : 'Paste a SMILES string — the v3 GNN runs in your browser and predicts taste + odor.'}
              </p>

              {!compareMode ? (
                <>
                  <input
                    type="text"
                    value={smilesInput}
                    onChange={(e) => setSmilesInput(e.target.value)}
                    placeholder="e.g. CN1C=NC2=C1C(=O)N(C(=O)N2C)C"
                    className="w-full px-2 py-1.5 bg-[#13131a] border border-[#2a2a3a] rounded text-xs text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                    spellCheck={false}
                    autoCapitalize="off"
                  />
                  <div className="text-[10px] text-gray-500 mt-1.5 mb-2">
                    {predictStatus === 'idle' && 'Type a SMILES or click a preset below.'}
                    {predictStatus === 'loading' && 'Predicting...'}
                    {predictStatus === 'invalid' && (
                      <span className="text-amber-400">Could not parse SMILES — check syntax.</span>
                    )}
                    {predictStatus === 'error' && (
                      <span className="text-red-400">Inference failed — see console.</span>
                    )}
                    {predictStatus === 'ok' && livePrediction && (
                      <span>{livePrediction.nAtoms} atoms · {livePrediction.nBonds} bonds · calibrated probabilities</span>
                    )}
                  </div>
                  {predictStatus === 'ok' && livePrediction && (
                    <TasteBars probs={livePrediction.calibrated} />
                  )}
                </>
              ) : (
                <>
                  {/* Curated contrast chips. Click loads both SMILES. */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {CURATED_PAIRS.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => { setSmilesInput(p.a); setSmilesInput2(p.b); }}
                        className="px-2 py-0.5 text-[10px] rounded border border-[#2a2a3a] bg-[#13131a] text-gray-300 hover:border-cyan-500/40 hover:text-cyan-200"
                        title={p.why}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {/* Molecule A */}
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-cyan-400 mb-1 block">A</label>
                      <input
                        type="text"
                        value={smilesInput}
                        onChange={(e) => setSmilesInput(e.target.value)}
                        placeholder="SMILES A"
                        className="w-full px-2 py-1.5 bg-[#13131a] border border-[#2a2a3a] rounded text-xs text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                        spellCheck={false}
                        autoCapitalize="off"
                      />
                      <div className="text-[10px] text-gray-500 mt-1 mb-1.5">
                        {predictStatus === 'loading' && 'Predicting A...'}
                        {predictStatus === 'invalid' && <span className="text-amber-400">A: parse failed</span>}
                        {predictStatus === 'error' && <span className="text-red-400">A: inference failed</span>}
                        {predictStatus === 'ok' && livePrediction && (
                          <span>{livePrediction.nAtoms} atoms · {livePrediction.nBonds} bonds</span>
                        )}
                      </div>
                      {predictStatus === 'ok' && livePrediction && (
                        <TasteBars probs={livePrediction.calibrated} />
                      )}
                    </div>
                    {/* Molecule B */}
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-pink-400 mb-1 block">B</label>
                      <input
                        type="text"
                        value={smilesInput2}
                        onChange={(e) => setSmilesInput2(e.target.value)}
                        placeholder="SMILES B"
                        className="w-full px-2 py-1.5 bg-[#13131a] border border-[#2a2a3a] rounded text-xs text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:border-pink-500/50"
                        spellCheck={false}
                        autoCapitalize="off"
                      />
                      <div className="text-[10px] text-gray-500 mt-1 mb-1.5">
                        {predictStatus2 === 'loading' && 'Predicting B...'}
                        {predictStatus2 === 'invalid' && <span className="text-amber-400">B: parse failed</span>}
                        {predictStatus2 === 'error' && <span className="text-red-400">B: inference failed</span>}
                        {predictStatus2 === 'ok' && livePrediction2 && (
                          <span>{livePrediction2.nAtoms} atoms · {livePrediction2.nBonds} bonds</span>
                        )}
                      </div>
                      {predictStatus2 === 'ok' && livePrediction2 && (
                        <TasteBars probs={livePrediction2.calibrated} />
                      )}
                    </div>
                    {/* Diff strip — only when both predictions are landed. */}
                    {predictStatus === 'ok' && predictStatus2 === 'ok' && livePrediction && livePrediction2 && (
                      <CompareDiff probsA={livePrediction.calibrated} probsB={livePrediction2.calibrated} />
                    )}
                    {predictStatus === 'ok' && predictStatus2 === 'ok' && smilesInput && smilesInput2 && (
                      <button
                        type="button"
                        onClick={() => {
                          const params = new URLSearchParams(window.location.search);
                          params.set('compareA', smilesInput);
                          params.set('compareB', smilesInput2);
                          const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
                          navigator.clipboard?.writeText(url).catch(() => {});
                        }}
                        className="w-full px-2 py-1 text-[10px] text-gray-400 border border-[#2a2a3a] rounded hover:border-cyan-500/40 hover:text-cyan-300"
                      >
                        Copy share link
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>

            <section className="mb-2">
              <h3 className="text-sm text-gray-300 font-medium mb-2">Preset molecules</h3>
              <div className="space-y-1.5">
                {presetData.presets.slice(0, 6).map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setSmilesInput(p.smiles)}
                    className="w-full text-left p-2 bg-[#13131a] rounded border border-[#2a2a3a] hover:border-cyan-500/40 transition-colors"
                  >
                    <div className="text-xs font-medium text-gray-200">{p.name}</div>
                    <div className="text-[10px] text-gray-500">{p.intuition}</div>
                    <TasteBars probs={p.predictions} />
                  </button>
                ))}
              </div>
            </section>

          </>
        )}

        {/* 3D Molecule Viewer — shows contextual compound */}
        {viewerMolecule && (
          <section className="mt-4">
            <h3 className="text-sm text-gray-300 font-medium mb-2">
              Molecular structure: {viewerMolecule.name}
            </h3>
            <MoleculeViewer3D moleculeData={viewerMolecule} />
          </section>
        )}

        {/* Message-passing animation — only renders real activations when
            viewerMolecule matches a preset that was traced through the GNN
            offline (see flavor-gnn/src/infer/preset_activations.py). */}
        {diagramData && (
          <MessagePassingDiagram
            predictions={diagramData.predictions}
            tasks={TASTE_TASKS}
            moleculeName={diagramData.name}
          />
        )}
      </div>
    </div>
  );
}
