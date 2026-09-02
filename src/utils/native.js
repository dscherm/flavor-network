/**
 * Haptic helpers — web-only since the v1.0.0 closeout.
 *
 * These used to dynamic-import the Capacitor haptics plugin for the iOS
 * build (now on branch archive/ios). On the web the only haptic surface is
 * the Vibration API, which Android Chrome implements and iOS Safari does
 * not; every call is fire-and-forget and a silent no-op where unsupported,
 * so callers can keep sprinkling them on committed actions without guards.
 */

function vibrate(pattern) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    /* unsupported or blocked — nothing to do */
  }
}

/** Light tap acknowledgement (chip add, mode flip, suggestion accepted). */
export function hapticLight() {
  vibrate(10);
}

/** Committed action (Save Recipe, tile select, handoff to another lab). */
export function hapticMedium() {
  vibrate(20);
}

/** Picker / segmented-control change (filter chips, taste pills). */
export function hapticSelection() {
  vibrate(5);
}
