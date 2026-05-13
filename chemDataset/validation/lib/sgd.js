// PURE: gradient descent helpers. No file IO, no perceptron-config reads beyond the args passed in.

/**
 * sigmoid — logistic activation function.
 * @param {number} z
 * @returns {number} value in (0, 1)
 */
export function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

/**
 * gradientStep — single SGD update for logistic regression.
 *
 * Loss: BCE = -[y*log(p) + (1-y)*log(1-p)]
 * Gradient (w.r.t. w_i): (p - y) * x_i   (with L2 added by the caller loop)
 *
 * @param {number[]} features   — 1D array of feature values (length 8)
 * @param {number}   label      — binary label (0 or 1)
 * @param {number[]} weights    — current weight vector (same length as features)
 * @param {number}   bias       — current bias scalar
 * @param {number}   learningRate
 * @param {number}   [l2=0]    — L2 regularization coefficient
 * @returns {{ weights: number[], bias: number, loss: number }}
 */
export function gradientStep(features, label, weights, bias, learningRate, l2 = 0) {
  const n = features.length;
  // Forward pass
  let z = bias;
  for (let i = 0; i < n; i++) z += weights[i] * features[i];
  const p = sigmoid(z);

  // BCE loss (clamp p for numerical safety)
  const pClamped = Math.min(Math.max(p, 1e-15), 1 - 1e-15);
  const loss = -(label * Math.log(pClamped) + (1 - label) * Math.log(1 - pClamped));

  // Gradient: (p - y)
  const err = p - label;

  // Update weights + bias
  const newWeights = new Array(n);
  for (let i = 0; i < n; i++) {
    // gradient = err * x_i + l2 * w_i
    newWeights[i] = weights[i] - learningRate * (err * features[i] + l2 * weights[i]);
  }
  const newBias = bias - learningRate * err;

  return { weights: newWeights, bias: newBias, loss };
}

/**
 * train — full SGD training loop with L2 regularization.
 *
 * @param {number[][]} featureRows — array of feature vectors (rows × 8 features)
 * @param {number[]}   labels      — binary labels, same length as featureRows
 * @param {object}     opts
 * @param {number}     [opts.learningRate=0.01]
 * @param {number}     [opts.epochs=100]
 * @param {number}     [opts.l2=0.001]
 * @param {number[]}   [opts.initialWeights]   — defaults to zeros
 * @param {number}     [opts.initialBias=0]
 * @returns {{ weights: number[], bias: number, lossCurve: Array<{epoch:number, loss:number}>, finalLoss: number }}
 */
export function train(featureRows, labels, opts = {}) {
  const {
    learningRate = 0.01,
    epochs = 100,
    l2 = 0.001,
    initialBias = 0,
  } = opts;

  const featureDim = featureRows.length > 0 ? featureRows[0].length : 8;
  let weights = opts.initialWeights
    ? [...opts.initialWeights]
    : new Array(featureDim).fill(0);
  let bias = initialBias;

  const lossCurve = [];
  const m = featureRows.length;

  for (let epoch = 0; epoch < epochs; epoch++) {
    let epochLoss = 0;
    for (let i = 0; i < m; i++) {
      const step = gradientStep(featureRows[i], labels[i], weights, bias, learningRate, l2);
      weights = step.weights;
      bias = step.bias;
      epochLoss += step.loss;
    }
    const avgLoss = m > 0 ? epochLoss / m : 0;
    lossCurve.push({ epoch, loss: avgLoss });
  }

  const finalLoss = lossCurve.length > 0 ? lossCurve[lossCurve.length - 1].loss : 0;
  return { weights, bias, lossCurve, finalLoss };
}
