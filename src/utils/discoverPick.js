/**
 * discoverPick — choose a "pairing of the day" edge matching a user filter.
 *
 * Filter shapes:
 *   { kind: 'surprise' }               → any strong edge (strength >= 0.6)
 *   { kind: 'taste', value: 'sweet' }  → both endpoints carry the taste token
 *   { kind: 'cuisine', value: 'italian' } → both endpoints list the cuisine
 *
 * Determinism: when `sessionSalt` is not provided, hashes today's date +
 * filter — same user, same day, same filter → same pick. Pass a session
 * counter as `sessionSalt` to regenerate within a session.
 */

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h | 0);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

const MIN_STRENGTH = 0.5;

function matches(edge, nodes, filter) {
  if ((edge.strength || 0) < MIN_STRENGTH) return false;
  if (filter.kind === 'surprise') return true;
  const a = nodes.get(edge.source);
  const b = nodes.get(edge.target);
  if (!a || !b) return false;
  if (filter.kind === 'taste') {
    const v = (filter.value || '').toLowerCase();
    return (a.taste || '').toLowerCase().includes(v) && (b.taste || '').toLowerCase().includes(v);
  }
  if (filter.kind === 'cuisine') {
    const v = (filter.value || '').toLowerCase();
    const ac = (a.cuisines || []).map(c => String(c).toLowerCase());
    const bc = (b.cuisines || []).map(c => String(c).toLowerCase());
    return ac.includes(v) && bc.includes(v);
  }
  return false;
}

export function pickPairing(edges, nodes, filter, sessionSalt = 0) {
  if (!Array.isArray(edges) || edges.length === 0) return null;
  const pool = edges.filter(e => matches(e, nodes, filter));
  if (pool.length === 0) return null;
  const seed = `${todayKey()}|${filter.kind}|${filter.value || ''}|${sessionSalt}`;
  const idx = hash(seed) % pool.length;
  return pool[idx];
}

export { todayKey };
