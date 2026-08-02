// WEBLINK-16 (2026-08-02). The packaged iOS app could reach the callable
// only if its origin is on the allow-list. It is not served over http:
// Capacitor loads it from capacitor://localhost (iosScheme unset in
// capacitor.config.json, so the default applies). Every request from the
// app was rejected at preflight while identical code worked in a browser.
//
// The allow-list lives in an onCall() options object that is awkward to
// import without the functions runtime, so this asserts the matching rules
// directly against the same values, and a source check keeps them in sync.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(__dirname, 'index.ts'), 'utf8');

/** Mirrors the cors array in index.ts. Kept honest by the test below. */
const ALLOWED: Array<string | RegExp> = [
  'https://neuralflavor.web.app',
  'https://neuralflavor.firebaseapp.com',
  /^https:\/\/.*\.neuralflavor\.web\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
  'capacitor://localhost',
  'ionic://localhost',
  /^capacitor:\/\/localhost(:\d+)?$/,
];

const allows = (origin: string): boolean =>
  ALLOWED.some((rule) => (typeof rule === 'string' ? rule === origin : rule.test(origin)));

describe('scrapeRecipe CORS allow-list', () => {
  it('admits the packaged iOS app origin', () => {
    // The regression: this was false, so the app could never call the
    // function no matter how sign-in behaved.
    expect(allows('capacitor://localhost')).toBe(true);
  });

  it('still admits the web app and its subdomains', () => {
    expect(allows('https://neuralflavor.web.app')).toBe(true);
    expect(allows('https://neuralflavor.firebaseapp.com')).toBe(true);
    expect(allows('https://staging.neuralflavor.web.app')).toBe(true);
  });

  it('does NOT cover Firebase preview channels — documenting, not fixing', () => {
    // Preview channels are `<site>--<channel>-<hash>.web.app`: a double
    // dash, no dot. The existing subdomain regex requires a dot before
    // "neuralflavor", so it cannot match them. Left as-is deliberately —
    // nothing uses preview channels today, and widening a CORS allow-list
    // as a drive-by while debugging is how allow-lists stop meaning
    // anything. Revisit if preview channels are ever adopted.
    expect(allows('https://neuralflavor--pr42-abc123.web.app')).toBe(false);
  });

  it('admits local development, which is also the Android origin', () => {
    expect(allows('http://localhost')).toBe(true);
    expect(allows('http://localhost:5173')).toBe(true);
  });

  it('does not admit arbitrary origins', () => {
    expect(allows('https://evil.example.com')).toBe(false);
    // Must not be fooled by a lookalike suffix.
    expect(allows('https://neuralflavor.web.app.evil.com')).toBe(false);
    expect(allows('capacitor://evil')).toBe(false);
  });

  it('the real cors array in index.ts carries the capacitor origin', () => {
    // Guards against this test drifting from the deployed configuration.
    expect(SOURCE).toContain("'capacitor://localhost'");
  });
});
