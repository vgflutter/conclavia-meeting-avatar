param(
    [string]$ProjectPath = "C:\ConclaviaMeetingAvatar\ConclaviaStudio.uproject",
    [string]$EngineRoot = "C:\Epic\UE_5.8"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path $ProjectPath -Parent
$editor = Join-Path $EngineRoot "Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
$steps = @(
    @{
        Name = "seated anchor"
        Script = Join-Path $projectRoot "Scripts\build_seated_idle.py"
        Marker = "CONCLAVIA_SEATED_IDLE: READY"
    },
    @{
        Name = "meeting idle repertoire"
        Script = Join-Path $projectRoot "Scripts\build_meeting_attentive_idle.py"
        Marker = "CONCLAVIA_MEETING_IDLE: READY"
    },
    @{
        Name = "solver driven hand raise"
        Script = Join-Path $projectRoot "Scripts\build_metahuman_hand_raise.py"
        Marker = "CONCLAVIA_HAND_RAISE: READY"
    },
    @{
        Name = "authored Web microgestures"
        Script = Join-Path $projectRoot "Scripts\build_web_authored_microgestures.py"
        Marker = "CONCLAVIA_WEB_MICROGESTURES: READY"
    },
    @{
        Name = "applause hand contact"
        Script = Join-Path $projectRoot "Scripts\refine_applause_hand_contact.py"
        Marker = "CONCLAVIA_APPLAUSE_CONTACT_IK: READY"
    }
)

foreach ($requiredPath in @($ProjectPath, $editor) + @($steps | ForEach-Object { $_.Script })) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required Web microgesture input is unavailable: $requiredPath"
    }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
foreach ($step in $steps) {
    $safeName = $step.Name.Replace(" ", "-")
    $log = Join-Path $projectRoot "Saved\Logs\WebMicrogesture-$safeName-$stamp.log"
    & $editor `
        $ProjectPath `
        "-ExecutePythonScript=$($step.Script.Replace('\', '/'))" `
        -unattended `
        -nop4 `
        -RenderOffscreen `
        -NoSound `
        "-abslog=$log"
    if ($LASTEXITCODE -ne 0) {
        throw "Web microgesture $($step.Name) build failed with exit code $LASTEXITCODE. See $log"
    }
    if (-not (Select-String -LiteralPath $log -SimpleMatch $step.Marker -Quiet)) {
        throw "Web microgesture $($step.Name) build exited without its READY marker. See $log"
    }
}

Write-Output "Seated authored Web microgestures and applause contact IK are ready."
