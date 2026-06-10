/**
 * GuidedTour — Phase 6 (pipeline 2026-05-16).
 *
 * Reducer-driven tour controller. Reads STAGES from
 * `guidedTourStages.js` and walks the user through each stage's
 * popup. Advance triggers vary per stage: auto-timeout, user click,
 * double-tap, or "choose a lab" 4-pill picker (final stage).
 *
 * Communicates with the live scene best-effort: when an
 * imperativeHandle is wired to LivingArchView, the controller
 * dispatches scene actions there; otherwise actions no-op and the
 * popup-only experience still works.
 *
 * Gated by `tourIsEnabled()` (localStorage feature flag).
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { STAGES, logTourEvent, tourIsEnabled } from '../data/guidedTourStages.js';
import TourPopup from './TourPopup.jsx';

const initial = {
  stageIdx: 0,
  exited: false,
};

// GD-TOUR-COPY-MATCH (2026-05-30): the 5 real CATEGORICAL_AXES keys are
// taste / aromas / season / cuisine / family. 'aroma' here gets remapped
// to 'aromas' by App.jsx animatePull. The prior pool listed 'method'
// which has no matching axis — the second pull animation silently
// no-op'd whenever the random picker landed on it.
const AXIS_POOL = ['taste', 'aroma', 'season', 'cuisine', 'family'];

// Pick a random axis from the pool that differs from `excludeAxis`.
// Falls back to 'taste' if excludeAxis isn't in the pool.
function resolveRandomAxis(excludeAxis) {
  const remaining = AXIS_POOL.filter((a) => a !== excludeAxis);
  if (remaining.length === 0) return 'taste';
  return remaining[Math.floor(Math.random() * remaining.length)];
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADVANCE':
      if (state.stageIdx + 1 >= STAGES.length) {
        return { ...state, exited: true };
      }
      return { ...state, stageIdx: state.stageIdx + 1 };
    case 'SKIP':
      return { ...state, exited: true };
    case 'RESET':
      return { ...initial };
    default:
      return state;
  }
}

export default function GuidedTour({
  axis = 'taste',           // entry axis from radar click
  onExit,                   // called when user advances past last stage or skips
  onPickLab,                // (labKey: 'recipes' | 'cocktail' | 'sauce' | 'done') => void
  // Imperative handle into LivingArchView (Phase 6.0). When present,
  // scene actions dispatch through it. When absent, controller still
  // runs the popup sequence.
  sceneHandle = null,
  // Optional radar focal name — engageAffinity stage uses this.
  focalName = null,
  // GD-TOUR-AXIS-INTENT-CARRY: the specific axis label the user
  // tapped on the radar (e.g. 'sweet') and the focal's bucket on
  // the morph axis (e.g. 'umami'). Both null when the tour entered
  // without an explicit axis pick (e.g. 'Explore in network' CTA).
  chosenAxisKey = null,
  focalBucket = null,
  // GD-TOUR-STEP4-CLARITY: name of the cluster runClusterDemo just
  // pulsed. Used on Step 4's popup so the call-to-action names the
  // specific pill the user should watch for.
  pickedClusterName = null,
}) {
  const [state, dispatch] = useReducer(reducer, initial);
  const stage = STAGES[state.stageIdx] || null;
  const startedAt = useRef(Date.now());

  // Resolve __randomAxis ONCE per tour run so the user sees the same
  // "different lens" axis throughout the pull2 stage even if the
  // component re-renders mid-animation. Pool excludes the entry axis.
  const randomAxis = useMemo(() => resolveRandomAxis(axis), [axis]);

  // Telemetry on mount + each stage advance.
  useEffect(() => {
    if (state.stageIdx === 0) {
      logTourEvent('tour:start', { axis, focalName });
    } else if (stage) {
      logTourEvent('tour:advance', { stageId: stage.id, idx: state.stageIdx });
    }
  }, [state.stageIdx, stage, axis, focalName]);

  // Dispatch sceneAction when stage changes — best-effort imperative
  // calls into LivingArchView. If `sceneHandle` is null (Phase 6.0
  // imperative API not extracted yet) actions are skipped.
  useEffect(() => {
    if (!stage || !sceneHandle) return;
    const { kind } = stage.sceneAction || {};
    try {
      if (kind === 'engageAffinity' && focalName && sceneHandle.engageAffinity) {
        sceneHandle.engageAffinity(focalName);
      } else if (kind === 'animatePull' && sceneHandle.animatePull) {
        const declared = stage.sceneAction.axis;
        const useAxis =
          declared === '__axisFromCtx' ? axis
          : declared === '__randomAxis' ? randomAxis
          : (declared || 'taste');
        sceneHandle.animatePull(useAxis);
      } else if (kind === 'clearFilters' && sceneHandle.clearFilters) {
        sceneHandle.clearFilters();
      } else if (kind === 'clusterDemo' && sceneHandle.runClusterDemo) {
        // Stage 4: clearFilters first so the layout settles, then run
        // the highlight + fly choreography from the handle. clearFilters
        // mutates a ref that runClusterDemo reads; running both in the
        // same tick reads the stale pre-clear ref and the demo silently
        // no-ops. Defer the demo a tick so clearFilters lands first.
        sceneHandle.clearFilters?.();
        setTimeout(() => sceneHandle.runClusterDemo(), 0);
      } else if (kind === 'ingredientGlow' && sceneHandle.runIngredientGlow) {
        sceneHandle.runIngredientGlow();
      } else if (kind === 'engageFinalAffinity' && sceneHandle.engageFinalAffinity) {
        sceneHandle.engageFinalAffinity();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[GuidedTour] sceneAction failed', kind, err);
    }
  }, [stage, sceneHandle, focalName, axis, randomAxis]);

  // GD-TOUR-MANUAL-ADVANCE (2026-05-30): tour advance is exclusively
  // user-driven (Got it button on the popup, or the 4-pill lab picker
  // on the final stage). The prior auto-timeout + dblclick listeners
  // were removed — every stage waits for explicit user input now.

  // Final exit — emit completion telemetry, call onExit.
  useEffect(() => {
    if (!state.exited) return;
    const durMs = Date.now() - startedAt.current;
    logTourEvent('tour:end', { lastStageIdx: state.stageIdx, durMs });
    onExit?.();
  }, [state.exited, state.stageIdx, onExit]);

  const handleAdvance = useCallback(() => dispatch({ type: 'ADVANCE' }), []);
  const handleSkip = useCallback(() => {
    logTourEvent('tour:skip', { stageId: stage?.id, idx: state.stageIdx });
    dispatch({ type: 'SKIP' });
  }, [stage, state.stageIdx]);

  // Hard gate: feature flag.
  if (!tourIsEnabled() || state.exited || !stage) return null;

  const isLabPicker = stage.advance?.kind === 'chooseLab';

  // Per-stage dynamic context line, rendered below the static copy:
  //  - 'affinity' (GD-TOUR-AXIS-INTENT-CARRY): names the focal's
  //     bucket on the morph axis AND the user-tapped sub-axis, so
  //     "I picked sweet" connects with "tomato is umami, sweet
  //     pairings cluster at the sweet pole."
  //  - 'clusters' (GD-TOUR-STEP4-CLARITY): names the specific
  //     cluster pill runClusterDemo just pulsed (or a generic
  //     fallback before the pick lands).
  let extraContext = null;
  if (stage.id === 'affinity' && focalName && focalBucket && chosenAxisKey) {
    extraContext = `${focalName} sits in the ${focalBucket} bucket on the ${axis} axis. The ${chosenAxisKey} pairings you tapped will pull toward the ${chosenAxisKey} pole — look there for compatible ${chosenAxisKey} ingredients.`;
  } else if (stage.id === 'clusters') {
    const target = pickedClusterName
      ? `the ${pickedClusterName} pill`
      : 'one of the cluster pills';
    extraContext = `Watch ${target} in the cluster joystick at the bottom of the network light up — that's where the camera is flying.`;
  }

  return (
    <TourPopup
      stage={stage}
      stageIdx={state.stageIdx}
      totalStages={STAGES.length}
      showLabPicks={isLabPicker}
      extraContext={extraContext}
      onAdvance={handleAdvance}
      onSkip={handleSkip}
      onPickLab={(labKey) => {
        logTourEvent('tour:pick-lab', { labKey });
        onPickLab?.(labKey);
        dispatch({ type: 'SKIP' });
      }}
    />
  );
}
