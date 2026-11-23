import { TEXT, CHALK_CREAM, CHALK_DIM, CHALK_RAIL } from '../data/chalkTheme.js';

/**
 * "Delete this one?" before a saved cocktail / sauce is removed from the account.
 * Sits above the lab card (z 80) and the invent panel (z 82).
 */
export default function SavedDeleteConfirm({ name, noun = 'cocktails', onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.6)' }} data-testid="saved-delete-confirm">
      <div role="alertdialog" aria-label={`Delete ${name}`} className="w-full max-w-sm rounded-lg p-4"
        style={{ border: `1px solid ${CHALK_RAIL}`, background: '#141414', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
        <div className="text-[22px] mb-1" style={{ fontFamily: TEXT, color: CHALK_CREAM }}>Delete “{name}”?</div>
        <p className="text-sm mb-4" style={{ color: CHALK_DIM }}>
          This removes it from your {noun}, on every device. It cannot be undone.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onConfirm} data-testid="saved-delete-confirm-yes"
            className="flex-1 px-4 py-2 rounded-md min-h-[44px]"
            style={{ fontFamily: TEXT, fontSize: 18, color: '#0a0a0a', background: CHALK_CREAM, border: `1px solid ${CHALK_CREAM}` }}>
            Delete
          </button>
          <button type="button" onClick={onCancel} data-testid="saved-delete-confirm-no"
            className="flex-1 px-4 py-2 rounded-md min-h-[44px]"
            style={{ fontFamily: TEXT, fontSize: 18, color: CHALK_CREAM, border: `1px solid ${CHALK_RAIL}` }}>
            Keep it
          </button>
        </div>
      </div>
    </div>
  );
}
