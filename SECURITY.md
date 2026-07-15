# Security

## Threat model

RELION Web UI is a browser interface that submits and monitors compute jobs. Threats and their mitigation status:

| # | Threat | Status | Where handled |
|---|---|---|---|
| 1 | Unauthorized access to a running instance | **Your responsibility** | Reverse proxy / OOD SSO / nginx basic-auth |
| 2 | Command injection through job parameters | **Mitigated in code** | `shlex.quote()` at the shell boundary |
| 3 | Path traversal on file-serving endpoints | **Mitigated in code** | Base-directory canonicalisation before `send_file()` |
| 4 | Cross-site scripting | **Mitigated in code** | React default escaping + CSP header |
| 5 | Cross-site request forgery | **Mitigated in code** | `X-Requested-With` header required on POST/PUT/PATCH/DELETE |

Notes for maintainers and forkers:

- **(1) Unauthorized access** is by design a deployment concern. The backend trusts whatever identity the reverse proxy forwards. Each deployment shape has a default auth story (see table below); if you bypass the proxy, add auth first.
- **(2) Command injection** — the `shlex.quote()` boundary in `job_manager.py` is the only thing between user-supplied RELION parameters and a Slurm sbatch script. Do not disable it, and do not build shell commands with f-strings elsewhere.
- **(3) Path traversal** — every file-serving endpoint validates that the resolved absolute path is under the project directory. Preserve this pattern in new endpoints.
- **(4) XSS** — a Content-Security-Policy header is set by `_security_headers()` in `app.py`. Do not use `dangerouslySetInnerHTML` on user-controlled content.
- **(5) CSRF** — the `_require_xhr_header_on_writes()` before-request hook in `app.py` rejects state-changing requests without `X-Requested-With: XMLHttpRequest`. The frontend adds this header globally in `index.tsx`. This blocks form-based CSRF from another origin because browsers do not send custom headers on cross-origin form posts.

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
- No rate limiting on the API endpoints (add nginx `limit_req_zone` if you expose the service on the public internet). Job-submission flooding by an authenticated user is bounded by your Slurm QoS / partition limits, not the app.
- No multi-tenant isolation. All authenticated users share the same OS-side identity for `sbatch` submission. Fine for a single team; not multi-tenant SaaS.
- No default TLS certificates. You provide the cert.

## Reporting a vulnerability

Please do not open a public GitHub issue. Instead, contact the maintainers by email at `<maintainer-email>`. We will acknowledge within one business day and coordinate a fix.

## Dependency policy

- Frontend: React, Material-UI, TypeScript. Kept on current LTS majors.
- Backend: Flask, gunicorn, standard scientific-Python. `requirements.txt` pins to compatible ranges.
- Container runtime: Apptainer / Singularity 3.x or later.
- RELION: 4.x or 5.x. RELION 5 is the tested target.
