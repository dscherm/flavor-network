#!/usr/bin/env node
/*
 * Gate script — runs the commit gate (full vitest suite + build).
 *
 * Runs the whole suite that vitest.config.js declares (src/ AND
 * chemDataset/validation/). It used to run `vitest run src/`, which silently
 * skipped 4 files / 21 tests — found at the v1.0.0 closeout.
 *
 * When the repo is enrolled in the schermness harness (.schermness/ exists)
 * it also writes .ralph/last_gate_result.json, which the post-commit hook
 * consumes within 10 minutes to mark the observation as `gate: pass`.
 * Outside the harness the sidecar is skipped: this is a plain project script.
 *
 * Usage:
 *   node scripts/gate.cjs            # run, write sidecar, exit 0 on pass
 *   node scripts/gate.cjs --no-build # tests only (faster, no prod bundle)
 *
 * Typical dev flow:
 *   npm run gate && git commit -m "feat: ..."
 *
 * If this script is skipped before commit, the observation falls back to
 * `gate: stale` — accurate signal that no gate was run.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = new Set(process.argv.slice(2));
const noBuild = args.has('--no-build');

const harnessEnrolled = fs.existsSync(path.join(process.cwd(), '.schermness'));
const ralphDir = path.join(process.cwd(), '.ralph');
const sidecarPath = path.join(ralphDir, 'last_gate_result.json');

function run(label, cmd) {
  process.stdout.write(`[gate] ${label}… `);
  const start = Date.now();
  try {
    execSync(cmd, { stdio: ['ignore', 'ignore', 'pipe'] });
    const dur = ((Date.now() - start) / 1000).toFixed(1);
    process.stdout.write(`pass (${dur}s)\n`);
    return true;
  } catch (e) {
    const dur = ((Date.now() - start) / 1000).toFixed(1);
    process.stdout.write(`FAIL (${dur}s)\n`);
    const stderr = (e.stderr || e.stdout || '').toString().slice(-1500);
    if (stderr) process.stderr.write(stderr + '\n');
    return false;
  }
}

const checks = {};
const tests_ok = run('vitest run', 'npx vitest run');
checks.tests = { strategy: 'npx vitest run', passed: tests_ok };

let build_ok = true;
if (!noBuild) {
  build_ok = run('npm run build', 'npm run build');
  checks.build = { strategy: 'npm run build', passed: build_ok };
}

const passed = tests_ok && build_ok;
const result = {
  result: passed ? 'pass' : 'fail',
  strategy: noBuild ? 'vitest' : 'vitest + npm run build',
  checks,
};

if (harnessEnrolled) {
  if (!fs.existsSync(ralphDir)) fs.mkdirSync(ralphDir, { recursive: true });
  fs.writeFileSync(sidecarPath, JSON.stringify(result, null, 2));
}
const sidecarNote = harnessEnrolled ? ' Sidecar written.' : '';

if (passed) {
  process.stdout.write(`[gate] GATE PASSED.${sidecarNote}
`);
  process.exit(0);
} else {
  process.stdout.write(`[gate] GATE FAILED — fix before committing.${sidecarNote}
`);
  process.exit(1);
}
