"""
Data models for KB Auto Sync Lambda.

FileMetadata: S3 オブジェクトのメタデータを表現する dataclass
DiffResult: 差分計算結果を表現する dataclass
"""

from dataclasses import dataclass, field
from typing import List


@dataclass(frozen=True)
class FileMetadata:
    """S3 オブジェクトのメタデータ."""

    key: str
    size: int
    last_modified: str
    e_tag: str


@dataclass(frozen=True)
class DiffResult:
    """差分計算結果."""

    added: List[str] = field(default_factory=list)
    updated: List[str] = field(default_factory=list)
    deleted: List[str] = field(default_factory=list)

    @property
    def has_changes(self) -> bool:
        """変更があるかどうか."""
        return self.change_count > 0

    @property
    def change_count(self) -> int:
        """変更件数の合計."""
        return len(self.added) + len(self.updated) + len(self.deleted)
