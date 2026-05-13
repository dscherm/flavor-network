import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TrainingTraceModal from '../TrainingTraceModal.jsx';

const MINIMAL_TRACE = {
  frames: [
    { epoch: 1, loss: 0.5, embeddings: [[0, 0]] },
    { epoch: 3, loss: 0.3, embeddings: [[0.1, 0.2]] },
  ],
  compound_labels: ['sweet'],
};

describe('TrainingTraceModal', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(MINIMAL_TRACE) }),
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen=false', () => {
    const { container } = render(<TrainingTraceModal isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title and Got it button when isOpen=true', () => {
    render(<TrainingTraceModal isOpen onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Watch the model learn/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Got it/i })).toBeInTheDocument();
  });

  it('clicking Got it invokes onClose', () => {
    const onClose = vi.fn();
    render(<TrainingTraceModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Got it/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape key invokes onClose', () => {
    const onClose = vi.fn();
    render(<TrainingTraceModal isOpen onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
