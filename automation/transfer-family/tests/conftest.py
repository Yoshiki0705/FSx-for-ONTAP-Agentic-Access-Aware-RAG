"""Shared test fixtures for Transfer Family tests."""

import os
import sys
import pytest

# Add lambda directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lambda'))

# Set environment variables for tests
os.environ.setdefault('S3_ACCESS_POINT_ARN', 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/test-ap')
os.environ.setdefault('KNOWLEDGE_BASE_ID', 'kb-test-12345')
os.environ.setdefault('DATA_SOURCE_ID', 'ds-test-12345')
os.environ.setdefault('STATE_TABLE_NAME', 'test-transfer-scan-state')
os.environ.setdefault('INVENTORY_TABLE_NAME', 'test-transfer-file-inventory')
os.environ.setdefault('METADATA_GENERATOR_ARN', 'arn:aws:lambda:ap-northeast-1:123456789012:function:test-metadata-generator')
os.environ.setdefault('PERMISSION_CONFIG_TABLE', 'test-transfer-permission-mapping')
os.environ.setdefault('DEFAULT_PERMISSIONS', '{"allowed_sids": [], "allowed_uids": ["1000"], "allowed_gids": ["1000"]}')
os.environ.setdefault('SCAN_PREFIX', '/uploads/')
os.environ.setdefault('TRIGGER_MODE', 'polling')
os.environ.setdefault('SNS_TOPIC_ARN', '')
os.environ.setdefault('AWS_DEFAULT_REGION', 'ap-northeast-1')
