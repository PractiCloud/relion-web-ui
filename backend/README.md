# RELION Backend API Server

A Flask-based REST API server that connects the RELION web UI to the RELION command-line tools.

## Features

- **Pipeline Management**: View and manage RELION processing pipelines
- **Job Submission**: Submit and monitor RELION jobs
- **File Browser**: Browse project files and STAR files
- **Real-time Updates**: WebSocket support for live status updates
- **Project Management**: Create and switch between projects

## Requirements

- Python 3.8+
- RELION 5.x installed

## Installation

```bash
cd relion-backend
./run.sh
```

The script will:
1. Create a virtual environment
2. Install dependencies
3. Start the server on port 5000

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `RELION_BIN_PATH` | `/opt/relion/build/bin` | Path to RELION binaries |
| `RELION_PROJECT_DIR` | `~/relion_projects` | Default project directory |
| `RELION_API_HOST` | `0.0.0.0` | Server host |
| `RELION_API_PORT` | `5000` | Server port |

## API Endpoints

### Pipeline

- `GET /api/pipeline` - Get pipeline overview
- `GET /api/pipeline/processes` - List all processes
- `GET /api/pipeline/processes/:id` - Get process details
- `DELETE /api/pipeline/processes/:id` - Delete process
- `POST /api/pipeline/processes/:id/abort` - Abort process
- `POST /api/pipeline/processes/:id/cleanup` - Cleanup files
- `GET /api/pipeline/processes/:id/log` - Get logs
- `GET /api/pipeline/processes/:id/status` - Get status

### Jobs

- `GET /api/jobs/types` - List job types
- `GET /api/jobs/template/:type` - Get job template
- `POST /api/jobs/submit` - Submit job
- `POST /api/jobs/schedule` - Schedule job
- `GET /api/jobs/:id/config` - Get job config

### Files

- `GET /api/files/nodes` - Browse pipeline nodes
- `GET /api/files/content?path=...` - Get file content
- `GET /api/files/list?path=...` - List directory

### STAR Files

- `GET /api/star/parse?path=...` - Parse STAR file
- `POST /api/star/write` - Write STAR file

### Projects

- `GET /api/projects` - List projects
- `POST /api/projects/open` - Open project
- `POST /api/projects/create` - Create project

### WebSocket

Connect to `ws://localhost:5000/ws` for real-time updates.

Events:
- `pipeline_update` - Pipeline state changed
- `process_status_change` - Process status changed

## Usage with Web UI

1. Start the backend:
   ```bash
   cd relion-backend
   ./run.sh
   ```

2. Start the frontend (in another terminal):
   ```bash
   cd relion-web-ui
   npm start
   ```

3. Open http://localhost:3000 in your browser

## Development

To run in development mode with auto-reload:

```bash
source venv/bin/activate
export FLASK_DEBUG=1
python app.py
```
