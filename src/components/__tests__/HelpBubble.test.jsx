import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HelpBubble from '../HelpBubble.jsx';

const open = () => fireEvent.click(screen.getByTestId('help-bubble'));

describe('HelpBubble', () => {
  it('renders a "?" button and hides the popover until opened', () => {
    render(<HelpBubble title="Adding an ingredient" body={['Tap a row to pin it.']} />);
    const btn = screen.getByTestId('help-bubble');
    expect(btn).toHaveTextContent('?');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('help-bubble-popover')).toBeNull();
  });

  it('toggles the popover and renders title + body lines', () => {
    render(<HelpBubble title="Adding an ingredient" body={['Tap a row to pin it.', 'Tap the dot to confirm.']} />);
    open();
    const pop = screen.getByTestId('help-bubble-popover');
    expect(pop).toHaveTextContent('Adding an ingredient');
    expect(pop).toHaveTextContent('Tap a row to pin it.');
    expect(pop).toHaveTextContent('Tap the dot to confirm.');
    expect(screen.getByTestId('help-bubble')).toHaveAttribute('aria-expanded', 'true');
  });

  it('accepts a plain string body', () => {
    render(<HelpBubble title="T" body="Just one line." />);
    open();
    expect(screen.getByTestId('help-bubble-popover')).toHaveTextContent('Just one line.');
  });

  it('closes on the in-popover × and reopens', () => {
    render(<HelpBubble title="T" body={['x']} />);
    open();
    fireEvent.click(screen.getByTestId('help-bubble-close'));
    expect(screen.queryByTestId('help-bubble-popover')).toBeNull();
    open();
    expect(screen.getByTestId('help-bubble-popover')).toBeTruthy();
  });

  it('closes on Escape', () => {
    render(<HelpBubble title="T" body={['x']} />);
    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('help-bubble-popover')).toBeNull();
  });

  it('closes on an outside click', () => {
    render(<div><HelpBubble title="T" body={['x']} /><button data-testid="outside">out</button></div>);
    open();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByTestId('help-bubble-popover')).toBeNull();
  });

  it('uses an accessible label and supports a custom one', () => {
    const { rerender } = render(<HelpBubble title="T" body={['x']} />);
    expect(screen.getByLabelText('Help')).toBeTruthy();
    rerender(<HelpBubble title="T" body={['x']} label="How adding works" />);
    expect(screen.getByLabelText('How adding works')).toBeTruthy();
  });

  it('is null-safe with no body', () => {
    render(<HelpBubble title="Only a title" />);
    open();
    expect(screen.getByTestId('help-bubble-popover')).toHaveTextContent('Only a title');
  });

  it('renders the chalk variant', () => {
    render(<HelpBubble title="T" body={['x']} variant="chalk" testId="hb-chalk" />);
    fireEvent.click(screen.getByTestId('hb-chalk'));
    expect(screen.getByTestId('hb-chalk-popover')).toBeTruthy();
  });
});
