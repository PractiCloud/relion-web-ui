# Architecture

RELION Web UI is a browser-based interface that submits and monitors RELION jobs on any Slurm cluster (or runs them as local subprocesses on a single machine). This document sketches the pieces so contributors and admins can navigate the codebase.

## Component map

```
┌────────────────────────────────────────────────────────────┐
│                       Browser                              │
│    (React + Material-UI + TypeScript)                      │
│    Two React apps:                                         │
│      - main pipeline UI              (`frontend/`)         │
│      - particle picker               (`particle-picker/`)  │
└────────────────────────┬───────────────────────────────────┘
                         │ HTTP(S) - /api/*, /particle-picker/api/*
                         ▼
┌────────────────────────────────────────────────────────────┐
│                  Flask backend (Python 3.10)               │
│                        `backend/`                          │
│                                                            │
│   app.py                - routing and REST endpoints       │
│   job_manager.py        - Slurm / local job submission     │
│   config.py             - env-var + config.json loader     │
│   star_parser.py        - RELION STAR file parser          │
│   viz_utils.py          - result-plot data extraction      │
│   particle_picker_api.py - endpoints for the picker app    │
└────────────────────────┬───────────────────────────────────┘
                         │
       Local variant     │      Headless / OOD variants
             │           │              │
             ▼           ▼              ▼
┌───────────────────┐  ┌──────────────────────────────────┐
│  subprocess.Popen │  │  sbatch  (via local sbatch or    │
│  runs `relion_*`  │  │  a proxy script over SSH)        │
│  directly on the  │  │                                  │
│  same machine     │  │  Slurm dispatches to a compute   │
│                   │  │  node; the node runs RELION      │
│                   │  │  inside an Apptainer container   │
│                   │  │  bind-mounting shared storage    │
└───────────────────┘  └──────────────────────────────────┘
```

## Deployment variants

The **same code** produces three deployment shapes. Only the installer differs.

- **Local** - `~/.relion-web-ui/venv/bin/gunicorn` serves the app on `127.0.0.1:5000`. Jobs run as local subprocesses on the same machine. No root, no daemons.
- **Headless** - systemd unit `relion-web-ui.service` runs gunicorn on `127.0.0.1:5000`. Nginx at port 80 proxies requests with basic auth. Jobs submit to Slurm.
- **OOD** - Open OnDemand Passenger app at `/var/www/ood/apps/sys/relion_passenger/` loads the same Flask app under Passenger's WSGI. Auth comes from OOD's SSO. Jobs submit to Slurm.

All three read the **same env template** (see `examples/env.example`) and use the same `RELION_*` variable names.

## Job lifecycle

1. User configures a job in the browser (job type + parameters).
2. Browser POSTs to `/api/jobs/submit`.
3. `job_manager.py` builds the sbatch script (or subprocess command in Local mode) and calls `sbatch`.
4. Slurm dispatches to a compute node.
5. Compute node runs `apptainer exec --bind $BINDS $RELION_CONTAINER relion_<jobtype> ...`.
6. RELION writes output files to the project directory on shared storage.
7. RELION writes sentinel files (`RELION_JOB_EXIT_SUCCESS` or `RELION_JOB_EXIT_FAILURE`) at completion.
8. Backend polls sentinels + `squeue` for status and streams to the browser.
9. When the job finishes, backend parses the output STAR files and returns metrics for visualization.

## Data-format contract with RELION

RELION Web UI does not modify or reinterpret RELION's on-disk format. It reads what RELION writes:

- **STAR files** for metadata and metrics (`star_parser.py`).
- **`.mrc`** and **`.mrcs`** for micrographs / particles (metadata only; the browser does not render volumes).
- **Sentinel files** for job status.

If a future RELION version changes any of these, the backend needs a corresponding update.

## Extension points

Common ways contributors extend the project:

- **New job type support** - add an entry to `frontend/src/services/mockData.ts` and a handler in `backend/job_manager.py` `_build_jobtype_flags()`.
- **New result visualization** - add a component under `frontend/src/components/results3d/` and a data extraction in `backend/viz_utils.py`.
- **New deployment variant** - add an installer under `installers/scripts/` following the pattern of `install_local.sh` / `install_headless.sh` / `install_ood.sh`. All three share the same backend code; only the web-server plumbing differs.

## What is intentionally not here

- **AI Assistant / MCP server.** The original project has an optional chat interface. Not shipped in this release to keep the required dependency graph small. A separate repo may follow.
- **ColabFold integration.** Prediction workflows and their frontend are not part of this repo.
- **Cloud-specific templates.** No Azure ARM / Terraform / CycleCloud files. This project is cluster-agnostic; if you want to deploy on a specific cloud, use your cloud's own tooling to provision the Slurm cluster and then install RELION Web UI onto it as if it were bare metal.
