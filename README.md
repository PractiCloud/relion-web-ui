# RELION Web UI

A browser-based interface for RELION 5 that submits jobs to any Slurm cluster (or runs locally on a single machine). Three deployment shapes cover most cryo-EM setups: no-cluster, plain Slurm, and Open OnDemand.

The user opens the browser, drives a visual pipeline through Import → Motion Correction → CTF → Auto-Pick → Extract → 2D/3D Classification → Refine → Post-Process, and reviews results without touching a command line. Every job runs inside your existing RELION container.

## Which deployment shape do I want?

| Your situation | Variant | Install command |
|---|---|---|
| Single machine, RELION already installed | **Local** | `bash installers/scripts/install_local.sh` |
| Slurm cluster, no Open OnDemand | **Headless** | `sudo bash installers/scripts/install_headless.sh` |
| Slurm cluster with Open OnDemand | **OOD** | `sudo bash installers/scripts/install_ood.sh` |

All three share the same backend + frontend code; only the installer, service model, and web-server plumbing differ.

## Prerequisites

| | Local | Headless | OOD |
|---|---|---|---|
| Python 3.10+ | ✓ | ✓ | ✓ |
| RELION 5 container (`.sif`) | ✓ (or native binaries) | ✓ | ✓ |
| Slurm cluster | ✗ | ✓ | ✓ |
| Open OnDemand 3.x | ✗ | ✗ | ✓ |
| Root access needed | ✗ | ✓ | ✓ |
| Shared filesystem across nodes | ✗ | ✓ | ✓ |

## Quick 3-step recipe (Local variant)

```bash
git clone https://github.com/<your-org>/relion-web-ui
cd relion-web-ui
cp examples/env.example relion-web-ui.env
# Edit relion-web-ui.env and set RELION_CONTAINER (or RELION_BIN_PATH)
bash installers/scripts/install_local.sh
```

Then open `http://localhost:5000/` in your browser.

## Getting the RELION container

See [`docs/container.md`](docs/container.md). Short version: pull the community `.sif` image, or build your own from RELION's official Dockerfile. Set `RELION_CONTAINER=/absolute/path/to/relion.sif` in your env file.

## Documentation

- [`docs/quickstart.md`](docs/quickstart.md) - decision tree and one-page install
- [`docs/install-local.md`](docs/install-local.md) - full Local install guide
- [`docs/install-headless.md`](docs/install-headless.md) - full Headless install guide
- [`docs/install-ood.md`](docs/install-ood.md) - full Open OnDemand install guide
- [`docs/configuration.md`](docs/configuration.md) - every env var explained
- [`docs/container.md`](docs/container.md) - where to get the RELION container
- [`docs/architecture.md`](docs/architecture.md) - how the pieces fit together

## Architecture at a glance

```
Browser ── HTTPS ──▶ Flask backend (Python 3.10)
                        │
                        ▼
                    Slurm submission (sbatch / SSH proxy / local subprocess)
                        │
                        ▼
                    Compute node runs RELION inside an Apptainer/Singularity container
                        │
                        ▼
                    Output files land on your shared filesystem
                        │
                        ▼
                    Browser reads results and renders visualizations
```

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Issues and pull requests welcome. No SLA on responses; this is a community project.

## Security

See [`SECURITY.md`](SECURITY.md) for the threat model and how to report security issues.

## License

Apache License 2.0. See [`LICENSE`](LICENSE).

RELION 5 itself is distributed under its own license (GPL v2). This project is a wrapper that runs RELION as an external subprocess; the two licenses are compatible for the wrapper's intended use.
