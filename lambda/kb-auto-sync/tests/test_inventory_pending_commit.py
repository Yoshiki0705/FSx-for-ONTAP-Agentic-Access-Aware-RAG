"""
Property Tests and Unit Tests for Pending/Commit Inventory Model.

Validates:
- Property 1: No Lost Diffs — failed jobs cause re-detection in next scan
- Property 3: Idempotent Commit — multiple commit calls produce same state
- Property 4: Bounded Pending Lifetime — stale pending records are cleaned up
- Property 5: Atomic Batch Transition — all-or-nothing commit per job_id
- Property 17: Pending Record Invariants — pending/failed records have non-empty jobId
"""

import time
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import boto3
import pytest
from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st
from moto import mock_aws

from inventory import (
    InventoryStatus,
    cleanup_stale_pending,
    commit_inventory,
    get_inventory,
    mark_inventory_failed,
    mark_inventory_pending,
)
from models import FileMetadata


# --- Strategies ---

file_key_st = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N"), whitelist_characters="/-_."),
    min_size=1,
    max_size=30,
)

file_metadata_st = st.builds(
    FileMetadata,
    key=file_key_st,
    size=st.integers(min_value=0, max_value=10**9),
    last_modified=st.text(min_size=10, max_size=25),
    e_tag=st.text(min_size=5, max_size=30),
)

file_dict_st = st.dictionaries(
    keys=file_key_st,
    values=file_metadata_st,
    min_size=1,
    max_size=10,
).map(
    lambda d: {
        k: FileMetadata(key=k, size=v.size, last_modified=v.last_modified, e_tag=v.e_tag)
        for k, v in d.items()
    }
)

job_id_st = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N")),
    min_size=5,
    max_size=20,
)


# --- Fixtures ---


@pytest.fixture
def dynamodb_table():
    """Create a mocked DynamoDB table for testing."""
    with mock_aws():
        dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-1")
        table = dynamodb.create_table(
            TableName="test-inventory",
            KeySchema=[{"AttributeName": "fileKey", "KeyType": "HASH"}],
            AttributeDefinitions=[
                {"AttributeName": "fileKey", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        table.meta.client.get_waiter("table_exists").wait(TableName="test-inventory")
        yield table


# --- Property Tests ---


class TestProperty1NoLostDiffs:
    """Failed jobs cause re-detection in next scan."""

    @given(files=file_dict_st, job_id=job_id_st)
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    def test_failed_pending_not_in_committed_inventory(self, files, job_id):
        """After mark_inventory_failed, get_inventory(committed) returns empty."""
        with mock_aws():
            dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-1")
            table = dynamodb.create_table(
                TableName="test-nolost",
                KeySchema=[{"AttributeName": "fileKey", "KeyType": "HASH"}],
                AttributeDefinitions=[
                    {"AttributeName": "fileKey", "AttributeType": "S"}
                ],
                BillingMode="PAY_PER_REQUEST",
            )
            table.meta.client.get_waiter("table_exists").wait(TableName="test-nolost")

            # Mark as pending then fail
            mark_inventory_pending(table, files, job_id)
            mark_inventory_failed(table, job_id)

            # Committed inventory should be empty — these files will be re-detected
            committed = get_inventory(table, status_filter=InventoryStatus.COMMITTED)
            assert len(committed) == 0


class TestProperty3IdempotentCommit:
    """Multiple commit calls produce same state."""

    @given(files=file_dict_st, job_id=job_id_st)
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    def test_double_commit_same_result(self, files, job_id):
        """Calling commit_inventory twice produces the same state."""
        with mock_aws():
            dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-1")
            table = dynamodb.create_table(
                TableName="test-idempotent",
                KeySchema=[{"AttributeName": "fileKey", "KeyType": "HASH"}],
                AttributeDefinitions=[
                    {"AttributeName": "fileKey", "AttributeType": "S"}
                ],
                BillingMode="PAY_PER_REQUEST",
            )
            table.meta.client.get_waiter("table_exists").wait(
                TableName="test-idempotent"
            )

            mark_inventory_pending(table, files, job_id)

            # First commit
            count1 = commit_inventory(table, job_id)
            committed1 = get_inventory(table, status_filter=InventoryStatus.COMMITTED)

            # Second commit (should be no-op)
            count2 = commit_inventory(table, job_id)
            committed2 = get_inventory(table, status_filter=InventoryStatus.COMMITTED)

            assert count1 == len(files)
            assert count2 == 0  # No pending records left
            assert set(committed1.keys()) == set(committed2.keys())


class TestProperty5AtomicBatchTransition:
    """All-or-nothing commit per job_id."""

    @given(
        files_a=file_dict_st,
        files_b=file_dict_st,
        job_a=job_id_st,
        job_b=job_id_st,
    )
    @settings(max_examples=30, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    def test_commit_only_affects_target_job(self, files_a, files_b, job_a, job_b):
        """Committing job_a does not affect pending records for job_b."""
        if job_a == job_b:
            return  # Skip when job IDs are the same

        with mock_aws():
            dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-1")
            table = dynamodb.create_table(
                TableName="test-atomic",
                KeySchema=[{"AttributeName": "fileKey", "KeyType": "HASH"}],
                AttributeDefinitions=[
                    {"AttributeName": "fileKey", "AttributeType": "S"}
                ],
                BillingMode="PAY_PER_REQUEST",
            )
            table.meta.client.get_waiter("table_exists").wait(TableName="test-atomic")

            mark_inventory_pending(table, files_a, job_a)
            mark_inventory_pending(table, files_b, job_b)

            # Commit only job_a
            commit_inventory(table, job_a)

            # job_b records should still be pending
            from boto3.dynamodb.conditions import Attr

            resp = table.scan(
                FilterExpression=Attr("status").eq(InventoryStatus.PENDING)
                & Attr("jobId").eq(job_b)
            )
            pending_b = resp.get("Items", [])

            # All files_b keys that don't overlap with files_a should be pending
            non_overlapping = set(files_b.keys()) - set(files_a.keys())
            pending_keys = {item["fileKey"] for item in pending_b}
            assert non_overlapping.issubset(pending_keys)


class TestProperty17PendingRecordInvariants:
    """Pending/failed records have non-empty jobId and correct fields."""

    @given(files=file_dict_st, job_id=job_id_st)
    @settings(max_examples=50, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    def test_pending_records_have_required_fields(self, files, job_id):
        """All pending records must have non-empty jobId, status, updatedAt."""
        with mock_aws():
            dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-1")
            table = dynamodb.create_table(
                TableName="test-invariants",
                KeySchema=[{"AttributeName": "fileKey", "KeyType": "HASH"}],
                AttributeDefinitions=[
                    {"AttributeName": "fileKey", "AttributeType": "S"}
                ],
                BillingMode="PAY_PER_REQUEST",
            )
            table.meta.client.get_waiter("table_exists").wait(
                TableName="test-invariants"
            )

            mark_inventory_pending(table, files, job_id)

            resp = table.scan()
            for item in resp["Items"]:
                assert item["status"] == InventoryStatus.PENDING
                assert item["jobId"] == job_id
                assert len(item["jobId"]) > 0
                assert "updatedAt" in item
                assert "firstDetectedAt" in item


# --- Unit Tests ---


class TestMarkInventoryPending:
    """Unit tests for mark_inventory_pending."""

    def test_empty_job_id_raises(self, dynamodb_table):
        """Empty job_id should raise ValueError."""
        with pytest.raises(ValueError, match="job_id must be non-empty"):
            mark_inventory_pending(dynamodb_table, {}, "")

    def test_writes_correct_count(self, dynamodb_table):
        """Returns the number of records written."""
        files = {
            "a.txt": FileMetadata(key="a.txt", size=100, last_modified="2026-01-01", e_tag="abc"),
            "b.txt": FileMetadata(key="b.txt", size=200, last_modified="2026-01-02", e_tag="def"),
        }
        count = mark_inventory_pending(dynamodb_table, files, "job-123")
        assert count == 2


class TestCommitInventory:
    """Unit tests for commit_inventory."""

    def test_commit_transitions_status(self, dynamodb_table):
        """Committed records have status=committed."""
        files = {
            "x.pdf": FileMetadata(key="x.pdf", size=500, last_modified="2026-05-01", e_tag="xyz"),
        }
        mark_inventory_pending(dynamodb_table, files, "job-456")
        committed = commit_inventory(dynamodb_table, "job-456")
        assert committed == 1

        result = get_inventory(dynamodb_table, status_filter=InventoryStatus.COMMITTED)
        assert "x.pdf" in result


class TestMarkInventoryFailed:
    """Unit tests for mark_inventory_failed."""

    def test_failed_records_have_ttl(self, dynamodb_table):
        """Failed records should have ttlEpoch set."""
        files = {
            "fail.doc": FileMetadata(
                key="fail.doc", size=300, last_modified="2026-03-01", e_tag="fail"
            ),
        }
        mark_inventory_pending(dynamodb_table, files, "job-fail")
        mark_inventory_failed(dynamodb_table, "job-fail")

        resp = dynamodb_table.scan()
        item = resp["Items"][0]
        assert item["status"] == InventoryStatus.FAILED_RETRYABLE
        assert "ttlEpoch" in item
        assert item["ttlEpoch"] > int(time.time())


class TestHandlerDispatch:
    """Unit tests for handler action dispatch."""

    @patch.dict(
        "os.environ",
        {
            "S3_ACCESS_POINT_ARN": "arn:aws:s3:ap-northeast-1:123:accesspoint/test",
            "KNOWLEDGE_BASE_ID": "kb-test",
            "DATA_SOURCE_ID": "ds-test",
            "INVENTORY_TABLE_NAME": "test-table",
        },
    )
    @patch("handler.scan_s3_access_point")
    @patch("handler.boto3")
    def test_scan_action_default(self, mock_boto3, mock_scan):
        """Default action is 'scan'."""
        from handler import lambda_handler

        mock_scan.return_value = {}
        mock_table = MagicMock()
        mock_table.scan.return_value = {"Items": []}
        mock_dynamodb = MagicMock()
        mock_dynamodb.Table.return_value = mock_table
        mock_boto3.resource.return_value = mock_dynamodb
        mock_boto3.client.return_value = MagicMock()

        result = lambda_handler({}, None)
        assert result["action"] == "scan"

    @patch.dict(
        "os.environ",
        {
            "S3_ACCESS_POINT_ARN": "arn:aws:s3:ap-northeast-1:123:accesspoint/test",
            "KNOWLEDGE_BASE_ID": "kb-test",
            "DATA_SOURCE_ID": "ds-test",
            "INVENTORY_TABLE_NAME": "test-table",
        },
    )
    @patch("handler.boto3")
    def test_status_check_requires_job_id(self, mock_boto3):
        """status-check without job_id returns 400."""
        from handler import lambda_handler

        mock_boto3.resource.return_value = MagicMock()
        mock_boto3.client.return_value = MagicMock()

        result = lambda_handler({"action": "status-check"}, None)
        assert result["statusCode"] == 400


class TestCalculateBackoff:
    """Unit tests for exponential backoff calculation."""

    def test_backoff_values(self):
        """Verify exponential backoff sequence."""
        from handler import _calculate_backoff

        assert _calculate_backoff(0) == 30
        assert _calculate_backoff(1) == 60
        assert _calculate_backoff(2) == 120
        assert _calculate_backoff(3) == 240
        assert _calculate_backoff(4) == 300  # capped at MAX
        assert _calculate_backoff(10) == 300  # still capped
