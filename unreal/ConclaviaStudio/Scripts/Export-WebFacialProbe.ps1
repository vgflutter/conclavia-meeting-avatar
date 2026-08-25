param(
    [string]$ProjectPath = "C:\ConclaviaMeetingAvatar\ConclaviaStudio.uproject",
    [string]$EngineRoot = "C:\Epic\UE_5.8",
    [string]$OutputPath = "C:\ConclaviaMeetingAvatar\Saved\WebAvatarExport\facial-positive.glb"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path $ProjectPath -Parent
$editor = Join-Path $EngineRoot "Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
$script = Join-Path $projectRoot "Scripts\bake_web_facial_probe.py"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$log = Join-Path $projectRoot "Saved\Logs\WebFacialProbe-$stamp.log"

foreach ($requiredPath in @($ProjectPath, $editor, $script)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required Web facial probe input is unavailable: $requiredPath"
    }
}

$previousOutput = $env:CONCLAVIA_WEB_FACIAL_PROBE_OUTPUT
try {
    $env:CONCLAVIA_WEB_FACIAL_PROBE_OUTPUT = $OutputPath
    & $editor `
        $ProjectPath `
        "-ExecutePythonScript=$($script.Replace('\', '/'))" `
        -unattended `
        -nop4 `
        -RenderOffscreen `
        -NoSound `
        "-abslog=$log"
    if ($LASTEXITCODE -ne 0) {
        throw "Web facial probe failed with exit code $LASTEXITCODE. See $log"
    }
} finally {
    $env:CONCLAVIA_WEB_FACIAL_PROBE_OUTPUT = $previousOutput
}

$success = Select-String -LiteralPath $log -Pattern "CONCLAVIA_WEB_FACIAL_PROBE_OK" -Quiet
if (-not $success) {
    throw "Web facial probe exited without the success marker. See $log"
}
Get-Item -LiteralPath $OutputPath | Select-Object FullName,Length | ConvertTo-Json -Compress
