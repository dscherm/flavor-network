/**
 * categoricalAxes.js — bucket-assignment + colors for the 4 new
 * categorical Network views (Aromas / Cuisine / Season / Family).
 *
 * Each axis exposes:
 *   - bucketLabels: ordered array of bucket display names
 *   - bucketColors: parallel array of hex strings (1:1 with labels)
 *   - bucketOf(node, dataCtx): returns the bucket label this ingredient
 *     belongs to, or null when it doesn't fit any bucket
 *
 * `dataCtx` is { node, gnnEntropy, cuisineMap, seasonMap }
 * supplied at lookup time. Buckets are deliberately small so the
 * resulting wheel layouts stay readable.
 */

// ----- Aromas (6 odor families from gnn_entropy.json) -----------
const AROMA_KEYS = ['odor_fruity', 'odor_floral', 'odor_green', 'odor_woody', 'odor_spicy', 'odor_fatty'];
const AROMA_LABELS = ['Fruity', 'Floral', 'Green', 'Woody', 'Spicy', 'Fatty'];
const AROMA_COLORS = ['#fb923c', '#f0abfc', '#84cc16', '#a16207', '#dc2626', '#fbbf24'];

/**
 * Compute corpus mean for each aroma channel. The GNN entropy
 * model is systematically biased — without normalizing against
 * the corpus mean, ~92% of ingredients land in "Woody" because
 * woody scores are universally inflated. Subtracting the mean
 * picks the odor each ingredient deviates MOST positively from
 * baseline, which yields a balanced distribution.
 */
function aromaCorpusMeans(gnnEntropy) {
  const sums = new Array(AROMA_KEYS.length).fill(0);
  let n = 0;
  for (const name of Object.keys(gnnEntropy || {})) {
    const probs = gnnEntropy[name]?.probs;
    if (!probs) continue;
    let any = false;
    for (let i = 0; i < AROMA_KEYS.length; i++) {
      const v = probs[AROMA_KEYS[i]];
      if (typeof v === 'number') { sums[i] += v; any = true; }
    }
    if (any) n++;
  }
  if (n === 0) return new Array(AROMA_KEYS.length).fill(0);
  return sums.map((s) => s / n);
}

function aromaBucket(node, ctx) {
  const probs = ctx?.gnnEntropy?.[node.name]?.probs;
  if (!probs) return null;
  const means = ctx._aromaMeans || (ctx._aromaMeans = aromaCorpusMeans(ctx.gnnEntropy));
  let bestIdx = -1;
  let bestDelta = -Infinity;
  for (let i = 0; i < AROMA_KEYS.length; i++) {
    const v = probs[AROMA_KEYS[i]];
    if (typeof v !== 'number') continue;
    const delta = v - means[i];
    if (delta > bestDelta) { bestDelta = delta; bestIdx = i; }
  }
  // Drop ingredients that are below-average across every channel —
  // these are genuinely uninformative and shouldn't be force-bucketed.
  if (bestIdx < 0 || bestDelta <= 0) return null;
  return AROMA_LABELS[bestIdx];
}

// ----- Cuisine ---------------------------------------------------
// Map raw cuisine strings to broad regional buckets so the wheel
// has a manageable bucket count (>15 distinct cuisines is too many
// to read on a small wheel).
const CUISINE_BUCKETS = [
  { label: 'Global',       color: '#94a3b8', match: ['Global'] },
  { label: 'European',     color: '#3b82f6', match: ['French', 'Italian', 'Mediterranean', 'Spanish', 'Greek', 'Portuguese', 'German', 'British', 'Eastern European', 'Russian', 'Scandinavian'] },
  { label: 'Americas',     color: '#ef4444', match: ['American', 'Mexican', 'Latin American', 'Caribbean', 'South American', 'Peruvian', 'Argentine', 'Brazilian', 'Cajun', 'Tex-Mex', 'Southern'] },
  { label: 'East Asian',   color: '#f59e0b', match: ['Chinese', 'Japanese', 'Korean', 'Asian'] },
  { label: 'SE Asian',     color: '#22c55e', match: ['Thai', 'Vietnamese', 'Filipino', 'Indonesian', 'Malaysian'] },
  { label: 'South Asian',  color: '#a855f7', match: ['Indian', 'Pakistani', 'Sri Lankan', 'Bangladeshi'] },
  { label: 'Middle Eastern', color: '#ec4899', match: ['Middle Eastern', 'Turkish', 'Lebanese', 'Persian', 'Israeli', 'Moroccan', 'North African'] },
  { label: 'African',      color: '#0ea5e9', match: ['African', 'West African', 'East African', 'Ethiopian'] },
];
const CUISINE_LABELS = CUISINE_BUCKETS.map((b) => b.label);
const CUISINE_COLORS = CUISINE_BUCKETS.map((b) => b.color);
const CUISINE_LOOKUP = new Map();
for (const b of CUISINE_BUCKETS) {
  for (const m of b.match) CUISINE_LOOKUP.set(m.toLowerCase(), b.label);
}

function cuisineBucket(node, ctx) {
  const list = ctx?.cuisineMap?.[node.name] || node.cuisines || [];
  if (!Array.isArray(list) || list.length === 0) return null;
  // Pick the first cuisine that maps to a known bucket. Skip 'Global'
  // unless it's the only entry — region is more interesting than the
  // catch-all when we have a real region.
  let fallback = null;
  for (const c of list) {
    const bucket = CUISINE_LOOKUP.get(String(c).toLowerCase());
    if (bucket && bucket !== 'Global') return bucket;
    if (bucket === 'Global') fallback = bucket;
  }
  return fallback;
}

// ----- Season ---------------------------------------------------
// season_region.json values are strings like "spring", "spring-summer",
// "year-round". Bucket to 4 quarters; year-round → "All Year".
const SEASON_LABELS = ['Spring', 'Summer', 'Autumn', 'Winter', 'All Year'];
const SEASON_COLORS = ['#86efac', '#fde047', '#fb923c', '#7dd3fc', '#cbd5e1'];

function seasonBucket(node, ctx) {
  const raw = ctx?.seasonMap?.[node.name]?.season;
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (s.includes('year')) return 'All Year';
  if (s.includes('spring')) return 'Spring';
  if (s.includes('summer')) return 'Summer';
  if (s.includes('autumn') || s.includes('fall')) return 'Autumn';
  if (s.includes('winter')) return 'Winter';
  return null;
}

// ----- Family (culinary category) -------------------------------
// Uses the existing `category` field on every ingredient node.
// Order is a rough plate-composition order (proteins → veg → … → sweets)
// so the wheel reads coherently.
const FAMILY_BUCKETS = [
  { label: 'Protein',     color: '#dc2626' },
  { label: 'Dairy',       color: '#fde68a' },
  { label: 'Fat',         color: '#fbbf24' },
  { label: 'Vegetable',   color: '#22c55e' },
  { label: 'Fruit',       color: '#f472b6' },
  { label: 'Grain',       color: '#b45309' },
  { label: 'Herb',        color: '#84cc16' },
  { label: 'Spice',       color: '#ea580c' },
  { label: 'Aromatic',    color: '#a855f7' },
  { label: 'Sweetener',   color: '#fb7185' },
  { label: 'Other',       color: '#64748b' },
];
const FAMILY_LABELS = FAMILY_BUCKETS.map((b) => b.label);
const FAMILY_COLORS = FAMILY_BUCKETS.map((b) => b.color);
const FAMILY_LOOKUP = new Map(FAMILY_LABELS.map((l) => [l.toLowerCase(), l]));

function familyBucket(node) {
  const cat = String(node.category || '').toLowerCase();
  if (!cat) return null;
  const direct = FAMILY_LOOKUP.get(cat);
  if (direct) return direct;
  // Lightweight aliases for tags that don't match the bucket list verbatim
  if (cat === 'meat' || cat === 'fish' || cat === 'seafood' || cat === 'egg' || cat === 'legume') return 'Protein';
  if (cat === 'cheese') return 'Dairy';
  if (cat === 'oil' || cat === 'butter') return 'Fat';
  if (cat === 'bread' || cat === 'pasta') return 'Grain';
  if (cat === 'sauce' || cat === 'condiment') return 'Other';
  return 'Other';
}

// ----- Taste (8 GPCR-mediated + perceptual taste classes) ------
// Mirrors the ClusterJoystick TASTE_COLORS palette so the joystick
// pills, the sub-disc nodes, and any future legend stay coherent.
const TASTE_LABELS = ['Sweet', 'Sour', 'Bitter', 'Salty', 'Umami', 'Spicy', 'Pungent', 'Astringent'];
const TASTE_COLORS = ['#ff4fb8', '#00ffd0', '#9d4edd', '#4f9eff', '#ffd700', '#ff4444', '#ff8c42', '#6bcb77'];
const TASTE_KEYS   = ['sweet',  'sour',  'bitter', 'salty', 'umami', 'spicy', 'pungent', 'astringent'];

// node.taste in the ProData ingredients export is a space-delimited
// STRING listing every taste tag the curators flagged ("sour sweet",
// "pungent salty", just "umami", etc.) — NOT a per-taste probability
// map. Pick the first tag from the string that matches one of our
// 8 buckets; if there's only a multi-tag string, the first listed
// tag is treated as dominant. Falls back to scanning each key when
// upstream data ever switches to an object/probabilities shape.
function tasteBucket(node) {
  const raw = node?.taste;
  if (!raw) return null;
  if (typeof raw === 'string') {
    const tokens = raw.toLowerCase().split(/\s+/).filter(Boolean);
    for (const tok of tokens) {
      const idx = TASTE_KEYS.indexOf(tok);
      if (idx >= 0) return TASTE_LABELS[idx];
    }
    return null;
  }
  if (typeof raw === 'object') {
    let bestIdx = -1;
    let bestVal = 0;
    for (let i = 0; i < TASTE_KEYS.length; i++) {
      const v = raw[TASTE_KEYS[i]];
      if (typeof v === 'number' && v > bestVal) { bestVal = v; bestIdx = i; }
    }
    return bestIdx >= 0 ? TASTE_LABELS[bestIdx] : null;
  }
  return null;
}

// ---------- Public registry --------------------------------------
export const CATEGORICAL_AXES = {
  aromas:  { labels: AROMA_LABELS,   colors: AROMA_COLORS,   bucketOf: aromaBucket },
  cuisine: { labels: CUISINE_LABELS, colors: CUISINE_COLORS, bucketOf: cuisineBucket },
  season:  { labels: SEASON_LABELS,  colors: SEASON_COLORS,  bucketOf: seasonBucket },
  family:  { labels: FAMILY_LABELS,  colors: FAMILY_COLORS,  bucketOf: familyBucket },
  taste:   { labels: TASTE_LABELS,   colors: TASTE_COLORS,   bucketOf: tasteBucket  },
};

/**
 * Bucket every node under a given axis. Returns a Map<name, label>
 * plus the per-bucket member arrays for layout.
 */
export function bucketAllNodes(axisKey, nodes, ctx = {}) {
  const axis = CATEGORICAL_AXES[axisKey];
  if (!axis) return { bucketOf: new Map(), byBucket: new Map() };
  const bucketOf = new Map();
  const byBucket = new Map();
  for (const label of axis.labels) byBucket.set(label, []);
  for (const node of nodes.values()) {
    const label = axis.bucketOf(node, ctx);
    if (!label) continue;
    bucketOf.set(node.name, label);
    if (!byBucket.has(label)) byBucket.set(label, []);
    byBucket.get(label).push(node.name);
  }
  return { bucketOf, byBucket, axis };
}
