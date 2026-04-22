#!/usr/bin/env node
/*
 * Gate script — runs the commit gate (vitest + build) and writes
 * .ralph/last_gate_result.json which the post-commit hook consumes
 * within 10 minutes to mark the observation as `gate: pass`.
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

const ralphDir = path.join(process.cwd(), '.ralph');
if (!fs.existsSync(ralphDir)) fs.mkdirSync(ralphDir, { recursive: true });
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
const tests_ok = run('vitest run src/', 'npx vitest run src/');
checks.tests = { strategy: 'npx vitest run src/', passed: tests_ok };

let build_ok = true;
if (!noBuild) {
  build_ok = run('npm run build', 'npm run build');
  checks.build = { strategy: 'npm run build', passed: build_ok };
}

const passed = tests_ok && build_ok;
const result = {
  result: passed ? 'pass' : 'fail',
  strategy: noBuild ? 'vitest src/' : 'vitest src/ + npm run build',
  checks,
};

fs.writeFileSync(sidecarPath, JSON.stringify(result, null, 2));

if (passed) {
  process.stdout.write('[gate] sidecar written — commit within 10 minutes to record gate: pass\n');
  process.exit(0);
} else {
  process.stdout.write('[gate] gate FAILED — fix before committing. Sidecar written with result: fail\n');
  process.exit(1);
}
