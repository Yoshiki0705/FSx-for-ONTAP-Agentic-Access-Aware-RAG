"""
Property Test: Change Detection Correctness (Property 1).

任意の current/previous ファイルリストに対して:
- added/updated/deleted が正しく分類されること
- has_changes が change_count > 0 と一致すること

Validates: Requirements 1.2, 1.3, 1.4, 1.5
"""

from hypothesis import given, settings
from hypothesis import strategies as st

from diff import compute_diff
from models import FileMetadata

# Strategy: generate a file key
file_key_st = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N"), whitelist_characters="/-_."),
    min_size=1,
    max_size=50,
)

# Strategy: generate FileMetadata
file_metadata_st = st.builds(
    FileMetadata,
    key=file_key_st,
    size=st.integers(min_value=0, max_value=10**12),
    last_modified=st.text(min_size=10, max_size=30),
    e_tag=st.text(min_size=5, max_size=40),
)

# Strategy: generate a dict of file key -> FileMetadata
file_dict_st = st.dictionaries(
    keys=file_key_st,
    values=file_metadata_st,
    min_size=0,
    max_size=20,
).map(lambda d: {k: FileMetadata(key=k, size=v.size, last_modified=v.last_modified, e_tag=v.e_tag) for k, v in d.items()})


@given(current=file_dict_st, previous=file_dict_st)
@settings(max_examples=200)
def test_added_files_are_in_current_not_previous(current, previous):
    """Added files must be in current but not in previous."""
    diff = compute_diff(current, previous)
    for key in diff.added:
        assert key in current
        assert key not in previous


@given(current=file_dict_st, previous=file_dict_st)
@settings(max_examples=200)
def test_deleted_files_are_in_previous_not_current(current, previous):
    """Deleted files must be in previous but not in current."""
    diff = compute_diff(current, previous)
    for key in diff.deleted:
        assert key in previous
        assert key not in current


@given(current=file_dict_st, previous=file_dict_st)
@settings(max_examples=200)
def test_updated_files_are_in_both_with_differences(current, previous):
    """Updated files must be in both current and previous with differing metadata."""
    diff = compute_diff(current, previous)
    for key in diff.updated:
        assert key in current
        assert key in previous
        curr = current[key]
        prev = previous[key]
        # At least one field must differ
        assert (
            curr.size != prev.size
            or curr.last_modified != prev.last_modified
            or curr.e_tag != prev.e_tag
        )


@given(current=file_dict_st, previous=file_dict_st)
@settings(max_examples=200)
def test_has_changes_equals_change_count_positive(current, previous):
    """has_changes is True iff change_count > 0."""
    diff = compute_diff(current, previous)
    assert diff.has_changes == (diff.change_count > 0)


@given(current=file_dict_st, previous=file_dict_st)
@settings(max_examples=200)
def test_change_count_equals_sum_of_categories(current, previous):
    """change_count equals len(added) + len(updated) + len(deleted)."""
    diff = compute_diff(current, previous)
    assert diff.change_count == len(diff.added) + len(diff.updated) + len(diff.deleted)


@given(current=file_dict_st, previous=file_dict_st)
@settings(max_examples=200)
def test_no_overlap_between_categories(current, previous):
    """added, updated, and deleted must be mutually exclusive."""
    diff = compute_diff(current, previous)
    added_set = set(diff.added)
    updated_set = set(diff.updated)
    deleted_set = set(diff.deleted)
    assert added_set.isdisjoint(updated_set)
    assert added_set.isdisjoint(deleted_set)
    assert updated_set.isdisjoint(deleted_set)


@given(current=file_dict_st, previous=file_dict_st)
@settings(max_examples=200)
def test_all_keys_accounted_for(current, previous):
    """Every key in current or previous must appear in exactly one category or be unchanged."""
    diff = compute_diff(current, previous)
    all_keys = set(current.keys()) | set(previous.keys())
    categorized = set(diff.added) | set(diff.updated) | set(diff.deleted)

    # Keys in both with same metadata are "unchanged" and not categorized
    unchanged = set()
    for key in set(current.keys()) & set(previous.keys()):
        curr = current[key]
        prev = previous[key]
        if (
            curr.size == prev.size
            and curr.last_modified == prev.last_modified
            and curr.e_tag == prev.e_tag
        ):
            unchanged.add(key)

    assert categorized | unchanged == all_keys
