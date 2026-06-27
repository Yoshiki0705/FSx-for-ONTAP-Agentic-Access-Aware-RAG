"""
Ingestion Trigger Lambda Handler.

Detects new/changed files on FSx for ONTAP S3 Access Point and triggers
Bedrock KB StartIngestionJob.

Environment Variables:
    S3_ACCESS_POINT_ARN    : FSx for ONTAP S3 Access Point ARN
    KNOWLEDGE_BASE_ID      : Bedrock Knowledge Base ID
    DATA_SOURCE_ID         : Bedrock KB Data Source ID
    STATE_TABLE_NAME       : DynamoDB scan state table name
    INVENTORY_TABLE_NAME   : DynamoDB file inventory table name
    METADATA_GENERATOR_ARN : Metadata Generator Lambda ARN
    SCAN_PREFIX            : Scan target prefix (default: /uploads/)
    TRIGGER_MODE           : Trigger mode (polling | cloudtrail)
    SNS_TOPIC_ARN          : SNS topic for error notifications
"""

import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

import boto3

# Add parent directory to path for common imports
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from common.change_detector import detect_changes, should_trigger_ingestion, files_needing_metadata
from common.models import FileEntry, ScanResult
from common.metrics import emit_metrics

# Structured logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment variables
S3_ACCESS_POINT_ARN = os.environ.get('S3_ACCESS_POINT_ARN', '')
KNOWLEDGE_BASE_ID = os.environ.get('KNOWLEDGE_BASE_ID', '')
DATA_SOURCE_ID = os.environ.get('DATA_SOURCE_ID', '')
STATE_TABLE_NAME = os.environ.get('STATE_TABLE_NAME', '')
INVENTORY_TABLE_NAME = os.environ.get('INVENTORY_TABLE_NAME', '')
METADATA_GENERATOR_ARN = os.environ.get('METADATA_GENERATOR_ARN', '')
SCAN_PREFIX = os.environ.get('SCAN_PREFIX', '/uploads/')
TRIGGER_MODE = os.environ.get('TRIGGER_MODE', 'polling')
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN', '')

# AWS clients (lazy initialization)
_s3_client = None
_dynamodb_resource = None
_bedrock_agent_client = None
_lambda_client = None
_sns_client = None


def get_s3_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client('s3')
    return _s3_client


def get_dynamodb_resource():
    global _dynamodb_resource
    if _dynamodb_resource is None:
        _dynamodb_resource = boto3.resource('dynamodb')
    return _dynamodb_resource


def get_bedrock_agent_client():
    global _bedrock_agent_client
    if _bedrock_agent_client is None:
        _bedrock_agent_client = boto3.client('bedrock-agent')
    return _bedrock_agent_client


def get_lambda_client():
    global _lambda_client
    if _lambda_client is None:
        _lambda_client = boto3.client('lambda')
    return _lambda_client


def get_sns_client():
    global _sns_client
    if _sns_client is None:
        _sns_client = boto3.client('sns')
    return _sns_client


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Main handler for Ingestion Trigger Lambda."""
    start_time = time.time()
    scan_id = str(uuid.uuid4())
    scan_timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    trigger_mode = _parse_trigger_mode(event)
    function_name = os.environ.get('AWS_LAMBDA_FUNCTION_NAME', 'ingestion-trigger')

    logger.info(json.dumps({
        'level': 'INFO',
        'message': 'Scan started',
        'scanId': scan_id,
        'triggerMode': trigger_mode,
        'timestamp': scan_timestamp,
    }))

    try:
        # Step 1: List current files from S3 Access Point
        current_files = _list_s3_files()

        # Step 2: Get previous inventory from DynamoDB
        previous_inventory = _get_previous_inventory()

        # Step 3: Detect changes
        all_keys = {f.file_key for f in current_files}
        metadata_keys = {k for k in all_keys if k.endswith('.metadata.json')}
        non_metadata_files = [f for f in current_files if not f.file_key.endswith('.metadata.json')]

        change_set = detect_changes(non_metadata_files, previous_inventory)

        # Step 4: Trigger metadata generation for new files without metadata
        if change_set.new_files:
            needs_metadata = files_needing_metadata(change_set.new_files, metadata_keys)
            for file_key in needs_metadata:
                _invoke_metadata_generator(file_key)

        # Step 5: Check current ingestion job status (deduplication)
        current_job_status = _get_current_job_status()

        # Step 6: Update file inventory BEFORE triggering ingestion (Req 10.3)
        ingestion_job_id = None
        job_status = None
        _update_inventory(non_metadata_files, ingestion_job_id)

        # Step 7: Trigger ingestion if needed
        if should_trigger_ingestion(change_set.has_changes, current_job_status):
            ingestion_job_id = _start_ingestion_job()
            job_status = 'STARTED'
            logger.info(json.dumps({
                'level': 'INFO',
                'message': 'Ingestion job started',
                'ingestionJobId': ingestion_job_id,
                'knowledgeBaseId': KNOWLEDGE_BASE_ID,
                'dataSourceId': DATA_SOURCE_ID,
                'scanId': scan_id,
            }))
            # Update inventory with ingestion job ID
            _update_inventory_job_id(non_metadata_files, ingestion_job_id)
        elif not change_set.has_changes:
            logger.info(json.dumps({
                'level': 'INFO',
                'message': 'No changes detected, skipping ingestion',
                'scanId': scan_id,
            }))
        elif current_job_status == 'IN_PROGRESS':
            logger.info(json.dumps({
                'level': 'INFO',
                'message': 'Ingestion job already in progress, skipping',
                'scanId': scan_id,
                'currentJobStatus': current_job_status,
            }))

        # Step 8: Save scan state
        duration_ms = int((time.time() - start_time) * 1000)
        scan_result = ScanResult(
            scan_id=scan_id,
            scan_timestamp=scan_timestamp,
            detected_files=len(non_metadata_files),
            changed_files=len(change_set.all_changes),
            ingestion_job_id=ingestion_job_id,
            job_status=job_status,
            trigger_mode=trigger_mode,
        )
        _save_scan_state(scan_result)

        # Step 9: Emit EMF metrics
        emit_metrics(
            namespace='TransferFamilyIngestion',
            metrics={
                'DetectedFiles': float(len(non_metadata_files)),
                'ChangedFiles': float(len(change_set.all_changes)),
                'NewFiles': float(len(change_set.new_files)),
                'IngestionJobTriggered': 1.0 if ingestion_job_id else 0.0,
                'ScanDurationMs': float(duration_ms),
            },
            dimensions={'TriggerMode': trigger_mode},
            function_name=function_name,
        )

        logger.info(json.dumps({
            'level': 'INFO',
            'message': 'Scan completed',
            'scanId': scan_id,
            'detectedFiles': len(non_metadata_files),
            'newFiles': len(change_set.new_files),
            'changedFiles': len(change_set.changed_files),
            'unchangedFiles': len(change_set.unchanged_files),
            'ingestionJobId': ingestion_job_id,
            'durationMs': duration_ms,
        }))

        return {
            'statusCode': 200,
            'body': {
                'scanId': scan_id,
                'detectedFiles': len(non_metadata_files),
                'changedFiles': len(change_set.all_changes),
                'ingestionJobId': ingestion_job_id,
            },
        }

    except Exception as e:
        logger.error(json.dumps({
            'level': 'ERROR',
            'message': 'Scan failed',
            'scanId': scan_id,
            'error': str(e),
            'knowledgeBaseId': KNOWLEDGE_BASE_ID,
            'dataSourceId': DATA_SOURCE_ID,
            'triggerMode': trigger_mode,
            'timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        }))

        # Emit error metric
        emit_metrics(
            namespace='TransferFamilyIngestion',
            metrics={'IngestionJobFailed': 1.0},
            dimensions={'TriggerMode': trigger_mode},
            function_name=function_name,
        )

        # Send SNS notification on error
        if SNS_TOPIC_ARN:
            try:
                get_sns_client().publish(
                    TopicArn=SNS_TOPIC_ARN,
                    Subject='Transfer Family Ingestion Trigger Error',
                    Message=json.dumps({
                        'scanId': scan_id,
                        'error': str(e),
                        'knowledgeBaseId': KNOWLEDGE_BASE_ID,
                        'dataSourceId': DATA_SOURCE_ID,
                    }),
                )
            except Exception:
                pass  # Don't fail on notification error

        raise


def _parse_trigger_mode(event: Dict[str, Any]) -> str:
    """Parse trigger mode from event (polling scheduler or CloudTrail)."""
    # Scheduler event
    if event.get('source') == 'scheduler':
        return event.get('triggerMode', 'polling')

    # CloudTrail event via EventBridge
    if event.get('detail-type') == 'AWS API Call via CloudTrail':
        return 'cloudtrail'

    # Default
    return TRIGGER_MODE


def _list_s3_files() -> List[FileEntry]:
    """List all files from S3 Access Point under the scan prefix."""
    s3 = get_s3_client()
    files: List[FileEntry] = []

    # Parse bucket name from S3 AP ARN
    # ARN format: arn:aws:s3:region:account:accesspoint/name
    ap_name = S3_ACCESS_POINT_ARN.split('/')[-1] if '/' in S3_ACCESS_POINT_ARN else S3_ACCESS_POINT_ARN

    paginator = s3.get_paginator('list_objects_v2')
    prefix = SCAN_PREFIX.lstrip('/')

    for page in paginator.paginate(Bucket=S3_ACCESS_POINT_ARN, Prefix=prefix):
        for obj in page.get('Contents', []):
            files.append(FileEntry(
                file_key=obj['Key'],
                size=obj['Size'],
                last_modified=obj['LastModified'].isoformat() if hasattr(obj['LastModified'], 'isoformat') else str(obj['LastModified']),
                e_tag=obj['ETag'],
            ))

    return files


def _get_previous_inventory() -> Dict[str, FileEntry]:
    """Get previous file inventory from DynamoDB."""
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(INVENTORY_TABLE_NAME)
    inventory: Dict[str, FileEntry] = {}

    # Scan the inventory table
    response = table.scan()
    for item in response.get('Items', []):
        inventory[item['fileKey']] = FileEntry(
            file_key=item['fileKey'],
            size=int(item.get('size', 0)),
            last_modified=item.get('lastModified', ''),
            e_tag=item.get('eTag', ''),
        )

    # Handle pagination
    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        for item in response.get('Items', []):
            inventory[item['fileKey']] = FileEntry(
                file_key=item['fileKey'],
                size=int(item.get('size', 0)),
                last_modified=item.get('lastModified', ''),
                e_tag=item.get('eTag', ''),
            )

    return inventory


def _get_current_job_status() -> Optional[str]:
    """Check if there's a currently running ingestion job."""
    try:
        client = get_bedrock_agent_client()
        response = client.list_ingestion_jobs(
            knowledgeBaseId=KNOWLEDGE_BASE_ID,
            dataSourceId=DATA_SOURCE_ID,
            maxResults=1,
            sortBy={'attribute': 'STARTED_AT', 'order': 'DESCENDING'},
        )
        jobs = response.get('ingestionJobSummaries', [])
        if jobs:
            return jobs[0].get('status')
        return None
    except Exception as e:
        logger.warning(f'Failed to check job status: {e}')
        return None


def _start_ingestion_job() -> Optional[str]:
    """Start a new Bedrock KB ingestion job."""
    client = get_bedrock_agent_client()
    response = client.start_ingestion_job(
        knowledgeBaseId=KNOWLEDGE_BASE_ID,
        dataSourceId=DATA_SOURCE_ID,
    )
    return response.get('ingestionJob', {}).get('ingestionJobId')


def _invoke_metadata_generator(file_key: str) -> None:
    """Invoke Metadata Generator Lambda asynchronously."""
    if not METADATA_GENERATOR_ARN:
        return

    try:
        client = get_lambda_client()
        # Extract username from path: /uploads/{userName}/...
        parts = file_key.split('/')
        uploaded_by = parts[1] if len(parts) > 2 and parts[0] == 'uploads' else 'unknown'

        payload = json.dumps({
            'file_key': file_key,
            'uploaded_by': uploaded_by,
        })

        client.invoke(
            FunctionName=METADATA_GENERATOR_ARN,
            InvocationType='Event',  # Async
            Payload=payload.encode('utf-8'),
        )
    except Exception as e:
        logger.warning(f'Failed to invoke metadata generator for {file_key}: {e}')


def _update_inventory(files: List[FileEntry], ingestion_job_id: Optional[str]) -> None:
    """Update file inventory in DynamoDB."""
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(INVENTORY_TABLE_NAME)
    now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    with table.batch_writer() as batch:
        for f in files:
            item = {
                'fileKey': f.file_key,
                'size': f.size,
                'lastModified': f.last_modified,
                'eTag': f.e_tag,
                'lastUpdated': now,
            }
            if ingestion_job_id:
                item['lastIngestionJobId'] = ingestion_job_id
            batch.put_item(Item=item)


def _update_inventory_job_id(files: List[FileEntry], ingestion_job_id: str) -> None:
    """Update only the ingestion job ID in file inventory entries."""
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(INVENTORY_TABLE_NAME)

    for f in files:
        try:
            table.update_item(
                Key={'fileKey': f.file_key},
                UpdateExpression='SET lastIngestionJobId = :jid',
                ExpressionAttributeValues={':jid': ingestion_job_id},
            )
        except Exception:
            pass  # Best-effort update


def _save_scan_state(result: ScanResult) -> None:
    """Save scan result to DynamoDB state table."""
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(STATE_TABLE_NAME)

    # TTL: 30 days from now
    ttl = int(time.time()) + (30 * 24 * 60 * 60)

    item = {
        'scanId': result.scan_id,
        'scanTimestamp': result.scan_timestamp,
        'detectedFiles': result.detected_files,
        'changedFiles': result.changed_files,
        'triggerMode': result.trigger_mode,
        'ttl': ttl,
    }
    if result.ingestion_job_id:
        item['ingestionJobId'] = result.ingestion_job_id
    if result.job_status:
        item['jobStatus'] = result.job_status
    if result.error:
        item['error'] = result.error

    table.put_item(Item=item)
