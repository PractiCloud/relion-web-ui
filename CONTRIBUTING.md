# Contributing

Thanks for wanting to help. This project is a community wrapper around RELION 5, so contributions from cryo-EM users and cluster admins are especially valuable.

## Ways to contribute

- **Bug reports.** File an issue with the deployment variant (Local / Headless / OOD), your OS, and steps to reproduce.
- **Feature requests.** Open an issue describing the workflow gap.
- **Pull requests.** Fixes, new job-type support, extra frontend components, doc improvements.
- **Documentation.** If a step in the install guides was unclear, submit a PR clarifying it. Your fresh-user perspective is valuable.

## Development setup

### Frontend

```bash
cd frontend
npm install
npm start                # dev server on http://localhost:3000
```

The dev server proxies API calls to `http://localhost:5000` (the Flask backend).

### Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Set environment for local dev
export RELION_EXECUTION_MODE=local
export RELION_CLUSTER_MODE=generic
export RELION_CONTAINER=/absolute/path/to/relion.sif   # or set RELION_BIN_PATH

.venv/bin/python app.py                # serves on 0.0.0.0:5000
```

### Particle picker (secondary React app)

```bash
cd particle-picker
npm install
npm start
```

Runs on `http://localhost:3001` and is served from the same Flask backend at `/particle-picker/` in production.

## Pull request checklist

Before opening a PR, please:

1. Frontend build succeeds: `cd frontend && npm run build`
2. Backend imports without error: `python3 -m py_compile backend/*.py`
3. Shell scripts pass syntax check: `bash -n installers/scripts/*.sh`
4. New env vars are documented in `docs/configuration.md`
5. If you changed the install path or a system-wide default, update the affected install guide

## Coding style

- **Python:** PEP 8, type hints where they clarify intent. No black-and-decker formatting required, but consistency within a file matters.
- **TypeScript:** whatever ESLint accepts (React defaults).
- **Shell:** POSIX sh where possible; bashisms allowed in installer scripts because we test them on modern distros only.

## Reporting security issues

Do not open a public issue for security problems. See [`SECURITY.md`](SECURITY.md) for the private disclosure process.

## License

By contributing, you agree that your contributions are licensed under the Apache License 2.0.
