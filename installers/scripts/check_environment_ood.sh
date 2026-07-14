#!/bin/bash
# Verify the host is ready to install the RELION 5 OOD app.
# Run this BEFORE install_relion_beta.sh.
#
# Reads relion-web-ui.env from the current directory if present.

set -u

OK="\033[0;32m[ OK ]\033[0m"
FAIL="\033[0;31m[FAIL]\033[0m"
WARN="\033[0;33m[WARN]\033[0m"
errors=0

check() {
    local desc="$1" cond="$2" fix="$3"
    if eval "$cond" >/dev/null 2>&1; then
        printf "$OK  %s\n" "$desc"
    else
        printf "$FAIL  %s\n      $fix\n" "$desc"
        errors=$((errors+1))
    fi
}

warn_check() {
    local desc="$1" cond="$2" hint="$3"
    if eval "$cond" >/dev/null 2>&1; then
        printf "$OK  %s\n" "$desc"
    else
        printf "$WARN  %s\n      $hint\n" "$desc"
    fi
}

# Load env file if present
if [[ -f relion-web-ui.env ]]; then
    set -a; source ./relion-web-ui.env; set +a
fi

echo "==> Required tooling"
check "Open OnDemand installed"           "[ -d /var/www/ood/apps/sys ]"   "Install OOD: https://osc.github.io/ood-documentation/"
check "Slurm reachable (sinfo)"           "command -v sinfo && sinfo -h"   "Make sure Slurm client is installed and the controller is reachable"
check "Apptainer or Singularity present"  "command -v apptainer || command -v singularity"  "apt install apptainer  OR  yum install singularity"
check "Python 3.10+ available"            "python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)'"  "Install Python 3.10 or newer"
check "Apache running"                    "systemctl is-active --quiet apache2 || systemctl is-active --quiet httpd"   "Start Apache: systemctl start apache2"

echo ""
echo "==> Site configuration (from relion-web-ui.env)"

if [[ -z "${RELION_CLUSTER:-}" ]]; then
    printf "$FAIL  RELION_CLUSTER not set\n      Edit relion-web-ui.env\n"; errors=$((errors+1))
else
    cluster_yml="/etc/ood/config/clusters.d/${RELION_CLUSTER}.yml"
    check "OOD cluster config exists ($cluster_yml)" "[ -f '$cluster_yml' ]" "Create $cluster_yml -- see OOD docs"
fi

if [[ -z "${RELION_PARTITION:-}" ]]; then
    printf "$FAIL  RELION_PARTITION not set\n      Edit relion-web-ui.env\n"; errors=$((errors+1))
else
    check "Slurm partition '${RELION_PARTITION}' exists" "sinfo -h -p '${RELION_PARTITION}'" "Pick one from: $(sinfo -h -o '%R' 2>/dev/null | sort -u | tr '\n' ' ')"
fi

if [[ -z "${RELION_CONTAINER:-}" ]]; then
    printf "$FAIL  RELION_CONTAINER not set\n      Edit relion-web-ui.env\n"; errors=$((errors+1))
else
    check "RELION container readable ($RELION_CONTAINER)" "[ -r '$RELION_CONTAINER' ]"  "Download the container -- see INSTALL.md"
fi

if [[ -n "${RELION_APPTAINER_BIN:-}" ]]; then
    check "Container runtime ($RELION_APPTAINER_BIN) executable" "[ -x '$RELION_APPTAINER_BIN' ]" "Fix the path or install apptainer"
fi

if [[ -n "${RELION_DEFAULT_PROJECTS_DIR:-}" ]]; then
    expanded="${RELION_DEFAULT_PROJECTS_DIR//\$\{HOME\}/$HOME}"
    warn_check "Default projects dir resolves ($expanded)" "[ -d '$expanded' ] || [ ! -e '$expanded' ]" "Users will be prompted to create this on first use"
fi

echo ""
if [[ $errors -eq 0 ]]; then
    printf "$OK  Environment looks good. Run: ./scripts/install_relion_beta.sh\n"
    exit 0
else
    printf "$FAIL  $errors check(s) failed. Fix the above and re-run.\n"
    exit 1
fi
