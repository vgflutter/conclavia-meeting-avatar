#!/usr/bin/env bash

set -euo pipefail

AWS_REGION="${CONCLAVIA_AWS_REGION:-${AWS_REGION:-eu-central-1}}"
AWS_PROFILE="${CONCLAVIA_AWS_PROFILE:-${AWS_PROFILE:-conclavia-studio}}"
INSTANCE_ID="${UNREAL_STUDIO_INSTANCE_ID:-i-033248199865f3e6e}"
SOURCE_BUCKET="${CONCLAVIA_STUDIO_AUTOMATION_BUCKET:-conclavia-unreal-poc-transfer-194000006241}"
PROJECT_ROOT=$(git rev-parse --show-toplevel)
REVISION=$(git -C "$PROJECT_ROOT" rev-parse HEAD)
export AWS_PROFILE

if [[ -n "$(git -C "$PROJECT_ROOT" status --porcelain --untracked-files=normal)" ]]; then
  echo "Rifiuto il deploy: il repository contiene modifiche non committate."
  exit 1
fi
if ! aws sts get-caller-identity --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "Profilo AWS $AWS_PROFILE non disponibile."
  exit 1
fi

DEPLOY_DIR=$(mktemp -d "${TMPDIR:-/tmp}/conclavia-source-deploy.XXXXXX")
trap 'rm -rf "$DEPLOY_DIR"' EXIT
ARCHIVE="$DEPLOY_DIR/conclavia-studio-source.zip"
MANIFEST="$DEPLOY_DIR/source-revision.json"

REVISION="$REVISION" node <<'NODE' > "$MANIFEST"
const { execFileSync } = require("node:child_process");
const commit = process.env.REVISION;
const createdAt = new Date().toISOString();
const trackedTree = execFileSync("git", ["rev-parse", `${commit}^{tree}`], { encoding: "utf8" }).trim();
process.stdout.write(`${JSON.stringify({ commit, trackedTree, createdAt }, null, 2)}\n`);
NODE

mkdir -p "$DEPLOY_DIR/payload/ConclaviaStudio/Saved"
cp "$MANIFEST" "$DEPLOY_DIR/payload/ConclaviaStudio/Saved/source-revision.json"
for path in Config Content Scripts Source SourceAssets ConclaviaStudio.uproject README.md; do
  cp -R "$PROJECT_ROOT/unreal/ConclaviaStudio/$path" "$DEPLOY_DIR/payload/ConclaviaStudio/"
done
(
  cd "$DEPLOY_DIR/payload"
  zip -qr "$ARCHIVE" ConclaviaStudio
)
ARCHIVE_SHA=$(shasum -a 256 "$ARCHIVE" | awk '{print $1}')
OBJECT_KEY="source/$REVISION/conclavia-studio-source.zip"

echo "Pubblico il sorgente Unreal versionato $REVISION…"
aws s3 cp "$ARCHIVE" "s3://$SOURCE_BUCKET/$OBJECT_KEY" \
  --region "$AWS_REGION" \
  --only-show-errors
SOURCE_URL=$(aws s3 presign "s3://$SOURCE_BUCKET/$OBJECT_KEY" \
  --region "$AWS_REGION" \
  --expires-in 3600)

PARAMETERS=$(SOURCE_URL="$SOURCE_URL" REVISION="$REVISION" ARCHIVE_SHA="$ARCHIVE_SHA" node <<'NODE'
const url = process.env.SOURCE_URL;
const revision = process.env.REVISION;
const archiveSha = process.env.ARCHIVE_SHA;
const q = (value) => value.replaceAll("'", "''");
const commands = [
  '$ErrorActionPreference = "Stop"',
  '$root = "C:\\ConclaviaStudio"',
  '$deploy = Join-Path $root "Saved\\SourceDeploy"',
  '$archive = Join-Path $deploy "source.zip"',
  '$stage = Join-Path $deploy "stage"',
  'New-Item -ItemType Directory -Path $deploy -Force | Out-Null',
  `Invoke-WebRequest -Uri '${q(url)}' -OutFile $archive -UseBasicParsing`,
  `$actual = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant(); if ($actual -ne '${archiveSha}') { throw "Source archive checksum mismatch." }`,
  'Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue',
  'Expand-Archive -Path $archive -DestinationPath $stage -Force',
  '$incoming = Join-Path $stage "ConclaviaStudio"',
  'if (-not (Test-Path (Join-Path $incoming "Source\\ConclaviaStudio\\Private\\ConclaviaStudioModule.cpp"))) { throw "Source archive is incomplete." }',
  'Stop-ScheduledTask -TaskName "ConclaviaStudioSupervisor" -ErrorAction SilentlyContinue',
  'try { & (Join-Path $root "Scripts\\Stop-ReviewStream.ps1") | Out-Null } catch {}',
  'Remove-Item (Join-Path $root "Source") -Recurse -Force -ErrorAction SilentlyContinue',
  'Remove-Item (Join-Path $root "Scripts") -Recurse -Force -ErrorAction SilentlyContinue',
  'Copy-Item (Join-Path $incoming "Source") $root -Recurse -Force',
  'Copy-Item (Join-Path $incoming "Scripts") $root -Recurse -Force',
  'Copy-Item (Join-Path $incoming "Config") $root -Recurse -Force',
  'Copy-Item (Join-Path $incoming "SourceAssets") $root -Recurse -Force',
  'Copy-Item (Join-Path $incoming "Content\\*") (Join-Path $root "Content") -Recurse -Force',
  'Copy-Item (Join-Path $incoming "ConclaviaStudio.uproject") $root -Force',
  'Copy-Item (Join-Path $incoming "README.md") $root -Force',
  '$build = "C:\\Epic\\UE_5.8\\Engine\\Build\\BatchFiles\\Build.bat"',
  '& $build ConclaviaStudioEditor Win64 Development "-Project=C:\\ConclaviaStudio\\ConclaviaStudio.uproject" -WaitMutex -NoHotReloadFromIDE',
  'if ($LASTEXITCODE -ne 0) { throw "Unreal build failed with exit code $LASTEXITCODE." }',
  'Copy-Item (Join-Path $incoming "Saved\\source-revision.json") (Join-Path $root "Saved\\source-revision.json") -Force',
  'Start-ScheduledTask -TaskName "ConclaviaStudioSupervisor"',
  `@{ ok = $true; commit = '${revision}'; archiveSha256 = '${archiveSha}' } | ConvertTo-Json -Compress`,
];
process.stdout.write(JSON.stringify({ commands, executionTimeout: ["3600"] }));
NODE
)

COMMAND_ID=$(aws ssm send-command \
  --region "$AWS_REGION" \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunPowerShellScript \
  --parameters "$PARAMETERS" \
  --timeout-seconds 3600 \
  --query Command.CommandId \
  --output text)
aws ssm wait command-executed \
  --region "$AWS_REGION" \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID"
STATUS=$(aws ssm get-command-invocation \
  --region "$AWS_REGION" \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --query Status \
  --output text)
if [[ "$STATUS" != "Success" ]]; then
  aws ssm get-command-invocation \
    --region "$AWS_REGION" \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --query 'StandardErrorContent' \
    --output text >&2
  exit 1
fi

echo "Sorgente $REVISION compilato e installato su $INSTANCE_ID."
"$PROJECT_ROOT/scripts/audit-3d-source.sh"
