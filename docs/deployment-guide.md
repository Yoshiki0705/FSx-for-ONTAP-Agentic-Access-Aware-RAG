# Deployment Guide: Integration with Existing FSx for ONTAP Environment

**Language:** [日本語](deployment-guide.ja.md) | **English** | [한국어](ko/deployment-guide.md) | [简体中文](zh-CN/deployment-guide.md) | [繁體中文](zh-TW/deployment-guide.md) | [Français](fr/deployment-guide.md) | [Deutsch](de/deployment-guide.md) | [Español](es/deployment-guide.md)

**Created**: 2026-07  
**Status**: Active  
**Audience**: Infrastructure engineers, Partners/SIs deploying into customer environments

---

## Quick Start (TL;DR)

For experienced users who want the fastest path:

```bash
git clone https://github.com/Yoshiki0705/Permission-aware-RAG-FSxN-CDK.git
cd Permission-aware-RAG-FSxN-CDK && npm ci

# 1. Bootstrap CDK (both regions — required once per account)
npx cdk bootstrap aws://ACCOUNT_ID/ap-northeast-1
npx cdk bootstrap aws://ACCOUNT_ID/us-east-1    # WAF stack

# 2. Configure
cp cdk.context.existing-env.example.json cdk.context.json
# Edit: set existingFileSystemId, existingSvmId, existingVolumeId, projectName, environment

# 3. Build & Validate
bash demo-data/scripts/pre-deploy-setup.sh      # Builds + pushes container
bash scripts/preflight-check.sh                 # Validates environment

# 4. Deploy (~15-20 min)
npx cdk synth --quiet && npx cdk deploy --all --require-approval broadening

# 5. Post-deploy
bash demo-data/scripts/post-deploy-setup.sh     # Creates users, KB datasource, demo data
```

After deployment, open the CloudFront URL shown in the CDK output and sign in with the demo user credentials printed by the post-deploy script.

---

## Executive Summary

This guide covers deploying the Permission-aware RAG system into an environment where Amazon FSx for NetApp ONTAP, VPC, and related networking resources already exist. Both CDK and CloudFormation deployment methods are documented. The existing-environment integration skips FSx for ONTAP provisioning (~30-40 min), reducing total deploy time to approximately 15-20 minutes.

**Key decision**: Use CDK for full-featured deployment with feature flags. Use CloudFormation for the `fsxn-ops` automation stack when CDK is not available or when deploying the operations layer independently.

---

## What Gets Deployed

When you deploy with CDK, the following AWS resources are created in your account:

| Category | Resources | Notes |
|----------|-----------|-------|
| Networking | VPC Endpoints (or uses existing) | Skipped if `skipVpcEndpoints` set |
| Security | Cognito User Pool, WAF WebACL | WAF in us-east-1 |
| Compute | Lambda function (Next.js container) | Container pulled from ECR |
| Storage | S3 bucket (vectors), DynamoDB table | user-access permissions |
| AI/ML | Bedrock Knowledge Base, S3 Vectors index | Embedding + retrieval |
| CDN | CloudFront distribution | HTTPS frontend |
| (Optional) | Managed AD, Transfer Family, Monitoring | Per feature flags |

> **Assurance note**: CDK does NOT modify your existing FSx for ONTAP file system, SVM, volume, junction paths, export policies, or CIFS shares. It only reads resource IDs for reference.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Architecture Overview](#2-architecture-overview)
3. [CDK Deployment (Recommended)](#3-cdk-deployment-recommended)
4. [CloudFormation Deployment](#4-cloudformation-deployment)
5. [VPC Endpoint Considerations](#5-vpc-endpoint-considerations)
6. [Post-Deployment Verification](#6-post-deployment-verification)
7. [Day 2 Operations](#7-day-2-operations)
8. [Cost Estimation](#8-cost-estimation)
9. [Troubleshooting](#9-troubleshooting)
10. [Cleanup / Teardown](#10-cleanup--teardown)
11. [FAQ](#11-faq)

---

## 1. Prerequisites

### Required Resources (existing)

| Resource | Example | How to Obtain |
|----------|---------|---------------|
| FSx for ONTAP File System ID | `fs-0123456789abcdef0` | `aws fsx describe-file-systems` |
| Storage Virtual Machine (SVM) ID | `svm-0123456789abcdef0` | `aws fsx describe-storage-virtual-machines` |
| Volume ID | `fsvol-0123456789abcdef0` | `aws fsx describe-volumes` |
| VPC ID | `vpc-0abc123def456` | `aws ec2 describe-vpcs` |
| Private Subnet IDs (2+ AZs) | `subnet-0aaa..., subnet-0bbb...` | `aws ec2 describe-subnets` |
| Security Group ID (ONTAP mgmt access) | `sg-0123456789abcdef0` | `aws ec2 describe-security-groups` |
| ONTAP Management LIF IP | `198.51.100.10` | FSx Console > File System > Network |

### Required Tools

```bash
# CDK deployment
node --version    # >= 18.x
npx cdk --version # >= 2.244.0 (project-local)
aws --version     # >= 2.15

# Preflight check
jq --version      # >= 1.6
bash --version    # >= 4.0
```

### IAM Permissions

The deploying principal needs at minimum:
- `fsx:Describe*` (read existing resources)
- `cloudformation:*` (stack management)
- Full CDK bootstrap permissions (see [CDK Bootstrapping](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html))
- `bedrock:*` (Knowledge Base creation)
- `cognito-idp:*`, `lambda:*`, `s3:*`, `dynamodb:*`, `cloudfront:*`

### Network Requirements

| Source | Destination | Port | Purpose |
|--------|------------|------|---------|
| Lambda SG | ONTAP Management LIF | TCP 443 | ONTAP REST API |
| Lambda SG | S3 VPC Endpoint | TCP 443 | S3 Access Point |
| Lambda SG | Bedrock VPC Endpoint | TCP 443 | KB API, Converse API |
| Lambda SG | DynamoDB VPC Endpoint | TCP 443 | User-access table |
| Lambda SG | Secrets Manager Endpoint | TCP 443 | ONTAP credentials |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Existing Environment (Customer-managed)                         │
│                                                                   │
│  ┌──────────────────┐   ┌──────────────────┐                    │
│  │ FSx for ONTAP    │   │ VPC              │                    │
│  │ (fs-0xxxx)       │   │ (vpc-0xxxx)      │                    │
│  │                  │   │ ┌──────────────┐ │                    │
│  │ ┌─────────────┐  │   │ │Private Subnet│ │                    │
│  │ │ SVM         │  │   │ │(existing)    │ │                    │
│  │ │ └─ Volume   │  │◄──┤ └──────────────┘ │                    │
│  │ └─────────────┘  │   │                  │                    │
│  └──────────────────┘   └──────────────────┘                    │
│                                                                   │
└───────────────────────────────┬───────────────────────────────────┘
                                │ References (IDs)
┌───────────────────────────────▼───────────────────────────────────┐
│  RAG System (CDK-deployed)                                        │
│                                                                    │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐ │
│  │ CloudFront │ │ Cognito    │ │ Lambda     │ │ Bedrock KB     │ │
│  │ + WAF      │ │ User Pool  │ │ (Next.js)  │ │ + S3 Vectors   │ │
│  └────────────┘ └────────────┘ └─────┬──────┘ └────────────────┘ │
│                                       │                            │
│  ┌────────────┐ ┌────────────┐ ┌─────▼──────┐                    │
│  │ DynamoDB   │ │ S3 Access  │ │ VPC        │                    │
│  │ user-access│ │ Point      │ │ Endpoints  │                    │
│  └────────────┘ └────────────┘ └────────────┘                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. CDK Deployment (Recommended)

### 3.1 Bootstrap CDK (once per account)

CDK requires a bootstrap stack in each region you deploy to. This creates an S3 bucket and IAM roles for CDK asset management:

```bash
# Primary region (where FSx for ONTAP exists)
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1

# us-east-1 (required for WAF stack — CloudFront requires us-east-1 WAF)
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
```

> Skip if you've already bootstrapped these regions for other CDK projects.

### 3.2 Clone and Install

```bash
git clone https://github.com/Yoshiki0705/Permission-aware-RAG-FSxN-CDK.git
cd Permission-aware-RAG-FSxN-CDK
npm ci
```

### 3.3 Configure `cdk.context.json`

Copy the existing-environment template and fill in your values:

```bash
cp cdk.context.existing-env.example.json cdk.context.json
```

> There are two example files: `cdk.context.existing-env.example.json` (minimal, for existing FSx for ONTAP) and `cdk.context.json.example` (full reference with all features). Start with the former for bring-your-own-environment deployments.

**Minimum configuration for existing environment**:

```jsonc
{
  "projectName": "perm-rag",
  "environment": "prod",
  "imageTag": "20260712-001",

  // === Existing FSx for ONTAP (all three required together) ===
  "existingFileSystemId": "fs-0123456789abcdef0",
  "existingSvmId": "svm-0123456789abcdef0",
  "existingVolumeId": "fsvol-0123456789abcdef0",

  // === Networking (if importing existing VPC) ===
  // By default CDK creates a new VPC. To use existing:
  "existingVpcId": "vpc-0abc123def456",

  // === Security ===
  "allowedCountries": ["JP"],
  "adDomainName": "corp.example.com",

  // === Features ===
  "vectorStoreType": "s3vectors",
  "enableAgent": true
}
```

> **Note**: When `existingFileSystemId`, `existingSvmId`, and `existingVolumeId` are all set, CDK skips FSx for ONTAP, SVM, and Volume creation entirely. You must specify all three or none.

### 3.4 Build Container Image

```bash
bash demo-data/scripts/pre-deploy-setup.sh
```

This builds and pushes the Next.js container to ECR (the ECR repository is created automatically by CDK bootstrap). The script outputs the image tag — note it for the next step. Uses `--provenance=false --sbom=false` for Lambda compatibility.

> **Tip**: The `imageTag` in `cdk.context.json` must match the tag output by this script. If you set `"imageTag": "latest"`, it will always use the most recent push — but explicit tags are recommended for reproducibility.

### 3.5 Run Preflight Check

```bash
bash scripts/preflight-check.sh
```

The preflight script validates: AWS credentials, VPC existence, subnet multi-AZ, security groups, FSx for ONTAP lifecycle state, SVM/Volume consistency, VPC Endpoint conflicts, Secrets Manager secret, and CDK bootstrap status. See `scripts/preflight-check.sh --help` for skip options.

### 3.6 Deploy

```bash
# Synthesize first (validates configuration)
npx cdk synth --quiet

# Deploy all stacks (use 'broadening' for first deploy to review IAM changes)
npx cdk deploy --all --require-approval broadening
# After first successful deploy, subsequent updates can use:
# npx cdk deploy --all --require-approval never
```

**Deployment order** (automatic via CDK dependencies):

```
WafStack (us-east-1)
  → NetworkingStack
    → SecurityStack
      → StorageStack (uses existing FSx references)
        → AIStack
          → WebAppStack
```

**Estimated time**: ~15-20 minutes (vs 45-60 minutes with new FSx for ONTAP creation).

### 3.7 Post-Deployment

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

This creates Cognito users, configures KB data source, and uploads demo data. The script prints:
- **CloudFront URL** — open this in your browser
- **Demo user credentials** — username and temporary password for first sign-in
- **KB data source ID** — needed if you enable Auto-Sync later

---

## 4. CloudFormation Deployment

The `automation/fsxn-ops/cfn/fsxn-ops-stack.yaml` template deploys the FSx for ONTAP operations automation layer (capacity monitoring, auto-expansion) independently of the CDK RAG system.

### 4.1 Parameter File

Create a parameter file from the template:

```bash
cp cfn-params/existing-environment.example.json cfn-params/my-environment.json
# Edit with your values
```

### 4.2 Deploy via CLI

```bash
aws cloudformation deploy \
  --template-file automation/fsxn-ops/cfn/fsxn-ops-stack.yaml \
  --stack-name fsxn-ops-prod \
  --parameter-overrides file://cfn-params/my-environment.json \
  --capabilities CAPABILITY_IAM \
  --region ap-northeast-1
```

### 4.3 CloudFormation Parameters Reference

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| `FsxFilesystemId` | Yes | FSx for ONTAP file system ID | `fs-0123456789abcdef0` |
| `ManagementLif` | Yes | ONTAP management LIF IP | `198.51.100.10` |
| `OntapSecretId` | Yes | Secrets Manager secret ID (fsxadmin creds) | `ontap-fsxadmin-password` |
| `VpcId` | Yes | VPC ID for Lambda placement | `vpc-0abc123def456` |
| `SubnetIds` | Yes | Private subnet IDs (comma-separated) | `subnet-0aaa...,subnet-0bbb...` |
| `SecurityGroupId` | Yes | SG with HTTPS access to ONTAP mgmt LIF | `sg-0123456789abcdef0` |
| `NotificationEmail` | Yes | Alert recipient email | `ops@example.com` |
| `FsThresholdPct` | No | FS capacity alert threshold (%) | `85` |
| `VolThresholdPct` | No | Volume capacity alert threshold (%) | `80` |
| `AutoResizeEnabled` | No | Enable auto-expansion | `false` |
| `DryRun` | No | Dry-run mode (no actual changes) | `true` |
| `MonitoringIntervalMinutes` | No | Monitoring check interval | `5` |

---

## 5. VPC Endpoint Considerations

### 5.1 Interface Endpoints vs Gateway Endpoints

| Service | Endpoint Type | Required By | Notes |
|---------|--------------|-------------|-------|
| S3 | **Gateway** | KB data source, S3 Vectors | Free, route-table based |
| DynamoDB | **Gateway** | user-access table | Free, route-table based |
| Bedrock Runtime | **Interface** | Converse API, KB Retrieve | ~$0.01/hr/AZ + data |
| Secrets Manager | **Interface** | ONTAP credentials | ~$0.01/hr/AZ + data |
| STS | **Interface** | IAM role assumption | ~$0.01/hr/AZ + data |
| ECR (dkr + api) | **Interface** | Lambda image pull | ~$0.01/hr/AZ + data |

### 5.2 Conflict Prevention

If your existing VPC already has VPC Endpoints for the above services, CDK's default behavior (creating new ones) will **fail** with:

```
The VPC endpoint for this service already exists in this VPC
```

**Resolution options**:

#### Option A: Import existing endpoints (recommended)

In `cdk.context.json`:

```jsonc
{
  // Skip CDK-managed VPC Endpoint creation
  "skipVpcEndpoints": ["s3", "dynamodb", "bedrock-runtime", "secretsmanager"]
}
```

#### Option B: Use existing VPC with no endpoint conflicts

Ensure the existing VPC's route tables include the Gateway Endpoints, and Interface Endpoints are in subnets accessible to the Lambda functions.

#### Option C: Deploy into a new VPC with peering

Omit `existingVpcId` — CDK creates a dedicated VPC and you configure VPC peering or Transit Gateway to the FSx for ONTAP VPC.

### 5.3 Security Group for Interface Endpoints

Interface Endpoints require a Security Group that allows **inbound TCP 443** from the Lambda Security Group:

```bash
# Verify existing endpoint SG allows Lambda access
aws ec2 describe-security-groups --group-ids sg-ENDPOINT_SG \
  --query 'SecurityGroups[].IpPermissions[]'
```

If your environment uses a shared endpoint SG, add an ingress rule for the RAG Lambda SG (created during CDK deploy) post-deployment, or pre-create and reference it.

---

## 6. Post-Deployment Verification

Run the built-in verification:

```bash
bash demo-data/scripts/verify-deployment.sh perm-rag-prod
```

Or manually check:

```bash
# 1. Stack status
aws cloudformation describe-stacks \
  --stack-name perm-rag-prod-WebApp \
  --query 'Stacks[0].StackStatus'

# 2. Lambda health
aws lambda invoke --function-name perm-rag-prod-webapp \
  --payload '{}' /dev/null --log-type Tail \
  --query 'StatusCode'

# 3. FSx for ONTAP connectivity (from Lambda)
aws lambda invoke --function-name perm-rag-prod-webapp \
  --payload '{"healthCheck": true}' /tmp/health.json
cat /tmp/health.json

# 4. CloudFront distribution
aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='perm-rag-prod'].{Id:Id,Domain:DomainName}"
```

---

## 7. Day 2 Operations

### 7.1 KB Data Sync

| Method | Trigger | Latency | Use Case |
|--------|---------|---------|----------|
| Manual | `bash demo-data/scripts/sync-kb-datasource.sh` | On-demand | Ad-hoc updates |
| Auto-Sync | EventBridge Scheduler | 5 min (configurable) | Steady-state |
| Transfer Family | SFTP upload event | ~5 min | Partner ingestion |

### 7.2 Updating the Application

```bash
# Frontend-only update (~3 min)
bash development/scripts/deploy-webapp.sh

# Full stack update (if CDK constructs changed)
npx cdk deploy --all --require-approval never
```

### 7.3 Adding Users

```bash
# Create Cognito user + DynamoDB permission entry
bash demo-data/scripts/create-demo-users.sh
bash demo-data/scripts/setup-user-access.sh
```

### 7.4 Monitoring

When `enableMonitoring=true`:
- CloudWatch Dashboard: `{projectName}-{environment}-dashboard`
- SNS Alerts: Configured in `monitoringEmail`
- FSx for ONTAP capacity: Monitored by `fsxn-ops` Lambda (if deployed)

**Log locations**:
- Lambda application logs: CloudWatch Logs `/aws/lambda/{projectName}-{environment}-webapp`
- CDK deploy logs: Terminal output + CloudFormation console events
- ONTAP audit logs: See [Operations Runbook](operations-runbook.md) for ONTAP audit log delivery setup

### 7.5 Backup and Recovery

- **FSx for ONTAP**: Managed by existing customer backup policy (Snapshots/SnapMirror)
- **DynamoDB**: Point-in-time recovery enabled by default
- **S3 Vectors / KB**: Re-indexable from source (FSx for ONTAP volume)
- **Cognito**: Export via `aws cognito-idp list-users`

---

## 8. Cost Estimation

### Incremental cost (RAG system only, existing FSx for ONTAP excluded)

| Component | Monthly Cost (ap-northeast-1) | Notes |
|-----------|------|-------|
| Lambda (Next.js) | ~$5-30 | Depends on traffic |
| S3 Vectors | ~$5-20 | Depends on document count |
| Bedrock KB (Titan Embeddings) | ~$10-50 | Per ingestion job |
| Bedrock Converse (Claude) | ~$20-200 | Per query volume |
| CloudFront | ~$5-20 | Data transfer |
| Cognito | Free (< 50K MAU) | |
| DynamoDB | ~$5-10 | On-demand, small table |
| WAF | ~$6 | Web ACL + rules |
| VPC Endpoints (Interface) | ~$15-45 | Per endpoint per AZ |
| **Total (light usage)** | **~$70-150/month** | 1,000 queries/day |
| **Total (medium usage)** | **~$200-500/month** | 10,000 queries/day |

> **Cost note**: The largest variable cost is Bedrock model invocation. Use Smart Routing to direct simple queries to lower-cost models (Haiku) and reserve expensive models (Sonnet/Opus) for complex queries. First-month costs may be higher due to initial full ingestion of all documents — subsequent months only process incremental changes.

### Time to Deploy

| Phase | Duration | Notes |
|-------|----------|-------|
| Preflight check | 2-3 min | Automated validation |
| ECR image build | 3-5 min | Docker cross-compile |
| CDK deploy (existing FSx for ONTAP) | 15-20 min | Skips FSx creation |
| CDK deploy (new FSx for ONTAP) | 45-60 min | Includes FSx provisioning |
| Post-deploy setup | 5-10 min | Users, KB data source, demo data |

---

## 9. Troubleshooting

| Symptom | Cause | Resolution |
|---------|-------|------------|
| `VPC endpoint already exists` | Existing endpoint conflicts | Set `skipVpcEndpoints` in context |
| `Cannot resolve FSx file system` | Wrong FS ID or region | Verify `existingFileSystemId` matches region |
| `Lambda timeout on ONTAP call` | SG missing HTTPS to mgmt LIF | Add TCP 443 rule from Lambda SG to ONTAP mgmt |
| `S3 Access Point 403` | Missing IAM or AP policy | Check `s3:GetObject` on AP ARN |
| `KB ingestion returns 0 docs` | Missing `.metadata.json` | Run `upload-demo-data-s3ap.sh` (generates metadata) |
| `Cognito callback mismatch` | CloudFront URL not set | Set `cloudFrontUrl` in context |
| CDK synth: `All three existing IDs required` | Partial specification | Set all of `existingFileSystemId`, `existingSvmId`, `existingVolumeId` or none |

---

## 10. Cleanup / Teardown

To remove all RAG system resources without affecting your existing FSx for ONTAP:

```bash
# Destroy all CDK stacks (reverse order, ~10-15 min)
npx cdk destroy --all --force

# If fsxn-ops CFn stack was deployed separately:
aws cloudformation delete-stack --stack-name fsxn-ops-prod --region ap-northeast-1
```

**What is removed**: CloudFront, WAF, Lambda, Cognito, DynamoDB, S3 (vectors), VPC Endpoints (if CDK-created), Bedrock KB.

**What is NOT removed**: Your existing FSx for ONTAP file system, SVM, volumes, VPC, subnets, and security groups are untouched. CDK bootstrap stacks (`CDKToolkit`) remain for future use.

> **Caution**: `cdk destroy` deletes the Cognito User Pool permanently. Export user data first if needed: `aws cognito-idp list-users --user-pool-id <pool-id>`

---

## 11. FAQ

### Can I use an existing Cognito User Pool?

Not currently. The CDK stack creates and manages its own User Pool with the required custom attributes (SID, UID, GID mappings). You can federate an existing IdP into the created pool via SAML or OIDC.

### Can I deploy into a different region than my FSx for ONTAP?

No. The RAG Lambda must have network connectivity to the FSx for ONTAP management LIF via the VPC. Cross-region VPC peering adds latency and complexity. Deploy in the same region as FSx for ONTAP.

### What if my FSx for ONTAP uses Multi-Protocol (NFS + SMB)?

Fully supported. Configure `volumeSecurityStyle: "NTFS"` for Windows ACL semantics or `"UNIX"` for POSIX. The permission-aware retrieval handles both.

### How do I update the RAG system without affecting existing FSx for ONTAP?

CDK only references existing FSx for ONTAP resources by ID — it never modifies them. Updates to the RAG stacks (Lambda, KB, UI) are independent of FSx for ONTAP operations.

### Can I run the preflight check without deploying?

Yes. `scripts/preflight-check.sh` is read-only and makes no changes. It validates connectivity and configuration before you commit to deployment.

### What are the requirements for the existing ONTAP volume?

The volume must:
- Be in `CREATED` lifecycle state
- Have a junction path (e.g., `/vol1`) — the S3 Access Point maps to this path
- Be accessible from the SVM's data LIF
- Have appropriate export policy (NFS) or CIFS share (SMB) for data access

CDK does NOT modify junction paths, export policies, or CIFS shares. It creates an S3 Access Point that provides S3-compatible read access to the volume contents via the FSx for ONTAP S3 AP feature.

### Can I use multiple volumes?

Currently, the CDK stack references a single volume for the primary Knowledge Base data source. To index multiple volumes, you can either:
1. Create additional S3 Access Points manually and add them as KB data sources post-deploy
2. Use a single volume with multiple qtrees/directories for department-level separation

### What is "FSx for ONTAP S3 Access Point"?

FSx for ONTAP S3 AP is a feature that exposes ONTAP volume data through the S3 API. It allows AWS services (like Bedrock Knowledge Base) to read files from your ONTAP volume using standard S3 `GetObject`/`ListObjectsV2` calls, without requiring NFS/SMB mounts. The S3 Access Point is created post-deploy and respects NTFS ACLs or UNIX permissions on the underlying files.

---

## Next Steps

After successful deployment:

1. **Explore the UI** — Open the CloudFront URL, sign in, and try asking questions about your documents
2. **Upload your own data** — Use `demo-data/scripts/upload-demo-data-s3ap.sh` as a reference for ingesting production files
3. **Configure permissions** — Set up user-to-SID/UID/GID mappings in DynamoDB for access control
4. **Enable features** — Review feature flags in `cdk.context.json.example` and enable Agent, Monitoring, or Guardrails as needed
5. **Production hardening** — See [Production Readiness Checklist](production-readiness-checklist.md)

---

## Appendix A: Fresh Deploy (New FSx for ONTAP)

Minimal configuration for deploying from scratch without an existing FSx for ONTAP:

```jsonc
{
  "projectName": "rag-demo",
  "environment": "demo",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"],
  // AD integration (optional):
  // "adPassword": "YourStrongP@ssw0rd123",
  // "adDomainName": "demo.local"
}
```

When `existingFileSystemId` / `existingSvmId` / `existingVolumeId` are omitted, CDK creates a new FSx for ONTAP file system, SVM, and volume. Estimated time: 45-60 minutes.

Deployment commands remain the same:

```bash
bash demo-data/scripts/pre-deploy-setup.sh
npx cdk deploy --all --require-approval never
bash demo-data/scripts/post-deploy-setup.sh
```

> **Note**: Fresh FSx for ONTAP creation defaults to NTFS security style. Set `volumeSecurityStyle: "UNIX"` for POSIX-based permissions.

---

## Appendix B: Feature Flags Reference

For the complete feature flags reference, see:

- **`cdk.context.json.example`** — Fully commented template (repo root)
- **[AGENTS.md](../AGENTS.md)** — Feature Flags section with flags, defaults, and descriptions

Key flags (excerpt):

| Flag | Default | Description |
|------|---------|-------------|
| `enableAgent` | `false` | Bedrock Agent (KB search + multi-step reasoning) |
| `enableGuardrails` | `false` | Bedrock Guardrails (content filter + PII) |
| `enableMonitoring` | `false` | CloudWatch dashboard + SNS alerts |
| `enableTransferFamily` | `false` | SFTP ingestion pipeline |
| `enableKbAutoSync` | `false` | File change detection + KB auto-sync |
| `enableVoiceChat` | `false` | Voice chat (Nova Sonic) |
| `enableAgentCoreGateway` | `false` | AgentCore Gateway + Permission Interceptor |
| `vectorStoreType` | `s3-vectors` | Vector store selection (`s3-vectors` / `opensearch-serverless`) |
| `kbSearchType` | `SEMANTIC` | Search type (`SEMANTIC` / `HYBRID`) |

---

## Appendix C: WAF & Geo Restrictions

CloudFront WAF (us-east-1) consists of 6 rules:

| Priority | Rule | Description |
|----------|------|-------------|
| 100 | RateLimit | Block after 3000 requests in 5 minutes |
| 200 | AWSIPReputationList | Block malicious IPs |
| 300 | AWSCommonRuleSet | OWASP Top 10 compliant (with exclusions) |
| 400 | AWSKnownBadInputs | Known vulnerabilities (Log4j etc.) |
| 500 | AWSSQLiRuleSet | SQL injection |
| 600 | IPAllowList | Active only when `allowedIps` is set |

**Geo restriction**: `allowedCountries` specifies allowed countries (default: `["JP"]`). Empty array allows worldwide access.

Customize by editing `lib/stacks/demo/demo-waf-stack.ts` directly.

---

## Appendix D: Auth Mode Configuration

For detailed auth mode configuration examples (AD Federation / OIDC / LDAP / Multi-IdP), see:

- [Auth & User Management Guide](en/auth-and-user-management.md) — Full technical details for all modes
- [Auth Mode Setup Guide](../demo-data/guides/auth-mode-setup-guide.md) — One-shot setup scripts included

---

## Related Documents

- [Cost Estimation Worksheet](cost-estimation-worksheet.md)
- [Operations Runbook](operations-runbook.md)
- [Partner Deployment Patterns](partner-deployment-patterns.md)
- [Transfer Family Networking Prerequisites](transfer-family-networking-prerequisites.md)
- [Production Readiness Checklist](production-readiness-checklist.md)
- [Deployment Troubleshooting](deployment-troubleshooting.md)
