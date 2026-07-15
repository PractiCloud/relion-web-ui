# Manual integration

For folks who'd rather plug the code into their own stack than run our installer. The installer is fine, but you probably already have opinions on nginx, systemd, OOD app registration, and auth. Use what you have.

## What's in the repo

```
backend/            Flask app (Python 3.10+)
frontend/           React source (build with npm run build:headless)
particle-picker/    separate React app, build with npm run build
installers/nginx/   example nginx site config
installers/systemd/ example systemd unit
installers/ood_app/ example OOD Passenger app scaffold
installers/local/   example start.sh / stop.sh for single-machine
examples/env.example
```

Ignore `installers/scripts/` if you're going the manual route.

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

The backend reads config from env vars. `examples/env.example` has the full list. Essentials for a Slurm-backed deployment:

```
RELION_PARTITION=<your-slurm-partition>
RELION_CONTAINER=/path/to/relion.sif
RELION_CONTAINER_BIND=/home:/home,/scratch:/scratch,/data:/data
RELION_HOST=127.0.0.1
RELION_BACKEND_PORT=5000
RELION_CLUSTER_MODE=generic
```

## Frontend

Build the static bundle:

```bash
cd frontend
npm ci
npm run build:headless    # produces frontend/build/
```

Point your web server at `frontend/build/`. Root URL should serve `index.html`. Route `/api/*` to your gunicorn.

The particle picker is a separate build:

```bash
cd particle-picker
npm ci
npm run build            # produces particle-picker/build/
```

Serve it at `/particle-picker/`.

## Headless integration (nginx + systemd, no OOD)

Wire the Flask backend to a systemd unit so it starts at boot. `installers/systemd/relion-web-ui.service` is a working example with three placeholders:

- `__BACKEND_DIR__` - where you dropped the backend
- `__ENV_FILE__` - path to your env file
- `__CONDA_ENV__` - path to your Python env's bin dir

Substitute those, `systemctl daemon-reload`, `systemctl enable --now relion-web-ui`. Or use your own supervisor - it's just a Python process bound to a port.

For nginx, `installers/nginx/` has a site config template. Standard reverse-proxy setup: `/api/*` -> `127.0.0.1:5000`, everything else -> `frontend/build/`. Add htpasswd, TLS, LDAP, Shibboleth, or whatever auth you already run.

## OOD integration (Open OnDemand Passenger app)

If your institution already runs Open OnDemand, install the app as a normal Passenger WSGI app under `/var/www/ood/apps/sys/`.

Directory scaffold (see `installers/ood_app/` for concrete files):

```
/var/www/ood/apps/sys/relion_passenger/
├── manifest.yml          # app title, category, icon
├── Passengerfile.json    # WSGI boot config
├── passenger_wsgi.py     # imports app:app from your backend dir
├── bin/python            # shim (see below)
├── public/               # symlink or copy of frontend/build/
└── tmp/                  # touch restart.txt here to reload Passenger
```

Three steps that trip people up:

1. **The `bin/python` shim.** OOD's Passenger wrapper (`/opt/ood/nginx_stage/bin/python`) prefers `${PWD}/bin/python` and falls back to bare `python` in PATH, which does not exist on Ubuntu 22.04 (only `python3` does). Create a `bin/python` in the app dir that just execs your Python 3:

   ```
   #!/bin/bash
   exec /path/to/backend/.venv/bin/python3 "$@"
   ```

   Without this, Passenger will fail to spawn with "python: not found."

2. **Per-user nginx (PUN) needs to discover the app.** After installing, run:

   ```
   sudo /opt/ood/nginx_stage/sbin/nginx_stage nginx_clean -u <username>
   ```

   for each user who should see the app in their dashboard. Otherwise you'll get a 404 on the app URL even though `manifest.yml` is in place.

3. **Site env file.** Drop deploy-time config at `/etc/ood/config/apps/relion_passenger/env`. The `passenger_wsgi.py` loads it at startup:

   ```
   RELION_PARTITION=<your-partition>
   RELION_CLUSTER=<your-cluster-id>
   RELION_CONTAINER=/path/to/relion.sif
   RELION_CONTAINER_BIND=/home:/home,/scratch:/scratch,/data:/data
   ```

   After editing, `sudo touch /var/www/ood/apps/sys/relion_passenger/tmp/restart.txt` to reload Passenger.

Auth comes from your existing OOD deployment (Shibboleth, LDAP, OpenID, whatever OOD is set up with). The Flask backend trusts the reverse proxy's authenticated identity; no additional auth layer needed inside the app.

## Auth (in general)

The bundle does not ship with auth. The example nginx site uses htpasswd basic-auth so you have something out of the box. Wire in LDAP / Shibboleth / SSO however you already do it. The backend trusts whatever the reverse proxy passes through (`RELION_AUTH_MODE=passthrough` in the env).

If you want the backend to enforce basic-auth itself, set `RELION_AUTH_MODE=basic`. Rare.

## Gotchas

- CentOS 7 ships Python 3.6, too old for the backend. Miniconda or SCL for 3.10+.
- numpy 2.x won't compile with GCC < 9.3. If you're on RHEL/CentOS 7-8, either pin `numpy<2` or install from conda-forge.
- gunicorn 26 dropped the eventlet worker. Use `gthread`. We poll over HTTP; no WebSocket use.
- If SELinux is enforcing: `setsebool -P httpd_can_network_connect 1` so nginx can proxy to your backend, and `chcon -Rt httpd_sys_content_t /path/to/frontend/build`.
- The bundled `config.example.json` sets `host=127.0.0.1`. If you bind to something else, override with `RELION_HOST`.
- Under OOD, the app URL always has a trailing slash (`/pun/sys/relion_passenger/`). If your frontend build uses relative asset paths, that trailing slash matters. Our `build:headless` already handles this; a hand-built variant may need `PUBLIC_URL=/pun/sys/relion_passenger` in the build env.

## Getting help

Repo: https://github.com/PractiCloud/relion-web-ui - open an issue.
