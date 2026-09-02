#!/bin/sh
set -eu

VECTOR_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
RUNTIME_FILE="$VECTOR_ROOT/.vector-runtime.pid"
QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

if [ ! -f "$RUNTIME_FILE" ]; then
  [ "$QUIET" -eq 1 ] || echo "Vector is not recorded as running."
  exit 0
fi

read -r PID EXPECTED_TICKS <"$RUNTIME_FILE" || true
case "${PID:-}" in *[!0-9]*|'') rm -f -- "$RUNTIME_FILE"; echo "Invalid Vector runtime record." >&2; exit 1;; esac

if [ -r "/proc/$PID/stat" ]; then
  ACTUAL_TICKS=$(awk '{ print $22 }' "/proc/$PID/stat")
  if [ "$ACTUAL_TICKS" = "${EXPECTED_TICKS:-}" ]; then
    PGID=$(ps -o pgid= -p "$PID" | tr -d ' ')
    if [ "$PGID" = "$PID" ]; then kill -TERM -- "-$PID" 2>/dev/null || true
    else kill -TERM "$PID" 2>/dev/null || true
    fi
    ATTEMPT=0
    while kill -0 "$PID" 2>/dev/null && [ "$ATTEMPT" -lt 20 ]; do sleep 0.1; ATTEMPT=$((ATTEMPT + 1)); done
    if kill -0 "$PID" 2>/dev/null; then
      if [ "$PGID" = "$PID" ]; then kill -KILL -- "-$PID" 2>/dev/null || true
      else kill -KILL "$PID" 2>/dev/null || true
      fi
    fi
    [ "$QUIET" -eq 1 ] || echo "Vector stopped cleanly."
  else
    echo "Vector runtime PID was reused; no process was stopped." >&2
  fi
else
  [ "$QUIET" -eq 1 ] || echo "The recorded Vector process was already stopped."
fi
rm -f -- "$RUNTIME_FILE"
