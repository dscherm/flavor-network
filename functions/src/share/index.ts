// SHARE-4. HTTPS wrapper for sharePreview: Hosting rewrites /r/** here. The
// logic is in handler.ts; this file wires the real shell fetch and the index.

import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { createShellFetcher, handleSharePreview, type ShareEntry } from './handler';
import shareIndex from './share-index.json';
import shareCards from './share-cards.json';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { handleShareCard, type CardData } from './card';
import { createSharedLookup } from './shared';

const SHELL_TIMEOUT_MS = 5_000;

// shared/{id} through the Admin SDK (rules do not apply). One cache for both functions; a removed share
// stops being served within SHARED_TTL_MS. A read that throws propagates: each handler logs it and serves the generic result.
const shared = createSharedLookup(async (id) => {
  if (getApps().length === 0) initializeApp();
  const snap = await getFirestore().collection('shared').doc(id).get();
  return snap.exists ? snap.data() : null;
});

// /index.html is served statically by Hosting (the rewrite covers only /r/**), so this cannot loop.
const fetchIndexHtml = createShellFetcher(async (origin) => {
  const res = await fetch(`${origin}/index.html`, { signal: AbortSignal.timeout(SHELL_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`index.html ${res.status}`);
  const text = await res.text();
  if (!/<\/head>/i.test(text)) throw new Error('index.html has no head');
  return text;
});

export const sharePreview = onRequest(
  { region: 'us-central1', memory: '256MiB', timeoutSeconds: 15, invoker: 'public' },
  async (req, res) => {
    const out = await handleSharePreview(
      { path: req.path, headers: req.headers },
      {
        fetchIndexHtml,
        lookupShared: (id) => shared.preview(id.toLowerCase()),
        index: shareIndex as Record<string, ShareEntry>,
        log: (message, fields) => logger.warn(message, fields),
      },
    );
    res.status(out.status).set(out.headers).send(out.body);
  },
);

// SHARE-5. Hosting rewrites /r-img/** here: the 1200x630 PNG behind og:image.
export const shareCard = onRequest(
  { region: 'us-central1', memory: '1GiB', timeoutSeconds: 30, invoker: 'public' },
  async (req, res) => {
    const out = await handleShareCard(
      { path: req.path },
      {
        cards: shareCards as unknown as Record<string, CardData>,
        lookupShared: (id) => shared.card(id),
        log: (message, fields) => logger.warn(message, fields),
      },
    );
    res.status(out.status).set(out.headers).send(out.body);
  },
);
