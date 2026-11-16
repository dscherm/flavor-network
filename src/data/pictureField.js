/**
 * pictureField.js — the pure shape of a recipe's `picture` (PICTURE-3). No React, no Firebase.
 * Saved item:   { kind: 'icon', icon, v } | { kind: 'chalk', v }   (the image itself lives in its own document)
 * Shared doc:   { kind: 'icon', icon } | { kind: 'chalk' }
 */
const ICON_CHARS = 40;
const ICON_PATTERN = /^[a-z]+:[a-z0-9-]+$/;

/** A drawing id as stored: a short word, a colon, a short slug ("glass:coupe"). */
export const isIconId = (v) => typeof v === 'string' && v.length <= ICON_CHARS && ICON_PATTERN.test(v);

/**
 * The `picture` field of a saved item, cleaned: { kind:'icon', icon, v } | { kind:'chalk', v } | null for anything else.
 * `v` must be a finite number (a missing one becomes 0 so an older item still validates).
 */
export function cleanPictureField(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const v = typeof p.v === 'number' && Number.isFinite(p.v) ? p.v : 0;
  if (p.kind === 'chalk') return { kind: 'chalk', v };
  if (p.kind === 'icon' && isIconId(p.icon)) return { kind: 'icon', icon: p.icon, v };
  return null;
}

/** The `picture` key of a shared document: no image data and no `v`. */
export function sharedPictureField(p) {
  const c = cleanPictureField(p);
  if (!c) return null;
  return c.kind === 'chalk' ? { kind: 'chalk' } : { kind: 'icon', icon: c.icon };
}

/**
 * Chooser value -> the item's `picture` field.
 *   undefined          the cook did not touch the picture: `prev` is kept as it is
 *   null               "No picture"
 *   { kind:'icon' }   a drawing
 *   { kind:'chalk' }  a chalk picture (its document is written separately)
 */
export function fieldFromValue(value, prev, now = Date.now()) {
  if (value === undefined) return cleanPictureField(prev);
  if (value === null) return null;
  if (value.kind === 'icon') return isIconId(value.icon) ? { kind: 'icon', icon: value.icon, v: now } : null;
  if (value.kind === 'chalk') return { kind: 'chalk', v: now };
  return null;
}

