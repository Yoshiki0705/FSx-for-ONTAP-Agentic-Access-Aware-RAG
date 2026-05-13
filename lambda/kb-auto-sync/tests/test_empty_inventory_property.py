"""
Property Test: Empty Inventory Triggers Full Scan (Property 5).

空インベントリ + 非空 current_files の場合、常に変更検出されることを検証。

Validates: Requirements 4.6
"""

from hypothesis import given, settings
from hypothesis import strategies as st

from diff import compute_diff
from models import FileMetadata

# Strategy: generate a non-empty file dict
file_key_st = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N"), whitelist_characters="/-_."),
    min_size=1,
    max_size=50,
)

file_metadata_st = st.builds(
    FileMetadata,
    key=file_key_st,
    size=st.integers(min_value=0, max_value=10**12),
    last_modified=st.text(min_size=10, max_size=30),
    e_tag=st.text(min_size=5, max_size=40),
)

non_empty_file_dict_st = st.dictionaries(
    keys=file_key_st,
    values=file_metadata_st,
    min_size=1,
    max_size=20,
).map(lambda d: {k: FileMetadata(key=k, size=v.size, last_modified=v.last_modified, e_tag=v.e_tag) for k, v in d.items()})


@given(current_files=non_empty_file_dict_st)
@settings(max_examples=200)
def test_empty_inventory_always_detects_changes(current_files):
    """With empty inventory and non-empty current files, changes are always detected."""
    previous_files: dict[str, FileMetadata] = {}
    diff = compute_diff(current_files, previous_files)

    assert diff.has_changes is True
    assert diff.change_count == len(current_files)
    assert len(diff.added) == len(current_files)
    assert len(diff.updated) == 0
    assert len(diff.deleted) == 0


@given(current_files=non_empty_file_dict_st)
@settings(max_examples=200)
def test_empty_inventory_all_files_are_added(current_files):
    """With empty inventory, all current files should be classified as added."""
    previous_files: dict[str, FileMetadata] = {}
    diff = compute_diff(current_files, previous_files)

    assert set(diff.added) == set(current_files.keys())
