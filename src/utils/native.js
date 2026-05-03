/**
 * Native (Capacitor) helpers — single entry point for iOS-only behavior.
 *
 * Every function here is safe to call from anywhere: when running in a
 * regular browser tab the plugins are absent and the calls become
 * no-ops. We dynamic-import the Capacitor plugins so the web bundle
 * doesn't have to ship them either — Vite tree-shakes the empty path.
 */

let _isNative = null;

export function isNative() {
  if (_isNative !== null) return _isNative;
  // Capacitor injects a global when running inside the WebView; presence
  // of `Capacitor.isNativePlatform()` is the canonical check.
  try {
    _isNative =
      typeof window !== 'undefined' &&
      window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === 'function' &&
      window.Capacitor.isNativePlatform();
  } catch {
    _isNative = false;
  }
  return _isNative;
}

/**
 * Boot-time native setup. Called once from main.jsx after React mounts.
 *  - Hides the launch splash now that the JS is ready to paint.
 *  - Pins the status bar to the dark theme so the iOS notch area
 *    blends with the app's #0a0a0f background.
 */
export async function initNative() {
  if (!isNative()) return;
  try {
    const [{ SplashScreen }, { StatusBar, Style }] = await Promise.all([
      import('@capacitor/splash-screen'),
      import('@capacitor/status-bar'),
    ]);
    await Promise.all([
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {}),
      // Optional: ensure the app paints under the status bar — iOS handles
      // safe-area via env(safe-area-inset-top), so we don't need to push
      // content down here.
      StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {}),
      SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {}),
    ]);
  } catch {
    // Plugin missing in this build — silently skip. Production iOS
    // builds bundle them; web does not.
  }
}

/**
 * Light-impact haptic — for tap acknowledgements (chip add, mode flip,
 * suggestion accepted). Caller doesn't await; we fire-and-forget so a
 * slow plugin call never blocks the interaction.
 */
export function hapticLight() {
  if (!isNative()) return;
  import('@capacitor/haptics')
    .then(({ Haptics, ImpactStyle }) =>
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}),
    )
    .catch(() => {});
}

/**
 * Medium-impact haptic — for committed actions (Save Recipe, mode-select
 * on StartPage, handoff to a different lab).
 */
export function hapticMedium() {
  if (!isNative()) return;
  import('@capacitor/haptics')
    .then(({ Haptics, ImpactStyle }) =>
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}),
    )
    .catch(() => {});
}

/**
 * Selection-change haptic — for picker/segmented-control flips. Cheaper
 * and more subtle than impact() — use for filter chips, taste pills.
 */
export function hapticSelection() {
  if (!isNative()) return;
  import('@capacitor/haptics')
    .then(({ Haptics }) => Haptics.selectionChanged().catch(() => {}))
    .catch(() => {});
}
