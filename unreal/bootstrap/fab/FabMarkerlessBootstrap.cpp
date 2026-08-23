#include "FabMarkerlessBootstrap.h"

#include "Dom/JsonObject.h"
#include "FabDownloader.h"
#include "FabLog.h"
#include "GenericPlatform/GenericPlatformHttp.h"
#include "HAL/FileManager.h"
#include "HttpModule.h"
#include "Interfaces/IHttpResponse.h"
#include "Misc/CommandLine.h"
#include "Misc/FileHelper.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

namespace
{
	constexpr TCHAR ListingId[] = TEXT("4095b8e0-3eff-44f1-acb4-cb40b99228b9");
	constexpr TCHAR ExpectedAppName[] = TEXT("MetaHumanBodyTracker_5.8");
	constexpr TCHAR LauncherUserAgent[] = TEXT("UELauncher/11.0.1-14907503+++Portal+Release-Live Windows/10.0.19041.1.256.64bit");

	TSharedPtr<FFabDownloadRequest> GMarkerlessDownload;
	bool GMarkerlessBootstrapStarted = false;

	bool ParseObject(const FString& Json, TSharedPtr<FJsonObject>& Out)
	{
		const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Json);
		return FJsonSerializer::Deserialize(Reader, Out) && Out.IsValid();
	}

	bool IsSuccess(const FHttpResponsePtr& Response, const bool bSucceeded)
	{
		return bSucceeded && Response.IsValid()
			&& Response->GetResponseCode() >= 200
			&& Response->GetResponseCode() < 300;
	}

	bool ConsumeLauncherTokenFile(FString& OutToken)
	{
		FString TokenPath;
		if (!FParse::Value(FCommandLine::Get(), TEXT("ConclaviaLauncherTokenFile="), TokenPath)
			|| TokenPath.IsEmpty())
		{
			return false;
		}

		if (!FFileHelper::LoadFileToString(OutToken, *TokenPath))
		{
			UE_LOG(LogFab, Error, TEXT("CONCLAVIA_LAUNCHER_TOKEN_FILE_FAILED:read"));
			return false;
		}

		OutToken.TrimStartAndEndInline();
		const int64 FileSize = IFileManager::Get().FileSize(*TokenPath);
		if (FileSize > 0)
		{
			TArray<uint8> Zeroes;
			Zeroes.SetNumZeroed(FileSize);
			FFileHelper::SaveArrayToFile(Zeroes, *TokenPath);
		}
		if (!IFileManager::Get().Delete(*TokenPath, false, true, true))
		{
			UE_LOG(LogFab, Warning, TEXT("CONCLAVIA_LAUNCHER_TOKEN_FILE_WARNING:delete"));
		}

		if (OutToken.IsEmpty())
		{
			UE_LOG(LogFab, Error, TEXT("CONCLAVIA_LAUNCHER_TOKEN_FILE_FAILED:empty"));
			return false;
		}

		UE_LOG(LogFab, Display, TEXT("CONCLAVIA_LAUNCHER_TOKEN_FILE_CONSUMED"));
		return true;
	}

	void StartPluginDownload(const FString& ManifestUrl, const TArray<FString>& BaseUrls)
	{
		const FString InstallRoot = FPaths::ConvertRelativePathToFull(FPaths::Combine(FPaths::EngineDir(), TEXT("..")));
		IFileManager::Get().MakeDirectory(*InstallRoot, true);

		const FString DownloadDescriptor = ManifestUrl + TEXT(",") + FString::Join(BaseUrls, TEXT(","));
		GMarkerlessDownload = MakeShared<FFabDownloadRequest>(
			ListingId,
			DownloadDescriptor,
			InstallRoot,
			EFabDownloadType::BuildPatchRequest);

		GMarkerlessDownload->OnDownloadProgress().AddLambda(
			[](const FFabDownloadRequest*, const FFabDownloadStats& Stats)
			{
				static int32 LastBucket = -1;
				const int32 Bucket = FMath::Clamp(FMath::FloorToInt(Stats.PercentComplete / 10.0f), 0, 10);
				if (Bucket != LastBucket)
				{
					LastBucket = Bucket;
					UE_LOG(LogFab, Display, TEXT("CONCLAVIA_MARKERLESS_PLUGIN_PROGRESS:%d"), Bucket * 10);
				}
			});

		GMarkerlessDownload->OnDownloadComplete().AddLambda(
			[](const FFabDownloadRequest*, const FFabDownloadStats& Stats)
			{
				if (Stats.bIsSuccess)
				{
					UE_LOG(LogFab, Display, TEXT("CONCLAVIA_MARKERLESS_PLUGIN_INSTALL_OK:files=%d"), Stats.DownloadedFiles.Num());
				}
				else
				{
					UE_LOG(LogFab, Error, TEXT("CONCLAVIA_MARKERLESS_PLUGIN_INSTALL_FAILED"));
				}
			});

		UE_LOG(LogFab, Display, TEXT("CONCLAVIA_MARKERLESS_PLUGIN_DOWNLOAD_STARTED"));
		GMarkerlessDownload->ExecuteRequest();
	}

	void RequestFabManifest(
		const FString& LauncherToken,
		const FString& ArtifactId,
		const FString& AssetNamespace,
		const FString& AssetId)
	{
		const FString Url = FString::Printf(
			TEXT("https://www.fab.com/e/artifacts/%s/manifest"),
			*ArtifactId);
		const TSharedRef<FJsonObject> Body = MakeShared<FJsonObject>();
		Body->SetStringField(TEXT("item_id"), AssetId);
		Body->SetStringField(TEXT("namespace"), AssetNamespace);
		Body->SetStringField(TEXT("platform"), TEXT("Windows"));
		FString SerializedBody;
		const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&SerializedBody);
		FJsonSerializer::Serialize(Body, Writer);

		TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
		Request->SetURL(Url);
		Request->SetVerb(TEXT("POST"));
		Request->SetHeader(TEXT("Accept"), TEXT("application/json"));
		Request->SetHeader(TEXT("Authorization"), TEXT("Bearer ") + LauncherToken);
		Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
		Request->SetHeader(TEXT("User-Agent"), LauncherUserAgent);
		Request->SetContentAsString(SerializedBody);
		Request->OnProcessRequestComplete().BindLambda(
			[ArtifactId](FHttpRequestPtr, FHttpResponsePtr Response, bool bSucceeded)
			{
				const int32 ResponseCode = Response.IsValid() ? Response->GetResponseCode() : 0;
				if (!IsSuccess(Response, bSucceeded))
				{
					UE_LOG(LogFab, Error, TEXT("CONCLAVIA_MARKERLESS_FAB_MANIFEST_FAILED:http=%d"), ResponseCode);
					return;
				}

				TSharedPtr<FJsonObject> Root;
				const TArray<TSharedPtr<FJsonValue>>* DownloadInfo = nullptr;
				if (!ParseObject(Response->GetContentAsString(), Root)
					|| !Root->TryGetArrayField(TEXT("downloadInfo"), DownloadInfo)
					|| DownloadInfo->IsEmpty())
				{
					UE_LOG(LogFab, Error, TEXT("CONCLAVIA_MARKERLESS_FAB_MANIFEST_FAILED:shape"));
					return;
				}

				TSharedPtr<FJsonObject> Selected;
				for (const TSharedPtr<FJsonValue>& Value : *DownloadInfo)
				{
					const TSharedPtr<FJsonObject> Candidate = Value->AsObject();
					FString CandidateArtifactId;
					if (Candidate.IsValid()
						&& Candidate->TryGetStringField(TEXT("artifactId"), CandidateArtifactId)
						&& CandidateArtifactId.Equals(ArtifactId, ESearchCase::IgnoreCase))
					{
						Selected = Candidate;
						break;
					}
				}
				if (!Selected.IsValid())
				{
					Selected = (*DownloadInfo)[0]->AsObject();
				}

				FString ManifestUrl;
				TArray<FString> BaseUrls;
				const TArray<TSharedPtr<FJsonValue>>* DistributionPoints = nullptr;
				if (Selected.IsValid()
					&& Selected->TryGetArrayField(TEXT("distributionPoints"), DistributionPoints))
				{
					for (const TSharedPtr<FJsonValue>& Value : *DistributionPoints)
					{
						const TSharedPtr<FJsonObject> Point = Value->AsObject();
						FString CandidateUrl;
						if (Point.IsValid()
							&& Point->TryGetStringField(TEXT("manifestUrl"), CandidateUrl)
							&& !CandidateUrl.IsEmpty())
						{
							if (ManifestUrl.IsEmpty())
							{
								ManifestUrl = CandidateUrl;
							}
							FString BaseUrl;
							if (CandidateUrl.Split(TEXT("/"), &BaseUrl, nullptr, ESearchCase::CaseSensitive, ESearchDir::FromEnd))
							{
								BaseUrls.AddUnique(BaseUrl);
							}
						}
					}
				}

				const TArray<TSharedPtr<FJsonValue>>* BaseUrlValues = nullptr;
				if (Selected.IsValid()
					&& Selected->TryGetArrayField(TEXT("distributionPointBaseUrls"), BaseUrlValues))
				{
					for (const TSharedPtr<FJsonValue>& Value : *BaseUrlValues)
					{
						const FString BaseUrl = Value->AsString();
						if (!BaseUrl.IsEmpty())
						{
							BaseUrls.AddUnique(BaseUrl);
						}
					}
				}

				if (ManifestUrl.IsEmpty() || BaseUrls.IsEmpty())
				{
					UE_LOG(LogFab, Error, TEXT("CONCLAVIA_MARKERLESS_FAB_MANIFEST_FAILED:no-distribution"));
					return;
				}

				UE_LOG(LogFab, Display, TEXT("CONCLAVIA_MARKERLESS_FAB_MANIFEST_OK:bases=%d"), BaseUrls.Num());
				StartPluginDownload(ManifestUrl, BaseUrls);
			});
		UE_LOG(LogFab, Display, TEXT("CONCLAVIA_MARKERLESS_FAB_MANIFEST_STARTED"));
		Request->ProcessRequest();
	}

	void RequestFabLibraryPage(
		const FString& LauncherToken,
		const FString& AccountId,
		const FString& Cursor = FString())
	{
		FString Url = FString::Printf(
			TEXT("https://www.fab.com/e/accounts/%s/ue/library?count=100"),
			*AccountId);
		if (!Cursor.IsEmpty())
		{
			Url += TEXT("&cursor=") + FGenericPlatformHttp::UrlEncode(Cursor);
		}

		TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
		Request->SetURL(Url);
		Request->SetVerb(TEXT("GET"));
		Request->SetHeader(TEXT("Accept"), TEXT("application/json"));
		Request->SetHeader(TEXT("Authorization"), TEXT("Bearer ") + LauncherToken);
		Request->SetHeader(TEXT("User-Agent"), LauncherUserAgent);
		Request->OnProcessRequestComplete().BindLambda(
			[LauncherToken, AccountId](FHttpRequestPtr, FHttpResponsePtr Response, bool bSucceeded)
			{
				const int32 ResponseCode = Response.IsValid() ? Response->GetResponseCode() : 0;
				if (!IsSuccess(Response, bSucceeded))
				{
					UE_LOG(LogFab, Error, TEXT("CONCLAVIA_MARKERLESS_FAB_LIBRARY_FAILED:http=%d"), ResponseCode);
					return;
				}

				TSharedPtr<FJsonObject> Root;
				const TArray<TSharedPtr<FJsonValue>>* Results = nullptr;
				if (!ParseObject(Response->GetContentAsString(), Root)
					|| !Root->TryGetArrayField(TEXT("results"), Results))
				{
					UE_LOG(LogFab, Error, TEXT("CONCLAVIA_MARKERLESS_FAB_LIBRARY_FAILED:shape"));
					return;
				}

				for (const TSharedPtr<FJsonValue>& Value : *Results)
				{
					const TSharedPtr<FJsonObject> Asset = Value->AsObject();
					FString AssetId;
					FString AssetNamespace;
					FString Title;
					FString ListingUrl;
					if (!Asset.IsValid()
						|| !Asset->TryGetStringField(TEXT("assetId"), AssetId)
						|| !Asset->TryGetStringField(TEXT("assetNamespace"), AssetNamespace))
					{
						continue;
					}
					Asset->TryGetStringField(TEXT("title"), Title);
					Asset->TryGetStringField(TEXT("url"), ListingUrl);
					const bool bIsMarkerless = AssetId.Equals(ListingId, ESearchCase::IgnoreCase)
						|| ListingUrl.Contains(ListingId, ESearchCase::IgnoreCase)
						|| Title.Contains(TEXT("Markerless Motion Capture"), ESearchCase::IgnoreCase);
					if (!bIsMarkerless)
					{
						continue;
					}

					FString SelectedArtifactId;
					FString FallbackArtifactId;
					const TArray<TSharedPtr<FJsonValue>>* ProjectVersions = nullptr;
					if (Asset->TryGetArrayField(TEXT("projectVersions"), ProjectVersions))
					{
						for (const TSharedPtr<FJsonValue>& VersionValue : *ProjectVersions)
						{
							const TSharedPtr<FJsonObject> Version = VersionValue->AsObject();
							FString ArtifactId;
							if (!Version.IsValid()
								|| !Version->TryGetStringField(TEXT("artifactId"), ArtifactId)
								|| ArtifactId.IsEmpty())
							{
								continue;
							}
							if (FallbackArtifactId.IsEmpty())
							{
								FallbackArtifactId = ArtifactId;
							}
							bool bMatches58 = ArtifactId.Equals(ExpectedAppName, ESearchCase::IgnoreCase);
							const TArray<TSharedPtr<FJsonValue>>* EngineVersions = nullptr;
							if (Version->TryGetArrayField(TEXT("engineVersions"), EngineVersions))
							{
								for (const TSharedPtr<FJsonValue>& EngineVersion : *EngineVersions)
								{
									bMatches58 |= EngineVersion->AsString().StartsWith(TEXT("5.8"));
								}
							}
							if (bMatches58)
							{
								SelectedArtifactId = ArtifactId;
								break;
							}
						}
					}
					if (SelectedArtifactId.IsEmpty())
					{
						SelectedArtifactId = FallbackArtifactId;
					}
					if (!SelectedArtifactId.IsEmpty())
					{
						UE_LOG(LogFab, Display, TEXT("CONCLAVIA_MARKERLESS_FAB_LIBRARY_FOUND"));
						RequestFabManifest(LauncherToken, SelectedArtifactId, AssetNamespace, AssetId);
						return;
					}
				}

				const TSharedPtr<FJsonObject>* Cursors = nullptr;
				FString NextCursor;
				if (Root->TryGetObjectField(TEXT("cursors"), Cursors)
					&& Cursors
					&& Cursors->IsValid())
				{
					(*Cursors)->TryGetStringField(TEXT("next"), NextCursor);
				}
				if (!NextCursor.IsEmpty())
				{
					UE_LOG(LogFab, Display, TEXT("CONCLAVIA_MARKERLESS_FAB_LIBRARY_NEXT"));
					RequestFabLibraryPage(LauncherToken, AccountId, NextCursor);
					return;
				}

				UE_LOG(LogFab, Error, TEXT("CONCLAVIA_MARKERLESS_FAB_LIBRARY_NOT_FOUND"));
			});
		UE_LOG(LogFab, Display, TEXT("CONCLAVIA_MARKERLESS_FAB_LIBRARY_STARTED"));
		Request->ProcessRequest();
	}

	void RequestEpicAccount(const FString& LauncherToken)
	{
		TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
		Request->SetURL(TEXT("https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/verify"));
		Request->SetVerb(TEXT("GET"));
		Request->SetHeader(TEXT("Accept"), TEXT("application/json"));
		Request->SetHeader(TEXT("Authorization"), TEXT("Bearer ") + LauncherToken);
		Request->SetHeader(TEXT("User-Agent"), LauncherUserAgent);
		Request->OnProcessRequestComplete().BindLambda(
			[LauncherToken](FHttpRequestPtr, FHttpResponsePtr Response, bool bSucceeded)
			{
				const int32 ResponseCode = Response.IsValid() ? Response->GetResponseCode() : 0;
				TSharedPtr<FJsonObject> Root;
				FString AccountId;
				if (!IsSuccess(Response, bSucceeded)
					|| !ParseObject(Response->GetContentAsString(), Root)
					|| !Root->TryGetStringField(TEXT("account_id"), AccountId)
					|| AccountId.IsEmpty())
				{
					UE_LOG(LogFab, Error, TEXT("CONCLAVIA_LAUNCHER_ACCOUNT_FAILED:http=%d"), ResponseCode);
					return;
				}
				UE_LOG(LogFab, Display, TEXT("CONCLAVIA_LAUNCHER_ACCOUNT_OK"));
				RequestFabLibraryPage(LauncherToken, AccountId);
			});
		UE_LOG(LogFab, Display, TEXT("CONCLAVIA_LAUNCHER_ACCOUNT_STARTED"));
		Request->ProcessRequest();
	}

}

void FabMarkerlessBootstrap::Begin(const FString& AccessToken)
{
	(void)AccessToken;
	if (!FParse::Param(FCommandLine::Get(), TEXT("ConclaviaInstallMarkerless")))
	{
		return;
	}
	if (GMarkerlessBootstrapStarted)
	{
		return;
	}
	GMarkerlessBootstrapStarted = true;

	FString LauncherToken;
	if (ConsumeLauncherTokenFile(LauncherToken))
	{
		UE_LOG(LogFab, Display, TEXT("CONCLAVIA_LAUNCHER_TOKEN_READY"));
		RequestEpicAccount(LauncherToken);
		return;
	}

	UE_LOG(LogFab, Error, TEXT("CONCLAVIA_MARKERLESS_ASSETS_FAILED:missing-launcher-token-file"));
}
