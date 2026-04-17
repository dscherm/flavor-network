# watchdog.ps1 — Resume incomplete chemDataset fetches and trigger blend.
# Intended for Windows Task Scheduler every 12 hours.
#
# Register (run once, elevated PowerShell):
#   $A = New-ScheduledTaskAction -Execute "powershell.exe" `
#        -Argument "-NoProfile -ExecutionPolicy Bypass -File D:\Projects\flavor-network-C\chemDataset\watchdog.ps1"
#   $T = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) `
#        -RepetitionInterval (New-TimeSpan -Hours 12)
#   Register-ScheduledTask -TaskName "flavor-network-C chemDataset watchdog" -Action $A -Trigger $T
#
# Unregister:
#   Unregister-ScheduledTask -TaskName "flavor-network-C chemDataset watchdog" -Confirm:$false

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$log = Join-Path $root "watchdog.log"

function Log($msg) {
    $stamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    "$stamp $msg" | Tee-Object -FilePath $log -Append
}

Log "=== watchdog start ==="

# Skip if another instance is still running a scrape
$running = Get-Process -Name node -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and $_.CommandLine -match 'chemDataset' }
if ($running) {
    Log "chemDataset process already running; skipping"
    exit 0
}

if (-not (Test-Path (Join-Path $root "node_modules"))) {
    Log "installing deps"
    npm install 2>&1 | Tee-Object -FilePath $log -Append
}

# Re-status
node scripts/00-status.js 2>&1 | Tee-Object -FilePath $log -Append

$sources = @("foodb","flavordb","chemtastedb","bitterdb","supersweetdb")
$allReal = $true
foreach ($s in $sources) {
    $p = Join-Path $root "processed/$s.json"
    if (-not (Test-Path $p)) { Log "$s missing — running fetch"; npm run $s 2>&1 | Tee-Object -FilePath $log -Append; $allReal = $false; continue }
    $content = Get-Content $p -Raw
    if ($content -match '"_stub"') { Log "$s is stub — running fetch"; npm run $s 2>&1 | Tee-Object -FilePath $log -Append; $allReal = $false }
}

if ($allReal) {
    $blend = Join-Path $root "../public/chemDataset/ingredients.json"
    $blendStub = $true
    if (Test-Path $blend) {
        $blendStub = (Get-Content $blend -Raw) -match '"_stub"'
    }
    if ($blendStub) {
        Log "all sources real; running blend"
        npm run blend 2>&1 | Tee-Object -FilePath $log -Append
    } else {
        Log "blend already current; nothing to do"
    }
}

Log "=== watchdog end ==="
