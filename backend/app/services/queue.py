import json

import redis

from app.config import settings

_redis_client: redis.Redis | None = None
QUEUE_NAME = "jobs"


def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


def enqueue_job(job_id: str) -> None:
    r = get_redis()
    r.rpush(QUEUE_NAME, json.dumps({"job_id": job_id}))


def dequeue_job() -> dict | None:
    r = get_redis()
    item = r.blpop(QUEUE_NAME, timeout=5)
    if item:
        _, payload = item
        return json.loads(payload)
    return None
