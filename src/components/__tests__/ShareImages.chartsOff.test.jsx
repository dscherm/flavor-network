// @vitest-environment jsdom
// SHARE-8: with the committed switch (off) the share images are drawn with no chart bars and no flavor-data load.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import ShareImages from '../ShareImages.jsx';
import { barsFor } from '../../data/shareCardData.js';

const recipe = { kind: 'dish', name: 'Soup', lines: [{ key: 'carrot', amount: '1' }], method: '' };
const NODES = new Map([['carrot', { gnnProbs: { sweet: 0.9, sour: 0.1, bitter: 0.1, salty: 0.1, umami: 0.8 } }]]);
afterEach(() => cleanup());

describe('share images with charts off', () => {
  it('barsFor gives no bars even with flavor data', () => { expect(barsFor(recipe, NODES)).toEqual([]); });
  it('passes bars: [] to the renderer, including stored bars, and does not load flavor data', async () => {
    const renderFiles = vi.fn(async () => [new File([new Uint8Array([1])], 'a.png', { type: 'image/png' })]);
    const loadNodes = vi.fn(async () => NODES);
    render(<ShareImages link="/r/abcdefghjk" recipe={recipe} bars={[{ label: 'sweet', color: '#fff', score: 0.5 }]} renderFiles={renderFiles} loadNodes={loadNodes} origin="https://x.app" />);
    await waitFor(() => expect(renderFiles).toHaveBeenCalled());
    expect(renderFiles.mock.calls[0][0].bars).toEqual([]);
    expect(loadNodes).not.toHaveBeenCalled();
  });
});
