/**
 * cocktailCodexV2.js — loader + similarity engine for the data-driven
 * Cocktail Lab v2 taxonomy.
 *
 * Replaces the legacy `cocktailCodex.js` (which parsed the *Cocktail
 * Codex* book's 7 archetypes) with the 6-family / 12-sub-cluster
 * model from `cocktail_codex_v2.json` (see
 * `docs/cocktail-codex-v2/v2.5-impl-spec.md`).
 *
 * Core exports:
 *   - loadCodexV2(rawJson) → normalized graph + lookup
 *   - cocktailSimilarity(a, b) → cosine of feature vectors
 *   - placeFamilyOnSphere(idx, total=6) → 3D coords on a Fibonacci lattice
 */

const FAMILY_RADIUS = 55; // sphere shell — pulled in from 70 (2026-05-08) so the cocktail families read as a tight constellation; further reductions risk Sour (N=149, baseDisc≈49) overlapping its neighbors so 55 is the floor without also tightening discRadius
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// ── Loader ─────────────────────────────────────────────────────────

export function loadCodexV2(raw) {
  if (!raw || !Array.isArray(raw.cocktails) || !Array.isArray(raw.families)) {
    return null;
  }
  const families = raw.families.map((f) => ({ ...f }));
  const subclusters = raw.subclusters || [];
  const cocktails = raw.cocktails.map((c) => ({ ...c }));

  // Index by canonical name for O(1) lookup
  const byCanonical = new Map(cocktails.map((c) => [c.canonical, c]));
  const byFamily = new Map();
  for (const c of cocktails) {
    const arr = byFamily.get(c.family_id) || [];
    arr.push(c);
    byFamily.set(c.family_id, arr);
  }
  const bySub = new Map();
  for (const c of cocktails) {
    const arr = bySub.get(c.subcluster_id) || [];
    arr.push(c);
    bySub.set(c.subcluster_id, arr);
  }

  // Family Roots (cultural override) — one per family
  const rootByFamily = new Map();
  for (const c of cocktails) {
    if (c.is_root) rootByFamily.set(c.family_id, c);
  }

  // 3D positions on Fibonacci sphere — families = sphere shell,
  // sub-clusters = inner orbits within each family disc.
  for (const f of families) {
    f.position = placeFamilyOnSphere(f.id, families.length);
  }

  return {
    meta: raw._meta || {},
    families,
    subclusters,
    cocktails,
    byCanonical,
    byFamily,
    bySub,
    rootByFamily,
  };
}

// ── 3D layout ──────────────────────────────────────────────────────

/**
 * Distribute n family centroids on a Fibonacci-sphere lattice.
 * Stable across re-runs (deterministic in `idx`/`total`), and visually
 * pleasing (no clustering at poles).
 */
export function placeFamilyOnSphere(idx, total = 6, radius = FAMILY_RADIUS) {
  const i = idx + 0.5;
  const phi = Math.acos(1 - (2 * i) / total);
  const theta = GOLDEN_ANGLE * idx;
  return {
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

/**
 * Lay out cocktails as a planar disc relative to the family centroid.
 * The disc's normal points away from the sphere centre, and members
 * spiral outward by golden-angle increments. Sub-clusters share a disc
 * but ride concentric rings at different radii.
 */
export function placeCocktailInFamily(member, family, members, opts = {}) {
  // discRadius scales by sqrt(N/30) — keeps cocktails-per-volume
  // roughly constant so densest clusters don't overlap each other.
  // Pulled inward by 0.65 so the ring sits well inside the disc and
  // leaves the centroid (where the 2× cultural Root lives) breathing
  // room. User feedback 2026-05-07: rings were too wide, nodes too
  // small relative to ring; pulled tighter so the ROOT reads as the
  // anchor and the cluster reads as a 3D structure not a Saturn ring.
  const N = members.length;
  const baseDisc = opts.discRadius ?? Math.max(18, 22 * Math.sqrt(N / 30));
  const RING_PULL = 0.65;          // 0–1: how far IN from disc edge the rings sit
  const discRadius = baseDisc * RING_PULL;
  // Cultural Root sits at the family centroid (rendered 2× larger
  // via scaleBoost — see CocktailLabV2.jsx).
  if (member.is_root || member.isRoot) {
    return { x: family.position.x, y: family.position.y, z: family.position.z };
  }
  // Group non-root members by sub-cluster id.
  const subGroups = new Map();
  for (const m of members) {
    if (m.is_root || m.isRoot) continue;
    const arr = subGroups.get(m.subcluster_id) || [];
    arr.push(m);
    subGroups.set(m.subcluster_id, arr);
  }
  const subIds = [...subGroups.keys()].sort();
  const subIdx = subIds.indexOf(member.subcluster_id);
  const subMembers = subGroups.get(member.subcluster_id) || [member];
  const memberIdx = subMembers.findIndex((m) => m.canonical === member.canonical);
  // Ring radius decays slightly per sub so inner rings sit closer to
  // root, outer further — keeps the 3D structure legible at a glance.
  const ringR = Math.max(discRadius * 0.55, discRadius - subIdx * 4);
  const angle = (memberIdx / subMembers.length) * Math.PI * 2;
  // Family radial basis.
  const fx = family.position.x;
  const fy = family.position.y;
  const fz = family.position.z;
  const len = Math.hypot(fx, fy, fz) || 1;
  const nx = fx / len, ny = fy / len, nz = fz / len;
  // Tangent basis (u, v) perpendicular to (n).
  const ax = Math.abs(nx) < 0.9 ? 1 : 0;
  const ay = Math.abs(nx) < 0.9 ? 0 : 1;
  const ux = ny * 0 - nz * ay;
  const uy = nz * ax - nx * 0;
  const uz = nx * ay - ny * ax;
  const ulen = Math.hypot(ux, uy, uz) || 1;
  const ub = [ux / ulen, uy / ulen, uz / ulen];
  const vb = [ny * ub[2] - nz * ub[1], nz * ub[0] - nx * ub[2], nx * ub[1] - ny * ub[0]];
  // Multi-plane rings: each sub-cluster sits on a plane PERPENDICULAR
  // to its sibling sub-clusters' planes, so a family with 3 subs reads
  // as 3 interlocking rings (think armillary sphere, not a single
  // Saturn disc). Cycle through 3 plane orientations as subIdx grows.
  //   0 → tangent disc (u, v)              — equator
  //   1 → meridian containing u + n        — vertical ring through poles
  //   2 → meridian containing v + n        — perpendicular vertical ring
  const planeIdx = subIdx % 3;
  let aBasis, bBasis;
  if (planeIdx === 0) { aBasis = ub; bBasis = vb; }
  else if (planeIdx === 1) { aBasis = ub; bBasis = [nx, ny, nz]; }
  else { aBasis = vb; bBasis = [nx, ny, nz]; }
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const dx = aBasis[0] * cos * ringR + bBasis[0] * sin * ringR;
  const dy = aBasis[1] * cos * ringR + bBasis[1] * sin * ringR;
  const dz = aBasis[2] * cos * ringR + bBasis[2] * sin * ringR;
  return { x: fx + dx, y: fy + dy, z: fz + dz };
}

function simpleStringHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

// ── Similarity ────────────────────────────────────────────────────

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function cocktailSimilarity(a, b) {
  return cosine(a?.feature_vector, b?.feature_vector);
}

/**
 * Top-K most similar cocktails to `target`.
 * Within-family weight: amplify same-family matches (inner-orbit cousins).
 * Cross-family weight: surface "interesting bridge" connections at
 * lower priority — e.g. Manhattan ↔ Rob Roy live across the family
 * boundary by design.
 */
export function topSimilar(target, allCocktails, k = 5, opts = {}) {
  const { withinFamily = true, includeAcrossFamily = false } = opts;
  if (!target?.feature_vector) return [];
  const scored = [];
  for (const c of allCocktails) {
    if (c.canonical === target.canonical) continue;
    if (withinFamily && c.family_id !== target.family_id && !includeAcrossFamily) continue;
    const sim = cocktailSimilarity(target, c);
    if (sim > 0.55) scored.push({ cocktail: c, similarity: sim });
  }
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
}

/**
 * Cocktails outside `target`'s family but with high cosine — the
 * "where this cocktail breaks ranks" surface. Bounded to k=3 by default.
 */
export function crossFamilySimilar(target, allCocktails, k = 3) {
  if (!target?.feature_vector) return [];
  const scored = [];
  for (const c of allCocktails) {
    if (c.canonical === target.canonical) continue;
    if (c.family_id === target.family_id) continue;
    const sim = cocktailSimilarity(target, c);
    if (sim > 0.55) scored.push({ cocktail: c, similarity: sim });
  }
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
}

// ── Utility ───────────────────────────────────────────────────────

export function getFamilyById(graph, fid) {
  return graph?.families.find((f) => f.id === fid) || null;
}

export function getCocktailByCanonical(graph, canonical) {
  return graph?.byCanonical.get(canonical) || null;
}

export function getFamilyMembers(graph, fid) {
  return graph?.byFamily.get(fid) || [];
}

export function getSubClusterMembers(graph, subId) {
  return graph?.bySub.get(subId) || [];
}

export function getRootForFamily(graph, fid) {
  return graph?.rootByFamily.get(fid) || null;
}
