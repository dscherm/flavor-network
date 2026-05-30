/**
 * guidedTourStages.js — declarative tour-stage config for Phase 6
 * (pipeline 2026-05-16).
 *
 * Each entry describes ONE stage of the guided tour: copy, gradient
 * (for visual variety per spec §2K), the advance trigger, and a
 * scene-action hint the controller dispatches to the live scene.
 *
 * The controller (`GuidedTour.jsx`) reads this array via useReducer
 * and dispatches the matching `sceneAction.kind` against an imperative
 * handle on LivingArchView. Scene-control imperatives are best-effort:
 * if a handle method doesn't exist yet (Phase 6.0 not done), the
 * action no-ops and the popup still fires.
 */

export const STAGES = [
  {
    id: 'affinity',
    title: 'Step 1 — Affinity view',
    copy:
      "We've engaged the Affinity view on your focal ingredient. Click and drag (or tap and drag) to orbit the camera. Tap Got it when ready.",
    gradient: 'linear-gradient(135deg, rgba(125,211,252,0.18), rgba(52,211,153,0.18))',
    accent: '#7dd3fc',
    advance: { kind: 'userClick' },
    sceneAction: { kind: 'engageAffinity' },
    popupAnchor: 'tr',
  },
  {
    id: 'pull1',
    title: 'Step 2 — Watch the network morph',
    copy:
      "Now we'll drag the pull-tab from 0 → 100% on your chosen axis. Watch the ingredients snap into their bucket groups. The pull tab is the little slider near the top — try it yourself any time.",
    gradient: 'linear-gradient(135deg, rgba(244,114,182,0.18), rgba(167,139,250,0.18))',
    accent: '#f472b6',
    advance: { kind: 'userClick' },
    sceneAction: { kind: 'animatePull', axis: '__axisFromCtx' },
    popupAnchor: 'tl',
  },
  {
    id: 'pull2',
    title: 'Step 3 — A different lens',
    copy:
      "Same trick, different axis. Each filter (taste / aroma / season / cuisine / family) groups the network around a different signal — toggle them to find unexpected pairings.",
    gradient: 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(244,114,182,0.18))',
    accent: '#fbbf24',
    advance: { kind: 'userClick' },
    sceneAction: { kind: 'animatePull', axis: '__randomAxis' },
    popupAnchor: 'tr',
  },
  {
    id: 'clusters',
    title: 'Step 4 — Recipe clusters',
    copy:
      "With no filter, you're back to the cooccurrence layout. Each cluster grew from how 2.2M recipes use ingredients together — Asian aromatics here, Italian umami there. Watch one pill light up and the camera fly to it.",
    gradient: 'linear-gradient(135deg, rgba(132,204,22,0.18), rgba(34,211,238,0.18))',
    accent: '#84cc16',
    advance: { kind: 'userClick' },
    // Composite: clearFilters first, then runClusterDemo picks a
    // random cluster pill, pulses it, and flies the camera 1.5s later.
    sceneAction: { kind: 'clusterDemo' },
    popupAnchor: 'br',
  },
  {
    id: 'axes',
    title: 'Step 5 — What the 3 axes mean',
    copy:
      "The 3D positions aren't arbitrary — they came from a graph network trained to predict which ingredients pair. After training, each axis roughly tracks a flavor dimension: left↔right runs savory to sweet, up↔down runs heavy to bright, and depth runs cooked to fresh. That's why chef-cognitive clusters (Heats & Sharpens, Smooths & Sweetens, Browns & Glazes, Brightens & Lifts) land in distinct corners.",
    gradient: 'linear-gradient(135deg, rgba(167,139,250,0.18), rgba(56,189,248,0.18))',
    accent: '#a78bfa',
    advance: { kind: 'userClick' },
    sceneAction: { kind: 'noop' },
    popupAnchor: 'tl',
  },
  {
    id: 'ingredients',
    title: 'Step 6 — Pick an ingredient',
    copy:
      "These are the cluster's headliners — the ingredients that define this region of the network. Tap one to fly in for its Affinity view, or pick a lab tour next.",
    gradient: 'linear-gradient(135deg, rgba(56,189,248,0.18), rgba(251,113,133,0.18))',
    accent: '#38bdf8',
    advance: { kind: 'userClick' },
    // Composite: glow 4-6 top ingredients in the cluster picked at
    // stage 4. After 'userClick' advance, engageFinalAffinity pivots
    // to single-node selection on the lead ingredient.
    sceneAction: { kind: 'ingredientGlow' },
    popupAnchor: 'center',
  },
  {
    id: 'chooseLab',
    title: 'Step 7 — Try a Lab tour?',
    copy:
      "Affinity mode is engaged on this ingredient. That's the basics — want to dive into one of the labs next?",
    gradient: 'linear-gradient(135deg, rgba(244,114,182,0.18), rgba(56,189,248,0.18))',
    accent: '#f472b6',
    advance: { kind: 'chooseLab' },        // controller renders 4 pill buttons
    // §2.I.1: drop the multi-node glow + cluster highlight, pivot to
    // single-node AffinityMode on the cluster's lead ingredient. Lets
    // the user start their exploration with focus already engaged.
    sceneAction: { kind: 'engageFinalAffinity' },
    popupAnchor: 'center',
  },
];

export const TOUR_FEATURE_FLAG = 'feature:guided-tour';

export function tourIsEnabled() {
  try {
    return typeof window !== 'undefined' &&
      window.localStorage.getItem(TOUR_FEATURE_FLAG) !== 'off';
  } catch {
    return true;
  }
}

/**
 * Lightweight telemetry sink. Console-only for now; can be replaced
 * with a real analytics integration later. Lets us measure tour
 * completion rate against Critic's threshold concern.
 */
export function logTourEvent(event, payload = {}) {
  try {
    // eslint-disable-next-line no-console
    console.info('[guided-tour]', event, payload);
  } catch {}
}
