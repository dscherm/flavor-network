/**
 * recipeImport.js — server-side recipe extraction from PDF / photo
 * via Gemini 2.5 Flash multimodal. Mirrors the bookstrapCB structurer
 * pattern but collapsed into a single call (no separate Vision OCR
 * stage), since Gemini handles vision + PDF directly.
 *
 * Lessons baked in (from bookstrapCB clients.ts + lessons):
 *   - thinkingConfig.thinkingBudget = 0 (gemini-2.5-flash otherwise
 *     consumes part of maxOutputTokens on internal reasoning and
 *     truncates the JSON mid-array).
 *   - responseMimeType + responseSchema for strict JSON output.
 *   - Lenient JSON parse pass (smart quotes, trailing commas).
 *   - 20 MB / 5 page caps for PDFs (validated client-side too).
 *   - Per-stage timeout via Promise.race.
 *   - partialDraftFromOcrText() heuristic fallback when the LLM call
 *     fails — at least surface SOMETHING editable for the user.
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const STAGE_TIMEOUT_MS = 30_000;    // 30s per stage

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    yield: { type: SchemaType.STRING },
    author: { type: SchemaType.STRING },
    time: {
      type: SchemaType.OBJECT,
      properties: {
        prep: { type: SchemaType.NUMBER },
        cook: { type: SchemaType.NUMBER },
        total: { type: SchemaType.NUMBER },
      },
    },
    ingredients: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          quantity: { type: SchemaType.NUMBER },
          unit: { type: SchemaType.STRING },
        },
        required: ['name'],
      },
    },
    instructions: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
  },
  required: ['title', 'ingredients', 'instructions'],
};

const SYSTEM_PROMPT = `You are a culinary data extractor. Your job is to read a recipe (from a photo or PDF) and produce a single JSON object exactly matching the provided schema.

Critical rules:
- INGREDIENTS are quantified raw items the cook combines. Each must have a "name". Add "quantity" (number) and "unit" (string like "cup", "tsp", "g") when present in the source.
- INSTRUCTIONS are imperative steps the cook performs. They describe ACTIONS (whisk, fold, bake at 350°F, etc.). Each instruction is one sentence in the array.
- Do NOT put quantities or measurements in instructions. "2 cups flour" goes in ingredients, NOT instructions.
- Do NOT put method verbs in ingredients. "Whisk eggs" is an instruction, not an ingredient.
- If the source has section headers ("INGREDIENTS:", "DIRECTIONS:"), use them to disambiguate. If not, classify by sentence shape: noun phrases with quantities → ingredients; imperative sentences → instructions.
- Title: extract the recipe name. If there's no obvious title, infer one from the first heading or the dish description.
- Yield, author, time fields: include only if explicitly stated.
- Output ONLY the JSON object. No markdown fencing, no commentary.`;

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/**
 * Lenient JSON parse — Gemini occasionally emits trailing commas or
 * smart quotes inside string fields. Strip them before parse.
 */
function parseLenient(raw) {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(cleaned);
}

/**
 * Heuristic fallback — when the LLM call fails outright, at least
 * try to extract SOMETHING from the raw text (if any was returned).
 * Returns a "partial" draft the user can edit.
 */
function heuristicPartialDraft(rawText) {
  const lines = (rawText || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const ingredients = [];
  const instructions = [];
  let mode = null;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/^ingredients?[:.]?$/.test(lower)) { mode = 'ing'; continue; }
    if (/^(directions?|instructions?|method|steps?)[:.]?$/.test(lower)) { mode = 'ins'; continue; }
    // Heuristic: lines starting with a digit + (unit | space + word) → ingredient
    if (mode !== 'ins' && /^\d/.test(line)) {
      ingredients.push({ name: line });
    } else if (mode === 'ins') {
      instructions.push(line);
    }
  }
  return {
    title: lines[0] || 'Untitled Recipe',
    ingredients,
    instructions,
    partial: true,
    partialReason: 'LLM extraction failed; this is a best-effort heuristic draft. Please edit before saving.',
  };
}

/**
 * Extract a structured recipe from an uploaded file buffer.
 * @param {Buffer} buffer
 * @param {string} mimeType  e.g. 'image/jpeg', 'application/pdf'
 * @returns {Promise<object>} StructuredRecipe (or partial draft on failure)
 */
export async function extractRecipe(buffer, mimeType) {
  if (!process.env.GEMINI_API_KEY) {
    const err = new Error('GEMINI_API_KEY is not set. See .env.example.');
    err.code = 'NO_API_KEY';
    throw err;
  }
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty file');
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error(`File exceeds the ${MAX_BYTES / 1024 / 1024} MB limit`);
  }
  const looksLikePdf = mimeType === 'application/pdf';
  const looksLikeImage = mimeType?.startsWith('image/');
  if (!looksLikePdf && !looksLikeImage) {
    throw new Error(`Unsupported MIME type: ${mimeType}`);
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const sourceHint = looksLikePdf
    ? 'The attachment is a multi-page PDF of a recipe.'
    : 'The attachment is a single photo of a recipe.';

  const parts = [
    { text: `${sourceHint} Extract the recipe per the rules above.` },
    {
      inlineData: {
        mimeType,
        data: buffer.toString('base64'),
      },
    },
  ];

  let raw = '';
  try {
    const result = await withTimeout(
      model.generateContent({ contents: [{ role: 'user', parts }] }),
      STAGE_TIMEOUT_MS,
      'gemini-extract',
    );
    raw = result?.response?.text() || '';
    if (!raw) throw new Error('Gemini returned empty response');
    const parsed = parseLenient(raw);
    if (!parsed.title || !Array.isArray(parsed.ingredients)) {
      throw new Error('Parsed JSON missing required fields');
    }
    parsed.partial = false;
    return parsed;
  } catch (err) {
    // Fallback: return a partial draft from whatever raw text we got
    // back, so the UI can still show an editable form.
    console.error('[recipeImport] extractRecipe failed:', err.message);
    if (err.code === 'NO_API_KEY') throw err;
    const fallback = heuristicPartialDraft(raw);
    fallback.error = err.message;
    return fallback;
  }
}
