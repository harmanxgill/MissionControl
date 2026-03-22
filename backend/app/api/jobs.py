import json
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.job import Job, JobStatus
from app.schemas.job import JobCreate, JobResponse, JobStats
from app.services.queue import enqueue_job

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("", response_model=JobResponse, status_code=201)
def create_job(payload: JobCreate, db: Session = Depends(get_db)):
    """Create a drone-simulation job and push it onto the Redis queue."""
    job = Job(
        title=payload.title,
        input_data=payload.input_data.model_dump_json(),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    enqueue_job(str(job.id))
    return job


@router.get("", response_model=List[JobResponse])
def list_jobs(
    skip: int = 0,
    limit: int = 50,
    status: JobStatus | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Job)
    if status:
        query = query.filter(Job.status == status)
    return query.order_by(Job.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/stats", response_model=JobStats)
def get_stats(db: Session = Depends(get_db)):
    rows = (
        db.query(Job.status, func.count(Job.id).label("cnt"))
        .group_by(Job.status)
        .all()
    )
    counts = {row.status: row.cnt for row in rows}
    return JobStats(
        total=sum(counts.values()),
        queued=counts.get(JobStatus.queued, 0),
        processing=counts.get(JobStatus.processing, 0),
        completed=counts.get(JobStatus.completed, 0),
        failed=counts.get(JobStatus.failed, 0),
    )


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: UUID, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/{job_id}/retry", response_model=JobResponse)
def retry_job(job_id: UUID, db: Session = Depends(get_db)):
    """Re-queue a failed simulation for another attempt."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != JobStatus.failed:
        raise HTTPException(status_code=400, detail="Only failed jobs can be retried")
    job.status = JobStatus.queued
    job.error_message = None
    job.retry_count += 1
    db.commit()
    db.refresh(job)
    enqueue_job(str(job.id))
    return job
