param(
    [string]$ProjectPath = "C:\ConclaviaMeetingAvatar\ConclaviaStudio.uproject",
    [string]$EngineRoot = "C:\Epic\UE_5.8",
    [string]$OutputPath = "C:\ConclaviaMeetingAvatar\Saved\WebAvatarExport\facial-control-samples.json"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path $ProjectPath -Parent
$editor = Join-Path $EngineRoot "Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
$script = Join-Path $projectRoot "Scripts\sample_web_facial_controls.py"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$log = Join-Path $projectRoot "Saved\Logs\WebFacialControlSample-$stamp.log"

foreach ($requiredPath in @($ProjectPath, $editor, $script)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required Web facial control sampler input is unavailable: $requiredPath"
    }
}

$previousOutput = $env:CONCLAVIA_WEB_FACIAL_CONTROL_OUTPUT
try {
    $env:CONCLAVIA_WEB_FACIAL_CONTROL_OUTPUT = $OutputPath
    & $editor `
        $ProjectPath `
        "-ExecutePythonScript=$($script.Replace('\', '/'))" `
        -unattended `
        -nop4 `
        -RenderOffscreen `
        -NoSound `
        "-abslog=$log"
    if ($LASTEXITCODE -ne 0) {
        throw "Web facial control sampling failed with exit code $LASTEXITCODE. See $log"
    }
} finally {
    $env:CONCLAVIA_WEB_FACIAL_CONTROL_OUTPUT = $previousOutput
}

$success = Select-String -LiteralPath $log -Pattern "CONCLAVIA_WEB_FACIAL_CONTROL_SAMPLE_OK" -Quiet
if (-not $success) {
    throw "Web facial control sampling exited without the success marker. See $log"
}

$report = Get-Content -LiteralPath $OutputPath -Raw | ConvertFrom-Json
@{
    path = $OutputPath
    bytes = (Get-Item -LiteralPath $OutputPath).Length
    moods = @($report.samples.PSObject.Properties).Count
    controls = @($report.controlNames).Count
    modelLoadSeconds = $report.modelLoadSeconds
} | ConvertTo-Json -Compress
