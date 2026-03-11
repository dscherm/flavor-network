/**
 * Ingredient embeddings — Word2Vec-style skip-gram model using TensorFlow.js.
 * Trains on pairing co-occurrence data to learn ingredient embeddings.
 *
 * Can run in two modes:
 * 1. Node.js CLI: `node src/ml/embeddings.js` — trains and exports to public/embeddings.json
 * 2. Browser: import { loadPrecomputedEmbeddings } to load pre-trained embeddings
 */

import * as tf from '@tensorflow/tfjs';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EMBEDDING_DIM = 32;
const WINDOW_SIZE = 5;
const NEGATIVE_SAMPLES = 5;
const EPOCHS = 50;
const BATCH_SIZE = 256;
const LEARNING_RATE = 0.025;

/**
 * Parse ingredients.csv from disk (Node.js only).
 */
function loadPairingsFromDisk() {
  const dataDir = resolve(__dirname, '../../data');
  const text = readFileSync(resolve(dataDir, 'ingredients.csv'), 'utf-8');

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

/**
 * Build vocabulary and training pairs from pairings data.
 */
function buildTrainingData(pairings) {
  // Build vocabulary from all ingredients that appear as keys
  const vocab = new Map();
  let idx = 0;
  for (const [ingredient, targets] of pairings) {
    if (!vocab.has(ingredient)) vocab.set(ingredient, idx++);
    for (const t of targets) {
      if (!vocab.has(t)) vocab.set(t, idx++);
    }
  }

  // Build "sentences" — each ingredient's pairing list is a context window
  const pairs = [];
  for (const [ingredient, targets] of pairings) {
    const centerIdx = vocab.get(ingredient);
    for (const target of targets) {
      if (vocab.has(target)) {
        pairs.push([centerIdx, vocab.get(target), 1]); // positive pair
      }
    }
  }

  // Add negative samples
  const vocabSize = vocab.size;
  const vocabArray = [...vocab.keys()];
  for (let i = 0; i < pairs.length; i++) {
    for (let n = 0; n < NEGATIVE_SAMPLES; n++) {
      const negIdx = Math.floor(Math.random() * vocabSize);
      pairs.push([pairs[i][0], negIdx, 0]); // negative pair
    }
  }

  // Shuffle
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }

  return { vocab, pairs, vocabSize };
}

/**
 * Train skip-gram model and return embeddings.
 */
async function trainEmbeddings(pairings) {
  const { vocab, pairs, vocabSize } = buildTrainingData(pairings);

  process.stderr.write(`Vocabulary size: ${vocabSize}\n`);
  process.stderr.write(`Training pairs: ${pairs.length}\n`);

  // Model: two embedding layers (center and context), dot product + sigmoid
  const centerEmbedding = tf.variable(
    tf.randomNormal([vocabSize, EMBEDDING_DIM], 0, 0.1)
  );
  const contextEmbedding = tf.variable(
    tf.randomNormal([vocabSize, EMBEDDING_DIM], 0, 0.1)
  );

  const optimizer = tf.train.adam(LEARNING_RATE);

  const numBatches = Math.ceil(pairs.length / BATCH_SIZE);

  for (let epoch = 0; epoch < EPOCHS; epoch++) {
    let totalLoss = 0;

    for (let b = 0; b < numBatches; b++) {
      const batchStart = b * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, pairs.length);
      const batch = pairs.slice(batchStart, batchEnd);

      const centerIds = batch.map(p => p[0]);
      const contextIds = batch.map(p => p[1]);
      const labels = batch.map(p => p[2]);

      const loss = optimizer.minimize(() => {
        const centerVecs = tf.gather(centerEmbedding, centerIds);
        const contextVecs = tf.gather(contextEmbedding, contextIds);

        // Dot product
        const dots = tf.sum(tf.mul(centerVecs, contextVecs), 1);
        const predictions = tf.sigmoid(dots);

        // Binary cross-entropy
        const labelsTensor = tf.tensor1d(labels, 'float32');
        const bce = tf.losses.sigmoidCrossEntropy(labelsTensor, dots);

        return bce;
      }, true);

      totalLoss += loss.dataSync()[0];
      loss.dispose();
    }

    if (epoch % 10 === 0 || epoch === EPOCHS - 1) {
      process.stderr.write(`Epoch ${epoch + 1}/${EPOCHS}, Loss: ${(totalLoss / numBatches).toFixed(4)}\n`);
    }
  }

  // Extract final embeddings (average of center and context)
  const centerData = centerEmbedding.arraySync();
  const contextData = contextEmbedding.arraySync();

  const embeddings = {};
  for (const [name, id] of vocab) {
    const combined = new Array(EMBEDDING_DIM);
    for (let d = 0; d < EMBEDDING_DIM; d++) {
      combined[d] = (centerData[id][d] + contextData[id][d]) / 2;
    }
    embeddings[name] = combined;
  }

  // Cleanup
  centerEmbedding.dispose();
  contextEmbedding.dispose();

  return { embeddings, vocab: [...vocab.keys()] };
}

/**
 * Load pre-computed embeddings from static JSON (browser use).
 */
export async function loadPrecomputedEmbeddings(path = '/embeddings.json') {
  const res = await fetch(path);
  return res.json();
}

/**
 * CLI entry point — train and export.
 */
async function main() {
  process.stderr.write('Loading pairing data...\n');
  const pairings = loadPairingsFromDisk();
  process.stderr.write(`Loaded ${pairings.size} ingredients\n`);

  process.stderr.write('Training embeddings...\n');
  const { embeddings, vocab } = await trainEmbeddings(pairings);

  const outputDir = resolve(__dirname, '../../public');
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const output = {
    dim: EMBEDDING_DIM,
    count: vocab.length,
    embeddings,
  };

  const outputPath = resolve(outputDir, 'embeddings.json');
  writeFileSync(outputPath, JSON.stringify(output));
  process.stderr.write(`Exported ${vocab.length} embeddings (${EMBEDDING_DIM}D) to ${outputPath}\n`);
}

// Run if executed directly
const isMain = process.argv[1] && resolve(process.argv[1]) === __filename;
if (isMain) {
  main().catch(err => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  });
}

export { trainEmbeddings, EMBEDDING_DIM };
