"""
Pure logic for metadata file generation.

Separated from handler for testability (Property-Based Testing target).
"""

import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional


def build_metadata_path(document_path: str) -> str:
    """
    Generate the metadata file path for a given document.

    The metadata file is always placed at {document_path}.metadata.json,
    in the same prefix (directory) as the original document.

    Args:
        document_path: S3 object key of the original document

    Returns:
        S3 object key for the .metadata.json file
    """
    return f"{document_path}.metadata.json"


def build_metadata_json(
    allowed_sids: Optional[List[str]] = None,
    allowed_uids: Optional[List[str]] = None,
    allowed_gids: Optional[List[str]] = None,
    uploaded_by: str = '',
    uploaded_at: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Build the permission metadata JSON object.

    The output conforms to the existing permission-filtering RAG pipeline schema:
    - allowed_sids: string array
    - allowed_uids: string array
    - allowed_gids: string array
    - source: string (always "transfer-family")
    - uploaded_by: string (SFTP username)
    - uploaded_at: ISO 8601 string

    Args:
        allowed_sids: List of allowed Security Identifiers
        allowed_uids: List of allowed User IDs
        allowed_gids: List of allowed Group IDs
        uploaded_by: SFTP username who uploaded the file
        uploaded_at: ISO 8601 timestamp (defaults to current time)

    Returns:
        Dict conforming to the permission metadata schema
    """
    if uploaded_at is None:
        uploaded_at = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    return {
        'allowed_sids': allowed_sids or [],
        'allowed_uids': allowed_uids or [],
        'allowed_gids': allowed_gids or [],
        'source': 'transfer-family',
        'uploaded_by': uploaded_by,
        'uploaded_at': uploaded_at,
    }


def should_generate_metadata(file_key: str, existing_metadata_keys: set) -> bool:
    """
    Determine if metadata should be generated for a file.

    Metadata is generated only when:
    - The file is new (caller responsibility to check)
    - No corresponding .metadata.json exists

    Args:
        file_key: The S3 object key of the document
        existing_metadata_keys: Set of all known .metadata.json keys

    Returns:
        True if metadata should be generated
    """
    metadata_key = build_metadata_path(file_key)
    return metadata_key not in existing_metadata_keys
