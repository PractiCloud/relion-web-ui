# Getting the RELION container

RELION Web UI runs every job inside an Apptainer / Singularity container so that the compute node needs no RELION-specific setup beyond the container runtime.

The env var that points at your image is:

```
RELION_CONTAINER=/absolute/path/to/relion.sif
```

## Recommended: pull from Docker Hub (one command)

The community image `jidaniel/relion:5.0-cuda12.4.1` (a build of RELION 5.0 ver5.0 branch on Ubuntu 22.04 with CUDA 12.4.1, originating from the Chan Zuckerberg Imaging Institute's `czimaginginstitute/relion-docker`) is what we use in production and is the tested reference.

```bash
# Requires Apptainer 1.0+ or Singularity 3.5+
apptainer build relion.sif docker://jidaniel/relion:5.0-cuda12.4.1

# Move to a shared path visible to every compute node
sudo mkdir -p /shared/apps/relion
sudo mv relion.sif /shared/apps/relion/
```

Download + convert takes about 10-15 minutes. The resulting `.sif` is roughly 10 GB.

Then in your env file:

```
RELION_CONTAINER=/shared/apps/relion/relion.sif
```

## Alternative: build from RELION source

If you want to pin to a specific commit or apply local patches, build from RELION's official Dockerfile.

```bash
git clone https://github.com/3dem/relion
cd relion
git checkout ver5.0
docker build -t relion:5.0 .
apptainer build relion.sif docker-daemon://relion:5.0
```

Estimated time: 30-60 min on a modern workstation.

## If your institution already has a RELION container

Ask your admin. Most cryo-EM cores maintain their own `.sif`. Once you have the path, just point at it:

```
RELION_CONTAINER=/path/your/admin/gave/you/relion.sif
```

## Container bind mounts

RELION Web UI mounts your host filesystem into the container so that RELION can read and write your project data. The env var:

```
RELION_CONTAINER_BIND=/home:/home,/scratch:/scratch
```

is a comma-separated list of `host_path:container_path` pairs. If your user data lives outside `/home` and `/scratch`, add the appropriate paths here or jobs will fail with "file not found" errors inside the container.

Common additions:

```
RELION_CONTAINER_BIND=/home:/home,/scratch:/scratch,/data:/data,/lustre:/lustre
```

## GPU support inside the container

RELION Web UI adds `--nv` to the container command automatically when Slurm allocates GPUs (`--gres=gpu:N`). You do not need to configure anything extra beyond having a GPU-enabled `.sif`. The recommended image above is CUDA 12.4.1 and works on any NVIDIA GPU with a compatible driver.

## Verifying the container works

Before installing RELION Web UI, confirm the container is functional:

```bash
apptainer exec /path/to/relion.sif relion_refine --version
```

Should print: `RELION version: 5.0.0-commit-XXXXXX`.

## Troubleshooting

**"FATAL: `container.sif` not found"** - Double-check the `RELION_CONTAINER` path. Must be absolute.

**"Permission denied"** - Ensure the `.sif` file is readable by the user that runs RELION Web UI.

**"could not open input file"** during a job - Your input data path is not covered by `RELION_CONTAINER_BIND`. Add the parent directory to the bind list and restart.

**"CUDA driver version is insufficient"** - Your NVIDIA driver is older than what CUDA 12.4 needs. Update the driver on the compute node, or use a container built against an older CUDA (build from source, above).
