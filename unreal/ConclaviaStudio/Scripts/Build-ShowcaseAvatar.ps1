param(
    [string]$EngineRoot = "C:\Epic\UE_5.8",
    [string]$ProjectPath = "C:\ConclaviaMeetingAvatar\ConclaviaStudio.uproject",
    [int]$TimeoutMinutes = 45
)

$ErrorActionPreference = "Stop"

$editor = Join-Path $EngineRoot "Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
$projectRoot = Split-Path $ProjectPath
$buildScript = (Join-Path $projectRoot "Scripts\build_showcase_avatar.py").Replace("\", "/")
$artifactRoot = Join-Path $projectRoot "Saved\ShowcaseAvatar"
$stdout = Join-Path $artifactRoot "build.stdout.log"
$stderr = Join-Path $artifactRoot "build.stderr.log"
$statusPath = Join-Path $artifactRoot "status.json"
$blueprint = Join-Path $projectRoot "Content\Conclavia\Meeting\MetaHumans\MHC_Showcase\MHC_Showcase\BP_MHC_Showcase.uasset"

foreach ($requiredPath in @($editor, $ProjectPath, $buildScript)) {
    if (-not (Test-Path $requiredPath)) {
        throw "Required Showcase build path not found: $requiredPath"
    }
}

if (Test-Path $blueprint) {
    @{ state = "ready"; reused = $true; pipeline = "Cinematic"; faceTextures = "8K"; bodyTextures = "4K" } |
        ConvertTo-Json
    exit 0
}

New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null
Remove-Item $stdout, $stderr, $statusPath -Force -ErrorAction SilentlyContinue
$startedAt = Get-Date
$process = Start-Process `
    -FilePath $editor `
    -ArgumentList @(
        $ProjectPath,
        "-unattended",
        "-nop4",
        "-nosplash",
        "-RenderOffscreen",
        "-graphicsadapter=0",
        "-ExecutePythonScript=$buildScript",
        "-stdout",
        "-FullStdOutLogOutput"
    ) `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -PassThru

try {
    $completed = $process.WaitForExit($TimeoutMinutes * 60 * 1000)
    if (-not $completed) {
        & taskkill.exe /PID $process.Id /T /F 2>$null | Out-Null
        throw "Showcase Cine MetaHuman build exceeded $TimeoutMinutes minutes."
    }
    $process.WaitForExit()
    if (-not (Test-Path $blueprint)) {
        $details = if (Test-Path $stderr) { Get-Content $stderr -Raw } else { "" }
        throw "Showcase Cine MetaHuman build produced no Blueprint (exit $($process.ExitCode)). $details"
    }
    $latestLog = Get-ChildItem (Join-Path $projectRoot "Saved\Logs") -Filter "*.log" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if ($null -eq $latestLog -or -not (
        Select-String -Path $latestLog.FullName -Pattern "CONCLAVIA_SHOWCASE: READY" -Quiet
    )) {
        throw "Unreal saved the Showcase asset without its ready marker."
    }

    $status = [ordered]@{
        state = "ready"
        reused = $false
        startedAt = $startedAt.ToUniversalTime().ToString("o")
        completedAt = (Get-Date).ToUniversalTime().ToString("o")
        sourcePreset = "Jelena"
        identity = "MHC_Showcase"
        pipeline = "Cinematic"
        faceTextures = "8K"
        bodyTextures = "4K"
        unrealLog = $latestLog.FullName
    }
    $status | ConvertTo-Json | Set-Content -Path $statusPath -Encoding UTF8
    $status | ConvertTo-Json
}
catch {
    $status = [ordered]@{
        state = "failed"
        startedAt = $startedAt.ToUniversalTime().ToString("o")
        completedAt = (Get-Date).ToUniversalTime().ToString("o")
        message = $_.Exception.Message
    }
    $status | ConvertTo-Json | Set-Content -Path $statusPath -Encoding UTF8
    throw
}
