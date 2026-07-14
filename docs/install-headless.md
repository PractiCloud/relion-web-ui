# RELION Web UI 5 - headless install

A self-hosted install of the RELION 5 Web UI for Slurm clusters without Open OnDemand. nginx + gunicorn + systemd + a small Miniconda env on one head node. Jobs go to your existing Slurm compute.

Tested on CentOS 7, RHEL 7-9, Rocky 8-9, Ubuntu 20.04+.

> Prefer to wire the code into your own stack? See `MANUAL_INTEGRATION.md`. Same code, no installer, your nginx / systemd / auth.

## Prerequisites

- Slurm cluster reachable from the head node (`sbatch`, `sinfo`, `squeue`)
- Apptainer or Singularity on the compute nodes
- The RELION 5 Singularity image (`.sif`, ~10 GB). If you don't already have one, pull the CZI Imaging community build we use:
  ```bash
  sudo apptainer pull /opt/relion/relion_backend.sif docker://jidaniel/relion:5.0-cuda12.4.1
  ```
  Then set `RELION_CONTAINER=/opt/relion/relion_backend.sif` in `relion-web-ui.env`. Works on CPU-only nodes too - CUDA layers just idle if no GPU.
- Shared filesystem mounted on head + compute (NFS, Lustre, BeeGFS, whatever)
- ~15 GB free on `/opt` for backend + Miniconda + the RELION image
- sudo
- Internet from the head node during install (Miniconda + pip)

No Open OnDemand needed.

## Install (5 steps, ~10 min)

**1. Extract**

```bash
tar xzf relion-web-ui-relion-headless-v0.2.0.tar.gz
cd relion-web-ui-relion-headless-v0.2.0
```

**2. Copy the env template and edit**

```bash
cp relion-web-ui.env.example relion-web-ui.env
$EDITOR relion-web-ui.env
```

Three keys you actually need to set:

- `RELION_PARTITION` - your Slurm partition (`sinfo` to list)
- `RELION_CONTAINER` - absolute path to your `relion_backend.sif`
- `RELION_HEADLESS_ADMIN_USER` - first basic-auth user (default: `admin`)

Optionally set `RELION_HEADLESS_ADMIN_PASSWORD` in the env so the installer skips the interactive prompt.

**3. Pre-flight**

```bash
sudo bash scripts/check_environment_headless.sh
```

All green? Move on. Any red? Fix and re-run.

**4. Install**

```bash
sudo bash scripts/install_relion_headless.sh
```

5-10 min. System packages, Miniconda + Python 3.11, backend + frontend, systemd unit, nginx site, basic-auth.

If you didn't set `RELION_HEADLESS_ADMIN_PASSWORD`, `htpasswd` prompts now.

**5. Verify**

```bash
curl -u admin:<password> http://localhost/api/health
```

Expect JSON with `"status":"ok"`. Then open `http://<host>/` in a browser.

## What got installed where

| Component | Path |
|---|---|
| Backend | `/opt/relion-web-ui/backend/` |
| Frontend | `/var/www/relion-web-ui/` |
| Miniconda + Python 3.11 | `/opt/miniconda3/envs/relion-web-ui/` |
| systemd unit | `/etc/systemd/system/relion-web-ui-relion.service` |
| nginx site | `/etc/nginx/conf.d/relion-web-ui.conf` |
| Basic-auth users | `/etc/relion-web-ui.htpasswd` |
| Runtime env | `/opt/relion-web-ui/relion-web-ui.env` (0600, owned by `relion-web-ui`) |

## Operations

Add a user:

```bash
sudo htpasswd /etc/relion-web-ui.htpasswd <new-user>
```

Restart:

```bash
sudo systemctl restart relion-web-ui-relion
```

Logs:

```bash
sudo journalctl -u relion-web-ui-relion -f
sudo tail -f /var/log/nginx/{access,error}.log
```

Change a config value: edit `/opt/relion-web-ui/relion-web-ui.env`, `systemctl restart relion-web-ui-relion`.

Upgrade to a newer bundle: `tar xzf` the new one, run `install_relion_headless.sh`. Installer is idempotent.

## CentOS 7 gotchas

CentOS 7 has been EOL since June 2024. The installer works around the usual snags:

- System Python is 3.6, too old. Installer builds its own Miniconda env at `/opt/miniconda3`. System Python untouched.
- SELinux Enforcing by default. Installer runs `setsebool -P httpd_can_network_connect 1` and `chcon -Rt httpd_sys_content_t /var/www/relion-web-ui` so nginx can proxy to gunicorn and serve static files.
- firewalld may block port 80. Set `RELION_OPEN_FIREWALL_HTTP=1` in the env before installing if you want it opened.
- If your yum repos point at the dead mirrorlist.centos.org or trafficmanager.net URLs, packages won't install. Point them at vault.centos.org or your institutional mirror.

## TLS

Not shipped. The nginx config listens on 80 with basic-auth. Three options:

1. `certbot --nginx -d your-host.example.edu`, then edit the nginx site.
2. Front the whole thing with your own reverse proxy that terminates TLS.
3. Institutional load balancer.

## Uninstall

```bash
sudo systemctl disable --now relion-web-ui-relion nginx
sudo rm -f /etc/systemd/system/relion-web-ui-relion.service
sudo rm -f /etc/nginx/conf.d/relion-web-ui.conf
sudo systemctl daemon-reload
sudo rm -rf /opt/relion-web-ui /var/www/relion-web-ui
sudo rm -f /etc/relion-web-ui.htpasswd
sudo userdel relion-web-ui 2>/dev/null || true
sudo rm -rf /opt/miniconda3
```

## Troubleshooting

**`curl http://localhost/api/health` returns 502**

Backend didn't start.

```bash
sudo systemctl status relion-web-ui-relion
sudo journalctl -u relion-web-ui-relion --since '5 minutes ago'
```

Common causes: Miniconda env didn't finish (retry the installer), or something else is on port 5000 (`RELION_BACKEND_PORT` in the env to change).

**Jobs submit but don't run**

The service runs as user `relion-web-ui`. That user needs permission to `sbatch` on your cluster.

```bash
sudo -u relion-web-ui sbatch --wrap="hostname" --partition="$RELION_PARTITION"
```

**Basic-auth prompt loops**

Bad password or nginx can't read `/etc/relion-web-ui.htpasswd`.

```bash
ls -l /etc/relion-web-ui.htpasswd    # should be 640 root:nginx (or root:www-data)
sudo htpasswd /etc/relion-web-ui.htpasswd admin
```

**SELinux denials in /var/log/audit/audit.log**

```bash
sudo ausearch -m avc -ts recent
sudo setsebool -P httpd_can_network_connect 1
```

## Bundle layout

```
relion-web-ui-relion-headless-v0.2.0/
├── INSTALL.md                       (this file)
├── MANUAL_INTEGRATION.md            (skip the installer, wire it in yourself)
├── README.md
├── relion-web-ui.env.example
├── backend/                         Flask + backend Python
├── frontend/                        pre-built React
├── particle-picker/                 separate React app
├── systemd/
│   └── relion-web-ui-relion.service
├── nginx/
│   └── relion-web-ui.conf
└── scripts/
    ├── check_environment_headless.sh
    └── install_relion_headless.sh
```

Bug reports: https://github.com/Narasimhany/relion-web-ui/issues
