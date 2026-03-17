"""Domain errors for the ETL worker.

These exceptions represent domain-level failures and are meant to be raised
by domain entities and application use cases. Infrastructure adapters should
catch low-level errors and re-raise them as one of these types.
"""

from __future__ import annotations


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------


class WorkerError(Exception):
    """Base class for all worker domain errors."""

    def __init__(self, message: str, *, context: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.context: dict = context or {}

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}({self.message!r})"


# ---------------------------------------------------------------------------
# Storage errors
# ---------------------------------------------------------------------------


class StorageError(WorkerError):
    """Raised when an object-storage operation fails."""


class ObjectNotFoundError(StorageError):
    """Raised when the requested file/object does not exist in storage."""

    def __init__(self, bucket: str, key: str) -> None:
        super().__init__(
            f"Object not found: {bucket}/{key}",
            context={"bucket": bucket, "key": key},
        )
        self.bucket = bucket
        self.key = key


class BucketNotFoundError(StorageError):
    """Raised when the target bucket does not exist."""

    def __init__(self, bucket: str) -> None:
        super().__init__(
            f"Bucket not found: {bucket}",
            context={"bucket": bucket},
        )
        self.bucket = bucket


# ---------------------------------------------------------------------------
# Parsing errors
# ---------------------------------------------------------------------------


class ParsingError(WorkerError):
    """Raised when a dataset file cannot be parsed."""

    def __init__(self, filename: str, reason: str) -> None:
        super().__init__(
            f"Failed to parse '{filename}': {reason}",
            context={"filename": filename, "reason": reason},
        )
        self.filename = filename
        self.reason = reason


class UnsupportedFormatError(ParsingError):
    """Raised when the file format is not supported."""

    def __init__(self, filename: str, detected_format: str) -> None:
        super().__init__(
            filename=filename,
            reason=f"Unsupported format '{detected_format}'",
        )
        self.detected_format = detected_format


# ---------------------------------------------------------------------------
# Transformation errors
# ---------------------------------------------------------------------------


class TransformationError(WorkerError):
    """Raised when a data transformation cannot be applied."""

    def __init__(
        self,
        transformation: str,
        reason: str,
        *,
        columns: list[str] | None = None,
    ) -> None:
        super().__init__(
            f"Transformation '{transformation}' failed: {reason}",
            context={
                "transformation": transformation,
                "reason": reason,
                "columns": columns or [],
            },
        )
        self.transformation = transformation
        self.reason = reason
        self.columns = columns or []


class UnknownTransformationError(TransformationError):
    """Raised when an unrecognised transformation type is requested."""

    def __init__(self, transformation_type: str) -> None:
        super().__init__(
            transformation=transformation_type,
            reason=f"Unknown transformation type '{transformation_type}'",
        )


class ColumnNotFoundError(TransformationError):
    """Raised when one or more required columns are missing from the DataFrame."""

    def __init__(self, transformation: str, missing_columns: list[str]) -> None:
        super().__init__(
            transformation=transformation,
            reason=f"Columns not found: {missing_columns}",
            columns=missing_columns,
        )
        self.missing_columns = missing_columns


# ---------------------------------------------------------------------------
# Job errors
# ---------------------------------------------------------------------------


class JobError(WorkerError):
    """Raised for job lifecycle failures."""


class JobNotFoundError(JobError):
    """Raised when a job ID cannot be located."""

    def __init__(self, job_id: str) -> None:
        super().__init__(
            f"Job not found: {job_id}",
            context={"job_id": job_id},
        )
        self.job_id = job_id


class InvalidJobDataError(JobError):
    """Raised when job payload is missing required fields or has invalid values."""

    def __init__(self, reason: str, *, field: str | None = None) -> None:
        super().__init__(
            f"Invalid job data: {reason}",
            context={"reason": reason, "field": field},
        )
        self.reason = reason
        self.field = field


# ---------------------------------------------------------------------------
# Configuration errors
# ---------------------------------------------------------------------------


class ConfigurationError(WorkerError):
    """Raised when required configuration is missing or invalid."""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


__all__ = [
    "BucketNotFoundError",
    "ColumnNotFoundError",
    "ConfigurationError",
    "InvalidJobDataError",
    "JobError",
    "JobNotFoundError",
    "ObjectNotFoundError",
    "ParsingError",
    "StorageError",
    "TransformationError",
    "UnknownTransformationError",
    "UnsupportedFormatError",
    "WorkerError",
]
