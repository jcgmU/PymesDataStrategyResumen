"""Dataset repository port - interface for dataset persistence."""

from abc import ABC, abstractmethod
from uuid import UUID

from src.domain.entities.dataset import Dataset


class DatasetRepository(ABC):
    """Port for dataset persistence operations."""

    @abstractmethod
    async def find_by_id(self, id: UUID) -> Dataset | None:
        """Find a dataset by ID."""
        ...

    @abstractmethod
    async def save(self, dataset: Dataset) -> Dataset:
        """Save a dataset (create or update)."""
        ...

    @abstractmethod
    async def delete(self, id: UUID) -> bool:
        """Delete a dataset by ID."""
        ...

    @abstractmethod
    async def find_by_owner(
        self,
        owner_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Dataset]:
        """Find datasets by owner."""
        ...
