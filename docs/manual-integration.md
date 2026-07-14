# Manual integration

For folks who'd rather plug the code into their own stack than run our installer. The installer is fine, but you probably already have opinions on nginx, systemd, and auth. Use what you have.

## What's in the bundle

```
backend/            Flask app (Python 3.10+)
frontend/           pre-built React (static)
particle-picker/    separate React app, static
nginx/              example site config
systemd/            example unit
relion-web-ui.env.example
```

Ignore `scripts/` if you're going this route.

## Backend

Python 3.10 or newer. Set up a venv, install deps:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt gunicorn
```

Run it:

```bash
gunicorn --worker-class gthread --workers 1 --threads 4 \
    --bind 127.0.0.1:5000 app:app
```

The backend reads config from env vars. `relion-web-ui.env.example` has the full list. Essentials:

```
RELION_PARTITION=whatever              # your Slurm partition
RELION_CONTAINER=/path/to/relion_backend.sif
RELION_WSGI=1                          # disable SocketIO under gunicorn
RELION_HOST=127.0.0.1
RELION_BACKEND_PORT=5000
```

## Frontend

Static files. Point your web server at `frontend/`. Root URL should serve `index.html`. Route `/api/*` to your gunicorn.

Particle picker is a separate build. Serve `particle-picker/` at `/particle-picker/`.

The React app assumes `/` as its base (that's what the headless build sets). If you want it under a subpath (like `/relion/`), you'll need to rebuild - see `package.json` for the `build:headless` script and adjust `PUBLIC_URL`.

## Auth

The bundle doesn't ship with auth. The example nginx site uses htpasswd basic-auth so you have something out of the box. Wire in LDAP / Shibboleth / SSO however you already do it. The backend trusts whatever the reverse proxy passes through (see `RELION_AUTH_MODE=passthrough` in the env).

If you want the backend to enforce basic-auth itself, set `RELION_AUTH_MODE=basic`. Rare.

## systemd (optional)

`systemd/relion-web-ui-relion.service` is a working example. It has three placeholders our installer fills in:

- `__BACKEND_DIR__` - where you dropped the backend
- `__ENV_FILE__` - path to the env file (you can point at the raw relion-web-ui.env if you like)
- `__CONDA_ENV__` - path to your Python env's bin dir

Substitute those, `systemctl daemon-reload`, `systemctl enable --now`. Or use your own supervisor - it's just a Python process bound to a port.

## Gotchas

- CentOS 7 ships Python 3.6, too old for the backend. Miniconda or SCL for 3.10+.
- numpy 2.x won't compile with GCC < 9.3. If you're on RHEL/CentOS 7-8, either pin `numpy<2` or install from conda-forge (that's what our installer does).
- gunicorn 26 dropped the eventlet worker. Use `gthread` instead. We polling over HTTP, no WebSocket use, gthread is enough.
- If SELinux is enforcing, `setsebool -P httpd_can_network_connect 1` so nginx can proxy to your backend on the loopback. And `chcon -Rt httpd_sys_content_t /path/to/frontend`.
- The bundled `config.json` sets `host=127.0.0.1`. If you're binding to something else, override with `RELION_HOST`.

## Getting help

Repo: https://github.com/Narasimhany/relion-web-ui - open an issue.
