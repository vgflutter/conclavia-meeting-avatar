param(
    [string]$CapturePath = "",
    [string]$ProjectPath = "C:\ConclaviaMeetingAvatar\ConclaviaStudio.uproject",
    [string]$EngineRoot = "C:\Epic\UE_5.8",
    [string]$OutputPath = "/Game/Conclavia/Meeting/Animations",
    [string]$AssetName = "AS_MeetingApplause_SeatedMarkerless_v1",
    [switch]$ReusePerformance,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$editor = Join-Path $EngineRoot "Engine\Binaries\Win64\UnrealEditor.exe"
$script = Join-Path (Split-Path $ProjectPath -Parent) "Scripts\process_markerless_hand_raise.py"
$log = Join-Path (Split-Path $ProjectPath -Parent) "Saved\Logs\MarkerlessApplause.log"

foreach ($requiredPath in @($ProjectPath, $editor, $script)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required markerless applause input is unavailable: $requiredPath"
    }
}
if (-not $ReusePerformance -and -not (Test-Path -LiteralPath $CapturePath)) {
    throw "Required markerless applause capture is unavailable: $CapturePath"
}

$videoPath = if ($ReusePerformance) { "reuse" } else { $CapturePath.Replace("\", "/") }
$pythonArguments = @(
    $script.Replace("\", "/"),
    "--video-path", $videoPath,
    "--output-path", $OutputPath,
    "--asset-name", $AssetName,
    "--slate", "conclavia_meeting_applause",
    "--performance-name", "MHP_MeetingApplause_Markerless_v1",
    "--required-tracks", "upperarm_l,lowerarm_l,hand_l,upperarm_r,lowerarm_r,hand_r",
    "--motion-tracks", "upperarm_l,upperarm_r",
    "--preserve-motion-translations",
    "--stabilize-meeting-torso",
    # Capture Manager exposes the first eight tracked seconds of this take,
    # not the original 28-second video timecode. Use the complete first clap
    # cycle in that solved timeline and retain its authored preparation and
    # lowering. The long boundary ease keeps both transitions quiet.
    "--ease-segment-start-seconds", "3.25",
    "--ease-segment-end-seconds", "6.75",
    "--transition-seconds", "0.75",
    # Preserve the complete markerless take. Blending even six percent back
    # toward the seated base separates and lowers the wrists on MetaHumans
    # whose arm proportions differ from the performer, so the palms no longer
    # meet at the captured contact frames.
    "--gesture-strength", "1.0"
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
    throw "Markerless applause processing failed with exit code $($editorProcess.ExitCode). See $log"
}

$success = Select-String -LiteralPath $log -Pattern "CONCLAVIA_MARKERLESS_PIPELINE_OK" -Quiet
if (-not $success) {
    throw "Markerless applause processing exited without the success marker. See $log"
}

Write-Output "Markerless applause animation created: $OutputPath/$AssetName"
