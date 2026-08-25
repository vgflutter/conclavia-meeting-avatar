param(
    [string]$ProjectPath = "C:\ConclaviaMeetingAvatar\ConclaviaStudio.uproject",
    [string]$EngineRoot = "C:\Epic\UE_5.8",
    [string]$AvatarId = "showcase",
    [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path $ProjectPath -Parent
$editor = Join-Path $EngineRoot "Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
$script = Join-Path $projectRoot "Scripts\export_web_avatar_bundle.py"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $projectRoot "Saved\WebAvatarExport\$AvatarId-$stamp"
}
$log = Join-Path $projectRoot "Saved\Logs\WebAvatarExport-$stamp.log"

foreach ($requiredPath in @($ProjectPath, $editor, $script)) {
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
} finally {
    $env:CONCLAVIA_WEB_AVATAR_EXPORT_DIR = $previousExportDirectory
    $env:CONCLAVIA_WEB_AVATAR_ID = $previousAvatarId
}

$success = Select-String -LiteralPath $log -Pattern "CONCLAVIA_WEB_AVATAR_EXPORT_OK" -Quiet
if (-not $success) {
    throw "Web avatar export exited without the success marker. See $log"
}
$zipPath = "$OutputDirectory.zip"
Compress-Archive -Path (Join-Path $OutputDirectory "*") -DestinationPath $zipPath

Write-Output "Web avatar bundle ready: $OutputDirectory"
Write-Output "Portable archive ready: $zipPath"
