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

# ── Preset resolver ──────────────────────────────────────────────
resolve_preset() {
  case "$1" in
    default)    echo ".claude/PROMPT.md" ;;
    ingredient) echo "ingredient-ralph/prompt.md" ;;
    cleanup)    echo "cleanup-ralph/prompt.md" ;;
    refactor)   echo "refactor-ralph/prompt.md" ;;
    cocktail)   echo "cocktail-ralph/prompt.md" ;;
    sauce)      echo "sauce-ralph/prompt.md" ;;
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
    *)            echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# Handle status/list commands
if [ "$DO_STATUS" = true ]; then show_status; exit 0; fi
if [ "$DO_LIST" = true ]; then list_presets; exit 0; fi

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

# Set lock
echo $$ > "$LOCK_FILE"
trap "rm -f $LOCK_FILE; echo ''; echo '🛑 Ralph stopped after $ITERATION iterations.'" EXIT

echo "╔══════════════════════════════════════════╗"
echo "║   🧠 Ralph — Flavor Network Builder     ║"
echo "║   Preset: $(printf '%-29s' "$PRESET")║"
echo "║   Prompt: $(printf '%-29s' "$PROMPT_FILE")║"
echo "║   Max iterations: $(printf '%-21s' "${MAX_ITERATIONS:-unlimited}")║"
echo "╚══════════════════════════════════════════╝"
echo ""

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

  if [ "$DRY_RUN" = true ]; then
    echo "  [DRY RUN] Would execute: cat $PROMPT_FILE | claude"
    echo "  Sleeping 2s..."
    sleep 2
    continue
  fi

  # Feed the prompt to Claude Code
  OUTPUT=$(unset CLAUDECODE; cat "$PROMPT_FILE" | claude --print --dangerously-skip-permissions 2>&1) || true

  echo "$OUTPUT" | tail -20

  # Check for completion promise
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>\|<promise>ALL TASKS COMPLETE</promise>"; then
    echo ""
    echo "🎉 All tasks complete for preset '$PRESET'!"
    echo "   Total iterations: $ITERATION"
    break
  fi

  # Check for blocked
  if echo "$OUTPUT" | grep -q "<promise>BLOCKED"; then
    echo ""
    echo "⚠️  Preset '$PRESET' is BLOCKED."
    echo "$OUTPUT" | grep "<promise>BLOCKED"
    break
  fi

  # Brief pause between iterations
  echo ""
  echo "  ⏳ Next iteration in 3s... (create .claude/ralph.stop to halt)"
  sleep 3
done
