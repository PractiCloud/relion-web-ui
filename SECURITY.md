# Security

## Threat model

RELION Web UI is a browser interface that submits and monitors compute jobs. The realistic threats are:

1. **Unauthorized access to a running instance.** Anyone who reaches the web UI can submit RELION jobs on your Slurm cluster and read data on your shared filesystem. Protect access with the auth mechanism appropriate to your deployment (see below).
2. **Command injection through job parameters.** RELION accepts many string parameters that ultimately become shell arguments. The backend uses `shlex.quote()` at the boundary; do not disable that.
3. **Path traversal on file-serving endpoints.** The backend validates paths against a base directory before serving. Do not weaken this.
4. **Cross-site scripting.** The React frontend uses standard React escaping; do not use `dangerouslySetInnerHTML` on user-controlled content.

## What each variant protects by default

| Variant | Bind address | Default auth | TLS |
|---|---|---|---|
| Local | `127.0.0.1:5000` | none (single-user) | none |
| Headless | `0.0.0.0:80` (nginx) | nginx basic auth via htpasswd | terminate at nginx (you provide the cert) |
| OOD | reverse-proxied by OOD | your institution's SSO through OOD | provided by OOD |

The Local variant is designed for a single user on their own machine. If you tunnel it over SSH or expose it on a LAN, add authentication first.

The Headless variant ships with basic-auth so it is not open to the internet out of the box, but the install script does not automatically obtain a TLS certificate. See `docs/install-headless.md` for how to add Let's Encrypt.

The OOD variant inherits your Open OnDemand deployment's SSO. If OOD is behind Shibboleth, LDAP, OpenID, etc., so is the RELION Web UI. Nothing extra to configure.

## What is not in place

- No account lockout after failed logins.
- No rate limiting on the API endpoints (add nginx `limit_req_zone` if you expose the service on the public internet).
- No multi-tenant isolation. All authenticated users share the same OS-side identity for `sbatch` submission. Fine for a single team; not multi-tenant SaaS.
- No default TLS certificates. You provide the cert.

## Reporting a vulnerability

Please do not open a public GitHub issue. Instead, contact the maintainers by email at `<maintainer-email>`. We will acknowledge within one business day and coordinate a fix.

## Dependency policy

- Frontend: React, Material-UI, TypeScript. Kept on current LTS majors.
- Backend: Flask, gunicorn, standard scientific-Python. `requirements.txt` pins to compatible ranges.
- Container runtime: Apptainer / Singularity 3.x or later.
- RELION: 4.x or 5.x. RELION 5 is the tested target.
