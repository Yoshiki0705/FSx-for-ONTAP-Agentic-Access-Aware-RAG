"""
Diff computation module.

現在のファイル一覧と前回インベントリを比較し、差分を計算する。
"""

from typing import Dict

from models import DiffResult, FileMetadata


def compute_diff(
    current_files: Dict[str, FileMetadata],
    previous_files: Dict[str, FileMetadata],
) -> DiffResult:
    """
    現在のファイル一覧と前回インベントリを比較し、差分を計算する。

    判定ロジック:
    - 追加: current に存在し previous に存在しないキー
    - 更新: 両方に存在するが size, lastModified, eTag のいずれかが異なるキー
    - 削除: previous に存在し current に存在しないキー

    Args:
        current_files: 現在のファイル一覧
        previous_files: 前回のファイル一覧

    Returns:
        DiffResult with added, updated, deleted lists
    """
    current_keys = set(current_files.keys())
    previous_keys = set(previous_files.keys())

    added = sorted(current_keys - previous_keys)
    deleted = sorted(previous_keys - current_keys)

    updated = []
    for key in sorted(current_keys & previous_keys):
        curr = current_files[key]
        prev = previous_files[key]
        if (
            curr.size != prev.size
            or curr.last_modified != prev.last_modified
            or curr.e_tag != prev.e_tag
        ):
            updated.append(key)

    return DiffResult(
        added=added,
        updated=updated,
        deleted=deleted,
    )
