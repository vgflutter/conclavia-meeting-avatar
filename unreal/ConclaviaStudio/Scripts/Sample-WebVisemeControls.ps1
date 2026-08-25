param(
    [string]$ControlUrl = "http://127.0.0.1:8081",
    [string]$InputDirectory = "C:\ConclaviaMeetingAvatar\Saved\VisemeCalibration",
    [string]$OutputPath = "C:\ConclaviaMeetingAvatar\Saved\WebAvatarExport\viseme-control-samples.json",
    [int]$SampleIntervalMs = 35
)

$ErrorActionPreference = "Stop"

$visemes = [ordered]@{
    p = "p.pcm"
    t = "t.pcm"
    S = "sh.pcm"
    T = "th.pcm"
    f = "f.pcm"
    k = "k.pcm"
    i = "i.pcm"
    r = "r.pcm"
    s = "s.pcm"
    u = "u.pcm"
    "@" = "schwa.pcm"
    a = "a.pcm"
    e = "e-close.pcm"
    E = "e-open.pcm"
    o = "o-close.pcm"
    O = "o-open.pcm"
}

function Wait-RendererReady {
    param([int]$TimeoutSeconds = 180)

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try {
            $health = Invoke-RestMethod -Uri "$ControlUrl/health" -TimeoutSec 4
        } catch {
            $health = $null
        }
        if (
            $health -and
            $health.commercialModelReady -eq $true -and
            $health.commercialControlsBound -eq $true
        ) {
            return $health
        }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)

    throw "The ticking Unreal facial model did not become ready at $ControlUrl."
}

function Wait-SpeechIdle {
    param([int]$TimeoutSeconds = 30)

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        $health = Invoke-RestMethod -Uri "$ControlUrl/health" -TimeoutSec 4
        if ($health.commercialSpeechActive -ne $true) {
            return $health
        }
        Start-Sleep -Milliseconds 80
    } while ((Get-Date) -lt $deadline)

    throw "The commercial speech solver did not become idle."
}

foreach ($entry in $visemes.GetEnumerator()) {
    $pcmPath = Join-Path $InputDirectory $entry.Value
    if (-not (Test-Path -LiteralPath $pcmPath)) {
        throw "Missing calibrated PCM for viseme $($entry.Key): $pcmPath"
    }
}

$health = Wait-RendererReady
$captures = [ordered]@{}

foreach ($entry in $visemes.GetEnumerator()) {
    Wait-SpeechIdle | Out-Null

    $neutral = @{
        mood = "neutral"
        intensity = 0.0
        silenceChunks = 6
    } | ConvertTo-Json -Compress
    Invoke-RestMethod `
        -Uri "$ControlUrl/authoring/facial-controls" `
        -Method Post `
        -ContentType "application/json" `
        -Body $neutral `
        -TimeoutSec 5 | Out-Null
    Start-Sleep -Milliseconds 180

    $pcmPath = Join-Path $InputDirectory $entry.Value
    [byte[]]$pcm = [System.IO.File]::ReadAllBytes($pcmPath)
    $durationMs = [Math]::Round(($pcm.Length / 2.0 / 16000.0) * 1000.0)
    $speechResponse = Invoke-RestMethod `
        -Uri "$ControlUrl/audio/speech" `
        -Method Post `
        -ContentType "application/octet-stream" `
        -Body $pcm `
        -TimeoutSec 10
    if ($speechResponse.ok -eq $false) {
        throw "The renderer rejected calibrated speech for viseme $($entry.Key)."
    }

    $frames = [System.Collections.Generic.List[object]]::new()
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    $captureDeadlineMs = $durationMs + 900
    do {
        $sample = Invoke-RestMethod `
            -Uri "$ControlUrl/authoring/facial-controls" `
            -Method Get `
            -TimeoutSec 5
        if ($sample.ok -ne $false -and $sample.controls) {
            $frames.Add([ordered]@{
                atMs = [int]$timer.ElapsedMilliseconds
                speechActive = [bool]$sample.commercialSpeechActive
                controls = $sample.controls
            })
        }
        Start-Sleep -Milliseconds $SampleIntervalMs
    } while ($timer.ElapsedMilliseconds -lt $captureDeadlineMs)
    $timer.Stop()

    $captures[$entry.Key] = [ordered]@{
        source = $entry.Value
        pcmBytes = $pcm.Length
        durationMs = $durationMs
        frameCount = $frames.Count
        frames = $frames
    }
}

Wait-SpeechIdle | Out-Null
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
    audioFormat = [ordered]@{
        encoding = "signed-pcm16-le"
        sampleRate = 16000
        channels = 1
    }
    runtimeRevision = $health.runtimeRevision
    engineVersion = $health.engineVersion
    sampleIntervalMs = $SampleIntervalMs
    captures = $captures
}

$directory = Split-Path $OutputPath -Parent
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$report | ConvertTo-Json -Depth 14 | Set-Content -LiteralPath $OutputPath -Encoding UTF8

@{
    path = $OutputPath
    bytes = (Get-Item -LiteralPath $OutputPath).Length
    visemes = $captures.Count
    frames = [int](($captures.Values | ForEach-Object { $_.frameCount } | Measure-Object -Sum).Sum)
    runtimeRevision = $health.runtimeRevision
} | ConvertTo-Json -Compress
