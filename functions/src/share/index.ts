// SHARE-4. HTTPS wrapper for sharePreview: Hosting rewrites /r/** here. The
// logic is in handler.ts; this file wires the real shell fetch and the index.

import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { createShellFetcher, handleSharePreview, type ShareEntry } from './handler';
import shareIndex from './share-index.json';

const SHELL_TIMEOUT_MS = 5_000;

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
        // SHARE-6 connects Firestore here; until then a /r/<id> gets the generic tags.
        lookupShared: async () => null,
        index: shareIndex as Record<string, ShareEntry>,
        log: (message, fields) => logger.warn(message, fields),
      },
    );
    res.status(out.status).set(out.headers).send(out.body);
  },
);
