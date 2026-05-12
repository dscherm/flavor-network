/**
 * HUDAnnouncer — visually-hidden aria-live region for screen readers.
 *
 * R16 Phase 4. Whenever the filter stack, active filter, or visible
 * node count changes, this component announces a short status string
 * (e.g., "Cuisine filter applied. 412 ingredients matching.") so
 * assistive tech users track the morph + filter state without seeing
 * the canvas.
 *
 * Visible-but-hidden via the `sr-only` Tailwind utility: zero height,
 * clipped, position absolute. The string sits in `aria-live="polite"`
 * so updates land between speaker turns rather than interrupting.
 *
 * Props are derived from App.jsx state; the component is purely
 * presentational.
 */

import { useEffect, useState } from 'react';
import { FILTER_LABELS } from '../data/networkModes.js';

export default function HUDAnnouncer({ filterStack = [], visibleCount = null }) {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (filterStack.length === 0) {
      setMessage('All filters cleared. Showing every ingredient.');
      return;
    }
    const active = filterStack[filterStack.length - 1];
    const label = FILTER_LABELS[active] || active;
    const countPart = visibleCount != null
      ? ` ${visibleCount} ingredient${visibleCount === 1 ? '' : 's'} matching.`
      : '';
    setMessage(`${label} filter applied.${countPart}`);
  }, [filterStack, visibleCount]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {message}
    </div>
  );
}
