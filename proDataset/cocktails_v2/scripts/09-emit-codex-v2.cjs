#!/usr/bin/env node
/**
 * Cocktail Codex v2 — Phase 7a: emit production data files.
 *
 * Combines all upstream artifacts into the v2 schema consumed by
 * CocktailLab. Applies the user-locked cultural Root overrides and
 * family naming/colors per docs/cocktail-codex-v2/v2.5-impl-spec.md
 * §1.1 + §3.1.
 *
 * Inputs:
 *   proDataset/cocktails_v2/raw/corpus_v3.json
 *   proDataset/cocktails_v2/raw/local_syrups.json
 *   proDataset/cocktails_v2/data/cocktail_clusters.json     (assignments + feature_vectors)
 *   proDataset/cocktails_v2/data/cocktail_engineering.csv
 *
 * Outputs:
 *   public/data/cocktail_codex_v2.json
 *   public/data/cocktail_syrups.json
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const CORPUS_PATH = path.join(ROOT, 'proDataset/cocktails_v2/raw/corpus_v3.json');
const SYRUPS_PATH = path.join(ROOT, 'proDataset/cocktails_v2/raw/local_syrups.json');
const CLUSTERS_PATH = path.join(ROOT, 'proDataset/cocktails_v2/data/cocktail_clusters.json');
const ENG_CSV = path.join(ROOT, 'proDataset/cocktails_v2/data/cocktail_engineering.csv');
const OUT_CODEX = path.join(ROOT, 'public/data/cocktail_codex_v2.json');
const OUT_SYRUPS = path.join(ROOT, 'public/data/cocktail_syrups.json');

// ── User-locked decisions (per impl spec §1.1) ─────────────────────

const CULTURAL_ROOT_OVERRIDE = {
  0: 'Mai Tai',
  1: 'Tom Collins',
  2: 'Daiquiri',
  3: 'Old Fashioned',
  4: 'Negroni',
  // 5: keep math Root (Paloma) — user choice
};

const FAMILY_NAMES = {
  0: 'Tropical Sours',
  1: 'Highballs & Fizzes',
  2: 'Sour Family',
  3: 'Spirit-Forward Built',
  4: 'Stirred & Spirit-Forward',
  5: 'Aperitivos',
};

// Distinct-hue palette across the spectrum — chosen so each pair is
// easily told apart at a glance. Mapped semantically:
//   0 Tropical → emerald-teal (tropical foliage)
//   1 Highballs → sky blue (fizz/long drink)
//   2 Sour → bright yellow (citrus)
//   3 Spirit-forward built → indigo-purple (oak/whiskey depth)
//   4 Stirred & spirit-forward → crimson red (Negroni/Campari)
//   5 Aperitivos → magenta-pink (Campari/Aperol orange-pink)
const FAMILY_COLORS = {
  0: '#10b981', // emerald — tropical
  1: '#0ea5e9', // sky blue — highballs/fizzes
  2: '#facc15', // bright yellow — sour family
  3: '#7c3aed', // indigo — spirit-forward built
  4: '#dc2626', // crimson — stirred & spirit-forward
  5: '#ec4899', // pink — aperitivos
};

// ── Load inputs ────────────────────────────────────────────────────

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function loadEngineering() {
  const lines = fs.readFileSync(ENG_CSV, 'utf-8').split('\n').slice(1);
  const m = new Map();
  for (const line of lines) {
    if (!line.trim()) continue;
    // CSV with quoted fields; simple parse since we control the format
    const match = line.match(/^"([^"]+)","([^"]*)",([^,]*),[^,]*,([^,]*),[^,]*,([^,]*),[^,]*,([^,]*),[^,]*$/);
    if (!match) continue;
    const [, , canonical, build, glass, ice, aer] = match;
    m.set(canonical, {
      build_method: build || null,
      glass_type: glass || null,
      ice_format: ice || null,
      aeration: aer || null,
    });
  }
  return m;
}

// ── Main ───────────────────────────────────────────────────────────

function main() {
  const corpus = loadJson(CORPUS_PATH);
  const syrupsRaw = loadJson(SYRUPS_PATH);
  const clusters = loadJson(CLUSTERS_PATH);
  const eng = loadEngineering();

  const corpusByCanonical = new Map(corpus.cocktails.map((c) => [c.name_canonical, c]));
  const assignmentByCanonical = new Map(
    clusters.assignments.map((a) => [a.canonical, a])
  );

  // Cultural-root override: explicitly mark the named cocktail as
  // is_root=true. The override only applies if the named cocktail is
  // actually in that cluster (per the clustering result). If not,
  // fall back to the math root with a warning so the user can revise.
  const culturalRootByFamily = {};
  for (const [fidStr, override] of Object.entries(CULTURAL_ROOT_OVERRIDE)) {
    const fid = Number(fidStr);
    const overrideEntry = corpus.cocktails.find(
      (c) => c.name === override || c.name_canonical === override.toLowerCase()
    );
    if (!overrideEntry) {
      console.warn(`[fallback] Override "${override}" not in corpus — using math root for cluster ${fid}`);
      continue;
    }
    const assignment = assignmentByCanonical.get(overrideEntry.name_canonical);
    if (!assignment || assignment.cluster !== fid) {
      console.warn(
        `[fallback] Override "${override}" is in cluster ${assignment?.cluster ?? '?'}, not ${fid} — using math root (${clusters.cluster_roots[fid]}) for cluster ${fid}.`
      );
      continue;
    }
    culturalRootByFamily[fid] = overrideEntry.name_canonical;
  }
  // Fill any remaining clusters (no override OR fallback fired) with math root.
  for (const fid of Object.keys(clusters.cluster_roots)) {
    if (culturalRootByFamily[fid] === undefined) {
      const mathRoot = clusters.cluster_roots[fid];
      const mathEntry = corpus.cocktails.find((c) => c.name === mathRoot);
      if (mathEntry) culturalRootByFamily[fid] = mathEntry.name_canonical;
    }
  }

  // Build family entries
  const families = [];
  for (const [fidStr, sig] of Object.entries(clusters.clusters)) {
    const fid = Number(fidStr);
    const culturalCanonical = culturalRootByFamily[fid];
    const culturalEntry = corpus.cocktails.find((c) => c.name_canonical === culturalCanonical);
    families.push({
      id: fid,
      name: FAMILY_NAMES[fid],
      cultural_root: culturalEntry ? culturalEntry.name : (clusters.cluster_roots[fid] || null),
      math_root: clusters.cluster_roots[fid] || null,
      color: FAMILY_COLORS[fid],
      signature: {
        dominant_slots: sig.dominant_slots.map(([slot, ratio]) => ({ slot, ratio })),
        layer_mix: sig.layer_means,
        size: sig.size,
      },
      exemplars: sig.exemplars,
    });
  }
  families.sort((a, b) => a.id - b.id);

  // Build subcluster entries
  const subclusters = [];
  for (const [pidStr, subs] of Object.entries(clusters.subclusters)) {
    const pid = Number(pidStr);
    for (const [sidStr, sd] of Object.entries(subs)) {
      const sid = `${pid}.${sidStr}`;
      subclusters.push({
        id: sid,
        family_id: pid,
        size: sd.size,
        signature: {
          dominant_slots: (sd.dominant_slots || []).map(([slot, ratio]) => ({ slot, ratio })),
        },
        exemplars: sd.exemplars || [],
      });
    }
  }
  subclusters.sort((a, b) => a.id.localeCompare(b.id));

  // Build cocktail entries
  const cocktails = [];
  for (const a of clusters.assignments) {
    const c = corpusByCanonical.get(a.canonical);
    if (!c) continue;
    const culturalRootCanonical = culturalRootByFamily[a.cluster];
    const isRoot = a.canonical === culturalRootCanonical;
    const engRow = eng.get(a.canonical) || {};
    cocktails.push({
      name: c.name,
      canonical: c.name_canonical,
      family_id: a.cluster,
      subcluster_id: a.hierarchy_id,
      is_root: isRoot,
      iba_official: c.iba_official === true,
      iba_category: c.iba_category || null,
      ingredients_raw: c.ingredients_raw || [],
      recipe_text: c.recipe_text || '',
      glass: c.glass || engRow.glass_type || null,
      garnishes: c.garnishes || [],
      build_method: c.build_method || engRow.build_method || null,
      ice_format: engRow.ice_format || null,
      aeration: engRow.aeration || null,
      feature_vector: a.feature_vector || [],
    });
  }

  // Validate one root per family
  const rootsByFamily = {};
  for (const c of cocktails) {
    if (c.is_root) {
      if (rootsByFamily[c.family_id]) {
        console.warn(`Multiple roots for family ${c.family_id}: ${rootsByFamily[c.family_id]} and ${c.name}`);
      }
      rootsByFamily[c.family_id] = c.name;
    }
  }
  for (const fid of [0, 1, 2, 3, 4, 5]) {
    if (!rootsByFamily[fid]) console.warn(`No root cocktail found for family ${fid}`);
  }

  const output = {
    _meta: {
      generatedAt: new Date().toISOString(),
      script: '09-emit-codex-v2.cjs',
      model: clusters._meta.model,
      silhouette: clusters._meta.silhouette,
      near_hit_rate: clusters._meta.near_hit_rate,
      far_hit_rate: clusters._meta.far_hit_rate,
      composite_score: clusters._meta.composite,
      n_cocktails: cocktails.length,
      n_families: families.length,
      n_subclusters: subclusters.length,
      cultural_root_overrides: CULTURAL_ROOT_OVERRIDE,
    },
    families,
    subclusters,
    cocktails,
  };

  fs.writeFileSync(OUT_CODEX, JSON.stringify(output, null, 2));

  // Syrups
  const syrupsOut = {
    _meta: {
      generatedAt: new Date().toISOString(),
      script: '09-emit-codex-v2.cjs',
      count: (syrupsRaw.syrups || []).length,
      note: 'Non-cocktail utility entries. Used as ingredients in cocktails, not as cocktails themselves.',
    },
    syrups: (syrupsRaw.syrups || []).map((s) => ({
      name: s.name,
      canonical: s.name_canonical,
      ingredients_raw: s.ingredients_raw || [],
      recipe_text: s.recipe_text || '',
      garnishes: s.garnishes || [],
    })),
  };
  fs.writeFileSync(OUT_SYRUPS, JSON.stringify(syrupsOut, null, 2));

  console.log(`Wrote ${OUT_CODEX}`);
  console.log(`  families=${families.length} subclusters=${subclusters.length} cocktails=${cocktails.length}`);
  console.log(`  cultural roots:`);
  for (const f of families) {
    console.log(`    ${f.id} ${f.name.padEnd(25)} root: ${f.cultural_root}  (math: ${f.math_root})`);
  }
  console.log(`Wrote ${OUT_SYRUPS} (${syrupsOut.syrups.length} syrups)`);
}

main();
