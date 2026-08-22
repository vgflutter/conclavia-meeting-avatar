$ErrorActionPreference = "Stop"
$base64Path = "C:\ConclaviaStudio\Saved\v9-source.b64"
$sourcePath = "C:\ConclaviaStudio\Source\ConclaviaStudio\Private\ConclaviaStudioModule.cpp"
$compressed = [Convert]::FromBase64String([IO.File]::ReadAllText($base64Path))
$inputStream = New-Object IO.MemoryStream(,$compressed)
$gzipStream = New-Object IO.Compression.GZipStream($inputStream, [IO.Compression.CompressionMode]::Decompress)
$outputStream = New-Object IO.MemoryStream
$gzipStream.CopyTo($outputStream)
$gzipStream.Dispose()
$inputStream.Dispose()
[IO.File]::WriteAllBytes($sourcePath, $outputStream.ToArray())
$outputStream.Dispose()
Remove-Item $base64Path -Force
Get-FileHash $sourcePath -Algorithm SHA256 | Format-List Hash

$build = "C:\Epic\UE_5.8\Engine\Build\BatchFiles\Build.bat"
& $build ConclaviaStudioEditor Win64 Development "-Project=C:\ConclaviaStudio\ConclaviaStudio.uproject" -WaitMutex -NoHotReloadFromIDE
if ($LASTEXITCODE -ne 0) {
    throw "Unreal build failed with exit code $LASTEXITCODE."
}
Write-Output '{"ok":true,"revision":"ue58-commercial-lipsync-v9-gesture-framing"}'
