/**
 * pairingCardData.js — shared data layer for the rich pairing card
 * (PairingModeCard). Extracted from PairingMode so the Pairing Lab can
 * render the SAME card (analysis, shared compounds, Flavor-Bible badge)
 * on a partner press / focus long-press — without duplicating the
 * compound-lookup + analysis logic.
 */

export function hydrateNode(name, ctx) {
  const node = ctx?.graph?.nodes?.get?.(name);
  if (!node) return { name };
  return node;
}

function tokenizeTaste(t) {
  if (!t || typeof t !== 'string') return [];
  return t.toLowerCase().split(/[\s,/]+/).filter(Boolean);
}

function topCompoundSet(node) {
  const arr = node?.gnnCompounds?.top_compounds;
  if (!Array.isArray(arr)) return null;
  const set = new Set();
  for (const c of arr.slice(0, 5)) {
    const n = typeof c === 'string' ? c : c?.name;
    if (n) set.add(n);
  }
  return set.size > 0 ? set : null;
}

/**
 * Shared aroma compounds between two ingredients.
 *   Pass 1: curated bridge_compounds.json (ctx.bridgeCompoundIndex).
 *   Pass 2: GNN top-5 compound intersection (node.gnnCompounds).
 * Returns string[] of compound names, or null when none.
 */
export function sharedCompoundsFor(focalName, focalNode, otherName, otherNode, ctx) {
  if (!focalName || !otherName) return null;
  const bridgeIdx = ctx?.bridgeCompoundIndex;
  if (bridgeIdx) {
    const entry = bridgeIdx.get?.(`${focalName}|${otherName}`) || bridgeIdx.get?.(`${otherName}|${focalName}`) || null;
    const bridges = entry?.bridges;
    if (Array.isArray(bridges) && bridges.length > 0) {
      const names = bridges.map((b) => (typeof b === 'string' ? b : b?.name)).filter(Boolean);
      if (names.length > 0) return names;
    }
  }
  const focalTop5 = topCompoundSet(focalNode);
  if (!focalTop5) return null;
  const otherTop5 = otherNode?.gnnCompounds?.top_compounds;
  if (!Array.isArray(otherTop5)) return null;
  const shared = [];
  for (const c of otherTop5.slice(0, 5)) {
    const n = typeof c === 'string' ? c : c?.name;
    if (n && focalTop5.has(n)) shared.push(n);
  }
  return shared.length > 0 ? shared : null;
}

/**
 * 1-2 sentence "Pairing analysis": sentence 1 = strength + signal source
 * (chemistry vs co-occurrence), optional sentence 2 = accentuated
 * shared aroma/taste notes. (Moved verbatim from PairingMode.)
 */
export function buildAnalysis(focal, pairingNode, strength, sharedCompounds) {
  if (!focal || !pairingNode || !pairingNode.name) return null;
  const focalName = typeof focal === 'string' ? focal : focal?.name;
  const focalNode = (typeof focal === 'object' && focal && focal.name) ? focal : null;
  const sharedTier1 = (() => {
    const a = focalNode?.flavorGraph?.tier1;
    const b = pairingNode?.flavorGraph?.tier1;
    if (!Array.isArray(a) || !Array.isArray(b)) return [];
    const setB = new Set(b.map((s) => String(s).toLowerCase()));
    return a.filter((s) => setB.has(String(s).toLowerCase()));
  })();
  const sharedTaste = (() => {
    const a = new Set(tokenizeTaste(focalNode?.taste));
    const b = tokenizeTaste(pairingNode?.taste);
    return b.filter((t) => a.has(t));
  })();
  const sharedCuisines = (() => {
    const a = Array.isArray(focalNode?.cuisines) ? focalNode.cuisines : [];
    const b = Array.isArray(pairingNode?.cuisines) ? pairingNode.cuisines : [];
    if (a.length === 0 || b.length === 0) return [];
    const setA = new Set(a.map((s) => String(s).toLowerCase()));
    return b.filter((c) => setA.has(String(c).toLowerCase()));
  })();

  const strengthBand = (() => {
    if (typeof strength !== 'number') return 'modest';
    if (strength >= 0.85) return 'classic';
    if (strength >= 0.65) return 'strong';
    if (strength >= 0.45) return 'workable';
    return 'weak';
  })();
  const hasChem = Array.isArray(sharedCompounds) && sharedCompounds.length > 0;

  let s1;
  if (strengthBand === 'weak') {
    if (hasChem) {
      const noun = `${sharedCompounds.length} shared aroma compound${sharedCompounds.length === 1 ? '' : 's'}`;
      s1 = `${focalName} weakly pairs with ${pairingNode.name}, anchored by ${noun}.`;
    } else if (sharedCuisines.length > 0) {
      const cuisineList = sharedCuisines.slice(0, 3).join(', ');
      s1 = `${focalName} weakly pairs with ${pairingNode.name} through recipe co-occurrence in ${cuisineList} cooking.`;
    } else {
      s1 = `${focalName} weakly pairs with ${pairingNode.name}.`;
    }
  } else if (hasChem) {
    const noun = `${sharedCompounds.length} shared aroma compound${sharedCompounds.length === 1 ? '' : 's'}`;
    s1 = `${focalName} + ${pairingNode.name} is a ${strengthBand} pair, anchored by ${noun}.`;
  } else if (sharedCuisines.length > 0) {
    const cuisineList = sharedCuisines.slice(0, 3).join(', ');
    s1 = `${focalName} + ${pairingNode.name} is a ${strengthBand} pair from recipe co-occurrence in ${cuisineList} cooking.`;
  } else {
    s1 = `${focalName} + ${pairingNode.name} is a ${strengthBand} pair.`;
  }

  let s2 = null;
  const accents = [...new Set([...sharedTier1, ...sharedTaste])].slice(0, 3);
  if (accents.length > 0) {
    s2 = `Pairing accentuates ${accents.join(' + ')} notes.`;
  }
  return s2 ? `${s1} ${s2}` : s1;
}

// Pairing-lab lens → PairingModeCard radar filterType.
const LENS_TO_FILTERTYPE = {
  affinity: 'taste', aroma: 'aroma', taste: 'taste', cuisine: 'cuisine', season: 'season',
};

/**
 * Assemble the props PairingModeCard needs for a given center→partner
 * pairing (or, when partnerName === centerName, the focus ingredient's
 * own profile card — no strength / compounds / analysis).
 */
export function buildPairingCardProps(centerName, partnerName, ctx, { strength = null, lens = 'affinity' } = {}) {
  const node = hydrateNode(partnerName, ctx);
  const isFocus = !centerName || centerName === partnerName;
  const focalNode = isFocus ? null : hydrateNode(centerName, ctx);
  const sharedCompounds = isFocus ? null : sharedCompoundsFor(centerName, focalNode, partnerName, node, ctx);
  const analysis = isFocus ? null : buildAnalysis(focalNode, node, strength, sharedCompounds);
  const fb = (!isFocus && ctx?.flavorBibleSet)
    ? ctx.flavorBibleSet.has(centerName < partnerName ? `${centerName}|${partnerName}` : `${partnerName}|${centerName}`)
    : false;
  return {
    node,
    filterType: LENS_TO_FILTERTYPE[lens] || 'taste',
    chosenAxis: null,
    strength: isFocus ? null : strength,
    sharedCompounds,
    analysis,
    fb,
  };
}
