/**
 * flavorGnnRuntime — browser-side wrapper around the v3 multitask GNN.
 *
 * Loads rdkit-js (for SMILES → MOL block) and onnxruntime-web (for
 * inference) lazily on first use, then exposes a `predict(smiles)`
 * function that returns calibrated taste/odor probabilities matching
 * the Python pipeline within ~0.02pp.
 *
 * The featurizer reproduces flavor-gnn/src/models/featurize.py — see
 * scripts/test_jsfeaturizer_match.cjs for the equivalence proof.
 *
 * WASM files are served from /wasm/ (see scripts/copy_wasm.cjs).
 */

const ELEMENTS = ['H', 'C', 'N', 'O', 'F', 'P', 'S', 'Cl', 'Br', 'I'];
const ATOM_DIM = 11 + 7 + 5 + 4 + 1 + 1; // 29
const BOND_DIM = 4 + 1 + 1;                // 6
const HET = new Set(['O', 'N', 'S']);

export const TASKS = [
  'sweet', 'bitter', 'umami', 'salty', 'sour',
  'odor_fruity', 'odor_floral', 'odor_green', 'odor_woody', 'odor_spicy', 'odor_fatty',
];

const oneHot = (idx, size) => {
  const v = new Array(size).fill(0);
  if (idx >= 0 && idx < size) v[idx] = 1;
  return v;
};

// Calibration shift vector from flavor-gnn/artifacts/calibration.json.
// Pre-baked here so the runtime doesn't need a network round-trip.
// Calibrated prob = sigmoid(logit(raw) + shift). Lifted from calibrate.py.
const CALIBRATION_SHIFT = {
  sweet:        Math.log(0.06 / 0.94)  - Math.log(0.088 / 0.912),
  bitter:       Math.log(0.10 / 0.90)  - Math.log(0.415 / 0.585),
  umami:        Math.log(0.005 / 0.995) - Math.log(0.042 / 0.958),
  salty:        Math.log(0.005 / 0.995) - Math.log(0.017 / 0.983),
  sour:         Math.log(0.01 / 0.99)  - Math.log(0.057 / 0.943),
  odor_fruity:  Math.log(0.10 / 0.90)  - Math.log(0.601 / 0.399),
  odor_floral:  Math.log(0.04 / 0.96)  - Math.log(0.628 / 0.372),
  odor_green:   Math.log(0.10 / 0.90)  - Math.log(0.458 / 0.542),
  odor_woody:   Math.log(0.08 / 0.92)  - Math.log(0.218 / 0.782),
  odor_spicy:   Math.log(0.03 / 0.97)  - Math.log(0.109 / 0.891),
  odor_fatty:   Math.log(0.05 / 0.95)  - Math.log(0.798 / 0.202),
};

function parseMolBlock(mb) {
  const lines = mb.split('\n');
  const counts = lines[3];
  const nA = parseInt(counts.slice(0, 3));
  const nB = parseInt(counts.slice(3, 6));
  const atoms = [];
  for (let i = 0; i < nA; i++) {
    const l = lines[4 + i];
    atoms.push({ element: l.slice(31, 34).trim(), charge: 0 });
  }
  const bonds = [];
  for (let i = 0; i < nB; i++) {
    const l = lines[4 + nA + i];
    bonds.push({
      i: parseInt(l.slice(0, 3)) - 1,
      j: parseInt(l.slice(3, 6)) - 1,
      order: parseInt(l.slice(6, 9)),
    });
  }
  for (const l of lines.slice(4 + nA + nB)) {
    if (!l.startsWith('M  CHG')) continue;
    const p = l.trim().split(/\s+/).slice(2);
    const n = parseInt(p[0]);
    for (let k = 0; k < n; k++) {
      const idx = parseInt(p[1 + 2 * k]) - 1;
      const chg = parseInt(p[2 + 2 * k]);
      if (atoms[idx]) atoms[idx].charge = chg;
    }
  }
  return { atoms, bonds };
}

function featurize(mol) {
  const ext = JSON.parse(mol.get_json()).molecules[0].extensions[0];
  const aroAtoms = new Set(ext.aromaticAtoms || []);
  const aroBonds = new Set(ext.aromaticBonds || []);
  const ringAtoms = new Set();
  const ringBonds = new Set();
  for (const ring of (ext.atomRings || [])) {
    for (const a of ring) ringAtoms.add(a);
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k];
      const b = ring[(k + 1) % ring.length];
      ringBonds.add(`${Math.min(a, b)}-${Math.max(a, b)}`);
    }
  }

  const { atoms, bonds } = parseMolBlock(mol.get_molblock());

  const degree = atoms.map(() => 0);
  const triple = atoms.map(() => false);
  const dblOrAr = atoms.map(() => false);
  bonds.forEach((b, bi) => {
    degree[b.i] += 1; degree[b.j] += 1;
    if (b.order === 3) { triple[b.i] = true; triple[b.j] = true; }
    if (b.order === 2 || aroBonds.has(bi)) {
      dblOrAr[b.i] = true; dblOrAr[b.j] = true;
    }
  });
  // Heteroatom lone-pair resonance: O/N/S adjacent to any sp2 atom is
  // sp2 itself in RDKit. Computed AFTER dblOrAr to see the full profile.
  const sp2Nb = atoms.map(() => false);
  bonds.forEach((b) => {
    if (dblOrAr[b.i]) sp2Nb[b.j] = true;
    if (dblOrAr[b.j]) sp2Nb[b.i] = true;
  });
  const isSp2 = atoms.map((a, i) =>
    dblOrAr[i] || (HET.has(a.element) && sp2Nb[i])
  );

  // Atom features (N, ATOM_DIM)
  const x = new Float32Array(atoms.length * ATOM_DIM);
  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    const eleIdx = ELEMENTS.indexOf(a.element);
    const f = [
      ...oneHot(eleIdx >= 0 ? eleIdx : ELEMENTS.length, 11),
      ...oneHot(Math.min(degree[i], 6), 7),
      ...oneHot(Math.max(-2, Math.min(2, a.charge)) + 2, 5),
      ...oneHot(triple[i] ? 0 : (isSp2[i] ? 1 : 2), 4),
      aroAtoms.has(i) ? 1 : 0,
      ringAtoms.has(i) ? 1 : 0,
    ];
    f.forEach((v, j) => { x[i * ATOM_DIM + j] = v; });
  }

  // Edges (directed, both ways) — must match Python's iteration order
  // (per-bond pair appended consecutively).
  const E2 = bonds.length * 2;
  const edgeIndex = new BigInt64Array(2 * E2);
  const edgeAttr = new Float32Array(E2 * BOND_DIM);
  bonds.forEach((b, bi) => {
    const isAro = aroBonds.has(bi);
    const inRing = ringBonds.has(`${Math.min(b.i, b.j)}-${Math.max(b.i, b.j)}`);
    let typeIdx;
    if (isAro) typeIdx = 3;
    else if (b.order === 2) typeIdx = 1;
    else if (b.order === 3) typeIdx = 2;
    else typeIdx = 0;
    const conjugated = (isAro || b.order >= 2 || (isSp2[b.i] && isSp2[b.j])) ? 1 : 0;
    const f = [...oneHot(typeIdx, 4), conjugated, inRing ? 1 : 0];

    const pos = bi * 2;
    edgeIndex[pos] = BigInt(b.i);
    edgeIndex[pos + 1] = BigInt(b.j);
    edgeIndex[E2 + pos] = BigInt(b.j);
    edgeIndex[E2 + pos + 1] = BigInt(b.i);
    f.forEach((v, j) => { edgeAttr[pos * BOND_DIM + j] = v; });
    f.forEach((v, j) => { edgeAttr[(pos + 1) * BOND_DIM + j] = v; });
  });

  return { x, edgeIndex, edgeAttr, nAtoms: atoms.length, nEdges: E2 };
}

let _runtimePromise = null;

async function _loadRuntime() {
  // rdkit-js: ESM import, init from public/wasm
  const { default: initRDKit } = await import('@rdkit/rdkit');
  const RDKit = await initRDKit({
    locateFile: () => '/wasm/RDKit_minimal.wasm',
  });

  // onnxruntime-web: configure WASM path before any session creation
  const ort = await import('onnxruntime-web');
  ort.env.wasm.numThreads = 1; // single-thread avoids cross-origin isolation requirements
  ort.env.wasm.simd = true;
  ort.env.wasm.wasmPaths = '/wasm/';

  const session = await ort.InferenceSession.create('/models/flavor-gnn.onnx', {
    executionProviders: ['wasm'],
  });

  return { RDKit, ort, session };
}

export function loadRuntime() {
  if (!_runtimePromise) _runtimePromise = _loadRuntime();
  return _runtimePromise;
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/**
 * predict(smiles) → { raw: {task: prob, ...}, calibrated: {...}, nAtoms, nBonds }
 * Returns null if SMILES doesn't parse.
 */
export async function predict(smiles) {
  if (!smiles || !smiles.trim()) return null;
  const { RDKit, ort, session } = await loadRuntime();
  const mol = RDKit.get_mol(smiles.trim());
  if (!mol) return null;
  let result;
  try {
    const { x, edgeIndex, edgeAttr, nAtoms, nEdges } = featurize(mol);
    const batch = new BigInt64Array(nAtoms); // all zeros = single graph
    const out = await session.run({
      x: new ort.Tensor('float32', x, [nAtoms, ATOM_DIM]),
      edge_index: new ort.Tensor('int64', edgeIndex, [2, nEdges]),
      edge_attr: new ort.Tensor('float32', edgeAttr, [nEdges, BOND_DIM]),
      batch: new ort.Tensor('int64', batch, [nAtoms]),
    });
    const logits = out.logits.data;
    const raw = {};
    const calibrated = {};
    for (let t = 0; t < TASKS.length; t++) {
      const task = TASKS[t];
      const z = logits[t];
      raw[task] = sigmoid(z);
      calibrated[task] = sigmoid(z + CALIBRATION_SHIFT[task]);
    }
    result = { raw, calibrated, nAtoms, nBonds: nEdges / 2 };
  } finally {
    mol.delete();
  }
  return result;
}
