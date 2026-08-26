[CmdletBinding()]
param(
    [ValidateRange(15, 720)]
    [int]$MaxRuntimeMinutes = 120
)

$ErrorActionPreference = "Stop"

$taskName = "Conclavia-Meeting-Avatar-AutoStop"
$currentBootTaskName = "Conclavia-Meeting-Avatar-AutoStop-CurrentBoot"
$savedDirectory = "C:\ConclaviaMeetingAvatar\Saved"
$statusPath = Join-Path $savedDirectory "auto-stop.json"
$leasePath = Join-Path $savedDirectory "auto-stop-lease.json"
$watchdogPath = "C:\ConclaviaMeetingAvatar\Scripts\Invoke-ConclaviaAutoStop.ps1"
$shutdownMessage = "Conclavia: limite massimo della sessione GPU raggiunto. Arresto tra 60 secondi."

New-Item -ItemType Directory -Path $savedDirectory -Force | Out-Null

# Once the normal runtime has elapsed, keep waiting while the local meeting
# companion renews a short lease. A crashed or closed companion stops renewing
# it, so the paid GPU still shuts down without relying on the Mac.
$watchdogSource = @'
param(
    [string]$LeasePath,
    [string]$ShutdownMessage
)
$ErrorActionPreference = "Continue"
while ($true) {
    $leaseActive = $false
    if (Test-Path $LeasePath) {
        try {
            $lease = Get-Content $LeasePath -Raw | ConvertFrom-Json
            $leaseActive = $lease.active -eq $true -and
                [DateTime]::Parse($lease.expiresAt).ToUniversalTime() -gt (Get-Date).ToUniversalTime()
        }
        catch { $leaseActive = $false }
    }
    if (-not $leaseActive) { break }
    Start-Sleep -Seconds 30
}
& "$env:SystemRoot\System32\shutdown.exe" /s /f /t 60 /d p:0:0 /c $ShutdownMessage
'@
New-Item -ItemType Directory -Path (Split-Path $watchdogPath) -Force | Out-Null
Set-Content -Path $watchdogPath -Value $watchdogSource -Encoding UTF8

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$watchdogPath`" -LeasePath `"$leasePath`" -ShutdownMessage `"$shutdownMessage`""
$principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 24) `
    -StartWhenAvailable

# This trigger is the fail-safe: it is already registered before the next EC2
# boot and therefore survives a closed Mac, browser, frontend, or SSM session.
$startupTrigger = New-ScheduledTaskTrigger -AtStartup
$startupTrigger.Delay = "PT${MaxRuntimeMinutes}M"
Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $startupTrigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Stops the Conclavia Unreal GPU after runtime unless an active meeting renews its lease." `
    -Force | Out-Null

# The machine is already running when this installer is invoked. Registering a
# one-shot trigger protects this boot as well, and running the installer again
# intentionally resets the deadline for a new supervised test session.
$deadline = (Get-Date).AddMinutes($MaxRuntimeMinutes)
$currentBootTrigger = New-ScheduledTaskTrigger -Once -At $deadline
Register-ScheduledTask `
    -TaskName $currentBootTaskName `
    -Action $action `
    -Trigger $currentBootTrigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Stops the current Conclavia Unreal GPU session when its active meeting lease expires." `
    -Force | Out-Null

$status = [ordered]@{
    enabled = $true
    maxRuntimeMinutes = $MaxRuntimeMinutes
    installedAt = (Get-Date).ToUniversalTime().ToString("o")
    deadline = $deadline.ToUniversalTime().ToString("o")
    startupTask = $taskName
    currentBootTask = $currentBootTaskName
    leaseAware = $true
    leasePath = $leasePath
}
$status | ConvertTo-Json | Set-Content -Path $statusPath -Encoding UTF8
$status | ConvertTo-Json -Compress
