#!/bin/bash
# Ralph Loop — Autonomous Flavor Network Builder
#
# Usage:
#   bash ralph.sh                  # Run with defaults (unlimited iterations)
#   bash ralph.sh --max 30         # Run with max 30 iterations
#   bash ralph.sh --dry            # Dry run — show what would happen
#
# To stop: Ctrl+C or create .claude/ralph.stop file

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

MAX_ITERATIONS=0
DRY_RUN=false
ITERATION=0

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --max) MAX_ITERATIONS="$2"; shift 2 ;;
    --dry) DRY_RUN=true; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

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

# Set lock
echo $$ > "$LOCK_FILE"
trap "rm -f $LOCK_FILE; echo ''; echo '🛑 Ralph stopped after $ITERATION iterations.'" EXIT

echo "╔══════════════════════════════════════════╗"
echo "║   🧠 Ralph — Flavor Network Builder     ║"
echo "║   Max iterations: ${MAX_ITERATIONS:-unlimited}                  ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# The Loop
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
  echo "  📍 Iteration $ITERATION ($(date '+%H:%M:%S'))"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [ "$DRY_RUN" = true ]; then
    echo "  [DRY RUN] Would execute: cat .claude/PROMPT.md | claude"
    echo "  Sleeping 2s..."
    sleep 2
    continue
  fi

  # Feed the prompt to Claude Code
  # The prompt instructs Claude to:
  #   1. Read fix_plan.md
  #   2. Load memories
  #   3. Pick next task
  #   4. Execute it
  #   5. Validate via gates
  #   6. Commit
  #   7. Check if done
  OUTPUT=$(unset CLAUDECODE; cat .claude/PROMPT.md | claude --print --dangerously-skip-permissions 2>&1) || true

  echo "$OUTPUT" | tail -20

  # Check for completion promise
  if echo "$OUTPUT" | grep -q "<promise>ALL TASKS COMPLETE</promise>"; then
    echo ""
    echo "🎉 All tasks complete! Ralph is done."
    echo "   Total iterations: $ITERATION"
    break
  fi

  # Brief pause between iterations
  echo ""
  echo "  ⏳ Next iteration in 3s... (create .claude/ralph.stop to halt)"
  sleep 3
done
