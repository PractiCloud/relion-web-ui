# Install: Open OnDemand variant

Install RELION Web UI as an Open OnDemand Passenger application. This is the right choice if you already run Open OnDemand for your users. Your existing SSO handles authentication; the app appears under the OOD dashboard.

Tested on Open OnDemand 3.1.x with Ubuntu 22.04 and Rocky 8/9.

## Prerequisites

- **Open OnDemand 3.x** already running.
- **Slurm** cluster with a partition you can submit to.
- **Apptainer or Singularity** installed on compute nodes.
- A working **RELION container** (see [`container.md`](container.md)).
- Root on the OOD host.
- Read/write access to `/var/www/ood/apps/sys/` on the OOD host.

## Install

From a checkout of this repo on the OOD host:

```bash
cp examples/env.example relion-web-ui.env
$EDITOR relion-web-ui.env
```

Set these three at minimum:

```
RELION_CONTAINER=/absolute/path/to/relion.sif
RELION_PARTITION=<your-slurm-partition>
RELION_CLUSTER=<your-cluster-id>
```

`RELION_CLUSTER` is the base name of your OOD cluster config file - if it is `/etc/ood/config/clusters.d/hpc.yml`, set `RELION_CLUSTER=hpc`.

Then run:

```bash
sudo bash installers/scripts/install_ood.sh
```

The installer:

1. Copies the backend to `/opt/relion-web-ui/backend/`.
2. Creates a Python venv there and installs `requirements.txt`.
3. Copies the OOD app scaffold to `/var/www/ood/apps/sys/relion_passenger/`.
4. Builds and installs the frontend into `public/`.
5. Writes an env file at `/etc/ood/config/apps/relion_passenger/env`.
6. Touches `tmp/restart.txt` so Passenger picks up the app.
7. Runs `nginx_stage nginx_clean` for the OOD service user so the routing table refreshes.

## Verify

Log in to your OOD portal. Under **Interactive Apps** you should see **RELION Web UI**. Click it to launch. First launch initializes the Passenger app and can take 5–10 seconds; subsequent launches are instant.

If the app icon does not appear:

```bash
sudo /opt/ood/nginx_stage/sbin/nginx_stage nginx_clean -u <your-username>
```

Then reload the dashboard.

## Post-install checks

### 1. Health endpoint

Once the app is loaded, its health endpoint should return JSON:

```bash
curl -s -k -L "https://<your-ood-hostname>/pun/sys/relion_passenger/api/health"
```

Returns `{"status": "ok", "partition": "...", ...}`.

### 2. Slurm submission

Submit a trivial Import job through the UI to confirm the sbatch chain works end to end. If the job stays PENDING forever, check `squeue` for the reason.

### 3. Bind mounts

The most common runtime failure is data invisible inside the container. If your projects live outside `/home` and `/scratch`, edit `/etc/ood/config/apps/relion_passenger/env`:

```
RELION_CONTAINER_BIND=/home:/home,/scratch:/scratch,/data:/data
```

Then `sudo touch /var/www/ood/apps/sys/relion_passenger/tmp/restart.txt`.

## Uninstall

```bash
sudo rm -rf /var/www/ood/apps/sys/relion_passenger
sudo rm -rf /opt/relion-web-ui
sudo rm -rf /etc/ood/config/apps/relion_passenger
```

The app disappears from the dashboard on next PUN clean.

## Troubleshooting

**App shows in dashboard, but clicking it 404s.**
The user's PUN nginx has not picked up the new app. Fix:

```bash
sudo /opt/ood/nginx_stage/sbin/nginx_stage nginx_clean -u <username>
```

**500 error on `/api/health` after launching the app.**
Passenger failed to spawn the Python interpreter. Common cause: the OOD Passenger wrapper prefers `${PWD}/bin/python` before falling back to `python` in PATH, and Ubuntu 22.04 has no `python` symlink. Confirm the installer created a shim:

```bash
cat /var/www/ood/apps/sys/relion_passenger/bin/python
```

Should print a script that execs your Python 3 binary. If missing, the install script did not run cleanly; re-run it.

**"FATAL: singularity/apptainer not available on <node>".**
Compute nodes are missing the container runtime. Install `apptainer` on your compute image, or stage `apptainer.deb` under `/shared/apps/` if you use CycleCloud-style auto-install patterns.

**Every job fails with "file not found".**
Your data path is not in `RELION_CONTAINER_BIND`. Add it.
