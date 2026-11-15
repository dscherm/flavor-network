import { describe, expect, it, vi } from 'vitest';

vi.mock('./cardLayout.generated', async (orig) => ({ ...(await orig<typeof import('./cardLayout.generated')>()), SHARE_CHARTS_ENABLED: false }));

import { layoutFor, type CardData } from './card';
import realCards from './share-cards.json';

const cards = realCards as unknown as Record<string, CardData>;

describe('the SHARE_CHARTS_ENABLED switch can still hide the chart (FLAVOR-6)', () => {
  it('with the switch off a card is drawn with no chart even when the data has bars', () => {
    expect(cards['cocktail/negroni'].bars.length).toBeGreaterThan(0);
    const text = layoutFor(cards['cocktail/negroni'], 'x').primitives.filter((p: any) => p.type === 'text').map((p: any) => p.text).join(' ');
    expect(text).toContain('Negroni');
    expect(text).not.toContain('flavor chart');
  });
});
