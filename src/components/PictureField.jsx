/**
 * PictureField — "Add a picture (optional)" for the name-and-save step of an invent panel, and for editing a saved item
 * (PICTURE-4). A closed one-line row until the cook opens it, so a recipe without a picture looks as it always did.
 *
 * Props
 *   kind      'dish' | 'cocktail' | 'sauce'   which drawings to offer
 *   value     undefined = untouched (an item being edited keeps the picture it has) | null = no picture | a chooser value
 *             ({ kind:'icon', icon } | { kind:'chalk', blob, mime, w, h })
 *   onChange  (value)   called with the chooser's value or null, never with undefined
 *   item      the saved item being edited ({ id, picture }), or null; seeds the chooser and the thumbnail
 *   color     tint for the drawings
 *   initialPhoto  a File (a photo handed over with the recipe): the chooser opens on "A photo as chalk" with it drawn at the default look
 *   filter    forwarded to RecipePicture (tests)
 *   load      forwarded to PictureView / the stored-picture read (tests)
 * Test ids: picture-field, picture-field-open, picture-field-done, picture-field-thumb (and RecipePicture's own).
 */
import { useEffect, useState } from 'react';
import RecipePicture from './RecipePicture.jsx';
import PictureView, { blobFromStored, usePictureData } from './PictureView.jsx';
import { CHALK_CREAM, CHALK_DIM, ACCENT, btn } from './inventUi.jsx';

import { TEXT } from '../data/chalkTheme.js';
const tap = { minHeight: 44 };

export default function PictureField({ kind = 'dish', value, onChange, item = null, color, filter, load, testid = 'picture-field', initialPhoto = null }) {
  const [open, setOpen] = useState(false);
  const stored = item?.picture || null;
  const itemId = item?.id || '';
  // Editing: the picture the item already has seeds the chooser (a chalk one is read once, when the chooser opens).
  const storedData = usePictureData({ picture: open && value === undefined ? stored : null, itemId, load });
  const [seedBlob, setSeedBlob] = useState(null);
  const storedDataUrl = storedData.status === 'ready' ? storedData.src : '';
  useEffect(() => {
    if (!storedDataUrl) { setSeedBlob(null); return; }
    try {
      const m = /^data:([^;]+);base64,(.*)$/.exec(storedDataUrl);
      setSeedBlob(m ? blobFromStored({ mime: m[1], data: m[2] }) : null);
    } catch { setSeedBlob(null); }
  }, [storedDataUrl]);

  let seed = null;
  if (value !== undefined) seed = value;
  else if (stored?.kind === 'icon') seed = { kind: 'icon', icon: stored.icon };
  else if (stored?.kind === 'chalk' && seedBlob) seed = { kind: 'chalk', blob: seedBlob, mime: seedBlob.type, w: storedData.w || 600, h: storedData.h || 600 };

  const showing = value !== undefined ? value : (stored ? { kind: stored.kind, ...(stored.kind === 'icon' ? { icon: stored.icon } : {}) } : null);
  const thumb = showing ? (
    <span data-testid={`${testid}-thumb`} className="flex-shrink-0">
      {showing.kind === 'chalk' && value === undefined
        ? <PictureView picture={stored} itemId={itemId} size={48} load={load} />
        : <PictureView value={showing} size={48} color={color} />}
    </span>
  ) : null;

  return (
    <div data-testid={testid} className="min-w-0">
      {!open ? (
        <div className="flex items-center gap-3">
          {thumb}
          <button type="button" onClick={() => setOpen(true)} data-testid={`${testid}-open`}
            className="px-3 rounded-lg" style={{ ...btn({ fontSize: 17, background: 'rgba(255,255,255,0.05)' }), ...tap }}>
            {showing ? 'Change the picture' : 'Add a picture (optional)'}
          </button>
        </div>
      ) : (
        <div>
          <p className="text-[14px] mb-2" style={{ fontFamily: TEXT, color: CHALK_DIM }}>
            A picture for this recipe. A photo is turned into a chalk drawing on this device; the photo itself is never kept or sent.
          </p>
          <RecipePicture key={seed?.kind === 'chalk' ? 'chalk' : 'other'} kind={kind} value={seed} color={color} filter={filter} initialPhoto={initialPhoto} onChange={(v) => onChange(v === undefined ? null : v)} />
          <button type="button" onClick={() => setOpen(false)} data-testid={`${testid}-done`}
            className="mt-3 w-full rounded-lg px-4" style={{ ...btn({ background: `${ACCENT}22`, color: CHALK_CREAM }), ...tap }}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}
