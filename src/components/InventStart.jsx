/**
 * InventStart — the one first question of an Invent panel ("Which liquor?").
 * Chips for what the cook has first, plus a text box. Nothing is chosen for them.
 *
 * Props
 *   question      string                         the question
 *   options       [{ key, have? }]               chips, owned first (the lab orders them)
 *   onPick        (textOrKey) → void             a chip's key, or the typed text (trimmed)
 *   placeholder   string                         text box placeholder
 *   allowSkip     bool                           show a skip button; onSkip() when pressed
 *   onSkip        () → void
 *   labels        { go, skip, have }             copy overrides
 *   testidPrefix  default 'start'
 * Test ids: {p} root, {p}-option (each chip, data-key), {p}-input, {p}-go, {p}-skip.
 */
import { TextAdd, Chip, heading, ACCENT, SANS, CHALK_DIM, CHALK_RAIL } from './inventUi.jsx';

export default function InventStart({
  question, options = [], onPick, placeholder = 'or type one', allowSkip = false, onSkip, labels = {}, testidPrefix = 'start',
}) {
  const p = testidPrefix;
  const L = { go: 'Start', skip: 'Skip', have: 'have', ...labels };
  return (
    <div data-testid={p} className="min-w-0">
      <p className="mb-2" style={heading} data-testid={`${p}-question`}>{question}</p>
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {options.map((o) => (
            <Chip key={o.key} item={o} testid={`${p}-option`} onClick={() => onPick(o.key)} haveLabel={L.have} color={ACCENT} />
          ))}
        </div>
      )}
      <TextAdd placeholder={placeholder} buttonLabel={L.go} label={question} onSubmit={onPick} testid={`${p}-input`} buttonTestid={`${p}-go`} />
      {allowSkip && (
        <button type="button" onClick={() => onSkip && onSkip()} data-testid={`${p}-skip`}
          className="mt-2 min-h-[44px] px-3 rounded-lg" style={{ fontFamily: SANS, fontSize: 14, color: CHALK_DIM, border: `1px solid ${CHALK_RAIL}` }}>
          {L.skip}
        </button>
      )}
    </div>
  );
}
