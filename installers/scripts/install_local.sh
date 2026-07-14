#!/bin/bash
# Install RELION Web UI 5 for a single Ubuntu/WSL machine. No sudo.
# Everything lands under ~/.relion-web-ui/.
# Reads relion-web-ui.env from the current dir (or copies the example if missing).

set -euo pipefail

BUNDLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_ROOT="${RELION_INSTALL_ROOT:-$HOME/.relion-web-ui}"
BACKEND_DIR="$INSTALL_ROOT/backend"
FRONTEND_DIR="$INSTALL_ROOT/frontend"
PICKER_DIR="$INSTALL_ROOT/particle-picker"
VENV_DIR="$INSTALL_ROOT/venv"
CONDA_ROOT="$INSTALL_ROOT/miniconda3"
ENV_FILE="$INSTALL_ROOT/relion-web-ui.env"

log()  { printf '\033[36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!!\033[0m  %s\n' "$*" >&2; }
die()  { printf '\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# Pre-flight
[[ $EUID -ne 0 ]] || die "run as your user, not root (this installs under \$HOME)"

# relion-web-ui.env: on first run, copy the example and stop so the user edits it.
# On second run, verify RELION_BIN_PATH or RELION_CONTAINER is set before doing work.
if [[ ! -f relion-web-ui.env ]]; then
    [[ -f "$BUNDLE_DIR/relion-web-ui.env.example" ]] \
        || die "relion-web-ui.env not found and no example available in $BUNDLE_DIR"
    cp "$BUNDLE_DIR/relion-web-ui.env.example" relion-web-ui.env
    cat >&2 <<EOF

$(printf '\033[33m!!\033[0m') Created relion-web-ui.env from the example template.

  Next: edit relion-web-ui.env and set ONE of:

    RELION_BIN_PATH=/path/to/relion/build/bin     (native binaries)
    RELION_CONTAINER=/path/to/relion.sif          (Singularity/Apptainer image)

  Then re-run:  bash scripts/install_relion_local.sh

EOF
    exit 1
fi

# Extract the values, then verify at least one points to something that exists.
# (The example ships with a placeholder RELION_CONTAINER; we can't just check
# "is it set", we have to check "does the path actually exist on this box".)
bin_val=$(grep -E '^\s*RELION_BIN_PATH=' relion-web-ui.env | tail -1 | cut -d= -f2- | tr -d '"'\''' | xargs || true)
sif_val=$(grep -E '^\s*RELION_CONTAINER=' relion-web-ui.env | tail -1 | cut -d= -f2- | tr -d '"'\''' | xargs || true)
have_bin=""
have_sif=""
[[ -n "$bin_val" ]] && [[ -d "$bin_val" ]] && have_bin=yes
[[ -n "$sif_val" ]] && [[ -f "$sif_val" ]] && have_sif=yes
if [[ -z "$have_bin" ]] && [[ -z "$have_sif" ]]; then
    cat >&2 <<EOF

$(printf '\033[31mERROR:\033[0m') relion-web-ui.env doesn't point to a valid RELION install.

  RELION_BIN_PATH   = ${bin_val:-<unset>}    $([[ -n "$bin_val" ]] && [[ ! -d "$bin_val" ]] && echo '(not a directory)')
  RELION_CONTAINER  = ${sif_val:-<unset>}    $([[ -n "$sif_val" ]] && [[ ! -f "$sif_val" ]] && echo '(file not found)')

  Edit relion-web-ui.env and set ONE of:

    RELION_BIN_PATH=/path/to/relion/build/bin     (native binaries)
    RELION_CONTAINER=/path/to/relion.sif          (Singularity/Apptainer image)

  Then re-run:  bash scripts/install_relion_local.sh

EOF
    exit 1
fi

# WSL detection (informational only)
if uname -r | grep -qi microsoft; then
    log "WSL detected. Reach http://localhost:5000/ from inside WSL,"
    log "  or use the WSL2 IP shown by: wsl hostname -I"
    if uname -r | grep -qi 'microsoft-standard-WSL2'; then :; else
        warn "Looks like WSL1. WSL2 is recommended."
    fi
fi

mkdir -p "$INSTALL_ROOT"

# Python 3.10+
PYTHON=""
for candidate in python3.12 python3.11 python3.10 python3; do
    if command -v "$candidate" >/dev/null 2>&1; then
        ver=$("$candidate" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        major=$(echo "$ver" | cut -d. -f1)
        minor=$(echo "$ver" | cut -d. -f2)
        if [[ $major -gt 3 ]] || { [[ $major -eq 3 ]] && [[ $minor -ge 10 ]]; }; then
            PYTHON="$candidate"
            log "using system $candidate ($ver)"
            break
        fi
    fi
done

if [[ -z "$PYTHON" ]]; then
    log "no python 3.10+ found. installing Miniconda under $CONDA_ROOT"
    if [[ ! -x "$CONDA_ROOT/bin/conda" ]]; then
        mc_url="https://repo.anaconda.com/miniconda/Miniconda3-py311_24.1.2-0-Linux-x86_64.sh"
        # macOS test path
        if [[ "$(uname)" == "Darwin" ]]; then
            arch=$(uname -m)
            if [[ "$arch" == "arm64" ]]; then
                mc_url="https://repo.anaconda.com/miniconda/Miniconda3-py311_24.1.2-0-MacOSX-arm64.sh"
            else
                mc_url="https://repo.anaconda.com/miniconda/Miniconda3-py311_24.1.2-0-MacOSX-x86_64.sh"
            fi
        fi
        curl -sSL -o /tmp/miniconda.sh "$mc_url"
        bash /tmp/miniconda.sh -b -p "$CONDA_ROOT"
        rm -f /tmp/miniconda.sh
    fi
    PYTHON="$CONDA_ROOT/bin/python3"
fi

# Virtualenv
if [[ ! -x "$VENV_DIR/bin/python" ]]; then
    log "creating venv at $VENV_DIR"
    "$PYTHON" -m venv "$VENV_DIR"
else
    log "venv exists at $VENV_DIR, skipping"
fi

# Pip deps. Prefer wheels; skip numpy 2.x (needs GCC >= 9.3 on CentOS 7,
# and any Linux/mac install works fine with numpy 1.x).
log "installing python deps into venv"
"$VENV_DIR/bin/pip" install --quiet --upgrade pip
"$VENV_DIR/bin/pip" install --quiet --prefer-binary \
    -r "$BUNDLE_DIR/backend/requirements.txt" \
    'numpy<2' \
    'gunicorn>=21'

# Layout
log "copying backend to $BACKEND_DIR"
mkdir -p "$BACKEND_DIR"
# Use tar over rsync so we don't need rsync (Ubuntu / macOS both ship tar).
( cd "$BUNDLE_DIR/backend" && tar cf - . ) | ( cd "$BACKEND_DIR" && tar xf - )

log "copying frontend to $FRONTEND_DIR"
mkdir -p "$FRONTEND_DIR"
( cd "$BUNDLE_DIR/frontend" && tar cf - . ) | ( cd "$FRONTEND_DIR" && tar xf - )

if [[ -d "$BUNDLE_DIR/particle-picker" ]]; then
    log "copying particle-picker to $PICKER_DIR"
    mkdir -p "$PICKER_DIR"
    ( cd "$BUNDLE_DIR/particle-picker" && tar cf - . ) | ( cd "$PICKER_DIR" && tar xf - )
fi

# Env file - preserve the user's relion-web-ui.env if it exists.
if [[ -f "$ENV_FILE" ]] && [[ -s "$ENV_FILE" ]]; then
    log "$ENV_FILE exists, leaving it alone"
    cp "$ENV_FILE" "$ENV_FILE.bak-$(date +%s)"
fi
cp relion-web-ui.env "$ENV_FILE"
chmod 600 "$ENV_FILE"

# start.sh + stop.sh
log "installing start.sh and stop.sh"
cp "$BUNDLE_DIR/local/start.sh" "$INSTALL_ROOT/start.sh"
cp "$BUNDLE_DIR/local/stop.sh"  "$INSTALL_ROOT/stop.sh"
chmod +x "$INSTALL_ROOT/start.sh" "$INSTALL_ROOT/stop.sh"

cat <<EOF

Installed under $INSTALL_ROOT.

Start:      $INSTALL_ROOT/start.sh
Stop:       $INSTALL_ROOT/stop.sh
Config:     $ENV_FILE   (edit RELION_BIN_PATH or RELION_CONTAINER)
URL:        http://localhost:5000/    (after start.sh)
Uninstall:  rm -rf $INSTALL_ROOT

Issues:     https://github.com/Narasimhany/relion-web-ui/issues

EOF
