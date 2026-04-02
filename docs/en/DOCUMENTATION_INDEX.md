# Documentation Index

**🌐 Language:** [日本語](../DOCUMENTATION_INDEX.md) | **English** | [한국어](../ko/DOCUMENTATION_INDEX.md) | [简体中文](../zh-CN/DOCUMENTATION_INDEX.md) | [繁體中文](../zh-TW/DOCUMENTATION_INDEX.md) | [Français](../fr/DOCUMENTATION_INDEX.md) | [Deutsch](../de/DOCUMENTATION_INDEX.md) | [Español](../es/DOCUMENTATION_INDEX.md)

## Essential Reading

| Document | Description |
|----------|-------------|
| [README.md](../../README.en.md) | System overview, architecture, deployment steps, WAF/Geo settings |
| [implementation-overview.md](implementation-overview.md) | Detailed implementation (12 aspects: image analysis RAG, KB connection UI, Smart Routing, monitoring & alerts) |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID-based permission filtering detailed design |
| [verification-report.md](verification-report.md) | Post-deployment verification procedures and test cases |
| [ui-specification.md](ui-specification.md) | Chatbot UI specification (KB/Agent mode, Agent Directory, enterprise Agent features, sidebar design) |
| [demo-recording-guide.md](demo-recording-guide.md) | Demo video recording guide (6 evidence items) |
| [embedding-server-design.md](embedding-server-design.md) | Embedding server design & implementation document |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | CDK stack architecture guide (vector store comparison, implementation insights) |
| [README - AD SAML Federation](../../README.en.md#ad-saml-federation-optional) | AD SAML federation setup (Managed AD / Self-managed AD) |

## Setup & Verification

| Document | Description |
|----------|-------------|
| [demo-scenario.md](../../demo-data/guides/demo-scenario.md) | Verification scenarios (admin vs. general user permission differences, AD SSO sign-in) |
| [ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) | FSx ONTAP + AD integration, CIFS share, NTFS ACL configuration (verified procedures) |
| [demo-environment-guide.md](demo-environment-guide.md) | Verification environment resource IDs, access info, Embedding server procedures |

## Embedding Server (via FlexCache CIFS Mount)

| Document / File | Description |
|-----------------|-------------|
| [demo-environment-guide.md#6](demo-environment-guide.md) | Embedding server deployment & operation procedures |
| `docker/embed/src/index.ts` | Embedding app (document scan → chunk split → vectorize → index) |
| `docker/embed/src/oss-client.ts` | OpenSearch Serverless SigV4 signing client (IMDS auth support) |
| `docker/embed/Dockerfile` | Embedding container definition (node:22-slim, cifs-utils) |
| `docker/embed/buildspec.yml` | CodeBuild build definition |
| `lib/stacks/demo/demo-embedding-stack.ts` | EmbeddingStack CDK definition (EC2 + ECR + IAM) |

## Setup Scripts

| Script | Description |
|--------|-------------|
| `demo-data/scripts/create-demo-users.sh` | Create Cognito test users |
| `demo-data/scripts/setup-user-access.sh` | Register SID data in DynamoDB |
| `demo-data/scripts/upload-demo-data.sh` | Upload test documents to S3 |
| `demo-data/scripts/sync-kb-datasource.sh` | Sync Bedrock KB data source |

## Recommended Reading Order

1. **README.md** — System overview and deployment steps
2. **implementation-overview.md** — Detailed implementation across 8 aspects
3. **SID-Filtering-Architecture.md** — Core feature technical details
4. **demo-recording-guide.md** — Demo video recording guide
5. **ontap-setup-guide.md** — FSx ONTAP AD integration, CIFS share setup
6. **README.md - AD SAML Federation** — AD SAML federation setup (optional)
7. **demo-environment-guide.md** — Verification environment setup (including Embedding server)
8. **demo-scenario.md** — Execute verification scenarios (AD SSO sign-in)
9. **verification-report.md** — API-level verification procedures
