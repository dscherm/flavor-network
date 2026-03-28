#!/usr/bin/env node
/**
 * prepare_context.cjs — Extract slim context files for Ralph iterations.
 *
 * Reads fix_plan.md + *-ralph/plan.md + activity.md and produces:
 *   .ralph/pending_tasks.md   — pending/in-progress items only
 *   .ralph/recent_activity.md — last 5 activity entries
 *
 * Node.js stdlib only (no dependencies).
 */

const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const RALPH_DIR = path.join(PROJECT_DIR, '.ralph');

// Ensure .ralph/ exists
if (!fs.existsSync(RALPH_DIR)) {
  fs.mkdirSync(RALPH_DIR, { recursive: true });
}

// ── 1. Pending tasks from fix_plan.md ───────────────────────────────

const pendingLines = [];

const fixPlanPath = path.join(PROJECT_DIR, '.claude', 'fix_plan.md');
if (fs.existsSync(fixPlanPath)) {
  const lines = fs.readFileSync(fixPlanPath, 'utf-8').split('\n');
  const filtered = lines.filter(line => /\[ \]|\[>\]/.test(line));
  if (filtered.length > 0) {
    pendingLines.push('## fix_plan.md — pending/in-progress');
    pendingLines.push('');
    pendingLines.push(...filtered);
    pendingLines.push('');
  }
}

// ── 2. Failing gates from *-ralph/plan.md ───────────────────────────

const globDirs = fs.readdirSync(PROJECT_DIR).filter(name => {
  return name.endsWith('-ralph') && fs.statSync(path.join(PROJECT_DIR, name)).isDirectory();
});

for (const dir of globDirs) {
  const planPath = path.join(PROJECT_DIR, dir, 'plan.md');
  if (!fs.existsSync(planPath)) continue;

  const lines = fs.readFileSync(planPath, 'utf-8').split('\n');
  const failing = lines.filter(line => /"passes"\s*:\s*false/.test(line));
  if (failing.length > 0) {
    pendingLines.push(`## ${dir}/plan.md — failing gates`);
    pendingLines.push('');
    pendingLines.push(...failing);
    pendingLines.push('');
  }
}

fs.writeFileSync(
  path.join(RALPH_DIR, 'pending_tasks.md'),
  pendingLines.join('\n') + '\n',
  'utf-8'
);

// ── 3. Recent activity (last 5 ## entries) ──────────────────────────

const activityPath = path.join(PROJECT_DIR, 'activity.md');
let recentContent = '';

if (fs.existsSync(activityPath)) {
  const text = fs.readFileSync(activityPath, 'utf-8');
  // Split on ## headings (keep heading with its body)
  const entries = [];
  let current = null;
  for (const line of text.split('\n')) {
    if (/^## /.test(line)) {
      if (current !== null) entries.push(current);
      current = line + '\n';
    } else if (current !== null) {
      current += line + '\n';
    }
  }
  if (current !== null) entries.push(current);

  // Take last 5
  const last5 = entries.slice(-5);
  recentContent = last5.join('\n');
}

fs.writeFileSync(
  path.join(RALPH_DIR, 'recent_activity.md'),
  recentContent + '\n',
  'utf-8'
);

console.log('prepare_context: wrote .ralph/pending_tasks.md and .ralph/recent_activity.md');
