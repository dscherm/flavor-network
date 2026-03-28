#!/bin/bash
# Validation gates for Flavor Network
# Run before every commit: bash .claude/scripts/gates.sh

set -e

RESULTS_FILE=".claude/gate-results.json"
PASS=true

echo "🔒 Running validation gates..."
echo "{" > "$RESULTS_FILE"

# Gate 0: Lock check
echo "  Gate 0: Lock check..."
if [ -f ".claude/ralph.lock" ]; then
  LOCK_PID=$(cat .claude/ralph.lock)
  if kill -0 "$LOCK_PID" 2>/dev/null; then
    echo "  ❌ Gate 0 FAILED: Another Ralph instance running (PID $LOCK_PID)"
    echo "  \"gate0_lock\": \"FAIL\"," >> "$RESULTS_FILE"
    PASS=false
  else
    rm -f .claude/ralph.lock
    echo "  ✅ Gate 0: Stale lock removed"
    echo "  \"gate0_lock\": \"PASS\"," >> "$RESULTS_FILE"
  fi
else
  echo "  ✅ Gate 0: No lock"
  echo "  \"gate0_lock\": \"PASS\"," >> "$RESULTS_FILE"
fi

# Gate 1: Build check
echo "  Gate 1: Build check..."
if [ -f "package.json" ] && grep -q '"build"' package.json 2>/dev/null; then
  if npm run build --silent 2>&1; then
    echo "  ✅ Gate 1: Build passed"
    echo "  \"gate1_build\": \"PASS\"," >> "$RESULTS_FILE"
  else
    echo "  ❌ Gate 1 FAILED: Build failed"
    echo "  \"gate1_build\": \"FAIL\"," >> "$RESULTS_FILE"
    PASS=false
  fi
else
  echo "  ⏭️ Gate 1: No build script yet, skipping"
  echo "  \"gate1_build\": \"SKIP\"," >> "$RESULTS_FILE"
fi

# Gate 2: Lint check
echo "  Gate 2: Lint check..."
if [ -f "package.json" ] && grep -q '"lint"' package.json 2>/dev/null; then
  if npm run lint --silent 2>&1; then
    echo "  ✅ Gate 2: Lint passed"
    echo "  \"gate2_lint\": \"PASS\"," >> "$RESULTS_FILE"
  else
    echo "  ⚠️ Gate 2: Lint warnings (non-blocking)"
    echo "  \"gate2_lint\": \"WARN\"," >> "$RESULTS_FILE"
  fi
else
  echo "  ⏭️ Gate 2: No lint script yet, skipping"
  echo "  \"gate2_lint\": \"SKIP\"," >> "$RESULTS_FILE"
fi

# Gate 3: Staged files exist on disk
echo "  Gate 3: Staged file check..."
MISSING=""
for f in $(git diff --cached --name-only 2>/dev/null); do
  if [ ! -f "$f" ] && [ ! -d "$f" ]; then
    # Check if it's a deletion (that's OK)
    if git diff --cached --diff-filter=D --name-only | grep -q "^$f$"; then
      continue
    fi
    MISSING="$MISSING $f"
  fi
done
if [ -z "$MISSING" ]; then
  echo "  ✅ Gate 3: All staged files exist"
  echo "  \"gate3_files\": \"PASS\"," >> "$RESULTS_FILE"
else
  echo "  ❌ Gate 3 FAILED: Missing files:$MISSING"
  echo "  \"gate3_files\": \"FAIL\"," >> "$RESULTS_FILE"
  PASS=false
fi

# Gate 4: No console.log in staged changes (warning only)
echo "  Gate 4: Console.log check..."
LOGS=$(git diff --cached --unified=0 2>/dev/null | grep "^+" | grep -c "console\.log" || true)
if [ "$LOGS" -gt 0 ]; then
  echo "  ⚠️ Gate 4: Found $LOGS console.log statements in staged changes"
  echo "  \"gate4_logs\": \"WARN ($LOGS)\"," >> "$RESULTS_FILE"
else
  echo "  ✅ Gate 4: No console.log in staged changes"
  echo "  \"gate4_logs\": \"PASS\"," >> "$RESULTS_FILE"
fi

# Gate 5: Secrets scan (BLOCKING)
echo "  Gate 5: Secrets scan..."
SECRET_PATTERN='AWS_SECRET_ACCESS_KEY|PRIVATE_KEY|api_key\s*=\s*['"'"'"]|password\s*=\s*['"'"'"]|Bearer\s+[A-Za-z0-9._~+/=-]+=*|-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----|sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}'
SECRET_MATCHES=$(git diff --cached -U0 2>/dev/null | grep "^+" | grep -iE "$SECRET_PATTERN" || true)
if [ -n "$SECRET_MATCHES" ]; then
  echo "  ❌ Gate 5 FAILED: Potential secret detected in staged changes"
  # Show redacted matches (replace long alphanumeric runs with ***)
  echo "$SECRET_MATCHES" | sed 's/[A-Za-z0-9_\-]\{12,\}/***/g' | while IFS= read -r line; do
    echo "    $line"
  done
  echo "  \"gate5_secrets\": \"FAIL\"," >> "$RESULTS_FILE"
  PASS=false
else
  echo "  ✅ Gate 5: No secrets detected"
  echo "  \"gate5_secrets\": \"PASS\"," >> "$RESULTS_FILE"
fi

# Gate 6: Staged-file denylist (BLOCKING)
echo "  Gate 6: Staged-file denylist..."
DENIED_FILES=""
for f in $(git diff --cached --name-only 2>/dev/null); do
  basename_f=$(basename "$f")
  case "$basename_f" in
    .env|.env.*) DENIED_FILES="$DENIED_FILES $f" ;;
    *.pem)       DENIED_FILES="$DENIED_FILES $f" ;;
    *.key)       DENIED_FILES="$DENIED_FILES $f" ;;
    credentials.*) DENIED_FILES="$DENIED_FILES $f" ;;
    id_rsa)      DENIED_FILES="$DENIED_FILES $f" ;;
    id_ed25519)  DENIED_FILES="$DENIED_FILES $f" ;;
    *.p12)       DENIED_FILES="$DENIED_FILES $f" ;;
    *.pfx)       DENIED_FILES="$DENIED_FILES $f" ;;
  esac
done
if [ -n "$DENIED_FILES" ]; then
  echo "  ❌ Gate 6 FAILED: Sensitive file staged:"
  for f in $DENIED_FILES; do
    echo "    - $f"
  done
  echo "  \"gate6_denylist\": \"FAIL\"" >> "$RESULTS_FILE"
  PASS=false
else
  echo "  ✅ Gate 6: No sensitive files staged"
  echo "  \"gate6_denylist\": \"PASS\"" >> "$RESULTS_FILE"
fi

echo "}" >> "$RESULTS_FILE"

if [ "$PASS" = true ]; then
  echo ""
  echo "✅ All gates passed!"
  exit 0
else
  echo ""
  echo "❌ One or more blocking gates failed. Fix issues before committing."
  exit 1
fi
