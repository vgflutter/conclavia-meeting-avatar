param(
    [Parameter(Mandatory = $true)]
    [string]$LauncherTokenFile,
    [string]$ProjectPath = "C:\ConclaviaMeetingAvatar\ConclaviaStudio.uproject",
    [string]$EngineRoot = "C:\Epic\UE_5.8",
    [int]$TimeoutMinutes = 60
)

$ErrorActionPreference = "Stop"

$bootstrapRoot = Split-Path $MyInvocation.MyCommand.Path -Parent
$fabRoot = Join-Path $EngineRoot "Engine\Plugins\Marketplace\Fab"
$fabPrivate = Join-Path $fabRoot "Source\Fab\Private"
$fabModule = Join-Path $fabPrivate "FabModule.cpp"
$pluginTarget = Join-Path $EngineRoot "Engine\Plugins\Marketplace\MetaHumanBodyTracker_5.8\MetaHumanBodyTracker.uplugin"
$editor = Join-Path $EngineRoot "Engine\Binaries\Win64\UnrealEditor.exe"
$uat = Join-Path $EngineRoot "Engine\Build\BatchFiles\RunUAT.bat"
$buildRoot = Join-Path (Split-Path $ProjectPath -Parent) "Saved\FabBootstrapBuild"
$log = Join-Path (Split-Path $ProjectPath -Parent) "Saved\Logs\MarkerlessPluginInstall.log"

if (Test-Path $pluginTarget) {
    Write-Output "MetaHuman Animator Markerless Motion Capture is already installed."
    exit 0
}

foreach ($requiredPath in @(
    $LauncherTokenFile,
    $ProjectPath,
    $editor,
    $uat,
    (Join-Path $fabRoot "Fab.uplugin"),
    $fabModule,
    (Join-Path $bootstrapRoot "fab\FabMarkerlessBootstrap.cpp"),
    (Join-Path $bootstrapRoot "fab\FabMarkerlessBootstrap.h")
)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required markerless bootstrap input is unavailable: $requiredPath"
    }
}

# The token is never accepted on the command line and the C++ bootstrap
# overwrites and deletes this exact file immediately after reading it.
& icacls.exe $LauncherTokenFile /inheritance:r /grant:r "SYSTEM:(F)" "Administrators:(F)" | Out-Null

Copy-Item (Join-Path $bootstrapRoot "fab\FabMarkerlessBootstrap.cpp") $fabPrivate -Force
Copy-Item (Join-Path $bootstrapRoot "fab\FabMarkerlessBootstrap.h") $fabPrivate -Force

$moduleSource = Get-Content $fabModule -Raw
if ($moduleSource -notmatch 'FabMarkerlessBootstrap\.h') {
    $moduleSource = $moduleSource.Replace(
        '#include "FabLog.h"',
        "#include `"FabLog.h`"`r`n#include `"FabMarkerlessBootstrap.h`""
    )
}
if ($moduleSource -notmatch 'FabMarkerlessBootstrap::Begin') {
    $startupPattern = '(virtual void StartupModule\(\) override\s*\{)'
    $moduleSource = [regex]::Replace(
        $moduleSource,
        $startupPattern,
        '$1' + "`r`n`t`tFabMarkerlessBootstrap::Begin(FString());",
        1
    )
}
Set-Content $fabModule $moduleSource -NoNewline -Encoding UTF8

Remove-Item $buildRoot -Recurse -Force -ErrorAction SilentlyContinue
& $uat BuildPlugin `
    "-Plugin=$(Join-Path $fabRoot 'Fab.uplugin')" `
    "-Package=$buildRoot" `
    -TargetPlatforms=Win64 `
    -Rocket
if ($LASTEXITCODE -ne 0) {
    throw "Fab bootstrap build failed with exit code $LASTEXITCODE."
}

$builtBinary = Join-Path $buildRoot "Binaries\Win64\UnrealEditor-Fab.dll"
if (-not (Test-Path $builtBinary)) {
    throw "Fab bootstrap build produced no editor module."
}
Copy-Item $builtBinary (Join-Path $fabRoot "Binaries\Win64\UnrealEditor-Fab.dll") -Force

$arguments = @(
    $ProjectPath,
    "-ConclaviaInstallMarkerless",
    "-ConclaviaLauncherTokenFile=$LauncherTokenFile",
    "-unattended",
    "-nop4",
    "-RenderOffscreen",
    "-NoSound",
    "-abslog=$log"
)
$editorProcess = Start-Process -FilePath $editor -ArgumentList $arguments -PassThru
$deadline = (Get-Date).AddMinutes($TimeoutMinutes)
$installed = $false
while ((Get-Date) -lt $deadline) {
    if (Test-Path $pluginTarget) {
        $tail = if (Test-Path $log) {
            (Get-Content $log -Tail 200) -join "`n"
        } else {
            ""
        }
        if ($tail -match "CONCLAVIA_MARKERLESS_PLUGIN_INSTALL_OK") {
            $installed = $true
            break
        }
    }
    if ($editorProcess.HasExited) {
        break
    }
    Start-Sleep -Seconds 5
}

if (-not $editorProcess.HasExited) {
    $editorProcess.CloseMainWindow() | Out-Null
    if (-not $editorProcess.WaitForExit(15000)) {
        Stop-Process -Id $editorProcess.Id -Force
    }
}
if (Test-Path $LauncherTokenFile) {
    $bytes = (Get-Item $LauncherTokenFile).Length
    if ($bytes -gt 0) {
        [IO.File]::WriteAllBytes($LauncherTokenFile, (New-Object byte[] $bytes))
    }
    Remove-Item $LauncherTokenFile -Force
}
if (-not $installed) {
    throw "Markerless plugin installation did not complete. See $log"
}

Write-Output "MetaHuman Animator Markerless Motion Capture installed successfully."
