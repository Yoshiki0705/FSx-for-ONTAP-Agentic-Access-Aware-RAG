"""
Property-Based Tests for Transfer Family Ingestion Pipeline.

Uses Hypothesis to verify correctness properties across random inputs.
"""

import os
import sys
from datetime import datetime, timezone

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lambda'))

from common.change_detector import detect_changes, should_trigger_ingestion, files_needing_metadata
from common.models import FileEntry, ChangeSet
from common.metadata_builder import build_metadata_path, build_metadata_json, should_generate_metadata


# ========================================
# Strategies
# ========================================

# File key strategy: valid S3 object keys under /uploads/
file_key_st = st.from_regex(
    r'uploads/[a-z][a-z0-9\-]{1,10}/[a-z0-9\-_]{1,20}\.(pdf|docx|txt|csv)',
    fullmatch=True,
)

# ETag strategy
etag_st = st.text(
    alphabet=st.characters(whitelist_categories=('Ll', 'Nd')),
    min_size=8, max_size=32,
).map(lambda s: f'"{s}"')

# File size strategy
size_st = st.integers(min_value=1, max_value=100_000_000)

# ISO timestamp strategy
timestamp_st = st.datetimes(
    min_value=datetime(2025, 1, 1),
    max_value=datetime(2027, 12, 31),
).map(lambda dt: dt.strftime('%Y-%m-%dT%H:%M:%SZ'))

# FileEntry strategy
file_entry_st = st.builds(
    FileEntry,
    file_key=file_key_st,
    size=size_st,
    last_modified=timestamp_st,
    e_tag=etag_st,
)

# Username strategy
username_st = st.from_regex(r'[a-z][a-z0-9\-]{2,15}', fullmatch=True)

# SID strategy
sid_st = st.from_regex(r'S-1-5-21-\d{9}-\d{9}-\d{9}-\d{4}', fullmatch=True)

# UID/GID strategy
uid_gid_st = st.integers(min_value=1000, max_value=65534).map(str)

# Job status strategy
job_status_st = st.sampled_from([None, 'IN_PROGRESS', 'COMPLETE', 'FAILED', 'STARTED'])


# ========================================
# Property 1: File Change Detection Correctness
# ========================================

class TestProperty1ChangeDetection:
    """Feature: transfer-family-fsxn-ingestion, Property 1: ファイル変更検出の正確性"""

    @given(
        current_files=st.lists(file_entry_st, min_size=0, max_size=20),
        previous_entries=st.lists(file_entry_st, min_size=0, max_size=20),
    )
    @settings(max_examples=200)
    def test_change_detection_correctness(self, current_files, previous_entries):
        """
        For any combination of current files and previous inventory,
        change detection correctly classifies new, changed, and unchanged files.
        """
        # Deduplicate by file_key
        current_deduped = {f.file_key: f for f in current_files}
        current_list = list(current_deduped.values())
        previous_inventory = {f.file_key: f for f in previous_entries}

        result = detect_changes(current_list, previous_inventory)

        # Property: new_files ∪ changed_files = all_changes
        assert result.new_files | result.changed_files == result.all_changes

        # Property: new_files ∩ unchanged_files = ∅
        assert len(result.new_files & result.unchanged_files) == 0

        # Property: changed_files ∩ unchanged_files = ∅
        assert len(result.changed_files & result.unchanged_files) == 0

        # Property: new_files ∩ changed_files = ∅
        assert len(result.new_files & result.changed_files) == 0

        # Property: all classified files are from current_list
        all_classified = result.new_files | result.changed_files | result.unchanged_files
        current_keys = {f.file_key for f in current_list}
        assert all_classified == current_keys

        # Property: new files are not in previous inventory
        for key in result.new_files:
            assert key not in previous_inventory

        # Property: changed/unchanged files are in previous inventory
        for key in result.changed_files | result.unchanged_files:
            assert key in previous_inventory


# ========================================
# Property 2: Ingestion Job Deduplication
# ========================================

class TestProperty2Deduplication:
    """Feature: transfer-family-fsxn-ingestion, Property 2: インジェスションジョブ重複排除"""

    @given(
        has_changes=st.booleans(),
        job_status=job_status_st,
        trigger_mode=st.sampled_from(['polling', 'cloudtrail']),
    )
    @settings(max_examples=200)
    def test_deduplication_logic(self, has_changes, job_status, trigger_mode):
        """
        StartIngestionJob is called only when:
        1. Changes detected (has_changes=True)
        2. No job is IN_PROGRESS

        This is independent of trigger mode.
        """
        result = should_trigger_ingestion(has_changes, job_status)

        if not has_changes:
            assert result is False, "Should not trigger when no changes"
        elif job_status == 'IN_PROGRESS':
            assert result is False, "Should not trigger when job IN_PROGRESS"
        else:
            assert result is True, "Should trigger when changes exist and no IN_PROGRESS job"


# ========================================
# Property 4: Metadata Generation Trigger
# ========================================

class TestProperty4MetadataTrigger:
    """Feature: transfer-family-fsxn-ingestion, Property 4: メタデータ生成トリガー判定"""

    @given(
        new_file_keys=st.sets(file_key_st, min_size=0, max_size=10),
        has_metadata_ratio=st.floats(min_value=0.0, max_value=1.0),
    )
    @settings(max_examples=200)
    def test_metadata_trigger_only_for_new_without_metadata(self, new_file_keys, has_metadata_ratio):
        """
        Metadata generation is triggered only for files that are:
        - Newly detected
        - Don't have existing .metadata.json
        """
        # Create metadata keys for some of the new files
        new_keys_list = list(new_file_keys)
        split_idx = int(len(new_keys_list) * has_metadata_ratio)
        keys_with_metadata = set(new_keys_list[:split_idx])
        existing_metadata = {f"{k}.metadata.json" for k in keys_with_metadata}

        result = files_needing_metadata(new_file_keys, existing_metadata)

        # Property: result is subset of new_file_keys
        assert result <= new_file_keys

        # Property: files with existing metadata are NOT in result
        for key in keys_with_metadata:
            assert key not in result

        # Property: files without metadata ARE in result
        keys_without_metadata = new_file_keys - keys_with_metadata
        assert result == keys_without_metadata


# ========================================
# Property 5: Metadata File Path Generation
# ========================================

class TestProperty5MetadataPath:
    """Feature: transfer-family-fsxn-ingestion, Property 5: メタデータファイルパス生成"""

    @given(doc_path=file_key_st)
    @settings(max_examples=200)
    def test_metadata_path_format(self, doc_path):
        """
        For any document path, the metadata path is always
        {original_path}.metadata.json in the same prefix.
        """
        metadata_path = build_metadata_path(doc_path)

        # Property: metadata path = doc_path + ".metadata.json"
        assert metadata_path == f"{doc_path}.metadata.json"

        # Property: same directory (prefix)
        doc_dir = '/'.join(doc_path.split('/')[:-1])
        meta_dir = '/'.join(metadata_path.split('/')[:-1])
        assert doc_dir == meta_dir

        # Property: metadata path ends with .metadata.json
        assert metadata_path.endswith('.metadata.json')

        # Property: metadata path starts with same prefix as doc
        assert metadata_path.startswith(doc_path)


# ========================================
# Property 6: Metadata JSON Schema Conformance
# ========================================

class TestProperty6MetadataSchema:
    """Feature: transfer-family-fsxn-ingestion, Property 6: メタデータ JSON スキーマ適合性"""

    @given(
        allowed_sids=st.lists(sid_st, min_size=0, max_size=5),
        allowed_uids=st.lists(uid_gid_st, min_size=0, max_size=5),
        allowed_gids=st.lists(uid_gid_st, min_size=0, max_size=5),
        uploaded_by=username_st,
        uploaded_at=timestamp_st,
    )
    @settings(max_examples=200)
    def test_metadata_schema_conformance(self, allowed_sids, allowed_uids, allowed_gids, uploaded_by, uploaded_at):
        """
        For any permission mapping and username, the generated metadata JSON
        contains all required fields with correct types.
        """
        metadata = build_metadata_json(
            allowed_sids=allowed_sids,
            allowed_uids=allowed_uids,
            allowed_gids=allowed_gids,
            uploaded_by=uploaded_by,
            uploaded_at=uploaded_at,
        )

        # Required fields exist
        assert 'allowed_sids' in metadata
        assert 'allowed_uids' in metadata
        assert 'allowed_gids' in metadata
        assert 'source' in metadata
        assert 'uploaded_by' in metadata
        assert 'uploaded_at' in metadata

        # Correct types
        assert isinstance(metadata['allowed_sids'], list)
        assert isinstance(metadata['allowed_uids'], list)
        assert isinstance(metadata['allowed_gids'], list)
        assert isinstance(metadata['source'], str)
        assert isinstance(metadata['uploaded_by'], str)
        assert isinstance(metadata['uploaded_at'], str)

        # All list elements are strings
        assert all(isinstance(s, str) for s in metadata['allowed_sids'])
        assert all(isinstance(s, str) for s in metadata['allowed_uids'])
        assert all(isinstance(s, str) for s in metadata['allowed_gids'])

        # Source is always "transfer-family"
        assert metadata['source'] == 'transfer-family'

        # uploaded_by matches input
        assert metadata['uploaded_by'] == uploaded_by

        # uploaded_at is valid ISO 8601
        assert 'T' in metadata['uploaded_at']


# ========================================
# Property 7: File Inventory State Update Consistency
# ========================================

class TestProperty7InventoryConsistency:
    """Feature: transfer-family-fsxn-ingestion, Property 7: ファイルインベントリ状態更新の整合性"""

    @given(
        current_files=st.lists(file_entry_st, min_size=0, max_size=15),
        previous_entries=st.lists(file_entry_st, min_size=0, max_size=15),
    )
    @settings(max_examples=200)
    def test_inventory_update_consistency(self, current_files, previous_entries):
        """
        After inventory update, the state satisfies:
        - New files are added to inventory
        - Changed files have updated metadata
        - Unchanged files remain the same
        - Post-update entry count = previous count + new file count
        """
        # Deduplicate
        current_deduped = {f.file_key: f for f in current_files}
        current_list = list(current_deduped.values())
        previous_inventory = {f.file_key: f for f in previous_entries}

        result = detect_changes(current_list, previous_inventory)

        # Simulate inventory update: merge current into previous
        updated_inventory = dict(previous_inventory)
        for f in current_list:
            updated_inventory[f.file_key] = f

        # Property: all current files are in updated inventory
        for f in current_list:
            assert f.file_key in updated_inventory

        # Property: new files are now in inventory
        for key in result.new_files:
            assert key in updated_inventory

        # Property: updated inventory size = previous + new files
        # (changed files overwrite, unchanged stay, new are added)
        expected_size = len(previous_inventory) + len(result.new_files)
        assert len(updated_inventory) == expected_size

        # Property: unchanged files retain their original values
        for key in result.unchanged_files:
            assert updated_inventory[key] == previous_inventory[key]
