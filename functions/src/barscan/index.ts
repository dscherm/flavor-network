// BARPHOTO-3. Firebase Callable wrapper for scanBar: one photo of a home bar
// in, a list of bottles out. The logic is in handler.ts; this file only wires
// the real Gemini call and the Firestore-backed daily counter. The image is
// held in memory for the call and never stored or logged.

import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { GoogleGenerativeAI, type ResponseSchema } from '@google/generative-ai';
import { handleScanBar, MAX_OUTPUT_TOKENS } from './handler';
import type { ScanBarRequest, ScanBarResult, UsageStore } from './types';

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
// One call; the handler owns the retry budget. This only stops a hung socket.
const CALL_TIMEOUT_MS = 20_000;

function firestoreUsage(): UsageStore {
  if (getApps().length === 0) initializeApp();
  const ref = (uid: string, day: string) => getFirestore().collection('barScans').doc(`${uid}_${day}`);
  return {
    async get(uid, day) {
      const snap = await ref(uid, day).get();
      const n = snap.exists ? snap.get('count') : 0;
      return typeof n === 'number' ? n : 0;
    },
    async increment(uid, day) {
      await ref(uid, day).set({ count: FieldValue.increment(1), uid, day }, { merge: true });
    },
  };
}

async function askGemini(imageBase64: string, mimeType: string, prompt: string, schema: unknown): Promise<string> {
  const model = new GoogleGenerativeAI(GEMINI_API_KEY.value()).getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: 'application/json',
      responseSchema: schema as ResponseSchema,
      // thinkingConfig is newer than the SDK's types; the API accepts it.
      thinkingConfig: { thinkingBudget: 0 },
    } as Record<string, unknown>,
  });
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`gemini timed out after ${CALL_TIMEOUT_MS}ms (503)`)), CALL_TIMEOUT_MS);
  });
  try {
    const res = await Promise.race([
      model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { data: imageBase64, mimeType } }] }],
      }),
      timeout,
    ]);
    return res.response.text();
  } finally {
    clearTimeout(timer);
  }
}

export const scanBar = onCall(
  {
    timeoutSeconds: 60,
    memory: '512MiB',
    secrets: [GEMINI_API_KEY],
    // Same allow-list as scrapeRecipe (see scrape/index.ts for why).
    cors: [
      'https://neuralflavor.web.app',
      'https://neuralflavor.firebaseapp.com',
      /^https:\/\/.*\.neuralflavor\.web\.app$/,
      /^http:\/\/localhost(:\d+)?$/,
      'capacitor://localhost',
      'ionic://localhost',
      /^capacitor:\/\/localhost(:\d+)?$/,
    ],
  },
  async (request: CallableRequest<ScanBarRequest>): Promise<ScanBarResult> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in to add bottles from a photo.');
    }
    try {
      return await handleScanBar(request.auth.uid, request.data, {
        askModel: askGemini,
        usage: firestoreUsage(),
        now: () => Date.now(),
        log: (message, fields) => logger.info(message, fields),
      });
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', 'Something went wrong reading that photo. Try again.');
    }
  },
);
