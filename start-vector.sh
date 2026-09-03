#!/bin/sh
set -eu

VECTOR_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PRESENCE_ROOT="$VECTOR_ROOT/presence"
RUNTIME_FILE="$VECTOR_ROOT/.vector-runtime.pid"
LOG_FILE="$VECTOR_ROOT/vector-runtime.log"
VECTOR_URL="http://127.0.0.1:3000/"
AGENT_URL="http://127.0.0.1:4317/health"
OPEN_BROWSER=1

if [ "${1:-}" = "--no-browser" ]; then
  OPEN_BROWSER=0
elif [ "$#" -gt 0 ]; then
  echo "Usage: $0 [--no-browser]" >&2
  exit 2
fi

vector_ready() {
  curl --fail --silent --show-error --max-time 2 "$VECTOR_URL" >/dev/null 2>&1 &&
  curl --fail --silent --show-error --max-time 2 "$AGENT_URL" >/dev/null 2>&1
}

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required. See SETUP.md." >&2
  exit 1
fi
for REQUIRED_COMMAND in curl awk ps setsid; do
  if ! command -v "$REQUIRED_COMMAND" >/dev/null 2>&1; then
    echo "$REQUIRED_COMMAND is required. See SETUP.md." >&2
    exit 1
  fi
done

if ! vector_ready; then
  "$VECTOR_ROOT/stop-vector.sh" --quiet
  if [ ! -f "$PRESENCE_ROOT/node_modules/vinext/dist/cli.js" ]; then
    echo "Preparing Vector for first launch..."
    npm ci --prefix "$PRESENCE_ROOT"
  fi

  (
    cd "$VECTOR_ROOT"
    exec setsid node scripts/vector-runtime.cjs
  ) >"$LOG_FILE" 2>&1 &
  SERVER_PID=$!
  if [ ! -r "/proc/$SERVER_PID/stat" ]; then
    echo "Vector's server exited during startup. Inspect $LOG_FILE" >&2
    exit 1
  fi
  START_TICKS=$(awk '{ print $22 }' "/proc/$SERVER_PID/stat")
  RUNTIME_TEMP="$RUNTIME_FILE.$$"
  printf '%s %s\n' "$SERVER_PID" "$START_TICKS" >"$RUNTIME_TEMP"
  mv -f -- "$RUNTIME_TEMP" "$RUNTIME_FILE"

  READY=0
  ATTEMPT=0
  while [ "$ATTEMPT" -lt 120 ]; do
    sleep 0.5
    if vector_ready; then READY=1; break; fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then break; fi
    ATTEMPT=$((ATTEMPT + 1))
  done
  if [ "$READY" -ne 1 ]; then
    "$VECTOR_ROOT/stop-vector.sh" --quiet
    echo "Vector did not become ready. Inspect $LOG_FILE" >&2
    exit 1
  fi
fi

echo "Vector is ready at $VECTOR_URL"
if [ "$OPEN_BROWSER" -eq 1 ] && command -v xdg-open >/dev/null 2>&1 && { [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ]; }; then
  xdg-open "$VECTOR_URL" >/dev/null 2>&1 &
fi
