#!/bin/bash
# Build the customer-facing tarball.
#
# Usage:
#   ./beta_bundle/scripts/build_bundle.sh [VERSION]              # v0.1 OOD bundle
#   ./beta_bundle/scripts/build_bundle.sh --headless [VERSION]   # v0.2 headless bundle
#   ./beta_bundle/scripts/build_bundle.sh --local [VERSION]      # v0.3 local single-machine bundle
#
# Run from the repo root (paths are script-relative).

set -euo pipefail

# ---- argparse ----
MODE=ood
VERSION=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --headless) MODE=headless; shift ;;
        --local)    MODE=local; shift ;;
        --ood)      MODE=ood; shift ;;
        -h|--help)
            grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *)          VERSION="$1"; shift ;;
    esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ -z "$VERSION" ]]; then
    case "$MODE" in
        headless) VERSION="0.2.0" ;;
        local)    VERSION="0.3.0" ;;
        *)        VERSION="0.1.0" ;;
    esac
fi

case "$MODE" in
    headless) STAGE_NAME="relion-web-ui-relion-headless-v${VERSION}" ;;
    local)    STAGE_NAME="relion-web-ui-relion-local-v${VERSION}" ;;
    *)        STAGE_NAME="relion-web-ui-v${VERSION}" ;;
esac
OUT="$REPO_ROOT/dist/${STAGE_NAME}.tar.gz"

STAGE="$(mktemp -d)/${STAGE_NAME}"
mkdir -p "$STAGE/backend" "$STAGE/frontend" "$STAGE/scripts" "$REPO_ROOT/dist"

echo "==> Staging backend (mode=$MODE, version=$VERSION)"
rsync -a \
    --exclude='__pycache__' --exclude='*.pyc' \
    --exclude='tests' --exclude='logs' --exclude='.*' \
    --exclude='*.pre-*' --exclude='*.bak' --exclude='*.bak-*' \
    --exclude='config.json' --exclude='config.mantis.json' --exclude='config.ood.json' \
    --exclude='mcp_server.py' --exclude='MCP_SERVER_README.md' \
    "$REPO_ROOT/deploy-package/backend/" "$STAGE/backend/"

# Ship a customer-default config.json (cluster_mode=generic, no Azure paths)
if [[ "$MODE" == "local" ]]; then
    EXEC_MODE="local"
else
    EXEC_MODE="slurm"
fi
cat > "$STAGE/backend/config.json" <<EOF
{
  "cluster_mode": "generic",
  "deployment_mode": "$MODE",
  "execution_mode": "$EXEC_MODE",
  "environment": "production",
  "host": "127.0.0.1",
  "port": 5000,
  "debug": false
}
EOF

# Mode-specific staging

if [[ "$MODE" == "ood" ]]; then
    echo "==> Staging OOD app (Passenger WSGI)"
    mkdir -p "$STAGE/ood_app"
    cp "$REPO_ROOT/deploy-package/manifest.yml"                     "$STAGE/ood_app/"
    cp "$REPO_ROOT/beta_bundle/ood_app_overlay/Passengerfile.json"  "$STAGE/ood_app/"
    cp "$REPO_ROOT/beta_bundle/ood_app_overlay/passenger_wsgi.py"   "$STAGE/ood_app/"
    # form.yml, submit.yml.erb, view.html.erb are for OOD batch_connect, not us.

    echo "==> Building React frontend (OOD homepage, Assistant disabled)"
    BUILD_OUT="$REPO_ROOT/build-beta"
    rm -rf "$BUILD_OUT"
    ( cd "$REPO_ROOT" && BUILD_PATH="$BUILD_OUT" REACT_APP_INCLUDE_ASSISTANT=false npm run build >/dev/null )
    rsync -a "$BUILD_OUT/" "$STAGE/frontend/"

    echo "==> Staging install scripts + docs (OOD variant)"
    cp "$REPO_ROOT/beta_bundle/scripts/check_environment.sh"   "$STAGE/scripts/"
    cp "$REPO_ROOT/beta_bundle/scripts/install_relion_beta.sh" "$STAGE/scripts/"

elif [[ "$MODE" == "headless" ]]; then
    echo "==> Staging systemd + nginx templates"
    mkdir -p "$STAGE/systemd" "$STAGE/nginx"
    cp "$REPO_ROOT/beta_bundle/systemd/relion-web-ui-relion.service" "$STAGE/systemd/"
    cp "$REPO_ROOT/beta_bundle/nginx/relion-web-ui.conf"              "$STAGE/nginx/"

    echo "==> Building React frontend (headless: PUBLIC_URL=/, no Assistant)"
    BUILD_OUT="$REPO_ROOT/build-headless"
    rm -rf "$BUILD_OUT"
    ( cd "$REPO_ROOT" && BUILD_PATH="$BUILD_OUT" npm run build:headless >/dev/null )
    rsync -a "$BUILD_OUT/" "$STAGE/frontend/"

    # Particle picker (separate React app), build if source is present.
    if [[ -d "$REPO_ROOT/particle-picker" ]] && \
       [[ -f "$REPO_ROOT/particle-picker/package.json" ]] && \
       grep -q '"build:headless"' "$REPO_ROOT/particle-picker/package.json"; then
        echo "==> Building particle-picker (headless)"
        PP_OUT="$REPO_ROOT/particle-picker/build-headless"
        rm -rf "$PP_OUT"
        ( cd "$REPO_ROOT/particle-picker" && BUILD_PATH="$PP_OUT" npm run build:headless >/dev/null )
        mkdir -p "$STAGE/particle-picker"
        rsync -a "$PP_OUT/" "$STAGE/particle-picker/"
    else
        echo "  (no particle-picker build:headless script, skipping)"
    fi

    echo "==> Staging install scripts + docs (headless variant)"
    cp "$REPO_ROOT/beta_bundle/scripts/check_environment_headless.sh"  "$STAGE/scripts/"
    cp "$REPO_ROOT/beta_bundle/scripts/install_relion_headless.sh"     "$STAGE/scripts/"
    [[ -f "$REPO_ROOT/beta_bundle/MANUAL_INTEGRATION.md" ]] && \
        cp "$REPO_ROOT/beta_bundle/MANUAL_INTEGRATION.md" "$STAGE/"

else  # local
    echo "==> Building React frontend (local: PUBLIC_URL=/, no Assistant)"
    BUILD_OUT="$REPO_ROOT/build-headless"   # same build shape as headless
    rm -rf "$BUILD_OUT"
    ( cd "$REPO_ROOT" && BUILD_PATH="$BUILD_OUT" npm run build:headless >/dev/null )
    rsync -a "$BUILD_OUT/" "$STAGE/frontend/"

    # Particle picker (same build as headless variant)
    if [[ -d "$REPO_ROOT/particle-picker" ]] && \
       [[ -f "$REPO_ROOT/particle-picker/package.json" ]] && \
       grep -q '"build:headless"' "$REPO_ROOT/particle-picker/package.json"; then
        echo "==> Building particle-picker (local)"
        PP_OUT="$REPO_ROOT/particle-picker/build-headless"
        rm -rf "$PP_OUT"
        ( cd "$REPO_ROOT/particle-picker" && BUILD_PATH="$PP_OUT" npm run build:headless >/dev/null )
        mkdir -p "$STAGE/particle-picker"
        rsync -a "$PP_OUT/" "$STAGE/particle-picker/"
    fi

    echo "==> Staging install script + start/stop + docs (local variant)"
    cp "$REPO_ROOT/beta_bundle/scripts/install_relion_local.sh" "$STAGE/scripts/"
    mkdir -p "$STAGE/local"
    cp "$REPO_ROOT/beta_bundle/local/start.sh" "$STAGE/local/"
    cp "$REPO_ROOT/beta_bundle/local/stop.sh"  "$STAGE/local/"
    chmod +x "$STAGE/local/"*.sh
    [[ -f "$REPO_ROOT/beta_bundle/MANUAL_INTEGRATION.md" ]] && \
        cp "$REPO_ROOT/beta_bundle/MANUAL_INTEGRATION.md" "$STAGE/"
fi

chmod +x "$STAGE/scripts/"*.sh

# Common docs + env template
cp "$REPO_ROOT/beta_bundle/relion-web-ui.env.example" "$STAGE/"

if [[ "$MODE" == "headless" ]] && [[ -f "$REPO_ROOT/beta_bundle/HEADLESS_INSTALL.md" ]]; then
    cp "$REPO_ROOT/beta_bundle/HEADLESS_INSTALL.md" "$STAGE/INSTALL.md"
elif [[ "$MODE" == "local" ]] && [[ -f "$REPO_ROOT/beta_bundle/LOCAL_INSTALL.md" ]]; then
    cp "$REPO_ROOT/beta_bundle/LOCAL_INSTALL.md" "$STAGE/INSTALL.md"
elif [[ -f "$REPO_ROOT/beta_bundle/INSTALL.md" ]]; then
    cp "$REPO_ROOT/beta_bundle/INSTALL.md" "$STAGE/"
fi
# Local variant gets its own short README (LOCAL_README.md preferred if present)
if [[ "$MODE" == "local" ]] && [[ -f "$REPO_ROOT/beta_bundle/LOCAL_README.md" ]]; then
    cp "$REPO_ROOT/beta_bundle/LOCAL_README.md" "$STAGE/README.md"
elif [[ -f "$REPO_ROOT/beta_bundle/README.md" ]]; then
    cp "$REPO_ROOT/beta_bundle/README.md" "$STAGE/"
fi
[[ -f "$REPO_ROOT/beta_bundle/SECURITY.md" ]] && cp "$REPO_ROOT/beta_bundle/SECURITY.md" "$STAGE/"

# Tarball
echo "==> Creating tarball"
( cd "$(dirname "$STAGE")" && tar czf "$OUT" "$(basename "$STAGE")" )
SIZE=$(du -h "$OUT" | awk '{print $1}')

echo ""
echo "  Built: $OUT ($SIZE)"
echo "  Mode:  $MODE"
echo "  Test:  tar tzf $OUT | head"
