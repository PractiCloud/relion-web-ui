#!/bin/bash
# Stop the RELION Web UI 5 local backend.

set -euo pipefail

INSTALL_ROOT="${RELION_INSTALL_ROOT:-$HOME/.relion-web-ui}"
PID_FILE="$INSTALL_ROOT/gunicorn.pid"

if [[ ! -f "$PID_FILE" ]]; then
    echo "no pid file at $PID_FILE. maybe already stopped?"
    exit 0
fi

pid=$(cat "$PID_FILE")

if ! kill -0 "$pid" 2>/dev/null; then
    echo "pid $pid not running, cleaning up stale pid file"
    rm -f "$PID_FILE"
    exit 0
fi

echo "stopping pid $pid (SIGTERM)..."
kill -TERM "$pid" 2>/dev/null || true

# Wait up to 15s for graceful shutdown.
for _ in {1..15}; do
    if ! kill -0 "$pid" 2>/dev/null; then
        rm -f "$PID_FILE"
        echo "stopped"
        exit 0
    fi
    sleep 1
done

echo "still alive after 15s, sending SIGKILL"
kill -KILL "$pid" 2>/dev/null || true
rm -f "$PID_FILE"
echo "killed"
