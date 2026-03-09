"""Job status enumeration."""

from enum import Enum


class JobStatus(str, Enum):
    """Status of a transformation job."""

    PENDING = "pending"
    QUEUED = "queued"
    PROCESSING = "processing"
    AWAITING_REVIEW = "awaiting_review"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TransformationType(str, Enum):
    """Type of transformation to apply."""

    CLEAN = "clean"
    NORMALIZE = "normalize"
    DEDUPLICATE = "deduplicate"
    MERGE = "merge"
    TRANSFORM = "transform"
    VALIDATE = "validate"
