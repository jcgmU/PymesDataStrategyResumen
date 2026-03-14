"""Anomaly domain entity."""

from dataclasses import dataclass
from datetime import datetime


@dataclass
class AnomalyEntity:
    """Represents an anomaly detected during ETL processing.

    Maps to the ``anomalies`` table in Prisma schema.
    """

    id: str
    dataset_id: str
    column: str
    row: int | None
    type: str  # "MISSING_VALUE" | "OUTLIER" | "FORMAT_ERROR" | "DUPLICATE"
    description: str
    original_value: str | None
    suggested_value: str | None
    status: str  # "PENDING" | "RESOLVED"
    created_at: datetime

    @classmethod
    def create(
        cls,
        *,
        id: str,
        dataset_id: str,
        column: str,
        row: int | None,
        anomaly_type: str,
        description: str,
        original_value: str | None = None,
        suggested_value: str | None = None,
    ) -> "AnomalyEntity":
        """Create a new anomaly entity."""
        return cls(
            id=id,
            dataset_id=dataset_id,
            column=column,
            row=row,
            type=anomaly_type,
            description=description,
            original_value=original_value,
            suggested_value=suggested_value,
            status="PENDING",
            created_at=datetime.utcnow(),
        )
