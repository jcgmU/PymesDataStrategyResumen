"""Transformation job domain entity."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID

from src.domain.value_objects.job_status import JobStatus, TransformationType


@dataclass
class TransformationJob:
    """Represents an ETL transformation job."""

    id: UUID
    dataset_id: UUID
    transformation_type: TransformationType
    status: JobStatus
    config: dict[str, Any]
    result: dict[str, Any] | None
    error_message: str | None
    progress: int
    created_by: UUID
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def create(
        cls,
        *,
        id: UUID,
        dataset_id: UUID,
        transformation_type: TransformationType,
        config: dict[str, Any],
        created_by: UUID,
    ) -> "TransformationJob":
        """Create a new transformation job."""
        return cls(
            id=id,
            dataset_id=dataset_id,
            transformation_type=transformation_type,
            status=JobStatus.PENDING,
            config=config,
            result=None,
            error_message=None,
            progress=0,
            created_by=created_by,
            created_at=datetime.utcnow(),
            started_at=None,
            completed_at=None,
            metadata={},
        )

    def start(self) -> None:
        """Mark job as started."""
        self.status = JobStatus.PROCESSING
        self.started_at = datetime.utcnow()

    def update_progress(self, progress: int) -> None:
        """Update job progress (0-100)."""
        self.progress = max(0, min(100, progress))

    def complete(self, result: dict[str, Any]) -> None:
        """Mark job as completed with result."""
        self.status = JobStatus.COMPLETED
        self.result = result
        self.progress = 100
        self.completed_at = datetime.utcnow()

    def fail(self, error_message: str) -> None:
        """Mark job as failed with error."""
        self.status = JobStatus.FAILED
        self.error_message = error_message
        self.completed_at = datetime.utcnow()

    def request_review(self) -> None:
        """Mark job as awaiting human review."""
        self.status = JobStatus.AWAITING_REVIEW

    def cancel(self) -> None:
        """Cancel the job."""
        self.status = JobStatus.CANCELLED
        self.completed_at = datetime.utcnow()

    @property
    def is_terminal(self) -> bool:
        """Check if job is in a terminal state."""
        return self.status in (
            JobStatus.COMPLETED,
            JobStatus.FAILED,
            JobStatus.CANCELLED,
        )
