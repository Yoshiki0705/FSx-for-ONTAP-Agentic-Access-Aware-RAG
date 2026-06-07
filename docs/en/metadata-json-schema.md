# .metadata.json Formal Schema Specification

**🌐 Language:** [日本語](../metadata-json-schema.md) | **English**

**Created**: 2026-06-08  
**Status**: Formal Specification  
**Audience**: Developers, Data Engineers, Partners

---

## Overview

Formal specification for the metadata file (`.metadata.json`) that attaches permission information to documents on FSx for ONTAP. Works with Bedrock Knowledge Base metadata filtering to enable Permission-Aware RAG.

---

## File Naming Convention

```
Target document:  {path}/{filename}.{ext}
Metadata file:    {path}/{filename}.{ext}.metadata.json
```

**Example:**
```
reports/esg/2026-06-06/report-abc.json
reports/esg/2026-06-06/report-abc.json.metadata.json  ← metadata
```

---

## Schema Definition

```json
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-1-0", "S-1-5-21-xxx-512"],
    "category": "esg",
    "owner": "sustainability-team",
    "classification": "internal"
  }
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `metadataAttributes` | Object | ✅ | Container for metadata attributes |
| `metadataAttributes.allowed_group_sids` | `string[]` (formal) or `string` (backward-compat) | ✅ | List of allowed access SIDs |
| `metadataAttributes.category` | `string` | ❌ | Document category |
| `metadataAttributes.owner` | `string` | ❌ | Owner (team/department) |
| `metadataAttributes.classification` | `string` enum | ❌ | Sensitivity level |

### `allowed_group_sids` Formats

| Format | Example | Status |
|--------|---------|--------|
| **Array (formal)** | `["S-1-1-0", "S-1-5-21-xxx-512"]` | ✅ Recommended |
| Comma-separated | `"S-1-1-0,S-1-5-21-xxx-512"` | ⚠️ Backward-compatible (deprecated) |
| JSON string | `"[\"S-1-1-0\"]"` | ⚠️ Backward-compatible (deprecated) |
| Single value | `"S-1-1-0"` | ⚠️ Backward-compatible |

> **Important**: Always use **array format** when creating new metadata files.

### `classification` Valid Values

| Value | Description |
|-------|-------------|
| `public` | Public information (accessible by all users) |
| `internal` | Internal use only |
| `confidential` | Confidential (specific groups only) |
| `restricted` | Top secret (individual approval required) |

---

## SID Format

Standard Windows Security Identifier (SID) format:

```
S-{revision}-{authority}-{sub1}-{sub2}-...-{RID}
```

| SID | Meaning |
|-----|---------|
| `S-1-1-0` | Everyone |
| `S-1-5-21-xxx-512` | Domain Admins |
| `S-1-5-21-xxx-513` | Domain Users |
| `S-1-5-32-544` | Administrators (Builtin) |

---

## Fail-Closed Principle

| State | Behavior |
|-------|----------|
| `.metadata.json` does not exist | **Access Denied** (Fail-Closed) |
| `allowed_group_sids` is empty array | **Access Denied** |
| `allowed_group_sids` has no match with user SIDs | **Access Denied** |
| `allowed_group_sids` has a match with user SIDs | **Access Granted** |

---

## Validation Rules

1. `metadataAttributes` is required
2. `allowed_group_sids` is required and must not be empty
3. Each SID must start with `S-` in valid format (warning only, non-blocking)
4. Comma-separated format emits a warning recommending migration to array format

---

## Creation Tool

```bash
# Create metadata in formal format using script
python3 -c "
import json
metadata = {
    'metadataAttributes': {
        'allowed_group_sids': ['S-1-1-0', 'S-1-5-21-xxx-512'],
        'category': 'esg',
        'classification': 'internal'
    }
}
print(json.dumps(metadata, indent=2))
" > document.json.metadata.json
```

---

## Related Documents

- [Permission Matrix Tests](../../tests/permission-matrix/) — 31 permission verification scenarios
- [KB Auto-Sync Error Handling](../kb-auto-sync-error-handling.md) — Ingestion with metadata documents
- [Production Readiness Checklist](../production-readiness-checklist.md) — Metadata management operational requirements
