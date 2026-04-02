# SID-Based Permission Filtering Architecture

**🌐 Language:** [日本語](../SID-Filtering-Architecture.md) | **English** | [한국어](../ko/SID-Filtering-Architecture.md) | [简体中文](../zh-CN/SID-Filtering-Architecture.md) | [繁體中文](../zh-TW/SID-Filtering-Architecture.md) | [Français](../fr/SID-Filtering-Architecture.md) | [Deutsch](../de/SID-Filtering-Architecture.md) | [Español](../es/SID-Filtering-Architecture.md)

## Overview

This system leverages NTFS ACL SIDs (Security Identifiers) to filter RAG search results on a per-user basis. Access permission information from the FSx for NetApp ONTAP file system is stored as metadata in the vector database, and permission checks are performed in real time during searches.

---

## Overall Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Data Ingestion Flow                              │
│                                                                         │
│  ┌──────────────┐    ┌─────────────────┐    ┌───────────────────────┐  │
│  │ FSx for ONTAP│    │ S3 Access Point │    │ Bedrock Knowledge Base│  │
│  │              │───▶│                 │───▶│                       │  │
│  │ NTFS ACL     │    │ Exposes FSx     │    │ ・Vectorized with     │  │
│  │ File         │    │ volumes via     │    │   Titan Embed v2      │  │
│  │ permissions  │    │ S3-compatible   │    │ ・Metadata (SID) also │  │
│  │ + .metadata  │    │ interface       │    │   stored              │  │
│  │   .json      │    └─────────────────┘    └───────────┬───────────┘  │
│  └──────────────┘                                       │              │
│                                                         ▼              │
│                                          ┌──────────────────────────┐  │
│                                          │ Vector Store             │  │
│                                          │ (Selected by             │  │
│                                          │  vectorStoreType)        │  │
│                                          │ ・S3 Vectors (default)   │  │
│                                          │ ・OpenSearch Serverless   │  │
│                                          │                          │  │
│                                          │ Vector data +            │  │
│                                          │ metadata (SID etc.)      │  │
│                                          │ stored                   │  │
│                                          └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        Search & Filtering Flow                          │
│                                                                         │
│  ┌──────────┐    ┌──────────────────┐    ┌──────────────────────────┐  │
│  │ User      │───▶│ Next.js          │───▶│ Bedrock KB               │  │
│  │ (Browser) │    │ KB Retrieve API  │    │ Retrieve API             │  │
│  └──────────┘    └────────┬─────────┘    └────────────┬─────────────┘  │
│                           │                           │                │
│                           │                           ▼                │
│                           │              ┌──────────────────────────┐  │
│                           │              │ Search Results            │  │
│                           │              │ ・Citation (source doc)   │  │
│                           │              │   └─ metadata             │  │
│                           │              │       └─ allowed_group_sids│ │
│                           │              └────────────┬─────────────┘  │
│                           │                           │                │
│                           ▼                           ▼                │
│              ┌──────────────────┐    ┌──────────────────────────────┐  │
│              │ DynamoDB         │    │ SID Filtering Process        │  │
│              │ user-access      │───▶│                              │  │
│              │ ・userId          │    │ User SID ∩ Document SID     │  │
│              │ ・userSID         │    │ = Match → Access allowed    │  │
│              │ ・groupSIDs       │    │ ≠ No match → Access denied  │  │
│              └──────────────────┘    └──────────────┬───────────────┘  │
│                                                     │                │
│                                                     ▼                │
│                                      ┌──────────────────────────────┐  │
│                                      │ Converse API                 │  │
│                                      │ ・Generate response using    │  │
│                                      │   only allowed documents     │  │
│                                      │ ・Return filtered citations  │  │
│                                      └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

> **About S3 Access Point**: The S3 Access Point for FSx for ONTAP directly exposes files on FSx volumes via an S3-compatible interface. There is no need to copy files to a separate S3 bucket. Bedrock KB references the S3 AP alias as a data source and directly ingests documents (including `.metadata.json`) from the FSx volume.

---

## Detailed SID Filtering Logic

### Step 1: Retrieving User SIDs

When a user submits a question in the chat, the KB Retrieve API retrieves the user's SID information from the DynamoDB `user-access` table.

```
DynamoDB user-access table
┌──────────────────────────────────────────────────────────────┐
│ userId (PK)          │ userSID              │ groupSIDs      │
├──────────────────────┼──────────────────────┼────────────────┤
│ {Cognito sub}        │ S-1-5-21-...-500     │ [S-1-5-21-...-512, │
│ (admin@example.com)  │ (Administrator)      │  S-1-1-0]      │
├──────────────────────┼──────────────────────┼────────────────┤
│ {Cognito sub}        │ S-1-5-21-...-1001    │ [S-1-1-0]      │
│ (user@example.com)   │ (Regular User)       │                │
└──────────────────────┴──────────────────────┴────────────────┘

→ User's full SID list = [userSID] + groupSIDs
   admin: [S-1-5-21-...-500, S-1-5-21-...-512, S-1-1-0]
   user:  [S-1-5-21-...-1001, S-1-1-0]
```

### Step 2: Retrieving Document Metadata

Each citation in the Bedrock KB search results contains metadata ingested from the `.metadata.json` files on S3.

> **How `.metadata.json` is created**: This system includes automatic NTFS ACL retrieval implemented by the AD Sync Lambda (`lambda/agent-core-ad-sync/`) and the FSx permission service (`lambda/permissions/fsx-permission-service.ts`). In the demo environment, sample data is manually placed for verification purposes. For details, see the "Metadata Structure" section in [docs/embedding-server-design.md](embedding-server-design.md).

```
Document Metadata (.metadata.json)
┌──────────────────────────┬──────────────────────────────────────┐
│ Document                 │ allowed_group_sids                   │
├──────────────────────────┼──────────────────────────────────────┤
│ public/product-catalog   │ ["S-1-1-0"]                          │
│                          │  └─ Everyone (all users)             │
├──────────────────────────┼──────────────────────────────────────┤
│ public/company-overview  │ ["S-1-1-0"]                          │
│                          │  └─ Everyone (all users)             │
├──────────────────────────┼──────────────────────────────────────┤
│ confidential/financial   │ ["S-1-5-21-...-512"]                 │
│                          │  └─ Domain Admins only               │
├──────────────────────────┼──────────────────────────────────────┤
│ confidential/hr-policy   │ ["S-1-5-21-...-512"]                 │
│                          │  └─ Domain Admins only               │
├──────────────────────────┼──────────────────────────────────────┤
│ restricted/project-plan  │ ["S-1-5-21-...-1100",                │
│                          │  "S-1-5-21-...-512"]                 │
│                          │  └─ Engineering + Domain Admins      │
└──────────────────────────┴──────────────────────────────────────┘
```

### Step 3: SID Matching

The user's SID list is compared against the document's `allowed_group_sids`.

```
Matching rule: User SID ∩ Document SID ≠ ∅ → ALLOW

■ Admin user (admin@example.com)
  User SIDs: [S-1-5-21-...-500, S-1-5-21-...-512, S-1-1-0]

  public/product-catalog    → S-1-1-0 ∈ User SIDs → ✅ ALLOW
  public/company-overview   → S-1-1-0 ∈ User SIDs → ✅ ALLOW
  confidential/financial    → S-1-5-21-...-512 ∈ User SIDs → ✅ ALLOW
  confidential/hr-policy    → S-1-5-21-...-512 ∈ User SIDs → ✅ ALLOW
  restricted/project-plan   → S-1-5-21-...-512 ∈ User SIDs → ✅ ALLOW

■ Regular user (user@example.com)
  User SIDs: [S-1-5-21-...-1001, S-1-1-0]

  public/product-catalog    → S-1-1-0 ∈ User SIDs → ✅ ALLOW
  public/company-overview   → S-1-1-0 ∈ User SIDs → ✅ ALLOW
  confidential/financial    → S-1-5-21-...-512 ∉ User SIDs → ❌ DENY
  confidential/hr-policy    → S-1-5-21-...-512 ∉ User SIDs → ❌ DENY
  restricted/project-plan   → {-1100, -512} ∩ {-1001, S-1-1-0} = ∅ → ❌ DENY
```

### Step 4: Fail-Safe Fallback

When SID information cannot be retrieved (no record in DynamoDB, connection error, etc.), the system falls back to the safe side and denies access to all documents.

```
Flow when SID retrieval fails:
  DynamoDB → Error or no record
    → allUserSIDs = [] (empty)
    → All documents DENY
    → filterMethod: "DENY_ALL_FALLBACK"
```

---

## About SID (Security Identifier)

### SID Structure

```
S-1-5-21-{DomainID1}-{DomainID2}-{DomainID3}-{RID}
│ │ │  │  └─────────────────────────────────────────┘  └─┘
│ │ │  │              Domain Identifier                Relative ID
│ │ │  └─ Sub-authority count
│ │ └─ Identifier Authority (5 = NT Authority)
│ └─ Revision
└─ SID Prefix
```

### Key SIDs

| SID | Name | Description |
|-----|------|-------------|
| `S-1-1-0` | Everyone | All users |
| `S-1-5-21-...-500` | Administrator | Domain administrator |
| `S-1-5-21-...-512` | Domain Admins | Domain administrators group |
| `S-1-5-21-...-1001` | User | Regular user |
| `S-1-5-21-...-1100` | Engineering | Engineering group |

### SID in FSx for ONTAP

FSx for ONTAP supports Windows ACLs on NTFS security style volumes. Each file/directory has an ACL (Access Control List) configured, and access permissions are managed on a SID basis.

When accessing files on FSx through S3 Access Point, NTFS ACL information is exposed as metadata. This system ingests this ACL information (SIDs) as Bedrock KB metadata and uses it for filtering during searches.

---

## Detailed Data Flow

### 1. During Data Ingestion (Embedding)

```
FSx for ONTAP                    S3 Access Point              Bedrock KB
┌─────────────┐                ┌──────────────┐             ┌──────────────┐
│ file.md     │  S3 Access     │ S3-compatible│  KB Sync    │ Vectorization│
│ NTFS ACL:   │──Point──▶     │ interface    │────────▶   │ + metadata   │
│  Admin:Full │                │              │             │ storage      │
│  Users:Read │                │ file.md      │             │              │
│             │                │ file.md      │             └──────┬───────┘
│ file.md     │                │ .metadata    │                    │
│ .metadata   │                │ .json        │                    ▼
│ .json       │                │ (Directly    │             ┌──────────────┐
│ {           │                │  exposed     │             │ OpenSearch   │
│  "allowed_  │                │  from FSx)   │             │ Serverless   │
│   group_sids│                └──────────────┘             │ ・vector     │
│  :["S-1-.."]│                                             │ ・text_chunk │
│ }           │                                             │ ・metadata   │
└─────────────┘                                             │   (SID info) │
                                                            └──────────────┘
```

> S3 Access Point directly exposes FSx volume files via an S3-compatible interface, so copying to an S3 bucket is not required.

### Data Ingestion Path Options

This system provides three data ingestion paths. Since S3 Access Point is not available for FlexCache Cache volumes as of March 2026, a fallback configuration is required.

| # | Path | Method | CDK Activation | Use Case |
|---|------|--------|----------------|----------|
| 1 | Main | FSx ONTAP Volume → S3 Access Point → Bedrock KB | `post-deploy-setup.sh` | Standard volumes (S3 AP supported) |
| 2 | Fallback | Manual upload to S3 bucket → Bedrock KB | `upload-demo-data.sh` | FlexCache volumes and other S3 AP unsupported cases |
| 3 | Alternative | CIFS mount → Embedding server → Direct write to AOSS | `-c enableEmbeddingServer=true` | FlexCache volumes + cases requiring direct AOSS control |

The S3 bucket for Path 2 (`${prefix}-kb-data-${ACCOUNT_ID}`) is always created by StorageStack. When S3 AP is not available, you can upload documents + `.metadata.json` to this bucket and configure it as a KB data source to enable SID filtering.

### 2. During Search (Two-Stage Method: Retrieve + Converse)

```
User              Next.js API           DynamoDB          Bedrock KB       Converse API
  │                  │                    │                  │                │
  │ Submit question  │                    │                  │                │
  │─────────────────▶│                    │                  │                │
  │                  │ Get SIDs           │                  │                │
  │                  │───────────────────▶│                  │                │
  │                  │◀───────────────────│                  │                │
  │                  │ userSID + groupSIDs│                  │                │
  │                  │                    │                  │                │
  │                  │ Retrieve API (vector search + metadata)│                │
  │                  │─────────────────────────────────────▶│                │
  │                  │◀─────────────────────────────────────│                │
  │                  │ Search results + metadata (SID)      │                │
  │                  │                    │                  │                │
  │                  │ SID Matching       │                  │                │
  │                  │ (User SID ∩        │                  │                │
  │                  │  Document SID)     │                  │                │
  │                  │                    │                  │                │
  │                  │ Generate response using only allowed documents         │
  │                  │──────────────────────────────────────────────────────▶│
  │                  │◀──────────────────────────────────────────────────────│
  │                  │                    │                  │                │
  │ Filtered results │                    │                  │                │
  │◀─────────────────│                    │                  │                │
```

> Reason for using Retrieve API instead of RetrieveAndGenerate API: The RetrieveAndGenerate API does not include `allowed_group_sids` from `.metadata.json` in the citation's `metadata` field, making SID filtering impossible. Since the Retrieve API correctly returns metadata, the two-stage method (Retrieve → SID filter → Converse) is adopted.

### 3. During Agent Mode Search (Hybrid Method)

In Agent mode, a hybrid method is adopted to achieve permission-aware RAG. Since the InvokeAgent API does not allow for SID filtering on the application side, this is realized through a combination of KB Retrieve API + SID filtering + Converse API (with Agent system prompt).

```
User              Next.js API           Bedrock KB          DynamoDB         Converse API
  │                  │                    │                    │                │
  │ Submit question  │                    │                    │                │
  │─────────────────▶│                    │                    │                │
  │                  │ Retrieve API       │                    │                │
  │                  │───────────────────▶│                    │                │
  │                  │◀───────────────────│                    │                │
  │                  │ Results + metadata │                    │                │
  │                  │                    │                    │                │
  │                  │ Get SIDs                                │                │
  │                  │────────────────────────────────────────▶│                │
  │                  │◀────────────────────────────────────────│                │
  │                  │                    │                    │                │
  │                  │ SID Filtering      │                    │                │
  │                  │ (Same as KB mode)  │                    │                │
  │                  │                    │                    │                │
  │                  │ Generate response with allowed docs + Agent system prompt│
  │                  │─────────────────────────────────────────────────────────▶│
  │                  │◀─────────────────────────────────────────────────────────│
  │                  │                    │                    │                │
  │ Agent response   │                    │                    │                │
  │ + Citations      │                    │                    │                │
  │◀─────────────────│                    │                    │                │
```

> The Bedrock Agent InvokeAgent API is also available, but since the InvokeAgent API does not allow for SID filtering on the application side, it is used only as a fallback. The hybrid method is the default to guarantee permission-aware behavior.

---

## API Response Example

### Filtering Log (filterLog)

```json
{
  "totalDocuments": 5,
  "allowedDocuments": 2,
  "deniedDocuments": 3,
  "userId": "4704eaa8-3041-70d9-672b-e4fbb65bec40",
  "userSIDs": [
    "S-1-5-21-0000000000-0000000000-0000000000-1001",
    "S-1-1-0"
  ],
  "filterMethod": "SID_MATCHING",
  "details": [
    {
      "fileName": "product-catalog.md",
      "documentSIDs": ["S-1-1-0"],
      "matched": true,
      "matchedSID": "S-1-1-0"
    },
    {
      "fileName": "financial-report.md",
      "documentSIDs": ["S-1-5-21-0000000000-0000000000-0000000000-512"],
      "matched": false
    }
  ]
}
```

---

## Security Design

### Fail-Safe Fallback Principle

This system follows the "Fail-Closed" principle, denying access to all documents when permission checks fail.

| Situation | Behavior |
|-----------|----------|
| DynamoDB connection error | Deny all documents |
| No user SID record | Deny all documents |
| No SID information in metadata | Deny the corresponding document |
| No SID match | Deny the corresponding document |
| SID match found | Allow the corresponding document |

### Permission Cache

Filtering results are cached in the DynamoDB `permission-cache` table to speed up repeated checks for the same user and document combination (TTL: 5 minutes).
