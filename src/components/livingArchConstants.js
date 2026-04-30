// --- Constants for Living Architecture views ---

export const TASTE_ORDER = ['sweet','sour','bitter','salty','umami','spicy','pungent','astringent'];
export const TASTE_HEX = {
  sweet:'#fb92b4', sour:'#fde047', bitter:'#a78bfa', salty:'#93c5fd',
  umami:'#f9a870', spicy:'#f87171', pungent:'#b48c64', astringent:'#4ade80',
};
export const CATEGORY_RADII = {
  protein:40, meat:40, seafood:38, dairy:32, vegetable:35, fruit:30,
  herb:28, spice:25, grain:33, nut:27, condiment:22, oil:20, default:30,
};
export const TRANSITION_DURATION = 1500; // ms
export const POPOUT_DURATION = 800; // ms for taste pop-out animation
export const POPOUT_HEIGHT = 15; // units above/below wheel

// CameraAnimator (R14 camera-animations plan) — v2 ships the
// continuous-orbit cluster tour on by default after live-test
// feedback ("we need it to rotate around the model"). Toggle via
// URL: `?cameraAnim=v1` (force on) or `?cameraAnim=off` (force off).
export const CAMERA_ANIMATOR_DEFAULT_ON = true;
