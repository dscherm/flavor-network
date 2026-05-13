// TODO Phase 4: full implementation of the dual-sentence honest story.
//
// Phase 2 stub. The CuratedWheel component reads this to surface a
// per-pairing "why" headline. The full Phase 4 implementation will:
//   - emit a `causalSentence` grounded in measurable evidence
//     (shared compounds, recipe co-occurrence percentile, ground-truth
//     citation when one exists);
//   - emit an `annotativeSentence` (optional, never substituted as
//     truth) describing what other compound foods the engine *thinks*
//     this pair appears in;
//   - mark `isAnnotativeCompoundUsedByRuntime` if the runtime composed
//     the recommendation from a compound-food synthesis;
//   - attach `citationsIfAny` (e.g. Flavor Bible page refs) when
//     ground truth corroborates;
//   - attach `surpriseAxesMatched` for surprising-tier dots so the
//     story headline can call out which axis flipped (cross-cluster?
//     rare bridge compound? both?).
//
// Until then the placeholder keeps the consumer wiring honest — it
// returns a non-null shape so CuratedWheel's renderer can be exercised
// + tested without coupling Phase 2 work to Phase 4 artifacts.

/**
 * @param {string} a   focal ingredient name
 * @param {string} b   neighbor ingredient name
 * @returns {{
 *   causalSentence: string,
 *   annotativeSentence: string|null,
 *   isAnnotativeCompoundUsedByRuntime: boolean,
 *   citationsIfAny: Array<{source: string, page?: string|number}>,
 *   surpriseAxesMatched: string[],
 * }}
 */
export function whyThisWorks(_a, _b) {
  return {
    causalSentence: 'Engine ranked from recipe co-occurrence.',
    annotativeSentence: null,
    isAnnotativeCompoundUsedByRuntime: false,
    citationsIfAny: [],
    surpriseAxesMatched: [],
  };
}

/**
 * Phase 2 stub helper. CuratedWheel uses this to decide whether a
 * citation chip should render next to a hero pairing. Phase 4 will
 * replace this with a real lookup against ground-truth tables.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function groundTruthHas(_a, _b) {
  return false;
}
