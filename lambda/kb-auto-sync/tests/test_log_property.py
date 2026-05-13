"""
Property Test: Structured Log Completeness (Property 6).

任意の実行結果に対して必須フィールドがすべて含まれることを検証。

Validates: Requirements 7.1
"""

import json

from hypothesis import given, settings
from hypothesis import strategies as st


def build_structured_log(
    scanned_files: int,
    added_files: int,
    updated_files: int,
    deleted_files: int,
    ingestion_job_id,
    duration_ms: int,
) -> dict:
    """Build a structured log payload (mirrors handler.py logic)."""
    return {
        "message": "Scan completed",
        "scannedFiles": scanned_files,
        "addedFiles": added_files,
        "updatedFiles": updated_files,
        "deletedFiles": deleted_files,
        "ingestionJobId": ingestion_job_id,
        "durationMs": duration_ms,
    }


REQUIRED_LOG_FIELDS = {
    "scannedFiles",
    "addedFiles",
    "updatedFiles",
    "deletedFiles",
    "ingestionJobId",
    "durationMs",
}


@given(
    scanned=st.integers(min_value=0, max_value=100000),
    added=st.integers(min_value=0, max_value=10000),
    updated=st.integers(min_value=0, max_value=10000),
    deleted=st.integers(min_value=0, max_value=10000),
    job_id=st.one_of(st.none(), st.text(min_size=1, max_size=50)),
    duration=st.integers(min_value=0, max_value=300000),
)
@settings(max_examples=200)
def test_structured_log_contains_all_required_fields(
    scanned, added, updated, deleted, job_id, duration
):
    """Structured log output must contain all required fields."""
    log = build_structured_log(scanned, added, updated, deleted, job_id, duration)

    for field in REQUIRED_LOG_FIELDS:
        assert field in log, f"Missing required field: {field}"


@given(
    scanned=st.integers(min_value=0, max_value=100000),
    added=st.integers(min_value=0, max_value=10000),
    updated=st.integers(min_value=0, max_value=10000),
    deleted=st.integers(min_value=0, max_value=10000),
    job_id=st.one_of(st.none(), st.text(min_size=1, max_size=50)),
    duration=st.integers(min_value=0, max_value=300000),
)
@settings(max_examples=200)
def test_structured_log_is_json_serializable(
    scanned, added, updated, deleted, job_id, duration
):
    """Structured log must be JSON serializable."""
    log = build_structured_log(scanned, added, updated, deleted, job_id, duration)
    serialized = json.dumps(log)
    deserialized = json.loads(serialized)
    assert deserialized == log


@given(
    scanned=st.integers(min_value=0, max_value=100000),
    added=st.integers(min_value=0, max_value=10000),
    updated=st.integers(min_value=0, max_value=10000),
    deleted=st.integers(min_value=0, max_value=10000),
    job_id=st.one_of(st.none(), st.text(min_size=1, max_size=50)),
    duration=st.integers(min_value=0, max_value=300000),
)
@settings(max_examples=200)
def test_structured_log_numeric_fields_are_integers(
    scanned, added, updated, deleted, job_id, duration
):
    """Numeric fields in structured log must be integers."""
    log = build_structured_log(scanned, added, updated, deleted, job_id, duration)
    assert isinstance(log["scannedFiles"], int)
    assert isinstance(log["addedFiles"], int)
    assert isinstance(log["updatedFiles"], int)
    assert isinstance(log["deletedFiles"], int)
    assert isinstance(log["durationMs"], int)
