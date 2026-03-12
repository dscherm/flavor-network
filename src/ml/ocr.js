/**
 * OCR module — extract text from recipe images using Tesseract.js (client-side).
 *
 * Lazy-loads Tesseract.js to avoid bundling it for users who don't use scanning.
 * Provides progress callbacks for the loading/recognition phases.
 */

let workerPromise = null;

/**
 * Lazily initialize the Tesseract.js worker.
 * Reuses the same worker across multiple calls.
 * @param {(progress: { status: string, progress: number }) => void} [onProgress]
 * @returns {Promise<import('tesseract.js').Worker>}
 */
async function getWorker(onProgress) {
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    const Tesseract = await import('tesseract.js');
    const worker = await Tesseract.createWorker('eng', undefined, {
      logger: (m) => {
        if (onProgress && m.progress !== undefined) {
          onProgress({ status: m.status || 'loading', progress: m.progress });
        }
      },
    });
    return worker;
  })();

  return workerPromise;
}

/**
 * Pre-process an image for better OCR results:
 * - Convert to grayscale
 * - Increase contrast
 * - Sharpen text edges
 *
 * @param {string} imageDataUrl — data URL of the source image
 * @returns {Promise<string>} — processed data URL
 */
function preprocessImage(imageDataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      // Draw original
      ctx.drawImage(img, 0, 0);

      // Get pixel data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Convert to grayscale and increase contrast
      for (let i = 0; i < data.length; i += 4) {
        // Luminance
        let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

        // Increase contrast (stretch histogram)
        gray = ((gray - 128) * 1.5) + 128;
        gray = Math.max(0, Math.min(255, gray));

        // Threshold for cleaner text (adaptive-ish)
        if (gray < 140) gray = 0;
        else if (gray > 180) gray = 255;

        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = imageDataUrl;
  });
}

/**
 * Extract text from a recipe image using Tesseract.js OCR.
 *
 * @param {string} imageDataUrl — data URL of the captured/uploaded image
 * @param {object} [options]
 * @param {(progress: { status: string, progress: number }) => void} [options.onProgress]
 * @param {boolean} [options.preprocess=true] — apply image preprocessing for better results
 * @returns {Promise<{ text: string, confidence: number, lines: string[] }>}
 */
export async function recognizeRecipeImage(imageDataUrl, options = {}) {
  const { onProgress, preprocess = true } = options;

  // Preprocess image for better OCR
  const processedImage = preprocess
    ? await preprocessImage(imageDataUrl)
    : imageDataUrl;

  if (onProgress) {
    onProgress({ status: 'initializing', progress: 0 });
  }

  const worker = await getWorker(onProgress);

  const result = await worker.recognize(processedImage);

  // Extract lines, filtering out very short/empty ones
  const lines = result.data.text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  return {
    text: result.data.text,
    confidence: result.data.confidence,
    lines,
  };
}

/**
 * Clean up the Tesseract worker to free memory.
 * Call this when the scanner modal is closed.
 */
export async function terminateOCR() {
  if (workerPromise) {
    try {
      const worker = await workerPromise;
      await worker.terminate();
    } catch {
      // Worker may already be terminated
    }
    workerPromise = null;
  }
}
