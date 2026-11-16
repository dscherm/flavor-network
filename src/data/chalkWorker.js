// Runs chalkify off the main thread. Receives { id, image, settings }, answers with
// { id, progress } messages and one { id, result } (the pixel buffer is transferred).
// No network access: the only channel is postMessage back to the page that started it.
import { chalkify } from './chalkFilter.js';

self.onmessage = (e) => {
  const { id, image, settings } = e.data;
  try {
    let last = -1;
    const result = chalkify(image, settings, {
      onProgress: (f) => {
        if (f - last >= 0.02 || f === 1) { last = f; self.postMessage({ id, progress: f }); }
      },
    });
    self.postMessage({ id, result }, [result.data.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};
