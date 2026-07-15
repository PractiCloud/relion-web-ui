# RELION Web UI 5 - local install (single-machine)

For running the RELION 5 browser interface on your own Ubuntu / WSL machine. No cluster, no Slurm, no sudo. Jobs execute as local subprocesses against your existing RELION install.

Tested on Ubuntu 22.04 (native and WSL2) and macOS.

## Prerequisites

- Ubuntu 20.04+, WSL2 with Ubuntu, or macOS
- Python 3.10+ (we install Miniconda for you if your system Python is too old)
- RELION 5 installed. Either:
  - Native RELION binaries somewhere on your box (e.g. `/opt/relion/build/bin`), or
  - A RELION Singularity/Apptainer image (`.sif`)
- ~1 GB free under your home dir for the backend + Python env
- A browser to open http://localhost:5000/

No sudo required. No systemd. No nginx. No Slurm.

## Install (3 steps, ~5 min)

**1. Extract**

```bash
tar xzf relion-web-ui-relion-local-v0.3.0.tar.gz
cd relion-web-ui-relion-local-v0.3.0
```

**2. Copy env template and set your RELION path**

```bash
cp relion-web-ui.env.example relion-web-ui.env
$EDITOR relion-web-ui.env
```

Set ONE of:

- `RELION_BIN_PATH` - absolute path to your `relion/build/bin` directory (containing `relion_import`, `relion_refine`, etc.)
- `RELION_CONTAINER` - absolute path to your RELION `.sif` image

If you have both, `RELION_CONTAINER` takes precedence.

If your path has spaces, wrap it in double quotes:

```
RELION_BIN_PATH="/opt/RELION 5/build/bin"
```

**3. Install**

```bash
bash scripts/install_relion_local.sh
```

~5 min. Detects Python (falls back to Miniconda), sets up a venv, copies backend + frontend under `~/.relion-web-ui/`, drops `start.sh` and `stop.sh` alongside your config.

## Start

```bash
~/.relion-web-ui/start.sh
```

Prints the URL. Open `http://localhost:5000/` in a browser.

## WSL notes

If you're on WSL2, `localhost:5000` should reach the app from a Windows browser transparently.

If it doesn't, the app is bound to WSL's loopback and you'll need to reach it via WSL's IP:

```bash
wsl hostname -I
# then http://<that-ip>:5000/
```

WSL1 is not recommended - it lacks proper localhost forwarding for services and has other limitations. Upgrade to WSL2 (`wsl --set-version <distro> 2` from PowerShell).

## Where things live

| What | Path |
|---|---|
| Backend code | `~/.relion-web-ui/backend/` |
| Frontend | `~/.relion-web-ui/frontend/` |
| Python env | `~/.relion-web-ui/venv/` |
| Miniconda (if installed) | `~/.relion-web-ui/miniconda3/` |
| Config | `~/.relion-web-ui/relion-web-ui.env` |
| Log | `~/.relion-web-ui/gunicorn.log` |
| PID | `~/.relion-web-ui/gunicorn.pid` |
| Start / stop scripts | `~/.relion-web-ui/{start,stop}.sh` |

## Change config

Edit `~/.relion-web-ui/relion-web-ui.env`, then restart:

```bash
~/.relion-web-ui/stop.sh
~/.relion-web-ui/start.sh
```

## Stop

```bash
~/.relion-web-ui/stop.sh
```

SIGTERM to gunicorn, waits up to 15 seconds, then SIGKILL if it hasn't exited.

## Auto-start on login (optional)

If you want the backend running whenever you log in, drop a user-level systemd unit:

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/relion-web-ui.service <<'EOF'
[Unit]
Description=RELION Web UI 5 local backend
After=default.target

[Service]
Type=forking
ExecStart=%h/.relion-web-ui/start.sh
ExecStop=%h/.relion-web-ui/stop.sh
Restart=on-failure

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now relion-web-ui.service
```

Only works on native Ubuntu or WSL2 with `systemd=true` in `/etc/wsl.conf`. Not required.

## Uninstall

```bash
rm -rf ~/.relion-web-ui
```

Removes everything. Doesn't touch your RELION install or your project data.

## Troubleshooting

**start.sh says "start failed"**

```bash
tail -40 ~/.relion-web-ui/gunicorn.log
```

Common causes: RELION path in env is wrong, Python venv broken (rerun the installer), port 5000 already in use.

**Port 5000 already in use**

Edit `~/.relion-web-ui/relion-web-ui.env`, set `RELION_BACKEND_PORT=5001` (or any free port), restart.

**Jobs fail immediately**

The service can't find your RELION binaries. Test manually:

```bash
"$RELION_BIN_PATH/relion_import" --version
# or
apptainer exec "$RELION_CONTAINER" relion_import --version
```

Fix the path in `~/.relion-web-ui/relion-web-ui.env` and restart.

**"Address already in use"**

Old gunicorn didn't shut down cleanly. Force-kill:

```bash
pkill -9 -f 'gunicorn.*app:app'
rm -f ~/.relion-web-ui/gunicorn.pid
~/.relion-web-ui/start.sh
```

**Python is too old**

The installer falls back to Miniconda if system Python is < 3.10. If Miniconda install fails, install Python 3.10+ manually (e.g. `sudo apt install python3.11`) and re-run.

## What runs where

```
Browser (localhost:5000)
    |
    v
gunicorn (~/.relion-web-ui/venv/bin/gunicorn on 127.0.0.1:5000)
    |
    v
Flask backend (~/.relion-web-ui/backend/app.py)
    |
    v (RELION_EXECUTION_MODE=local, submit_job routes to _run_local)
    |
subprocess.Popen(relion_XXX ...) running in a background thread
    |
    v
Your RELION binaries or container
    |
    v
Job files land in your project dir; sentinel files signal completion.
```

No Slurm. No sbatch. No nginx. No systemd (unless you set up the optional --user service). All processes run as your user.

## Bundle layout

```
relion-web-ui-relion-local-v0.3.0/
|-- INSTALL.md               (this file)
|-- README.md                (quick-start version of this)
|-- SECURITY.md              (how we handle your data and creds)
|-- relion-web-ui.env.example  (config template)
|-- backend/                 (Flask app + Python code)
|-- frontend/                (pre-built React UI)
|-- particle-picker/         (separate React app for particle picking)
|-- scripts/
|   `-- install_relion_local.sh
`-- local/
    |-- start.sh
    `-- stop.sh
```

Bug reports: https://github.com/Narasimhany/relion-web-ui/issues
