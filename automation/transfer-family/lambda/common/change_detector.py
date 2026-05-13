"""
Pure logic for file change detection.

Separated from handler for testability (Property-Based Testing target).
"""

from typing import Dict, List, Optional, Set
from .models import FileEntry, ChangeSet


def detect_changes(
    current_files: List[FileEntry],
    previous_inventory: Dict[str, FileEntry],
) -> ChangeSet:
    """
    Detect new, changed, and unchanged files by comparing current S3 listing
    against previous DynamoDB inventory.

    Args:
        current_files: Current file list from S3 Access Point ListObjectsV2
        previous_inventory: Previous inventory from DynamoDB (keyed by file_key)

    Returns:
        ChangeSet with new_files, changed_files, unchanged_files (sets of file_key)
    """
    new_files: Set[str] = set()
    changed_files: Set[str] = set()
    unchanged_files: Set[str] = set()

    for current in current_files:
        prev = previous_inventory.get(current.file_key)
        if prev is None:
            # File exists in current but not in previous → new
            new_files.add(current.file_key)
        elif (
            current.e_tag != prev.e_tag
            or current.size != prev.size
            or current.last_modified != prev.last_modified
        ):
            # File exists in both but attributes differ → changed
            changed_files.add(current.file_key)
        else:
            # File exists in both with same attributes → unchanged
            unchanged_files.add(current.file_key)

    return ChangeSet(
        new_files=new_files,
        changed_files=changed_files,
        unchanged_files=unchanged_files,
    )


def should_trigger_ingestion(has_changes: bool, current_job_status: Optional[str]) -> bool:
    """
    Determine whether to trigger a new ingestion job.

    Conditions (ALL must be true):
    1. Changes were detected (has_changes=True)
    2. No job is currently IN_PROGRESS

    Args:
        has_changes: Whether the scan detected any changes
        current_job_status: Current ingestion job status (None if no job exists)

    Returns:
        True if a new ingestion job should be started
    """
    if not has_changes:
        return False
    if current_job_status == 'IN_PROGRESS':
        return False
    return True


def files_needing_metadata(
    new_file_keys: Set[str],
    existing_metadata_keys: Set[str],
) -> Set[str]:
    """
    Determine which new files need metadata generation.

    A file needs metadata if:
    - It is newly detected (in new_file_keys)
    - No corresponding .metadata.json exists

    Args:
        new_file_keys: Set of newly detected file keys
        existing_metadata_keys: Set of existing .metadata.json file keys

    Returns:
        Set of file keys that need metadata generation
    """
    result = set()
    for key in new_file_keys:
        metadata_key = f"{key}.metadata.json"
        if metadata_key not in existing_metadata_keys:
            result.add(key)
    return result
