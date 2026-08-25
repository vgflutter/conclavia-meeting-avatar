param(
    [string]$ProjectPath = "C:\ConclaviaMeetingAvatar\ConclaviaStudio.uproject",
    [string]$EngineRoot = "C:\Epic\UE_5.8",
    [string]$AvatarId = "showcase",
    [string]$OutputDirectory = "",
    [string]$VisemeControlsPath = ""
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path $ProjectPath -Parent
$editor = Join-Path $EngineRoot "Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
$script = Join-Path $projectRoot "Scripts\export_web_avatar_bundle.py"
$facialScript = Join-Path $projectRoot "Scripts\bake_web_facial_moods.py"
$visemeScript = Join-Path $projectRoot "Scripts\bake_web_facial_visemes.py"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $projectRoot "Saved\WebAvatarExport\$AvatarId-$stamp"
}
if ([string]::IsNullOrWhiteSpace($VisemeControlsPath)) {
    $VisemeControlsPath = Join-Path $projectRoot "Saved\WebAvatarAuthoring\selected-viseme-controls.json"
}
$log = Join-Path $projectRoot "Saved\Logs\WebAvatarExport-$stamp.log"
$facialLog = Join-Path $projectRoot "Saved\Logs\WebAvatarFacialExport-$stamp.log"
$visemeLog = Join-Path $projectRoot "Saved\Logs\WebAvatarVisemeExport-$stamp.log"

foreach ($requiredPath in @($ProjectPath, $editor, $script, $facialScript, $visemeScript, $VisemeControlsPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required Web avatar export input is unavailable: $requiredPath"
    }
}
if (Test-Path -LiteralPath $OutputDirectory) {
    if ((Get-ChildItem -LiteralPath $OutputDirectory -Force | Select-Object -First 1)) {
        throw "Web avatar export directory must be empty: $OutputDirectory"
    }
} else {
    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}

$previousExportDirectory = $env:CONCLAVIA_WEB_AVATAR_EXPORT_DIR
$previousAvatarId = $env:CONCLAVIA_WEB_AVATAR_ID
$previousFacialOutput = $env:CONCLAVIA_WEB_FACIAL_MOODS_OUTPUT_DIR
$previousVisemeOutput = $env:CONCLAVIA_WEB_FACIAL_VISEMES_OUTPUT_DIR
$previousVisemeControls = $env:CONCLAVIA_WEB_VISEME_CONTROLS_PATH
try {
    $env:CONCLAVIA_WEB_AVATAR_EXPORT_DIR = $OutputDirectory
    $env:CONCLAVIA_WEB_AVATAR_ID = $AvatarId
    & $editor `
        $ProjectPath `
        "-ExecutePythonScript=$($script.Replace('\', '/'))" `
        -unattended `
        -nop4 `
        -RenderOffscreen `
        -NoSound `
        "-abslog=$log"
    if ($LASTEXITCODE -ne 0) {
        throw "Web avatar export failed with exit code $LASTEXITCODE. See $log"
    }
    $env:CONCLAVIA_WEB_FACIAL_MOODS_OUTPUT_DIR = $OutputDirectory
    & $editor `
        $ProjectPath `
        "-ExecutePythonScript=$($facialScript.Replace('\', '/'))" `
        -unattended `
        -nop4 `
        -RenderOffscreen `
        -NoSound `
        "-abslog=$facialLog"
    if ($LASTEXITCODE -ne 0) {
        $completedBeforeShutdown = `
            (Select-String -LiteralPath $facialLog -Pattern "CONCLAVIA_WEB_FACIAL_MOODS: READY" -Quiet) -and `
            (Test-Path -LiteralPath (Join-Path $OutputDirectory "facial-moods.json"))
        if (-not $completedBeforeShutdown) {
            throw "Web facial export failed with exit code $LASTEXITCODE. See $facialLog"
        }
        Write-Warning "Unreal exited after completing every facial export. Accepting the verified READY bundle."
    }
    $env:CONCLAVIA_WEB_FACIAL_VISEMES_OUTPUT_DIR = $OutputDirectory
    $env:CONCLAVIA_WEB_VISEME_CONTROLS_PATH = $VisemeControlsPath
    & $editor `
        $ProjectPath `
        "-ExecutePythonScript=$($visemeScript.Replace('\', '/'))" `
        -unattended `
        -nop4 `
        -RenderOffscreen `
        -NoSound `
        "-abslog=$visemeLog"
    if ($LASTEXITCODE -ne 0) {
        $visemesCompletedBeforeShutdown = `
            (Select-String -LiteralPath $visemeLog -Pattern "CONCLAVIA_WEB_FACIAL_VISEMES: READY" -Quiet) -and `
            (Test-Path -LiteralPath (Join-Path $OutputDirectory "facial-visemes.json"))
        if (-not $visemesCompletedBeforeShutdown) {
            throw "Web viseme export failed with exit code $LASTEXITCODE. See $visemeLog"
        }
        Write-Warning "Unreal exited after completing every viseme export. Accepting the verified READY bundle."
    }
} finally {
    $env:CONCLAVIA_WEB_AVATAR_EXPORT_DIR = $previousExportDirectory
    $env:CONCLAVIA_WEB_AVATAR_ID = $previousAvatarId
    $env:CONCLAVIA_WEB_FACIAL_MOODS_OUTPUT_DIR = $previousFacialOutput
    $env:CONCLAVIA_WEB_FACIAL_VISEMES_OUTPUT_DIR = $previousVisemeOutput
    $env:CONCLAVIA_WEB_VISEME_CONTROLS_PATH = $previousVisemeControls
}

$success = Select-String -LiteralPath $log -Pattern "CONCLAVIA_WEB_AVATAR_EXPORT_OK" -Quiet
if (-not $success) {
    throw "Web avatar export exited without the success marker. See $log"
}
$facialSuccess = Select-String -LiteralPath $facialLog -Pattern "CONCLAVIA_WEB_FACIAL_MOODS: READY" -Quiet
$facialReport = Join-Path $OutputDirectory "facial-moods.json"
if (-not $facialSuccess -or -not (Test-Path -LiteralPath $facialReport)) {
    throw "Web facial export exited without the success marker. See $facialLog"
}
$visemeSuccess = Select-String -LiteralPath $visemeLog -Pattern "CONCLAVIA_WEB_FACIAL_VISEMES: READY" -Quiet
$visemeReport = Join-Path $OutputDirectory "facial-visemes.json"
if (-not $visemeSuccess -or -not (Test-Path -LiteralPath $visemeReport)) {
    throw "Web viseme export exited without the success marker. See $visemeLog"
}
$zipPath = "$OutputDirectory.zip"
Compress-Archive -Path (Join-Path $OutputDirectory "*") -DestinationPath $zipPath

Write-Output "Web avatar bundle ready: $OutputDirectory"
Write-Output "Portable archive ready: $zipPath"
