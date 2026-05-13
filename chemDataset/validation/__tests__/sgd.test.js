import { describe, it, expect } from 'vitest';
import { sigmoid, gradientStep, train } from '../lib/sgd.js';

describe('chemDataset/validation — sgd', () => {
  // ── sigmoid ──

  it('sigmoid(0) === 0.5', () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 10);
  });

  it('sigmoid of large positive approaches 1', () => {
    expect(sigmoid(100)).toBeCloseTo(1, 6);
    expect(sigmoid(50)).toBeCloseTo(1, 6);
  });

  it('sigmoid of large negative approaches 0', () => {
    expect(sigmoid(-100)).toBeCloseTo(0, 6);
    expect(sigmoid(-50)).toBeCloseTo(0, 6);
  });

  it('sigmoid(1) is in (0.7, 0.75)', () => {
    const s = sigmoid(1);
    expect(s).toBeGreaterThan(0.7);
    expect(s).toBeLessThan(0.75);
  });

  it('sigmoid is symmetric: sigmoid(z) + sigmoid(-z) === 1', () => {
    for (const z of [0.5, 1, 2, 5, -3]) {
      expect(sigmoid(z) + sigmoid(-z)).toBeCloseTo(1, 10);
    }
  });

  // ── gradientStep ──

  it('gradientStep reduces loss on a single positive example (label=1, features all 1)', () => {
    const features = [1, 1, 1, 1, 1, 1, 1, 1];
    const label = 1;
    const weights = [0, 0, 0, 0, 0, 0, 0, 0];
    const bias = 0;
    const lr = 0.1;
    const step1 = gradientStep(features, label, weights, bias, lr, 0);
    const step2 = gradientStep(features, label, step1.weights, step1.bias, lr, 0);
    // Loss should decrease after the first update
    expect(step2.loss).toBeLessThan(step1.loss);
  });

  it('gradientStep returns weights of same length as features', () => {
    const features = [0.5, 1.0, 0.3, 0.8, 0.1, 0.9, 0.4, 0.7];
    const { weights } = gradientStep(features, 1, [0, 0, 0, 0, 0, 0, 0, 0], 0, 0.01, 0);
    expect(weights).toHaveLength(8);
  });

  it('gradientStep with label=0 moves weights down (prediction was too high from positive features)', () => {
    const features = [1, 1, 1, 1, 1, 1, 1, 1];
    const label = 0;
    const weights = [1, 1, 1, 1, 1, 1, 1, 1];
    const bias = 0;
    const { weights: newW, bias: newB } = gradientStep(features, label, weights, bias, 0.1, 0);
    // All weights should decrease (gradient = p - 0 > 0, so w -= lr * positive)
    for (let i = 0; i < 8; i++) {
      expect(newW[i]).toBeLessThan(weights[i]);
    }
    expect(newB).toBeLessThan(bias);
  });

  // ── train ──

  it('train returns an object with weights, bias, lossCurve, finalLoss', () => {
    const features = [[1, 0, 0, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0, 0, 0]];
    const labels = [1, 0];
    const result = train(features, labels, { learningRate: 0.1, epochs: 10, l2: 0 });
    expect(result).toHaveProperty('weights');
    expect(result).toHaveProperty('bias');
    expect(result).toHaveProperty('lossCurve');
    expect(result).toHaveProperty('finalLoss');
    expect(result.weights).toHaveLength(8);
    expect(result.lossCurve).toHaveLength(10);
  });

  it('train recovers known weights on synthetic linearly-separable 8-dim data (ε=0.05, 200 epochs)', () => {
    // True separator: w = [1,0,0,0,0,0,0,0], bias = -0.5
    // Positives: x1 > 0.5, Negatives: x1 < 0.5
    const featureRows = [];
    const labels = [];
    for (let i = 0; i < 40; i++) {
      const x1 = i < 20 ? 0.9 : 0.1;
      featureRows.push([x1, 0, 0, 0, 0, 0, 0, 0]);
      labels.push(i < 20 ? 1 : 0);
    }
    const result = train(featureRows, labels, {
      learningRate: 0.1,
      epochs: 200,
      l2: 0,
      initialWeights: [0, 0, 0, 0, 0, 0, 0, 0],
      initialBias: 0,
    });
    // Loss should decrease substantially over 200 epochs
    const initialLoss = result.lossCurve[0].loss;
    expect(result.finalLoss).toBeLessThan(initialLoss * 0.5);
    // w[0] should be the dominant weight (positively learned)
    expect(result.weights[0]).toBeGreaterThan(result.weights[1]);
    expect(result.weights[0]).toBeGreaterThan(result.weights[2]);
  });

  it('L2 regularization shrinks weights compared to L2=0 baseline', () => {
    const featureRows = [];
    const labels = [];
    for (let i = 0; i < 20; i++) {
      featureRows.push([1, 1, 1, 1, 1, 1, 1, 1]);
      labels.push(i % 2);
    }
    const opts = {
      learningRate: 0.05,
      epochs: 50,
      initialWeights: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
      initialBias: 0,
    };
    const noL2 = train(featureRows, labels, { ...opts, l2: 0 });
    const withL2 = train(featureRows, labels, { ...opts, l2: 0.1 });
    // Sum of absolute weights should be smaller with L2
    const sumNoL2 = noL2.weights.reduce((s, w) => s + Math.abs(w), 0);
    const sumWithL2 = withL2.weights.reduce((s, w) => s + Math.abs(w), 0);
    expect(sumWithL2).toBeLessThan(sumNoL2);
  });

  it('train with empty featureRows returns zeros and empty lossCurve for 0 epochs', () => {
    const result = train([], [], { epochs: 0 });
    expect(result.lossCurve).toHaveLength(0);
    expect(result.finalLoss).toBe(0);
  });

  it('train uses initialWeights when provided', () => {
    const initW = [1, 2, 3, 4, 5, 6, 7, 8];
    const result = train([[0, 0, 0, 0, 0, 0, 0, 0]], [0], {
      epochs: 0,
      initialWeights: initW,
      initialBias: -1,
    });
    // 0 epochs → weights unchanged from initial
    expect(result.weights).toEqual(initW);
    expect(result.bias).toBe(-1);
  });
});
