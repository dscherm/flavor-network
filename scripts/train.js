/**
 * Training pipeline — runs embedding training + UMAP dimension reduction.
 * Exports pre-computed embeddings and 3D positions to public/ for static serving.
 *
 * Usage: node scripts/train.js
 */

import * as tf from '@tensorflow/tfjs';
import { UMAP } from 'umap-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EMBEDDING_DIM = 32;
const NEGATIVE_SAMPLES = 5;
const EPOCHS = 50;
const BATCH_SIZE = 256;
const LEARNING_RATE = 0.025;

function log(msg) {
  process.stderr.write(`[train] ${msg}\n`);
}

/** Parse ingredients.csv */
function loadPairings() {
  const text = readFileSync(resolve(__dirname, '../data/ingredients.csv'), 'utf-8');
  const pairings = new Map();

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let col1, col2;
    if (trimmed.startsWith('"')) {
      const close = trimmed.indexOf('"', 1);
      if (close === -1) continue;
      col1 = trimmed.slice(1, close).toLowerCase();
      col2 = trimmed.slice(close + 2).replace(/^"|"$/g, '').trim().toLowerCase();
    } else {
      const idx = trimmed.indexOf(',');
      if (idx === -1) continue;
      col1 = trimmed.slice(0, idx).toLowerCase();
      col2 = trimmed.slice(idx + 1).replace(/^"|"$/g, '').trim().toLowerCase();
    }

    if (!col1 || !col2) continue;
    if (!pairings.has(col1)) pairings.set(col1, []);
    pairings.get(col1).push(col2);
  }
  return pairings;
}

/** Build vocab and skip-gram training pairs */
function buildTrainingData(pairings) {
  const vocab = new Map();
  let idx = 0;
  for (const [ingredient, targets] of pairings) {
    if (!vocab.has(ingredient)) vocab.set(ingredient, idx++);
    for (const t of targets) {
      if (!vocab.has(t)) vocab.set(t, idx++);
    }
  }

  const pairs = [];
  for (const [ingredient, targets] of pairings) {
    const centerIdx = vocab.get(ingredient);
    for (const target of targets) {
      if (vocab.has(target)) {
        pairs.push([centerIdx, vocab.get(target), 1]);
      }
    }
  }

  const vocabSize = vocab.size;
  const posCount = pairs.length;
  for (let i = 0; i < posCount; i++) {
    for (let n = 0; n < NEGATIVE_SAMPLES; n++) {
      pairs.push([pairs[i][0], Math.floor(Math.random() * vocabSize), 0]);
    }
  }

  // Shuffle
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }

  return { vocab, pairs, vocabSize };
}

/** Train skip-gram embeddings */
async function trainEmbeddings(pairings) {
  const { vocab, pairs, vocabSize } = buildTrainingData(pairings);
  log(`Vocab: ${vocabSize} ingredients, ${pairs.length} training pairs`);

  const centerEmb = tf.variable(tf.randomNormal([vocabSize, EMBEDDING_DIM], 0, 0.1));
  const contextEmb = tf.variable(tf.randomNormal([vocabSize, EMBEDDING_DIM], 0, 0.1));
  const optimizer = tf.train.adam(LEARNING_RATE);

  const numBatches = Math.ceil(pairs.length / BATCH_SIZE);

  for (let epoch = 0; epoch < EPOCHS; epoch++) {
    let totalLoss = 0;

    for (let b = 0; b < numBatches; b++) {
      const batch = pairs.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
      const centerIds = batch.map(p => p[0]);
      const contextIds = batch.map(p => p[1]);
      const labels = batch.map(p => p[2]);

      const loss = optimizer.minimize(() => {
        const cVecs = tf.gather(centerEmb, centerIds);
        const ctxVecs = tf.gather(contextEmb, contextIds);
        const dots = tf.sum(tf.mul(cVecs, ctxVecs), 1);
        const labelsTensor = tf.tensor1d(labels, 'float32');
        return tf.losses.sigmoidCrossEntropy(labelsTensor, dots);
      }, true);

      totalLoss += loss.dataSync()[0];
      loss.dispose();
    }

    if (epoch % 10 === 0 || epoch === EPOCHS - 1) {
      log(`Epoch ${epoch + 1}/${EPOCHS}, Loss: ${(totalLoss / numBatches).toFixed(4)}`);
    }
  }

  const centerData = centerEmb.arraySync();
  const contextData = contextEmb.arraySync();

  const embeddings = {};
  for (const [name, id] of vocab) {
    embeddings[name] = new Array(EMBEDDING_DIM);
    for (let d = 0; d < EMBEDDING_DIM; d++) {
      embeddings[name][d] = (centerData[id][d] + contextData[id][d]) / 2;
    }
  }

  centerEmb.dispose();
  contextEmb.dispose();

  return { embeddings, vocab: [...vocab.keys()] };
}

/** UMAP projection to 3D */
function projectTo3D(embeddings) {
  const names = Object.keys(embeddings);
  const vectors = names.map(n => embeddings[n]);

  log(`Running UMAP on ${names.length} vectors...`);
  const umap = new UMAP({
    nComponents: 3,
    nNeighbors: 15,
    minDist: 0.1,
    spread: 1.0,
    nEpochs: 400,
  });

  const projected = umap.fit(vectors);

  // Normalize to [-50, 50] range
  const mins = [Infinity, Infinity, Infinity];
  const maxs = [-Infinity, -Infinity, -Infinity];
  for (const pos of projected) {
    for (let d = 0; d < 3; d++) {
      mins[d] = Math.min(mins[d], pos[d]);
      maxs[d] = Math.max(maxs[d], pos[d]);
    }
  }

  const positions = {};
  for (let i = 0; i < names.length; i++) {
    positions[names[i]] = [0, 0, 0];
    for (let d = 0; d < 3; d++) {
      const range = maxs[d] - mins[d] || 1;
      positions[names[i]][d] = ((projected[i][d] - mins[d]) / range - 0.5) * 100;
    }
  }

  return positions;
}

/** Main pipeline */
async function main() {
  log('=== Flavor Network Training Pipeline ===');

  log('Step 1: Loading pairing data...');
  const pairings = loadPairings();
  log(`Loaded ${pairings.size} ingredients with pairings`);

  log('Step 2: Training skip-gram embeddings...');
  const { embeddings, vocab } = await trainEmbeddings(pairings);

  log('Step 3: Projecting to 3D with UMAP...');
  const positions = projectTo3D(embeddings);

  log('Step 4: Exporting...');
  const outputDir = resolve(__dirname, '../public');
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  // Export embeddings
  writeFileSync(
    resolve(outputDir, 'embeddings.json'),
    JSON.stringify({ dim: EMBEDDING_DIM, count: vocab.length, embeddings })
  );

  // Export 3D positions
  writeFileSync(
    resolve(outputDir, 'positions3d.json'),
    JSON.stringify({ count: vocab.length, positions })
  );

  log(`Exported ${vocab.length} embeddings and 3D positions to public/`);
  log('=== Training complete ===');
}

main().catch(err => {
  log(`Fatal: ${err.message}`);
  process.exit(1);
});
