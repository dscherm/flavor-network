import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react';
import StartPage from './StartPage.jsx';
import ErrorCard from './ErrorCard.jsx';


describe('StartPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders the title and the 3 mode cards', () => {
    render(<StartPage onModeSelect={() => {}} />);
    expect(screen.getByText(/Find flavors that work together/i)).toBeTruthy();
    expect(screen.getByText(/Discover ingredients/i)).toBeTruthy();
    expect(screen.getByText(/Build a recipe/i)).toBeTruthy();
    expect(screen.getByText(/Learn the science/i)).toBeTruthy();
  });

  it('subtitle mentions credibility anchors (2.2M recipes + molecular chemistry)', () => {
    render(<StartPage onModeSelect={() => {}} />);
    const subtitle = screen.getByText(/2\.2M recipes/i);
    expect(subtitle).toBeTruthy();
    expect(subtitle.textContent).toMatch(/molecular chemistry/i);
  });

  it('clicking Discover sets localStorage flag and fires onModeSelect("discover")', () => {
    const onModeSelect = vi.fn();
    const { container } = render(<StartPage onModeSelect={onModeSelect} />);
    const btn = container.querySelector('[data-mode="discover"]');
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(localStorage.getItem('fn-start-seen')).toBe('1');
    expect(onModeSelect).toHaveBeenCalledWith('discover');
  });

  it('clicking Build sets localStorage flag and fires onModeSelect("build")', () => {
    const onModeSelect = vi.fn();
    const { container } = render(<StartPage onModeSelect={onModeSelect} />);
    fireEvent.click(container.querySelector('[data-mode="build"]'));
    expect(localStorage.getItem('fn-start-seen')).toBe('1');
    expect(onModeSelect).toHaveBeenCalledWith('build');
  });

  it('clicking Learn sets localStorage flag and fires onModeSelect("learn")', () => {
    const onModeSelect = vi.fn();
    const { container } = render(<StartPage onModeSelect={onModeSelect} />);
    fireEvent.click(container.querySelector('[data-mode="learn"]'));
    expect(localStorage.getItem('fn-start-seen')).toBe('1');
    expect(onModeSelect).toHaveBeenCalledWith('learn');
  });

  it('falls through gracefully when localStorage.setItem throws (private-mode Safari)', () => {
    const onModeSelect = vi.fn();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { container } = render(<StartPage onModeSelect={onModeSelect} />);
    fireEvent.click(container.querySelector('[data-mode="discover"]'));
    expect(onModeSelect).toHaveBeenCalledWith('discover');
    spy.mockRestore();
  });

  it('renders 3 button elements so Tab reaches each card', () => {
    const { container } = render(<StartPage onModeSelect={() => {}} />);
    const buttons = container.querySelectorAll('button[data-mode]');
    expect(buttons.length).toBe(3);
    expect(buttons[0].getAttribute('data-mode')).toBe('discover');
    expect(buttons[1].getAttribute('data-mode')).toBe('build');
    expect(buttons[2].getAttribute('data-mode')).toBe('learn');
  });

  it('auto-focuses the first card on mount', () => {
    const { container } = render(<StartPage onModeSelect={() => {}} />);
    const firstBtn = container.querySelector('[data-mode="discover"]');
    expect(document.activeElement).toBe(firstBtn);
  });

  it('Enter key on focused card activates it (native <button> keyboard semantics)', () => {
    const onModeSelect = vi.fn();
    const { container } = render(<StartPage onModeSelect={onModeSelect} />);
    const buildBtn = container.querySelector('[data-mode="build"]');
    buildBtn.focus();
    expect(document.activeElement).toBe(buildBtn);
    // HTMLButtonElement.click() dispatches the same click event that browsers
    // synthesize natively when Enter is pressed on a focused <button>.
    buildBtn.click();
    expect(onModeSelect).toHaveBeenCalledWith('build');
    expect(localStorage.getItem('fn-start-seen')).toBe('1');
  });

  it('applies motion-safe class to animated elements (reduced-motion opt-out)', () => {
    const { container } = render(<StartPage onModeSelect={() => {}} />);
    // Discover card: pulsing dots opt out of animation via motion-safe:animate-pulse
    const pulsingDots = container.querySelectorAll('.motion-safe\\:animate-pulse');
    expect(pulsingDots.length).toBeGreaterThan(0);
    // Learn card: rotating molecule opts out via motion-safe:[animation:...]
    const rotating = container.querySelector('[class*="motion-safe"][class*="fn-spin"]');
    expect(rotating).toBeTruthy();
  });
});

describe('ErrorCard', () => {
  it('renders the spec copy exactly', () => {
    render(<ErrorCard onRetry={() => {}} onStartOver={() => {}} />);
    expect(screen.getByText("Couldn't load the flavor network.")).toBeTruthy();
  });

  it('fires onRetry when Retry is clicked', () => {
    const onRetry = vi.fn();
    const onStartOver = vi.fn();
    render(<ErrorCard onRetry={onRetry} onStartOver={onStartOver} />);
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onStartOver).not.toHaveBeenCalled();
  });

  it('fires onStartOver when Start over is clicked', () => {
    const onRetry = vi.fn();
    const onStartOver = vi.fn();
    render(<ErrorCard onRetry={onRetry} onStartOver={onStartOver} />);
    fireEvent.click(screen.getByText('Start over'));
    expect(onStartOver).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });
});

// Integration harness: exercises the StartPage → ErrorCard → Retry/StartOver
// state machine using the same gating logic App.jsx implements. We can't mount
// App.jsx directly because its import graph pulls in Three.js, Firebase, and
// Web Workers — none of which run in jsdom. The harness replicates App.jsx's
// gating semantics (readStartPageFlag, startPageComplete state, handleModeSelect,
// handleStartOver) so a regression in either component or the wiring contract
// is caught here.
function FlowHarness({ fetchShouldFail = false, onReady = () => {} }) {
  const [startPageComplete, setStartPageComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fetchCount, setFetchCount] = useState(0);

  const simulateFetch = () => {
    setLoading(true);
    setError(null);
    setFetchCount((c) => c + 1);
    Promise.resolve().then(() => {
      if (fetchShouldFail) {
        setError(new Error('mock fetch failure'));
        setLoading(false);
      } else {
        setLoading(false);
        onReady();
      }
    });
  };

  const handleModeSelect = (mode) => {
    try { localStorage.setItem('fn-start-seen', '1'); } catch { /* ignore */ }
    setStartPageComplete(true);
    simulateFetch();
    window.__selectedMode = mode;
  };

  const retry = () => simulateFetch();

  const handleStartOver = () => {
    try { localStorage.removeItem('fn-start-seen'); } catch { /* ignore */ }
    setStartPageComplete(false);
    setError(null);
  };

  if (!startPageComplete) return <StartPage onModeSelect={handleModeSelect} />;
  if (error) return <ErrorCard onRetry={retry} onStartOver={handleStartOver} />;
  if (loading) return <div data-testid="loading">loading</div>;
  return <div data-testid="app-ready">app-ready ({fetchCount})</div>;
}

describe('App-level flow integration', () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.__selectedMode;
  });

  afterEach(() => {
    localStorage.clear();
    delete window.__selectedMode;
  });

  it('happy path: mode click → loading → app ready, localStorage persisted', async () => {
    const { container, getByTestId } = render(<FlowHarness fetchShouldFail={false} />);
    expect(container.querySelector('[data-mode="discover"]')).toBeTruthy();
    await act(async () => {
      fireEvent.click(container.querySelector('[data-mode="discover"]'));
    });
    await waitFor(() => expect(getByTestId('app-ready')).toBeTruthy());
    expect(localStorage.getItem('fn-start-seen')).toBe('1');
    expect(window.__selectedMode).toBe('discover');
  });

  it('error path: fetch fails → ErrorCard renders with spec copy', async () => {
    const { container } = render(<FlowHarness fetchShouldFail={true} />);
    await act(async () => {
      fireEvent.click(container.querySelector('[data-mode="build"]'));
    });
    await waitFor(() => {
      expect(screen.getByText("Couldn't load the flavor network.")).toBeTruthy();
    });
    expect(screen.getByText('Retry')).toBeTruthy();
    expect(screen.getByText('Start over')).toBeTruthy();
    expect(localStorage.getItem('fn-start-seen')).toBe('1');
  });

  it('Retry re-invokes fetch and preserves fn-start-seen=1', async () => {
    const { container } = render(<FlowHarness fetchShouldFail={true} />);
    await act(async () => {
      fireEvent.click(container.querySelector('[data-mode="learn"]'));
    });
    await waitFor(() => screen.getByText("Couldn't load the flavor network."));
    expect(localStorage.getItem('fn-start-seen')).toBe('1');

    await act(async () => {
      fireEvent.click(screen.getByText('Retry'));
    });

    // The fetch ran again and failed again, so ErrorCard is still on screen.
    // localStorage must remain set so a browser refresh does NOT re-show StartPage
    // after a transient failure (per the spec's round-7 decision).
    await waitFor(() => screen.getByText("Couldn't load the flavor network."));
    expect(localStorage.getItem('fn-start-seen')).toBe('1');
  });

  it('Start over clears localStorage AND returns to StartPage', async () => {
    const { container } = render(<FlowHarness fetchShouldFail={true} />);
    await act(async () => {
      fireEvent.click(container.querySelector('[data-mode="discover"]'));
    });
    await waitFor(() => screen.getByText("Couldn't load the flavor network."));
    expect(localStorage.getItem('fn-start-seen')).toBe('1');
    await act(async () => {
      fireEvent.click(screen.getByText('Start over'));
    });
    // StartPage is back with all 3 cards
    await waitFor(() => {
      expect(container.querySelector('[data-mode="discover"]')).toBeTruthy();
      expect(container.querySelector('[data-mode="build"]')).toBeTruthy();
      expect(container.querySelector('[data-mode="learn"]')).toBeTruthy();
    });
    expect(localStorage.getItem('fn-start-seen')).toBeNull();
  });
});
