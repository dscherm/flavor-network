import { useState, useRef } from 'react';

/**
 * RecipeImport — collapsible card on the Profile › Recipes tab.
 * Lets the user upload a recipe photo or PDF; the API server calls
 * Gemini 2.5 Flash to extract a structured recipe; the user reviews
 * + edits the parsed result; on Save we hand off to onSave(title,
 * ingredients) which writes to userProfile.
 *
 * Three internal phases:
 *   'idle'       → file picker
 *   'extracting' → spinner
 *   'review'     → editable form
 *   'error'      → error message + try again
 */

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = 'image/*,application/pdf,.pdf';

export default function RecipeImport({ onSave }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState('idle'); // 'idle' | 'extracting' | 'review' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [draft, setDraft] = useState(null);
  const fileInputRef = useRef(null);

  const reset = () => {
    setPhase('idle');
    setDraft(null);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setErrorMsg(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 20 MB.`);
      setPhase('error');
      return;
    }
    setPhase('extracting');
    setErrorMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/recipe/import', { method: 'POST', body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorMsg(json?.error || `Import failed (HTTP ${res.status})`);
        setPhase('error');
        return;
      }
      // Normalize ingredients/instructions arrays for editing safety.
      const normalized = {
        title: json.title || 'Untitled Recipe',
        yield: json.yield || '',
        author: json.author || '',
        time: json.time || {},
        ingredients: Array.isArray(json.ingredients) ? json.ingredients : [],
        instructions: Array.isArray(json.instructions) ? json.instructions : [],
        partial: !!json.partial,
        partialReason: json.partialReason || '',
      };
      setDraft(normalized);
      setPhase('review');
    } catch (err) {
      setErrorMsg(err.message || 'Network error');
      setPhase('error');
    }
  };

  const handleSave = () => {
    if (!draft) return;
    const title = draft.title.trim() || 'Untitled Recipe';
    // Build the ingredients array in the shape addRecipe expects:
    // each entry is { name, quantity?, unit? } or just a string name.
    const ingredients = draft.ingredients
      .filter((i) => i.name && i.name.trim())
      .map((i) => {
        const out = { name: i.name.trim() };
        if (i.quantity != null && i.quantity !== '') out.quantity = Number(i.quantity);
        if (i.unit) out.unit = i.unit.trim();
        return out;
      });
    if (ingredients.length === 0) {
      setErrorMsg('Add at least one ingredient before saving.');
      return;
    }
    onSave?.(title, ingredients);
    reset();
    setOpen(false);
  };

  const updateIngredient = (idx, patch) => {
    setDraft((d) => {
      const next = { ...d, ingredients: d.ingredients.slice() };
      next.ingredients[idx] = { ...next.ingredients[idx], ...patch };
      return next;
    });
  };
  const removeIngredient = (idx) => {
    setDraft((d) => ({ ...d, ingredients: d.ingredients.filter((_, i) => i !== idx) }));
  };
  const addIngredient = () => {
    setDraft((d) => ({ ...d, ingredients: [...d.ingredients, { name: '' }] }));
  };

  const updateInstruction = (idx, value) => {
    setDraft((d) => {
      const next = { ...d, instructions: d.instructions.slice() };
      next.instructions[idx] = value;
      return next;
    });
  };
  const removeInstruction = (idx) => {
    setDraft((d) => ({ ...d, instructions: d.instructions.filter((_, i) => i !== idx) }));
  };
  const addInstruction = () => {
    setDraft((d) => ({ ...d, instructions: [...d.instructions, ''] }));
  };

  // The importer POSTs to /api/recipe/import, which only exists as the
  // Vite dev proxy to the local Express API (npm run api + GEMINI_API_KEY).
  // On the deployed site the hosting rewrite answers that POST with
  // index.html (200), so the upload used to fail with a null-JSON error.
  // Hide it outside dev rather than offer a dead end (v1.0.0 closeout).
  if (!import.meta.env.DEV) {
    return (
      <p className="mb-3 text-[11px] text-gray-500">
        PDF / photo import runs locally with the API server
        (<code>npm run api</code>); it isn't available on the web build.
      </p>
    );
  }

  // Collapsed: just the toggle button
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full mb-3 flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-dashed border-blue-500/40 text-blue-300 hover:bg-blue-500/10 hover:border-blue-400/60 transition-colors text-xs"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Import recipe (PDF or photo)
      </button>
    );
  }

  return (
    <div className="mb-3 p-3 rounded-md border border-blue-500/30 bg-blue-500/5">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-medium text-blue-200">Import recipe</h4>
        <button
          type="button"
          onClick={() => { reset(); setOpen(false); }}
          className="text-gray-500 hover:text-gray-300 text-xs"
          aria-label="Close import panel"
        >
          ×
        </button>
      </div>

      {phase === 'idle' && (
        <div>
          <label className="block">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              onChange={handleFileChange}
              className="text-[10px] text-gray-400 file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-blue-500/20 file:text-blue-200 file:text-[10px] file:hover:bg-blue-500/30 file:cursor-pointer"
            />
          </label>
          <p className="mt-1.5 text-[10px] text-gray-500 leading-snug">
            Photo (jpg/png/heic) or PDF up to 20 MB · 5 pages max for PDFs.
          </p>
        </div>
      )}

      {phase === 'extracting' && (
        <div className="flex items-center gap-2 py-2">
          <div className="w-3 h-3 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
          <span className="text-[11px] text-blue-200">Reading the recipe…</span>
        </div>
      )}

      {phase === 'error' && (
        <div className="space-y-2">
          <p className="text-[11px] text-red-300">{errorMsg}</p>
          <button
            type="button"
            onClick={reset}
            className="text-[10px] text-blue-300 hover:text-blue-100 underline underline-offset-2"
          >
            Try another file
          </button>
        </div>
      )}

      {phase === 'review' && draft && (
        <div className="space-y-2.5">
          {draft.partial && (
            <div className="text-[10px] text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
              {draft.partialReason || 'Partial draft — please review carefully.'}
            </div>
          )}

          <div>
            <label className="text-[10px] text-gray-500 block mb-0.5">Title</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              className="w-full px-2 py-1 text-[12px] bg-[#12121a] border border-[#2a2a3a] rounded text-gray-200 focus:border-cyan-400/60 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="text-[10px] text-gray-500">Ingredients ({draft.ingredients.length})</label>
              <button type="button" onClick={addIngredient} className="text-[10px] text-blue-300 hover:text-blue-100">+ Add</button>
            </div>
            <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {draft.ingredients.map((ing, idx) => (
                <li key={idx} className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="qty"
                    value={ing.quantity ?? ''}
                    onChange={(e) => updateIngredient(idx, { quantity: e.target.value })}
                    className="w-12 px-1.5 py-0.5 text-[11px] bg-[#12121a] border border-[#2a2a3a] rounded text-gray-200"
                  />
                  <input
                    type="text"
                    placeholder="unit"
                    value={ing.unit ?? ''}
                    onChange={(e) => updateIngredient(idx, { unit: e.target.value })}
                    className="w-14 px-1.5 py-0.5 text-[11px] bg-[#12121a] border border-[#2a2a3a] rounded text-gray-200"
                  />
                  <input
                    type="text"
                    placeholder="ingredient"
                    value={ing.name ?? ''}
                    onChange={(e) => updateIngredient(idx, { name: e.target.value })}
                    className="flex-1 px-1.5 py-0.5 text-[11px] bg-[#12121a] border border-[#2a2a3a] rounded text-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeIngredient(idx)}
                    className="text-gray-600 hover:text-red-400 text-xs px-1"
                    aria-label={`Remove ingredient ${ing.name || idx + 1}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="text-[10px] text-gray-500">Instructions ({draft.instructions.length})</label>
              <button type="button" onClick={addInstruction} className="text-[10px] text-blue-300 hover:text-blue-100">+ Add step</button>
            </div>
            <ol className="space-y-1 max-h-40 overflow-y-auto pr-1 list-decimal list-inside">
              {draft.instructions.map((step, idx) => (
                <li key={idx} className="flex items-start gap-1">
                  <textarea
                    rows={1}
                    value={step}
                    onChange={(e) => updateInstruction(idx, e.target.value)}
                    className="flex-1 px-1.5 py-0.5 text-[11px] bg-[#12121a] border border-[#2a2a3a] rounded text-gray-200 resize-y"
                  />
                  <button
                    type="button"
                    onClick={() => removeInstruction(idx)}
                    className="text-gray-600 hover:text-red-400 text-xs px-1"
                    aria-label={`Remove step ${idx + 1}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
          </div>

          {errorMsg && <p className="text-[11px] text-red-300">{errorMsg}</p>}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={reset}
              className="text-[10px] text-gray-500 hover:text-gray-300"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1 text-[11px] font-medium rounded-md bg-blue-500/30 hover:bg-blue-500/50 border border-blue-400/40 text-blue-100"
            >
              Save to profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
