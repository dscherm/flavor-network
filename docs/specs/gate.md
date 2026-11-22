# gate as-built specs

## GATE-1 — Make the full test run pass first time: find why these tests time out under load and fix the cause

Diagnose before changing anything: run the full suite with vitest's reporter timings and find what the timing-out files have in common (loading the large ingredient and pairing files per test file, heavy component trees, the worker pool oversubscribing a machine with little free memory and a nearly full disk). Then fix the cause, in this order of preference: (1) load big fixtures once and share them (a cached loader or a globalSetup) instead of per test; (2) cap the worker pool in vitest config so the machine is not oversubscribed, if measurements show that is the cause; (3) only then, a longer timeout for the specific files that legitimately do heavy work, set per file with a comment saying why, never a blanket increase that would hide a real hang. No test is skipped, deleted or weakened. Report timings before and after.
