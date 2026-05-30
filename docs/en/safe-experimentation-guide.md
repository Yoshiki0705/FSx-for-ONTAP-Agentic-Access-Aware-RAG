# Safe Experimentation Guide

**🌐 Language:** [日本語](../safe-experimentation-guide.md) | **English** | [한국어](../ko/safe-experimentation-guide.md) | [简体中文](../zh-CN/safe-experimentation-guide.md) | [繁體中文](../zh-TW/safe-experimentation-guide.md) | [Français](../fr/safe-experimentation-guide.md) | [Deutsch](../de/safe-experimentation-guide.md) | [Español](../es/safe-experimentation-guide.md)

**Created**: 2026-05-21  
**Status**: Draft  
**Audience**: PoC users, developers, evaluators

---

## Overview

This document provides scope definitions, prohibited actions, and rollback procedures for safely experimenting with the Permission-aware RAG system. It clarifies "an environment where you can trial-and-error within the boundaries of Responsible AI policies and security."

---

## Safe Experimentation Scope

### ✅ Recommended: Experiment with Demo Data Only

| Operation | Risk | Notes |
|-----------|------|-------|
| Search testing with demo data | None | Verify operation with bundled sample data |
| Permission verification via user switching | None | Confirm search result differences between admin / user |
| Agent mode experimentation | None | Agent creation and testing in Agent Directory |
| UI customization | None | Changes to Next.js source |
| CDK parameter changes | Low | Changes to `cdk.context.json` → redeploy |
| Adding new documents | Low | Adding to demo data folder |
| Guardrails policy adjustments | Low | Changes to `guardrailsConfig` |
| Smart Routing ON/OFF | None | Sidebar toggle |
| Model selection changes | Low | Cost variation possible |
| Voice chat experimentation | Low | Enable with `enableVoiceChat=true` |

### ⚠️ Caution: Checklist Before Real Data Ingestion

Verify the following before ingesting actual business data:

- [ ] **Data classification completed**: Confidentiality level of data to be ingested has been classified
- [ ] **PII verification**: If personal information is included, masking or approval is complete
- [ ] **Permission design verification**: `allowed_group_sids` in `.metadata.json` is correctly configured
- [ ] **Audit logging enabled**: CloudWatch Logs / CloudTrail are enabled
- [ ] **Access restrictions verified**: WAF / Geo restrictions / IP restrictions are appropriately configured
- [ ] **Backup verification**: FSx automatic backup is enabled
- [ ] **User notification**: PoC participants have been informed of data handling rules
- [ ] **Data deletion procedure confirmed**: Data deletion procedure after PoC completion has been confirmed

### ❌ Prohibited Actions

| Prohibited Action | Reason | Alternative |
|-------------------|--------|-------------|
| Direct connection to production AD (PoC stage) | Risk of impact to production environment | Use test AD / Cognito email authentication |
| Ingesting PII-unclassified data | Personal information leakage risk | Ingest after PII scan |
| Using confidential data without audit logging | Compliance violation | Ingest after enabling audit logs |
| Storing confidential data without encryption | Data leakage risk | Set `enableKmsEncryption=true` |
| Allowing access from public internet | Unauthorized access risk | Use IP restrictions / VPN |
| Running PoC in production account | Impact to production environment | Use sandbox account |
| Using confidential data with Guardrails disabled | Risk of inappropriate answer generation | Set `enableGuardrails=true` |

---

## Procedure for Experimenting with Demo Data Only

### Step 1: Deploy with Minimal Configuration

```bash
# Minimal cdk.context.json
cat > cdk.context.json << 'EOF'
{
  "projectName": "rag-poc",
  "environment": "poc",
  "imageTag": "latest",
  "allowedIps": ["YOUR_IP/32"],
  "allowedCountries": ["JP"]
}
EOF

# Deploy
npx cdk deploy --all --require-approval never

# Test data + user creation
bash demo-data/scripts/post-deploy-setup.sh
```

### Step 2: Verify Operation

```bash
# Get CloudFront URL
URL=$(aws cloudformation describe-stacks \
  --stack-name rag-poc-poc-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text)

echo "Access URL: $URL"
```

### Step 3: Verify Permission Filtering

1. Sign in as `admin@example.com` → All documents are searchable
2. Sign in as `user@example.com` → Only public documents are searchable
3. Confirm different answers are returned for the same question

### Step 4: Evaluation

Conduct PoC evaluation using the evaluation template in [evaluation.md](evaluation.md).

---

## Real Data Ingestion Procedure (After Checklist Completion)

### Step 1: Data Preparation

```bash
# 1. Classify documents
# Create .metadata.json for each document
cat > document.metadata.json << 'EOF'
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-5-21-...-512", "S-1-1-0"],
    "access_level": "confidential",
    "doc_type": "report"
  }
}
EOF

# 2. PII scan (recommended)
# Detect PII with Amazon Comprehend
aws comprehend detect-pii-entities \
  --text "$(cat document.txt)" \
  --language-code ja
```

### Step 2: Data Ingestion

```bash
# Place files on FSx volume (via SMB)
# Or use S3 bucket fallback path
aws s3 cp ./documents/ s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive
```

### Step 3: KB Sync

```bash
# Execute KB sync
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>

# Wait for sync completion
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --ingestion-job-id <JOB_ID>
```

### Step 4: Permission Testing

```bash
# Execute permission matrix tests
cd tests/permission-matrix
python3 -m pytest test_permission_scenarios.py -v
```

---

## Rollback / Environment Deletion Procedure

### Partial Rollback (Data Only Deletion)

```bash
# 1. Clear KB data source sync
aws bedrock-agent delete-data-source \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>

# 2. Delete S3 bucket data
aws s3 rm s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive

# 3. Delete DynamoDB user data
aws dynamodb scan --table-name rag-poc-poc-user-access \
  --projection-expression "userId" \
  | jq -r '.Items[].userId.S' \
  | xargs -I {} aws dynamodb delete-item \
    --table-name rag-poc-poc-user-access \
    --key '{"userId": {"S": "{}"}}'
```

### Complete Deletion (All Resources)

```bash
# 1. Empty S3 bucket (if versioning is enabled)
aws s3 rm s3://rag-poc-poc-kb-data-ACCOUNT_ID/ --recursive
aws s3api list-object-versions --bucket rag-poc-poc-kb-data-ACCOUNT_ID \
  | jq -r '.Versions[]? | "--key \(.Key) --version-id \(.VersionId)"' \
  | xargs -I {} aws s3api delete-object --bucket rag-poc-poc-kb-data-ACCOUNT_ID {}

# 2. CDK destroy (delete all stacks)
npx cdk destroy --all --force

# 3. Delete CDK Bootstrap resources (if needed)
# ⚠️ Do not delete if other CDK projects exist
# aws cloudformation delete-stack --stack-name CDKToolkit
```

### Cost Cleanup Verification

```bash
# Check for remaining resources
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=rag-poc \
  --region ap-northeast-1

# Check FSx file systems (deletion takes time)
aws fsx describe-file-systems --region ap-northeast-1

# Check OpenSearch Serverless collections
aws opensearchserverless list-collections --region ap-northeast-1
```

---

## Troubleshooting

### Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Deployment takes over 40 minutes | FSx for ONTAP creation takes time | Normal. FSx creation takes 20–30 min |
| Search returns 0 results | KB sync incomplete or data source not configured | Verify `StartIngestionJob` execution |
| Same results for all users | SID data not registered | Check DynamoDB `user-access` table |
| Fail-Closed denies everything | DynamoDB connection error or no SID record | Check Lambda logs |
| Agent not working | Agent not created or not in PREPARED state | Check Agent status in Bedrock console |
| Cost higher than expected | OpenSearch Serverless OCU | Switch to `vectorStoreType=s3vectors` |

### Support Resources

| Resource | URL |
|----------|-----|
| GitHub Issues | Repository Issues tab |
| AWS Documentation (Bedrock) | https://docs.aws.amazon.com/bedrock/ |
| AWS Documentation (FSx for ONTAP) | https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/ |

---

## Related Documents

| Document | Description |
|----------|-------------|
| [evaluation.md](evaluation.md) | RAG / Agent Evaluation Metrics |
| [production-readiness-checklist.md](production-readiness-checklist.md) | Production Readiness Checklist |
| [governance-and-audit.md](governance-and-audit.md) | Governance and Audit Design |
| [permission-consistency.md](permission-consistency.md) | Permission Change Consistency Model |
