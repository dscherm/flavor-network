// PICTURE-4. The picture a user's shared recipe carries, made safe for the share card.
//
// The data comes from a user (sharedPictures/{id}). The Firestore rules cap its size and shape, but they cannot
// check the bytes, so everything is re-checked here before it goes near the renderer: the mime type is on the list,
// the base64 is clean and decodes, the bytes really are a JPEG, and the picture's own header says a sane size
// (a tiny file can still declare a huge image). Anything wrong -> no picture, the card is still drawn.
//
// JPEG only: resvg 2.6.2 (the PNG renderer) does not decode WebP; it skips a WebP image without any error, so a WebP
// picture would silently vanish. The app encodes chalk pictures as JPEG. A WebP document (none is written by the app,
// the rules still allow one) is refused here with a logged reason rather than drawn as nothing.

import { PICTURE_SVGS } from './pictureSvgs.generated';

export const PICTURE_MAX_CHARS = 210_000; // exclusive, the same cap as firestore.rules
export const PICTURE_MIN_SIDE = 16;
export const PICTURE_MAX_SIDE = 2000;

export interface CardPicture { src: string; w: number; h: number; kind: 'chalk' | 'icon' }
export type PictureCheck = { ok: true; picture: CardPicture } | { ok: false; reason: string };

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const ICON_ID = /^[a-z]+:[a-z0-9-]+$/;

/** Width and height from a JPEG's start-of-frame header, or null when the bytes are not a readable JPEG. */
export function jpegSize(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return null;
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    if (marker === 0xff) { i += 1; continue; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    if (marker === 0xd9 || marker === 0xda) return null; // end of image / start of scan before any frame header
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) return null;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      if (i + 9 > buf.length) return null;
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

/** A sharedPictures document (untrusted) -> a picture the card can draw, or the reason it cannot. */
export function validateChalkPicture(raw: unknown): PictureCheck {
  const no = (reason: string): PictureCheck => ({ ok: false, reason });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return no('not a picture document');
  const d = raw as Record<string, unknown>;
  if (d.mime === 'image/webp') return no('webp pictures cannot be drawn on the card');
  if (d.mime !== 'image/jpeg') return no('mime type is not on the list');
  if (typeof d.data !== 'string' || !d.data) return no('no image data');
  if (d.data.length >= PICTURE_MAX_CHARS) return no('image data is over the size cap');
  if (d.data.length % 4 !== 0 || !BASE64.test(d.data)) return no('image data is not valid base64');
  const bytes = Buffer.from(d.data, 'base64');
  if (!bytes.length) return no('image data is empty');
  const size = jpegSize(bytes);
  if (!size) return no('the bytes are not a readable JPEG');
  const ok = (n: number) => Number.isInteger(n) && n >= PICTURE_MIN_SIDE && n <= PICTURE_MAX_SIDE;
  if (!ok(size.w) || !ok(size.h)) return no('the picture declares an unreasonable size');
  return { ok: true, picture: { src: `data:image/jpeg;base64,${d.data}`, w: size.w, h: size.h, kind: 'chalk' } };
}

/** True for an id the generated drawing map has. */
export function isKnownIcon(id: unknown): id is string {
  return typeof id === 'string' && ICON_ID.test(id) && Object.prototype.hasOwnProperty.call(PICTURE_SVGS, id);
}

/** A drawing from the registry as a picture, or null for an id the registry does not have. */
export function iconPicture(id: unknown): CardPicture | null {
  if (!isKnownIcon(id)) return null;
  return { src: `data:image/svg+xml;base64,${Buffer.from(PICTURE_SVGS[id], 'utf8').toString('base64')}`, w: 256, h: 256, kind: 'icon' };
}
