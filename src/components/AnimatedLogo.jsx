/**
 * AnimatedLogo — the Neural Flavor brand mark on the landing page.
 *
 * Drawn in chalk as SVG (ChalkLogo): chef's toque with "Nf" on the band,
 * over a Rutherford atom whose electrons travel its orbits. The old painted
 * PNG stays at public/fn-logo-chalk.png (used nowhere in the app now).
 */
import ChalkLogo from './ChalkLogo.jsx';

export default function AnimatedLogo({ className = '', title = 'Neural Flavor' }) {
  return <ChalkLogo className={className} title={title} />;
}
