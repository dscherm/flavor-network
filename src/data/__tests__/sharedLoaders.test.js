import { describe, it, expect, vi, afterEach } from 'vitest';
import { defaultLoadNodes, loadLabelNodes } from '../sharedLoaders.js';

afterEach(() => vi.unstubAllGlobals());

describe('sharedLoaders: the chart needs only the small taste-label file (FLAVOR-6)', () => {
  it('defaultLoadNodes requests taste_labels.json and nothing else, and never the model file', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ gin: 'bitter', lime: 'sour' }) }));
    vi.stubGlobal('fetch', fetchMock);
    const nodes = await defaultLoadNodes();
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(['/proDataset/taste_labels.json']);
    expect(nodes.get('gin')).toEqual({ taste: 'bitter' });
    expect(nodes.get('gin').gnnProbs).toBeUndefined();
  });
  it('defaultLoadNodes rejects when the labels cannot load (the shared page then drops the chart)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    await expect(defaultLoadNodes()).rejects.toThrow();
  });
  it('loadLabelNodes gives null on any failure and never asks for gnn_entropy.json', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('offline'); });
    vi.stubGlobal('fetch', fetchMock);
    expect(await loadLabelNodes()).toBeNull();
    expect(fetchMock.mock.calls.every((c) => !String(c[0]).includes('gnn_entropy'))).toBe(true);
  });
});
