$ErrorActionPreference = "Stop"

$sourcePath = "C:\ConclaviaStudio\Source\ConclaviaStudio\Private\ConclaviaStudioModule.cpp"
$source = [IO.File]::ReadAllText($sourcePath)
$oldBlock = @'
        if (bLipSyncLab)
        {
            // The single-hero profile is a face-performance benchmark, not a
            // broadcast edit. Never schedule its generic context or handoff
            // cuts: they used to return to the master shot before the visual
            // readiness sampler ran, making a tiny full-body Aera look valid.
            SwitchCamera(TEXT("CAM_Seat_1_Close"), 0.0f, true);
            return;
        }
'@
$newBlock = @'
        if (bLipSyncLab)
        {
            // Keep ordinary listening and speech on the stable portrait, but
            // reveal the complete solver-authored arm when Mary requests the
            // floor. The old unconditional close-up made a healthy hand-raise
            // animation invisible while telemetry incorrectly looked green.
            // Reuse the authored studio slider instead of moving a camera or
            // a body bone procedurally at runtime.
            const bool bNeedsGestureFraming =
                Shot.Contains(TEXT("wide"), ESearchCase::IgnoreCase)
                && (ActiveBodyGesture == TEXT("raise-hand")
                    || BodyGesturePhase == TEXT("raising")
                    || BodyGesturePhase == TEXT("held"));
            SwitchCamera(
                bNeedsGestureFraming
                    ? TEXT("CAM_Wide_Slider_Left")
                    : TEXT("CAM_Seat_1_Close"),
                0.0f,
                true);
            return;
        }
'@

if (-not $source.Contains($oldBlock)) {
    throw "Expected lipsync camera block was not found."
}
$source = $source.Replace($oldBlock, $newBlock)
$source = $source.Replace(
    'TEXT("ue58-commercial-lipsync-v8-warm-avatar")',
    'TEXT("ue58-commercial-lipsync-v9-gesture-framing")'
)
if (-not $source.Contains('ue58-commercial-lipsync-v9-gesture-framing')) {
    throw "Runtime revision replacement failed."
}

[IO.File]::WriteAllText($sourcePath, $source, [Text.UTF8Encoding]::new($false))
Get-FileHash $sourcePath -Algorithm SHA256 | Format-List Hash

$build = "C:\Epic\UE_5.8\Engine\Build\BatchFiles\Build.bat"
& $build ConclaviaStudioEditor Win64 Development "-Project=C:\ConclaviaStudio\ConclaviaStudio.uproject" -WaitMutex -NoHotReloadFromIDE
if ($LASTEXITCODE -ne 0) {
    throw "Unreal build failed with exit code $LASTEXITCODE."
}
Write-Output '{"ok":true,"revision":"ue58-commercial-lipsync-v9-gesture-framing"}'
