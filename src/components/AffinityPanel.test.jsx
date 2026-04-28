// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import AffinityPanel from './AffinityPanel.jsx';

const SAMPLE = [
  { name: 'tomato',   tier: 3, ringIdx: 3, strength: 0.95, bridge: 'limonene' },
  { name: 'olive oil',tier: 2, ringIdx: 3, strength: 0.92, bridge: null },
  { name: 'parmesan', tier: 2, ringIdx: 2, strength: 0.88, bridge: null },
  { name: 'oregano',  tier: 1, ringIdx: 2, strength: 0.81, bridge: null },
  { name: 'pasta',    tier: 1, ringIdx: 1, strength: 0.62, bridge: null },
];

afterEach(cleanup);

describe('AffinityPanel — embedded mode', () => {
  it('renders three columns labelled ★★★ / ★★ / ★', () => {
    const { getByText } = render(
      <AffinityPanel focal="basil" affinities={SAMPLE} />
    );
    expect(getByText('★★★')).toBeTruthy();
    expect(getByText('★★')).toBeTruthy();
    expect(getByText('★')).toBeTruthy();
  });

  it('places each affinity in the column that matches its ringIdx', () => {
    const { getByText, getByTitle } = render(
      <AffinityPanel focal="basil" affinities={SAMPLE} />
    );
    // Tomato is ringIdx=3 → ★★★ column. Pasta is ringIdx=1 → ★ column.
    expect(getByTitle(/^tomato — strength/)).toBeTruthy();
    expect(getByTitle(/^pasta — strength/)).toBeTruthy();
    expect(getByText(/basil/)).toBeTruthy(); // focal name in header (prefixed with —)
  });

  it('clicking a chip fires onPivot with the chip name', () => {
    const onPivot = vi.fn();
    const { getByText } = render(
      <AffinityPanel focal="basil" affinities={SAMPLE} onPivot={onPivot} />
    );
    fireEvent.click(getByText('tomato'));
    expect(onPivot).toHaveBeenCalledWith('tomato');
  });

  it('renders nothing when affinities is empty', () => {
    const { container } = render(
      <AffinityPanel focal="basil" affinities={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('does NOT render an X button without onClose', () => {
    const { queryByLabelText } = render(
      <AffinityPanel focal="basil" affinities={SAMPLE} />
    );
    expect(queryByLabelText('Close')).toBeNull();
  });
});

describe('AffinityPanel — overlay mode (onClose provided)', () => {
  let onClose;

  beforeEach(() => { onClose = vi.fn(); });

  it('renders the X close button', () => {
    const { getByLabelText } = render(
      <AffinityPanel focal="basil" affinities={SAMPLE} onClose={onClose} />
    );
    expect(getByLabelText('Close')).toBeTruthy();
  });

  it('clicking X fires onClose', () => {
    const { getByLabelText } = render(
      <AffinityPanel focal="basil" affinities={SAMPLE} onClose={onClose} />
    );
    fireEvent.click(getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ESC key dismisses', () => {
    render(
      <AffinityPanel focal="basil" affinities={SAMPLE} onClose={onClose} />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('capture-phase pointerdown OUTSIDE the panel dismisses', () => {
    const { container } = render(
      <div>
        <button data-testid="outside">outside</button>
        <AffinityPanel focal="basil" affinities={SAMPLE} onClose={onClose} />
      </div>
    );
    const outside = container.querySelector('[data-testid="outside"]');
    fireEvent.pointerDown(outside);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pointerdown INSIDE the panel does NOT dismiss', () => {
    const { getByText } = render(
      <AffinityPanel focal="basil" affinities={SAMPLE} onClose={onClose} />
    );
    fireEvent.pointerDown(getByText('tomato'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
