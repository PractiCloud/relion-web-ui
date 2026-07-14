# Quickstart

A one-page walkthrough. Pick your variant, run the installer, edit one env var, open the browser.

## Which variant?

| If your setup is... | Pick |
|---|---|
| A single workstation (Mac / Ubuntu / WSL2) with RELION already installed | **Local** |
| A Slurm cluster you administer, no Open OnDemand | **Headless** |
| A Slurm cluster with Open OnDemand already running | **OOD** |

## The one env var you must set

Regardless of variant, you must tell RELION Web UI where your RELION container lives.

Set one of these in the env file:

```
RELION_CONTAINER=/absolute/path/to/relion.sif
# or, for Local variant only, native binaries:
RELION_BIN_PATH=/opt/relion/build/bin
```

Details on where to get the container: [`container.md`](container.md).

## Local variant

```bash
git clone https://github.com/<your-org>/relion-web-ui
cd relion-web-ui
cp examples/env.example relion-web-ui.env
$EDITOR relion-web-ui.env         # set RELION_CONTAINER
bash installers/scripts/install_local.sh
# Then:
~/.relion-web-ui/start.sh
# Open http://localhost:5000/ in a browser
```

No root required. Installs into `~/.relion-web-ui/`. Uninstall with `rm -rf ~/.relion-web-ui`.

Full doc: [`install-local.md`](install-local.md).

## Headless variant

```bash
git clone https://github.com/<your-org>/relion-web-ui
cd relion-web-ui
cp examples/env.example relion-web-ui.env
$EDITOR relion-web-ui.env         # set RELION_CONTAINER + RELION_PARTITION
sudo bash installers/scripts/install_headless.sh
# Then reach it at http://<your-host>/ (nginx will prompt for basic-auth)
```

Requires root (installs systemd unit and nginx site). Full doc: [`install-headless.md`](install-headless.md).

## OOD variant

```bash
git clone https://github.com/<your-org>/relion-web-ui
cd relion-web-ui
cp examples/env.example relion-web-ui.env
$EDITOR relion-web-ui.env         # set RELION_CONTAINER + RELION_PARTITION + RELION_CLUSTER
sudo bash installers/scripts/install_ood.sh
# App appears in your OOD dashboard under "Interactive Apps → RELION Web UI"
```

Requires root and an existing Open OnDemand 3.x installation. Full doc: [`install-ood.md`](install-ood.md).

## First job

Once you can reach the UI:

1. Create a project (visual pipeline builder appears).
2. Add an **Import** node pointing at your movies (path relative to your `project_base_dir`).
3. Add **Motion Correction**, connect Import → Motion Correction.
4. Click Run. The job goes to Slurm and runs inside your RELION container.
5. Watch logs stream live and metrics render as they land.

## Getting stuck

- Read the full install guide for your variant.
- Check the [configuration reference](configuration.md) if an env var isn't behaving.
- Open a GitHub issue with your OS, variant, and the exact command/output.
