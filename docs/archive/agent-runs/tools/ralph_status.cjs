const fs = require('fs');
const path = require('path');

// Read metrics
const metricsPath = path.join(__dirname, '..', '.ralph', 'metrics.jsonl');
let metrics = [];
if (fs.existsSync(metricsPath)) {
  metrics = fs.readFileSync(metricsPath, 'utf-8')
    .split('\n')
    .filter(l => l.trim())
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

// Read all plan files
const loops = {};
const rootDir = path.join(__dirname, '..');
const dirs = fs.readdirSync(rootDir).filter(d => d.endsWith('-ralph') && fs.statSync(path.join(rootDir, d)).isDirectory());
for (const dir of dirs) {
  const planPath = path.join(rootDir, dir, 'plan.md');
  if (fs.existsSync(planPath)) {
    const lines = fs.readFileSync(planPath, 'utf-8').split('\n').filter(l => l.trim());
    const total = lines.length;
    const done = lines.filter(l => l.includes('"passes": true') || l.includes('"passes":true')).length;
    loops[dir] = { total, done, remaining: total - done };
  }
}

// Compute metrics stats
const durations = metrics.map(m => m.duration_s).filter(Boolean);
const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
const gatePass = metrics.filter(m => m.gate_result === 'pass').length;
const gateFail = metrics.filter(m => m.gate_result !== 'pass').length;
const passRate = metrics.length ? Math.round(gatePass / metrics.length * 100) : 0;

// Anomalies
const anomalies = [];
if (avgDuration > 0) {
  metrics.forEach((m, i) => {
    if (m.duration_s > avgDuration * 2) anomalies.push(`Iteration ${m.iteration}: ${m.duration_s}s (>2x avg ${avgDuration}s)`);
    if (m.files_changed === 0) anomalies.push(`Iteration ${m.iteration}: 0 files changed`);
  });
}

// Output
// Support --oneline flag
const oneline = process.argv.includes('--oneline');
if (oneline) {
  const totalTasks = Object.values(loops).reduce((a, l) => a + l.total, 0);
  const doneTasks = Object.values(loops).reduce((a, l) => a + l.done, 0);
  console.log(`${metrics.length} iterations | ${doneTasks}/${totalTasks} tasks | avg ${avgDuration}s | gate ${passRate}% pass`);
} else {
  // full output
  console.log('Ralph Status Dashboard');
  console.log('='.repeat(50));
  console.log(`Iterations: ${metrics.length}`);
  console.log(`Avg duration: ${avgDuration}s`);
  console.log(`Gate pass rate: ${passRate}% (${gatePass} pass, ${gateFail} fail)`);
  console.log('');
  console.log('Task Progress:');
  for (const [name, data] of Object.entries(loops).sort()) {
    console.log(`  ${name.padEnd(22)} ${data.done}/${data.total} (${data.remaining} remaining)`);
  }
  if (anomalies.length) {
    console.log('');
    console.log('Anomalies:');
    anomalies.forEach(a => console.log(`  !!  ${a}`));
  }
}
