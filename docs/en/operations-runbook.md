# Operations Runbook

**🌐 Language:** [日本語](../operations-runbook.md) | **English**

**Created**: 2026-06-08  
**Status**: Operational  
**Audience**: Operations staff, Developers, Partners

---

## Overview

Runbook consolidating daily operations, verification, and troubleshooting procedures for the Permission-aware RAG system. Knowledge gained from deployment verification is systematized into reproducible procedures.

---

## 1. ONTAP Version Check

### Background

S3 Access Points require ONTAP 9.14.1+. The FSx for ONTAP AWS API (`describe-file-systems`) does not return version information, requiring direct access to the ONTAP REST API.

### Prerequisites

- FSx Management endpoint IP (e.g., `10.0.3.72`)
- `fsxadmin` password (stored in Secrets Manager)
- SSM-enabled instance in the same VPC (Management endpoint is Private IP only)

### Procedure

```bash
# Step 1: Retrieve fsxadmin password from Secrets Manager
FSX_PASS=$(aws secretsmanager get-secret-value \
  --secret-id fsx-ontap-fsxadmin-credentials \
  --region ap-northeast-1 \
  --query SecretString --output text \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['password'])")

# Step 2: Access ONTAP REST API from instance in same VPC
INSTANCE_ID="<SSM-enabled-instance-id>"
MGMT_IP="10.0.3.72"

CMD_ID=$(aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters "commands=[\"curl -sk -u 'fsxadmin:${FSX_PASS}' 'https://${MGMT_IP}/api/cluster?fields=version'\"]" \
  --region ap-northeast-1 \
  --query 'Command.CommandId' --output text)

# Step 3: Get results (wait 5-10 seconds)
sleep 5
aws ssm get-command-invocation \
  --command-id $CMD_ID \
  --instance-id $INSTANCE_ID \
  --region ap-northeast-1 \
  --query 'StandardOutputContent' --output text | python3 -m json.tool
```

### Expected Output

```json
{
  "version": {
    "full": "NetApp Release 9.17.1P6: Wed Mar 25 15:38:10 UTC 2026",
    "generation": 9,
    "major": 17,
    "minor": 1
  }
}
```

### Notes

- Management endpoint Security Group must allow HTTPS (443) inbound
- The SSM instance IAM role does NOT need `secretsmanager:GetSecretValue` (password is retrieved locally and embedded in SSM command)
- `curl -sk`: `-s` (silent), `-k` (allow self-signed cert)

---

## 2. Industry-Packs Demo Data Ingestion

### Background

7 industries × 5 documents = 35 documents + 35 metadata files for Permission-aware RAG demo across industries.

### Procedure

```bash
S3AP_ALIAS="<S3 AP Alias>"
KB_ID="<Knowledge Base ID>"
DS_ID="<DataSource ID>"

# Step 1: Upload industry-packs via S3 AP
aws s3 sync demo-data/industry-packs/ \
  "s3://${S3AP_ALIAS}/industry-packs/" \
  --region ap-northeast-1 \
  --exclude "README.md" --exclude "DISCLAIMER.md"

# Step 2: Verify upload
aws s3 ls "s3://${S3AP_ALIAS}/industry-packs/" --recursive --region ap-northeast-1 | wc -l
# Expected: 70 files

# Step 3: Trigger KB sync (ingestion)
JOB_ID=$(aws bedrock-agent start-ingestion-job \
  --knowledge-base-id $KB_ID \
  --data-source-id $DS_ID \
  --region ap-northeast-1 \
  --query 'ingestionJob.ingestionJobId' --output text)

# Step 4: Wait for completion
for i in $(seq 1 60); do
  sleep 10
  STATUS=$(aws bedrock-agent get-ingestion-job \
    --knowledge-base-id $KB_ID --data-source-id $DS_ID \
    --ingestion-job-id $JOB_ID --region ap-northeast-1 \
    --query 'ingestionJob.status' --output text)
  echo "[$i] $STATUS"
  if [ "$STATUS" = "COMPLETE" ] || [ "$STATUS" = "FAILED" ]; then break; fi
done
```

### Industry SID Mapping

| Industry | Folder | SID (besides Domain Admins) |
|----------|--------|--------------------------|
| Construction | `construction/` | `-8100` |
| Education | `education/` | `-2200` |
| Government | `government/` | `-2100` |
| Healthcare | `healthcare/` | `-2200` |
| Insurance | `insurance/` | `-8200` |
| Legal | `legal/` | `-8300` |
| Manufacturing | `manufacturing/` | `-2300` |

---

## 3. WebApp Docker Build & Deploy

### Background

After source code changes, Docker layer cache reuses old sources. Defaulting to `--no-cache` resolves this.

### Recommended Procedure

```bash
# Use the local script (development/ is gitignored)
./development/scripts/deploy-webapp.sh

# Default: builds with --no-cache
# To use cache: ./development/scripts/deploy-webapp.sh --use-cache
```

### Troubleshooting: Changes Not Reflected

| Cause | Check | Solution |
|-------|-------|----------|
| Docker layer cache | `docker images` timestamp | Rebuild with `--no-cache` |
| ECR `latest` tag stale | `aws ecr describe-images` digest | Use explicit tags |
| Lambda still updating | `get-function` LastUpdateStatus | `wait function-updated` |
| CloudFront cache | Browser DevTools network tab | `create-invalidation` |
| `.next` cache | `docker/nextjs/.next/` exists | `rm -rf docker/nextjs/.next` then rebuild |

---

## 4. Permission Filter Debug

### Verification Steps

```bash
# Check user SIDs in DynamoDB
aws dynamodb get-item \
  --table-name "<user-access-table>" \
  --key '{"userId":{"S":"admin@example.com"}}' \
  --region ap-northeast-1

# Retrieve document metadata from KB
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id $KB_ID \
  --region ap-northeast-1 \
  --retrieval-query '{"text":"test query"}' \
  --retrieval-configuration '{"vectorSearchConfiguration":{"numberOfResults":5}}' \
  --query 'retrievalResults[].metadata.allowed_group_sids'
```

### Metadata Format Variations

| Format | Example | Parse Method |
|--------|---------|-------------|
| Array | `["S-1-1-0", "S-1-5-21-xxx-512"]` | Use directly |
| Comma-separated string | `"S-1-1-0,S-1-5-21-xxx-512"` | `.split(',')` |
| JSON string | `"[\"S-1-1-0\"]"` | `JSON.parse()` |
| Single value | `"S-1-1-0"` | `[value]` |

---

## 5. Prompt Caching Verification

### Prerequisites

- **Anthropic Claude models only** (Nova, OpenAI not supported)
- Claude Sonnet 4.6 or Opus 4.8 selected in UI
- Bedrock Prompt Cache TTL: 5 minutes (ephemeral)

### Check Procedure

```bash
# Check CloudWatch Logs for cache hits
aws logs filter-log-events \
  --log-group-name "/aws/lambda/<webapp-function>" \
  --filter-pattern '"Cache hit"' \
  --start-time $(date -u -d '10 minutes ago' +%s000) \
  --region ap-northeast-1
```

### Cache Not Working?

| Cause | Check |
|-------|-------|
| Using Nova / OpenAI model | Check response `modelId` |
| System prompt < 2048 chars | Check `prompt-templates.ts` size |
| Query interval > 5 min | Check CloudWatch log timestamps |
| Different user session | Prompt Cache is per user×model |

---

## 6. Full Deployment Verification Checklist

```bash
# === Basic Operation ===
# [ ] CDK deploy all stacks success
# [ ] Lambda update confirmed
# [ ] CloudFront health check

# === Permission-Aware RAG ===
# [ ] KB Retrieve (admin SID — full access)
# [ ] KB Retrieve (regular user SID — restricted)
# [ ] Fail-Closed (no metadata → access denied)

# === Model & Routing ===
# [ ] Default model (Nova 2 Lite) response
# [ ] Claude model Prompt Caching
# [ ] Smart Routing Auto Mode

# === UI/UX ===
# [ ] Sign-in page
# [ ] Chat input & response
# [ ] Citation display
# [ ] Permission badge
# [ ] Model indicator

# === Audit & Security ===
# [ ] CloudWatch Logs output
# [ ] DynamoDB user access table
# [ ] EMF metrics (RAG/TokenUsage, SmartRouting)
```

---

## Related Documents

- [Deployment Troubleshooting](../deployment-troubleshooting.md) — Error-specific solutions
- [Production Readiness Checklist](../production-readiness-checklist.md) — Pre-production requirements
- [Cost Estimation Worksheet](../cost-estimation-worksheet.md) — Monthly cost estimates
- [metadata-json-schema](../metadata-json-schema.md) — .metadata.json formal spec
