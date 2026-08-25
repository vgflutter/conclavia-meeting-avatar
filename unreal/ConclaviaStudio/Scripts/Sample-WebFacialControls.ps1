param(
    [string]$ControlUrl = "http://127.0.0.1:8081",
    [string]$OutputPath = "C:\ConclaviaMeetingAvatar\Saved\WebAvatarExport\facial-control-samples.json"
)

$ErrorActionPreference = "Stop"

$moods = [ordered]@{
    neutral = 0.0
    happiness = 0.38
    sadness = 0.38
    disgust = 0.38
    anger = 0.38
    surprise = 0.32
    fear = 0.38
    confidence = 0.40
    excitement = 0.40
    boredom = 0.34
    playfulness = 0.38
    confusion = 0.32
}

$healthDeadline = (Get-Date).AddMinutes(2)
do {
    try {
        $health = Invoke-RestMethod -Uri "$ControlUrl/health" -TimeoutSec 4
    } catch {
        $health = $null
    }
    if ($health -and $health.commercialModelReady -eq $true) { break }
    Start-Sleep -Milliseconds 500
} while ((Get-Date) -lt $healthDeadline)
if (-not $health -or $health.commercialModelReady -ne $true) {
    throw "The ticking Unreal facial model did not become ready at $ControlUrl."
}

$samples = [ordered]@{}
foreach ($entry in $moods.GetEnumerator()) {
    $request = @{
        mood = $entry.Key
        intensity = [double]$entry.Value
        silenceChunks = 8
    } | ConvertTo-Json -Compress
    $accepted = Invoke-RestMethod `
        -Uri "$ControlUrl/authoring/facial-controls" `
        -Method Post `
        -ContentType "application/json" `
        -Body $request `
        -TimeoutSec 5
    if (-not $accepted.ok) {
        throw "The renderer rejected facial authoring mood $($entry.Key)."
    }
    Start-Sleep -Milliseconds 520
    $sample = Invoke-RestMethod `
        -Uri "$ControlUrl/authoring/facial-controls" `
        -Method Get `
        -TimeoutSec 5
    if (-not $sample.ok -or $sample.mood -ne $entry.Key) {
        throw "The renderer returned an invalid facial sample for $($entry.Key)."
    }
    $samples[$entry.Key] = $sample
}

$neutral = @{ mood = "neutral"; intensity = 0.0; silenceChunks = 4 } |
    ConvertTo-Json -Compress
Invoke-RestMethod `
    -Uri "$ControlUrl/authoring/facial-controls" `
    -Method Post `
    -ContentType "application/json" `
    -Body $neutral `
    -TimeoutSec 5 | Out-Null

$report = [ordered]@{
    schemaVersion = 1
    capturedAt = (Get-Date).ToUniversalTime().ToString("o")
    runtimeRevision = $health.runtimeRevision
    engineVersion = $health.engineVersion
    samples = $samples
}
$directory = Split-Path $OutputPath -Parent
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $OutputPath -Encoding UTF8

$controlNames = @(
    $samples.Values |
        ForEach-Object { $_.controls.PSObject.Properties.Name } |
        Sort-Object -Unique
)
@{
    path = $OutputPath
    bytes = (Get-Item -LiteralPath $OutputPath).Length
    moods = $samples.Count
    controls = $controlNames.Count
    runtimeRevision = $health.runtimeRevision
} | ConvertTo-Json -Compress
