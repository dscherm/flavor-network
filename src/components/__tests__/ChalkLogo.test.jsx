import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChalkLogo from '../ChalkLogo.jsx';
import AnimatedLogo from '../AnimatedLogo.jsx';

describe('ChalkLogo', () => {
  it('is a labelled image with the Nf mark, three orbits and orbiting electrons', () => {
    const { container } = render(<ChalkLogo title="Neural Flavor" />);
    expect(screen.getByRole('img', { name: 'Neural Flavor' })).toBeTruthy();
    expect(container.querySelector('text').textContent).toBe('Nf');
    expect(container.querySelectorAll('g[transform^="rotate"]').length).toBe(3);
    expect(container.querySelectorAll('animateMotion').length).toBe(3);
  });

  it('can be drawn still', () => {
    const { container } = render(<ChalkLogo animate={false} />);
    expect(container.querySelectorAll('animateMotion').length).toBe(0);
  });

  it('is what the landing page logo renders', () => {
    render(<AnimatedLogo />);
    expect(screen.getByTestId('chalk-logo')).toBeTruthy();
  });
});
