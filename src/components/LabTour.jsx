/**
 * LabTour — Spec §2.J.
 *
 * Per-lab follow-on tour overlay. Reads stages from `labTourStages.js`
 * keyed by `labKey` ('recipes' | 'cocktail' | 'sauce'). Walks the user
 * through the lab's mechanics via the shared TourPopup component.
 *
 * Activated by the main GuidedTour's chooseLab stage. Self-dismisses
 * after the last stage's "Got it →" button or via the popup ✕.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';
import TourPopup from './TourPopup.jsx';
import { LAB_STAGES } from '../data/labTourStages.js';
import { logTourEvent } from '../data/guidedTourStages.js';

const initial = { stageIdx: 0, exited: false };

function reducer(state, action) {
  switch (action.type) {
    case 'ADVANCE':
      return { ...state, stageIdx: state.stageIdx + 1 };
    case 'SKIP':
      return { ...state, exited: true };
    default:
      return state;
  }
}

export default function LabTour({ labKey, onExit }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const stages = labKey ? LAB_STAGES[labKey] : null;
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (state.stageIdx === 0 && stages) {
      logTourEvent('lab-tour:start', { labKey });
    }
  }, [state.stageIdx, labKey, stages]);

  useEffect(() => {
    if (!stages) return;
    if (state.exited || state.stageIdx >= stages.length) {
      const durMs = Date.now() - startedAt.current;
      logTourEvent('lab-tour:end', { labKey, lastStageIdx: state.stageIdx, durMs });
      onExit?.();
    }
  }, [state.exited, state.stageIdx, stages, labKey, onExit]);

  const handleAdvance = useCallback(() => dispatch({ type: 'ADVANCE' }), []);
  const handleSkip = useCallback(() => {
    logTourEvent('lab-tour:skip', { labKey, idx: state.stageIdx });
    dispatch({ type: 'SKIP' });
  }, [labKey, state.stageIdx]);

  if (!stages || state.exited || state.stageIdx >= stages.length) return null;
  const stage = stages[state.stageIdx];

  return (
    <TourPopup
      stage={stage}
      stageIdx={state.stageIdx}
      totalStages={stages.length}
      onAdvance={handleAdvance}
      onSkip={handleSkip}
    />
  );
}
