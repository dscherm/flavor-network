/**
 * ShareReport — the quiet "Report" link on a user's shared recipe, and its small sheet (SHARE-7).
 * Props: shareId, sendReport(report) => Promise (default writes shareReports/{auto} in Firestore, loaded on first use),
 *        now (tests). Test ids: report-open, report-sheet, report-reason, report-note, report-send, report-cancel,
 *        report-thanks, report-error.
 * The report holds shareId, reason, note and time only: no uid, even when signed in.
 */
import { useState } from 'react';
import { buildReport, recordReport, reportsLeft, REPORT_LIMIT_MESSAGE, REPORT_REASONS, NOTE_MAX } from '../data/shareReport.js';
import { CHALK_CREAM, CHALK_DIM, CHALK_RAIL, FOCUS, btn, inputStyle, textAction } from './inventUi.jsx';

import { TEXT } from '../data/chalkTheme.js';
const tap = { minHeight: 44 };

async function defaultSend(report) {
  const [{ sendReport }, { db }] = await Promise.all([import('../data/shareStore.js'), import('../firebase.js')]);
  return sendReport(db, report);
}

export default function ShareReport({ shareId, sendReport = defaultSend, now }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [sent, setSent] = useState(false);

  if (sent) {
    return <p role="status" data-testid="report-thanks" className="text-[14px]" style={{ fontFamily: TEXT, color: CHALK_DIM }}>Thanks. The report was sent.</p>;
  }
  if (!open) {
    return (
      <button type="button" data-testid="report-open" onClick={() => setOpen(true)}
        className={`inline-flex items-center ${FOCUS}`} style={textAction({ fontSize: 15, color: CHALK_DIM })}>
        Report
      </button>
    );
  }

  const submit = async () => {
    const report = buildReport(shareId, reason, note, now ?? Date.now());
    if (!report) { setMsg('Pick a reason first.'); return; }
    if (!reportsLeft(report.at).allowed) { setMsg(REPORT_LIMIT_MESSAGE); return; }
    setBusy(true); setMsg(null);
    try {
      await sendReport(report);
      recordReport(report.at);
      setSent(true);
    } catch {
      setMsg('The report could not be sent. Check your connection and try again. Your note is kept.');
    } finally { setBusy(false); }
  };

  return (
    <section data-testid="report-sheet" aria-label="Report this recipe" className="p-4" style={{ border: `1px solid ${CHALK_RAIL}`, borderRadius: 8 }}>
      <p className="text-[15px]" style={{ fontFamily: TEXT, color: CHALK_CREAM }}>What is wrong with this recipe?</p>
      <label className="block mt-2 text-[14px]" style={{ fontFamily: TEXT, color: CHALK_DIM }}>
        Reason
        <select data-testid="report-reason" value={reason} onChange={(e) => setReason(e.target.value)}
          className="block w-full mt-1 px-3" style={{ ...inputStyle, borderRadius: 8, ...tap }}>
          <option value="">Choose a reason</option>
          {REPORT_REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </label>
      <label className="block mt-3 text-[14px]" style={{ fontFamily: TEXT, color: CHALK_DIM }}>
        Note (optional)
        <textarea data-testid="report-note" value={note} maxLength={NOTE_MAX} rows={3} onChange={(e) => setNote(e.target.value)}
          className="block w-full mt-1 px-3 py-2" style={{ ...inputStyle, borderRadius: 8 }} />
      </label>
      <p className="mt-1 text-[12px]" style={{ fontFamily: TEXT, color: CHALK_DIM }}>
        Reports are anonymous. We do not store who sent them. {note.length}/{NOTE_MAX}
      </p>
      {msg && <p role="alert" data-testid="report-error" className="mt-2 text-[14px]" style={{ fontFamily: TEXT, color: '#f87171' }}>{msg}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" data-testid="report-send" disabled={busy} onClick={submit}
          className={`inline-flex items-center justify-center px-4 ${FOCUS}`} style={{ ...btn(), ...tap }}>
          Send report
        </button>
        <button type="button" data-testid="report-cancel" onClick={() => { setOpen(false); setMsg(null); }}
          className={FOCUS} style={textAction({ fontSize: 16, color: CHALK_DIM })}>
          Cancel
        </button>
      </div>
    </section>
  );
}
