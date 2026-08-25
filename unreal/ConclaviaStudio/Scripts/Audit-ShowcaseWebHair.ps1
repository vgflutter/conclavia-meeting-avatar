param(
    [string]$EngineRoot = "C:\Epic\UE_5.8",
    [string]$ProjectPath = "C:\ConclaviaMeetingAvatar\ConclaviaStudio.uproject",
    [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $ProjectPath
$editor = Join-Path $EngineRoot "Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
$script = (Join-Path $projectRoot "Scripts\inspect_showcase_web_hair.py").Replace("\", "/")
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $projectRoot "Saved\WebAvatarAuthoring\showcase-hair.json"
}
$log = Join-Path $projectRoot "Saved\Logs\ShowcaseWebHairAudit.log"

foreach ($requiredPath in @($editor, $ProjectPath, $script)) {
    if (-not (Test-Path $requiredPath)) {
        throw "Required Showcase hair audit path not found: $requiredPath"
    }
}

$previousOutput = $env:CONCLAVIA_SHOWCASE_HAIR_AUDIT_OUTPUT
try {
    $env:CONCLAVIA_SHOWCASE_HAIR_AUDIT_OUTPUT = $OutputPath
    & $editor $ProjectPath "-ExecutePythonScript=$script" -unattended -nop4 -RenderOffscreen -NoSound "-abslog=$log"
    if ($LASTEXITCODE -ne 0) {
        throw "Showcase hair audit failed with exit code $LASTEXITCODE. See $log"
    }
} finally {
    $env:CONCLAVIA_SHOWCASE_HAIR_AUDIT_OUTPUT = $previousOutput
}

if (-not (Test-Path $OutputPath) -or -not (
    Select-String -LiteralPath $log -Pattern "CONCLAVIA_SHOWCASE_HAIR_AUDIT_OK" -Quiet
)) {
    throw "Showcase hair audit produced no verified report. See $log"
}
Get-Content -LiteralPath $OutputPath -Raw
