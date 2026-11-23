/**
 * AnimatedLogo — the Neural Flavor brand mark on the landing page.
 *
 * Drawn in chalk as SVG (ChalkLogo): chef's toque with "Nf" on the band,
 * capping a conical flask with bubbles rising.
 */
import ChalkLogo from './ChalkLogo.jsx';

export default function AnimatedLogo({ className = '', title = 'Neural Flavor' }) {
  return <ChalkLogo className={className} title={title} />;
}
