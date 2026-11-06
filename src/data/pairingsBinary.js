/**
 * pairingsBinary.js — decoder for public/proDataset/pairings.bin
 * (written by scripts/buildPairingsBinary.cjs).
 *
 * Layout (little-endian): 'FNPR' magic, u32 version, u32 count, then
 * count × { u16 idxA, u16 idxB, f32 strength }.
 *   v1 — idxB is a plain index.
 *   v2 — bit 15 of idxB is the `known` flag (observed co-occurrence vs
 *        model-predicted); the index is the low 15 bits. Ingredient count
 *        is therefore capped at 32767.
 */
export const PAIRINGS_KNOWN_BIT = 0x8000;

export function decodePairingsBinary(arrayBuffer, ingredientsData) {
  const view = new DataView(arrayBuffer);
  const magic = String.fromCharCode(
    view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)
  );
  if (magic !== 'FNPR') {
    throw new Error(`bad magic ${JSON.stringify(magic)} in pairings.bin`);
  }
  const version = view.getUint32(4, true);
  if (version !== 1 && version !== 2) {
    throw new Error(`unsupported pairings.bin version ${version}`);
  }
  const count = view.getUint32(8, true);

  // Same order the builder used: ingredients.json insertion order, skipping meta keys.
  const idxToName = [];
  for (const key of Object.keys(ingredientsData)) {
    if (key.startsWith('_')) continue;
    idxToName.push(key);
  }

  const out = new Array(count);
  let offset = 12;
  for (let i = 0; i < count; i++) {
    const a = view.getUint16(offset, true);
    const rawB = view.getUint16(offset + 2, true);
    const strength = view.getFloat32(offset + 4, true);
    const rec = { ingredientA: idxToName[a], ingredientB: null, strength };
    if (version === 2) {
      rec.ingredientB = idxToName[rawB & ~PAIRINGS_KNOWN_BIT];
      rec.known = (rawB & PAIRINGS_KNOWN_BIT) !== 0;
    } else {
      rec.ingredientB = idxToName[rawB];
    }
    out[i] = rec;
    offset += 8;
  }
  return out;
}
