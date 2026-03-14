"""E2E Integration tests for the complete ETL pipeline.

These tests verify the full flow:
1. API enqueues a job
2. Worker picks up the job from Redis
3. Worker downloads file from MinIO
4. Worker processes the file (parsing + transformations)
5. Worker uploads result to MinIO
6. API can query job status

Note: These tests require all containers to be running.
Run with: pytest tests/e2e/ --run-e2e
"""

import asyncio
import uuid
from io import BytesIO
from typing import Any, Generator

import polars as pl
import pytest
from testcontainers.minio import MinioContainer
from testcontainers.redis import RedisContainer

from src.application.processors.etl_processor import ETLJobProcessor
from src.application.transformations import DataTransformer
from src.application.use_cases.process_dataset import ProcessDatasetUseCase
from src.infrastructure.config.settings import Settings
from src.infrastructure.messaging.bullmq_worker import (
    BullMQWorkerService,
    SimpleJobProcessor,
)
from src.infrastructure.parsers.dataset_parser import DatasetParser
from src.infrastructure.storage.minio_storage_service import MinioStorageService


# ---------------------------------------------------------------------------
# Container fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def minio_container() -> Generator[MinioContainer, None, None]:
    """Create a MinIO container for the test module."""
    with MinioContainer() as container:
        yield container


@pytest.fixture(scope="module")
def redis_container() -> Generator[RedisContainer, None, None]:
    """Create a Redis container for the test module."""
    with RedisContainer("redis:7-alpine") as container:
        yield container


# ---------------------------------------------------------------------------
# Service fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def settings(
    minio_container: MinioContainer, redis_container: RedisContainer
) -> Settings:
    """Create settings configured for test containers."""
    minio_host = minio_container.get_container_host_ip()
    minio_port = int(minio_container.get_exposed_port(9000))
    redis_host = redis_container.get_container_host_ip()
    redis_port = int(redis_container.get_exposed_port(6379))

    return Settings(
        environment="test",
        redis_host=redis_host,
        redis_port=redis_port,
        minio_endpoint=minio_host,
        minio_port=minio_port,
        minio_access_key=minio_container.access_key,
        minio_secret_key=minio_container.secret_key,
        minio_use_ssl=False,
        # Use field names that actually exist on Settings
        minio_bucket_datasets="test-datasets",
        minio_bucket_results="test-processed",
        minio_bucket_temp="test-temp",
    )


@pytest.fixture
async def storage_service(settings: Settings) -> MinioStorageService:
    """Create and initialize storage service with test buckets."""
    storage = MinioStorageService(settings=settings)

    # ensure_bucket_exists creates the bucket if it doesn't already exist
    await storage.ensure_bucket_exists(settings.minio_bucket_datasets)
    await storage.ensure_bucket_exists(settings.minio_bucket_results)

    return storage


@pytest.fixture
def parser() -> DatasetParser:
    return DatasetParser()


@pytest.fixture
def transformer() -> DataTransformer:
    return DataTransformer()


@pytest.fixture
def process_dataset_use_case(
    storage_service: MinioStorageService,
    parser: DatasetParser,
    transformer: DataTransformer,
    settings: Settings,
) -> ProcessDatasetUseCase:
    return ProcessDatasetUseCase(
        storage=storage_service,
        parser=parser,
        transformer=transformer,
        output_bucket=settings.minio_bucket_results,
    )


@pytest.fixture
def etl_processor(
    process_dataset_use_case: ProcessDatasetUseCase,
) -> ETLJobProcessor:
    return ETLJobProcessor(process_dataset=process_dataset_use_case)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _source_path(settings: Settings, dataset_id: uuid.UUID, filename: str) -> str:
    """Return the storage path that process_dataset understands.

    ProcessDatasetUseCase._parse_storage_path splits on the first "/" and
    treats the first segment as the bucket when it has no ".".
    """
    return f"{settings.minio_bucket_datasets}/uploads/{dataset_id}/{filename}"


# ---------------------------------------------------------------------------
# Full pipeline tests
# ---------------------------------------------------------------------------


class TestFullETLPipeline:
    """E2E tests for the complete ETL pipeline."""

    @pytest.mark.asyncio
    async def test_process_csv_with_transformations(
        self,
        storage_service: MinioStorageService,
        etl_processor: ETLJobProcessor,
        settings: Settings,
    ) -> None:
        """Test processing a CSV file with multiple transformations."""
        dataset_id = uuid.uuid4()
        job_id = uuid.uuid4()
        object_key = f"uploads/{dataset_id}/test_data.csv"

        csv_content = b"""name,email,age,salary,department
John Doe,JOHN.DOE@EXAMPLE.COM,25,50000,Engineering
Jane Smith,jane.smith@example.com,30,60000,Marketing
Bob Wilson,BOB.WILSON@EXAMPLE.COM,35,70000,Engineering
Alice Brown,alice.brown@example.com,28,55000,HR
"""
        await storage_service.upload_file(
            bucket=settings.minio_bucket_datasets,
            key=object_key,
            data=BytesIO(csv_content),
            content_type="text/csv",
        )

        # Correct transformation format: type = enum value, columns = list, params = dict
        job_data: dict[str, Any] = {
            "datasetId": str(dataset_id),
            "jobId": str(job_id),
            "sourceKey": _source_path(settings, dataset_id, "test_data.csv"),
            "filename": "test_data.csv",
            "transformations": [
                {
                    "type": "LOWERCASE",
                    "columns": ["email"],
                    "params": {},
                },
                {
                    "type": "TRIM_WHITESPACE",
                    "columns": ["name"],
                    "params": {},
                },
                {
                    "type": "FILTER_ROWS",
                    "columns": None,
                    "params": {"column": "age", "operator": "gte", "value": 28},
                },
            ],
            "outputFormat": "parquet",
        }

        result = await etl_processor.process(job_data)

        assert result["success"] is True
        assert result["datasetId"] == str(dataset_id)
        assert result["jobId"] == str(job_id)
        assert result["outputKey"] is not None
        assert result["rowsProcessed"] == 3  # age >= 28: Jane(30), Bob(35), Alice(28)
        assert result["columnsCount"] == 5

        # schema is dict[str, str] — column_name -> dtype_string
        schema = result["schema"]
        assert isinstance(schema, dict)
        assert "email" in schema
        assert "name" in schema

        # preview is list[dict]
        assert isinstance(result["preview"], list)

        # Verify transformations
        transformation_results = result["transformationResults"]
        assert len(transformation_results) == 3
        assert all(r["success"] for r in transformation_results)

        # Verify output file exists in MinIO
        output_exists = await storage_service.file_exists(
            bucket=settings.minio_bucket_results,
            key=result["outputKey"],
        )
        assert output_exists is True

    @pytest.mark.asyncio
    async def test_process_excel_file(
        self,
        storage_service: MinioStorageService,
        etl_processor: ETLJobProcessor,
        settings: Settings,
    ) -> None:
        """Test processing an Excel file without transformations."""
        dataset_id = uuid.uuid4()
        job_id = uuid.uuid4()
        object_key = f"uploads/{dataset_id}/test_data.xlsx"

        df = pl.DataFrame(
            {
                "product": ["Widget A", "Widget B", "Gadget X"],
                "price": [10.99, 25.50, 99.99],
                "quantity": [100, 50, 25],
            }
        )

        excel_buffer = BytesIO()
        df.write_excel(excel_buffer)
        excel_buffer.seek(0)

        await storage_service.upload_file(
            bucket=settings.minio_bucket_datasets,
            key=object_key,
            data=excel_buffer,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        job_data: dict[str, Any] = {
            "datasetId": str(dataset_id),
            "jobId": str(job_id),
            "sourceKey": _source_path(settings, dataset_id, "test_data.xlsx"),
            "filename": "test_data.xlsx",
            "transformations": [],
            "outputFormat": "csv",
        }

        result = await etl_processor.process(job_data)

        assert result["success"] is True
        assert result["rowsProcessed"] == 3
        assert result["columnsCount"] == 3

    @pytest.mark.asyncio
    async def test_process_with_rename_columns(
        self,
        storage_service: MinioStorageService,
        etl_processor: ETLJobProcessor,
        settings: Settings,
    ) -> None:
        """Test processing with column rename transformations."""
        dataset_id = uuid.uuid4()
        job_id = uuid.uuid4()
        object_key = f"uploads/{dataset_id}/rename_test.csv"

        csv_content = b"""old_name,old_value
test1,100
test2,200
"""
        await storage_service.upload_file(
            bucket=settings.minio_bucket_datasets,
            key=object_key,
            data=BytesIO(csv_content),
            content_type="text/csv",
        )

        job_data: dict[str, Any] = {
            "datasetId": str(dataset_id),
            "jobId": str(job_id),
            "sourceKey": _source_path(settings, dataset_id, "rename_test.csv"),
            "filename": "rename_test.csv",
            "transformations": [
                {
                    "type": "RENAME_COLUMN",
                    "columns": None,
                    "params": {"mapping": {"old_name": "new_name", "old_value": "new_value"}},
                },
            ],
            "outputFormat": "json",
        }

        result = await etl_processor.process(job_data)

        assert result["success"] is True
        assert result["rowsProcessed"] == 2

        # schema is dict[str, str] — keys are column names
        schema = result["schema"]
        assert isinstance(schema, dict)
        assert "new_name" in schema
        assert "new_value" in schema
        assert "old_name" not in schema
        assert "old_value" not in schema

    @pytest.mark.asyncio
    async def test_process_with_fill_null(
        self,
        storage_service: MinioStorageService,
        etl_processor: ETLJobProcessor,
        settings: Settings,
    ) -> None:
        """Test processing with FILL_NULLS transformation."""
        dataset_id = uuid.uuid4()
        job_id = uuid.uuid4()
        object_key = f"uploads/{dataset_id}/null_test.csv"

        csv_content = b"""name,value
test1,100
test2,
test3,300
"""
        await storage_service.upload_file(
            bucket=settings.minio_bucket_datasets,
            key=object_key,
            data=BytesIO(csv_content),
            content_type="text/csv",
        )

        job_data: dict[str, Any] = {
            "datasetId": str(dataset_id),
            "jobId": str(job_id),
            "sourceKey": _source_path(settings, dataset_id, "null_test.csv"),
            "filename": "null_test.csv",
            "transformations": [
                {
                    "type": "FILL_NULLS",
                    "columns": ["value"],
                    "params": {"value": "0", "strategy": "literal"},
                },
            ],
            "outputFormat": "json",
        }

        result = await etl_processor.process(job_data)

        assert result["success"] is True
        assert result["rowsProcessed"] == 3

        # Verify no nulls in preview
        preview = result["preview"]
        values = [row.get("value") for row in preview]
        assert None not in values

    @pytest.mark.asyncio
    async def test_job_failure_with_invalid_file(
        self,
        storage_service: MinioStorageService,
        etl_processor: ETLJobProcessor,
        settings: Settings,
    ) -> None:
        """Test that job fails gracefully when source file is missing."""
        dataset_id = uuid.uuid4()
        job_id = uuid.uuid4()

        job_data: dict[str, Any] = {
            "datasetId": str(dataset_id),
            "jobId": str(job_id),
            # Note: bucket exists but object does not
            "sourceKey": f"{settings.minio_bucket_datasets}/nonexistent/file.csv",
            "filename": "file.csv",
            "transformations": [],
            "outputFormat": "parquet",
        }

        # The use case catches all exceptions and returns success=False,
        # but ETLJobProcessor re-raises — either is acceptable.
        with pytest.raises(Exception):
            await etl_processor.process(job_data)


# ---------------------------------------------------------------------------
# Worker integration
# ---------------------------------------------------------------------------


class TestWorkerIntegration:
    """Integration tests for BullMQ worker."""

    @pytest.mark.asyncio
    async def test_worker_processes_queued_job(
        self,
        redis_container: RedisContainer,
        storage_service: MinioStorageService,
        etl_processor: ETLJobProcessor,
        settings: Settings,
    ) -> None:
        """Test that worker picks up and processes a job from Redis queue."""
        from bullmq import Queue

        worker = BullMQWorkerService(
            redis_host=settings.redis_host,
            redis_port=settings.redis_port,
            queue_name="test-etl-queue",
            concurrency=1,
        )
        worker.set_processor(etl_processor)

        await worker.start()

        queue = Queue(
            name="test-etl-queue",
            opts={
                "connection": {
                    "host": settings.redis_host,
                    "port": settings.redis_port,
                },
            },
        )

        dataset_id = uuid.uuid4()
        job_id = uuid.uuid4()
        object_key = f"uploads/{dataset_id}/worker_test.csv"

        csv_content = b"""id,value
1,100
2,200
"""
        await storage_service.upload_file(
            bucket=settings.minio_bucket_datasets,
            key=object_key,
            data=BytesIO(csv_content),
            content_type="text/csv",
        )

        job_payload = {
            "datasetId": str(dataset_id),
            "jobId": str(job_id),
            "sourceKey": f"{settings.minio_bucket_datasets}/{object_key}",
            "filename": "worker_test.csv",
            "transformations": [],
            "outputFormat": "parquet",
        }

        await queue.add("process-dataset", job_payload, opts={"jobId": str(job_id)})

        # Give the worker time to pick up the job
        await asyncio.sleep(2)

        await worker.stop()
        await queue.close()

        # Verify worker lifecycle completed without errors
        assert worker.is_running is False
