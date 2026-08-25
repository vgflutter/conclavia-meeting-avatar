#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO_ROOT"

COMPANION_URL=${CONCLAVIA_COMPANION_URL:-http://127.0.0.1:4310}
REQUIRE_RENDERER=${CONCLAVIA_E2E_REQUIRE_RENDERER:-true}
RUNTIME_DIR="$REPO_ROOT/.conclavia/runtime/e2e"
QUESTION_SOURCE="$RUNTIME_DIR/mary-two-plus-two-source.aiff"
QUESTION_AUDIO="$RUNTIME_DIR/mary-two-plus-two-padded.wav"
COREAUDIO_PLAYER="$RUNTIME_DIR/coreaudio-play"
mkdir -p "$RUNTIME_DIR"

for command in curl ffmpeg jq say xcrun; do
  command -v "$command" >/dev/null || {
    echo "Comando richiesto non trovato: $command" >&2
    exit 1
  }
done

listener=$(curl --fail --silent "$COMPANION_URL/api/listener/status")
audio_device=$(printf '%s' "$listener" | jq -r '.audioDevice')

if [[ ! -x "$COREAUDIO_PLAYER" || scripts/coreaudio-play.swift -nt "$COREAUDIO_PLAYER" ]]; then
  xcrun swiftc scripts/coreaudio-play.swift -o "$COREAUDIO_PLAYER"
fi

# Alice pronounces the English spelling "Mary" like the Italian word "dimmi".
# "Meri" produces the intended spoken wake word and is transcribed as "Mary".
say -v Alice -r 165 -o "$QUESTION_SOURCE" "Meri, quanto fa due più due?"
ffmpeg -nostdin -hide_banner -loglevel error -y -i "$QUESTION_SOURCE" \
  -af "adelay=800,apad=pad_dur=0.8" -ar 24000 -ac 1 "$QUESTION_AUDIO"

# Begin from an empty session, then wait until the capture clock is advancing.
curl --fail --silent --request DELETE "$COMPANION_URL/api/listener/session" >/dev/null
listener=$(curl --fail --silent --request POST "$COMPANION_URL/api/listener/start")
ready_bytes=$(printf '%s' "$listener" | jq -r '.capturedAudioBytes')
for _ in $(seq 1 20); do
  candidate=$(curl --fail --silent "$COMPANION_URL/api/listener/status")
  if [[ $(printf '%s' "$candidate" | jq -r '.capturedAudioBytes') -gt "$ready_bytes" ]]; then
    listener=$candidate
    break
  fi
  sleep 0.1
done
baseline_turns=$(printf '%s' "$listener" | jq -r '.completedTurns')
baseline_id=$(printf '%s' "$listener" | jq -r '.lastSegment.id // ""')

# Feed the exact CoreAudio device used by Meet into the real continuous
# listener. This validates capture, VAD, transcription, wake word, LLM and the
# renderer delivery contract without changing the user's default devices.
"$COREAUDIO_PLAYER" "$audio_device" "$QUESTION_AUDIO"

result=""
last_candidate=""
for _ in $(seq 1 60); do
  candidate=$(curl --fail --silent "$COMPANION_URL/api/listener/status")
  last_candidate=$candidate
  turns=$(printf '%s' "$candidate" | jq -r '.completedTurns')
  segment_id=$(printf '%s' "$candidate" | jq -r '.lastSegment.id // ""')
  if [[ "$turns" -gt "$baseline_turns" && "$segment_id" != "$baseline_id" ]]; then
    transcript=$(printf '%s' "$candidate" | jq -r '.lastSegment.text // ""')
    answer=$(printf '%s' "$candidate" | jq -r '[.lastResult.decision.cue.sentences[]?.text] | join(" ")')
    if printf '%s' "$transcript" | tr '[:upper:]' '[:lower:]' | grep -Eq 'mary.*(2|due).*(2|due)' \
      && printf '%s' "$answer" | tr '[:upper:]' '[:lower:]' | grep -Eq '(^|[^0-9])4([^0-9]|$)|quattro'; then
      result=$candidate
      break
    fi
  fi
  sleep 0.25
done

if [[ -z "$result" ]]; then
  echo "E2E fallito: domanda o risposta attesa non rilevata entro 15 secondi." >&2
  printf '%s' "${last_candidate:-$(curl --fail --silent "$COMPANION_URL/api/listener/status")}" \
    | jq '{model, turnDetection, audioRms, committedAudioTurns, confirmedAudioTurns, lastRawTranscript, lastError}' >&2
  exit 1
fi

transcript=$(printf '%s' "$result" | jq -r '.lastSegment.text // ""')
answer=$(printf '%s' "$result" | jq -r '[.lastResult.decision.cue.sentences[]?.text] | join(" ")')
delivered=$(printf '%s' "$result" | jq -r '.lastResult.renderer.delivery.delivered // false')

if ! printf '%s' "$transcript" | tr '[:upper:]' '[:lower:]' | grep -Eq 'mary.*(2|due).*(2|due)'; then
  echo "E2E fallito: trascrizione inattesa: $transcript" >&2
  exit 1
fi
if ! printf '%s' "$answer" | tr '[:upper:]' '[:lower:]' | grep -Eq '(^|[^0-9])4([^0-9]|$)|quattro'; then
  echo "E2E fallito: risposta inattesa: $answer" >&2
  exit 1
fi
if [[ "$REQUIRE_RENDERER" == "true" && "$delivered" != "true" ]]; then
  echo "E2E fallito: cue audio/labiale non consegnato al renderer." >&2
  exit 1
fi

printf '%s' "$result" | jq --argjson rendererRequired "$REQUIRE_RENDERER" '{
  passed: true,
  rendererRequired: $rendererRequired,
  model,
  turnDetection,
  transcript: .lastSegment.text,
  answer: ([.lastResult.decision.cue.sentences[]?.text] | join(" ")),
  latency: .lastResult.latency,
  delivery: .lastResult.renderer.delivery
}'
