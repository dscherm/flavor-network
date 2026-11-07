import { describe, it, expect } from 'vitest';
import { readImportParam, stripImportParam } from '../importParam.js';

describe('readImportParam (WEBLINK-17)', () => {
  it('returns an encoded http(s) link', () => {
    const link = 'https://apple.news/KZrKwE9isOtqUF7Y9dIy3GQ?article_id=x';
    expect(readImportParam(`?import=${encodeURIComponent(link)}`)).toBe(link);
    expect(readImportParam('?path=make&import=http%3A%2F%2Fexample.com%2Fr')).toBe('http://example.com/r');
  });

  it.each([
    ['javascript:alert(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['file:///etc/passwd'],
    ['ftp://example.com/x'],
    ['not a url'],
    ['https://user:pw@example.com/x'],
    [''],
    [`https://example.com/${'a'.repeat(3000)}`],
  ])('ignores %s', (bad) => {
    expect(readImportParam(`?import=${encodeURIComponent(bad)}`)).toBeNull();
  });

  it('returns null with no param', () => {
    expect(readImportParam('')).toBeNull();
    expect(readImportParam('?path=make')).toBeNull();
  });
});

describe('stripImportParam', () => {
  it('drops import and keeps everything else', () => {
    expect(stripImportParam('https://neuralflavor.web.app/?path=make&import=x#h')).toBe('/?path=make#h');
    expect(stripImportParam('https://neuralflavor.web.app/?import=x')).toBe('/');
  });

  it('returns null when there is nothing to strip', () => {
    expect(stripImportParam('https://neuralflavor.web.app/?path=make')).toBeNull();
  });
});
