"""Dataset domain entity."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID


@dataclass
class Dataset:
    """Represents a dataset in the ETL system."""

    id: UUID
    name: str
    file_path: str
    file_size: int
    row_count: int | None
    column_count: int | None
    schema_info: dict[str, Any] | None
    status: str
    owner_id: UUID
    created_at: datetime
    updated_at: datetime

    @classmethod
    def create(
        cls,
        *,
        id: UUID,
        name: str,
        file_path: str,
        file_size: int,
        owner_id: UUID,
    ) -> "Dataset":
        """Create a new dataset entity."""
        now = datetime.utcnow()
        return cls(
            id=id,
            name=name,
            file_path=file_path,
            file_size=file_size,
            row_count=None,
            column_count=None,
            schema_info=None,
            status="pending",
            owner_id=owner_id,
            created_at=now,
            updated_at=now,
        )

    def mark_analyzed(
        self,
        *,
        row_count: int,
        column_count: int,
        schema_info: dict[str, Any],
    ) -> None:
        """Mark dataset as analyzed with metadata."""
        self.row_count = row_count
        self.column_count = column_count
        self.schema_info = schema_info
        self.status = "ready"
        self.updated_at = datetime.utcnow()
