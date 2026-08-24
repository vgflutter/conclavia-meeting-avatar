param(
    [Parameter(Mandatory = $true)]
    [string]$CapturePath,
    [string]$ProjectPath = "C:\ConclaviaMeetingAvatar\ConclaviaStudio.uproject",
    [string]$EngineRoot = "C:\Epic\UE_5.8",
    [string]$OutputPath = "/Game/Conclavia/Meeting/Animations",
    [string]$AssetName = "AS_MeetingHandRaise_SeatedMarkerless_v1",
    [switch]$ReusePerformance,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$editor = Join-Path $EngineRoot "Engine\Binaries\Win64\UnrealEditor.exe"
$script = Join-Path (Split-Path $ProjectPath -Parent) "Scripts\process_markerless_hand_raise.py"
$log = Join-Path (Split-Path $ProjectPath -Parent) "Saved\Logs\MarkerlessHandRaise.log"

foreach ($requiredPath in @($ProjectPath, $editor, $script)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required markerless input is unavailable: $requiredPath"
    }
}
if (-not $ReusePerformance -and -not (Test-Path -LiteralPath $CapturePath)) {
    throw "Required markerless hand-raise capture is unavailable: $CapturePath"
}

$videoPath = if ($ReusePerformance) { "reuse" } else { $CapturePath.Replace("\", "/") }
$pythonArguments = @(
    $script.Replace("\", "/"),
    "--video-path", $videoPath,
    "--output-path", $OutputPath,
    "--asset-name", $AssetName,
    "--stabilize-meeting-torso",
    "--ease-segment-start-seconds", "1.75",
    "--ease-segment-end-seconds", "7.50",
    "--transition-seconds", "0.80",
    "--gesture-strength", "0.82",
    "--hold-pose-seconds", "3.25",
    "--lower-segment-start-seconds", "5.75",
    "--release-transition-seconds", "0.60"
)
if ($ReusePerformance) {
    $pythonArguments += "--reuse-performance"
}
if ($Force) {
    $pythonArguments += "--force"
}

$executePython = '-ExecutePythonScript="{0}"' -f ($pythonArguments -join ' ')
$arguments = @(
    $ProjectPath,
    $executePython,
    "-unattended",
    "-nop4",
    "-RenderOffscreen",
    "-NoSound",
    "-abslog=$log"
)

$editorProcess = Start-Process `
    -FilePath $editor `
    -ArgumentList $arguments `
    -PassThru `
    -Wait
if ($editorProcess.ExitCode -ne 0) {
    throw "Markerless hand-raise processing failed with exit code $($editorProcess.ExitCode). See $log"
}

$success = Select-String -LiteralPath $log -Pattern "CONCLAVIA_MARKERLESS_PIPELINE_OK" -Quiet
if (-not $success) {
    throw "Markerless processing exited without the success marker. See $log"
}

Write-Output "Markerless hand-raise animation created: $OutputPath/$AssetName"
