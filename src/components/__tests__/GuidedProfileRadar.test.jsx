/**
 * GuidedProfileRadar.test.jsx — Track 3 / P2 component specs.
 *
 * Locks:
 *   - Axis counts per filterType (4 specs)
 *   - chosenValue=null → no wedge filled
 *   - Tap axis → onAxisTap fires
 *   - G1 measurable: wedge fillOpacity === '0.55'
 *   - Matching pairings opacity 1.0, label visible
 *   - Non-matching pairings opacity 0.35, no label
 *   - G4 mode-transition: null → 'sweet' → null restores all to 1.0
 *   - Pairings with no signal don't render
 *   - Focal hub at center
 *   - Axis label <button> aria-label format
 *   - aria-live="polite" announcement
 *   - onDropCount fires with count of dropped pairings
 *   - Filled wedge color matches getColorMapFor(filterType)[chosenValue]
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import GuidedProfileRadar from '../GuidedProfileRadar.jsx';
import { getColorMapFor } from '../../data/guidedRadarAxes.js';

afterEach(() => cleanup());

const focal = { name: 'apple', taste: 'sweet,sour', cuisines: ['European'] };

// 30 mock pairings covering several taste tokens, so we can split
// matching vs. non-matching cleanly when chosenValue='sweet'.
function makeTastePairings() {
  const all = [];
  const tokens = ['sweet', 'sour', 'bitter', 'salty', 'umami', 'pungent'];
  for (let i = 0; i < 30; i++) {
    const tok = tokens[i % tokens.length];
    all.push({ name: `p-${tok}-${i}`, taste: tok });
  }
  return all;
}

function makeAromaPairings() {
  // 10 with gnnProbs (varying odor_fruity), 5 without — the 5 without
  // are dropped via onDropCount.
  const all = [];
  for (let i = 0; i < 10; i++) {
    all.push({
      name: `aroma-${i}`,
      gnnProbs: { odor_fruity: 0.4 + i * 0.06 }, // half above 0.5, half below
    });
  }
  for (let i = 0; i < 5; i++) {
    all.push({ name: `no-gnn-${i}`, taste: 'irrelevant' });
  }
  return all;
}

describe('GuidedProfileRadar — P2 component', () => {
  // ----- axis counts (4 specs) -------------------------------------

  it("renders 8 axis labels when filterType='taste'", () => {
    const { container } = render(
      <GuidedProfileRadar focal={focal} pairings={[]} filterType="taste" />,
    );
    const axisButtons = container.querySelectorAll('[data-testid^="guided-radar-axis-"]');
    expect(axisButtons.length).toBe(8);
  });

  it("renders 6 axis labels when filterType='aroma'", () => {
    const { container } = render(
      <GuidedProfileRadar focal={focal} pairings={[]} filterType="aroma" />,
    );
    const axisButtons = container.querySelectorAll('[data-testid^="guided-radar-axis-"]');
    expect(axisButtons.length).toBe(6);
  });

  it("renders 4 axis labels when filterType='season'", () => {
    const { container } = render(
      <GuidedProfileRadar focal={focal} pairings={[]} filterType="season" />,
    );
    const axisButtons = container.querySelectorAll('[data-testid^="guided-radar-axis-"]');
    expect(axisButtons.length).toBe(4);
  });

  it("renders 8 axis labels when filterType='cuisine'", () => {
    const { container } = render(
      <GuidedProfileRadar focal={focal} pairings={[]} filterType="cuisine" />,
    );
    const axisButtons = container.querySelectorAll('[data-testid^="guided-radar-axis-"]');
    expect(axisButtons.length).toBe(8);
  });

  // ----- wedge fill behavior ---------------------------------------

  it('no filled wedge when chosenValue === null', () => {
    const { container } = render(
      <GuidedProfileRadar focal={focal} pairings={[]} filterType="taste" chosenValue={null} />,
    );
    const wedge = container.querySelector('[data-testid="guided-radar-wedge-fill"]');
    expect(wedge).toBeNull();
  });

  it('G1 measurable: wedge fillOpacity attribute === "0.55" when wedge is filled', () => {
    const { container } = render(
      <GuidedProfileRadar
        focal={focal}
        pairings={[]}
        filterType="taste"
        chosenValue="sweet"
      />,
    );
    const wedge = container.querySelector('[data-testid="guided-radar-wedge-fill"]');
    expect(wedge).not.toBeNull();
    expect(wedge.getAttribute('fill-opacity')).toBe('0.55');
  });

  it('filled wedge color matches getColorMapFor(filterType)[chosenValue]', () => {
    const { container } = render(
      <GuidedProfileRadar
        focal={focal}
        pairings={[]}
        filterType="taste"
        chosenValue="sweet"
      />,
    );
    const wedge = container.querySelector('[data-testid="guided-radar-wedge-fill"]');
    const expected = getColorMapFor('taste')['sweet'];
    // SVG attribute comparison (hex string)
    expect(wedge.getAttribute('fill')).toBe(expected);
  });

  // ----- axis tap → onAxisTap fires --------------------------------

  it('tap axis label → onAxisTap("sweet") fires exactly once', () => {
    const spy = vi.fn();
    const { container } = render(
      <GuidedProfileRadar
        focal={focal}
        pairings={[]}
        filterType="taste"
        onAxisTap={spy}
      />,
    );
    const btn = container.querySelector('[data-testid="guided-radar-axis-sweet"]');
    expect(btn).not.toBeNull();
    fireEvent.click(btn);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('sweet');
  });

  // ----- matching / non-matching opacity ---------------------------

  it('matching pairings render at opacity 1.0 + stroke 2.0 + label visible', () => {
    const { container } = render(
      <GuidedProfileRadar
        focal={focal}
        pairings={makeTastePairings()}
        filterType="taste"
        chosenValue="sweet"
      />,
    );
    const matches = container.querySelectorAll('[data-pairing-match="true"]');
    expect(matches.length).toBeGreaterThan(0);
    for (const g of matches) {
      expect(g.getAttribute('data-pairing-opacity')).toBe('1');
      const circle = g.querySelector('circle');
      expect(circle.getAttribute('stroke-width')).toBe('2');
      const label = g.querySelector('[data-testid="guided-radar-pairing-label"]');
      expect(label).not.toBeNull();
    }
  });

  it('non-matching pairings render at opacity 0.35 + no label', () => {
    const { container } = render(
      <GuidedProfileRadar
        focal={focal}
        pairings={makeTastePairings()}
        filterType="taste"
        chosenValue="sweet"
      />,
    );
    const nonMatches = container.querySelectorAll('[data-pairing-match="false"]');
    expect(nonMatches.length).toBeGreaterThan(0);
    for (const g of nonMatches) {
      expect(g.getAttribute('data-pairing-opacity')).toBe('0.35');
      const label = g.querySelector('[data-testid="guided-radar-pairing-label"]');
      expect(label).toBeNull();
    }
  });

  // ----- G4 mode-transition spec -----------------------------------

  it('restores all-pairings-at-1.0 on chosenValue=null after a value was set', () => {
    const pairings = makeTastePairings();
    // 1) chosenValue=null → all opacity 1.0
    const { container, rerender } = render(
      <GuidedProfileRadar
        focal={focal}
        pairings={pairings}
        filterType="taste"
        chosenValue={null}
      />,
    );
    let dots = container.querySelectorAll('[data-testid="guided-radar-pairing"]');
    expect(dots.length).toBe(pairings.length);
    for (const g of dots) {
      expect(g.getAttribute('data-pairing-opacity')).toBe('1');
    }

    // 2) chosenValue='sweet' → matching=1.0, non-matching=0.35
    rerender(
      <GuidedProfileRadar
        focal={focal}
        pairings={pairings}
        filterType="taste"
        chosenValue="sweet"
      />,
    );
    dots = container.querySelectorAll('[data-testid="guided-radar-pairing"]');
    const matches = container.querySelectorAll('[data-pairing-match="true"]');
    const nonMatches = container.querySelectorAll('[data-pairing-match="false"]');
    expect(matches.length).toBeGreaterThan(0);
    expect(nonMatches.length).toBeGreaterThan(0);
    for (const g of matches) expect(g.getAttribute('data-pairing-opacity')).toBe('1');
    for (const g of nonMatches) expect(g.getAttribute('data-pairing-opacity')).toBe('0.35');

    // 3) chosenValue=null again → all opacity 1.0 restored
    rerender(
      <GuidedProfileRadar
        focal={focal}
        pairings={pairings}
        filterType="taste"
        chosenValue={null}
      />,
    );
    dots = container.querySelectorAll('[data-testid="guided-radar-pairing"]');
    expect(dots.length).toBe(pairings.length);
    for (const g of dots) {
      expect(g.getAttribute('data-pairing-opacity')).toBe('1');
    }
  });

  // ----- pairings with no signal don't render ----------------------

  it('pairings with no signal (missing gnnProbs for aroma) do not render as dots', () => {
    const pairings = makeAromaPairings();
    const { container } = render(
      <GuidedProfileRadar
        focal={focal}
        pairings={pairings}
        filterType="aroma"
        chosenValue={null}
      />,
    );
    const dots = container.querySelectorAll('[data-testid="guided-radar-pairing"]');
    // Of the 10 aroma pairings, only those with at least one
    // odor probability >= 0.5 are plotted. The other 5 (no gnnProbs)
    // are dropped.
    const plotted = pairings.filter(
      (p) => p.gnnProbs && Object.entries(p.gnnProbs).some(
        ([k, v]) => k.startsWith('odor_') && v >= 0.5,
      ),
    );
    expect(dots.length).toBe(plotted.length);
    // Plotted count must be strictly less than total pairings.
    expect(dots.length).toBeLessThan(pairings.length);
  });

  // ----- focal hub ------------------------------------------------

  it('focal hub renders at center coords', () => {
    const size = 280;
    const { container } = render(
      <GuidedProfileRadar
        focal={focal}
        pairings={[]}
        filterType="taste"
        size={size}
      />,
    );
    const hub = container.querySelector('[data-testid="guided-radar-focal-hub"]');
    expect(hub).not.toBeNull();
    expect(Number(hub.getAttribute('cx'))).toBe(size / 2);
    expect(Number(hub.getAttribute('cy'))).toBe(size / 2);
  });

  // ----- a11y -----------------------------------------------------

  it('axis label <button> has aria-label="Highlight pairings tagged sweet"', () => {
    const { container } = render(
      <GuidedProfileRadar focal={focal} pairings={[]} filterType="taste" />,
    );
    const btn = container.querySelector('[data-testid="guided-radar-axis-sweet"]');
    expect(btn).not.toBeNull();
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('aria-label')).toBe('Highlight pairings tagged sweet');
  });

  it('aria-live="polite" element announces current selection', () => {
    const { container, rerender } = render(
      <GuidedProfileRadar
        focal={focal}
        pairings={[]}
        filterType="taste"
        chosenValue={null}
      />,
    );
    const live = container.querySelector('[data-testid="guided-radar-announce"]');
    expect(live).not.toBeNull();
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.textContent).toMatch(/all pairings/i);

    rerender(
      <GuidedProfileRadar
        focal={focal}
        pairings={[]}
        filterType="taste"
        chosenValue="sweet"
      />,
    );
    const live2 = container.querySelector('[data-testid="guided-radar-announce"]');
    expect(live2.textContent).toMatch(/sweet/i);
  });

  // ----- onDropCount callback --------------------------------------

  it('onDropCount fires with count of pairings dropped due to missing data', () => {
    const onDrop = vi.fn();
    const pairings = makeAromaPairings(); // 5 of 15 are dropped (no gnnProbs)
    render(
      <GuidedProfileRadar
        focal={focal}
        pairings={pairings}
        filterType="aroma"
        chosenValue={null}
        onDropCount={onDrop}
      />,
    );
    expect(onDrop).toHaveBeenCalled();
    // The exact drop count: 5 pairings have no gnnProbs at all (auto-drop)
    // PLUS any aroma pairings whose all-channel max is below threshold 0.5.
    // Confirm at minimum the 5 no-gnnProbs ones drop.
    const lastCall = onDrop.mock.calls[onDrop.mock.calls.length - 1][0];
    expect(lastCall).toBeGreaterThanOrEqual(5);
  });
});
