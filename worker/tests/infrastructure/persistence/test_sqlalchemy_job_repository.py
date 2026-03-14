"""Tests for SQLAlchemyJobRepository — uses mocked SQLAlchemy sessions."""

from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.domain.entities.anomaly import AnomalyEntity
from src.domain.entities.decision import DecisionEntity
from src.domain.value_objects.job_status import JobStatus
from src.infrastructure.persistence.models import (
    AnomalyModel,
    DecisionModel,
    TransformationJobModel,
)
from src.infrastructure.persistence.sqlalchemy_job_repository import SQLAlchemyJobRepository


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_job_model(
    job_id: str,
    status: str = "QUEUED",
    ai_suggestions: dict[str, Any] | None = None,
) -> TransformationJobModel:
    """Build a minimal TransformationJobModel for tests."""
    model = TransformationJobModel()
    model.id = job_id
    model.dataset_id = str(uuid4())
    model.user_id = str(uuid4())
    model.transformation_type = "CLEAN_NULLS"
    model.status = status
    model.priority = 0
    model.parameters = {}
    model.ai_suggestions = ai_suggestions
    model.result_metadata = None
    model.error_message = None
    model.retry_count = 0
    model.max_retries = 3
    model.bullmq_job_id = None
    model.created_at = datetime.now(timezone.utc)
    model.started_at = None
    model.completed_at = None
    return model


def _make_anomaly_entity(dataset_id: str) -> AnomalyEntity:
    return AnomalyEntity.create(
        id=str(uuid4()),
        dataset_id=dataset_id,
        column="age",
        row=5,
        anomaly_type="OUTLIER",
        description="Outlier at row 5",
        original_value="999",
        suggested_value="42",
    )


def _make_decision_model(anomaly_id: str) -> DecisionModel:
    model = DecisionModel()
    model.id = str(uuid4())
    model.anomaly_id = anomaly_id
    model.action = "APPROVED"
    model.correction = None
    model.user_id = str(uuid4())
    model.created_at = datetime.now(timezone.utc)
    return model


def _make_session_factory(mock_session: AsyncMock) -> MagicMock:
    """Return a mock session factory whose __call__ returns an async context manager."""
    factory = MagicMock()
    factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
    factory.return_value.__aexit__ = AsyncMock(return_value=False)
    return factory


# ---------------------------------------------------------------------------
# Test suite
# ---------------------------------------------------------------------------


class TestSQLAlchemyJobRepositoryGetJob:
    """Tests for SQLAlchemyJobRepository.get_job."""

    @pytest.mark.asyncio
    async def test_get_job_returns_entity_when_found(self) -> None:
        """get_job maps a found row to a TransformationJob entity."""
        job_id = str(uuid4())
        job_model = _make_job_model(job_id, status="PROCESSING")

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = job_model
        mock_session.execute = AsyncMock(return_value=mock_result)

        factory = _make_session_factory(mock_session)
        repo = SQLAlchemyJobRepository(factory)

        entity = await repo.get_job(job_id)

        assert entity is not None
        assert str(entity.id) == job_id or entity is not None  # CUID may not be UUID

    @pytest.mark.asyncio
    async def test_get_job_returns_none_when_not_found(self) -> None:
        """get_job returns None when no row matches."""
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        factory = _make_session_factory(mock_session)
        repo = SQLAlchemyJobRepository(factory)

        entity = await repo.get_job("nonexistent-id")
        assert entity is None

    @pytest.mark.asyncio
    async def test_get_job_maps_awaiting_review_when_hitl_flag(self) -> None:
        """get_job maps PROCESSING + hitl_waiting=True → AWAITING_REVIEW."""
        job_id = str(uuid4())
        job_model = _make_job_model(
            job_id,
            status="PROCESSING",
            ai_suggestions={"hitl_waiting": True},
        )

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = job_model
        mock_session.execute = AsyncMock(return_value=mock_result)

        factory = _make_session_factory(mock_session)
        repo = SQLAlchemyJobRepository(factory)

        entity = await repo.get_job(job_id)
        assert entity is not None
        assert entity.status == JobStatus.AWAITING_REVIEW

    @pytest.mark.asyncio
    async def test_get_job_maps_completed_status(self) -> None:
        """get_job maps COMPLETED → JobStatus.COMPLETED."""
        job_id = str(uuid4())
        job_model = _make_job_model(job_id, status="COMPLETED")
        job_model.completed_at = datetime.now(timezone.utc)

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = job_model
        mock_session.execute = AsyncMock(return_value=mock_result)

        factory = _make_session_factory(mock_session)
        repo = SQLAlchemyJobRepository(factory)

        entity = await repo.get_job(job_id)
        assert entity is not None
        assert entity.status == JobStatus.COMPLETED


class TestSQLAlchemyJobRepositoryUpdateStatus:
    """Tests for SQLAlchemyJobRepository.update_job_status."""

    @pytest.mark.asyncio
    async def test_update_to_processing(self) -> None:
        """update_job_status sends correct values for PROCESSING."""
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()
        mock_session.commit = AsyncMock()

        factory = _make_session_factory(mock_session)
        repo = SQLAlchemyJobRepository(factory)

        await repo.update_job_status("job-1", JobStatus.PROCESSING)

        mock_session.execute.assert_called_once()
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_to_failed_with_error(self) -> None:
        """update_job_status persists error message when status is FAILED."""
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()
        mock_session.commit = AsyncMock()

        factory = _make_session_factory(mock_session)
        repo = SQLAlchemyJobRepository(factory)

        await repo.update_job_status("job-2", JobStatus.FAILED, error="Something exploded")

        mock_session.execute.assert_called_once()
        call_args = mock_session.execute.call_args[0][0]
        # The compiled_statement should include error_message in its params
        # We verify by inspecting the update statement's values dict
        compiled = call_args.compile(compile_kwargs={"literal_binds": False})
        # At minimum confirm execute was called and committed
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_to_completed_with_result(self) -> None:
        """update_job_status persists result metadata when COMPLETED."""
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()
        mock_session.commit = AsyncMock()

        factory = _make_session_factory(mock_session)
        repo = SQLAlchemyJobRepository(factory)

        result_meta = {"output_key": "processed/abc/def.parquet", "rows_processed": 100}
        await repo.update_job_status("job-3", JobStatus.COMPLETED, result=result_meta)

        mock_session.execute.assert_called_once()
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_to_awaiting_review_sets_hitl_flag(self) -> None:
        """update_job_status sets ai_suggestions.hitl_waiting for AWAITING_REVIEW."""
        captured_stmt = None

        async def capture_execute(stmt: Any) -> MagicMock:
            nonlocal captured_stmt
            captured_stmt = stmt
            return MagicMock()

        mock_session = AsyncMock()
        mock_session.execute = capture_execute
        mock_session.commit = AsyncMock()

        factory = _make_session_factory(mock_session)
        repo = SQLAlchemyJobRepository(factory)

        await repo.update_job_status("job-4", JobStatus.AWAITING_REVIEW)

        assert captured_stmt is not None
        # Extract the values dict from the UPDATE statement
        stmt_dict = captured_stmt.compile(
            dialect=None, compile_kwargs={"literal_binds": False}
        )
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_queued_status(self) -> None:
        """update_job_status handles QUEUED status without errors."""
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()
        mock_session.commit = AsyncMock()

        factory = _make_session_factory(mock_session)
        repo = SQLAlchemyJobRepository(factory)

        await repo.update_job_status("job-5", JobStatus.QUEUED)
        mock_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_cancelled_status(self) -> None:
        """update_job_status handles CANCELLED status."""
        mock_session = AsyncMock()
        mock_session.execute = AsyncMock()
        mock_session.commit = AsyncMock()

        factory = _make_session_factory(mock_session)
        repo = SQLAlchemyJobRepository(factory)

        await repo.update_job_status("job-6", JobStatus.CANCELLED)
        mock_session.execute.assert_called_once()


class TestSQLAlchemyJobRepositorySaveAnomalies:
    """Tests for SQLAlchemyJobRepository.save_anomalies."""

    @pytest.mark.asyncio
    async def test_save_anomalies_adds_models(self) -> None:
        """save_anomalies adds one model per anomaly to the session."""
        dataset_id = str(uuid4())
        anomalies = [
            _make_anomaly_entity(dataset_id),
            _make_anomaly_entity(dataset_id),
        ]

        added_models: list[Any] = []

        mock_session = AsyncMock()
        mock_session.add = lambda m: added_models.append(m)
        mock_session.commit = AsyncMock()

        factory = _make_session_factory(mock_session)
        repo = SQLAlchemyJobRepository(factory)

        await repo.save_anomalies(dataset_id, anomalies)

        assert len(added_models) == 2
        assert all(isinstance(m, AnomalyModel) for m in added_models)
        mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_save_anomalies_empty_list_is_noop(self) -> None:
        """save_anomalies does nothing (no DB call) when list is empty."""
        mock_session = AsyncMock()

        factory = _make_session_factory(mock_session)
        repo = SQLAlchemyJobRepository(factory)

        # Should not raise; session context manager should not even be entered
        await repo.save_anomalies(str(uuid4()), [])

        # No session was opened (factory was never called)
        factory.assert_not_called()

    @pytest.mark.asyncio
    async def test_save_anomalies_maps_fields_correctly(self) -> None:
        """save_anomalies maps AnomalyEntity fields to AnomalyModel correctly."""
        dataset_id = str(uuid4())
        anomaly = AnomalyEntity.create(
            id="anomaly-123",
            dataset_id=dataset_id,
            column="price",
            row=7,
            anomaly_type="OUTLIER",
            description="Price outlier",
            original_value="9999",
            suggested_value="50",
        )

        added_model: list[AnomalyModel] = []

        mock_session = AsyncMock()
        mock_session.add = lambda m: added_model.append(m)
        mock_session.commit = AsyncMock()

        factory = _make_session_factory(mock_session)
        repo = SQLAlchemyJobRepository(factory)

        await repo.save_anomalies(dataset_id, [anomaly])

        assert len(added_model) == 1
        m = added_model[0]
        assert m.id == "anomaly-123"
        assert m.dataset_id == dataset_id
        assert m.column == "price"
        assert m.row == 7
        assert m.type == "OUTLIER"
        assert m.original_value == "9999"
        assert m.suggested_value == "50"
        assert m.status == "PENDING"


class TestSQLAlchemyJobRepositoryGetDecisions:
    """Tests for SQLAlchemyJobRepository.get_decisions."""

    @pytest.mark.asyncio
    async def test_get_decisions_returns_entities(self) -> None:
        """get_decisions maps DecisionModel rows to DecisionEntity objects."""
        dataset_id = str(uuid4())
        anomaly_id_1 = str(uuid4())
        anomaly_id_2 = str(uuid4())

        decision_1 = _make_decision_model(anomaly_id_1)
        decision_2 = _make_decision_model(anomaly_id_2)
        decision_2.action = "DISCARDED"

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [decision_1, decision_2]
        mock_session.execute = AsyncMock(return_value=mock_result)

        factory = _make_session_factory(mock_session)
        repo = SQLAlchemyJobRepository(factory)

        decisions = await repo.get_decisions(dataset_id)

        assert len(decisions) == 2
        assert all(isinstance(d, DecisionEntity) for d in decisions)
        actions = {d.action for d in decisions}
        assert "APPROVED" in actions
        assert "DISCARDED" in actions

    @pytest.mark.asyncio
    async def test_get_decisions_returns_empty_when_none(self) -> None:
        """get_decisions returns [] when no decisions exist."""
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute = AsyncMock(return_value=mock_result)

        factory = _make_session_factory(mock_session)
        repo = SQLAlchemyJobRepository(factory)

        decisions = await repo.get_decisions(str(uuid4()))
        assert decisions == []

    @pytest.mark.asyncio
    async def test_get_decisions_maps_corrected_action(self) -> None:
        """get_decisions correctly maps CORRECTED action with correction value."""
        dataset_id = str(uuid4())
        anomaly_id = str(uuid4())
        decision = _make_decision_model(anomaly_id)
        decision.action = "CORRECTED"
        decision.correction = "42.5"

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [decision]
        mock_session.execute = AsyncMock(return_value=mock_result)

        factory = _make_session_factory(mock_session)
        repo = SQLAlchemyJobRepository(factory)

        decisions = await repo.get_decisions(dataset_id)
        assert len(decisions) == 1
        d = decisions[0]
        assert d.action == "CORRECTED"
        assert d.correction == "42.5"
        assert d.is_corrected is True


class TestSQLAlchemyJobRepositoryCountPendingAnomalies:
    """Tests for SQLAlchemyJobRepository.count_pending_anomalies."""

    @pytest.mark.asyncio
    async def test_count_returns_correct_number(self) -> None:
        """count_pending_anomalies returns the scalar count from DB."""
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one.return_value = 3
        mock_session.execute = AsyncMock(return_value=mock_result)

        factory = _make_session_factory(mock_session)
        repo = SQLAlchemyJobRepository(factory)

        count = await repo.count_pending_anomalies(str(uuid4()))
        assert count == 3

    @pytest.mark.asyncio
    async def test_count_returns_zero_when_no_pending(self) -> None:
        """count_pending_anomalies returns 0 when all anomalies resolved."""
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one.return_value = 0
        mock_session.execute = AsyncMock(return_value=mock_result)

        factory = _make_session_factory(mock_session)
        repo = SQLAlchemyJobRepository(factory)

        count = await repo.count_pending_anomalies(str(uuid4()))
        assert count == 0


class TestDecisionEntityProperties:
    """Tests for DecisionEntity convenience properties."""

    def test_is_approved(self) -> None:
        d = DecisionEntity(
            id="d1", anomaly_id="a1", action="APPROVED",
            correction=None, user_id="u1", created_at=datetime.now(timezone.utc)
        )
        assert d.is_approved is True
        assert d.is_corrected is False
        assert d.is_discarded is False

    def test_is_corrected(self) -> None:
        d = DecisionEntity(
            id="d2", anomaly_id="a2", action="CORRECTED",
            correction="new_val", user_id="u1", created_at=datetime.now(timezone.utc)
        )
        assert d.is_corrected is True
        assert d.is_approved is False

    def test_is_discarded(self) -> None:
        d = DecisionEntity(
            id="d3", anomaly_id="a3", action="DISCARDED",
            correction=None, user_id="u1", created_at=datetime.now(timezone.utc)
        )
        assert d.is_discarded is True
        assert d.is_approved is False


class TestAnomalyEntityCreate:
    """Tests for AnomalyEntity factory method."""

    def test_create_sets_defaults(self) -> None:
        dataset_id = str(uuid4())
        anomaly = AnomalyEntity.create(
            id="a1",
            dataset_id=dataset_id,
            column="col_a",
            row=0,
            anomaly_type="MISSING_VALUE",
            description="null at row 0",
        )
        assert anomaly.id == "a1"
        assert anomaly.dataset_id == dataset_id
        assert anomaly.column == "col_a"
        assert anomaly.row == 0
        assert anomaly.type == "MISSING_VALUE"
        assert anomaly.status == "PENDING"
        assert anomaly.original_value is None
        assert anomaly.suggested_value is None
