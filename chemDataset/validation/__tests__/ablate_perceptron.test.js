import { describe, it, expect, vi, afterEach } from 'vitest';
import { safeWrite, runAblation } from '../ablate_perceptron.js';

// Suppress console.error output during gate-fail tests
const silenceConsole = () => vi.spyOn(console, 'error').mockImplementation(() => {});
const silenceLog = () => vi.spyOn(console, 'log').mockImplementation(() => {});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Fixtures ──

const FAKE_BLEND_SOURCE = `const DEFAULT_WEIGHTS = {
  weights: [2.0, 0.5, 2.5, 1.5, 1.0, 0.8, 0.3, 1.2],
  bias: -3.0,
};`;

const FAKE_METADATA = { gnnTrainedAt: '2026-05-13T00:00:00.000Z' };

function makeGroundTruth(perAxisN) {
  // Build pairings with the given count per axis.
  const pairings = [];
  const axes = ['cross-aroma', 'cross-cuisine', 'absent-from-books', 'chem-bridged-rare'];
  for (const axis of axes) {
    const n = perAxisN[axis] ?? 0;
    for (let i = 0; i < n; i++) {
      pairings.push({
        a: `${axis}-a-${i}`,
        b: `${axis}-b-${i}`,
        axes_validated: [axis],
        sources: [],
      });
    }
  }
  return { version: 1, generatedAt: '2026-05-13T00:00:00.000Z', pairings };
}

function makePairFeatures(groundTruth) {
  // Build a pair-features array matching every GT entry with a synthetic 8-dim vector.
  return groundTruth.pairings.map((e, idx) => ({
    a: e.a,
    b: e.b,
    features: [
      0.9 - idx * 0.01, 0.5, 0.6, 0.4,
      0.3, 0.7, 0.2, 0.8,
    ].map((v) => Math.min(1, Math.max(0, v))),
  }));
}

// ── safeWrite write-protection tests ──

describe('safeWrite — write-protection', () => {
  it('throws when targeting proDataset/ paths', () => {
    expect(() => safeWrite('proDataset/scripts/07-blend-v2.js', 'bad')).toThrow(
      /Write-protection violation/,
    );
  });

  it('throws when targeting an absolute path outside chemDataset/validation/', () => {
    expect(() => safeWrite('/tmp/evil.json', '{}')).toThrow(
      /Write-protection violation/,
    );
  });

  it('throws when targeting public/proDataset/ paths', () => {
    expect(() => safeWrite('public/proDataset/pairings.json', '[]')).toThrow(
      /Write-protection violation/,
    );
  });
});

// ── Gate-fail path ──

describe('runAblation — gate-fail path', () => {
  it('calls process.exit(2) when all axes are below n=15', () => {
    silenceConsole();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit(2)'); });

    const insufficientGT = makeGroundTruth({
      'cross-aroma': 5,
      'cross-cuisine': 3,
      'absent-from-books': 4,
      'chem-bridged-rare': 2,
    });

    expect(() => runAblation({
      groundTruth: insufficientGT,
      pairFeatures: makePairFeatures(insufficientGT),
      blendSource: FAKE_BLEND_SOURCE,
      metadata: FAKE_METADATA,
      writeOutput: false,
    })).toThrow('process.exit(2)');

    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('gate-fail message includes per-axis counts', () => {
    const errorLines = [];
    vi.spyOn(console, 'error').mockImplementation((msg) => errorLines.push(msg));
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });

    const insufficientGT = makeGroundTruth({
      'cross-aroma': 5,
      'cross-cuisine': 3,
      'absent-from-books': 4,
      'chem-bridged-rare': 2,
    });

    try {
      runAblation({
        groundTruth: insufficientGT,
        pairFeatures: makePairFeatures(insufficientGT),
        blendSource: FAKE_BLEND_SOURCE,
        metadata: FAKE_METADATA,
        writeOutput: false,
      });
    } catch {
      // expected
    }

    const allOutput = errorLines.join('\n');
    expect(allOutput).toContain('cross-aroma');
    expect(allOutput).toContain('cross-cuisine');
    expect(allOutput).toContain('insufficient');
  });

  it('gate-fail message mentions growing ground_truth.json', () => {
    const errorLines = [];
    vi.spyOn(console, 'error').mockImplementation((msg) => errorLines.push(msg));
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });

    const insufficientGT = makeGroundTruth({
      'cross-aroma': 5,
      'cross-cuisine': 3,
      'absent-from-books': 4,
      'chem-bridged-rare': 2,
    });

    try {
      runAblation({
        groundTruth: insufficientGT,
        pairFeatures: makePairFeatures(insufficientGT),
        blendSource: FAKE_BLEND_SOURCE,
        metadata: FAKE_METADATA,
        writeOutput: false,
      });
    } catch {
      // expected
    }

    const allOutput = errorLines.join('\n');
    expect(allOutput).toContain('ground_truth.json');
    expect(allOutput).toContain('15');
  });
});

// ── Gate-pass path ──

describe('runAblation — gate-pass path', () => {
  it('returns a report with non-empty lossCurve and topFiveDeltaFeatures when all axes have n >= 20', () => {
    silenceLog();

    const sufficientGT = makeGroundTruth({
      'cross-aroma': 20,
      'cross-cuisine': 20,
      'absent-from-books': 20,
      'chem-bridged-rare': 20,
    });
    const features = makePairFeatures(sufficientGT);

    const report = runAblation({
      groundTruth: sufficientGT,
      pairFeatures: features,
      blendSource: FAKE_BLEND_SOURCE,
      metadata: FAKE_METADATA,
      writeOutput: false,
      lr: 0.01,
      epochs: 10,
      l2: 0.001,
    });

    expect(report).toBeDefined();
    expect(Array.isArray(report.lossCurve)).toBe(true);
    expect(report.lossCurve.length).toBe(10);
    expect(Array.isArray(report.topFiveDeltaFeatures)).toBe(true);
    expect(report.topFiveDeltaFeatures.length).toBeGreaterThan(0);
    expect(report.topFiveDeltaFeatures.length).toBeLessThanOrEqual(5);
  });

  it('report contains pre/post weights, deltaWeights, finalLoss, recommendation', () => {
    silenceLog();

    const sufficientGT = makeGroundTruth({
      'cross-aroma': 20,
      'cross-cuisine': 20,
      'absent-from-books': 20,
      'chem-bridged-rare': 20,
    });

    const report = runAblation({
      groundTruth: sufficientGT,
      pairFeatures: makePairFeatures(sufficientGT),
      blendSource: FAKE_BLEND_SOURCE,
      metadata: FAKE_METADATA,
      writeOutput: false,
      epochs: 5,
    });

    expect(report.preWeights).toEqual([2.0, 0.5, 2.5, 1.5, 1.0, 0.8, 0.3, 1.2]);
    expect(report.preBias).toBe(-3.0);
    expect(report.postWeights).toHaveLength(8);
    expect(report.deltaWeights).toHaveLength(8);
    expect(typeof report.finalLoss).toBe('number');
    expect(typeof report.recommendation).toBe('string');
    expect(report.recommendation.length).toBeGreaterThan(0);
  });

  it('topFiveDeltaFeatures entries have index, name, delta fields', () => {
    silenceLog();

    const sufficientGT = makeGroundTruth({
      'cross-aroma': 20,
      'cross-cuisine': 20,
      'absent-from-books': 20,
      'chem-bridged-rare': 20,
    });

    const report = runAblation({
      groundTruth: sufficientGT,
      pairFeatures: makePairFeatures(sufficientGT),
      blendSource: FAKE_BLEND_SOURCE,
      metadata: FAKE_METADATA,
      writeOutput: false,
      epochs: 5,
    });

    for (const entry of report.topFiveDeltaFeatures) {
      expect(typeof entry.index).toBe('number');
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.delta).toBe('number');
    }
  });

  it('lossCurve entries have epoch and loss fields', () => {
    silenceLog();

    const sufficientGT = makeGroundTruth({
      'cross-aroma': 20,
      'cross-cuisine': 20,
      'absent-from-books': 20,
      'chem-bridged-rare': 20,
    });

    const report = runAblation({
      groundTruth: sufficientGT,
      pairFeatures: makePairFeatures(sufficientGT),
      blendSource: FAKE_BLEND_SOURCE,
      metadata: FAKE_METADATA,
      writeOutput: false,
      epochs: 5,
    });

    for (const pt of report.lossCurve) {
      expect(typeof pt.epoch).toBe('number');
      expect(typeof pt.loss).toBe('number');
    }
  });
});

// ── Missing pair-features file ──

describe('runAblation — missing pair-features file', () => {
  it('calls process.exit(2) with a clear message when pairFeatures is null (simulating absent file)', () => {
    const errorLines = [];
    vi.spyOn(console, 'error').mockImplementation((msg) => errorLines.push(msg));
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit(2)'); });

    const sufficientGT = makeGroundTruth({
      'cross-aroma': 20,
      'cross-cuisine': 20,
      'absent-from-books': 20,
      'chem-bridged-rare': 20,
    });

    expect(() => runAblation({
      groundTruth: sufficientGT,
      pairFeatures: null,  // simulates absent pair-features.json
      blendSource: FAKE_BLEND_SOURCE,
      metadata: FAKE_METADATA,
      writeOutput: false,
    })).toThrow('process.exit(2)');

    expect(exitSpy).toHaveBeenCalledWith(2);
    const allOutput = errorLines.join('\n');
    expect(allOutput).toContain('feature file not found');
    expect(allOutput).toContain('ablation requires the proDataset pipeline to have run');
  });
});
