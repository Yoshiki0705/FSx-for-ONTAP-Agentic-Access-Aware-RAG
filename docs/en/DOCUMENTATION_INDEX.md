# Documentation Index

**🌐 Language:** [日本語](../DOCUMENTATION_INDEX.md) | **English** | [한국어](../ko/DOCUMENTATION_INDEX.md) | [简体中文](../zh-CN/DOCUMENTATION_INDEX.md) | [繁體中文](../zh-TW/DOCUMENTATION_INDEX.md) | [Français](../fr/DOCUMENTATION_INDEX.md) | [Deutsch](../de/DOCUMENTATION_INDEX.md) | [Español](../es/DOCUMENTATION_INDEX.md)

## Essential Reading

| Document | Description |
|----------|-------------|
| [README.md](../../README.en.md) | System overview, architecture, deployment steps, WAF/Geo settings |
| [auth-and-user-management.md](auth-and-user-management.md) | Authentication & user management guide (auth mode selection, AD Federation, automatic SID registration, troubleshooting) |
| [implementation-overview.md](implementation-overview.md) | Detailed implementation (22 aspects: image analysis RAG, KB connection UI, Smart Routing, monitoring & alerts, OIDC/LDAP Federation) |
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
| [auth-mode-setup-guide.md](../../demo-data/guides/auth-mode-setup-guide.md) | Auth mode demo environment setup guide (5 modes, with sample configuration files) |
| [demo-scenario.md](../../demo-data/guides/demo-scenario.md) | Verification scenarios (admin vs. general user permission differences, AD SSO sign-in, OIDC/LDAP sign-in) |
| [ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) | FSx for ONTAP + AD integration, CIFS share, NTFS ACL configuration, Name-Mapping configuration (verified procedures) |
| [demo-environment-guide.md](demo-environment-guide.md) | Verification environment resource IDs, access info, Embedding server procedures |

## Enterprise Design & Operations Guide

| Document | Description |
|----------|-------------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | Production readiness checklist (Demo → PoC → Production maturity level definitions, security/audit/DR/operations check items) |
| [permission-consistency.md](permission-consistency.md) | Permission change consistency model (ACL change → metadata regeneration → KB re-sync → cache invalidation flow, max latency, emergency permission revocation procedures) |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP sizing & performance guide (scale-based configurations, S3 AP considerations, QoS, vector store selection) |
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | Multi-tenant & partner deployment patterns (account isolation/SVM isolation/hybrid, cost estimation templates) |
| [governance-and-audit.md](governance-and-audit.md) | Governance & audit design (audit log schema, Responsible AI, Guardrails policies, industry-specific use cases) |
| [evaluation.md](evaluation.md) | RAG / Agent evaluation metrics (4-axis evaluation: business KPIs, RAG quality, permission control, Agent performance; PoC evaluation template) |
| [managed-kb-migration-evaluation.md](managed-kb-migration-evaluation.md) | Amazon Bedrock Managed Knowledge Base migration path evaluation (comparison with existing KB + OpenSearch Serverless / S3 Vectors, impact on Permission-aware RAG, ACL metadata filter verification points, phased migration). AWS Summit NY 2026 |
| [investigations/agentcore-web-search-integration.md](investigations/agentcore-web-search-integration.md) | Design investigation for integrating AgentCore Web Search Tool as a hybrid search option in Permission-aware RAG (UI toggle, us-east-1 cross-region Gateway, Lambda Layer/inline, query safety / citation separation / prompt-injection defense, implementation order). AWS Summit NY 2026 |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | Safe experimentation guide (scope definition, prohibited actions, real data ingestion checklist, rollback procedures) |
| [threat-model.md](threat-model.md) | Threat model (10 threat categories, attack paths, existing mitigations, additional recommendations, threat-to-countermeasure mapping table) |
| [cloudwatch-dashboard-guide.md](cloudwatch-dashboard-guide.md) | CloudWatch dashboard operations guide (metrics list, alarm definitions, troubleshooting patterns) |
| [poc-workshop-guide.md](poc-workshop-guide.md) | PoC workshop guide (90 minutes: deploy → test → evaluate → cleanup) |
| [tests/permission-matrix/](../../tests/permission-matrix/) | Permission matrix tests (31 ACL edge-case scenarios: Fail-Closed, group nesting, inherited permissions, emergency revocation) |

## FSx for ONTAP Ops Automation

| Document | Description |
|----------|-------------|
| [automation/fsxn-ops/README.md](../../automation/fsxn-ops/README.md) | Ops automation suite overview (directory structure, use cases) |
| [automation/fsxn-ops/docs/why-this-makes-fsxn-easier.md](../../automation/fsxn-ops/docs/why-this-makes-fsxn-easier.md) | Why this architecture simplifies FSx for ONTAP operations (design decisions, cost estimates, security design) |
| [automation/fsxn-ops/docs/aws-verification-report.md](../../automation/fsxn-ops/docs/aws-verification-report.md) | AWS integration verification report (2026-05-01, all phases PASS) |
| [automation/fsxn-ops/cfn/fsxn-ops-stack.yaml](../../automation/fsxn-ops/cfn/fsxn-ops-stack.yaml) | Integrated CloudFormation template (incl. VPC endpoints) |

## Sample Configuration Files

| File | Auth Mode | Description |
|------|-----------|-------------|
| `demo-data/configs/mode-a-email-password.json` | Email/Password | Minimal configuration, manual SID registration |
| `demo-data/configs/mode-b-saml-ad-federation.json` | SAML AD Federation | Managed AD + IAM Identity Center |
| `demo-data/configs/mode-c-oidc-ldap.json` | OIDC + LDAP | Auth0/Keycloak + OpenLDAP + ONTAP name-mapping |
| `demo-data/configs/mode-d-oidc-claims-only.json` | OIDC Claims Only | Okta/Auth0 (no LDAP) |
| `demo-data/configs/mode-e-saml-oidc-hybrid.json` | SAML + OIDC | AD Federation + OIDC IdP simultaneous activation |

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
| `demo-data/scripts/setup-openldap.sh` | OpenLDAP server setup (EC2 in VPC, test users/groups) |
| `demo-data/scripts/setup-ontap-namemapping.sh` | ONTAP REST API name-mapping rule setup |
| `demo-data/scripts/verify-ldap-integration.sh` | LDAP integration verification (Lambda → LDAP → DynamoDB) |
| `demo-data/scripts/verify-ontap-namemapping.sh` | ONTAP name-mapping verification (REST API connection & rule retrieval) |
| `demo-data/scripts/setup-mode-c-oidc-ldap.sh` | Mode C (OIDC+LDAP) one-shot setup (all phases auto-executed) |

## Recommended Reading Order

### Phase 1: Initial Setup

1. **README.md** — System overview and deployment steps
2. **auth-and-user-management.md** — Auth mode selection and user management
3. **implementation-overview.md** — Detailed implementation across 22 aspects
4. **SID-Filtering-Architecture.md** — Core feature technical details
5. **safe-experimentation-guide.md** — Safe experimentation guide (must-read before starting PoC)

### Phase 2: Verification & Evaluation

6. **demo-recording-guide.md** — Demo video recording guide
7. **ontap-setup-guide.md** — FSx for ONTAP AD integration, CIFS share setup
8. **demo-environment-guide.md** — Verification environment setup
9. **demo-scenario.md** — Execute verification scenarios
10. **evaluation.md** — PoC evaluation template

### Phase 3: Production & Enterprise Design

11. **production-readiness-checklist.md** — Production readiness checklist
12. **permission-consistency.md** — Permission change consistency model
13. **fsxn-sizing-and-performance.md** — FSx for ONTAP sizing & performance
14. **governance-and-audit.md** — Governance & audit design
15. **partner-deployment-patterns.md** — Multi-tenant deployment patterns
