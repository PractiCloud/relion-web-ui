#!/bin/bash
# Pre-flight for the headless install. Read-only.
# Run BEFORE install_relion_headless.sh. Reads relion-web-ui.env if present.

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
        printf "$FAIL  %s\n      %s\n" "$desc" "$fix"
        errors=$((errors+1))
    fi
}

warn_check() {
    local desc="$1" cond="$2" hint="$3"
    if eval "$cond" >/dev/null 2>&1; then
        printf "$OK  %s\n" "$desc"
    else
        printf "$WARN  %s\n      %s\n" "$desc" "$hint"
    fi
}

# Load env file if present
if [[ -f relion-web-ui.env ]]; then
    set -a; source ./relion-web-ui.env; set +a
fi

echo "==> Required tooling (headless install)"

# Slurm client, must be reachable from this host
check "Slurm client (sinfo)" \
    "command -v sinfo && sinfo -h" \
    "Install Slurm client + configure controller access on this host"

# Container runtime, apptainer preferred, singularity accepted
check "Apptainer or Singularity" \
    "command -v apptainer || command -v singularity" \
    "RHEL: yum install epel-release && yum install apptainer
      Ubuntu: apt install apptainer"

# systemd, obviously required, but check version
check "systemd >= 219 (CentOS 7 minimum)" \
    "systemctl --version | awk '/^systemd/ {exit (\$2 >= 219) ? 0 : 1}'" \
    "Very old system? Upgrade at least to systemd 219."

# Root privileges (needed to install)
check "Running as root (for the install)" \
    "[[ \$EUID -eq 0 ]]" \
    "Re-run under sudo: sudo bash scripts/check_environment_headless.sh"

# Curl (Miniconda download)
check "curl available (Miniconda + smoke test)" \
    "command -v curl" \
    "Install curl: yum install curl  OR  apt install curl"

# Package manager (for nginx + httpd-tools install)
if command -v yum >/dev/null 2>&1 || command -v dnf >/dev/null 2>&1; then
    warn_check "yum/dnf package manager" "true" "detected"
elif command -v apt-get >/dev/null 2>&1; then
    warn_check "apt package manager" "true" "detected"
else
    printf "$FAIL  no supported package manager (yum/dnf/apt)\n"
    errors=$((errors+1))
fi

# nginx (installer will install if missing, but flag it)
warn_check "nginx present" \
    "command -v nginx" \
    "Installer will install nginx if missing"

# glibc >= 2.17 for Miniconda Python 3.11
warn_check "glibc >= 2.17" \
    "ldd --version | awk 'NR==1 {split(\$NF,a,\".\"); exit (a[1] > 2 || (a[1] == 2 && a[2] >= 17)) ? 0 : 1}'" \
    "CentOS 6 won't work. CentOS 7 is 2.17, OK."

echo ""
echo "==> Filesystem"

# Install root writable (installer creates /opt/relion-web-ui/{backend,state,logs})
INSTALL_ROOT="${RELION_INSTALL_ROOT:-/opt/relion-web-ui}"
if [[ -d "$INSTALL_ROOT" ]]; then
    check "$INSTALL_ROOT writable" \
        "[[ -w '$INSTALL_ROOT' ]]" \
        "Fix perms or pick a different RELION_INSTALL_ROOT"
else
    check "$INSTALL_ROOT parent writable" \
        "[[ -w '$(dirname "$INSTALL_ROOT")' ]]" \
        "Installer will create $INSTALL_ROOT, parent must be writable"
fi

# Frontend dir (served by nginx)
FRONTEND_DIR="${RELION_FRONTEND_DIR:-/var/www/relion-web-ui}"
warn_check "$FRONTEND_DIR parent writable" \
    "[[ -w '$(dirname "$FRONTEND_DIR")' ]]" \
    "Installer will create $FRONTEND_DIR, needs to be root-writeable"

# Disk space, RELION container itself is ~10 GB; installer + conda add another ~1.5 GB
warn_check "at least 15 GB free on install partition" \
    "df -k '$INSTALL_ROOT' --output=avail 2>/dev/null | awk 'NR==2 { exit (\$1 > 15*1024*1024) ? 0 : 1}'" \
    "You'll need room for the RELION Singularity image (~10 GB) + conda env (~1.5 GB)"

echo ""
echo "==> Site configuration (from relion-web-ui.env)"

if [[ -z "${RELION_PARTITION:-}" ]]; then
    printf "$FAIL  RELION_PARTITION not set\n      Edit relion-web-ui.env\n"; errors=$((errors+1))
else
    check "Slurm partition '${RELION_PARTITION}' exists" \
        "sinfo -h -p '${RELION_PARTITION}'" \
        "Available: $(sinfo -h -o '%R' 2>/dev/null | sort -u | tr '\n' ' ')"
fi

if [[ -z "${RELION_CONTAINER:-}" ]]; then
    printf "$FAIL  RELION_CONTAINER not set\n      Edit relion-web-ui.env; download RELION .sif from https://relion.readthedocs.io/\n"
    errors=$((errors+1))
else
    check "RELION container readable" \
        "[[ -r '$RELION_CONTAINER' ]]" \
        "Fix the path or re-download the .sif"
fi

# htpasswd availability (comes from httpd-tools on RHEL, apache2-utils on Debian)
# Installer installs it, but flag if missing.
warn_check "htpasswd available (basic-auth setup)" \
    "command -v htpasswd" \
    "Installer will install httpd-tools / apache2-utils"

# SELinux, informational
if command -v getenforce >/dev/null 2>&1; then
    mode="$(getenforce 2>/dev/null || echo Unknown)"
    printf "$WARN  SELinux mode: %s\n" "$mode"
    if [[ "$mode" == "Enforcing" ]]; then
        printf "      Installer will set: setsebool -P httpd_can_network_connect 1\n"
    fi
fi

# firewalld, informational
if systemctl is-active --quiet firewalld 2>/dev/null; then
    printf "$WARN  firewalld is active, port 80 may need to be opened\n"
    printf "      Set RELION_OPEN_FIREWALL_HTTP=1 in relion-web-ui.env to have the installer do it.\n"
fi

echo ""
if [[ $errors -eq 0 ]]; then
    printf "$OK  Environment looks good. Run: sudo bash scripts/install_relion_headless.sh\n"
    exit 0
else
    printf "$FAIL  %d check(s) failed. Fix the above and re-run.\n" $errors
    exit 1
fi
