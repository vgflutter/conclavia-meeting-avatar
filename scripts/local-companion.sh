#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO_ROOT"

RUNTIME_DIR="$REPO_ROOT/.conclavia/runtime"
PID_FILE="$RUNTIME_DIR/companion.pid"
STDOUT_LOG="$RUNTIME_DIR/companion.stdout.log"
STDERR_LOG="$RUNTIME_DIR/companion.stderr.log"
LAUNCH_LABEL="com.conclavia.meeting-avatar.companion"
PLIST_FILE="$HOME/Library/LaunchAgents/$LAUNCH_LABEL.plist"
LAUNCH_DOMAIN="gui/$(id -u)"
PORT=$(node --env-file-if-exists=.env -e 'process.stdout.write(process.env.PORT || "4310")')
BASE_URL="http://127.0.0.1:$PORT"

is_companion_api() {
  curl --fail --silent --max-time 3 "$BASE_URL/api/health" 2>/dev/null \
    | node -e 'let body=""; process.stdin.on("data", (chunk) => body += chunk).on("end", () => { try { process.exit(JSON.parse(body).service === "conclavia-meeting-avatar" ? 0 : 1); } catch { process.exit(1); } });'
}

listening_pid() {
  lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true
}

is_service_loaded() {
  launchctl print "$LAUNCH_DOMAIN/$LAUNCH_LABEL" >/dev/null 2>&1
}

wait_for_service_unload() {
  for _ in $(seq 1 50); do
    if ! is_service_loaded; then
      return 0
    fi
    sleep 0.1
  done

  return 1
}

stop_companion() {
  launchctl bootout "$LAUNCH_DOMAIN/$LAUNCH_LABEL" >/dev/null 2>&1 || true

  # launchctl may release the listening socket before it has removed the job
  # from the GUI domain. Starting a new plist in that short window fails with
  # the unhelpful `Bootstrap failed: 5: Input/output error` message.
  if ! wait_for_service_unload; then
    launchctl bootout "$LAUNCH_DOMAIN" "$PLIST_FILE" >/dev/null 2>&1 || true
    if ! wait_for_service_unload; then
      echo "Il servizio launchd del companion non ha completato l'arresto." >&2
      return 1
    fi
  fi
  rm -f "$PLIST_FILE"

  local pid=""
  for _ in $(seq 1 30); do
    pid=$(listening_pid)
    [[ -z "$pid" ]] && break
    sleep 0.1
  done
  pid=$(listening_pid)
  if [[ -z "$pid" ]]; then
    rm -f "$PID_FILE"
    return
  fi

  # Never terminate an unrelated service that happens to use the configured
  # port. A healthy Conclavia API or this repository as the process cwd is
  # required before the process is considered ours.
  local cwd=""
  cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1 || true)
  if ! is_companion_api && [[ "$cwd" != "$REPO_ROOT" ]]; then
    echo "La porta $PORT è occupata da un altro processo; il companion non è stato arrestato." >&2
    return 1
  fi

  kill -TERM "$pid" 2>/dev/null || true
  for _ in $(seq 1 30); do
    if ! kill -0 "$pid" 2>/dev/null; then
      break
    fi
    sleep 0.1
  done
  if kill -0 "$pid" 2>/dev/null; then
    echo "Il companion locale non ha completato l'arresto." >&2
    return 1
  fi
  rm -f "$PID_FILE"
}

start_companion() {
  mkdir -p "$RUNTIME_DIR"
  chmod 700 "$RUNTIME_DIR"
  stop_companion

  npm run build
  : > "$STDOUT_LOG"
  : > "$STDERR_LOG"
  chmod 600 "$STDOUT_LOG" "$STDERR_LOG"

  # Microphone access is attributed by macOS TCC to the responsible interactive
  # application. A launchd daemon can open BlackHole but receives unusable audio.
  # Starting this detached child from the user's studio command preserves the
  # already-authorized Terminal/IDE context while keeping the companion alive.
  nohup "$(command -v node)" --env-file-if-exists=.env dist/cli.js serve \
    >"$STDOUT_LOG" 2>"$STDERR_LOG" </dev/null &
  local companion_pid=$!
  printf '%s\n' "$companion_pid" > "$PID_FILE"
  chmod 600 "$PID_FILE"

  for _ in $(seq 1 100); do
    if is_companion_api; then
      echo "$BASE_URL"
      return
    fi
    if ! kill -0 "$companion_pid" 2>/dev/null; then
      break
    fi
    sleep 0.1
  done

  echo "Il companion locale non è diventato disponibile su $BASE_URL." >&2
  tail -n 30 "$STDERR_LOG" >&2 || true
  tail -n 30 "$STDOUT_LOG" >&2 || true
  return 1
}

case "${1:-}" in
  start)
    start_companion
    ;;
  stop)
    stop_companion
    ;;
  status)
    if is_companion_api; then
      echo "ready $BASE_URL"
    else
      echo "stopped $BASE_URL"
      exit 1
    fi
    ;;
  *)
    echo "Uso: $0 {start|stop|status}" >&2
    exit 2
    ;;
esac
