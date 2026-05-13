"""
Property Test: EMF Metrics Completeness (Property 7).

任意の実行結果に対して必須メトリクスがすべて含まれることを検証。

Validates: Requirements 7.2
"""

from hypothesis import given, settings
from hypothesis import strategies as st

from metrics import emit_metrics

REQUIRED_METRICS = {"ScannedFileCount", "ChangedFileCount", "IngestionJobTriggered", "ScanDurationMs"}
REQUIRED_EMF_STRUCTURE = {"_aws", "FunctionName"}


@given(
    scanned=st.integers(min_value=0, max_value=100000),
    changed=st.integers(min_value=0, max_value=10000),
    triggered=st.sampled_from([0, 1]),
    duration=st.integers(min_value=0, max_value=300000),
    fn_name=st.text(min_size=1, max_size=50),
)
@settings(max_examples=200)
def test_emf_contains_all_required_metrics(scanned, changed, triggered, duration, fn_name):
    """EMF output must contain all required metrics."""
    payload = emit_metrics(
        scanned_file_count=scanned,
        changed_file_count=changed,
        ingestion_triggered=triggered,
        scan_duration_ms=duration,
        function_name=fn_name,
    )

    for metric in REQUIRED_METRICS:
        assert metric in payload, f"Missing required metric: {metric}"


@given(
    scanned=st.integers(min_value=0, max_value=100000),
    changed=st.integers(min_value=0, max_value=10000),
    triggered=st.sampled_from([0, 1]),
    duration=st.integers(min_value=0, max_value=300000),
    fn_name=st.text(min_size=1, max_size=50),
)
@settings(max_examples=200)
def test_emf_has_correct_structure(scanned, changed, triggered, duration, fn_name):
    """EMF output must have correct _aws structure."""
    payload = emit_metrics(
        scanned_file_count=scanned,
        changed_file_count=changed,
        ingestion_triggered=triggered,
        scan_duration_ms=duration,
        function_name=fn_name,
    )

    for field in REQUIRED_EMF_STRUCTURE:
        assert field in payload, f"Missing required EMF field: {field}"

    # Validate _aws structure
    aws_section = payload["_aws"]
    assert "Timestamp" in aws_section
    assert "CloudWatchMetrics" in aws_section
    assert isinstance(aws_section["CloudWatchMetrics"], list)
    assert len(aws_section["CloudWatchMetrics"]) == 1

    cw_metrics = aws_section["CloudWatchMetrics"][0]
    assert cw_metrics["Namespace"] == "KbAutoSync"
    assert "Dimensions" in cw_metrics
    assert "Metrics" in cw_metrics

    metric_names = {m["Name"] for m in cw_metrics["Metrics"]}
    assert REQUIRED_METRICS == metric_names


@given(
    scanned=st.integers(min_value=0, max_value=100000),
    changed=st.integers(min_value=0, max_value=10000),
    triggered=st.sampled_from([0, 1]),
    duration=st.integers(min_value=0, max_value=300000),
    fn_name=st.text(min_size=1, max_size=50),
)
@settings(max_examples=200)
def test_emf_function_name_matches_input(scanned, changed, triggered, duration, fn_name):
    """EMF FunctionName must match the input function_name."""
    payload = emit_metrics(
        scanned_file_count=scanned,
        changed_file_count=changed,
        ingestion_triggered=triggered,
        scan_duration_ms=duration,
        function_name=fn_name,
    )

    assert payload["FunctionName"] == fn_name


@given(
    scanned=st.integers(min_value=0, max_value=100000),
    changed=st.integers(min_value=0, max_value=10000),
    triggered=st.sampled_from([0, 1]),
    duration=st.integers(min_value=0, max_value=300000),
    fn_name=st.text(min_size=1, max_size=50),
)
@settings(max_examples=200)
def test_emf_ingestion_triggered_is_0_or_1(scanned, changed, triggered, duration, fn_name):
    """IngestionJobTriggered must be 0 or 1."""
    payload = emit_metrics(
        scanned_file_count=scanned,
        changed_file_count=changed,
        ingestion_triggered=triggered,
        scan_duration_ms=duration,
        function_name=fn_name,
    )

    assert payload["IngestionJobTriggered"] in (0, 1)
