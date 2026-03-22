"""
Mission Control – Drone Simulation Worker
==========================================
Uses A* on a discretised grid for reliable path-finding (potential fields get
stuck in local minima when obstacles cluster). After A* finds a grid-level path,
the route is smoothed by string-pulling and then re-sampled into evenly-spaced
waypoints so the frontend animation plays at a consistent speed.
"""
import enum as _enum
import heapq
import json
import logging
import math
import os
import time
import uuid as _uuid
from datetime import datetime

import redis
from sqlalchemy import Column, DateTime, Enum, Integer, String, Text, create_engine
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, sessionmaker

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DATABASE_URL = os.environ["DATABASE_URL"]
REDIS_URL = os.environ["REDIS_URL"]
QUEUE_NAME = "jobs"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── Minimal ORM mirror ───────────────────────────────────────────────────────

class JobStatus(str, _enum.Enum):
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid.uuid4)
    title = Column(String(255), nullable=False)
    input_data = Column(Text, nullable=False)
    status = Column(Enum(JobStatus), default=JobStatus.queued, nullable=False)
    result = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)


# ── Path-finding ─────────────────────────────────────────────────────────────

WORLD = 1000.0
CELL = 20          # world units per grid cell  → 50×50 grid
GRID_DIM = int(WORLD / CELL)   # 50


def _wg(x: float, y: float) -> tuple[int, int]:
    """World → grid cell (clamped)."""
    return (
        max(0, min(GRID_DIM - 1, int(x / CELL))),
        max(0, min(GRID_DIM - 1, int(y / CELL))),
    )


def _gw(gx: int, gy: int) -> tuple[float, float]:
    """Grid cell centre → world coords."""
    return gx * CELL + CELL / 2, gy * CELL + CELL / 2


def _build_blocked(obstacles: list[dict]) -> set[tuple[int, int]]:
    blocked: set[tuple[int, int]] = set()
    for obs in obstacles:
        ox, oy, r = float(obs["x"]), float(obs["y"]), float(obs["radius"])
        # inflate by 1.5 cells so the drone body doesn't clip edges
        inflate = r + CELL * 1.5
        for gx in range(GRID_DIM):
            for gy in range(GRID_DIM):
                wx, wy = _gw(gx, gy)
                if math.dist((wx, wy), (ox, oy)) < inflate:
                    blocked.add((gx, gy))
    return blocked


def _astar(
    sg: tuple[int, int],
    eg: tuple[int, int],
    blocked: set[tuple[int, int]],
) -> list[tuple[int, int]] | None:
    """Return list of grid cells from sg to eg, or None if no path."""
    if sg == eg:
        return [sg]

    g_score: dict[tuple[int, int], float] = {sg: 0.0}
    came_from: dict[tuple[int, int], tuple[int, int]] = {}
    open_q: list[tuple[float, float, tuple[int, int]]] = [
        (math.dist(sg, eg), 0.0, sg)
    ]

    while open_q:
        _, cost, curr = heapq.heappop(open_q)
        if curr == eg:
            path: list[tuple[int, int]] = []
            while curr in came_from:
                path.append(curr)
                curr = came_from[curr]
            path.append(sg)
            path.reverse()
            return path

        cx, cy = curr
        for dx in range(-1, 2):
            for dy in range(-1, 2):
                if dx == dy == 0:
                    continue
                nb = (cx + dx, cy + dy)
                if not (0 <= nb[0] < GRID_DIM and 0 <= nb[1] < GRID_DIM):
                    continue
                if nb in blocked:
                    continue
                new_g = cost + math.sqrt(dx * dx + dy * dy)
                if new_g < g_score.get(nb, float("inf")):
                    g_score[nb] = new_g
                    came_from[nb] = curr
                    h = math.dist(nb, eg)
                    heapq.heappush(open_q, (new_g + h, new_g, nb))

    return None  # no path


def _string_pull(
    waypoints: list[tuple[float, float]],
    obstacles: list[dict],
) -> list[tuple[float, float]]:
    """
    Remove redundant intermediate waypoints by checking line-of-sight.
    A segment is clear if it doesn't pass within (radius + margin) of any obstacle.
    """
    MARGIN = CELL * 1.2

    def segment_clear(a: tuple[float, float], b: tuple[float, float]) -> bool:
        for obs in obstacles:
            ox, oy, r = float(obs["x"]), float(obs["y"]), float(obs["radius"])
            # Minimum distance from obstacle centre to segment a→b
            ax, ay = a
            bx, by = b
            dx, dy = bx - ax, by - ay
            t = max(0.0, min(1.0, ((ox - ax) * dx + (oy - ay) * dy) / max(dx * dx + dy * dy, 1e-9)))
            px, py = ax + t * dx, ay + t * dy
            if math.dist((px, py), (ox, oy)) < r + MARGIN:
                return False
        return True

    if len(waypoints) <= 2:
        return waypoints

    result = [waypoints[0]]
    i = 0
    while i < len(waypoints) - 1:
        # Find furthest visible waypoint from result[-1]
        j = len(waypoints) - 1
        while j > i + 1:
            if segment_clear(result[-1], waypoints[j]):
                break
            j -= 1
        result.append(waypoints[j])
        i = j

    return result


def _resample(
    waypoints: list[tuple[float, float]], step: float = 15.0
) -> list[list[float]]:
    """Re-sample a polyline into evenly-spaced points for smooth animation."""
    if len(waypoints) < 2:
        return [[waypoints[0][0], waypoints[0][1]]]

    out: list[list[float]] = [[round(waypoints[0][0], 1), round(waypoints[0][1], 1)]]
    leftover = 0.0

    for i in range(1, len(waypoints)):
        ax, ay = waypoints[i - 1]
        bx, by = waypoints[i]
        seg_len = math.dist((ax, ay), (bx, by))
        if seg_len < 1e-6:
            continue
        dx, dy = (bx - ax) / seg_len, (by - ay) / seg_len
        d = leftover
        while d < seg_len:
            px = ax + dx * d
            py = ay + dy * d
            out.append([round(px, 1), round(py, 1)])
            d += step
        leftover = d - seg_len

    last = waypoints[-1]
    out.append([round(last[0], 1), round(last[1], 1)])
    return out


# ── Main simulation entry-point ──────────────────────────────────────────────

def simulate_flight(
    start: dict,
    destination: dict,
    speed: float,
    obstacles: list[dict],
) -> dict:
    sx_w, sy_w = float(start["x"]), float(start["y"])
    dx_w, dy_w = float(destination["x"]), float(destination["y"])

    sg = _wg(sx_w, sy_w)
    eg = _wg(dx_w, dy_w)
    blocked = _build_blocked(obstacles)
    blocked.discard(sg)
    blocked.discard(eg)

    grid_path = _astar(sg, eg, blocked)

    if grid_path is None:
        # Inflate was too aggressive — retry with no inflation (clear a corridor)
        log.warning("A* found no path — retrying without inflation")
        blocked2 = _build_blocked([]) # empty
        for obs in obstacles:
            ox, oy, r = float(obs["x"]), float(obs["y"]), float(obs["radius"])
            for gx in range(GRID_DIM):
                for gy in range(GRID_DIM):
                    wx, wy = _gw(gx, gy)
                    if math.dist((wx, wy), (ox, oy)) < r:
                        blocked2.add((gx, gy))
        blocked2.discard(sg)
        blocked2.discard(eg)
        grid_path = _astar(sg, eg, blocked2)

    if grid_path is None:
        # Absolute fallback: straight line
        world_path: list[tuple[float, float]] = [(sx_w, sy_w), (dx_w, dy_w)]
    else:
        # Convert grid path to world coords
        world_path = [(sx_w, sy_w)]
        for gx, gy in grid_path[1:-1]:
            world_path.append(_gw(gx, gy))
        world_path.append((dx_w, dy_w))
        # String-pull to smooth
        world_path = _string_pull(world_path, obstacles)

    waypoints = _resample(world_path, step=15.0)

    straight_dist = math.dist((sx_w, sy_w), (dx_w, dy_w))
    total_dist = sum(
        math.dist(waypoints[i], waypoints[i + 1])
        for i in range(len(waypoints) - 1)
    )
    efficiency = (straight_dist / total_dist * 100) if total_dist > 0 else 100.0
    time_sec = total_dist / speed if speed > 0 else 0
    fuel = total_dist * 0.045 * ((speed / 60) ** 0.75)

    return {
        "waypoints": waypoints,
        "total_distance": round(total_dist, 1),
        "straight_line_distance": round(straight_dist, 1),
        "route_efficiency": round(efficiency, 1),
        "time_taken_seconds": round(time_sec, 1),
        "fuel_used": round(fuel, 1),
        "waypoint_count": len(waypoints),
        "obstacles_avoided": len(obstacles),
    }


# ── Job runner ───────────────────────────────────────────────────────────────

def process_job(job_id: str) -> None:
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            log.warning("Job %s not found", job_id)
            return

        log.info("▶ Processing job %s: %s", job_id, job.title)
        job.status = JobStatus.processing
        job.updated_at = datetime.utcnow()
        db.commit()

        params = json.loads(job.input_data)
        time.sleep(1.5)  # let the UI show "processing" state

        result = simulate_flight(
            start=params["start"],
            destination=params["destination"],
            speed=params.get("speed", 75),
            obstacles=params.get("obstacles", []),
        )

        log.info(
            "✓ Job %s | dist=%.1f | straight=%.1f | efficiency=%.1f%% | wpts=%d",
            job_id,
            result["total_distance"],
            result["straight_line_distance"],
            result["route_efficiency"],
            result["waypoint_count"],
        )

        job.status = JobStatus.completed
        job.result = json.dumps(result)
        job.completed_at = datetime.utcnow()
        job.updated_at = datetime.utcnow()
        db.commit()

    except Exception as exc:
        log.exception("✗ Job %s failed: %s", job_id, exc)
        db.rollback()
        try:
            job = db.query(Job).filter(Job.id == job_id).first()
            if job:
                job.status = JobStatus.failed
                job.error_message = str(exc)
                job.updated_at = datetime.utcnow()
                db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()


# ── Entry point ──────────────────────────────────────────────────────────────

def main() -> None:
    log.info("Drone worker started | Redis: %s", REDIS_URL)
    r = redis.from_url(REDIS_URL, decode_responses=True)
    while True:
        item = r.blpop(QUEUE_NAME, timeout=5)
        if item:
            _, payload = item
            data = json.loads(payload)
            process_job(data["job_id"])


if __name__ == "__main__":
    main()
