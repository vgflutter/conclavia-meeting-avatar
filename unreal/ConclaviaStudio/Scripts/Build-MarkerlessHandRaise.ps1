param(
    [Parameter(Mandatory = $true)]
    [string]$CapturePath,
    [string]$ProjectPath = "C:\ConclaviaMeetingAvatar\ConclaviaStudio.uproject",
    [string]$EngineRoot = "C:\Epic\UE_5.8",
    [string]$OutputPath = "/Game/Conclavia/Meeting/Animations",
    [string]$AssetName = "AS_MeetingHandRaise_Markerless_v1",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$editor = Join-Path $EngineRoot "Engine\Binaries\Win64\UnrealEditor.exe"
$script = Join-Path (Split-Path $ProjectPath -Parent) "Scripts\process_markerless_hand_raise.py"
$log = Join-Path (Split-Path $ProjectPath -Parent) "Saved\Logs\MarkerlessHandRaise.log"

foreach ($requiredPath in @($CapturePath, $ProjectPath, $editor, $script)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required markerless input is unavailable: $requiredPath"
    }
}

$pythonArguments = @(
    $script.Replace("\", "/"),
    "--video-path", $CapturePath.Replace("\", "/"),
    "--output-path", $OutputPath,
    "--asset-name", $AssetName
)
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
