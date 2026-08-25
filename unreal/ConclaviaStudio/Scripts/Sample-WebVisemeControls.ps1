param(
    [string]$ControlUrl = "http://127.0.0.1:8081",
    [string]$InputDirectory = "C:\ConclaviaMeetingAvatar\Saved\VisemeCalibration",
    [string]$OutputPath = "C:\ConclaviaMeetingAvatar\Saved\WebAvatarExport\viseme-control-samples.json",
    [int]$SampleIntervalMs = 35
)

$ErrorActionPreference = "Stop"

$visemes = @(
    [pscustomobject]@{ viseme = "p"; source = "p.pcm" }
    [pscustomobject]@{ viseme = "t"; source = "t.pcm" }
    [pscustomobject]@{ viseme = "S"; source = "sh.pcm" }
    [pscustomobject]@{ viseme = "T"; source = "th.pcm" }
    [pscustomobject]@{ viseme = "f"; source = "f.pcm" }
    [pscustomobject]@{ viseme = "k"; source = "k.pcm" }
    [pscustomobject]@{ viseme = "i"; source = "i.pcm" }
    [pscustomobject]@{ viseme = "r"; source = "r.pcm" }
    [pscustomobject]@{ viseme = "s"; source = "s.pcm" }
    [pscustomobject]@{ viseme = "u"; source = "u.pcm" }
    [pscustomobject]@{ viseme = "@"; source = "schwa.pcm" }
    [pscustomobject]@{ viseme = "a"; source = "a.pcm" }
    [pscustomobject]@{ viseme = "e"; source = "e-close.pcm" }
    [pscustomobject]@{ viseme = "E"; source = "e-open.pcm" }
    [pscustomobject]@{ viseme = "o"; source = "o-close.pcm" }
    [pscustomobject]@{ viseme = "O"; source = "o-open.pcm" }
)

function Wait-RendererReady {
    param([int]$TimeoutSeconds = 180)

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try {
            $health = Invoke-RestMethod -Uri "$ControlUrl/health" -TimeoutSec 4
        } catch {
            $health = $null
        }
        if ($health -and $health.commercialModelReady -eq $true) {
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

foreach ($entry in $visemes) {
    $pcmPath = Join-Path $InputDirectory $entry.source
    if (-not (Test-Path -LiteralPath $pcmPath)) {
        throw "Missing calibrated PCM for viseme $($entry.viseme): $pcmPath"
    }
}

$health = Wait-RendererReady
$captures = [System.Collections.Generic.List[object]]::new()

foreach ($entry in $visemes) {
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

    $pcmPath = Join-Path $InputDirectory $entry.source
    [byte[]]$pcm = [System.IO.File]::ReadAllBytes($pcmPath)
    $durationMs = [Math]::Round(($pcm.Length / 2.0 / 16000.0) * 1000.0)
    $speechResponse = Invoke-RestMethod `
        -Uri "$ControlUrl/audio/speech" `
        -Method Post `
        -ContentType "application/octet-stream" `
        -Body $pcm `
        -TimeoutSec 10
    if ($speechResponse.ok -eq $false) {
        throw "The renderer rejected calibrated speech for viseme $($entry.viseme)."
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

    $captures.Add([ordered]@{
        viseme = $entry.viseme
        source = $entry.source
        pcmBytes = $pcm.Length
        durationMs = $durationMs
        frameCount = $frames.Count
        frames = $frames
    })
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
    captures = @($captures)
}

$directory = Split-Path $OutputPath -Parent
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$report | ConvertTo-Json -Depth 14 | Set-Content -LiteralPath $OutputPath -Encoding UTF8

@{
    path = $OutputPath
    bytes = (Get-Item -LiteralPath $OutputPath).Length
    visemes = $captures.Count
    frames = [int](($captures | ForEach-Object { $_.frameCount } | Measure-Object -Sum).Sum)
    runtimeRevision = $health.runtimeRevision
} | ConvertTo-Json -Compress
