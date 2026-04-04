# Embedding Server Design & Implementation Document

**🌐 Language:** [日本語](../embedding-server-design.md) | **English** | [한국어](../ko/embedding-server-design.md) | [简体中文](../zh-CN/embedding-server-design.md) | [繁體中文](../zh-TW/embedding-server-design.md) | [Français](../fr/embedding-server-design.md) | [Deutsch](../de/embedding-server-design.md) | [Español](../es/embedding-server-design.md)

**Created**: 2026-03-26  
**Audience**: Developers & Operators  
**Source Code**: `docker/embed/`

---

## Overview

### Vector Store & Embedding Server

| Configuration | Embedding Server | Description |
|--------------|-----------------|-------------|
| **S3 Vectors** (default) | **Not needed** | Bedrock KB auto-manages via S3 Access Point |
| **OpenSearch Serverless** | **Optional** | Alternative when S3 AP unavailable |

> **S3 Vectors (default): this document is for reference only.** Bedrock KB Ingestion Job handles all processing automatically.

This server reads documents on FSx ONTAP via CIFS/SMB mount, vectorizes them with Amazon Bedrock Titan Embed Text v2, and indexes them into OpenSearch Serverless (AOSS).

> **Note**: The Embedding server is only available when configured with AOSS (`vectorStoreType=opensearch-serverless`). With the S3 Vectors configuration (default), Bedrock KB automatically manages Embedding, so the Embedding server is not needed.

It is used as an alternative path (Option B) when the Bedrock KB S3 data source (Option A) or S3 Access Point (Option C) cannot be used.

---

## Architecture

```
FSx ONTAP Volume (/data)
  │ CIFS/SMB Mount
  ▼
EC2 (m5.large) /tmp/data
  │
  ▼
Docker Container (embed-app)
  ├── 1. File scan (recursive, .md/.txt/.html, etc.)
  ├── 2. Read SID information from .metadata.json
  ├── 3. Text chunk splitting (1000 chars, 200 char overlap)
  ├── 4. Vectorize with Bedrock Titan Embed v2 (1024 dimensions)
  └── 5. Index into AOSS (Bedrock KB compatible format)
          │
          ▼
      OpenSearch Serverless
      (bedrock-knowledge-base-default-index)
```

---

## Source Code Structure

```
docker/embed/
├── src/
│   ├── index.ts       # Main processing (scan → chunk → Embedding → index)
│   └── oss-client.ts  # AOSS SigV4 signing client (IMDS auth support)
├── Dockerfile         # node:22-slim + cifs-utils
├── buildspec.yml      # CodeBuild build definition
├── package.json       # AWS SDK v3, chokidar, dotenv
└── tsconfig.json
```

---

## Execution Modes

| Mode | Environment Variable | Behavior |
|------|---------------------|----------|
| Batch mode | `ENV_WATCH_MODE=false` (default) | Processes all files once and exits |
| Watch mode | `ENV_WATCH_MODE=true` | Detects file changes with chokidar and processes automatically |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENV_REGION` | `ap-northeast-1` | AWS region |
| `ENV_DATA_DIR` | `/opt/netapp/ai/data` | CIFS-mounted data directory |
| `ENV_DB_DIR` | `/opt/netapp/ai/db` | Storage location for processed file records |
| `ENV_EMBEDDING_MODEL_ID` | `amazon.titan-embed-text-v2:0` | Embedding model |
| `ENV_INDEX_NAME` | `bedrock-knowledge-base-default-index` | AOSS index name |
| `ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME` | (required) | AOSS collection name |
| `ENV_WATCH_MODE` | `false` | Enable watch mode |
| `ENV_AUTO_METADATA` | `false` | Auto-generate .metadata.json via ONTAP REST API |
| `ENV_ONTAP_MGMT_IP` | (empty) | ONTAP management endpoint IP |
| `ENV_ONTAP_SVM_UUID` | (empty) | SVM UUID |
| `ENV_ONTAP_USERNAME` | `fsxadmin` | ONTAP administrator username |
| `ENV_ONTAP_PASSWORD` | (empty) | ONTAP administrator password |

---

## Processing Flow

### Batch Mode

```
1. Initialize AOSS client (retrieve collection endpoint)
2. Load processed.json (for differential processing)
3. Recursively scan DATA_DIR (.md, .txt, .html, .csv, .json, .xml)
4. For each file:
   a. Skip if mtime matches processed.json
   b. Use .metadata.json if it exists
   c. If .metadata.json does not exist and ENV_AUTO_METADATA=true:
      - Retrieve ACL via ONTAP REST API (`GET /api/protocols/file-security/permissions/{SVM_UUID}/{PATH}`)
      - Extract SID from ACL and auto-generate/write .metadata.json
   d. Read text → split into chunks (1000 chars, 200 char overlap)
   e. Vectorize each chunk with Bedrock Titan Embed v2
   f. Index into AOSS (Bedrock KB compatible format)
   g. Update processed.json
5. Output processing summary and exit
```

### Watch Mode

```
1-5. Same as batch mode (initial scan)
6. Start file watching with chokidar
   - awaitWriteFinish: 2 seconds (wait for write completion)
7. File add/change events → add to queue
8. Process sequentially from queue (prevent parallel execution)
   - processFile() → update processed.json
9. Wait in infinite loop
```

---

## Differential Processing Mechanism

File paths and modification times (mtime) are recorded in `processed.json`.

```json
{
  "public/company-overview.md": {
    "mtime": "2026-03-24T23:55:50.000Z",
    "indexedAt": "2026-03-25T05:30:00.000Z"
  }
}
```

- Skip if the file's mtime has not changed
- Reprocess if the file has been updated (overwrite index)
- Delete `processed.json` to reprocess all files

### Differences from Previous Versions

| Item | Previous Version | Current Version |
|------|-----------------|-----------------|
| Differential management | SQLite (drizzle-orm + better-sqlite3) | JSON file (processed.json) |
| File identification | inode number (files.ino) | File path + mtime |
| Bulk file simultaneous upload | UNIQUE constraint failed | ✅ Safely processed via sequential queue |
| Dependencies | drizzle-orm, better-sqlite3 | None (standard fs) |

---

## AOSS Index Format

Only 3 Bedrock KB compatible fields are written.

```json
{
  "bedrock-knowledge-base-default-vector": [0.123, -0.456, ...],  // 1024 dimensions
  "AMAZON_BEDROCK_TEXT_CHUNK": "Document text chunk",
  "AMAZON_BEDROCK_METADATA": "{\"source\":\"public/company-overview.md\",\"allowed_group_sids\":[\"S-1-1-0\"],\"access_level\":\"public\"}"
}
```

### Important: AOSS Index Schema Compatibility

The AOSS index is created with `dynamic: false`. This means:
- Index mapping does not change even if fields other than the above 3 are written
- Bedrock KB sync does not cause "storage configuration invalid" errors
- Metadata (SID information, etc.) is stored as a JSON string within the `AMAZON_BEDROCK_METADATA` field

### Metadata Structure

Each document requires a corresponding `.metadata.json` file. By including NTFS ACL SID information in this file, access control during RAG search is achieved.

#### How to Obtain SID Information for `.metadata.json`

This system has a mechanism to automatically retrieve SIDs from NTFS ACLs.

| Component | Implementation File | Function |
|-----------|-------------------|----------|
| AD Sync Lambda | `lambda/agent-core-ad-sync/index.ts` | Executes PowerShell via SSM to retrieve AD user SID information and store it in DynamoDB |
| FSx Permission Service | `lambda/permissions/fsx-permission-service.ts` | Executes Get-Acl via SSM to retrieve NTFS ACL (SID) for files/directories |
| AD Sync Configuration | `types/agentcore-config.ts` (`AdSyncConfig`) | Settings for AD sync enablement, cache TTL, SSM timeout, etc. |

These are future extension options. In the current demo stack configuration (`lib/stacks/demo/`), sample `.metadata.json` files are manually placed for verification purposes.

#### SID Auto-Retrieval Processing Flow

```
1. AD Sync Lambda (User SID retrieval)
   SSM → Windows EC2 → PowerShell (Get-ADUser) → Retrieve SID → Store in DynamoDB user-access

2. FSx Permission Service (File ACL retrieval)
   SSM → Windows EC2 → PowerShell (Get-Acl) → Retrieve NTFS ACL → Extract SID → Can generate .metadata.json
```

#### Simplified Setup for Demo Environment

The demo stack does not use the above automation and sets up SID data through the following manual steps:

- `.metadata.json`: Manually placed samples under `demo-data/documents/`
- DynamoDB user-access: Manually register email-to-SID mappings using `demo-data/scripts/setup-user-access.sh`

#### Automation Options for Production Environment

| Method | Description |
|--------|-------------|
| AD Sync Lambda | Automatically retrieves AD user SIDs via SSM and stores them in DynamoDB (implemented) |
| FSx Permission Service | Retrieves NTFS ACL via Get-Acl through SSM (implemented) |
| ONTAP REST API | Directly retrieves ACL via FSx ONTAP management endpoint (implemented: `ENV_AUTO_METADATA=true`) |
| S3 Access Point | NTFS ACL is automatically applied when accessing files via S3 AP (CDK supported: `useS3AccessPoint=true`) |

#### When Using S3 Access Point (Option C)

When Bedrock KB ingests documents via S3 Access Point, NTFS ACL is automatically applied through the S3 Access Point's `FileSystemIdentity` (WINDOWS type). However, whether the metadata returned by the Bedrock KB Retrieve API includes ACL information depends on the S3 Access Point implementation. At this time, SID management via `.metadata.json` is the reliable method.

#### `.metadata.json` Format

```json
// .metadata.json
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-...-512"],
    "access_level": "confidential",
    "department": "finance"
  }
}

// → Value stored in AMAZON_BEDROCK_METADATA
{
  "source": "confidential/financial-report.md",
  "x-amz-bedrock-kb-source-uri": "s3://fsx-ontap/confidential/financial-report.md",
  "allowed_group_sids": ["S-1-5-21-...-512"],
  "access_level": "confidential",
  "department": "finance"
}
```

---

## AOSS Authentication (SigV4 Signing)

`oss-client.ts` accesses AOSS using AWS SigV4 signing.

- Automatically retrieves credentials from EC2 instance profile (IMDS)
- Uses defaultProvider from `@aws-sdk/credential-provider-node`
- Credentials are automatically refreshed 5 minutes before expiration
- The service name for AOSS is `aoss`

---

## Bulk File Simultaneous Upload Handling

When 20 or more files are uploaded simultaneously in watch mode:

1. Wait for write completion with chokidar's `awaitWriteFinish` (2 seconds)
2. Each file event is added to a queue
3. Process one file at a time from the queue (exclusive control via `processing` flag)
4. 200ms wait after Embedding each chunk (Bedrock API rate limit countermeasure)
5. Update `processed.json` after processing is complete

This ensures:
- No Bedrock API rate limit violations
- No concurrent writes to `processed.json`
- If the process stops during processing, files already recorded in `processed.json` are not reprocessed

---

## CDK Stack

`DemoEmbeddingStack` (`lib/stacks/demo/demo-embedding-stack.ts`) creates the following:

| Resource | Description |
|----------|-------------|
| EC2 Instance (m5.large) | IMDSv2 enforced, SSM enabled |
| ECR Repository | For Embedding container images |
| IAM Role | SSM, FSx, AOSS, Bedrock, ECR, Secrets Manager |
| Security Group | Communication allowed with FSx SG + AD SG |
| UserData | Automatic CIFS mount + Docker auto-start |

### Enabling

```bash
npx cdk deploy <PREFIX>-Embedding \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableEmbeddingServer=true \
  -c embeddingAdSecretArn=<SECRETS_MANAGER_ARN> \
  --require-approval never
```

---

## Troubleshooting

| Symptom | Cause | Resolution |
|---------|-------|------------|
| AOSS 403 Forbidden | EC2 role not added to data access policy | Add Embedding EC2 role to AOSS policy |
| Bedrock ThrottlingException | API rate limit exceeded | Increase wait time between chunks (200ms → 500ms) |
| CIFS mount failure | SVM not joined to AD or CIFS share not created | Verify AD join + create CIFS share via ONTAP REST API |
| processed.json corrupted | Process interrupted | Delete `processed.json` and re-run |
| KB sync error (storage config invalid) | KB-incompatible fields exist in AOSS index | Delete index → recreate → recreate data source → sync |
| All documents DENIED by SID filtering | Documents via Embedding server have no metadata | Verify `.metadata.json` exists and `allowed_group_sids` is set |

---

## Related Documents

| Document | Content |
|----------|---------|
| [README.md](../../README.en.md) | Deployment steps (Option B) |
| [docs/implementation-overview.md](implementation-overview.md) | Implementation overview (Item 5: Embedding Server) |
| [docs/ui-specification.md](ui-specification.md) | UI specification (directory display) |
| [docs/demo-environment-guide.md](demo-environment-guide.md) | Operation procedures for verification environment |
