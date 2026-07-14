# Configuration reference

Every env var, what it does, which variant needs it, and its default.

Set env vars in whichever file the installer for your variant creates:

- Local: `~/.relion-web-ui/relion-web-ui.env`
- Headless: `/etc/relion-web-ui/relion-web-ui.env`
- OOD: `/etc/ood/config/apps/relion_passenger/env`

After changing an env value, restart the backend:

- Local: `~/.relion-web-ui/stop.sh && ~/.relion-web-ui/start.sh`
- Headless: `sudo systemctl restart relion-web-ui`
- OOD: `sudo touch /var/www/ood/apps/sys/relion_passenger/tmp/restart.txt`

## Required

| Var | Applies to | What it does |
|---|---|---|
| `RELION_CONTAINER` | Headless, OOD (Local: alternative to `RELION_BIN_PATH`) | Absolute path to your RELION `.sif`. No default. |
| `RELION_PARTITION` | Headless, OOD | Slurm partition (`sinfo` will list yours). No default. |
| `RELION_CLUSTER` | OOD | Cluster ID matching `/etc/ood/config/clusters.d/<id>.yml`. No default. |

## Container + execution

| Var | Default | Meaning |
|---|---|---|
| `RELION_BIN_PATH` | `/opt/relion/build/bin` | (Local only, if you use native binaries instead of a container) directory containing `relion_import`, `relion_refine`, etc. |
| `RELION_APPTAINER_BIN` | `/usr/bin/singularity` | Path to `apptainer` or `singularity`. |
| `RELION_CONTAINER_BIND` | `/home:/home,/scratch:/scratch` | Comma-separated `host:container` bind mounts. Add every directory holding user data. |
| `RELION_EXECUTION_MODE` | `slurm` for headless/OOD; the local installer sets `local` in `start.sh` | `local` runs jobs as subprocesses (single-machine); `slurm` submits via `sbatch`. |
| `RELION_CLUSTER_MODE` | `generic` | `generic` for any Slurm cluster. Advanced value `cyclecloud` is used by upstream authors for Azure CycleCloud deployments; leave at `generic` unless you know you need it. |
| `RELION_DEPLOYMENT_MODE` | `ood` (default template) | `local`, `headless`, or `ood`. Set by the installer for your variant. |
| `RELION_MPIRUN` | `mpirun` | MPI launcher name. |
| `RELION_CTFFIND_BIN` | `/usr/local/bin/ctffind` | Path to `ctffind` if it lives outside the container. |
| `RELION_DYNAMIGHT_BIN` | *(empty)* | Optional; path to `dynamight` for DynaMight jobs. |

## Networking

| Var | Default | Meaning |
|---|---|---|
| `RELION_HOST` | `0.0.0.0` (headless/OOD); `127.0.0.1` (local) | Bind address. |
| `RELION_BACKEND_PORT` | `5000` | Flask backend port. |
| `RELION_CORS_ORIGINS` | `*` | Comma-separated CORS whitelist. |

## Auth (headless variant)

| Var | Default | Meaning |
|---|---|---|
| `RELION_HEADLESS_ADMIN_USER` | `admin` | Initial basic-auth admin username. |
| `RELION_HEADLESS_ADMIN_PASSWORD` | *(prompted at install)* | Initial admin password. |
| `RELION_AUTH_MODE` | `passthrough` | `passthrough` = trust nginx auth. `basic` = backend auth. `none` = no auth (do not use in prod). |
| `RELION_OPEN_FIREWALL_HTTP` | `0` | `1` = installer opens port 80 in firewalld. |

## Slurm proxy (advanced)

If your cluster requires a proxy `sbatch` command (Slurm scheduler on a different host reached via SSH), set:

| Var | Meaning |
|---|---|
| `RELION_SBATCH_PROXY` | Path to a wrapper script that forwards `sbatch` to the scheduler. |
| `RELION_SQUEUE_PROXY` | Same for `squeue`. |
| `RELION_SCANCEL_PROXY` | Same for `scancel`. |
| `RELION_CC_HOST` | (Optional) Scheduler host for direct SSH access. |
| `RELION_CC_USER` | (Optional) SSH user on the scheduler host. |

## Paths

| Var | Default | Meaning |
|---|---|---|
| `RELION_DEFAULT_PROJECTS_DIR` | `${HOME}/relion_projects` | Where a new project lives if the user does not specify. |

## Backend behavior

| Var | Default | Meaning |
|---|---|---|
| `RELION_DEBUG` | `false` | Flask debug mode. Never enable in prod. |
| `RELION_MEM_PER_JOB` | `12G` | Default per-job memory shown in the OOD form. |
| `RELION_ENVIRONMENT` | `production` | Just a label for logs. |

## What most first-time installers only need to set

For a working install, these three are usually enough:

```bash
RELION_CONTAINER=/absolute/path/to/relion.sif
RELION_PARTITION=<your-slurm-partition>          # headless/OOD only
RELION_CONTAINER_BIND=/home:/home,/scratch:/scratch,/data:/data
```

Everything else has a sensible default.
