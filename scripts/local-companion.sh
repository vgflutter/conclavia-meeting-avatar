#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO_ROOT"

RUNTIME_DIR="$REPO_ROOT/.conclavia/runtime"
PID_FILE="$RUNTIME_DIR/companion.pid"
STDOUT_LOG="$RUNTIME_DIR/companion.stdout.log"
STDERR_LOG="$RUNTIME_DIR/companion.stderr.log"
PLIST_FILE="$RUNTIME_DIR/com.conclavia.meeting-avatar.companion.plist"
LAUNCH_LABEL="com.conclavia.meeting-avatar.companion"
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

stop_companion() {
  launchctl bootout "$LAUNCH_DOMAIN/$LAUNCH_LABEL" >/dev/null 2>&1 || true

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
  REPO_ROOT="$REPO_ROOT" \
  NODE_BIN=$(command -v node) \
  RUNTIME_PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
  STDOUT_LOG="$STDOUT_LOG" \
  STDERR_LOG="$STDERR_LOG" \
  PLIST_FILE="$PLIST_FILE" \
  LAUNCH_LABEL="$LAUNCH_LABEL" node <<'NODE'
const fs = require("node:fs");
const escapeXml = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");
const values = Object.fromEntries(
  ["REPO_ROOT", "NODE_BIN", "RUNTIME_PATH", "STDOUT_LOG", "STDERR_LOG", "PLIST_FILE", "LAUNCH_LABEL"]
    .map((key) => [key, escapeXml(process.env[key] || "")]),
);
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${values.LAUNCH_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${values.NODE_BIN}</string>
    <string>--env-file-if-exists=.env</string>
    <string>dist/cli.js</string>
    <string>serve</string>
  </array>
  <key>WorkingDirectory</key><string>${values.REPO_ROOT}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>${values.RUNTIME_PATH}</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>${values.STDOUT_LOG}</string>
  <key>StandardErrorPath</key><string>${values.STDERR_LOG}</string>
</dict>
</plist>
`;
fs.writeFileSync(process.env.PLIST_FILE, plist, { mode: 0o600 });
NODE
  : > "$STDOUT_LOG"
  : > "$STDERR_LOG"
  chmod 600 "$PLIST_FILE" "$STDOUT_LOG" "$STDERR_LOG"
  launchctl bootstrap "$LAUNCH_DOMAIN" "$PLIST_FILE"

  for _ in $(seq 1 100); do
    if is_companion_api; then
      local pid
      pid=$(listening_pid)
      printf '%s\n' "$pid" > "$PID_FILE"
      chmod 600 "$PID_FILE"
      echo "$BASE_URL"
      return
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
