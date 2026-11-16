/**
 * InventNameSave — the cook names their invention and adds it to their list.
 * The name box shows whatever `name` is (panels pass ''), never a default.
 *
 * Props
 *   name            string
 *   onName          (text)
 *   placeholder     string                         e.g. "Name your cocktail"
 *   canSave         bool                           false disables the button and shows `disabledReason`
 *   disabledReason  string                         default "Add a name and at least two ingredients."
 *   saveLabel       string                         e.g. "Add to my cocktails"
 *   onSave          ()
 *   status          'idle' | 'saving' | 'saved' | 'error' | 'signin'
 *   message         string                         shown for saved / error / signin (signin default: "Sign in to save, then it saves.")
 *   maxLength       default 80
 *   testidPrefix    default 'namesave'
 *   onNameCommit    (text)  called when the name box loses focus with something in it (usage: invent_named; the text itself is not sent)
 *   shareItem       { kind, item } the saved invention; once status is 'saved' a Share button publishes it (OwnShare, behind SHARE_OWN_ENABLED)
 * Test ids: {p} root, {p}-name, {p}-save, {p}-reason, {p}-status.
 */
import { btn, inputStyle, SANS, CHALK_CREAM, CHALK_DIM, ACCENT } from './inventUi.jsx';
import { OwnShareButton } from './OwnShare.jsx';

export default function InventNameSave({
  name = '', onName, placeholder = 'Name it', canSave = false, disabledReason = 'Add a name and at least two ingredients.',
  saveLabel = 'Save', onSave, status = 'idle', message = '', maxLength = 80, testidPrefix = 'namesave', shareItem = null, onNameCommit,
}) {
  const p = testidPrefix;
  const saving = status === 'saving';
  const disabled = !canSave || saving;
  const shown = message || (status === 'signin' ? 'Sign in to save, then it saves.' : status === 'saved' ? 'Saved.' : '');
  return (
    <div data-testid={p} className="min-w-0 flex flex-col gap-1.5">
      <input type="text" value={name} onChange={(e) => onName(e.target.value)} onBlur={(e) => onNameCommit?.(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        maxLength={maxLength} data-testid={`${p}-name`} autoComplete="off" className="w-full min-w-0 px-3 rounded-lg min-h-[44px]" style={inputStyle} />
      <button type="button" onClick={onSave} disabled={disabled} data-testid={`${p}-save`} className="w-full px-4 rounded-lg min-h-[44px]"
        style={btn({ background: disabled ? 'transparent' : `${ACCENT}33`, opacity: disabled ? 0.55 : 1, color: CHALK_CREAM })}>
        {saving ? 'Saving…' : saveLabel}
      </button>
      {!canSave && !saving && <p className="text-[13px]" style={{ fontFamily: SANS, color: CHALK_DIM }} data-testid={`${p}-reason`}>{disabledReason}</p>}
      {shown && status !== 'idle' && status !== 'saving' && (
        <p role={status === 'error' ? 'alert' : 'status'} className="text-[14px]" style={{ fontFamily: SANS, color: status === 'error' ? ACCENT : CHALK_CREAM }}
          data-testid={`${p}-status`} data-status={status}>{shown}</p>
      )}
      {status === 'saved' && shareItem?.item && (
        <OwnShareButton kind={shareItem.kind} item={shareItem.item} testid={`${p}-share`} className="w-full" />
      )}
    </div>
  );
}
