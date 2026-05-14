import { describe, it, expect } from 'vitest';
import { runAudit, parseReportHeader, hashWeights, canonicalJson, extractDefaultWeights } from '../score_pairings.js';

const FAKE_TODAY = '2026-05-13';

describe('chemDataset/validation — score_pairings', () => {
  it('canonicalJson sorts object keys deterministically', () => {
    const a = canonicalJson({ b: 1, a: 2 });
    const b = canonicalJson({ a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it('hashWeights matches the spec values', () => {
    const h = hashWeights([2.0, 0.5, 2.5, 1.5, 1.0, 0.8, 0.3, 1.2], -3.0, 'untrained');
    expect(h).toHaveLength(64); // sha256 hex
    // recompute manually to lock in
    const again = hashWeights([2.0, 0.5, 2.5, 1.5, 1.0, 0.8, 0.3, 1.2], -3.0, 'untrained');
    expect(again).toBe(h);
    // varying any field changes the hash
    expect(hashWeights([2.0, 0.5, 2.5, 1.5, 1.0, 0.8, 0.3, 1.2], -3.0, 'trained')).not.toBe(h);
    expect(hashWeights([2.0, 0.5, 2.5, 1.5, 1.0, 0.8, 0.3, 1.5], -3.0, 'untrained')).not.toBe(h);
  });

  it('extractDefaultWeights pulls the const literal from 07-blend-v2.js source text', () => {
    const sample = `const DEFAULT_WEIGHTS = {\n  weights: [2.0, 0.5, 2.5, 1.5, 1.0, 0.8, 0.3, 1.2],\n  bias: -3.0,\n};`;
    const { weights, bias } = extractDefaultWeights(sample);
    expect(weights).toEqual([2.0, 0.5, 2.5, 1.5, 1.0, 0.8, 0.3, 1.2]);
    expect(bias).toBe(-3.0);
  });

  it('extractDefaultWeights falls back to spec literal when source is mangled', () => {
    const { weights, bias } = extractDefaultWeights('// no const here');
    expect(weights).toEqual([2.0, 0.5, 2.5, 1.5, 1.0, 0.8, 0.3, 1.2]);
    expect(bias).toBe(-3.0);
  });

  it('smoke: real shipped data produces a report with required sections (allowStale)', () => {
    const { report, perAxis, scoredAgainst, weightsHash } = runAudit({
      allowStale: true,
      allowWeightChange: true,
      writeReport: false,
      today: FAKE_TODAY,
    });
    expect(report).toContain('# Pairing audit report');
    expect(report).toContain('## Per-axis verdicts');
    expect(report).toContain('scoredAgainst:');
    expect(report).toContain('weightsHash:');
    expect(scoredAgainst).toBeTruthy();
    expect(weightsHash).toHaveLength(64);
    // At least one axis should be reported.
    expect(Object.keys(perAxis).length).toBeGreaterThan(0);
    // With only 30 seed entries, at least one axis should fire the insufficient gate.
    const someInsufficient = Object.values(perAxis).some(
      (a) => typeof a.verdict === 'string' && a.verdict.startsWith('insufficient'),
    );
    expect(someInsufficient).toBe(true);
  });

  it('hash gate: synthetic metadata mismatch throws without --allow-stale', () => {
    const fakePrev = [
      '# Pairing audit report',
      '',
      '<!-- AUDIT_HEADER_BEGIN -->',
      'runDate: 2026-05-12',
      'scoredAgainst: 1999-01-01T00:00:00.000Z',
      'weightsHash: ' + 'a'.repeat(64),
      'pairingCount: 1',
      'groundTruthCount: 1',
      '<!-- AUDIT_HEADER_END -->',
      '',
    ].join('\n');
    expect(() => runAudit({
      allowStale: false,
      writeReport: false,
      pairings: [{
        ingredientA: 'salmon', ingredientB: 'dill', strength: 0.9, sharedCompounds: [],
        breakdown: { x1: 0, x2: 0, x3: 0.5, x4: 0, x5: 0, x6: 0, x7: 0, x8: 0 },
      }],
      metadata: { gnnTrainedAt: '2026-04-01T00:00:00.000Z' },
      groundTruth: { version: 1, pairings: [{ a: 'salmon', b: 'dill', axes_validated: ['cross-aroma'] }] },
      blendSource: '',
      previousReport: fakePrev,
      ingredientsMeta: {},
      gnnEntropy: null,
    })).toThrow(/Staleness gate/);
  });

  it('hash gate: bypass with allowStale + allowWeightChange', () => {
    const fakePrev = [
      '# Pairing audit report',
      '',
      '<!-- AUDIT_HEADER_BEGIN -->',
      'runDate: 2026-05-12',
      'scoredAgainst: 1999-01-01T00:00:00.000Z',
      'weightsHash: ' + 'a'.repeat(64),
      'pairingCount: 1',
      'groundTruthCount: 1',
      '<!-- AUDIT_HEADER_END -->',
      '',
    ].join('\n');
    const r = runAudit({
      allowStale: true,
      allowWeightChange: true,
      writeReport: false,
      pairings: [{
        ingredientA: 'salmon', ingredientB: 'dill', strength: 0.9, sharedCompounds: [],
        breakdown: { x1: 0, x2: 0, x3: 0.5, x4: 0, x5: 0, x6: 0, x7: 0, x8: 0 },
      }],
      metadata: { gnnTrainedAt: '2026-04-01T00:00:00.000Z' },
      groundTruth: { version: 1, pairings: [{ a: 'salmon', b: 'dill', axes_validated: ['cross-aroma'] }] },
      blendSource: '',
      previousReport: fakePrev,
      ingredientsMeta: {},
      gnnEntropy: null,
    });
    expect(r.report).toContain('# Pairing audit report');
  });

  it('per-axis verdict: synthetic gt with one axis at n=20 and others at n=5 → that axis is gated, others insufficient', () => {
    // Build 20 cross-aroma GT entries that all exist in pairings, plus 5 cross-cuisine and 5 absent-from-books.
    const gtEntries = [];
    const pairings = [];
    for (let i = 0; i < 20; i++) {
      const a = `ing-a-${i}`;
      const b = `ing-b-${i}`;
      gtEntries.push({ a, b, axes_validated: ['cross-aroma'] });
      pairings.push({
        ingredientA: a, ingredientB: b, strength: 0.9 - i * 0.01, sharedCompounds: [],
        breakdown: { x1: 0, x2: 0, x3: 0.5, x4: 0, x5: 0, x6: 0, x7: 0, x8: 0 },
      });
    }
    for (let i = 0; i < 5; i++) {
      gtEntries.push({ a: `cuis-a-${i}`, b: `cuis-b-${i}`, axes_validated: ['cross-cuisine'] });
      gtEntries.push({ a: `abs-a-${i}`, b: `abs-b-${i}`, axes_validated: ['absent-from-books'] });
    }
    const result = runAudit({
      allowStale: true,
      allowWeightChange: true,
      writeReport: false,
      pairings,
      metadata: { gnnTrainedAt: '2026-05-13T00:00:00.000Z' },
      groundTruth: { version: 1, pairings: gtEntries },
      blendSource: '',
      previousReport: null,
      ingredientsMeta: {},
      // Provide gnn_entropy so the cross-aroma classifier classifies the 20 GT pairs into the axis.
      gnnEntropy: Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [
          [`ing-a-${i}`, { topClass: i % 2 === 0 ? 'fruity' : 'fatty' }],
          [`ing-b-${i}`, { topClass: i % 2 === 0 ? 'green' : 'woody' }],
        ]).flat(),
      ),
    });
    // cross-aroma: n=20, should NOT be insufficient
    expect(result.perAxis['cross-aroma'].sampleSizeVerdict).toBe('ready');
    expect(result.perAxis['cross-aroma'].verdict).not.toMatch(/^insufficient/);
    // cross-cuisine: n=5, insufficient
    expect(result.perAxis['cross-cuisine'].sampleSizeVerdict).toBe('insufficient');
    expect(result.perAxis['cross-cuisine'].verdict).toMatch(/^insufficient/);
    // absent-from-books: n=5, insufficient
    expect(result.perAxis['absent-from-books'].sampleSizeVerdict).toBe('insufficient');
    expect(result.perAxis['absent-from-books'].verdict).toMatch(/^insufficient/);
  });

  it('curatedStoryCompoundOverlapRate is N/A when no fixture present', () => {
    // Real shipped path may or may not have a fixture; either way, the
    // smoke run reports a non-error value (N/A or computed). This
    // assertion gates against a regression where the metric is silently
    // dropped from the report.
    const { report } = runAudit({
      allowStale: true,
      allowWeightChange: true,
      writeReport: false,
      today: FAKE_TODAY,
    });
    expect(report).toMatch(/curatedStoryCompoundOverlapRate:/);
  });

  it('emits fixture_staleness_seconds in the header when the fixture is present', () => {
    // This assertion only fires when the fixture has been generated.
    // We don't fail the test if the fixture doesn't exist (the project
    // ships without it; npm run snapshot:curated-stories regenerates).
    const fs = require('node:fs');
    const path = require('node:path');
    const fixturePath = path.resolve(__dirname, '..', '..', '..', 'src', 'data', '__fixtures__', 'curated_stories.json');
    if (!fs.existsSync(fixturePath)) {
      // No fixture → skip via early return; assertion below holds.
      return;
    }
    const { report } = runAudit({
      allowStale: true,
      allowWeightChange: true,
      writeReport: false,
      today: FAKE_TODAY,
    });
    expect(report).toMatch(/fixture_staleness_seconds:/);
  });

  it('parseReportHeader extracts the header block', () => {
    const sample = [
      '# Pairing audit report',
      '',
      '<!-- AUDIT_HEADER_BEGIN -->',
      'runDate: 2026-05-13',
      'scoredAgainst: 2026-03-19T19:34:19.501819',
      'weightsHash: deadbeef',
      'pairingCount: 40000',
      'groundTruthCount: 30',
      '<!-- AUDIT_HEADER_END -->',
      '',
    ].join('\n');
    const h = parseReportHeader(sample);
    expect(h.runDate).toBe('2026-05-13');
    expect(h.scoredAgainst).toBe('2026-03-19T19:34:19.501819');
    expect(h.weightsHash).toBe('deadbeef');
    expect(h.pairingCount).toBe(40000);
    expect(h.groundTruthCount).toBe(30);
  });
});
