# Mission Control

A full-stack drone flight simulation platform. Submit missions, watch them move through a live job queue, and replay animated flight paths with telemetry data: all inside a dark aerospace-style HMI.

## What it does

You define a flight mission: origin, destination, velocity, and obstacles, and the system:

1. Queues the job and dispatches it to a Python worker
2. Runs an **A\* pathfinding simulation** on a 1000×1000 grid with obstacle avoidance
3. Smooths the path via string-pulling, then resamples it into evenly-spaced waypoints
4. Returns telemetry: total distance, flight time, fuel used, route efficiency
5. Animates the drone flying the computed path in the UI

Status transitions: `[QUEUED]` → `[PROC..]` → `[CMPL]` / `[FAIL]` — update live via polling every 4 seconds.


## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS · Space Mono |
| Backend | FastAPI · SQLAlchemy · Pydantic v2 |
| Worker | Python 3.12 · A\* pathfinding |
| Queue | Redis (RPUSH / BLPOP) |
| Database | PostgreSQL 16 |
| Infrastructure | Docker Compose |

## Getting started

**Prerequisites:** Docker Desktop (or Docker + Docker Compose v2)

```bash
git clone git@github.com:harmanxgill/MissionControl.git
cd missioncontrol
docker compose up --build
```

| Service | URL |
|---|---|
| Dashboard | http://localhost:3001 |
| API (REST) | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |

> The database schema is created automatically on first boot. No migrations needed for local dev.

## API reference

All endpoints are prefixed `/api`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/jobs` | Create and enqueue a new simulation |
| `GET` | `/jobs` | List all jobs (supports `?status=` filter) |
| `GET` | `/jobs/stats` | Counts per status |
| `GET` | `/jobs/{id}` | Get a single job |
| `POST` | `/jobs/{id}/retry` | Re-queue a failed job |

**Create job payload**
```json
{
  "title": "ALPHA-RECON-01",
  "input_data": {
    "start":       { "x": 100, "y": 100 },
    "destination": { "x": 850, "y": 850 },
    "speed": 75,
    "obstacles": [
      { "x": 400, "y": 400, "radius": 70 }
    ]
  }
}
```

**Result payload** (on completion)
```json
{
  "waypoints": [[100, 100], [115, 113], "..."],
  "total_distance": 1084.5,
  "straight_line_distance": 1060.7,
  "route_efficiency": 97.8,
  "time_taken_seconds": 14.5,
  "fuel_used": 57.7,
  "waypoint_count": 75,
  "obstacles_avoided": 1
}
```

## How the simulation works

The worker runs on its own container and pulls jobs from a Redis list.

**Path planning: A\* on a discretised grid**

The 1000×1000 world is divided into a 50×50 grid (20 units/cell). Each obstacle inflates its blocked radius by 1.5 cells so the drone body never clips edges. A\* finds the shortest path through unblocked cells using diagonal movement.

**String-pulling**

After A\* returns a grid-level path, redundant waypoints are removed by walking forward along the path and keeping only points where line-of-sight to the next visible node is obstructed. This turns the blocky grid path into clean straight-line segments.

**Resampling**

The smoothed path is resampled at 15-unit intervals to produce evenly-spaced waypoints. This ensures the frontend animation plays at a consistent speed regardless of path length.

**Metrics**

| Metric | Formula |
|---|---|
| Total distance | Sum of all waypoint segment lengths |
| Route efficiency | `straight_line_distance / total_distance × 100` |
| Flight time | `total_distance / speed` |
| Fuel used | `total_distance × 0.045 × (speed/60)^0.75` |

---

## Resetting local data

```bash
docker compose down -v   # drops the postgres volume
docker compose up --build
```

---

## License

MIT
