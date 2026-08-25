param(
    [string]$ProjectPath = "C:\ConclaviaMeetingAvatar\ConclaviaStudio.uproject",
    [string]$EngineRoot = "C:\Epic\UE_5.8",
    [string]$OutputPath = "C:\ConclaviaMeetingAvatar\Saved\WebAvatarExport\official-facial-pose-catalog.json"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path $ProjectPath -Parent
$editor = Join-Path $EngineRoot "Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
$script = Join-Path $projectRoot "Scripts\audit_official_facial_pose_catalog.py"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$log = Join-Path $projectRoot "Saved\Logs\OfficialFacialPoseCatalog-$stamp.log"

foreach ($requiredPath in @($ProjectPath, $editor, $script)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required facial catalog input is unavailable: $requiredPath"
    }
}

$previousOutput = $env:CONCLAVIA_WEB_FACIAL_CATALOG_OUTPUT
try {
    $env:CONCLAVIA_WEB_FACIAL_CATALOG_OUTPUT = $OutputPath
    & $editor `
        $ProjectPath `
        "-ExecutePythonScript=$($script.Replace('\', '/'))" `
        -unattended `
        -nop4 `
        -RenderOffscreen `
        -NoSound `
        "-abslog=$log"
    if ($LASTEXITCODE -ne 0) {
        throw "Official facial pose catalog failed with exit code $LASTEXITCODE. See $log"
    }
} finally {
    $env:CONCLAVIA_WEB_FACIAL_CATALOG_OUTPUT = $previousOutput
}

if (-not (Select-String -LiteralPath $log -Pattern "CONCLAVIA_WEB_FACIAL_CATALOG: READY" -Quiet)) {
    throw "Official facial pose catalog exited without the success marker. See $log"
}
$catalog = Get-Content -LiteralPath $OutputPath -Raw | ConvertFrom-Json
@{
    path = $OutputPath
    bytes = (Get-Item -LiteralPath $OutputPath).Length
    assets = $catalog.assetCount
    categories = $catalog.categoryCounts
} | ConvertTo-Json -Depth 5 -Compress
