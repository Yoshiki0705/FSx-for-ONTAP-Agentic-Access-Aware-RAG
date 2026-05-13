"""Unit tests for Metadata Generator Lambda."""

import json
import os
import sys
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lambda'))

from common.metadata_builder import build_metadata_path, build_metadata_json, should_generate_metadata


class TestMetadataPathGeneration:
    """Tests for metadata file path generation."""

    def test_basic_path_generation(self):
        """Metadata path is {doc_path}.metadata.json."""
        assert build_metadata_path('uploads/a/doc.pdf') == 'uploads/a/doc.pdf.metadata.json'

    def test_nested_path_generation(self):
        """Nested paths are handled correctly."""
        assert build_metadata_path('uploads/partner-a/subdir/report.docx') == \
            'uploads/partner-a/subdir/report.docx.metadata.json'

    def test_path_with_special_characters(self):
        """Paths with special characters are handled."""
        assert build_metadata_path('uploads/user/file (1).pdf') == \
            'uploads/user/file (1).pdf.metadata.json'

    def test_path_preserves_prefix(self):
        """Metadata file is in the same prefix as the document."""
        doc_path = 'uploads/partner-a/report.pdf'
        metadata_path = build_metadata_path(doc_path)
        # Same directory
        assert os.path.dirname(metadata_path) == os.path.dirname(doc_path)


class TestMetadataJsonGeneration:
    """Tests for metadata JSON construction."""

    def test_correct_schema_with_all_fields(self):
        """Generated metadata has all required fields."""
        metadata = build_metadata_json(
            allowed_sids=['S-1-5-21-xxx-1001'],
            allowed_uids=['1001'],
            allowed_gids=['1001', '1002'],
            uploaded_by='partner-a',
            uploaded_at='2026-01-15T10:30:00Z',
        )
        assert metadata['allowed_sids'] == ['S-1-5-21-xxx-1001']
        assert metadata['allowed_uids'] == ['1001']
        assert metadata['allowed_gids'] == ['1001', '1002']
        assert metadata['source'] == 'transfer-family'
        assert metadata['uploaded_by'] == 'partner-a'
        assert metadata['uploaded_at'] == '2026-01-15T10:30:00Z'

    def test_default_empty_permissions(self):
        """Default permissions are empty arrays."""
        metadata = build_metadata_json(uploaded_by='test-user')
        assert metadata['allowed_sids'] == []
        assert metadata['allowed_uids'] == []
        assert metadata['allowed_gids'] == []

    def test_source_is_always_transfer_family(self):
        """Source field is always 'transfer-family'."""
        metadata = build_metadata_json(uploaded_by='any-user')
        assert metadata['source'] == 'transfer-family'

    def test_uploaded_at_defaults_to_current_time(self):
        """uploaded_at defaults to current UTC time if not provided."""
        metadata = build_metadata_json(uploaded_by='test-user')
        # Should be a valid ISO 8601 string
        assert 'T' in metadata['uploaded_at']
        assert metadata['uploaded_at'].endswith('Z')

    def test_all_fields_have_correct_types(self):
        """All fields have the correct types."""
        metadata = build_metadata_json(
            allowed_sids=['sid1'],
            allowed_uids=['uid1'],
            allowed_gids=['gid1'],
            uploaded_by='user',
            uploaded_at='2026-01-01T00:00:00Z',
        )
        assert isinstance(metadata['allowed_sids'], list)
        assert isinstance(metadata['allowed_uids'], list)
        assert isinstance(metadata['allowed_gids'], list)
        assert isinstance(metadata['source'], str)
        assert isinstance(metadata['uploaded_by'], str)
        assert isinstance(metadata['uploaded_at'], str)


class TestMetadataGenerationTrigger:
    """Tests for metadata generation trigger logic."""

    def test_should_generate_when_no_metadata_exists(self):
        """Should generate metadata when .metadata.json doesn't exist."""
        assert should_generate_metadata('uploads/a/doc.pdf', set()) is True

    def test_should_not_generate_when_metadata_exists(self):
        """Should not generate when .metadata.json already exists."""
        existing = {'uploads/a/doc.pdf.metadata.json'}
        assert should_generate_metadata('uploads/a/doc.pdf', existing) is False


class TestMetadataGeneratorHandler:
    """Tests for the handler function with mocked AWS services."""

    @patch.dict(os.environ, {
        'S3_ACCESS_POINT_ARN': 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/test-ap',
        'PERMISSION_CONFIG_TABLE': 'test-permission-table',
        'DEFAULT_PERMISSIONS': '{"allowed_sids": [], "allowed_uids": ["1000"], "allowed_gids": ["1000"]}',
        'SNS_TOPIC_ARN': 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
    })
    @patch('metadata_generator.handler.get_dynamodb_resource')
    @patch('metadata_generator.handler.get_s3_client')
    def test_successful_metadata_generation(self, mock_s3, mock_dynamodb):
        """Successful metadata generation writes to S3."""
        # Mock DynamoDB - user has permissions configured
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            'Item': {
                'userName': 'partner-a',
                'allowed_sids': ['S-1-5-21-xxx-1001'],
                'allowed_uids': ['1001'],
                'allowed_gids': ['1001'],
            }
        }
        mock_dynamodb.return_value.Table.return_value = mock_table

        # Mock S3
        mock_s3_client = MagicMock()
        mock_s3.return_value = mock_s3_client

        from metadata_generator.handler import handler
        result = handler({
            'file_key': 'uploads/partner-a/doc.pdf',
            'uploaded_by': 'partner-a',
        }, None)

        assert result['statusCode'] == 200
        mock_s3_client.put_object.assert_called_once()
        call_kwargs = mock_s3_client.put_object.call_args[1]
        assert call_kwargs['Key'] == 'uploads/partner-a/doc.pdf.metadata.json'

    @patch.dict(os.environ, {
        'S3_ACCESS_POINT_ARN': 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/test-ap',
        'PERMISSION_CONFIG_TABLE': 'test-permission-table',
        'DEFAULT_PERMISSIONS': '{"allowed_sids": [], "allowed_uids": ["1000"], "allowed_gids": ["1000"]}',
        'SNS_TOPIC_ARN': '',
    })
    @patch('metadata_generator.handler.get_dynamodb_resource')
    @patch('metadata_generator.handler.get_s3_client')
    def test_default_permissions_applied_when_no_mapping(self, mock_s3, mock_dynamodb):
        """Default permissions are applied when user has no mapping."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}  # No Item
        mock_dynamodb.return_value.Table.return_value = mock_table

        mock_s3_client = MagicMock()
        mock_s3.return_value = mock_s3_client

        from metadata_generator.handler import handler
        result = handler({
            'file_key': 'uploads/unknown-user/doc.pdf',
            'uploaded_by': 'unknown-user',
        }, None)

        assert result['statusCode'] == 200
        call_kwargs = mock_s3_client.put_object.call_args[1]
        body = json.loads(call_kwargs['Body'].decode('utf-8'))
        assert body['allowed_uids'] == ['1000']
        assert body['allowed_gids'] == ['1000']

    @patch.dict(os.environ, {
        'S3_ACCESS_POINT_ARN': 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/test-ap',
        'PERMISSION_CONFIG_TABLE': 'test-permission-table',
        'DEFAULT_PERMISSIONS': '{}',
        'SNS_TOPIC_ARN': 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
    })
    @patch('metadata_generator.handler.get_dynamodb_resource')
    @patch('metadata_generator.handler.get_s3_client')
    @patch('metadata_generator.handler.get_sns_client')
    def test_s3_put_failure_sends_sns_notification(self, mock_sns, mock_s3, mock_dynamodb):
        """PutObject failure sends SNS notification."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        mock_dynamodb.return_value.Table.return_value = mock_table

        mock_s3_client = MagicMock()
        mock_s3_client.put_object.side_effect = Exception('S3 write failed')
        mock_s3.return_value = mock_s3_client

        mock_sns_client = MagicMock()
        mock_sns.return_value = mock_sns_client

        from metadata_generator.handler import handler
        result = handler({
            'file_key': 'uploads/user/doc.pdf',
            'uploaded_by': 'user',
        }, None)

        # Should not raise, but return error status
        assert result['statusCode'] == 500
        mock_sns_client.publish.assert_called_once()
