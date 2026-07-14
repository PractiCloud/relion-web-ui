"""Phusion Passenger entry point for the RELION 5 OOD app.

The backend path below (`__BACKEND_DIR__`) is rewritten in place by
install_relion_beta.sh to point at whatever directory the customer chose for
the Flask backend (default: /opt/relion5_passenger_backend).

This file expects Passenger to import `application` from it.
"""
import os
import sys

# Signal to app.py that we're under Passenger so SocketIO uses its WSGI stub
os.environ['RELION_WSGI'] = '1'

# Load the site env file written by install_relion_beta.sh, if present.
# OOD also injects the same vars via /etc/ood/config/apps/relion_passenger/env
# for the ERB templates; we read it here so the Flask process sees them too.
_env_file = '/etc/ood/config/apps/relion_passenger/env'
if os.path.isfile(_env_file):
    with open(_env_file) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, _, v = line.partition('=')
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

backend_path = '__BACKEND_DIR__'
sys.path.insert(0, backend_path)
os.chdir(backend_path)

from app import app as application
