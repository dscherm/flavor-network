import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SuggestionDrawerToggle from '../SuggestionDrawerToggle.jsx';

function setup({ mode = 'ADD', effectiveBowlSize = 0, onChange } = {}) {
  const handler = onChange || vi.fn();
  const utils = render(
    <SuggestionDrawerToggle
      mode={mode}
      onChange={handler}
      effectiveBowlSize={effectiveBowlSize}
      panelId="suggestion-panel"
    />
  );
  return { ...utils, handler };
}

describe('SuggestionDrawerToggle (AC-1, AC-2, AC-3a, AC-4, AC-5, AC-20, AC-21)', () => {
  it('AC-1: renders a tablist with exactly 2 tab children', () => {
    setup();
    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveTextContent('ADD');
    expect(tabs[1]).toHaveTextContent('REPLACE');
  });

  it('AC-2: tablist exposes data-mode equal to active mode', () => {
    const { rerender } = setup({ mode: 'ADD' });
    expect(screen.getByRole('tablist')).toHaveAttribute('data-mode', 'ADD');
    rerender(
      <SuggestionDrawerToggle
        mode="REPLACE"
        onChange={() => {}}
        effectiveBowlSize={1}
        panelId="suggestion-panel"
      />
    );
    expect(screen.getByRole('tablist')).toHaveAttribute('data-mode', 'REPLACE');
  });

  it('AC-3a: each tab carries the min-h-[44px] Tailwind touch-target class', () => {
    setup();
    const [add, replace] = screen.getAllByRole('tab');
    expect(add.className).toMatch(/min-h-\[44px\]/);
    expect(replace.className).toMatch(/min-h-\[44px\]/);
  });

  it('AC-4: ArrowRight on focused ADD moves selection AND focus to REPLACE (when bowl≥1)', () => {
    const handler = vi.fn();
    setup({ mode: 'ADD', effectiveBowlSize: 1, onChange: handler });
    const addTab = screen.getAllByRole('tab')[0];
    addTab.focus();
    fireEvent.keyDown(addTab, { key: 'ArrowRight' });
    expect(handler).toHaveBeenCalledWith('REPLACE');
  });

  it('AC-4: ArrowLeft on focused REPLACE flips back to ADD', () => {
    const handler = vi.fn();
    setup({ mode: 'REPLACE', effectiveBowlSize: 1, onChange: handler });
    const replaceTab = screen.getAllByRole('tab')[1];
    replaceTab.focus();
    fireEvent.keyDown(replaceTab, { key: 'ArrowLeft' });
    expect(handler).toHaveBeenCalledWith('ADD');
  });

  it('AC-5: aria-controls on each tab matches the provided panelId', () => {
    setup();
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-controls', 'suggestion-panel');
    expect(tabs[1]).toHaveAttribute('aria-controls', 'suggestion-panel');
  });

  it('AC-20: single click flips mode (when not disabled)', () => {
    const handler = vi.fn();
    setup({ mode: 'ADD', effectiveBowlSize: 2, onChange: handler });
    const replaceTab = screen.getAllByRole('tab')[1];
    fireEvent.click(replaceTab);
    expect(handler).toHaveBeenCalledWith('REPLACE');
  });

  it('AC-21: aria-selected reflects active mode (true on active, false on other)', () => {
    setup({ mode: 'ADD', effectiveBowlSize: 1 });
    const [add, replace] = screen.getAllByRole('tab');
    expect(add).toHaveAttribute('aria-selected', 'true');
    expect(replace).toHaveAttribute('aria-selected', 'false');
  });

  it('REPLACE pill has aria-disabled=true when effectiveBowlSize===0', () => {
    setup({ mode: 'ADD', effectiveBowlSize: 0 });
    const replace = screen.getAllByRole('tab')[1];
    expect(replace).toHaveAttribute('aria-disabled', 'true');
  });

  it('REPLACE click is a no-op when effectiveBowlSize===0', () => {
    const handler = vi.fn();
    setup({ mode: 'ADD', effectiveBowlSize: 0, onChange: handler });
    const replace = screen.getAllByRole('tab')[1];
    fireEvent.click(replace);
    expect(handler).not.toHaveBeenCalledWith('REPLACE');
  });

  it('ArrowRight is a no-op when REPLACE is disabled', () => {
    const handler = vi.fn();
    setup({ mode: 'ADD', effectiveBowlSize: 0, onChange: handler });
    const add = screen.getAllByRole('tab')[0];
    add.focus();
    fireEvent.keyDown(add, { key: 'ArrowRight' });
    expect(handler).not.toHaveBeenCalledWith('REPLACE');
  });

  it('clicking the active tab is a no-op (no setState churn)', () => {
    const handler = vi.fn();
    setup({ mode: 'ADD', effectiveBowlSize: 0, onChange: handler });
    const add = screen.getAllByRole('tab')[0];
    fireEvent.click(add);
    expect(handler).not.toHaveBeenCalledWith('ADD');
  });
});
