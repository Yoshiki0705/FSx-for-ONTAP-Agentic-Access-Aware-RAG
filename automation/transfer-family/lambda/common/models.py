"""Data models for Transfer Family ingestion pipeline."""

from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class FileEntry:
    """Represents a file in S3 Access Point."""
    file_key: str
    size: int
    last_modified: str
    e_tag: str


@dataclass
class ChangeSet:
    """Result of change detection between current files and previous inventory."""
    new_files: set = field(default_factory=set)
    changed_files: set = field(default_factory=set)
    unchanged_files: set = field(default_factory=set)

    @property
    def all_changes(self) -> set:
        """All files that have changed (new + modified)."""
        return self.new_files | self.changed_files

    @property
    def has_changes(self) -> bool:
        """Whether any changes were detected."""
        return len(self.new_files) > 0 or len(self.changed_files) > 0


@dataclass
class ScanResult:
    """Result of a scan operation."""
    scan_id: str
    scan_timestamp: str
    detected_files: int
    changed_files: int
    ingestion_job_id: Optional[str] = None
    job_status: Optional[str] = None
    trigger_mode: str = 'polling'
    error: Optional[str] = None
