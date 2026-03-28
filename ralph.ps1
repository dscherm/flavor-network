# Ralph Loop - Autonomous Flavor Network Builder (PowerShell)
#
# Usage:
#   .\ralph.ps1                          # Run default (main loop)
#   .\ralph.ps1 -Preset ingredient       # Run ingredient-ralph loop
#   .\ralph.ps1 -Max 30                  # Cap iterations
#   .\ralph.ps1 -Dry                     # Dry run
#   .\ralph.ps1 -Status                  # Show progress across all loops
#   .\ralph.ps1 -ListPresets             # Show available presets
#   .\ralph.ps1 -Timeout 900            # Per-iteration timeout (seconds)
#   .\ralph.ps1 -Force                   # Skip safety checks
#   .\ralph.ps1 -Plan                    # Read-only codebase analysis
#
# To stop: Ctrl+C or create .claude/ralph.stop file

[CmdletBinding()]
param(
    [string]$Preset = "default",
    [int]$Max = 0,
    [switch]$Dry,
    [switch]$Status,
    [switch]$ListPresets,
    [int]$Timeout = 1800,
    [switch]$Force,
    [switch]$Plan
)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

# ── Preset resolver ──────────────────────────────────────────────
function Resolve-Preset {
    param([string]$Name)
    switch ($Name) {
        "default"    { return ".claude/PROMPT.md" }
        "ingredient" { return "ingredient-ralph/prompt.md" }
        "cleanup"    { return "cleanup-ralph/prompt.md" }
        "refactor"   { return "refactor-ralph/prompt.md" }
        "cocktail"   { return "cocktail-ralph/prompt.md" }
        "sauce"      { return "sauce-ralph/prompt.md" }
        "harness"    { return "harness-ralph/prompt.md" }
        default      { return "" }
    }
}

# ── Status dashboard ─────────────────────────────────────────────
function Show-Status {
    Write-Host "================================================"
    Write-Host "   Ralph - Progress Dashboard"
    Write-Host "================================================"
    Write-Host ""

    # Main loop (fix_plan.md)
    if (Test-Path ".claude/fix_plan.md") {
        $lines = Get-Content ".claude/fix_plan.md"
        $total = ($lines | Select-String '^\- \[' | Measure-Object).Count
        $done = ($lines | Select-String '^\- \[x\]' | Measure-Object).Count
        $remain = $total - $done
        Write-Host "  Main Loop:       $done/$total ($remain remaining)"
    }

    # Mini-ralph loops
    Get-ChildItem -Directory -Filter "*-ralph" | ForEach-Object {
        $name = $_.Name
        $planPath = Join-Path $_.FullName "plan.md"
        if (Test-Path $planPath) {
            $planLines = Get-Content $planPath | Where-Object { $_.Trim() -ne "" }
            $total = $planLines.Count
            $done = ($planLines | Select-String '"passes":\s*true' | Measure-Object).Count
            $remain = $total - $done
            Write-Host ("  {0,-18} {1}/{2} ({3} remaining)" -f "${name}:", $done, $total, $remain)
        }
    }

    Write-Host ""

    # Enhanced dashboard via Node.js
    if (Test-Path "tools/ralph_status.cjs") {
        node tools/ralph_status.cjs
    }
}

# ── List presets ─────────────────────────────────────────────────
function Show-Presets {
    Write-Host "Available presets:"
    Write-Host "  default      -> .claude/PROMPT.md (main loop)"
    Get-ChildItem -Directory -Filter "*-ralph" | ForEach-Object {
        $name = $_.Name -replace '-ralph$', ''
        $promptPath = Join-Path $_.FullName "prompt.md"
        if (Test-Path $promptPath) {
            $desc = (Get-Content $promptPath -TotalCount 1) -replace '^# ', ''
            Write-Host ("  {0,-12} -> {1} ({2})" -f $name, $promptPath, $desc)
        }
    }
}

# Handle status/list commands
if ($Status) { Show-Status; exit 0 }
if ($ListPresets) { Show-Presets; exit 0 }

# Handle plan mode
if ($Plan) {
    Write-Host "Plan mode - read-only analysis"
    $output = Get-Content "PLAN_PROMPT.md" | & claude --print --dangerously-skip-permissions 2>&1
    $output | Select-Object -Last 30
    if ($output -match "<promise>PLAN_COMPLETE</promise>") {
        Write-Host ""
        Write-Host "Plan analysis complete. See fix_plan_analysis.md"
    }
    exit 0
}

# Resolve prompt file
$PromptFile = Resolve-Preset $Preset
if (-not $PromptFile -or -not (Test-Path $PromptFile)) {
    Write-Host "Unknown preset '$Preset' or prompt file not found."
    Write-Host "   Run: .\ralph.ps1 -ListPresets"
    exit 1
}

# Lock file to prevent concurrent loops
$LockFile = ".claude/ralph.lock"
if (Test-Path $LockFile) {
    $lockPid = Get-Content $LockFile -Raw | ForEach-Object { $_.Trim() }
    try {
        $proc = Get-Process -Id $lockPid -ErrorAction Stop
        Write-Host "Another Ralph instance is running (PID $lockPid)"
        Write-Host "   Kill it with: Stop-Process -Id $lockPid"
        exit 1
    } catch {
        Write-Host "Removing stale lock file"
        Remove-Item -Force $LockFile
    }
}

# ── Startup safety checks ───────────────────────────────────────
# Dirty tree check
$dirty = git status --porcelain 2>$null | Where-Object { $_ -notmatch '^\?\?' } | Select-Object -First 5
if ($dirty -and -not $Force) {
    Write-Host "WARNING: Working tree has uncommitted changes:"
    $dirty | ForEach-Object { Write-Host "  $_" }
    Write-Host "   Commit or stash changes, or use -Force to override."
    exit 1
}

# Main branch warning
$branch = git rev-parse --abbrev-ref HEAD 2>$null
if (($branch -eq "main" -or $branch -eq "master") -and -not $Force) {
    Write-Host "WARNING: Running on '$branch' branch. Consider using a feature branch."
    Write-Host "   Use -Force to override."
    exit 1
}

# Ensure .ralph directory exists and metrics file
if (-not (Test-Path ".ralph")) { New-Item -ItemType Directory -Path ".ralph" | Out-Null }
if (-not (Test-Path ".ralph/metrics.jsonl")) { New-Item -ItemType File -Path ".ralph/metrics.jsonl" | Out-Null }

# Set lock
$PID | Out-File -FilePath $LockFile -NoNewline

# Cleanup on exit
$cleanupBlock = {
    Remove-Item -Force $LockFile -ErrorAction SilentlyContinue
}

try {
    Write-Host "================================================"
    Write-Host "   Ralph - Flavor Network Builder"
    Write-Host ("   Preset: {0}" -f $Preset)
    Write-Host ("   Prompt: {0}" -f $PromptFile)
    Write-Host ("   Max iterations: {0}" -f $(if ($Max -gt 0) { $Max } else { "unlimited" }))
    Write-Host ("   Timeout/iter:   {0}s" -f $Timeout)
    Write-Host "================================================"
    Write-Host ""

    $iteration = 0

    # ── The Loop ─────────────────────────────────────────────────────
    while ($true) {
        $iteration++

        # Check stop file
        if (Test-Path ".claude/ralph.stop") {
            Write-Host "Stop file detected. Exiting."
            Remove-Item -Force ".claude/ralph.stop"
            break
        }

        # Check max iterations
        if ($Max -gt 0 -and $iteration -gt $Max) {
            Write-Host "Max iterations ($Max) reached."
            break
        }

        Write-Host "=========================================="
        Write-Host ("  [{0}] Iteration {1} ({2})" -f $Preset, $iteration, (Get-Date -Format "HH:mm:ss"))
        Write-Host "=========================================="

        # Start iteration timer
        $iterStart = Get-Date

        if ($Dry) {
            Write-Host "  [DRY RUN] Would execute: cat $PromptFile | claude"
            Write-Host "  Sleeping 2s..."
            Start-Sleep -Seconds 2
            continue
        }

        # Feed the prompt to Claude Code
        $timedOut = $false
        try {
            $job = Start-Job -ScriptBlock {
                param($promptFile, $projectDir)
                Set-Location $projectDir
                $env:CLAUDECODE = $null
                Get-Content $promptFile | & claude --print --dangerously-skip-permissions 2>&1
            } -ArgumentList $PromptFile, $ProjectDir

            $completed = Wait-Job $job -Timeout $Timeout
            if ($null -eq $completed) {
                $timedOut = $true
                Stop-Job $job
                Remove-Job $job -Force
                $output = ""
            } else {
                $output = Receive-Job $job
                Remove-Job $job
            }
        } catch {
            $output = $_.Exception.Message
        }

        if ($output) {
            ($output -split "`n") | Select-Object -Last 20
        }

        # Handle timeout
        if ($timedOut) {
            Write-Host ""
            Write-Host "TIMEOUT: Agent exceeded ${Timeout}s for iteration $iteration"
            "TIMEOUT: Agent exceeded ${Timeout}s at iteration $iteration ($(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))" | Out-File ".ralph/gate_failure.md"

            $iterEnd = Get-Date
            $duration = [math]::Round(($iterEnd - $iterStart).TotalSeconds)
            $filesChanged = (git diff --name-only HEAD~1 2>$null | Measure-Object).Count
            $metric = @{iteration=$iteration; preset=$Preset; duration_s=$duration; gate_result="timeout"; files_changed=$filesChanged; timestamp=(Get-Date -Format "o")} | ConvertTo-Json -Compress
            Add-Content -Path ".ralph/metrics.jsonl" -Value $metric

            Write-Host ""
            Write-Host "  Next iteration in 3s... (create .claude/ralph.stop to halt)"
            Start-Sleep -Seconds 3
            continue
        }

        # Check for completion promise
        $outputStr = $output -join "`n"
        if ($outputStr -match "<promise>COMPLETE</promise>" -or $outputStr -match "<promise>ALL TASKS COMPLETE</promise>") {
            Write-Host ""
            Write-Host "All tasks complete for preset '$Preset'!"
            Write-Host "   Total iterations: $iteration"
            break
        }

        # Check for blocked
        if ($outputStr -match "<promise>BLOCKED") {
            Write-Host ""
            Write-Host "Preset '$Preset' is BLOCKED."
            ($output -split "`n") | Select-String "<promise>BLOCKED"
            break
        }

        # ── Gate execution ──────────────────────────────────────────
        Write-Host "  Running gates..."
        $gateOutput = bash .claude/scripts/gates.sh 2>&1
        $gateExit = $LASTEXITCODE
        if ($gateExit -ne 0) {
            Write-Host "  Gate FAILED (exit $gateExit):"
            ($gateOutput -split "`n") | Select-Object -Last 10
            $gateOutput | Out-File ".ralph/gate_failure.md"
            $gateResult = "fail"
        } else {
            Write-Host "  Gates passed."
            "" | Out-File ".ralph/gate_failure.md"
            $gateResult = "pass"
        }

        # ── Metrics tracking ──────────────────────────────────────────
        $iterEnd = Get-Date
        $duration = [math]::Round(($iterEnd - $iterStart).TotalSeconds)
        $filesChanged = (git diff --name-only HEAD~1 2>$null | Measure-Object).Count
        $metric = @{iteration=$iteration; preset=$Preset; duration_s=$duration; gate_result=$gateResult; files_changed=$filesChanged; timestamp=(Get-Date -Format "o")} | ConvertTo-Json -Compress
        Add-Content -Path ".ralph/metrics.jsonl" -Value $metric

        # Brief pause between iterations
        Write-Host ""
        Write-Host "  Next iteration in 3s... (create .claude/ralph.stop to halt)"
        Start-Sleep -Seconds 3
    }
} finally {
    # Cleanup
    Remove-Item -Force $LockFile -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "Ralph stopped after $iteration iterations."
}
