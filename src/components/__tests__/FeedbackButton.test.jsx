// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../hooks/useAuth.js', () => ({ default: () => ({ user: { uid: 'secret-uid', email: 'a@b.co' }, loading: false, authError: null }) }));
import FeedbackButton from '../FeedbackButton.jsx';
import LabsPanel from '../LabsPanel.jsx';

beforeEach(() => { try { localStorage.clear(); } catch { /* none */ } });
afterEach(() => cleanup());

const open = () => fireEvent.click(screen.getByTestId('feedback-open'));
const type = (id, value) => fireEvent.change(screen.getByTestId(id), { target: { value } });

describe('FeedbackButton', () => {
  it('opens from the Labs menu, and focus is in the note box', () => {
    render(<LabsPanel onPick={vi.fn()} />);
    open();
    expect(screen.getByTestId('feedback-sheet')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByTestId('feedback-note'));
  });

  it('shows the character limit and requires a note', () => {
    const send = vi.fn();
    render(<FeedbackButton screen="labs" sendFeedback={send} />);
    open();
    expect(screen.getByTestId('feedback-note-count').textContent).toBe('0/500');
    type('feedback-note', 'abc');
    expect(screen.getByTestId('feedback-note-count').textContent).toBe('3/500');
    type('feedback-note', '   ');
    fireEvent.click(screen.getByTestId('feedback-send'));
    expect(screen.getByTestId('feedback-error').textContent).toBe('Please write a short note first.');
    expect(send).not.toHaveBeenCalled();
  });

  it('sends only note, goal, lab and at, then says thank you', async () => {
    const send = vi.fn(async () => {});
    render(<FeedbackButton screen="labs" sendFeedback={send} now={1700000000000} />);
    open();
    type('feedback-note', ' Add dark mode ');
    type('feedback-goal', 'Cook at night');
    fireEvent.click(screen.getByTestId('feedback-send'));
    expect((await screen.findByTestId('feedback-thanks')).textContent).toBe('Thank you. Your note was sent.');
    expect(send.mock.calls[0][0]).toEqual({ note: 'Add dark mode', goal: 'Cook at night', lab: 'labs', at: 1700000000000 });
    expect(JSON.stringify(send.mock.calls[0][0])).not.toMatch(/secret-uid|a@b\.co/);
  });

  it('keeps the text and says so when sending fails', async () => {
    const send = vi.fn(async () => { throw new Error('offline'); });
    render(<FeedbackButton screen="labs" sendFeedback={send} />);
    open();
    type('feedback-note', 'Please keep me');
    type('feedback-goal', 'and me');
    fireEvent.click(screen.getByTestId('feedback-send'));
    const err = await screen.findByTestId('feedback-error');
    expect(err.textContent).toMatch(/could not be sent/);
    expect(err.textContent).toMatch(/Your text is kept/);
    expect(screen.getByTestId('feedback-note').value).toBe('Please keep me');
    expect(screen.getByTestId('feedback-goal').value).toBe('and me');
    expect(screen.queryByTestId('feedback-thanks')).toBeNull();
  });

  it('refuses the fourth note from one browser in a day with a plain sentence', async () => {
    const send = vi.fn(async () => {});
    render(<FeedbackButton screen="labs" sendFeedback={send} now={1700000000000} />);
    for (let i = 0; i < 3; i++) {
      open();
      type('feedback-note', `note ${i}`);
      fireEvent.click(screen.getByTestId('feedback-send'));
      await screen.findByTestId('feedback-thanks');
      fireEvent.click(screen.getByTestId('feedback-cancel'));
    }
    open();
    type('feedback-note', 'fourth');
    fireEvent.click(screen.getByTestId('feedback-send'));
    expect(screen.getByTestId('feedback-error').textContent).toBe('You have already sent 3 notes today. Thank you, please try again tomorrow.');
    expect(send).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId('feedback-note').value).toBe('fourth');
  });

  it('closes on Escape and returns focus to the menu button', async () => {
    render(<FeedbackButton screen="labs" sendFeedback={vi.fn()} />);
    open();
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('feedback-sheet')).toBeNull());
    expect(document.activeElement).toBe(screen.getByTestId('feedback-open'));
  });

  it('Cancel closes and returns focus too; Tab wraps inside the sheet', async () => {
    render(<FeedbackButton screen="labs" sendFeedback={vi.fn()} />);
    open();
    const cancel = screen.getByTestId('feedback-cancel');
    cancel.focus();
    fireEvent.keyDown(cancel, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByTestId('feedback-note'));
    fireEvent.click(cancel);
    await waitFor(() => expect(screen.queryByTestId('feedback-sheet')).toBeNull());
    expect(document.activeElement).toBe(screen.getByTestId('feedback-open'));
  });

  it('is a labelled dialog with 44px targets', () => {
    render(<FeedbackButton screen="labs" sendFeedback={vi.fn()} />);
    open();
    const dlg = screen.getByRole('dialog');
    expect(dlg.getAttribute('aria-label')).toBe('Send feedback');
    expect(screen.getByTestId('feedback-send').style.minHeight).toBe('44px');
    expect(screen.getByTestId('feedback-open').style.minHeight).toBe('44px');
  });
});
