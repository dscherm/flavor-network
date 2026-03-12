import { useState, useRef, useCallback, useEffect } from 'react';
import { recognizeRecipeImage, terminateOCR } from '../ml/ocr.js';
import { matchOcrLines } from '../data/ingredientMatcher.js';

/**
 * RecipeScanner — camera capture UI for photographing printed or handwritten
 * recipes / ingredient lists. Supports both live camera capture via getUserMedia
 * and file upload as a fallback. Runs Tesseract.js OCR on the captured image,
 * then matches extracted text against known ingredients via ingredientMatcher.
 *
 * Props:
 *   ingredientList: string[] — known ingredient names for matching
 *   onSave(name: string, ingredients: string[]) — save recipe to profile
 *   onClose() — dismiss the scanner modal
 */
function RecipeScanner({ ingredientList, onSave, onClose }) {
  const [mode, setMode] = useState('choose'); // 'choose' | 'camera' | 'preview' | 'loading' | 'results'
  const [imageData, setImageData] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [streamReady, setStreamReady] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');

  // OCR state
  const [ocrProgress, setOcrProgress] = useState({ status: '', progress: 0 });
  const [rawText, setRawText] = useState('');
  const [matchedIngredients, setMatchedIngredients] = useState([]); // { name, confidence, raw, selected }[]
  const [recipeName, setRecipeName] = useState('');
  const [ocrError, setOcrError] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStreamReady(false);
  }, []);

  const startCamera = useCallback(async (facing) => {
    stopCamera();
    setCameraError('');
    setStreamReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing || facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setStreamReady(true);
        };
      }
      setMode('camera');
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera access denied. Please allow camera permissions or upload an image instead.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device. Try uploading an image instead.');
      } else {
        setCameraError(`Could not access camera: ${err.message}. Try uploading an image instead.`);
      }
    }
  }, [facingMode, stopCamera]);

  // Clean up media stream and OCR worker on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      terminateOCR();
    };
  }, [stopCamera]);

  // Capture photo from video feed — draw frame to canvas, convert to data URL
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

  // Switch between front and rear cameras
  const handleFlipCamera = useCallback(() => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  }, [facingMode, startCamera]);

  // File upload as alternative input
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
      stopCamera();
      setMode('preview');
    };
    reader.readAsDataURL(file);
    // Reset the input so the same file can be re-selected
    e.target.value = '';
  }, [stopCamera]);

  // Retake — go back to choose screen
  const handleRetake = useCallback(() => {
    setImageData(null);
    setCameraError('');
    setOcrError('');
    setRawText('');
    setMatchedIngredients([]);
    setRecipeName('');
    setMode('choose');
  }, []);

  // Process — run OCR on captured image, then match ingredients
  const handleProcess = useCallback(async () => {
    if (!imageData) return;
    setMode('loading');
    setOcrError('');
    setOcrProgress({ status: 'initializing', progress: 0 });

    try {
      // Step 1: Run Tesseract.js OCR
      const ocrResult = await recognizeRecipeImage(imageData, {
        onProgress: setOcrProgress,
        preprocess: true,
      });

      if (!ocrResult.text || ocrResult.text.trim().length === 0) {
        setOcrError('No text could be detected in the image. Try a clearer photo with better lighting.');
        setMode('preview');
        return;
      }

      setRawText(ocrResult.text);

      // Step 2: Match extracted lines against known ingredients
      const matches = ingredientList && ingredientList.length > 0
        ? matchOcrLines(ocrResult.lines, ingredientList)
        : [];

      // Add a 'selected' flag to each match (default: selected if confidence > 0.6)
      setMatchedIngredients(
        matches.map((m) => ({ ...m, selected: m.confidence > 0.6 }))
      );

      // Auto-generate a recipe name from the first line if it looks like a title
      const firstLine = ocrResult.lines[0] || '';
      if (firstLine.length > 3 && firstLine.length < 60 && !/^\d/.test(firstLine)) {
        setRecipeName(firstLine);
      } else {
        setRecipeName('Scanned Recipe');
      }

      setMode('results');
    } catch (err) {
      console.error('OCR processing failed:', err);
      setOcrError(`OCR failed: ${err.message || 'Unknown error'}. Please try again.`);
      setMode('preview');
    }
  }, [imageData, ingredientList]);

  // Toggle ingredient selection in results
  const toggleIngredient = useCallback((index) => {
    setMatchedIngredients((prev) =>
      prev.map((m, i) => (i === index ? { ...m, selected: !m.selected } : m))
    );
  }, []);

  // Save selected ingredients as a recipe
  const handleSave = useCallback(() => {
    const selected = matchedIngredients
      .filter((m) => m.selected)
      .map((m) => m.name);

    if (selected.length === 0) return;

    const name = recipeName.trim() || 'Scanned Recipe';
    onSave(name, selected);
    onClose();
  }, [matchedIngredients, recipeName, onSave, onClose]);

  // Close and clean up
  const handleClose = useCallback(() => {
    stopCamera();
    terminateOCR();
    onClose();
  }, [stopCamera, onClose]);

  // Confidence badge color
  const confidenceColor = (c) => {
    if (c >= 0.8) return 'text-green-400 bg-green-500/10 border-green-500/20';
    if (c >= 0.6) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  };

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
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
            aria-label="Close scanner"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Camera error / general error */}
          {(cameraError || ocrError) && (
            <div className="text-[11px] text-amber-400/80 bg-amber-500/5 border border-amber-500/10 rounded px-2.5 py-2">
              {cameraError || ocrError}
            </div>
          )}

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
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}

          {/* Camera viewfinder */}
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
                {/* Viewfinder overlay with corner brackets */}
                {streamReady && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-blue-400/60 rounded-tl" />
                    <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-blue-400/60 rounded-tr" />
                    <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-blue-400/60 rounded-bl" />
                    <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-blue-400/60 rounded-br" />
                  </div>
                )}
                {/* Loading spinner while camera initializes */}
                {!streamReady && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-6 h-6 animate-spin text-blue-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <p className="text-[11px] text-gray-500">Starting camera...</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-3">
                {/* Flip camera button */}
                <button
                  onClick={handleFlipCamera}
                  className="p-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-full hover:border-blue-500/30 transition-colors"
                  title="Switch camera"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
                  </svg>
                </button>

                {/* Shutter / capture button */}
                <button
                  onClick={handleCapture}
                  disabled={!streamReady}
                  className="w-14 h-14 rounded-full border-4 border-white/80 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-default transition-colors flex items-center justify-center"
                  title="Capture photo"
                >
                  <div className="w-10 h-10 rounded-full bg-white/90" />
                </button>

                {/* Back button */}
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

          {/* Image preview — shown after capture or file upload */}
          {mode === 'preview' && imageData && (
            <div className="space-y-3">
              <div className="relative rounded-lg overflow-hidden bg-black">
                <img
                  src={imageData}
                  alt="Captured recipe"
                  className="w-full h-auto max-h-[50vh] object-contain"
                />
                <div className="absolute top-2 right-2 bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded-full border border-green-500/30">
                  Ready
                </div>
              </div>
              <p className="text-[10px] text-gray-500 text-center">
                Make sure text is clearly visible. Retake if the image is blurry or cut off.
              </p>
            </div>
          )}

          {/* Loading state — OCR in progress */}
          {mode === 'loading' && (
            <div className="py-12 text-center">
              <svg className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-gray-300 mb-1">Processing image...</p>
              <p className="text-[10px] text-gray-600 mb-3">Extracting text from your recipe photo</p>
              {/* Progress bar */}
              <div className="w-48 mx-auto bg-[#1a1a2e] rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-blue-500/60 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(ocrProgress.progress * 100)}%` }}
                />
              </div>
              <p className="text-[9px] text-gray-600 mt-1.5 capitalize">
                {ocrProgress.status || 'Initializing'}
              </p>
            </div>
          )}

          {/* Results — show matched ingredients for review */}
          {mode === 'results' && (
            <div className="space-y-3">
              {/* Recipe name input */}
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Recipe Name</label>
                <input
                  type="text"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  className="w-full bg-[#1a1a2e] border border-[#2a2a3e] rounded px-2.5 py-1.5 text-[11px] text-gray-200 focus:border-blue-500/40 focus:outline-none transition-colors"
                  placeholder="Enter recipe name..."
                />
              </div>

              {/* Matched ingredients list */}
              {matchedIngredients.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-gray-500">
                      Found {matchedIngredients.length} ingredient{matchedIngredients.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-[9px] text-gray-600">
                      {matchedIngredients.filter((m) => m.selected).length} selected
                    </span>
                  </div>
                  <div className="space-y-1 max-h-[30vh] overflow-y-auto pr-1">
                    {matchedIngredients.map((match, i) => (
                      <button
                        key={`${match.name}-${i}`}
                        onClick={() => toggleIngredient(i)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left transition-colors ${
                          match.selected
                            ? 'bg-blue-500/10 border border-blue-500/20'
                            : 'bg-[#1a1a2e] border border-[#2a2a3e] opacity-50'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                          match.selected
                            ? 'bg-blue-500/30 border-blue-500/50'
                            : 'border-[#3a3a4e]'
                        }`}>
                          {match.selected && (
                            <svg className="w-2.5 h-2.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        {/* Ingredient name */}
                        <span className="text-[11px] text-gray-200 flex-1 truncate">
                          {match.name}
                        </span>
                        {/* Confidence badge */}
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${confidenceColor(match.confidence)}`}>
                          {Math.round(match.confidence * 100)}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-[11px] text-gray-400 mb-1">No known ingredients detected</p>
                  <p className="text-[10px] text-gray-600">
                    The OCR extracted text but no ingredients matched. Try a clearer photo.
                  </p>
                </div>
              )}

              {/* Raw OCR text (collapsible) */}
              <details className="group">
                <summary className="text-[10px] text-gray-600 cursor-pointer hover:text-gray-400 transition-colors">
                  View raw extracted text
                </summary>
                <pre className="mt-1.5 text-[9px] text-gray-500 bg-[#0a0a12] rounded p-2 max-h-[15vh] overflow-y-auto whitespace-pre-wrap break-words border border-[#1e1e2e]">
                  {rawText || '(no text extracted)'}
                </pre>
              </details>
            </div>
          )}
        </div>

        {/* Hidden canvas for capturing video frames */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-3 border-t border-[#1e1e2e]">
          <button
            onClick={handleClose}
            className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5"
          >
            Cancel
          </button>
          {mode === 'preview' && (
            <>
              <button
                onClick={handleRetake}
                className="text-[11px] text-gray-400 hover:text-gray-200 border border-[#2a2a3e] rounded px-3 py-1.5 transition-colors"
              >
                Retake
              </button>
              <button
                onClick={handleProcess}
                className="text-[11px] bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded px-4 py-1.5 transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
                Process
              </button>
            </>
          )}
          {mode === 'results' && (
            <>
              <button
                onClick={handleRetake}
                className="text-[11px] text-gray-400 hover:text-gray-200 border border-[#2a2a3e] rounded px-3 py-1.5 transition-colors"
              >
                Retake
              </button>
              <button
                onClick={handleSave}
                disabled={matchedIngredients.filter((m) => m.selected).length === 0}
                className="text-[11px] bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-30 disabled:cursor-default rounded px-4 py-1.5 transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Add to Profile ({matchedIngredients.filter((m) => m.selected).length})
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default RecipeScanner;
