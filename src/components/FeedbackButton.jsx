/**
 * FeedbackButton — "Send feedback" link and its small sheet (USAGE-4).
 * Props: screen (one of FEEDBACK_SCREENS), sendFeedback(fb) => Promise (default writes feedback/{auto} in Firestore,
 *        loaded on first use), now (tests), className/style for the trigger.
 * Test ids: feedback-open, feedback-sheet, feedback-note, feedback-goal, feedback-send, feedback-cancel,
 *           feedback-thanks, feedback-error.
 * The note holds the two texts, the screen and a server time only: no uid, even when signed in.
 * It is separate from usage data: sending needs no analytics answer.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildFeedback, feedbackLeft, recordFeedback, FEEDBACK_LIMIT_MESSAGE, NOTE_MAX, GOAL_MAX } from '../data/feedback.js';
import { CHALK_CREAM, CHALK_DIM, CHALK_RAIL, ACCENT, btn, inputStyle } from './inventUi.jsx';

import { TEXT } from '../data/chalkTheme.js';
const tap = { minHeight: 44 };

async function defaultSend(fb) {
  const [{ sendFeedback }, { db }] = await Promise.all([import('../data/shareStore.js'), import('../firebase.js')]);
  return sendFeedback(db, fb);
}

export default function FeedbackButton({ screen = 'other', sendFeedback = defaultSend, now, className = '', style = {} }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [sent, setSent] = useState(false);
  const trigger = useRef(null);
  const sheet = useRef(null);
  const noteRef = useRef(null);
  const wasOpen = useRef(false);

  const close = () => { setOpen(false); setMsg(null); setSent(false); };

  useEffect(() => {
    if (!open) return undefined;
    noteRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab' || !sheet.current) return;
      const els = [...sheet.current.querySelectorAll('button:not([disabled]), textarea, a[href]')];
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  useEffect(() => {
    if (open) wasOpen.current = true;
    else if (wasOpen.current) { wasOpen.current = false; trigger.current?.focus?.(); }
  }, [open]);

  const submit = async () => {
    const fb = buildFeedback(note, goal, screen, now ?? Date.now());
    if (!fb) { setMsg('Please write a short note first.'); noteRef.current?.focus(); return; }
    if (!feedbackLeft(fb.at).allowed) { setMsg(FEEDBACK_LIMIT_MESSAGE); return; }
    setBusy(true); setMsg(null);
    try {
      await sendFeedback(fb);
      recordFeedback(fb.at);
      setNote(''); setGoal('');
      setSent(true);
    } catch {
      setMsg('The note could not be sent. Check your connection and try again. Your text is kept.');
    } finally { setBusy(false); }
  };

  return (
    <>
      <button type="button" ref={trigger} data-testid="feedback-open" onClick={() => setOpen(true)}
        className={`inline-flex items-center underline ${className}`} style={{ minHeight: 44, background: 'none', border: 0, ...style }}>
        Send feedback
      </button>
      {open && createPortal(
        <div data-testid="feedback-overlay" className="fixed inset-0 flex items-end sm:items-center justify-center overflow-y-auto"
          style={{ zIndex: 10000, background: 'rgba(0,0,0,0.6)', padding: 12 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <section ref={sheet} role="dialog" aria-modal="true" aria-label="Send feedback" data-testid="feedback-sheet"
            className="w-full rounded-xl p-4" style={{ maxWidth: 440, background: '#161a17', border: `1px solid ${CHALK_RAIL}`, boxSizing: 'border-box' }}>
            {sent ? (
              <div>
                <p role="status" data-testid="feedback-thanks" className="text-[16px]" style={{ fontFamily: TEXT, color: CHALK_CREAM }}>
                  Thank you. Your note was sent.
                </p>
                <button type="button" data-testid="feedback-cancel" onClick={close}
                  className="mt-3 inline-flex items-center justify-center rounded-lg px-4" style={{ ...btn(), ...tap }}>
                  Close
                </button>
              </div>
            ) : (
              <>
                <p className="text-[16px]" style={{ fontFamily: TEXT, color: CHALK_CREAM }}>What would make Neural Flavor better?</p>
                <label className="block mt-3 text-[14px]" style={{ fontFamily: TEXT, color: CHALK_DIM }}>
                  Your note (required)
                  <textarea ref={noteRef} data-testid="feedback-note" value={note} maxLength={NOTE_MAX} rows={4} required
                    onChange={(e) => setNote(e.target.value)} className="block w-full mt-1 rounded-lg px-3 py-2" style={inputStyle} />
                </label>
                <p data-testid="feedback-note-count" className="mt-1 text-[12px]" style={{ fontFamily: TEXT, color: CHALK_DIM }}>{note.length}/{NOTE_MAX}</p>
                <label className="block mt-2 text-[14px]" style={{ fontFamily: TEXT, color: CHALK_DIM }}>
                  What were you trying to do? (optional)
                  <textarea data-testid="feedback-goal" value={goal} maxLength={GOAL_MAX} rows={2}
                    onChange={(e) => setGoal(e.target.value)} className="block w-full mt-1 rounded-lg px-3 py-2" style={inputStyle} />
                </label>
                <p className="mt-1 text-[12px]" style={{ fontFamily: TEXT, color: CHALK_DIM }}>
                  Anonymous. We do not store who sent it, and it does not depend on your usage-data answer. {goal.length}/{GOAL_MAX}
                </p>
                {msg && <p role="alert" data-testid="feedback-error" className="mt-2 text-[14px]" style={{ fontFamily: TEXT, color: '#fda4af' }}>{msg}</p>}
                <div className="mt-3 flex gap-2">
                  <button type="button" data-testid="feedback-send" disabled={busy} onClick={submit}
                    className="inline-flex items-center justify-center rounded-lg px-4" style={{ ...btn({ background: `${ACCENT}55`, borderColor: ACCENT }), ...tap }}>
                    {busy ? 'Sending…' : 'Send'}
                  </button>
                  <button type="button" data-testid="feedback-cancel" onClick={close}
                    className="inline-flex items-center justify-center rounded-lg px-4" style={{ ...btn(), ...tap }}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
