// Validate that a pure-JS featurizer (rdkit-js → MOL block → 29-dim atom +
// 6-dim bond features) produces ONNX predictions that match the v3 Python
// pipeline within float-precision tolerance.
//
// If this passes, R5-28 (live SMILES Lab) is unblocked. If not, we'll need
// either a server-side inference endpoint OR a richer rdkit-js fork.
const initRDKit = require('@rdkit/rdkit');
const ort = require('onnxruntime-node');
const fs = require('node:fs');
const path = require('node:path');

const ELEMENTS = ['H', 'C', 'N', 'O', 'F', 'P', 'S', 'Cl', 'Br', 'I'];
const ATOM_DIM = 11 + 7 + 5 + 4 + 1 + 1; // 29
const BOND_DIM = 4 + 1 + 1;               // 6

const oneHot = (idx, size) => {
  const v = new Array(size).fill(0);
  if (idx >= 0 && idx < size) v[idx] = 1;
  return v;
};

// Parse a V2000 MOL block. Returns { atoms: [{element, charge}],
// bonds: [{i, j, order}] }. Skips chirality/stereo/etc.
function parseMolBlock(mb) {
  const lines = mb.split('\n');
  // Header is 3 lines; counts line is line 4 (index 3): "%3d%3d ..."
  const counts = lines[3];
  const nAtoms = parseInt(counts.slice(0, 3));
  const nBonds = parseInt(counts.slice(3, 6));
  const atoms = [];
  for (let i = 0; i < nAtoms; i++) {
    const line = lines[4 + i];
    const element = line.slice(31, 34).trim();
    atoms.push({ element, charge: 0 });
  }
  const bonds = [];
  for (let i = 0; i < nBonds; i++) {
    const line = lines[4 + nAtoms + i];
    const a = parseInt(line.slice(0, 3)) - 1;
    const b = parseInt(line.slice(3, 6)) - 1;
    const order = parseInt(line.slice(6, 9));
    bonds.push({ i: a, j: b, order });
  }
  // M CHG lines override formal charges.
  for (const line of lines.slice(4 + nAtoms + nBonds)) {
    if (line.startsWith('M  CHG')) {
      const parts = line.trim().split(/\s+/).slice(2);
      const n = parseInt(parts[0]);
      for (let k = 0; k < n; k++) {
        const idx = parseInt(parts[1 + 2 * k]) - 1;
        const chg = parseInt(parts[2 + 2 * k]);
        if (atoms[idx]) atoms[idx].charge = chg;
      }
    }
  }
  return { atoms, bonds };
}

function featurize(mol) {
  const ext = JSON.parse(mol.get_json()).molecules[0].extensions[0];
  const aromaticAtomSet = new Set(ext.aromaticAtoms || []);
  const aromaticBondSet = new Set(ext.aromaticBonds || []);
  const ringAtomSet = new Set();
  const ringBondSet = new Set();
  for (const ring of (ext.atomRings || [])) {
    for (const a of ring) ringAtomSet.add(a);
    for (let k = 0; k < ring.length; k++) {
      // ring is a sequence of atom indices traversing the ring
      const a = ring[k];
      const b = ring[(k + 1) % ring.length];
      ringBondSet.add(`${Math.min(a, b)}-${Math.max(a, b)}`);
    }
  }
  const { atoms, bonds } = parseMolBlock(mol.get_molblock());

  // Per-atom degree + hybridization heuristic
  const degree = atoms.map(() => 0);
  const hasTriple = atoms.map(() => false);
  const hasDoubleOrAromatic = atoms.map(() => false);
  bonds.forEach((b, bi) => {
    degree[b.i] += 1; degree[b.j] += 1;
    const isAromaticBond = aromaticBondSet.has(bi);
    if (b.order === 3) { hasTriple[b.i] = true; hasTriple[b.j] = true; }
    if (b.order === 2 || isAromaticBond) {
      hasDoubleOrAromatic[b.i] = true; hasDoubleOrAromatic[b.j] = true;
    }
  });
  // Heteroatom lone-pair resonance: an O/N/S bonded to ANY atom that
  // already has a double bond or aromatic character (not just aromatic
  // carbons — also carbonyls, amides, esters, carboxylic acids) picks
  // up sp2 character in RDKit. Computed AFTER hasDoubleOrAromatic is
  // fully populated so we see the full neighbor profile.
  const hasSp2Neighbor = atoms.map(() => false);
  bonds.forEach((b) => {
    if (hasDoubleOrAromatic[b.i]) hasSp2Neighbor[b.j] = true;
    if (hasDoubleOrAromatic[b.j]) hasSp2Neighbor[b.i] = true;
  });

  // x: (N, ATOM_DIM)
  const x = [];
  for (let i = 0; i < atoms.length; i++) {
    const sym = atoms[i].element;
    const eleIdx = ELEMENTS.indexOf(sym);
    const f = [
      ...oneHot(eleIdx >= 0 ? eleIdx : ELEMENTS.length, ELEMENTS.length + 1),
      ...oneHot(Math.min(degree[i], 6), 7),
      ...oneHot(Math.max(-2, Math.min(2, atoms[i].charge)) + 2, 5),
      // hybridization: SP=0 (triple), SP2=1 (double/aromatic OR heteroatom
      // bonded to any sp2 carbon — lone-pair resonance covers ester,
      // amide, carboxylic acid, phenol, methoxy), SP3=2 (else)
      ...oneHot(
        hasTriple[i] ? 0 :
        (hasDoubleOrAromatic[i] ||
          (['O', 'N', 'S'].includes(sym) && hasSp2Neighbor[i])) ? 1 : 2,
        4,
      ),
      aromaticAtomSet.has(i) ? 1 : 0,
      ringAtomSet.has(i) ? 1 : 0,
    ];
    if (f.length !== ATOM_DIM) throw new Error(`atom feat dim ${f.length} != ${ATOM_DIM}`);
    x.push(f);
  }

  // Per-atom sp2 character (matches RDKit's hybridization more tightly).
  // Reused for both atom hyb feature AND bond conjugation detection below.
  const isSp2 = atoms.map((a, i) =>
    hasDoubleOrAromatic[i] ||
    (['O', 'N', 'S'].includes(a.element) && hasSp2Neighbor[i])
  );

  // edge_index: (2, 2*E) directed both ways. edge_attr: (2*E, BOND_DIM)
  const edgeIdxA = [], edgeIdxB = [], edgeAttr = [];
  bonds.forEach((b, bi) => {
    const isAromatic = aromaticBondSet.has(bi);
    const inRing = ringBondSet.has(`${Math.min(b.i, b.j)}-${Math.max(b.i, b.j)}`);
    let typeIdx;
    if (isAromatic) typeIdx = 3;
    else if (b.order === 2) typeIdx = 1;
    else if (b.order === 3) typeIdx = 2;
    else typeIdx = 0;
    // RDKit's conjugation: bond is conjugated if either aromatic, or has
    // multiple-bond character, or is a single bond between two sp2 atoms
    // (e.g. methoxy-O to aromatic C, aromatic C to aldehyde C).
    const conjugated = (
      isAromatic ||
      b.order >= 2 ||
      (isSp2[b.i] && isSp2[b.j])
    ) ? 1 : 0;
    const f = [...oneHot(typeIdx, 4), conjugated, inRing ? 1 : 0];
    if (f.length !== BOND_DIM) throw new Error(`bond feat dim ${f.length} != ${BOND_DIM}`);
    // Both directions
    edgeIdxA.push(b.i); edgeIdxB.push(b.j); edgeAttr.push(f);
    edgeIdxA.push(b.j); edgeIdxB.push(b.i); edgeAttr.push(f);
  });

  return { x, edgeIdxA, edgeIdxB, edgeAttr };
}

const TASKS = ['sweet','bitter','umami','salty','sour',
               'odor_fruity','odor_floral','odor_green','odor_woody','odor_spicy','odor_fatty'];
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

(async () => {
  const RDKit = await initRDKit();
  const presets = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'public', 'models', 'preset_predictions.json'), 'utf8'));
  const session = await ort.InferenceSession.create(
    path.join(__dirname, '..', 'public', 'models', 'flavor-gnn.onnx'));

  let allPass = true;
  for (const p of presets.presets.slice(0, 5)) {
    const mol = RDKit.get_mol(p.smiles);
    if (!mol) { console.error(`parse failed: ${p.name}`); continue; }
    const feats = featurize(mol);
    mol.delete();

    const N = feats.x.length;
    const E2 = feats.edgeIdxA.length;
    const xFlat = new Float32Array(N * ATOM_DIM);
    feats.x.forEach((row, i) => row.forEach((v, j) => { xFlat[i * ATOM_DIM + j] = v; }));
    const edgeIndex = new BigInt64Array(2 * E2);
    for (let k = 0; k < E2; k++) {
      edgeIndex[k] = BigInt(feats.edgeIdxA[k]);
      edgeIndex[E2 + k] = BigInt(feats.edgeIdxB[k]);
    }
    const eaFlat = new Float32Array(E2 * BOND_DIM);
    feats.edgeAttr.forEach((row, i) => row.forEach((v, j) => { eaFlat[i * BOND_DIM + j] = v; }));
    const batch = new BigInt64Array(N).fill(0n);

    const result = await session.run({
      x: new ort.Tensor('float32', xFlat, [N, ATOM_DIM]),
      edge_index: new ort.Tensor('int64', edgeIndex, [2, E2]),
      edge_attr: new ort.Tensor('float32', eaFlat, [E2, BOND_DIM]),
      batch: new ort.Tensor('int64', batch, [N]),
    });
    const logits = result.logits.data; // length 11

    console.log(`\n=== ${p.name} (${p.smiles}) ===`);
    console.log(`  N=${N} atoms, ${E2 / 2} bonds`);
    let maxAbsDiff = 0;
    for (let t = 0; t < TASKS.length; t++) {
      const jsRaw = sigmoid(logits[t]);
      const pyRaw = p.predictions_raw[TASKS[t]];
      const d = Math.abs(jsRaw - pyRaw);
      if (d > maxAbsDiff) maxAbsDiff = d;
      const flag = d > 0.02 ? '  ⚠' : '';
      console.log(`  ${TASKS[t].padEnd(12)} js=${jsRaw.toFixed(4)}  py=${pyRaw.toFixed(4)}  Δ=${d.toFixed(4)}${flag}`);
    }
    console.log(`  → max |Δ| = ${maxAbsDiff.toFixed(4)} ${maxAbsDiff < 0.01 ? '✓' : '✗'}`);
    if (maxAbsDiff > 0.02) allPass = false;
  }
  console.log(`\n${allPass ? '✓ ALL PRESETS MATCH (max |Δ| < 0.02)' : '✗ SOME PRESETS DIVERGED'}`);
  process.exit(allPass ? 0 : 1);
})();
