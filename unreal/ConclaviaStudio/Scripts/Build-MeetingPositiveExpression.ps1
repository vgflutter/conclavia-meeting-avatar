param(
    [string]$ProjectPath = "C:\ConclaviaMeetingAvatar\ConclaviaStudio.uproject",
    [string]$EngineRoot = "C:\Epic\UE_5.8"
)

$ErrorActionPreference = "Stop"

$editor = Join-Path $EngineRoot "Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
$script = Join-Path (Split-Path $ProjectPath -Parent) "Scripts\build_metahuman_positive_expression.py"
$log = Join-Path (Split-Path $ProjectPath -Parent) "Saved\Logs\MeetingPositiveExpression.log"

foreach ($requiredPath in @($ProjectPath, $editor, $script)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required positive-expression input is unavailable: $requiredPath"
    }
}

& $editor `
    $ProjectPath `
    "-ExecutePythonScript=$($script.Replace('\', '/'))" `
    -unattended `
    -nop4 `
    -RenderOffscreen `
    -NoSound `
    -ConclaviaControlPort=18083 `
    "-abslog=$log"
if ($LASTEXITCODE -ne 0) {
    throw "Positive-expression build failed with exit code $LASTEXITCODE. See $log"
}

$success = Select-String `
    -LiteralPath $log `
    -Pattern "CONCLAVIA_POSITIVE_EXPRESSION_OK" `
    -Quiet
if (-not $success) {
    throw "Positive-expression build exited without the success marker. See $log"
}

Write-Output "MetaHuman curve-only positive expression created."
