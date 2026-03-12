import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { recognizeRecipeImage, terminateOCR } from '../ml/ocr.js';
import { buildIngredientIndex, parseIngredients } from '../data/recipeParser.js';

/**
 * RecipeScanner — capture or upload recipe images, run OCR via Tesseract.js,
 * match extracted text against known ingredients, and let the user review
 * before adding to their profile.
 *
 * Props:
 *   ingredientList: string[] — known ingredients from flavor network
 *   onSave(name: string, ingredients: string[]) — save confirmed ingredients
 *   onClose() — close the scanner modal
 */
function RecipeScanner({ ingredientList, onSave, onClose }) {
  const [mode, setMode] = useState('choose'); // 'choose' | 'camera' | 'preview' | 'processing' | 'results'
  const [imageData, setImageData] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState('environment');
  const [ocrProgress, setOcrProgress] = useState({ status: '', progress: 0 });
  const [ocrText, setOcrText] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [extracted, setExtracted] = useState([]); // { name, confirmed }[]
  const [recipeName, setRecipeName] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const parserIndex = useMemo(
    () => buildIngredientIndex(ingredientList || []),
    [ingredientList],
  );

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async (facing) => {
    stopCamera();
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing || facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setMode('camera');
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera access denied. Please allow camera permissions and try again.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device. Try uploading an image instead.');
      } else {
        setCameraError('Could not access camera. Try uploading an image instead.');
      }
    }
  }, [facingMode, stopCamera]);

  // Clean up camera and OCR worker on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      terminateOCR();
    };
  }, [stopCamera]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setImageData(dataUrl);
    stopCamera();
    setMode('preview');
  }, [stopCamera]);

  const handleFlipCamera = useCallback(() => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  }, [facingMode, startCamera]);

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setCameraError('Please select an image file (JPG, PNG, etc.)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImageData(ev.target.result);
      setMode('preview');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRetake = useCallback(() => {
    setImageData(null);
    setOcrText('');
    setOcrConfidence(0);
    setExtracted([]);
    setRecipeName('');
    setMode('choose');
  }, []);

  // Run OCR on the captured image
  const handleProcess = useCallback(async () => {
    if (!imageData) return;
    setMode('processing');
    setOcrProgress({ status: 'initializing', progress: 0 });

    try {
      const result = await recognizeRecipeImage(imageData, {
        onProgress: setOcrProgress,
      });

      setOcrText(result.text);
      setOcrConfidence(result.confidence);

      // Match OCR text against known ingredients
      const matched = parseIngredients(result.text, parserIndex);
      const items = matched.map((name) => ({ name, confirmed: true }));

      setExtracted(items);
      setMode('results');

      if (items.length === 0) {
        setCameraError(
          'No known ingredients detected. The image may be blurry or the text may not be a recipe. Try retaking or uploading a clearer image.'
        );
      }
    } catch (err) {
      setCameraError(err.message || 'OCR processing failed. Please try again.');
      setMode('preview');
    }
  }, [imageData, parserIndex]);

  const toggleIngredient = useCallback((name) => {
    setExtracted((prev) =>
      prev.map((item) =>
        item.name === name ? { ...item, confirmed: !item.confirmed } : item,
      ),
    );
  }, []);

  const confirmedIngredients = useMemo(
    () => extracted.filter((i) => i.confirmed).map((i) => i.name),
    [extracted],
  );

  const handleSave = useCallback(() => {
    if (confirmedIngredients.length === 0) return;
    const name = recipeName.trim() || 'Scanned Recipe';
    onSave(name, confirmedIngredients);
    onClose();
  }, [recipeName, confirmedIngredients, onSave, onClose]);

  // Progress bar label
  const progressLabel = useMemo(() => {
    const { status, progress } = ocrProgress;
    const pct = Math.round(progress * 100);
    if (status === 'initializing') return 'Loading OCR engine...';
    if (status === 'loading tesseract core') return `Loading OCR engine... ${pct}%`;
    if (status === 'loading language traineddata') return `Loading language data... ${pct}%`;
    if (status === 'recognizing text') return `Recognizing text... ${pct}%`;
    return `Processing... ${pct}%`;
  }, [ocrProgress]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[440px] max-h-[85vh] bg-[#12121a] border border-[#1e1e2e] rounded-lg flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[#1e1e2e]">
          <h2 className="text-sm font-medium text-gray-200 tracking-wide flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            Scan Recipe
          </h2>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
            aria-label="Close scanner"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Choose mode — camera or upload */}
          {mode === 'choose' && (
            <div className="space-y-3">
              <p className="text-[11px] text-gray-400 text-center">
                Take a photo of a recipe or ingredient list, or upload an existing image.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => startCamera()}
                  className="flex flex-col items-center justify-center gap-2 p-4 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg hover:border-blue-500/30 hover:bg-blue-500/5 transition-colors group"
                >
                  <svg className="w-8 h-8 text-gray-500 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                  <span className="text-[11px] text-gray-400 group-hover:text-blue-300 transition-colors">
                    Take Photo
                  </span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-4 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg hover:border-blue-500/30 hover:bg-blue-500/5 transition-colors group"
                >
                  <svg className="w-8 h-8 text-gray-500 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <span className="text-[11px] text-gray-400 group-hover:text-blue-300 transition-colors">
                    Upload Image
                  </span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}

          {/* Camera error / general error */}
          {cameraError && (
            <div className="text-[11px] text-amber-400/80 bg-amber-500/5 border border-amber-500/10 rounded px-2.5 py-2">
              {cameraError}
            </div>
          )}

          {/* Camera view */}
          {mode === 'camera' && (
            <div className="space-y-2">
              <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Viewfinder overlay */}
                <div className="absolute inset-4 border border-white/20 rounded pointer-events-none" />
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleFlipCamera}
                  className="p-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-full hover:border-blue-500/30 transition-colors"
                  title="Switch camera"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
                  </svg>
                </button>

                <button
                  onClick={handleCapture}
                  className="w-14 h-14 rounded-full border-4 border-white/80 bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
                  title="Capture photo"
                >
                  <div className="w-10 h-10 rounded-full bg-white/90" />
                </button>

                <button
                  onClick={() => { stopCamera(); setMode('choose'); }}
                  className="p-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-full hover:border-blue-500/30 transition-colors"
                  title="Back"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                  </svg>
                </button>
              </div>

              <p className="text-[10px] text-gray-600 text-center">
                Position the recipe or ingredient list within the frame, then tap the capture button.
              </p>
            </div>
          )}

          {/* Image preview (before OCR) */}
          {mode === 'preview' && imageData && (
            <div className="space-y-3">
              <div className="rounded-lg overflow-hidden bg-black">
                <img
                  src={imageData}
                  alt="Captured recipe"
                  className="w-full h-auto max-h-[50vh] object-contain"
                />
              </div>
              <p className="text-[10px] text-gray-500 text-center">
                Make sure text is clearly visible. Retake if the image is blurry or cut off.
              </p>
            </div>
          )}

          {/* Processing — OCR in progress */}
          {mode === 'processing' && (
            <div className="space-y-3 py-4">
              {imageData && (
                <div className="rounded-lg overflow-hidden bg-black opacity-50">
                  <img
                    src={imageData}
                    alt="Processing"
                    className="w-full h-auto max-h-[30vh] object-contain"
                  />
                </div>
              )}
              <div className="space-y-2">
                <p className="text-[11px] text-gray-300 text-center">{progressLabel}</p>
                <div className="w-full h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500/60 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, ocrProgress.progress * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Results — matched ingredients */}
          {mode === 'results' && (
            <div className="space-y-3">
              {/* Confidence indicator */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500">OCR confidence:</span>
                <span className={`text-[10px] font-medium ${
                  ocrConfidence >= 80 ? 'text-green-400' :
                  ocrConfidence >= 50 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {Math.round(ocrConfidence)}%
                </span>
              </div>

              {/* Recipe name */}
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">
                  Recipe Name
                </label>
                <input
                  type="text"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  placeholder="Name this scanned recipe"
                  className="w-full text-xs bg-[#1a1a2e] border border-[#2a2a3e] text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
                />
              </div>

              {/* Ingredient checklist */}
              {extracted.length > 0 && (
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">
                    Detected Ingredients ({confirmedIngredients.length} / {extracted.length} selected)
                  </label>
                  <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded max-h-48 overflow-y-auto">
                    {extracted.map((item) => (
                      <button
                        key={item.name}
                        onClick={() => toggleIngredient(item.name)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors border-b border-[#2a2a3e] last:border-b-0 ${
                          item.confirmed
                            ? 'text-blue-300 bg-blue-500/5'
                            : 'text-gray-500 line-through'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                          item.confirmed
                            ? 'border-blue-400 bg-blue-500/20'
                            : 'border-gray-600'
                        }`}>
                          {item.confirmed && (
                            <svg className="w-2.5 h-2.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className="flex-1 text-left">{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw OCR text (collapsible) */}
              {ocrText && (
                <details className="group">
                  <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-300 transition-colors">
                    Show raw OCR text
                  </summary>
                  <pre className="mt-1 text-[10px] text-gray-600 bg-[#1a1a2e] border border-[#2a2a3e] rounded p-2 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                    {ocrText}
                  </pre>
                </details>
              )}

              {/* Retake link */}
              <button
                onClick={handleRetake}
                className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                Scan a different image
              </button>
            </div>
          )}
        </div>

        {/* Hidden canvas for capturing video frames */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-3 border-t border-[#1e1e2e]">
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5"
          >
            Cancel
          </button>
          {mode === 'preview' && (
            <>
              <button
                onClick={handleRetake}
                className="text-[11px] text-gray-400 hover:text-gray-200 transition-colors px-3 py-1.5"
              >
                Retake
              </button>
              <button
                onClick={handleProcess}
                className="text-[11px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded px-4 py-1.5 transition-colors"
              >
                Process Image
              </button>
            </>
          )}
          {mode === 'results' && (
            <button
              onClick={handleSave}
              disabled={confirmedIngredients.length === 0}
              className="text-[11px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-30 disabled:cursor-default rounded px-4 py-1.5 transition-colors"
            >
              Add to Profile ({confirmedIngredients.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default RecipeScanner;
