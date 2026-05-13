"""Unit tests for Ingestion Trigger Lambda."""

import json
import os
import sys
from unittest.mock import MagicMock, patch, ANY
from datetime import datetime, timezone

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lambda'))

from common.change_detector import detect_changes, should_trigger_ingestion, files_needing_metadata
from common.models import FileEntry, ChangeSet


class TestChangeDetection:
    """Tests for change detection logic."""

    def test_no_changes_detected(self):
        """When current files match inventory, no changes are detected."""
        files = [
            FileEntry(file_key='uploads/a/doc.pdf', size=100, last_modified='2026-01-01T00:00:00Z', e_tag='"abc"'),
        ]
        inventory = {
            'uploads/a/doc.pdf': FileEntry(file_key='uploads/a/doc.pdf', size=100, last_modified='2026-01-01T00:00:00Z', e_tag='"abc"'),
        }
        result = detect_changes(files, inventory)
        assert len(result.new_files) == 0
        assert len(result.changed_files) == 0
        assert len(result.unchanged_files) == 1
        assert not result.has_changes

    def test_new_file_detected(self):
        """New files not in inventory are detected."""
        files = [
            FileEntry(file_key='uploads/a/new.pdf', size=200, last_modified='2026-01-02T00:00:00Z', e_tag='"def"'),
        ]
        inventory = {}
        result = detect_changes(files, inventory)
        assert 'uploads/a/new.pdf' in result.new_files
        assert result.has_changes

    def test_changed_file_detected_by_etag(self):
        """Files with different ETag are detected as changed."""
        files = [
            FileEntry(file_key='uploads/a/doc.pdf', size=100, last_modified='2026-01-01T00:00:00Z', e_tag='"xyz"'),
        ]
        inventory = {
            'uploads/a/doc.pdf': FileEntry(file_key='uploads/a/doc.pdf', size=100, last_modified='2026-01-01T00:00:00Z', e_tag='"abc"'),
        }
        result = detect_changes(files, inventory)
        assert 'uploads/a/doc.pdf' in result.changed_files
        assert result.has_changes

    def test_changed_file_detected_by_size(self):
        """Files with different size are detected as changed."""
        files = [
            FileEntry(file_key='uploads/a/doc.pdf', size=200, last_modified='2026-01-01T00:00:00Z', e_tag='"abc"'),
        ]
        inventory = {
            'uploads/a/doc.pdf': FileEntry(file_key='uploads/a/doc.pdf', size=100, last_modified='2026-01-01T00:00:00Z', e_tag='"abc"'),
        }
        result = detect_changes(files, inventory)
        assert 'uploads/a/doc.pdf' in result.changed_files

    def test_empty_state_triggers_full_scan(self):
        """When inventory is empty (first run), all files are new."""
        files = [
            FileEntry(file_key='uploads/a/doc1.pdf', size=100, last_modified='2026-01-01T00:00:00Z', e_tag='"a"'),
            FileEntry(file_key='uploads/b/doc2.pdf', size=200, last_modified='2026-01-02T00:00:00Z', e_tag='"b"'),
        ]
        inventory = {}
        result = detect_changes(files, inventory)
        assert len(result.new_files) == 2
        assert result.has_changes


class TestIngestionDeduplication:
    """Tests for ingestion job deduplication logic."""

    def test_no_changes_skips_ingestion(self):
        """When no changes detected, ingestion is not triggered."""
        assert should_trigger_ingestion(has_changes=False, current_job_status=None) is False

    def test_changes_with_no_running_job_triggers_ingestion(self):
        """When changes detected and no job running, ingestion is triggered."""
        assert should_trigger_ingestion(has_changes=True, current_job_status=None) is True
        assert should_trigger_ingestion(has_changes=True, current_job_status='COMPLETE') is True
        assert should_trigger_ingestion(has_changes=True, current_job_status='FAILED') is True

    def test_job_in_progress_skips_new_job(self):
        """When job is IN_PROGRESS, new job is not started."""
        assert should_trigger_ingestion(has_changes=True, current_job_status='IN_PROGRESS') is False

    def test_no_changes_with_in_progress_skips(self):
        """No changes + IN_PROGRESS = no trigger."""
        assert should_trigger_ingestion(has_changes=False, current_job_status='IN_PROGRESS') is False


class TestMetadataNeeds:
    """Tests for metadata generation trigger logic."""

    def test_new_file_without_metadata_needs_generation(self):
        """New files without existing metadata need generation."""
        new_files = {'uploads/a/doc.pdf'}
        existing_metadata = set()
        result = files_needing_metadata(new_files, existing_metadata)
        assert 'uploads/a/doc.pdf' in result

    def test_new_file_with_existing_metadata_skips(self):
        """New files with existing metadata don't need generation."""
        new_files = {'uploads/a/doc.pdf'}
        existing_metadata = {'uploads/a/doc.pdf.metadata.json'}
        result = files_needing_metadata(new_files, existing_metadata)
        assert 'uploads/a/doc.pdf' not in result


class TestEventParsing:
    """Tests for event parsing logic."""

    def test_polling_event_format(self):
        """Polling scheduler event is correctly parsed."""
        from ingestion_trigger.handler import _parse_trigger_mode
        event = {'source': 'scheduler', 'triggerMode': 'polling'}
        assert _parse_trigger_mode(event) == 'polling'

    def test_cloudtrail_event_format(self):
        """CloudTrail event is correctly parsed."""
        from ingestion_trigger.handler import _parse_trigger_mode
        event = {
            'detail-type': 'AWS API Call via CloudTrail',
            'source': 'aws.s3',
            'detail': {
                'eventSource': 's3.amazonaws.com',
                'eventName': 'PutObject',
            },
        }
        assert _parse_trigger_mode(event) == 'cloudtrail'

    def test_unknown_event_uses_default(self):
        """Unknown event format uses TRIGGER_MODE env var."""
        from ingestion_trigger.handler import _parse_trigger_mode
        event = {'unknown': 'format'}
        # Default from env var
        assert _parse_trigger_mode(event) == 'polling'
