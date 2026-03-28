#!/bin/bash
# Ralph Loop — Autonomous Flavor Network Builder
#
# Usage:
#   bash ralph.sh                        # Run default (main loop)
#   bash ralph.sh --preset ingredient    # Run ingredient-ralph loop
#   bash ralph.sh --max 30               # Cap iterations
#   bash ralph.sh --dry                  # Dry run
#   bash ralph.sh --status               # Show progress across all loops
#   bash ralph.sh --list-presets         # Show available presets
#   bash ralph.sh --chain ingredient     # Run presets in sequence
#   bash ralph.sh --timeout 900          # Per-iteration timeout (seconds)
#   bash ralph.sh --force                # Skip safety checks (dirty tree, main branch)
#   bash ralph.sh --plan                 # Read-only codebase analysis (writes fix_plan_analysis.md)
#
# To stop: Ctrl+C or create .claude/ralph.stop file

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

MAX_ITERATIONS=0
DRY_RUN=false
ITERATION=0
PRESET="default"
CHAIN=()
DO_STATUS=false
DO_LIST=false
TIMEOUT=1800
FORCE=false
DO_PLAN=false

# ── Preset resolver ──────────────────────────────────────────────
resolve_preset() {
  case "$1" in
    default)    echo ".claude/PROMPT.md" ;;
    ingredient) echo "ingredient-ralph/prompt.md" ;;
    cleanup)    echo "cleanup-ralph/prompt.md" ;;
    refactor)   echo "refactor-ralph/prompt.md" ;;
    cocktail)   echo "cocktail-ralph/prompt.md" ;;
    sauce)      echo "sauce-ralph/prompt.md" ;;
    harness)    echo "harness-ralph/prompt.md" ;;
    *)          echo "" ;;
  esac
}

# ── Status dashboard ─────────────────────────────────────────────
show_status() {
  echo "╔══════════════════════════════════════════╗"
  echo "║   📊 Ralph — Progress Dashboard         ║"
  echo "╚══════════════════════════════════════════╝"
  echo ""

  # Main loop (fix_plan.md)
  if [ -f ".claude/fix_plan.md" ]; then
    local total=$(grep -c '^\- \[' .claude/fix_plan.md 2>/dev/null | tr -d ' \r\n' || echo 0)
    local done=$(grep -c '^\- \[x\]' .claude/fix_plan.md 2>/dev/null | tr -d ' \r\n' || echo 0)
    local remain=$((total - done))
    echo "  Main Loop:       $done/$total ($remain remaining)"
  fi

  # Mini-ralph loops
  for dir in *-ralph/; do
    [ -d "$dir" ] || continue
    local name="${dir%/}"
    local plan="$dir/plan.md"
    if [ -f "$plan" ]; then
      local total=$(wc -l < "$plan" | tr -d ' \r\n')
      local done=$(grep -c '"passes": true' "$plan" 2>/dev/null | tr -d ' \r\n' || echo 0)
      local remain=$((total - done))
      printf "  %-18s %d/%d (%d remaining)\n" "${name}:" "$done" "$total" "$remain"
    fi
  done

  # Enhanced dashboard via Node.js
  if [ -f "tools/ralph_status.cjs" ]; then
    echo ""
    node tools/ralph_status.cjs
  fi

  echo ""
}

# ── List presets ─────────────────────────────────────────────────
list_presets() {
  echo "Available presets:"
  echo "  default      → .claude/PROMPT.md (main loop)"
  for dir in *-ralph/; do
    [ -d "$dir" ] || continue
    local name="${dir%-ralph/}"
    local prompt="$dir/prompt.md"
    if [ -f "$prompt" ]; then
      local desc=$(head -1 "$prompt" | sed 's/^# //')
      printf "  %-12s → %s (%s)\n" "$name" "$prompt" "$desc"
    fi
  done
}

# ── Parse args ───────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --preset)     PRESET="$2"; shift 2 ;;
    --max)        MAX_ITERATIONS="$2"; shift 2 ;;
    --dry)        DRY_RUN=true; shift ;;
    --status)     DO_STATUS=true; shift ;;
    --list-presets) DO_LIST=true; shift ;;
    --chain)      shift; while [[ $# -gt 0 && ! "$1" =~ ^-- ]]; do CHAIN+=("$1"); shift; done ;;
    --timeout)    TIMEOUT="$2"; shift 2 ;;
    --force)      FORCE=true; shift ;;
    --plan)       DO_PLAN=true; shift ;;
    *)            echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# Handle status/list commands
if [ "$DO_STATUS" = true ]; then show_status; exit 0; fi
if [ "$DO_LIST" = true ]; then list_presets; exit 0; fi

# Handle plan mode
if [ "$DO_PLAN" = true ]; then
  echo "📋 Plan mode — read-only analysis"
  OUTPUT=$(unset CLAUDECODE; cat PLAN_PROMPT.md | claude --print --dangerously-skip-permissions 2>&1) || true
  echo "$OUTPUT" | tail -30
  if echo "$OUTPUT" | grep -q "<promise>PLAN_COMPLETE</promise>"; then
    echo ""
    echo "Plan analysis complete. See fix_plan_analysis.md"
  fi
  exit 0
fi

# Handle chain mode
if [ ${#CHAIN[@]} -gt 0 ]; then
  echo "🔗 Chain mode: ${CHAIN[*]}"
  for p in "${CHAIN[@]}"; do
    echo ""
    echo "━━━ Starting preset: $p ━━━"
    bash "$0" --preset "$p" --max "${MAX_ITERATIONS:-0}"
  done
  echo ""
  echo "🏁 Chain complete."
  show_status
  exit 0
fi

# Resolve prompt file
PROMPT_FILE=$(resolve_preset "$PRESET")
if [ -z "$PROMPT_FILE" ] || [ ! -f "$PROMPT_FILE" ]; then
  echo "❌ Unknown preset '$PRESET' or prompt file not found."
  echo "   Run: bash ralph.sh --list-presets"
  exit 1
fi

# Lock file to prevent concurrent loops
LOCK_FILE=".claude/ralph.lock"
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE")
  if kill -0 "$LOCK_PID" 2>/dev/null; then
    echo "❌ Another Ralph instance is running (PID $LOCK_PID)"
    echo "   Kill it with: kill $LOCK_PID"
    exit 1
  else
    echo "⚠️  Removing stale lock file"
    rm -f "$LOCK_FILE"
  fi
fi

# ── Startup safety checks ───────────────────────────────────────
# Dirty tree check
DIRTY=$(git status --porcelain 2>/dev/null | grep -v '^??' | head -5)
if [ -n "$DIRTY" ] && [ "$FORCE" != true ]; then
  echo "WARNING: Working tree has uncommitted changes:"
  echo "$DIRTY"
  echo "   Commit or stash changes, or use --force to override."
  exit 1
fi

# Main branch warning
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [[ "$BRANCH" == "main" || "$BRANCH" == "master" ]] && [ "$FORCE" != true ]; then
  echo "WARNING: Running on '$BRANCH' branch. Consider using a feature branch."
  echo "   Use --force to override."
  exit 1
fi

# Ensure .ralph directory exists and metrics file
mkdir -p .ralph
touch .ralph/metrics.jsonl

# Set lock
echo $$ > "$LOCK_FILE"
trap "rm -f $LOCK_FILE; echo ''; echo '🛑 Ralph stopped after $ITERATION iterations.'" EXIT

echo "╔══════════════════════════════════════════╗"
echo "║   🧠 Ralph — Flavor Network Builder     ║"
echo "║   Preset: $(printf '%-29s' "$PRESET")║"
echo "║   Prompt: $(printf '%-29s' "$PROMPT_FILE")║"
echo "║   Max iterations: $(printf '%-21s' "${MAX_ITERATIONS:-unlimited}")║"
echo "║   Timeout/iter:   $(printf '%-21s' "${TIMEOUT}s")║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Consecutive failure tracking ─────────────────────────────────
CONSECUTIVE_FAILURES=0
LAST_GATE_HASH=""
SAME_ERROR_COUNT=0

# ── The Loop ─────────────────────────────────────────────────────
while true; do
  ITERATION=$((ITERATION + 1))

  # Check stop file
  if [ -f ".claude/ralph.stop" ]; then
    echo "🛑 Stop file detected. Exiting."
    rm -f ".claude/ralph.stop"
    break
  fi

  # Check max iterations
  if [ "$MAX_ITERATIONS" -gt 0 ] && [ "$ITERATION" -gt "$MAX_ITERATIONS" ]; then
    echo "🏁 Max iterations ($MAX_ITERATIONS) reached."
    break
  fi

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  📍 [$PRESET] Iteration $ITERATION ($(date '+%H:%M:%S'))"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Start iteration timer
  ITER_START=$(date +%s)

  # Prepare slim context files for this iteration
  node tools/prepare_context.cjs

  if [ "$DRY_RUN" = true ]; then
    echo "  [DRY RUN] Would execute: cat $PROMPT_FILE | claude"
    echo "  Sleeping 2s..."
    sleep 2
    continue
  fi

  # Feed the prompt to Claude Code (with optional timeout)
  TIMED_OUT=false
  if command -v timeout &>/dev/null; then
    OUTPUT=$(unset CLAUDECODE; cat "$PROMPT_FILE" | timeout "${TIMEOUT}s" claude --print --dangerously-skip-permissions 2>&1) || {
      EXIT_CODE=$?
      # Exit code 124 = timeout killed the process
      if [ "$EXIT_CODE" -eq 124 ]; then
        TIMED_OUT=true
      fi
    }
  else
    OUTPUT=$(unset CLAUDECODE; cat "$PROMPT_FILE" | claude --print --dangerously-skip-permissions 2>&1) || true
  fi

  echo "$OUTPUT" | tail -20

  # Handle timeout
  if [ "$TIMED_OUT" = true ]; then
    echo ""
    echo "TIMEOUT: Agent exceeded ${TIMEOUT}s for iteration $ITERATION"
    echo "TIMEOUT: Agent exceeded ${TIMEOUT}s at iteration $ITERATION ($(date '+%Y-%m-%d %H:%M:%S'))" > .ralph/gate_failure.md
    # Record timeout metrics
    ITER_END=$(date +%s)
    DURATION=$((ITER_END - ITER_START))
    FILES_CHANGED=$(git diff --name-only HEAD~1 2>/dev/null | wc -l | tr -d ' \r\n')
    echo "{\"iteration\":$ITERATION,\"preset\":\"$PRESET\",\"duration_s\":$DURATION,\"gate_result\":\"timeout\",\"files_changed\":$FILES_CHANGED,\"timestamp\":\"$(date -Iseconds)\"}" >> .ralph/metrics.jsonl
    echo ""
    echo "  Next iteration in 3s... (create .claude/ralph.stop to halt)"
    sleep 3
    continue
  fi

  # Check for completion promise
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>\|<promise>ALL TASKS COMPLETE</promise>"; then
    echo ""
    echo "All tasks complete for preset '$PRESET'!"
    echo "   Total iterations: $ITERATION"
    break
  fi

  # Check for blocked
  if echo "$OUTPUT" | grep -q "<promise>BLOCKED"; then
    echo ""
    echo "Preset '$PRESET' is BLOCKED."
    echo "$OUTPUT" | grep "<promise>BLOCKED"
    break
  fi

  # ── Gate execution (harness-level) ──────────────────────────────
  echo "  Running gates..."
  GATE_OUTPUT=$(bash .claude/scripts/gates.sh 2>&1) && GATE_EXIT=0 || GATE_EXIT=$?
  if [ "$GATE_EXIT" -ne 0 ]; then
    echo "  Gate FAILED (exit $GATE_EXIT):"
    echo "$GATE_OUTPUT" | tail -10
    echo "$GATE_OUTPUT" > .ralph/gate_failure.md
    # ── Consecutive failure tracking ──
    CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
    if [ "$CONSECUTIVE_FAILURES" -ge 3 ]; then
      echo "  WARNING: $CONSECUTIVE_FAILURES consecutive gate failures. Consider stopping."
    fi
    # ── Repeated error detection (same hash 3x = auto-BLOCKED) ──
    GATE_HASH=$(echo "$GATE_OUTPUT" | md5sum | cut -d' ' -f1)
    if [ "$GATE_HASH" = "$LAST_GATE_HASH" ]; then
      SAME_ERROR_COUNT=$((SAME_ERROR_COUNT + 1))
    else
      SAME_ERROR_COUNT=1
    fi
    LAST_GATE_HASH="$GATE_HASH"
    if [ "$SAME_ERROR_COUNT" -ge 3 ]; then
      echo "  Same gate error 3 times. Auto-BLOCKED."
      break
    fi
  else
    echo "  Gates passed."
    > .ralph/gate_failure.md
    CONSECUTIVE_FAILURES=0
    LAST_GATE_HASH=""
    SAME_ERROR_COUNT=0
  fi

  # ── Metrics tracking ──────────────────────────────────────────────
  ITER_END=$(date +%s)
  DURATION=$((ITER_END - ITER_START))
  FILES_CHANGED=$(git diff --name-only HEAD~1 2>/dev/null | wc -l | tr -d ' \r\n')
  if [ "$GATE_EXIT" -eq 0 ]; then
    GATE_RESULT="pass"
  else
    GATE_RESULT="fail"
  fi
  echo "{\"iteration\":$ITERATION,\"preset\":\"$PRESET\",\"duration_s\":$DURATION,\"gate_result\":\"$GATE_RESULT\",\"files_changed\":$FILES_CHANGED,\"timestamp\":\"$(date -Iseconds)\"}" >> .ralph/metrics.jsonl

  # Brief pause between iterations
  echo ""
  echo "  Next iteration in 3s... (create .claude/ralph.stop to halt)"
  sleep 3
done
