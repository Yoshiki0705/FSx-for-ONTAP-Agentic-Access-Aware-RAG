"""
Ingestion trigger module.

変更検出時に Bedrock KB StartIngestionJob をトリガーする。
IN_PROGRESS ジョブがある場合はスキップ。
"""

import logging
from typing import Any, Optional

from models import DiffResult

logger = logging.getLogger(__name__)


def trigger_ingestion_if_needed(
    kb_id: str,
    ds_id: str,
    diff: DiffResult,
    *,
    bedrock_client: Any = None,
) -> Optional[str]:
    """
    変更検出時にインジェスションジョブをトリガーする。
    既に IN_PROGRESS のジョブがある場合はスキップ。

    Args:
        kb_id: Bedrock Knowledge Base ID
        ds_id: Bedrock KB Data Source ID
        diff: 差分計算結果
        bedrock_client: boto3 bedrock-agent client (injectable for testing)

    Returns:
        ingestionJobId or None (スキップ時)
    """
    if bedrock_client is None:
        import boto3
        from botocore.config import Config

        bedrock_client = boto3.client(
            "bedrock-agent",
            config=Config(retries={"max_attempts": 3, "mode": "adaptive"}),
        )

    if not diff.has_changes:
        return None

    # 現在のジョブステータス確認
    response = bedrock_client.list_ingestion_jobs(
        knowledgeBaseId=kb_id,
        dataSourceId=ds_id,
        maxResults=1,
        sortBy={"attribute": "STARTED_AT", "order": "DESCENDING"},
    )

    jobs = response.get("ingestionJobSummaries", [])
    if jobs and jobs[0].get("status") == "IN_PROGRESS":
        logger.info(
            "Ingestion job already in progress, skipping",
            extra={"existingJobId": jobs[0]["ingestionJobId"]},
        )
        return None

    # 新しいジョブを開始
    result = bedrock_client.start_ingestion_job(
        knowledgeBaseId=kb_id,
        dataSourceId=ds_id,
    )

    job_id = result["ingestionJob"]["ingestionJobId"]
    logger.info(
        "Ingestion job started",
        extra={"ingestionJobId": job_id, "changeCount": diff.change_count},
    )
    return job_id
