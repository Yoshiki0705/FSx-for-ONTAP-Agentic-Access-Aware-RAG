"""
Metadata Generator Lambda Handler.

Generates permission metadata (.metadata.json) files for uploaded documents.

Environment Variables:
    S3_ACCESS_POINT_ARN       : FSx ONTAP S3 Access Point ARN
    PERMISSION_CONFIG_TABLE   : DynamoDB permission mapping table name
    DEFAULT_PERMISSIONS       : Default permissions JSON string
    SNS_TOPIC_ARN             : SNS topic for error notifications
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import boto3

# Add parent directory to path for common imports
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from common.metadata_builder import build_metadata_path, build_metadata_json

# Structured logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment variables
S3_ACCESS_POINT_ARN = os.environ.get('S3_ACCESS_POINT_ARN', '')
PERMISSION_CONFIG_TABLE = os.environ.get('PERMISSION_CONFIG_TABLE', '')
DEFAULT_PERMISSIONS = os.environ.get('DEFAULT_PERMISSIONS', '{}')
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN', '')

# AWS clients (lazy initialization)
_s3_client = None
_dynamodb_resource = None
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


def get_sns_client():
    global _sns_client
    if _sns_client is None:
        _sns_client = boto3.client('sns')
    return _sns_client


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main handler for Metadata Generator Lambda.

    Event format:
    {
        "file_key": "uploads/partner-a/document.pdf",
        "uploaded_by": "partner-a"
    }
    """
    file_key = event.get('file_key', '')
    uploaded_by = event.get('uploaded_by', 'unknown')

    logger.info(json.dumps({
        'level': 'INFO',
        'message': 'Metadata generation started',
        'fileKey': file_key,
        'uploadedBy': uploaded_by,
    }))

    try:
        # Step 1: Get user permission mapping from DynamoDB
        permissions = _get_user_permissions(uploaded_by)

        # Step 2: Build metadata JSON
        uploaded_at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        metadata = build_metadata_json(
            allowed_sids=permissions.get('allowed_sids', []),
            allowed_uids=permissions.get('allowed_uids', []),
            allowed_gids=permissions.get('allowed_gids', []),
            uploaded_by=uploaded_by,
            uploaded_at=uploaded_at,
        )

        # Step 3: Write .metadata.json to S3 Access Point
        metadata_key = build_metadata_path(file_key)
        _write_metadata_to_s3(metadata_key, metadata)

        logger.info(json.dumps({
            'level': 'INFO',
            'message': 'Metadata generated successfully',
            'fileKey': file_key,
            'metadataKey': metadata_key,
            'uploadedBy': uploaded_by,
        }))

        return {
            'statusCode': 200,
            'body': {
                'fileKey': file_key,
                'metadataKey': metadata_key,
                'status': 'success',
            },
        }

    except Exception as e:
        logger.error(json.dumps({
            'level': 'ERROR',
            'message': 'Metadata generation failed',
            'fileKey': file_key,
            'uploadedBy': uploaded_by,
            'error': str(e),
        }))

        # Send SNS notification on error (non-blocking)
        _send_error_notification(file_key, uploaded_by, str(e))

        # Don't re-raise - metadata failure should not block ingestion
        return {
            'statusCode': 500,
            'body': {
                'fileKey': file_key,
                'status': 'error',
                'error': str(e),
            },
        }


def _get_user_permissions(user_name: str) -> Dict[str, Any]:
    """
    Get permission mapping for a user from DynamoDB.
    Falls back to default permissions if not configured.
    """
    try:
        dynamodb = get_dynamodb_resource()
        table = dynamodb.Table(PERMISSION_CONFIG_TABLE)
        response = table.get_item(Key={'userName': user_name})

        if 'Item' in response:
            item = response['Item']
            return {
                'allowed_sids': item.get('allowed_sids', []),
                'allowed_uids': item.get('allowed_uids', []),
                'allowed_gids': item.get('allowed_gids', []),
            }
    except Exception as e:
        logger.warning(f'Failed to get permission mapping for {user_name}: {e}')

    # Fall back to default permissions
    try:
        defaults = json.loads(DEFAULT_PERMISSIONS)
        return {
            'allowed_sids': defaults.get('allowed_sids', []),
            'allowed_uids': defaults.get('allowed_uids', []),
            'allowed_gids': defaults.get('allowed_gids', []),
        }
    except (json.JSONDecodeError, TypeError):
        return {'allowed_sids': [], 'allowed_uids': [], 'allowed_gids': []}


def _write_metadata_to_s3(metadata_key: str, metadata: Dict[str, Any]) -> None:
    """Write metadata JSON to S3 Access Point."""
    s3 = get_s3_client()
    s3.put_object(
        Bucket=S3_ACCESS_POINT_ARN,
        Key=metadata_key,
        Body=json.dumps(metadata, ensure_ascii=False, indent=2).encode('utf-8'),
        ContentType='application/json',
    )


def _send_error_notification(file_key: str, uploaded_by: str, error: str) -> None:
    """Send SNS notification on metadata generation failure."""
    if not SNS_TOPIC_ARN:
        return

    try:
        get_sns_client().publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject='Transfer Family Metadata Generation Error',
            Message=json.dumps({
                'fileKey': file_key,
                'uploadedBy': uploaded_by,
                'error': error,
                'timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            }),
        )
    except Exception as e:
        logger.warning(f'Failed to send SNS notification: {e}')
