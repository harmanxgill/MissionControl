from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.models.job import JobStatus


# ── Input shapes ────────────────────────────────────────────────────────────

class Point(BaseModel):
    x: float = Field(..., ge=0, le=1000)
    y: float = Field(..., ge=0, le=1000)


class Obstacle(BaseModel):
    x: float = Field(..., ge=0, le=1000)
    y: float = Field(..., ge=0, le=1000)
    radius: float = Field(..., gt=0, le=200)


class DroneJobInput(BaseModel):
    start: Point
    destination: Point
    speed: float = Field(default=75, ge=10, le=300)   # sim units / second
    obstacles: List[Obstacle] = Field(default_factory=list)

    @model_validator(mode="after")
    def start_and_dest_differ(self):
        if self.start.x == self.destination.x and self.start.y == self.destination.y:
            raise ValueError("start and destination must be different")
        return self


class JobCreate(BaseModel):
    title: str
    input_data: DroneJobInput


# ── Response shapes ──────────────────────────────────────────────────────────

class JobResponse(BaseModel):
    id: UUID
    title: str
    input_data: str           # raw JSON string (frontend deserialises)
    status: JobStatus
    result: Optional[str] = None
    error_message: Optional[str] = None
    retry_count: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class JobStats(BaseModel):
    total: int
    queued: int
    processing: int
    completed: int
    failed: int
