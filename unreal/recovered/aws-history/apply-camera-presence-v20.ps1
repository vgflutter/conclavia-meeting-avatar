param(
    [string] $BridgeUrl = ''
)

$ErrorActionPreference = 'Stop'
$enginePluginRoot = 'C:\Program Files\Epic Games\UE_5.6\Engine\Plugins\Marketplace\RuntimeMetaHumanLipSync'
$pluginRoot = Join-Path $enginePluginRoot 'Source\RuntimeMetaHumanLipSync'
$header = Join-Path $pluginRoot 'Public\BlendRealisticMetaHumanLipSyncAnimNode.h'
$source = Join-Path $pluginRoot 'Private\BlendRealisticMetaHumanLipSyncAnimNode.cpp'
$projectPluginRoot = 'C:\ConclaviaLipSyncLab56\RMHLipSyncDemo\Plugins\RuntimeMetaHumanLipSync'
$bridge = 'C:\ConclaviaLipSyncLab56\RMHLipSyncDemo\Plugins\ConclaviaLipSyncBridge\Source\ConclaviaLipSyncBridge\Private\ConclaviaLipSyncBridgeModule.cpp'

function Replace-Exact {
    param(
        [Parameter(Mandatory = $true)][string] $Text,
        [Parameter(Mandatory = $true)][string] $Old,
        [Parameter(Mandatory = $true)][string] $New,
        [Parameter(Mandatory = $true)][string] $Label
    )
    if (-not $Text.Contains($Old)) { throw "$Label anchor not found" }
    return $Text.Replace($Old, $New)
}

if (-not (Test-Path ($header + '.conclavia-original'))) {
    Copy-Item $header ($header + '.conclavia-original')
}
if (-not (Test-Path ($source + '.conclavia-original'))) {
    Copy-Item $source ($source + '.conclavia-original')
}

$h = [IO.File]::ReadAllText($header).Replace("`r`n", "`n")
if ($h -notmatch 'NaturalBlinkCountdown') {
    $old = @'
private:
    /** Current control values for smooth interpolation */
'@
    $new = @'
private:
    /** Independent life layer applied after the commercial facial solve. */
    float NaturalBlinkCountdown = 1.25f;
    float NaturalBlinkElapsed = 0.0f;
    float NaturalBlinkValue = 0.0f;
    uint32 NaturalBlinkRandomState = 0xA341316Cu;
    bool bNaturalBlinkActive = false;

    float NextNaturalBlinkRandom();
    void UpdateNaturalBlink(float DeltaTime);

    /** Current control values for smooth interpolation */
'@
    $h = Replace-Exact $h $old $new 'Blink header'
}

if ($h -notmatch 'GazeYawBiasDegrees') {
    $old = @'
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Settings, meta=(EditCondition="bPreserveIdleState"))
    bool bPreserveMouthShape = false;

private:
'@
    $new = @'
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = Settings, meta=(EditCondition="bPreserveIdleState"))
    bool bPreserveMouthShape = false;

    /** Editorial eye line supplied by the Conclavia camera director. */
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Conclavia|Gaze")
    float GazeYawBiasDegrees = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Conclavia|Gaze")
    float GazePitchBiasDegrees = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Conclavia|Gaze")
    float GazeMotionScale = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Conclavia|Gaze")
    bool bDirectCameraGaze = false;

private:
'@
    $h = Replace-Exact $h $old $new 'Public gaze'

    $old = @'
    bool bNaturalBlinkActive = false;

    float NextNaturalBlinkRandom();
'@
    $new = @'
    bool bNaturalBlinkActive = false;

    /** Slow fixation drift plus tiny microsaccades; independent from phonemes. */
    float NaturalGazeCountdown = 0.55f;
    float NaturalGazeClock = 0.0f;
    float NaturalGazeYaw = 0.0f;
    float NaturalGazePitch = 0.0f;
    float NaturalGazeTargetYaw = 0.0f;
    float NaturalGazeTargetPitch = 0.0f;
    uint32 NaturalGazeRandomState = 0x9E3779B9u;

    float NextNaturalBlinkRandom();
    float NextNaturalGazeRandom();
    void UpdateNaturalGaze(float DeltaTime);
'@
    $h = Replace-Exact $h $old $new 'Private gaze'
}
[IO.File]::WriteAllText($header, $h, [Text.UTF8Encoding]::new($false))

$c = [IO.File]::ReadAllText($source).Replace("`r`n", "`n")
if ($c -notmatch 'NextNaturalBlinkRandom') {
    $old = @'
void FAnimNode_BlendRealisticMetaHumanLipSync::Initialize_AnyThread(const FAnimationInitializeContext& Context)
{
	SourcePose.Initialize(Context);
}
'@
    $new = @'
void FAnimNode_BlendRealisticMetaHumanLipSync::Initialize_AnyThread(const FAnimationInitializeContext& Context)
{
	SourcePose.Initialize(Context);
	NaturalBlinkRandomState ^= PointerHash(this);
	NaturalBlinkCountdown = 0.60f + NextNaturalBlinkRandom() * 0.90f;
}

float FAnimNode_BlendRealisticMetaHumanLipSync::NextNaturalBlinkRandom()
{
	NaturalBlinkRandomState = NaturalBlinkRandomState * 1664525u + 1013904223u;
	return static_cast<float>(NaturalBlinkRandomState & 0x00FFFFFFu)
		/ static_cast<float>(0x01000000u);
}

void FAnimNode_BlendRealisticMetaHumanLipSync::UpdateNaturalBlink(const float DeltaTime)
{
	const float Dt = FMath::Clamp(DeltaTime, 0.0f, 0.05f);
	if (!bNaturalBlinkActive)
	{
		NaturalBlinkCountdown -= Dt;
		NaturalBlinkValue = 0.0f;
		if (NaturalBlinkCountdown <= 0.0f)
		{
			bNaturalBlinkActive = true;
			NaturalBlinkElapsed = 0.0f;
		}
		return;
	}

	NaturalBlinkElapsed += Dt;
	constexpr float CloseDuration = 0.100f;
	constexpr float HoldDuration = 0.070f;
	constexpr float OpenDuration = 0.170f;
	constexpr float TotalDuration = CloseDuration + HoldDuration + OpenDuration;
	if (NaturalBlinkElapsed < CloseDuration)
	{
		NaturalBlinkValue = FMath::SmoothStep(0.0f, 1.0f, NaturalBlinkElapsed / CloseDuration);
	}
	else if (NaturalBlinkElapsed < CloseDuration + HoldDuration)
	{
		NaturalBlinkValue = 1.0f;
	}
	else if (NaturalBlinkElapsed < TotalDuration)
	{
		NaturalBlinkValue = 1.0f - FMath::SmoothStep(
			0.0f, 1.0f, (NaturalBlinkElapsed - CloseDuration - HoldDuration) / OpenDuration);
	}
	else
	{
		NaturalBlinkValue = 0.0f;
		NaturalBlinkElapsed = 0.0f;
		bNaturalBlinkActive = false;
		NaturalBlinkCountdown = 1.80f + NextNaturalBlinkRandom() * 2.00f;
	}
}
'@
    $c = Replace-Exact $c $old $new 'Blink initialize'

    $old = @'
	SourcePose.Update(Context);
	GetEvaluateGraphExposedInputs().Execute(Context);

	// Get the latest control values from the generator
'@
    $new = @'
	SourcePose.Update(Context);
	GetEvaluateGraphExposedInputs().Execute(Context);
	UpdateNaturalBlink(Context.GetDeltaTime());

	// Get the latest control values from the generator
'@
    $c = Replace-Exact $c $old $new 'Blink update'

    $old = @'
		}
	}
}

void FAnimNode_BlendRealisticMetaHumanLipSync::GatherDebugData(FNodeDebugData& DebugData)
'@
    $new = @'
		}
	}

	// Apply the independent blink last so Face_AnimBP cannot overwrite it.
#if UE_VERSION_OLDER_THAN(5, 3, 0)
	if (USkeleton* Skeleton = Output.AnimInstanceProxy->GetSkeleton())
	{
		const SmartName::UID_Type LeftUid = Skeleton->GetUIDByName(
			USkeleton::AnimCurveMappingName, TEXT("CTRL_expressions_eyeBlinkL"));
		const SmartName::UID_Type RightUid = Skeleton->GetUIDByName(
			USkeleton::AnimCurveMappingName, TEXT("CTRL_expressions_eyeBlinkR"));
		if (LeftUid != SmartName::MaxUID) Output.Curve.Set(LeftUid, NaturalBlinkValue);
		if (RightUid != SmartName::MaxUID) Output.Curve.Set(RightUid, NaturalBlinkValue * 0.985f);
	}
#else
	Output.Curve.Set(TEXT("CTRL_expressions_eyeBlinkL"), NaturalBlinkValue);
	Output.Curve.Set(TEXT("CTRL_expressions_eyeBlinkR"), NaturalBlinkValue * 0.985f);
#endif
}

void FAnimNode_BlendRealisticMetaHumanLipSync::GatherDebugData(FNodeDebugData& DebugData)
'@
    $c = Replace-Exact $c $old $new 'Blink evaluate'
}

if ($c -notmatch 'NextNaturalGazeRandom') {
    $old = @'
	NaturalBlinkRandomState ^= PointerHash(this);
	NaturalBlinkCountdown = 0.60f + NextNaturalBlinkRandom() * 0.90f;
}
'@
    $new = @'
	NaturalBlinkRandomState ^= PointerHash(this);
	NaturalBlinkCountdown = 0.60f + NextNaturalBlinkRandom() * 0.90f;
	NaturalGazeRandomState ^= PointerHash(this) * 2654435761u;
	NaturalGazeCountdown = 0.35f + NextNaturalGazeRandom() * 0.65f;
}
'@
    $c = Replace-Exact $c $old $new 'Gaze initialize'

    $old = @'
void FAnimNode_BlendRealisticMetaHumanLipSync::CacheBones_AnyThread(const FAnimationCacheBonesContext& Context)
'@
    $new = @'
float FAnimNode_BlendRealisticMetaHumanLipSync::NextNaturalGazeRandom()
{
	NaturalGazeRandomState = NaturalGazeRandomState * 1664525u + 1013904223u;
	return static_cast<float>(NaturalGazeRandomState & 0x00FFFFFFu)
		/ static_cast<float>(0x01000000u);
}

void FAnimNode_BlendRealisticMetaHumanLipSync::UpdateNaturalGaze(const float DeltaTime)
{
	const float Dt = FMath::Clamp(DeltaTime, 0.0f, 0.05f);
	NaturalGazeClock += Dt;
	NaturalGazeCountdown -= Dt;
	if (NaturalGazeCountdown <= 0.0f)
	{
		const float Horizontal = NextNaturalGazeRandom() * 2.0f - 1.0f;
		const float Vertical = NextNaturalGazeRandom() * 2.0f - 1.0f;
		// Keep direct eye contact without freezing the speaker into a mannequin.
		// This range stays within the camera-lens area at portrait distance.
		const float DirectScale = bDirectCameraGaze ? 0.72f : 1.0f;
		NaturalGazeTargetYaw = Horizontal * 1.22f * DirectScale * GazeMotionScale;
		NaturalGazeTargetPitch = Vertical * 0.68f * DirectScale * GazeMotionScale;
		NaturalGazeCountdown = 0.55f + NextNaturalGazeRandom() * 1.35f;
	}
	NaturalGazeYaw = FMath::FInterpTo(NaturalGazeYaw, NaturalGazeTargetYaw, Dt, 8.0f);
	NaturalGazePitch = FMath::FInterpTo(NaturalGazePitch, NaturalGazeTargetPitch, Dt, 7.0f);
}

void FAnimNode_BlendRealisticMetaHumanLipSync::CacheBones_AnyThread(const FAnimationCacheBonesContext& Context)
'@
    $c = Replace-Exact $c $old $new 'Gaze methods'

    $old = @'
	GetEvaluateGraphExposedInputs().Execute(Context);
	UpdateNaturalBlink(Context.GetDeltaTime());
'@
    $new = @'
	GetEvaluateGraphExposedInputs().Execute(Context);
	UpdateNaturalBlink(Context.GetDeltaTime());
	UpdateNaturalGaze(Context.GetDeltaTime());
'@
    $c = Replace-Exact $c $old $new 'Gaze update'

    $old = @'
	// Apply the independent blink last so Face_AnimBP cannot overwrite it.
'@
    $new = @'
	// Replace the inherited staring pose with an editorial eye line and subtle
	// fixation motion. Values remain deliberately small: the performance should
	// feel alive without looking distracted or mechanically oscillating.
	const float SlowYaw = FMath::Sin(NaturalGazeClock * 0.79f) * 0.14f * GazeMotionScale;
	const float SlowPitch = FMath::Sin(NaturalGazeClock * 0.53f + 1.2f) * 0.08f * GazeMotionScale;
	const float GazeYaw = GazeYawBiasDegrees + NaturalGazeYaw + SlowYaw;
	const float GazePitch = GazePitchBiasDegrees + NaturalGazePitch + SlowPitch;
	const float HorizontalCurve = FMath::Clamp(FMath::Abs(GazeYaw) / 30.0f, 0.0f, 0.32f);
	const float VerticalCurve = FMath::Clamp(FMath::Abs(GazePitch) / 24.0f, 0.0f, 0.28f);

#if UE_VERSION_OLDER_THAN(5, 3, 0)
	if (USkeleton* Skeleton = Output.AnimInstanceProxy->GetSkeleton())
	{
		auto SetGazeCurve = [&Output, Skeleton](const TCHAR* Name, const float Value)
		{
			const SmartName::UID_Type Uid = Skeleton->GetUIDByName(
				USkeleton::AnimCurveMappingName, FName(Name));
			if (Uid != SmartName::MaxUID) Output.Curve.Set(Uid, Value);
		};
		SetGazeCurve(TEXT("CTRL_expressions_eyeLookLeftL"), GazeYaw > 0.0f ? HorizontalCurve : 0.0f);
		SetGazeCurve(TEXT("CTRL_expressions_eyeLookLeftR"), GazeYaw > 0.0f ? HorizontalCurve : 0.0f);
		SetGazeCurve(TEXT("CTRL_expressions_eyeLookRightL"), GazeYaw < 0.0f ? HorizontalCurve : 0.0f);
		SetGazeCurve(TEXT("CTRL_expressions_eyeLookRightR"), GazeYaw < 0.0f ? HorizontalCurve : 0.0f);
		SetGazeCurve(TEXT("CTRL_expressions_eyeLookUpL"), GazePitch > 0.0f ? VerticalCurve : 0.0f);
		SetGazeCurve(TEXT("CTRL_expressions_eyeLookUpR"), GazePitch > 0.0f ? VerticalCurve : 0.0f);
		SetGazeCurve(TEXT("CTRL_expressions_eyeLookDownL"), GazePitch < 0.0f ? VerticalCurve : 0.0f);
		SetGazeCurve(TEXT("CTRL_expressions_eyeLookDownR"), GazePitch < 0.0f ? VerticalCurve : 0.0f);
	}
#else
	Output.Curve.Set(TEXT("CTRL_expressions_eyeLookLeftL"), GazeYaw > 0.0f ? HorizontalCurve : 0.0f);
	Output.Curve.Set(TEXT("CTRL_expressions_eyeLookLeftR"), GazeYaw > 0.0f ? HorizontalCurve : 0.0f);
	Output.Curve.Set(TEXT("CTRL_expressions_eyeLookRightL"), GazeYaw < 0.0f ? HorizontalCurve : 0.0f);
	Output.Curve.Set(TEXT("CTRL_expressions_eyeLookRightR"), GazeYaw < 0.0f ? HorizontalCurve : 0.0f);
	Output.Curve.Set(TEXT("CTRL_expressions_eyeLookUpL"), GazePitch > 0.0f ? VerticalCurve : 0.0f);
	Output.Curve.Set(TEXT("CTRL_expressions_eyeLookUpR"), GazePitch > 0.0f ? VerticalCurve : 0.0f);
	Output.Curve.Set(TEXT("CTRL_expressions_eyeLookDownL"), GazePitch < 0.0f ? VerticalCurve : 0.0f);
	Output.Curve.Set(TEXT("CTRL_expressions_eyeLookDownR"), GazePitch < 0.0f ? VerticalCurve : 0.0f);
#endif

	// Apply the independent blink last so Face_AnimBP cannot overwrite it.
'@
    $c = Replace-Exact $c $old $new 'Gaze evaluate'
}
[IO.File]::WriteAllText($source, $c, [Text.UTF8Encoding]::new($false))

# Marketplace plugins marked as Installed are linked from their shipped binaries
# and do not reliably rebuild after a source edit. Keep a source plugin inside
# the project so UnrealBuildTool compiles the natural performance layer.
if (-not (Test-Path (Join-Path $projectPluginRoot 'RuntimeMetaHumanLipSync.uplugin'))) {
    New-Item -ItemType Directory -Force -Path $projectPluginRoot | Out-Null
    Get-ChildItem -Path $enginePluginRoot -Force |
        Where-Object { $_.Name -notin @('Binaries', 'Intermediate') } |
        Copy-Item -Destination $projectPluginRoot -Recurse -Force
}

$projectSourceRoot = Join-Path $projectPluginRoot 'Source\RuntimeMetaHumanLipSync'
New-Item -ItemType Directory -Force -Path (Join-Path $projectSourceRoot 'Public') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $projectSourceRoot 'Private') | Out-Null
Copy-Item $header (Join-Path $projectSourceRoot 'Public\BlendRealisticMetaHumanLipSyncAnimNode.h') -Force
Copy-Item $source (Join-Path $projectSourceRoot 'Private\BlendRealisticMetaHumanLipSyncAnimNode.cpp') -Force

$engineDescriptor = Join-Path $enginePluginRoot 'RuntimeMetaHumanLipSync.uplugin'
$projectDescriptor = Join-Path $projectPluginRoot 'RuntimeMetaHumanLipSync.uplugin'
Copy-Item $engineDescriptor $projectDescriptor -Force
$descriptor = [IO.File]::ReadAllText($projectDescriptor)
$descriptor = $descriptor -replace '"Installed"\s*:\s*true', '"Installed": false'
[IO.File]::WriteAllText($projectDescriptor, $descriptor, [Text.UTF8Encoding]::new($false))

if (-not [string]::IsNullOrWhiteSpace($BridgeUrl)) {
    Invoke-WebRequest -Uri $BridgeUrl -OutFile $bridge -UseBasicParsing
}

Write-Output ('BLINK_HEADER=' + ([IO.File]::ReadAllText($header).Contains('NaturalBlinkCountdown')))
Write-Output ('BLINK_SOURCE=' + ([IO.File]::ReadAllText($source).Contains('NextNaturalBlinkRandom')))
Write-Output ('GAZE_HEADER=' + ([IO.File]::ReadAllText($header).Contains('GazeYawBiasDegrees')))
Write-Output ('GAZE_SOURCE=' + ([IO.File]::ReadAllText($source).Contains('NextNaturalGazeRandom')))
Write-Output ('PROJECT_PLUGIN_SOURCE=' + (Test-Path (Join-Path $projectSourceRoot 'Private\BlendRealisticMetaHumanLipSyncAnimNode.cpp')))
Write-Output ('BRIDGE_V20=' + ([IO.File]::ReadAllText($bridge).Contains('v20-camera-presence')))

& 'C:\Program Files\Epic Games\UE_5.6\Engine\Build\BatchFiles\Build.bat' `
    UnrealEditor Win64 Development `
    '-Project=C:\ConclaviaLipSyncLab56\RMHLipSyncDemo\RMHLipSyncDemo.uproject' `
    -WaitMutex -NoHotReloadFromIDE
if ($LASTEXITCODE -ne 0) {
    throw "Unreal build failed: $LASTEXITCODE"
}
