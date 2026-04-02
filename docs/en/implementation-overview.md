# Permission-Aware RAG System — Implementation Overview

**🌐 Language:** [日本語](../implementation-overview.md) | **English** | [한국어](../ko/implementation-overview.md) | [简体中文](../zh-CN/implementation-overview.md) | [繁體中文](../zh-TW/implementation-overview.md) | [Français](../fr/implementation-overview.md) | [Deutsch](../de/implementation-overview.md) | [Español](../es/implementation-overview.md)

**Created**: 2026-03-25  
**Version**: 3.3.0

---

## Overview

This system is a RAG (Retrieval-Augmented Generation) chatbot system that combines Amazon FSx for NetApp ONTAP with Amazon Bedrock, providing file access permission (SID)-based filtering. It manages NTFS ACL information per user as metadata and filters search results in real time, enabling secure document retrieval and AI-powered answer generation.

All infrastructure is defined using AWS CDK (TypeScript) and can be deployed at once with `npx cdk deploy --all`.

---

## 1. Chatbot Application — Next.js RAG Chatbot on AWS Lambda

### Implementation Details

A RAG chatbot application built with Next.js 15 (App Router) is executed serverlessly via AWS Lambda Web Adapter.

### Architecture

```
Browser → CloudFront → Lambda Function URL → Lambda Web Adapter → Next.js (standalone)
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, standalone output) |
| UI | React 18 + Tailwind CSS |
| Authentication | Amazon Cognito (JWT) |
| AI/RAG | Amazon Bedrock Knowledge Base Retrieve API + Converse API |
| Runtime | Lambda Web Adapter (Rust) + Docker Container |
| CDN | Amazon CloudFront |

### Key Features

- **RAG Search**: Performs vector search via Bedrock Knowledge Base and generates answers referencing relevant documents
- **SID Filtering**: Filters search results based on user SID information (detailed in Section 7)
- **KB/Agent Mode Toggle**: Switch between KB mode (document search) and Agent mode (multi-step reasoning) via header toggle
- **Card-Based Task-Oriented UI**: Before starting a chat, KB mode displays purpose-specific cards (document search, summary creation, quiz generation, etc.) and Agent mode displays workflow cards (financial analysis, project management, etc.) in a grid layout. Supports favorites management and category filtering
- **Agent Mode (InvokeAgent API)**: Achieves multi-step reasoning with SID filtering through Bedrock Agent + Permission-aware Action Group. Falls back to KB hybrid mode if Agent invocation fails
- **Multi-Language Support**: 8 languages — Japanese, English, Korean, Chinese (Simplified/Traditional), French, German, and Spanish
- **Citation Display**: Shows source information of documents used as the basis for answers
- **Cognito Authentication**: Sign-in/sign-out and session management

### CDK Stack

`DemoWebAppStack` (`lib/stacks/demo/demo-webapp-stack.ts`) creates the following:
- Lambda DockerImageFunction (ECR image, 1024MB memory, 30-second timeout)
- Lambda Function URL (IAM authentication)
- CloudFront Distribution (OAC + Geo restriction + WAF integration)
- S3 bucket for CloudFront access logs

---

## 2. AWS WAF — Protection via IP and Geo Information

### Implementation Details

A WAFv2 WebACL for CloudFront is deployed in `us-east-1`, protecting the application with multiple security rules.

### WAF Rule Configuration (by Priority)

| Priority | Rule Name | Type | Description |
|----------|-----------|------|-------------|
| 100 | RateLimit | Custom | Blocks when exceeding 3,000 requests per IP in 5 minutes |
| 200 | AWSIPReputationList | AWS Managed | Blocks malicious IPs from botnets, DDoS sources, etc. |
| 300 | AWSCommonRuleSet | AWS Managed | OWASP Top 10 compliant (XSS, LFI, RFI, etc.). Some rules excluded for RAG compatibility |
| 400 | AWSKnownBadInputs | AWS Managed | Blocks requests exploiting known vulnerabilities such as Log4j |
| 500 | AWSSQLiRuleSet | AWS Managed | Detects and blocks SQL injection attack patterns |
| 600 | IPAllowList | Custom (optional) | Active only when `allowedIps` is configured. Blocks IPs not on the list |

### Geo Restriction

Geographic access restrictions are applied at the CloudFront level (default: Japan only).

### CDK Stack

`DemoWafStack` (`lib/stacks/demo/demo-waf-stack.ts`) creates the following:
- WAFv2 WebACL (CLOUDFRONT scope, `us-east-1`)
- IP Set (when `allowedIps` is configured)

### Configuration

Controlled via `cdk.context.json`:
```json
{
  "allowedIps": ["203.0.113.0/24"],
  "allowedCountries": ["JP", "US"]
}
```

---

## 3. IAM Authentication — Lambda Function URL IAM Auth + CloudFront OAC

### Implementation Details

IAM authentication (`AWS_IAM`) is configured on the Lambda Function URL, and CloudFront Origin Access Control (OAC) provides origin access control via SigV4 signing.

### Authentication Flow

```
Browser
  │
  ▼
CloudFront (OAC: Automatically adds SigV4 signature)
  │
  ▼
Lambda Function URL (AuthType: AWS_IAM)
  │ → Validates SigV4 signature
  │ → Allows only requests from CloudFront
  ▼
Next.js Application
  │
  ▼
Cognito JWT Validation (Application-level authentication)
```

### Security Layers

| Layer | Technology | Purpose |
|-------|-----------|---------|
| L1: Network | CloudFront Geo Restriction | Geographic access restriction |
| L2: WAF | AWS WAF | Attack pattern detection and blocking |
| L3: Origin Auth | OAC (SigV4) | Prevents direct access bypassing CloudFront |
| L4: API Auth | Lambda Function URL IAM Auth | Access control via IAM authentication |
| L5: User Auth | Cognito JWT | User-level authentication and authorization |
| L6: Data Authz | SID Filtering | Document-level access control |

### CDK Implementation

Within `DemoWebAppStack`:
- Creates Function URL with `lambda.FunctionUrlAuthType.AWS_IAM`
- Creates OAC with `cloudfront.CfnOriginAccessControl` (`signingBehavior: 'always'`)
- Associates OAC with Distribution using L1 escape hatch

### Post-Deployment Notes

The IAM authentication + OAC configuration above is recommended for production use. However, if compatibility issues with POST requests (chat, etc.) occur in verification environments, the following manual adjustments may be required:
- Change Lambda Function URL AuthType to `NONE`
- Remove CloudFront OAC association

---

## 4. Vector Database — S3 Vectors / Amazon OpenSearch Serverless

### Implementation Details

The vector database used for RAG search can be selected via the CDK context parameter `vectorStoreType`:
- **S3 Vectors** (default): Low cost, sub-second latency. Used directly as a vector store for Bedrock KB
- **Amazon OpenSearch Serverless (AOSS)**: High performance (~10ms), high cost (~$700/month)

### Design Decision

Reasons for choosing S3 Vectors as the default:
- Cost is a few dollars per month (small scale), significantly lower compared to ~$700/month for OpenSearch Serverless
- Natively supported as a vector store for Bedrock KB
- Supports metadata filtering (`$eq`, `$in`, `$and`, `$or`)
- One-click export from S3 Vectors to AOSS is available when high performance is needed

Comparison when choosing AOSS:

| Aspect | S3 Vectors | AOSS | Aurora Serverless v2 (pgvector) |
|--------|-----------|------|------|
| Bedrock KB Integration | Native support | Native support | Custom integration required |
| Cost | A few dollars/month (pay-per-use) | ~$700/month (2 OCU minimum) | Depends on instance cost |
| Latency | Sub-second to 100ms | ~10ms | ~10ms |
| Metadata Search | Filtering operators supported | Stored in text fields | Flexible search via SQL queries |
| Operational Overhead | Serverless (auto-scaling) | Capacity management required |
| Cost | Pay-per-use based on search volume | Minimum ACU charges apply |
| Metadata Search | Stored in text fields | Flexible search via SQL queries |

### Vector Store Configuration

S3 Vectors configuration (default):
- S3 Vectors vector bucket + vector index (1024 dimensions, cosine)
- Created via custom resource Lambda (not supported by CloudFormation)

AOSS configuration (`vectorStoreType=opensearch-serverless`):

| Resource | Description |
|----------|-------------|
| Collection | `VECTORSEARCH` type, encryption policy (AWS-owned key) |
| Network Policy | Public access (for access from Bedrock KB API) |
| Data Access Policy | KB IAM role + Index creation Lambda + Embedding EC2 role |
| Index | `bedrock-knowledge-base-default-index` (knn_vector 1024 dimensions, HNSW/faiss/l2) |

### Index Mapping

```json
{
  "bedrock-knowledge-base-default-vector": { "type": "knn_vector", "dimension": 1024 },
  "AMAZON_BEDROCK_TEXT_CHUNK": { "type": "text" },
  "AMAZON_BEDROCK_METADATA": { "type": "text", "index": false }
}
```

### CDK Stack

`DemoAIStack` (`lib/stacks/demo/demo-ai-stack.ts`) creates the following:
- `vectorStoreType=s3vectors`: S3 Vectors vector bucket + index (custom resource Lambda)
- `vectorStoreType=opensearch-serverless`: OpenSearch Serverless collection + security policies (encryption, network, data access)
- Custom resource Lambda for automatic index creation
- Bedrock Knowledge Base + S3 data source

---

## 5. Embedding Server — FSx ONTAP CIFS Mount + Vector DB Write

### Implementation Details

On an EC2 instance with an Amazon FSx for NetApp ONTAP volume mounted via CIFS/SMB, a Docker container reads documents, vectorizes them, and indexes them into OpenSearch Serverless (AOSS). Not used in S3 Vectors configuration (AOSS configuration only).

### Data Ingestion Path Overview

| Path | Method | CDK Activation | Status |
|------|--------|---------------|--------|
| Option A (default) | S3 bucket → Bedrock KB S3 data source | Always enabled | ✅ |
| Option B (optional) | Embedding server (CIFS mount) → Direct vector store write | `-c enableEmbeddingServer=true` | ✅ (AOSS configuration only) |
| Option C (optional) | S3 Access Point → Bedrock KB | Manual setup after deployment | ✅ SnapMirror supported, FlexCache coming soon |

> **About S3 Access Point**: StorageStack automatically creates an S3 Access Point for the FSx ONTAP volume, but since S3 Access Point is not available for FlexCache Cache volumes (as of March 2026), it is not used as a Bedrock KB data source. The foundation is prepared so it can be utilized as Option C when FlexCache support becomes available in the future.

### Architecture

```
┌──────────────────┐     CIFS/SMB      ┌──────────────────┐
│ FSx ONTAP        │◀──────────────────│ Embedding EC2    │
│ (SVM + Volume)   │    Mount          │ (m5.large)       │
│ /data            │                   │                  │
└──────────────────┘                   │ Docker Container │
                                       │ ┌──────────────┐ │
                                       │ │ embed-app    │ │
                                       │ │ 1. Scan      │ │
                                       │ │ 2. Chunk     │ │
                                       │ │ 3. Embedding │ │
                                       │ │ 4. Index     │ │
                                       │ └──────┬───────┘ │
                                       └────────┼─────────┘
                              ┌─────────────────┼─────────────────┐
                              ▼                                   ▼
                    ┌──────────────────┐              ┌──────────────────┐
                    │ Bedrock          │              │ OpenSearch       │
                    │ Titan Embed v2   │              │ Serverless       │
                    └──────────────────┘              └──────────────────┘
```

### Processing Flow

1. Recursively scans CIFS-mounted directories (text files such as `.md`, `.txt`, `.html`)
2. Reads SID information (`allowed_group_sids`) from each document's `.metadata.json`
   - If `.metadata.json` does not exist and `ENV_AUTO_METADATA=true`, automatically retrieves ACLs via the ONTAP REST API (`GET /api/protocols/file-security/permissions/{SVM_UUID}/{PATH}`), extracts SIDs, and auto-generates `.metadata.json`
3. Splits text into 1,000-character chunks (200-character overlap)
4. Generates 1024-dimensional vectors using Amazon Bedrock Titan Embed Text v2
5. Indexes into AOSS (OpenSearch Serverless) in Bedrock KB-compatible format (`AMAZON_BEDROCK_TEXT_CHUNK` + `AMAZON_BEDROCK_METADATA`)
6. Records processed files in `processed.json` (supports incremental processing)

### Execution Modes

| Mode | Description | Configuration |
|------|-------------|---------------|
| Batch Mode | Processes all files once and exits | `ENV_WATCH_MODE=false` (default) |
| Watch Mode | Detects file changes and processes automatically | `ENV_WATCH_MODE=true` |

In watch mode, the `chokidar` library is used to detect file system changes (additions/updates) in real time and automatically perform vectorization and indexing. For scheduled execution, a configuration that periodically starts the batch mode container via EventBridge Scheduler or cron is also possible.

### CDK Stack

`DemoEmbeddingStack` (`lib/stacks/demo/demo-embedding-stack.ts`) creates the following:
- EC2 instance (m5.large, IMDSv2 enforced)
- ECR repository (for Embedding container image)
- IAM role (SSM, FSx, AOSS, Bedrock, ECR, Secrets Manager)
- Security group
- UserData (automatic CIFS mount + Docker auto-start)

### Source Code

```
docker/embed/
├── src/index.ts      # Main processing (Scan → Chunk → Embedding → Index)
├── src/oss-client.ts  # AOSS SigV4 signing client (IMDS authentication support)
├── Dockerfile         # node:22-slim + cifs-utils
├── buildspec.yml      # CodeBuild build definition
└── package.json       # AWS SDK v3, chokidar, dotenv
```

---

## 6. Amazon Titan Text Embeddings — Vectorization Model

### Implementation Details

`amazon.titan-embed-text-v2:0` is used for document vectorization.

### Model Specifications

| Item | Value |
|------|-------|
| Model ID | `amazon.titan-embed-text-v2:0` |
| Vector Dimensions | 1024 |
| Max Input Length | 8,000 characters |
| Normalization | Enabled (`normalize: true`) |

### Usage

| Component | Purpose |
|-----------|---------|
| Bedrock Knowledge Base | Vectorization during document ingestion from S3 data source |
| Embedding Server | Vectorization of CIFS-mounted documents (`docker/embed/src/index.ts`) |

### Embedding Invocation

```typescript
// Bedrock InvokeModel API
const body = JSON.stringify({
  inputText: text.substring(0, 8000),
  dimensions: 1024,
  normalize: true,
});
const resp = await bedrock.send(new InvokeModelCommand({
  modelId: 'amazon.titan-embed-text-v2:0',
  contentType: 'application/json',
  accept: 'application/json',
  body: Buffer.from(body),
}));
```

### CDK Configuration

Knowledge Base configuration in `DemoAIStack`:
```typescript
embeddingModelArn: `arn:aws:bedrock:${region}::foundation-model/amazon.titan-embed-text-v2:0`
```

---

## 7. SID Metadata + Permission Filtering

### Implementation Details

When vectorizing documents, SID (Security Identifier) information based on the file's NTFS ACL is attached as metadata in `.metadata.json` files. In the chat interface, the logged-in user's SIDs are compared against each document's SIDs, and only documents with matching SIDs are included in the search results.

### What is a SID?

A SID (Security Identifier) is a unique identifier for security principals (users, groups) in Windows/NTFS.

```
S-1-5-21-{DomainID1}-{DomainID2}-{DomainID3}-{RID}
```

| SID | Name | Description |
|-----|------|-------------|
| `S-1-1-0` | Everyone | All users |
| `S-1-5-21-...-512` | Domain Admins | Domain administrators group |
| `S-1-5-21-...-1001` | User | Regular user |

### Metadata File (`.metadata.json`)

A `.metadata.json` file corresponding to each document defines the list of allowed access SIDs.

```json
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-0000000000-0000000000-0000000000-512"],
    "access_level": "confidential"
  }
}
```

### Document-to-SID Mapping

| Directory | Access Level | allowed_group_sids | Admin | Regular User |
|-----------|-------------|-------------------|-------|-------------|
| `public/` | Public | `S-1-1-0` (Everyone) | ✅ Allowed | ✅ Allowed |
| `confidential/` | Confidential | `...-512` (Domain Admins) | ✅ Allowed | ❌ Denied |
| `restricted/` | Restricted | `...-1100` (Engineering) + `...-512` (DA) | ✅ Allowed | ❌ Denied |

### User SID Management

User SID information is managed in the DynamoDB `user-access` table. The application's JWT uses the email address as the `userId`.

```
DynamoDB user-access Table
┌──────────────────────┬──────────────────────┬────────────────────────┐
│ userId (PK)          │ userSID              │ groupSIDs              │
├──────────────────────┼──────────────────────┼────────────────────────┤
│ admin@example.com    │ S-1-5-21-...-500     │ [S-1-5-21-...-512,     │
│                      │ (Administrator)      │  S-1-1-0]              │
├──────────────────────┼──────────────────────┼────────────────────────┤
│ user@example.com     │ S-1-5-21-...-1001    │ [S-1-1-0]              │
│                      │ (Regular User)       │                        │
└──────────────────────┴──────────────────────┴────────────────────────┘
```

### Filtering Processing Flow (Two-Stage Method)

```
User              Next.js API Route        DynamoDB          Bedrock KB        Bedrock Converse
  │                  │                       │                  │                  │
  │ 1. Submit query  │                       │                  │                  │
  │─────────────────▶│                       │                  │                  │
  │                  │ 2. Get user SIDs      │                  │                  │
  │                  │──────────────────────▶│                  │                  │
  │                  │◀──────────────────────│                  │                  │
  │                  │ userSID + groupSIDs   │                  │                  │
  │                  │                       │                  │                  │
  │                  │ 3. Retrieve API (vector search)          │                  │
  │                  │─────────────────────────────────────────▶│                  │
  │                  │◀─────────────────────────────────────────│                  │
  │                  │ Search results + metadata(allowed_group_sids)               │
  │                  │                       │                  │                  │
  │                  │ 4. SID matching        │                  │                  │
  │                  │ User SIDs ∩ Document SIDs                │                  │
  │                  │ → Match: ALLOW                           │                  │
  │                  │ → No match: DENY                         │                  │
  │                  │                       │                  │                  │
  │                  │ 5. Converse API (generate answer using only allowed docs)   │
  │                  │────────────────────────────────────────────────────────────▶│
  │                  │◀────────────────────────────────────────────────────────────│
  │                  │                       │                  │                  │
  │ 6. Filtered      │                       │                  │                  │
  │    answer+Citation│                      │                  │                  │
  │◀─────────────────│                       │                  │                  │
```

Reason for using the Retrieve API: The RetrieveAndGenerate API does not return citation metadata (`allowed_group_sids`), so SID filtering does not work. The Retrieve API correctly returns metadata, so the two-stage method (Retrieve → SID Filter → Converse) is adopted.

### Fail-Closed Fallback

When permission checks fail, access to all documents is denied.

| Situation | Behavior |
|-----------|----------|
| DynamoDB connection error | All documents denied |
| No user SID record | All documents denied |
| No SID info in metadata | Corresponding document denied |
| No SID match | Corresponding document denied |
| SID match found | Corresponding document allowed |

### Implementation Files

| File | Role |
|------|------|
| `docker/nextjs/src/app/api/bedrock/kb/retrieve/route.ts` | KB search API + SID filtering integration (Lambda/inline switching support) |
| `lambda/permissions/metadata-filter-handler.ts` | Metadata-based permission filtering Lambda (enabled with `-c usePermissionFilterLambda=true`) |
| `lambda/permissions/permission-filter-handler.ts` | ACL-based permission filtering Lambda (for future expansion) |
| `lambda/permissions/permission-calculator.ts` | SID/ACL matching logic |
| `demo-data/scripts/setup-user-access.sh` | User SID data registration script |
| `demo-data/documents/**/*.metadata.json` | Document SID metadata |

---

## 8. Bedrock Agent — Permission-aware Agentic AI

### Implementation Details

A multi-step reasoning AI agent is implemented using Bedrock Agent. The Agent performs KB searches through a Permission-aware Action Group and generates answers referencing only documents filtered based on the user's SID permissions.

### Architecture

```
User → InvokeAgent API → Bedrock Agent (Claude 3 Haiku)
  │
  ├── Permission-aware Search Action Group
  │   ├── KB Retrieve API (vector search)
  │   ├── DynamoDB user-access (get user SIDs)
  │   ├── SID matching (allowed_group_sids ∩ userSIDs)
  │   └── Return only allowed documents
  │
  └── Agent multi-step reasoning → Answer generation
```

### CDK Resources (`enableAgent=true`)

| Resource | Description |
|----------|-------------|
| Bedrock Agent | Claude 3 Haiku, no direct KB association (Action Group only) |
| Agent Alias | Alias for stable invocation |
| Action Group Lambda | Permission-aware KB search (with SID filtering) |
| Agent IAM Role | Bedrock InvokeModel + KB Retrieve permissions |

### Permission-aware Action Group

The Agent does not search KB directly but always accesses it through the Action Group (`permissionAwareSearch`). This ensures:
- Filtering based on user SID information is always applied
- Admins can reference all documents, while regular users can only reference public documents
- Agent multi-step reasoning is executed only with filtered documents

### Card-Based Task-Oriented UI

Mode-specific card grids are displayed before starting a chat. The configuration consists of 8 cards for KB mode + 14 cards for Agent mode (8 research + 6 output), allowing one-click prompt input. Supports favorites management and category filtering.

### Sidebar Layout

AgentModeSidebar uses CollapsiblePanel to make System Settings (region/model selection, etc.) collapsible, with WorkflowSection positioned at the top of the sidebar. System Settings is expanded by default in KB mode, and workflows are expanded by default in Agent mode.

### Dynamic Agent-Card Binding

When a card is clicked, AGENT_CATEGORY_MAP (10 categories: financial, project, hr, search, presentation, approval, minutes, report, contract, onboarding) is referenced to find or dynamically create a corresponding Agent and bind it to the card. Created Agents automatically have the Permission-aware Action Group attached.

### Workflow UI

Preset workflows are placed in AgentModeSidebar:
- 📊 Financial Report Analysis
- 📝 Project Progress Check
- 🔍 Cross-Document Search
- 📋 HR Policy Review

### Implementation Files

| File | Role |
|------|------|
| `lib/stacks/demo/demo-ai-stack.ts` | Agent + Action Group CDK resources |
| `lambda/bedrock-agent-actions/permission-aware-search.ts` | Action Group Lambda (TypeScript version) |
| `docker/nextjs/src/app/api/bedrock/agent/route.ts` | InvokeAgent API Route |
| `docker/nextjs/src/app/[locale]/genai/page.tsx` | Agent UI (mode toggle, workflows) |
| `docker/nextjs/src/components/bedrock/AgentModeSidebar.tsx` | Agent sidebar |

---

## 9. Image Analysis RAG — Bedrock Vision API Integration

### Implementation Details

An image upload feature is added to the chat input, using Bedrock Converse API's multimodal capability (Vision API) to analyze images and integrate the results into the KB search context.

### Processing Flow

```
User → Drag & drop image or file picker
  → Validation (format: JPEG/PNG/GIF/WebP, size: ≤3MB)
  → Base64 encoding → API submission
  → Vision API (Claude 3 Haiku) image analysis
  → Analysis result + user query → KB Retrieve API
  → SID filtering → Answer generation
```

### Key Components

| File | Role |
|------|------|
| `docker/nextjs/src/hooks/useImageUpload.ts` | Image validation and Base64 conversion hook |
| `docker/nextjs/src/components/chat/ImageUploadZone.tsx` | Drag & drop area + file picker |
| `docker/nextjs/src/components/chat/ImagePreview.tsx` | Attached image preview + delete button |
| `docker/nextjs/src/components/chat/ImageThumbnail.tsx` | In-message thumbnail (max 200×200px) |
| `docker/nextjs/src/components/chat/ImageModal.tsx` | Full-size image modal |
| `docker/nextjs/src/app/api/bedrock/kb/retrieve/route.ts` | Vision API invocation (30-second timeout, text-only fallback) |

### Error Handling

- Unsupported format → Error message display (i18n supported)
- Exceeds 5MB → Error message display
- Vision API failure → Falls back to text-only query (does not interrupt user experience)
- Vision API 15-second timeout → Aborted via AbortController, falls back

### Current Image Data Lifecycle

In the current implementation, image data follows a completely stateless flow where nothing is persistently stored.

```
Browser (FileReader → Base64 → useState)
  → Included in API request JSON body via POST
  → Lambda (Buffer.from → Send to Bedrock Converse API → Get text result)
  → After response is returned, image data is discarded by GC
```

- No image storage in S3, DynamoDB, or any other service
- Image data exists only in Lambda memory during request processing
- Bedrock does not use it for training either
- Image data is not stored in chat history (text messages only)
- After page reload, "which image was asked about" cannot be restored

### Future Considerations — Image Data Persistence and AgentCore Memory Integration

#### Background

The current stateless design is appropriate from privacy and cost perspectives, but since images are not retained in chat history, context continuation like "about the image I uploaded last time" is not possible. Future consideration of image persistence and conversation context integration is planned.

#### Approach Comparison

| Approach | Cost | Implementation Difficulty | Suitability | Notes |
|----------|------|--------------------------|-------------|-------|
| S3 + DynamoDB | A few cents/month | Low | Optimal | Store images in S3, map message IDs to S3 keys in DynamoDB. Completes with existing infrastructure |
| AgentCore Memory (blob) | Unknown (likely high) | Medium | Excessive | Can store Base64 images via `create_blob_event`, but primarily designed for conversation context management, not suitable for image storage |
| AgentCore Memory (text only) | Low | Medium | Appropriate | Retain only Vision analysis result text as long-term memory with Semantic Strategy |
| Hybrid (recommended) | Low to Medium | Medium | Optimal | Store images in S3 + retain Vision analysis result text in AgentCore Memory |

#### AgentCore Memory Considerations

- AgentCore Memory event payloads come in two types: `conversational` (text) and `blob` (binary)
- Semantic Memory Strategy / Summary Strategy are mechanisms that extract facts and summaries from conversation text, and cannot perform meaningful extraction on image binaries
- Charges are expected based on event retention period (default 90 days) and storage volume, with a risk of cost inflation if 5MB images are stored each time
- The AgentCore Memory SDK is primarily Python (`bedrock-agentcore` package), and from TypeScript/Node.js, the low-level API of AWS SDK for JavaScript v3 must be used directly
- AgentCore Memory reached GA in July 2025; availability in the ap-northeast-1 region needs to be confirmed

#### Recommended Architecture (for Future Implementation)

```
On image upload:
  Browser → S3 presigned URL → S3 bucket (image storage, with TTL)
  → DynamoDB (messageId → s3Key mapping)

After Vision analysis:
  Analysis result text → AgentCore Memory create_event (conversational payload)
  → Semantic Strategy → Automatically extracted as long-term memory

Chat history display:
  DynamoDB → Get s3Key → Generate S3 presigned URL → ImageThumbnail display

Context continuation:
  AgentCore Memory retrieve_memories → Get past Vision analysis result text
  → Include in LLM context for answer generation
```

This approach allows images to be stored at low cost in S3, while Vision analysis result text can be leveraged for context restoration via AgentCore Memory's semantic search.

---

## 10. Knowledge Base Connection UI — Agent × KB Management

### Implementation Details

When creating or editing Agents in the Agent Directory (`/genai/agents`), a UI is provided for selecting, connecting, and disconnecting Bedrock Knowledge Bases.

### Key Components

| File | Role |
|------|------|
| `docker/nextjs/src/components/agents/KBSelector.tsx` | KB list display and multi-selection (only ACTIVE KBs selectable) |
| `docker/nextjs/src/components/agents/ConnectedKBList.tsx` | Connected KB display in Agent detail panel |
| `docker/nextjs/src/hooks/useKnowledgeBases.ts` | KB list retrieval and connected KB retrieval hook |
| `docker/nextjs/src/app/api/bedrock/agent/route.ts` | 3 actions added (associate/disassociate/listAgentKBs) |

### API Extensions

Three actions added to the existing `/api/bedrock/agent` (no changes to existing actions):

| Action | Description |
|--------|-------------|
| `associateKnowledgeBase` | Connect KB to Agent → PrepareAgent |
| `disassociateKnowledgeBase` | Disconnect KB from Agent → PrepareAgent |
| `listAgentKnowledgeBases` | Get list of KBs connected to Agent |

---

## 11. Smart Routing — Cost-Optimized Model Selection

### Implementation Details

Automatically routes queries based on complexity. Short factual queries are routed to a lightweight model (Haiku), while long analytical queries are routed to a high-performance model (Sonnet).

### Classification Algorithm (ComplexityClassifier)

| Feature | Leans Simple | Leans Complex |
|---------|-------------|--------------|
| Character count | ≤100 chars (+0.3) | >100 chars (+0.3) |
| Sentence count | 1 sentence (+0.2) | Multiple sentences (+0.2) |
| Analytical keywords | None | Present (+0.3) (比較/分析/要約/explain/compare/analyze/summarize) |
| Multiple questions | None | 2+ question marks (+0.2) |

Score < 0.5 → simple, ≥ 0.5 → complex. Confidence = |score - 0.5| × 2.

### Key Components

| File | Role |
|------|------|
| `docker/nextjs/src/lib/complexity-classifier.ts` | Query complexity classification (pure function) |
| `docker/nextjs/src/lib/smart-router.ts` | Model routing decision |
| `docker/nextjs/src/store/useSmartRoutingStore.ts` | Zustand store (localStorage persistence) |
| `docker/nextjs/src/components/sidebar/RoutingToggle.tsx` | ON/OFF toggle + model pair display |
| `docker/nextjs/src/components/chat/ResponseMetadata.tsx` | Used model name + Auto/Manual badge |

### Default Settings

- Smart Routing: OFF by default (no impact on existing behavior)
- Lightweight model: `anthropic.claude-haiku-4-5-20251001-v1:0`
- High-performance model: `anthropic.claude-3-5-sonnet-20241022-v2:0`

---

## 13. AgentCore Memory — Conversation Context Maintenance

### Implementation Details

An optional feature enabled with `enableAgentCoreMemory=true` that provides short-term memory (in-session conversation history) and long-term memory (cross-session user preferences, summaries, and semantic knowledge) via Bedrock AgentCore Memory.

### Architecture

```
AIStack (CfnMemory)
├── Event Store (short-term memory: in-session conversation history, TTL 3 days)
├── Semantic Strategy (long-term memory: auto-extracts facts/knowledge from conversations)
└── Summary Strategy (long-term memory: auto-generates session conversation summaries)

Next.js API Routes
├── POST/GET/DELETE /api/agentcore/memory/session — Session management
├── POST/GET /api/agentcore/memory/event — Event recording/retrieval
└── POST /api/agentcore/memory/search — Semantic search

Authentication Flow
├── lib/agentcore/auth.ts — Cookie JWT validation (no DynamoDB access)
└── actorId = userId (@ → _at_, . → _dot_ replacement)
```

### CDK Resources

| Resource | Description |
|----------|-------------|
| `CfnMemory` | AgentCore Memory resource (created only when `enableAgent=true` AND `enableAgentCoreMemory=true`) |
| Memory IAM Role | `bedrock-agentcore.amazonaws.com` service principal |
| Lambda IAM Policy | `bedrock-agentcore:CreateEvent/ListEvents/DeleteEvent/ListSessions/RetrieveMemoryRecords` (added only when memoryId is set) |

### Key Features

- Automatic retention of in-session conversation history (short-term memory, TTL 3 days, minimum value)
- Automatic extraction of cross-session user preferences and knowledge (semantic strategy)
- Automatic generation of session conversation summaries (summary strategy)
- Session list and memory section display in sidebar
- Conversation context maintenance in both KB mode and Agent mode
- 8-language i18n support (`agentcore.memory.*`, `agentcore.session.*`)

### Deployment Notes

| Item | Constraint | Resolution |
|------|-----------|------------|
| Memory Name | `^[a-zA-Z][a-zA-Z0-9_]{0,47}` (no hyphens allowed) | `prefix.replace(/-/g, '_')` for conversion |
| EventExpiryDuration | Days (min: 3, max: 365) | 3 days (minimum value) |
| Service Principal | `bedrock-agentcore.amazonaws.com` | Not `bedrock.amazonaws.com` |
| Tags Format | Map `{ key: value }` | Override CDK default array format with `addPropertyOverride` |
| actorId | `[a-zA-Z0-9][a-zA-Z0-9-_/]*` | Replace `@` and `.` in email addresses |

### CDK Context Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `enableAgentCoreMemory` | `false` | Enable AgentCore Memory (requires `enableAgent=true` as prerequisite) |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `AGENTCORE_MEMORY_ID` | AgentCore Memory ID (CDK output) |
| `ENABLE_AGENTCORE_MEMORY` | Memory feature enabled flag |

---

## Overall System Architecture

```
┌──────────┐     ┌──────────┐     ┌────────────┐     ┌─────────────────────┐
│ Browser  │────▶│ AWS WAF  │────▶│ CloudFront │────▶│ Lambda Web Adapter  │
└──────────┘     └──────────┘     │ (OAC+Geo)  │     │ (Next.js, IAM Auth) │
                                   └────────────┘     └──────┬──────────────┘
                                                             │
                       ┌─────────────────────┬───────────────┼────────────────────┐
                       ▼                     ▼               ▼                    ▼
              ┌─────────────┐    ┌──────────────────┐ ┌──────────────┐   ┌──────────────┐
              │ Cognito     │    │ Bedrock KB       │ │ DynamoDB     │   │ DynamoDB     │
              │ User Pool   │    │ + S3 Vectors /   │ │ user-access  │   │ perm-cache   │
              └─────────────┘    │   OpenSearch SL  │ │ (SID data)   │   │ (Perm Cache) │
                                 └────────┬─────────┘ └──────────────┘   └──────────────┘
                                          │
                              ┌───────────┴───────────┐
                              ▼                       ▼
                     ┌────────────────┐     ┌──────────────────┐
                     │ S3 Bucket      │     │ FSx for ONTAP    │
                     │ (Metadata Sync)│     │ (SVM + Volume)   │
                     └────────────────┘     └────────┬─────────┘
                                                     │ CIFS/SMB
                                                     ▼
                                            ┌──────────────────┐
                                            │ Embedding EC2    │
                                            │ (Titan Embed v2) │
                                            └──────────────────┘
```

### CDK Stack Configuration (7 Stacks)

| # | Stack | Region | Key Resources |
|---|-------|--------|---------------|
| 1 | WafStack | us-east-1 | WAF WebACL, IP Set |
| 2 | NetworkingStack | ap-northeast-1 | VPC, Subnets, Security Groups, VPC Endpoints (optional) |
| 3 | SecurityStack | ap-northeast-1 | Cognito User Pool, Client, SAML IdP + Cognito Domain (when AD Federation enabled), AD Sync Lambda (optional) |
| 4 | StorageStack | ap-northeast-1 | FSx ONTAP + SVM + Volume, S3, DynamoDB×2, AD, KMS Encryption (optional), CloudTrail (optional) |
| 5 | AIStack | ap-northeast-1 | Bedrock KB, S3 Vectors / OpenSearch Serverless (selected via `vectorStoreType`), Bedrock Guardrails (optional) |
| 6 | WebAppStack | ap-northeast-1 | Lambda (Docker), CloudFront, Permission Filter Lambda (optional), MonitoringConstruct (optional) |
| 7 | EmbeddingStack (optional) | ap-northeast-1 | EC2, ECR, ONTAP ACL auto-retrieval (optional) |

### CDK Context Parameters List

| Parameter | Phase | Default | Description |
|-----------|-------|---------|-------------|
| `enableEmbeddingServer` | - | `false` | Enable Embedding server |
| `ontapMgmtIp` | 2 | (none) | ONTAP management IP (ACL auto-retrieval) |
| `ontapSvmUuid` | 2 | (none) | SVM UUID (ACL auto-retrieval) |
| `useS3AccessPoint` | 2 | `false` | Use S3 AP as KB data source |
| `usePermissionFilterLambda` | 3 | `false` | Enable Permission Filter Lambda |
| `enableGuardrails` | 4 | `false` | Enable Bedrock Guardrails |
| `enableKmsEncryption` | 4 | `false` | KMS encryption (S3, DynamoDB) |
| `enableCloudTrail` | 4 | `false` | CloudTrail audit logs |
| `enableVpcEndpoints` | 4 | `false` | VPC Endpoints (Bedrock, SSM, etc.) |
| `enableMonitoring` | - | `false` | CloudWatch Dashboard + SNS Alerts + EventBridge monitoring |
| `monitoringEmail` | - | (none) | Alert notification email address |
| `enableAgentCoreMemory` | - | `false` | Enable AgentCore Memory (short-term/long-term memory) (requires `enableAgent=true` as prerequisite) |
| `enableAgentCoreObservability` | - | `false` | Integrate AgentCore Runtime metrics into dashboard |
| `enableAdvancedPermissions` | - | `false` | Time-based access control + permission decision audit log |

---

## 12. Monitoring & Alerts — CloudWatch Dashboard + SNS Alerts + EventBridge

### Implementation Details

An optional feature enabled with `enableMonitoring=true` that provides a CloudWatch dashboard, SNS alerts, and EventBridge integration. The overall system status can be checked from a single dashboard, and email notifications are sent when anomalies occur.

### Architecture

```
MonitoringConstruct (within WebAppStack)
├── CloudWatch Dashboard (unified dashboard)
│   ├── Lambda Overview (WebApp / PermFilter / AgentScheduler / AD Sync)
│   ├── CloudFront (request count, error rate, cache hit rate)
│   ├── DynamoDB (capacity, throttling)
│   ├── Bedrock (API calls, latency)
│   ├── WAF (blocked request count)
│   ├── Advanced RAG (Vision API, Smart Routing, KB connection management)
│   ├── AgentCore (conditional: enableAgentCoreObservability=true)
│   └── KB Ingestion Jobs (execution history)
├── CloudWatch Alarms → SNS Topic → Email
│   ├── WebApp Lambda error rate > 5%
│   ├── WebApp Lambda P99 Duration > 25 seconds
│   ├── CloudFront 5xx error rate > 1%
│   ├── DynamoDB throttling ≥ 1
│   ├── Permission Filter Lambda error rate > 10% (conditional)
│   ├── Vision API timeout rate > 20%
│   └── Agent execution error rate > 10% (conditional)
└── EventBridge Rule → SNS Topic
    └── Bedrock KB Ingestion Job FAILED
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Dashboard | CloudWatch Dashboard (auto-refresh 5 minutes) |
| Alarms | CloudWatch Alarms (notifications in both OK↔ALARM directions) |
| Notifications | SNS Topic + Email Subscription |
| Event Monitoring | EventBridge Rule (KB Ingestion Job failure detection) |
| Custom Metrics | CloudWatch Embedded Metric Format (EMF) |
| CDK Construct | `lib/constructs/monitoring-construct.ts` |

### Custom Metrics (EMF)

Custom metrics are emitted within Lambda functions under the `PermissionAwareRAG/AdvancedFeatures` namespace. When `enableMonitoring=false`, a no-op implementation is used with no performance impact.

| Metric | Dimension | Source |
|--------|-----------|--------|
| VisionApiInvocations / Timeouts / Fallbacks / Latency | Operation=vision | On Vision API invocation |
| SmartRoutingSimple / Complex / AutoSelect / ManualOverride | Operation=routing | On Smart Router selection |
| KbAssociateInvocations / KbDisassociateInvocations / KbMgmtErrors | Operation=kb-mgmt | On KB connection management API invocation |

### Cost

| Resource | Monthly Cost |
|----------|-------------|
| CloudWatch Dashboard | $3.00 |
| CloudWatch Alarms (7) | $0.70 |
| SNS Email Notifications | Within free tier |
| EventBridge Rule | Within free tier |
| **Total** | **Approx. $4/month** |

### CDK Stack

Implemented as `MonitoringConstruct` within `DemoWebAppStack`. Resources are created only when `enableMonitoring=true`.

```bash
# Deploy with monitoring enabled
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c enableMonitoring=true \
  -c monitoringEmail=ops@example.com

# Also enable AgentCore Observability
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c enableMonitoring=true \
  -c monitoringEmail=ops@example.com \
  -c enableAgentCoreObservability=true
```
