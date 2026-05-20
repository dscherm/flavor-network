/**
 * AnimatedLogo — chalk-rendered Neural Flavor brand mark (chef toque +
 * "Nf" nucleus + Rutherford atomic-orbit shells, drawn in chalk on a
 * chalkboard).
 *
 * Currently a static chalk PNG; the animated orbiting electrons were
 * removed because the hand-drawn chalk rings in the PNG aren't true
 * ellipses, so no programmatic motion path traced them convincingly.
 */
export default function AnimatedLogo({ className = '', title = 'Neural Flavor' }) {
  return (
    <img
      src="/fn-logo-chalk.png"
      alt={title}
      className={className}
      draggable={false}
    />
  );
}
