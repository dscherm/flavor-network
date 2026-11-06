import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { decodePairingsBinary } from '../pairingsBinary.js';

const DIR = path.resolve(process.cwd(), 'public/proDataset');
const ingredients = JSON.parse(fs.readFileSync(path.join(DIR, 'ingredients.json'), 'utf8'));

function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function packed(version, records) {
  const buf = Buffer.alloc(12 + records.length * 8);
  buf.write('FNPR', 0, 'ascii');
  buf.writeUInt32LE(version, 4);
  buf.writeUInt32LE(records.length, 8);
  records.forEach(([a, b, s], i) => {
    buf.writeUInt16LE(a, 12 + i * 8);
    buf.writeUInt16LE(b, 14 + i * 8);
    buf.writeFloatLE(s, 16 + i * 8);
  });
  return toArrayBuffer(buf);
}

describe('decodePairingsBinary', () => {
  const ING = { a: {}, b: {}, c: {} };

  it('v1: plain indices, no known flag', () => {
    const [r] = decodePairingsBinary(packed(1, [[0, 2, 0.5]]), ING);
    expect(r).toEqual({ ingredientA: 'a', ingredientB: 'c', strength: 0.5 });
  });

  it('v2: bit 15 of idxB is the known flag', () => {
    const out = decodePairingsBinary(packed(2, [[0, 2 | 0x8000, 0.5], [1, 2, 0.25]]), ING);
    expect(out[0]).toEqual({ ingredientA: 'a', ingredientB: 'c', strength: 0.5, known: true });
    expect(out[1]).toEqual({ ingredientA: 'b', ingredientB: 'c', strength: 0.25, known: false });
  });

  it('rejects unknown versions', () => {
    expect(() => decodePairingsBinary(packed(3, []), ING)).toThrow(/version 3/);
  });

  it('the shipped pairings.bin carries the same observed flags as pairings.json', () => {
    const bin = decodePairingsBinary(toArrayBuffer(fs.readFileSync(path.join(DIR, 'pairings.bin'))), ingredients);
    const json = JSON.parse(fs.readFileSync(path.join(DIR, 'pairings.json'), 'utf8'))
      .filter((p) => p.ingredientA in ingredients && p.ingredientB in ingredients);
    expect(bin).toHaveLength(json.length);
    expect(bin.filter((p) => p.known).length).toBe(json.filter((p) => p.known === true).length);
    // Spot-check record alignment.
    for (const i of [0, 1000, json.length - 1]) {
      expect(bin[i].ingredientA).toBe(json[i].ingredientA);
      expect(bin[i].ingredientB).toBe(json[i].ingredientB);
      expect(bin[i].known).toBe(json[i].known === true);
    }
  }, 60000);
});
