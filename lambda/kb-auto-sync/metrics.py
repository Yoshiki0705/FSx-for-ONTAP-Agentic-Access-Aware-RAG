"""
CloudWatch EMF metrics module.

CloudWatch Embedded Metric Format (EMF) を使用してカスタムメトリクスを発行する。
"""

import json
import sys
import time


def emit_metrics(
    *,
    scanned_file_count: int,
    changed_file_count: int,
    ingestion_triggered: int,
    scan_duration_ms: int,
    function_name: str,
) -> dict:
    """
    CloudWatch EMF フォーマットでメトリクスを発行する。

    Args:
        scanned_file_count: スキャンしたファイル数
        changed_file_count: 変更検出されたファイル数
        ingestion_triggered: インジェスションジョブがトリガーされたか (0 or 1)
        scan_duration_ms: スキャン所要時間（ミリ秒）
        function_name: Lambda 関数名

    Returns:
        EMF payload dict (for testing)
    """
    emf_payload = {
        "_aws": {
            "Timestamp": int(time.time() * 1000),
            "CloudWatchMetrics": [
                {
                    "Namespace": "KbAutoSync",
                    "Dimensions": [["FunctionName"]],
                    "Metrics": [
                        {"Name": "ScannedFileCount", "Unit": "Count"},
                        {"Name": "ChangedFileCount", "Unit": "Count"},
                        {"Name": "IngestionJobTriggered", "Unit": "Count"},
                        {"Name": "ScanDurationMs", "Unit": "Milliseconds"},
                    ],
                }
            ],
        },
        "FunctionName": function_name,
        "ScannedFileCount": scanned_file_count,
        "ChangedFileCount": changed_file_count,
        "IngestionJobTriggered": ingestion_triggered,
        "ScanDurationMs": scan_duration_ms,
    }

    # EMF は stdout に JSON として出力する
    print(json.dumps(emf_payload), file=sys.stdout, flush=True)

    return emf_payload
