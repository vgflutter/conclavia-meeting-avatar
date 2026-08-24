#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIRECTORY="$(cd "$SCRIPT_DIRECTORY/.." && pwd)"
EXTENSION_DIRECTORY="$PROJECT_DIRECTORY/adapters/google-meet/extension"

if [[ ! -d "$EXTENSION_DIRECTORY" ]]; then
  echo "Estensione Google Meet non trovata: $EXTENSION_DIRECTORY" >&2
  exit 1
fi

open -a "Google Chrome" "chrome://extensions"
open "$EXTENSION_DIRECTORY"

echo "Chrome e la cartella del bridge sono aperti."
echo "Attiva Modalità sviluppatore, scegli Carica estensione non pacchettizzata e seleziona:"
echo "$EXTENSION_DIRECTORY"
