#!/bin/bash
# Launch the RELION Web UI 5 backend on localhost:5000.
# Run as your own user. Detaches gunicorn in the background.
# Log at $HOME/.relion-web-ui/gunicorn.log, PID at $HOME/.relion-web-ui/gunicorn.pid.

set -euo pipefail

INSTALL_ROOT="${RELION_INSTALL_ROOT:-$HOME/.relion-web-ui}"
VENV_DIR="$INSTALL_ROOT/venv"
BACKEND_DIR="$INSTALL_ROOT/backend"
PID_FILE="$INSTALL_ROOT/gunicorn.pid"
LOG_FILE="$INSTALL_ROOT/gunicorn.log"

# Already running?
if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "already running (pid $(cat "$PID_FILE"))"
    echo "URL: http://localhost:5000/"
    exit 0
fi

# Force local mode + Flask static serving + WSGI stub (matches v0.2 headless).
export RELION_EXECUTION_MODE=local
export RELION_SERVE_FRONTEND=1
export RELION_DEPLOYMENT_MODE=local
export RELION_WSGI=1
export RELION_HOST=127.0.0.1
export RELION_BACKEND_PORT=5000

# Load user env (may set RELION_BIN_PATH, RELION_CONTAINER, etc.)
if [[ -f "$INSTALL_ROOT/relion-web-ui.env" ]]; then
    set -a; source "$INSTALL_ROOT/relion-web-ui.env"; set +a
fi

# The backend's /api/serve_frontend route needs the static build next to it.
# We copied it under $INSTALL_ROOT/frontend; symlink it in place.
if [[ ! -L "$BACKEND_DIR/../frontend" ]] && [[ -d "$INSTALL_ROOT/frontend" ]]; then
    ln -sf "$INSTALL_ROOT/frontend" "$BACKEND_DIR/../frontend" 2>/dev/null || true
fi

cd "$BACKEND_DIR"

# Detach. gthread worker matches v0.2 (no eventlet needed).
nohup "$VENV_DIR/bin/gunicorn" \
    --worker-class gthread \
    --workers 1 \
    --threads 4 \
    --timeout 300 \
    --bind 127.0.0.1:5000 \
    --pid "$PID_FILE" \
    --access-logfile "$LOG_FILE" \
    --error-logfile "$LOG_FILE" \
    app:app \
    >>"$LOG_FILE" 2>&1 &

disown 2>/dev/null || true

# Give gunicorn a moment to bind or fail loudly.
sleep 2

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "started (pid $(cat "$PID_FILE"))"
    echo "URL:  http://localhost:5000/"
    echo "Logs: tail -f $LOG_FILE"
    echo "Stop: $INSTALL_ROOT/stop.sh"
else
    echo "start failed. Last 20 lines of the log:" >&2
    tail -20 "$LOG_FILE" >&2 || true
    exit 1
fi
