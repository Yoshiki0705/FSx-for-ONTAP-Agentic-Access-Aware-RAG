"""
Property Test: Ingestion Trigger Decision (Property 2).

has_changes=True かつ IN_PROGRESS でない場合のみ StartIngestionJob が呼ばれることを検証。

Validates: Requirements 2.1, 2.3
"""

from unittest.mock import MagicMock, patch

from hypothesis import given, settings
from hypothesis import strategies as st

from models import DiffResult
from trigger import trigger_ingestion_if_needed

# Strategy: generate a DiffResult
diff_result_st = st.builds(
    DiffResult,
    added=st.lists(st.text(min_size=1, max_size=20), max_size=10),
    updated=st.lists(st.text(min_size=1, max_size=20), max_size=10),
    deleted=st.lists(st.text(min_size=1, max_size=20), max_size=10),
)

# Strategy: job status
job_status_st = st.sampled_from(
    ["IN_PROGRESS", "COMPLETE", "FAILED", "STARTING", "STOPPED"]
)


@given(diff=diff_result_st, status=job_status_st)
@settings(max_examples=200)
def test_trigger_decision_correctness(diff, status):
    """
    StartIngestionJob is called iff:
    1. diff.has_changes == True, AND
    2. No job is IN_PROGRESS
    """
    mock_client = MagicMock()

    # Mock list_ingestion_jobs response
    mock_client.list_ingestion_jobs.return_value = {
        "ingestionJobSummaries": [
            {"ingestionJobId": "existing-job-123", "status": status}
        ]
    }

    # Mock start_ingestion_job response
    mock_client.start_ingestion_job.return_value = {
        "ingestionJob": {"ingestionJobId": "new-job-456"}
    }

    result = trigger_ingestion_if_needed(
        "kb-id", "ds-id", diff, bedrock_client=mock_client
    )

    if not diff.has_changes:
        # No changes → no API calls at all
        mock_client.list_ingestion_jobs.assert_not_called()
        mock_client.start_ingestion_job.assert_not_called()
        assert result is None
    elif status == "IN_PROGRESS":
        # Changes detected but job in progress → skip
        mock_client.list_ingestion_jobs.assert_called_once()
        mock_client.start_ingestion_job.assert_not_called()
        assert result is None
    else:
        # Changes detected and no in-progress job → trigger
        mock_client.list_ingestion_jobs.assert_called_once()
        mock_client.start_ingestion_job.assert_called_once()
        assert result == "new-job-456"


@given(diff=diff_result_st)
@settings(max_examples=100)
def test_trigger_with_empty_job_list(diff):
    """When no previous jobs exist, trigger if has_changes."""
    mock_client = MagicMock()
    mock_client.list_ingestion_jobs.return_value = {"ingestionJobSummaries": []}
    mock_client.start_ingestion_job.return_value = {
        "ingestionJob": {"ingestionJobId": "first-job-789"}
    }

    result = trigger_ingestion_if_needed(
        "kb-id", "ds-id", diff, bedrock_client=mock_client
    )

    if diff.has_changes:
        mock_client.start_ingestion_job.assert_called_once()
        assert result == "first-job-789"
    else:
        mock_client.start_ingestion_job.assert_not_called()
        assert result is None
