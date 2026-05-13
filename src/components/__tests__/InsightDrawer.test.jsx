import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InsightDrawer, { pullExplanation, suggestedMove } from '../InsightDrawer.jsx';

const baseProps = {
  isOpen: true,
  onClose: () => {},
  filterStack: ['cuisine'],
  pullStrength: 0.5,
  visibleCount: 412,
  morphAxis: 'cuisine',
  bucketCounts: { European: 100, Americas: 80, 'East Asian': 50 },
  bucketColorMap: { European: '#3b82f6', Americas: '#ef4444', 'East Asian': '#f59e0b' },
  bridges: [
    { name: 'lemon',  bucket: 'European', otherBucket: 'East Asian', topPeer: 'ginger' },
    { name: 'cumin',  bucket: 'European', otherBucket: 'South Asian', topPeer: 'turmeric' },
    { name: 'butter', bucket: 'European', otherBucket: 'Americas',    topPeer: 'corn' },
  ],
  clusterOverlap: {
    clusters: [
      { id: 1, label: 'Sweet baking', total: 12, counts: { European: 10, Americas: 2 } },
      { id: 2, label: 'Aromatics',    total: 8,  counts: { European: 3, 'East Asian': 5 } },
    ],
    buckets: ['European', 'Americas', 'East Asian'],
    counts: {
      1: { European: 10, Americas: 2 },
      2: { European: 3, 'East Asian': 5 },
    },
  },
};

describe('pullExplanation', () => {
  it('returns the cooccurrence-dominant phrasing under 25%', () => {
    expect(pullExplanation(0.0)).toMatch(/cooccurrence-dominant/);
    expect(pullExplanation(0.24)).toMatch(/cooccurrence-dominant/);
  });
  it('returns the transitional phrasing between 25-50%', () => {
    expect(pullExplanation(0.4)).toMatch(/leans toward cooccurrence/);
  });
  it('returns the balanced phrasing between 50-75%', () => {
    expect(pullExplanation(0.6)).toMatch(/balanced/);
  });
  it('returns the bucket-dominant phrasing at 75%+', () => {
    expect(pullExplanation(0.9)).toMatch(/bucket-dominant/);
  });
});

describe('suggestedMove', () => {
  it('returns null when filterStack is empty', () => {
    expect(suggestedMove({ filterStack: [] })).toBeNull();
  });
  it('warns when the intersection is empty', () => {
    expect(suggestedMove({ filterStack: ['cuisine'], visibleCount: 0 })).toMatch(/empty/);
  });
  it('suggests the first unused primary axis', () => {
    expect(suggestedMove({ filterStack: ['cuisine'], visibleCount: 50 })).toMatch(/Aroma/);
  });
  it('reports when every primary axis is already in the stack', () => {
    expect(
      suggestedMove({
        filterStack: ['aroma', 'cuisine', 'season', 'family', 'taste'],
        visibleCount: 5,
      }),
    ).toMatch(/already in the stack/);
  });
});

describe('InsightDrawer', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(<InsightDrawer {...baseProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the empty-state stub when filterStack is empty', () => {
    render(<InsightDrawer {...baseProps} filterStack={[]} />);
    expect(screen.getByTestId('insight-empty')).toHaveTextContent(/Apply a filter/);
  });

  it('renders all five sections when state is non-empty', () => {
    render(<InsightDrawer {...baseProps} />);
    expect(screen.getByTestId('section-composition')).toBeTruthy();
    expect(screen.getByTestId('section-bucket-dist')).toBeTruthy();
    expect(screen.getByTestId('section-pull')).toBeTruthy();
    expect(screen.getByTestId('section-cluster-matrix')).toBeTruthy();
    expect(screen.getByTestId('section-suggested')).toBeTruthy();
  });

  it('renders the composition sentence using FILTER_LABELS', () => {
    render(<InsightDrawer {...baseProps} filterStack={['cuisine', 'aroma']} />);
    expect(screen.getByTestId('section-composition')).toHaveTextContent(
      /412 ingredients matching Cuisine × Aroma/,
    );
  });

  it('renders one row per cluster in the matrix', () => {
    render(<InsightDrawer {...baseProps} />);
    const matrix = screen.getByTestId('cluster-matrix');
    expect(matrix.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('renders the bridge list with up to 3 entries', () => {
    render(<InsightDrawer {...baseProps} />);
    expect(screen.getByTestId('bridge-list').querySelectorAll('li')).toHaveLength(3);
  });

  it('hides the bridge list when bridges is null', () => {
    render(<InsightDrawer {...baseProps} bridges={null} />);
    expect(screen.queryByTestId('bridge-list')).toBeNull();
  });

  it('fires onClose when the × button is clicked', () => {
    const onClose = vi.fn();
    render(<InsightDrawer {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getAllByLabelText('Close insight drawer')[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders a full-screen dialog with grab-handle on mobile', () => {
    render(<InsightDrawer {...baseProps} isMobile />);
    const drawer = screen.getByTestId('insight-drawer');
    expect(drawer).toHaveAttribute('role', 'dialog');
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByTestId('insight-drawer-handle')).toBeInTheDocument();
  });

  it('mobile grab-handle closes the drawer when tapped', () => {
    const onClose = vi.fn();
    render(<InsightDrawer {...baseProps} isMobile onClose={onClose} />);
    fireEvent.click(screen.getByTestId('insight-drawer-handle'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
