# Getting the RELION container

RELION Web UI runs every job inside an Apptainer / Singularity container so that the compute node needs no RELION-specific setup beyond the container runtime. This document covers three ways to get the container.

The env var that points at your image, regardless of source, is:

```
RELION_CONTAINER=/absolute/path/to/relion.sif
```

## Option A: Pull a community image

If a pre-built RELION 5 `.sif` exists in a public registry, this is fastest.

```bash
# Requires Apptainer 1.0+ or Singularity 3.5+
apptainer pull relion.sif docker://<community-registry>/relion:5.0
# or
singularity pull relion.sif docker://<community-registry>/relion:5.0
```

Verify:

```bash
apptainer exec relion.sif relion_refine --help | head -5
```

Community registries you might check:

- [Chan Zuckerberg Initiative CryoEM community images](https://chanzuckerberg.github.io/)
- Your institution's local Singularity registry (many university cryo-EM cores maintain one)

Not every RELION version is available as a pre-built image. If the version you need is not published, fall back to Option B.

## Option B: Build from RELION's official Dockerfile

RELION publishes a Dockerfile in its source repository. Build it as a Docker image, then convert to Apptainer.

```bash
# Clone RELION
git clone https://github.com/3dem/relion
cd relion
git checkout ver5.0    # or whichever tag you want

# Build the Docker image
docker build -t relion:5.0 .

# Convert to Apptainer/Singularity
apptainer build relion.sif docker-daemon://relion:5.0

# Move to a shared path
sudo mv relion.sif /shared/apps/relion/
```

Estimated build time: 30–60 min on a modern workstation. The resulting `.sif` is ~5–10 GB.

## Option C: Use your institution's existing image

Many cryo-EM cores already have a RELION container. Ask your admin. Then just point at it:

```
RELION_CONTAINER=/path/your/admin/gave/you/relion.sif
```

## Which image variant?

Some RELION distributions ship two images:

- **`relion_backend`** (~10 GB) - includes all the RELION binaries, ctffind, motioncor2, etc. This is what RELION Web UI expects.
- **`relion_processing`** (~1 GB) - includes only the core processing binaries and may omit ctffind. **Do not use this one** for RELION Web UI unless you know your workflow doesn't touch the missing tools.

If in doubt, use the larger `_backend` image.

## Container bind mounts

RELION Web UI mounts your host filesystem into the container so that RELION can read and write your project data. The env var:

```
RELION_CONTAINER_BIND=/home:/home,/scratch:/scratch
```

is a comma-separated list of `host_path:container_path` pairs. **If your user data lives outside `/home` and `/scratch`, add the appropriate paths here or jobs will fail with "file not found" errors inside the container.**

Common additions:

```
RELION_CONTAINER_BIND=/home:/home,/scratch:/scratch,/data:/data,/lustre:/lustre
```

## GPU support inside the container

Add `--nv` to the container run command if you want GPU RELION. RELION Web UI does this automatically when it detects that Slurm has allocated GPUs (`--gres=gpu:N`). You do not need to configure anything extra for GPU support beyond having a GPU-enabled `.sif`.

## Verifying the container works

Before installing RELION Web UI, confirm the container is functional:

```bash
apptainer exec /path/to/relion.sif relion_refine --version
```

If that prints a version string, you are ready to run the installer.

## Troubleshooting

**"FATAL: `container.sif` not found"** - Double-check the `RELION_CONTAINER` path. Must be absolute.

**"Permission denied"** - Ensure the `.sif` file is readable by the user that runs RELION Web UI (in the Headless/OOD variants, that is usually the `relion-web-ui` service user or the OOD-authenticated user).

**"could not open input file"** during a job - Your input data path is not covered by `RELION_CONTAINER_BIND`. Add the parent directory to the bind list and restart.
