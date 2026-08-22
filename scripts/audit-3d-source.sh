#!/usr/bin/env bash

set -euo pipefail

AWS_REGION="${CONCLAVIA_AWS_REGION:-${AWS_REGION:-eu-central-1}}"
AWS_PROFILE="${CONCLAVIA_AWS_PROFILE:-${AWS_PROFILE:-conclavia-studio}}"
INSTANCE_ID="${UNREAL_STUDIO_INSTANCE_ID:-i-033248199865f3e6e}"
PROJECT_ROOT=$(git rev-parse --show-toplevel)
REVISION=$(git -C "$PROJECT_ROOT" rev-parse HEAD)
export AWS_PROFILE

if [[ -n "$(git -C "$PROJECT_ROOT" status --porcelain --untracked-files=normal)" ]]; then
  echo "Audit non conclusivo: il repository contiene modifiche non committate."
  exit 1
fi

MAIN_SOURCE="$PROJECT_ROOT/unreal/ConclaviaStudio/Source/ConclaviaStudio/Private/ConclaviaStudioModule.cpp"
SUPERVISOR="$PROJECT_ROOT/unreal/ConclaviaStudio/Scripts/Start-StudioSupervisor.ps1"
LOCAL_MAIN_SHA=$(shasum -a 256 "$MAIN_SOURCE" | awk '{print $1}')
LOCAL_SUPERVISOR_SHA=$(shasum -a 256 "$SUPERVISOR" | awk '{print $1}')
PARAMETERS=$(node <<'NODE'
process.stdout.write(JSON.stringify({ commands: [
  '$ErrorActionPreference = "Stop"',
  '$revision = Get-Content "C:\\ConclaviaStudio\\Saved\\source-revision.json" -Raw | ConvertFrom-Json',
  '$main = (Get-FileHash "C:\\ConclaviaStudio\\Source\\ConclaviaStudio\\Private\\ConclaviaStudioModule.cpp" -Algorithm SHA256).Hash.ToLowerInvariant()',
  '$supervisor = (Get-FileHash "C:\\ConclaviaStudio\\Scripts\\Start-StudioSupervisor.ps1" -Algorithm SHA256).Hash.ToLowerInvariant()',
  '@{ commit = $revision.commit; mainSha256 = $main; supervisorSha256 = $supervisor } | ConvertTo-Json -Compress',
] }));
NODE
)
COMMAND_ID=$(aws ssm send-command \
  --region "$AWS_REGION" \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunPowerShellScript \
  --parameters "$PARAMETERS" \
  --query Command.CommandId \
  --output text)
aws ssm wait command-executed \
  --region "$AWS_REGION" \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID"
RESULT=$(aws ssm get-command-invocation \
  --region "$AWS_REGION" \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --query StandardOutputContent \
  --output text | tr -d '\r')

REVISION="$REVISION" \
LOCAL_MAIN_SHA="$LOCAL_MAIN_SHA" \
LOCAL_SUPERVISOR_SHA="$LOCAL_SUPERVISOR_SHA" \
REMOTE_RESULT="$RESULT" node <<'NODE'
const lines = (process.env.REMOTE_RESULT || "").trim().split(/\n/).filter(Boolean);
const result = JSON.parse(lines.at(-1) || "{}");
const expected = {
  commit: process.env.REVISION,
  mainSha256: process.env.LOCAL_MAIN_SHA,
  supervisorSha256: process.env.LOCAL_SUPERVISOR_SHA,
};
for (const [key, value] of Object.entries(expected)) {
  if (result[key] !== value) {
    throw new Error(`AWS source audit failed for ${key}: expected ${value}, received ${result[key] || "missing"}`);
  }
}
console.log(`AWS source matches committed revision ${expected.commit}.`);
NODE
