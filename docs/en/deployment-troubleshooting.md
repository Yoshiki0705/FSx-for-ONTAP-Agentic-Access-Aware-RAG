# Deployment Troubleshooting

**🌐 Language:** [日本語](../deployment-troubleshooting.md) | **English**

This document covers known issues and their solutions when deploying to AWS environments.

---

## 1. Deployment Blocked by CloudFormation Guard Hook

### Symptoms

All resource creation fails with the following error during `cdk deploy`:

```
Resource handler returned message: "Guard Hook FSxNS3AP::Guard::Hook failed with status: FAILED. 
Reason: ruleLocation contains invalid extension type"
```

### Cause

A CloudFormation Guard Hook `FSxNS3AP::Guard::Hook` registered by another project (e.g., FSx for ONTAP S3 Access Point validation) is active in the account. This hook evaluates all CloudFormation resource creation, but due to issues in its rule definition, it blocks all resources.

### Solution

#### Before Deployment: Deactivate the Guard Hook

```bash
aws cloudformation deactivate-type \
  --type HOOK \
  --type-name "FSxNS3AP::Guard::Hook" \
  --region ap-northeast-1
```

#### After Deployment: Reactivate the Guard Hook

If the Guard Hook is needed for other projects, reactivate it after deployment:

```bash
aws cloudformation activate-type \
  --type HOOK \
  --type-name "FSxNS3AP::Guard::Hook" \
  --region ap-northeast-1
```

### Verification

Check active Hooks in the account:

```bash
aws cloudformation list-types \
  --type HOOK \
  --visibility PRIVATE \
  --filters TypeNamePrefix=FSxNS3AP \
  --region ap-northeast-1
```

### Prevention

- Check active Hooks with `aws cloudformation list-types --type HOOK` before deployment
- Add a hook verification step to CI/CD pipelines
- Fix the Guard Hook rule definition to set correct extension filters

---

## 2. Smart Routing Auto Mode Behavior

### Overview

Smart Routing's Auto Mode is only enabled when the user explicitly clicks the "⚡Auto" button.

### Behavior Matrix

| Smart Routing | Model Selection | Behavior |
|---------------|----------------|----------|
| OFF | Any | Uses manually selected model |
| ON + Manual model selection | Selected from list | "Manual override active" — uses manually selected model |
| ON + "⚡Auto" clicked | Automatic | 3-tier automatic routing based on query complexity |

### UX Flow

1. Turn ON the Smart Routing toggle in the sidebar
2. A "⚡ Auto" option appears in the ModelSelector
3. Clicking "⚡ Auto" activates Auto Mode
4. Selecting another model from the list returns to Manual Override

### Notes

- Even with Smart Routing ON, automatic routing does not occur if a model is manually selected
- This is intentional design (respecting the user's explicit choice)
- The "Auto" badge in response metadata only appears during automatic routing

---

## 3. Full-Context Classification Trigger Conditions

### Overview

The 3-tier routing's `full-context` classification is triggered only when **both conditions** are met simultaneously:

### Conditions

1. **Document analysis intent keywords**: The query contains specific keywords
2. **Context size > 4000 characters**: Context from RAG search results exceeds 4000 characters

### Document Analysis Intent Keywords

#### Japanese
- この文書を要約
- レポート全体を分析
- 文書全体
- ドキュメントを要約
- 全文を分析
- 資料全体
- 報告書を要約
- ファイル全体

#### English
- summarize this document
- analyze the full report
- summarize the entire
- analyze the whole
- full document analysis
- review the complete
- process the entire

### Important Constraints

- **When no RAG search results exist (contextSize=0)**: Even if keywords are present, it will NOT be classified as `full-context`
- **When keywords are absent**: Even with large context, it will NOT be classified as `full-context`
- **When only one condition is met**: Classified as `simple` or `complex` (existing 2-tier logic)

### Design Intent (Property 3)

This "both conditions required" design is guaranteed by Property-Based Test Property 3:

> *For any* query string that either (a) lacks all Document_Analysis_Intent keywords OR (b) has a context size less than or equal to the configured threshold, the `classifyQuery` function SHALL NOT return `classification: 'full-context'`.

This prevents short questions that merely contain keywords from being unnecessarily routed to the heavy model (Opus).

### Current Limitations

In the current implementation, `routeQuery()` is called **before** RAG search, so the `contextSize` parameter uses the default value of 0. This means full-context routing will not trigger on the initial query.

**Workaround**: By passing the length of conversation context (recent messages from AgentCore Memory) as `contextSize`, full-context routing may trigger for queries later in the conversation.

---

## 4. GPT-5.5 Availability Error

### Symptoms

An inline error is displayed when selecting GPT-5.5 in the ModelSelector.

### Cause

GPT-5.5 availability varies by region. When selected, `ModelAccessVerifier` verifies availability in real-time and displays an error if unavailable, reverting to the previous model selection.

### Solution

- Select a region where GPT-5.5 is available
- Or use a different model

### Notes

- GPT-5.5 is manual selection only (not eligible for automatic routing)
- Per Property 6, Smart Routing Auto Mode will never select GPT-5.5

---

## 5. CloudWatch Metrics Not Displaying

### Verification Items

1. **Namespace**: `SmartRouting`
2. **Dimension**: `RoutingTier` (values: `simple`, `complex`, `full-context`, `manual`)
3. **Metric name**: `RoutingCount`

### Troubleshooting

```bash
# Verify metrics exist
aws cloudwatch list-metrics \
  --namespace SmartRouting \
  --region ap-northeast-1

# Check recent data points
aws cloudwatch get-metric-statistics \
  --namespace SmartRouting \
  --metric-name RoutingCount \
  --dimensions Name=RoutingTier,Value=simple \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region ap-northeast-1
```

### Notes

- EMF metrics are automatically extracted from Lambda CloudWatch Logs
- There is a lag of several minutes before metrics appear
- Verify that EMF JSON is being output in Lambda execution logs

---

## 6. Pre-Deployment Checklist

```bash
# 1. Check Guard Hooks
aws cloudformation list-types --type HOOK --visibility PRIVATE --region ap-northeast-1

# 2. Verify Bedrock model access
aws bedrock list-foundation-models --region ap-northeast-1 \
  --query 'modelSummaries[?contains(modelId, `opus`)].modelId'

# 3. Review changes with CDK diff
npx cdk diff --all

# 4. Execute deployment
npx cdk deploy --all --require-approval never
```

---

## 7. Guard Hook Reactivation Procedure (Post-Deployment)

After deployment, reactivate the Guard Hook if needed for other projects:

```bash
aws cloudformation activate-type \
  --type HOOK \
  --type-name "FSxNS3AP::Guard::Hook" \
  --region ap-northeast-1
```

⚠️ **Warning**: If the Guard Hook rule definition has issues ("ruleLocation contains invalid extension type"), reactivating it will block other deployments as well. Fix the rule definition before reactivating.

---

## 8. S3 Access Point Creation CLI Syntax

### Overview

When creating FSx for ONTAP S3 Access Points via CLI, the correct syntax must be used. Use `--generate-cli-skeleton` to verify the exact format.

### Correct CLI Syntax

```bash
# Check skeleton (verify correct parameter structure)
aws fsx create-and-attach-s3-access-point --generate-cli-skeleton

# For UNIX user type
aws fsx create-and-attach-s3-access-point \
  --name "my-s3-access-point" \
  --type ONTAP \
  --ontap-configuration '{
    "VolumeId": "fsvol-0123456789abcdef0",
    "FileSystemIdentity": {
      "Type": "UNIX",
      "UnixUser": {"Name": "root"}
    }
  }' \
  --region ap-northeast-1

# For WINDOWS user type (SVM must be AD-joined)
aws fsx create-and-attach-s3-access-point \
  --name "my-s3-access-point" \
  --type ONTAP \
  --ontap-configuration '{
    "VolumeId": "fsvol-0123456789abcdef0",
    "FileSystemIdentity": {
      "Type": "WINDOWS",
      "WindowsUser": {"Name": "Admin"}
    }
  }' \
  --region ap-northeast-1
```

### Important Notes

- `--type ONTAP` is required (omitting it causes an error)
- `--ontap-configuration` is specified as a JSON string
- Do not include domain prefix (e.g., `DEMO\Admin`) for WINDOWS users. Specify only the username (e.g., `Admin`)
- Creation takes several minutes. Verify `Lifecycle: AVAILABLE` with `describe-s3-access-point-attachments`

### Check Creation Status

```bash
aws fsx describe-s3-access-point-attachments \
  --region ap-northeast-1 \
  --query "S3AccessPointAttachments[?Name=='my-s3-access-point'].[Lifecycle,S3AccessPoint.Alias]" \
  --output table
```

---

## 9. Bedrock KB Data Source and S3 Access Point Alias

### Overview

The Bedrock Knowledge Base `CreateDataSource` API does not accept S3 Access Point ARNs directly. Instead, you must specify the S3 AP **alias** in standard bucket ARN format.

### Important Integration Pattern

```
❌ Wrong: Specify S3 Access Point ARN directly
   arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-s3-access-point

✅ Correct: Specify S3 AP alias in bucket ARN format
   arn:aws:s3:::{alias}
   Example: arn:aws:s3:::my-s3-access-point-abc123def-s3alias
```

### Procedure

```bash
# 1. Get S3 AP alias
S3AP_ALIAS=$(aws fsx describe-s3-access-point-attachments \
  --region ap-northeast-1 \
  --query "S3AccessPointAttachments[?Name=='my-s3-access-point'].S3AccessPoint.Alias" \
  --output text)

echo "S3 AP Alias: $S3AP_ALIAS"

# 2. Use alias as bucket ARN when creating Bedrock KB Data Source
aws bedrock-agent create-data-source \
  --knowledge-base-id "KB_ID" \
  --name "fsx-ontap-datasource" \
  --data-source-configuration '{
    "type": "S3",
    "s3Configuration": {
      "bucketArn": "arn:aws:s3:::'$S3AP_ALIAS'"
    }
  }' \
  --region ap-northeast-1
```

### Integration with KB Auto-Sync

Specify the Data Source ID created above in the KB Auto-Sync `kbDataSourceId` parameter.

```bash
# Check Data Source ID
aws bedrock-agent list-data-sources \
  --knowledge-base-id "KB_ID" \
  --region ap-northeast-1 \
  --query "dataSourceSummaries[].dataSourceId" --output text
```

---

## 10. Lambda invoke Encoding Issue (macOS)

### Symptoms

When specifying `--payload` inline with `aws lambda invoke` in a macOS/zsh environment, encoding errors occur (invalid characters like '²' are injected).

### Cause

The macOS shell (zsh) may convert the encoding of the payload string.

### Solution

Add the `--cli-binary-format raw-in-base64-out` flag:

```bash
# ❌ May cause encoding issues
aws lambda invoke \
  --function-name perm-rag-demo-demo-kb-auto-sync \
  --payload '{}' \
  /tmp/response.json

# ✅ Correct method
aws lambda invoke \
  --function-name perm-rag-demo-demo-kb-auto-sync \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/response.json

# Check response
cat /tmp/response.json | python3 -m json.tool
```

### Alternative Method

Reading the payload from a file also works:

```bash
echo '{}' > /tmp/payload.json
aws lambda invoke \
  --function-name perm-rag-demo-demo-kb-auto-sync \
  --payload file:///tmp/payload.json \
  /tmp/response.json
```

---

## 11. KB Auto-Sync Verification Commands

### Manual Lambda Execution

```bash
# Manual trigger
aws lambda invoke \
  --function-name perm-rag-demo-demo-kb-auto-sync \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/kb-sync-response.json \
  --region ap-northeast-1

# Check response
cat /tmp/kb-sync-response.json | python3 -m json.tool
# Expected output: {"statusCode": 200, "scannedFiles": N, "changedFiles": M, "ingestionJobId": "...", "durationMs": ...}
```

### DynamoDB Inventory Check

```bash
# Check inventory table item count
aws dynamodb scan \
  --table-name perm-rag-demo-demo-kb-sync-inventory \
  --select COUNT \
  --region ap-northeast-1

# Check inventory contents (first 5 items)
aws dynamodb scan \
  --table-name perm-rag-demo-demo-kb-sync-inventory \
  --max-items 5 \
  --region ap-northeast-1 \
  --query "Items[].{fileKey: fileKey.S, size: size.N, lastModified: lastModified.S, eTag: eTag.S}"
```

### Ingestion Job Check

```bash
# Check latest ingestion jobs
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id "KB_ID" \
  --data-source-id "DS_ID" \
  --max-results 3 \
  --sort-by attribute=STARTED_AT,order=DESCENDING \
  --region ap-northeast-1

# Check specific job details
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id "KB_ID" \
  --data-source-id "DS_ID" \
  --ingestion-job-id "JOB_ID" \
  --region ap-northeast-1
```

### EventBridge Scheduler Check

```bash
# Check schedule status
aws scheduler get-schedule \
  --name perm-rag-demo-demo-kb-auto-sync-schedule \
  --region ap-northeast-1 \
  --query "{State: State, Expression: ScheduleExpression, Target: Target.Arn}"
```

### CloudWatch Metrics Check

```bash
# Verify KbAutoSync metrics exist
aws cloudwatch list-metrics \
  --namespace KbAutoSync \
  --region ap-northeast-1

# Recent scanned file count
aws cloudwatch get-metric-statistics \
  --namespace KbAutoSync \
  --metric-name ScannedFileCount \
  --dimensions Name=FunctionName,Value=perm-rag-demo-demo-kb-auto-sync \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region ap-northeast-1
```

### CloudWatch Alarm Check

```bash
aws cloudwatch describe-alarms \
  --alarm-names perm-rag-demo-demo-kb-auto-sync-errors \
  --region ap-northeast-1 \
  --query "MetricAlarms[].{Name: AlarmName, State: StateValue, Threshold: Threshold}"
```


---

## 12. Capacity Guardrails Deployment Procedure

### CloudFormation Deployment

```bash
aws cloudformation deploy \
  --template-file automation/fsxn-ops/cfn/fsxn-ops-stack.yaml \
  --stack-name fsxn-ops \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    FsxFilesystemId=<FSX_FILESYSTEM_ID> \
    ManagementLif=<MANAGEMENT_LIF_IP> \
    OntapSecretId=<SECRETS_MANAGER_SECRET_ARN> \
    VpcId=<VPC_ID> \
    SubnetIds=<PRIVATE_SUBNET_ID> \
    SecurityGroupId=<SECURITY_GROUP_ID> \
    NotificationEmail=<YOUR_EMAIL> \
    MaxGrowPerActionPct=50 \
    MaxGrowPerDayGiB=500 \
    CooldownMinutes=30 \
    CreateVpcEndpoints=false \
  --region ap-northeast-1
```

> **Note**: Specify `CreateVpcEndpoints=false` if VPC endpoints already exist in the CDK-deployed VPC. The DynamoDB Gateway Endpoint is included in the template, but duplicating existing endpoints will cause an error.

### Lambda Code Deployment (Separate Step)

The CloudFormation template uses `ZipFile` inline placeholder code, so actual Lambda code must be deployed separately:

```bash
# Package Lambda code
cd automation/fsxn-ops/lambda
zip -r /tmp/capacity_monitor.zip common/ capacity_monitor/

# Update Lambda function code
aws lambda update-function-code \
  --function-name fsxn-ops-capacity-monitor \
  --zip-file fileb:///tmp/capacity_monitor.zip \
  --region ap-northeast-1

# Verify deployment
aws lambda get-function \
  --function-name fsxn-ops-capacity-monitor \
  --query "Configuration.{LastModified: LastModified, CodeSize: CodeSize, Runtime: Runtime}" \
  --region ap-northeast-1
```

### Verification Commands

#### DynamoDB Table Check

```bash
# Verify table exists
aws dynamodb describe-table \
  --table-name fsxn-ops-guardrails-fsxn-ops \
  --query "Table.{TableName: TableName, Status: TableStatus, TTL: TimeToLiveDescription}" \
  --region ap-northeast-1

# Verify TTL configuration
aws dynamodb describe-time-to-live \
  --table-name fsxn-ops-guardrails-fsxn-ops \
  --region ap-northeast-1
# Expected output: {"TimeToLiveDescription": {"TimeToLiveStatus": "ENABLED", "AttributeName": "ttl_epoch"}}
```

#### CloudWatch Dashboard Check

```bash
# Verify dashboard exists
aws cloudwatch get-dashboard \
  --dashboard-name FSxNOps-Guardrails-Dashboard \
  --region ap-northeast-1 \
  --query "DashboardName"
```

#### Manual Lambda Execution (Test)

```bash
# Manually trigger capacity_monitor
aws lambda invoke \
  --function-name fsxn-ops-capacity-monitor \
  --payload '{"test": true}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/guardrails-response.json \
  --region ap-northeast-1

cat /tmp/guardrails-response.json | python3 -m json.tool
```

#### CloudWatch Metrics Check

```bash
# Verify Guardrails metrics exist (only output during auto-expansion attempts)
aws cloudwatch list-metrics \
  --namespace FSxNOps/Guardrails \
  --region ap-northeast-1

# Note: If the threshold is not exceeded, guardrails are not evaluated and no metrics are output.
# If no metrics appear, this is normal operation (no auto-expansion was attempted).
```

### Reset Environment Variables After Testing

If thresholds were modified during testing, always reset to safe default values:

```bash
# Reset to safe defaults
aws lambda update-function-configuration \
  --function-name fsxn-ops-capacity-monitor \
  --environment "Variables={
    AUTO_RESIZE_ENABLED=false,
    DRY_RUN=true,
    MAX_GROW_PER_ACTION_PCT=50,
    MAX_GROW_PER_DAY_GIB=500,
    COOLDOWN_MINUTES=30,
    GUARDRAILS_TABLE_NAME=fsxn-ops-guardrails-fsxn-ops,
    FSX_FILESYSTEM_ID=<FSX_FILESYSTEM_ID>,
    MANAGEMENT_LIF=<MANAGEMENT_LIF_IP>,
    ONTAP_SECRET_ID=<SECRETS_MANAGER_SECRET_ARN>,
    SNS_TOPIC_ARN=<SNS_TOPIC_ARN>
  }" \
  --region ap-northeast-1
```

> **Important**: Setting `AUTO_RESIZE_ENABLED=false` and `DRY_RUN=true` prevents unintended auto-expansion after testing.

### VPC Endpoints Notes

| Scenario | `CreateVpcEndpoints` Setting | Reason |
|----------|------------------------------|--------|
| CDK VPC has existing endpoints | `false` | Avoid duplicate creation errors |
| Standalone VPC (no endpoints) | `true` | Creates all endpoints including DynamoDB Gateway Endpoint |

The DynamoDB Gateway Endpoint requires association with the Lambda subnet's route table. When `CreateVpcEndpoints=true`, the template automatically associates it with the route table specified by the `RouteTableIds` parameter.

---

## 13. Transfer Family StructuredLogDestinations EarlyValidation Error

### Symptoms

The following error occurs during ChangeSet creation when running `cdk deploy`:

```
AWS::EarlyValidation::PropertyValidation - Resource handler returned message: 
"Invalid request provided: StructuredLogDestinations..."
```

### Cause

When specifying a CloudWatch Logs ARN + `:*` suffix in the `StructuredLogDestinations` property of `AWS::Transfer::Server`, AWS's new property validation (EarlyValidation) rejects it.

This issue has been occurring since early 2026, caused by the Transfer Family CloudFormation resource handler being unable to properly validate `StructuredLogDestinations` values.

### Solution

Remove the `structuredLogDestinations` property from the Transfer Family server configuration. Transfer Family outputs logs to CloudWatch Logs in standard format just by setting `loggingRole`.

```typescript
// ❌ Configuration that causes errors
const server = new transfer.CfnServer(this, 'Server', {
  structuredLogDestinations: [`${logGroup.logGroupArn}:*`],
  // ...
});

// ✅ Correct configuration (remove structuredLogDestinations)
const server = new transfer.CfnServer(this, 'Server', {
  loggingRole: loggingRole.roleArn,
  // Do not specify structuredLogDestinations
  // ...
});
```

### Impact

- Transfer Family structured JSON logs (`structuredLogDestinations`) are unavailable
- Standard format logs are output normally to CloudWatch Logs via `loggingRole`
- Audit trail for SFTP operations (login, upload, download) is maintained

---

## 14. Transfer Family HomeDirectoryMappings Target Format

### Correct Format

The `Target` in Transfer Family logical directory mappings (`HomeDirectoryMappings`) must follow this format:

```
/{bucket-or-access-point-name}/prefix
```

**Examples:**

```
# ✅ Correct — AP name + prefix (no trailing slash)
Target: /my-s3-access-point/uploads/demo-user

# ✅ Correct — AP name only (root mapping)
Target: /my-s3-access-point
```

### Incorrect Patterns

```
# ❌ Using full ARN — Transfer Family rejects this
Target: /arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-ap/uploads/demo-user

# ❌ Trailing slash — "Target in mapping has a trailing '/'" error
Target: /my-s3-access-point/uploads/demo-user/

# ❌ Missing leading slash
Target: my-s3-access-point/uploads/demo-user
```

### Correct CDK Implementation

```typescript
// Extract AP name from S3 Access Point ARN
const apName = s3AccessPointArn.split('/').pop()!;

// Define homeDirectoryPrefix without trailing slash
const homePrefix = `/uploads/${userConfig.userName}`;  // No trailing slash

// Construct Target
const target = `/${apName}${homePrefix}`;
// Result: /my-access-point/uploads/demo-user

const user = new transfer.CfnUser(this, 'User', {
  homeDirectoryType: 'LOGICAL',
  homeDirectoryMappings: [{
    entry: '/',
    target: target,  // /{ap-name}/uploads/{userName}
  }],
  // ...
});
```

### Error Messages

| Error Message | Cause | Fix |
|---------------|-------|-----|
| `Target in mapping has a trailing '/'` | Target has a trailing `/` | Remove trailing slash from `homeDirectoryPrefix` |
| `CREATE_FAILED` (User resource) | Invalid Target format | Use AP name (not ARN) in `/{ap-name}/prefix` format |

---

## 15. Transfer Family Deployment Verification Commands

### Server Status Check

```bash
# List Transfer Family servers
aws transfer list-servers \
  --region ap-northeast-1 \
  --query "Servers[].{ServerId: ServerId, State: State, EndpointType: EndpointType}"

# Check specific server details
aws transfer describe-server \
  --server-id s-xxxxxxxxxxxxxxxxx \
  --region ap-northeast-1 \
  --query "{ServerId: Server.ServerId, State: Server.State, Endpoint: Server.EndpointDetails, Protocols: Server.Protocols, SecurityPolicy: Server.SecurityPolicyName}"
```

### SFTP User Check

```bash
# List users
aws transfer list-users \
  --server-id s-xxxxxxxxxxxxxxxxx \
  --region ap-northeast-1

# User details (check home directory mappings)
aws transfer describe-user \
  --server-id s-xxxxxxxxxxxxxxxxx \
  --user-name demo-user \
  --region ap-northeast-1 \
  --query "{UserName: User.UserName, HomeDirectoryType: User.HomeDirectoryType, HomeDirectoryMappings: User.HomeDirectoryMappings, Role: User.Role}"
```

### Ingestion Trigger Lambda Manual Execution

```bash
# Manual Lambda trigger
aws lambda invoke \
  --function-name perm-rag-demo-demo-transfer-ingestion-trigger \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/transfer-trigger-response.json \
  --region ap-northeast-1

# Check response
cat /tmp/transfer-trigger-response.json | python3 -m json.tool
# Expected output: {"statusCode": 200, "detectedFiles": N, "changedFiles": M, ...}
```

### DynamoDB Table Check

```bash
# Scan state table
aws dynamodb scan \
  --table-name perm-rag-demo-demo-transfer-scan-state \
  --select COUNT \
  --region ap-northeast-1

# File inventory table
aws dynamodb scan \
  --table-name perm-rag-demo-demo-transfer-file-inventory \
  --select COUNT \
  --region ap-northeast-1

# Permission mapping table
aws dynamodb scan \
  --table-name perm-rag-demo-demo-transfer-permission-mapping \
  --select COUNT \
  --region ap-northeast-1
```

### EventBridge Scheduler Check

```bash
# Check schedule status
aws scheduler list-schedules \
  --name-prefix perm-rag-demo-demo-transfer \
  --region ap-northeast-1 \
  --query "Schedules[].{Name: Name, State: State}"

# Detailed check
aws scheduler get-schedule \
  --name perm-rag-demo-demo-transfer-ingestion-schedule \
  --region ap-northeast-1 \
  --query "{State: State, Expression: ScheduleExpression, Target: Target.Arn}"
```

### SFTP Connection Test (After SSH Key Setup)

```bash
# SFTP connection test
sftp -i /path/to/private-key \
  demo-user@s-xxxxxxxxxxxxxxxxx.server.transfer.ap-northeast-1.amazonaws.com

# Example commands after connection
sftp> pwd
sftp> ls
sftp> put test-document.pdf
sftp> quit
```

### CloudWatch Metrics Check

```bash
# Verify TransferFamilyIngestion metrics exist
aws cloudwatch list-metrics \
  --namespace TransferFamilyIngestion \
  --region ap-northeast-1

# Recent detected file count
aws cloudwatch get-metric-statistics \
  --namespace TransferFamilyIngestion \
  --metric-name DetectedFiles \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region ap-northeast-1
```

---

## 16. Docker Image OCI Format vs Lambda Docker V2 Requirements

### Symptoms

After updating a Lambda function's Docker image, the function fails to start with:

```
The image manifest, config or layer media type for the source image is not supported.
```

### Cause

CodeBuild Standard 7.0 and local Docker (Colima/BuildKit-enabled environments) generate **OCI Image Index format** (`application/vnd.oci.image.index.v1+json`) manifests by default. Lambda only supports **Docker V2 manifest** (`application/vnd.docker.distribution.manifest.v2+json`).

The following workarounds are **insufficient**:
- `DOCKER_BUILDKIT=0`: Disabling BuildKit does not work reliably on modern Docker
- `--provenance=false` alone: SBOM attachments may remain, causing OCI Index generation

### Solution

Specify `--provenance=false --sbom=false --push` with `docker buildx build`:

```bash
# ✅ Correct build command (guarantees Docker V2 manifest)
docker buildx build \
  --provenance=false \
  --sbom=false \
  --platform linux/amd64 \
  -t ${ECR_URI}:${IMAGE_TAG} \
  -f Dockerfile \
  --push \
  .
```

### Manifest Format Verification

Always verify the manifest format after pushing:

```bash
# Check manifest media type from ECR
aws ecr batch-get-image \
  --repository-name permission-aware-rag-webapp \
  --image-ids imageTag=${IMAGE_TAG} \
  --region ap-northeast-1 \
  --query 'images[0].imageManifestMediaType' \
  --output text

# Expected: application/vnd.docker.distribution.manifest.v2+json
# NG:       application/vnd.oci.image.index.v1+json
```

### Alternative Verification (docker manifest inspect)

```bash
# Check manifest locally
docker manifest inspect ${ECR_URI}:${IMAGE_TAG} | jq '.mediaType'

# Expected: "application/vnd.docker.distribution.manifest.v2+json"
```

### Prevention

- `pre-deploy-setup.sh` has been fixed (uses `docker buildx build --provenance=false --sbom=false --push`)
- Use the same build command in CI/CD pipelines
- Do not use `DOCKER_BUILDKIT=0` in CodeBuild buildspec (unreliable)

---

## 17. CDK Image Tag Cache Issue

### Symptoms

A new Docker image was pushed to ECR, but `cdk deploy` does not update the Lambda function's image.

### Cause

When CDK uses the `latest` tag, it compares image digests at synth time to detect resource changes. However, if the ECR `latest` tag points to an OCI Index, the digest differs from the actual image manifest, preventing CDK from detecting changes.

### Solution

Use an **explicit tag** in the `cdk.context.json` `imageTag` parameter:

```json
{
  "imageTag": "voice-btn-page-20260615"
}
```

### Important Rules

- For deployments that include frontend changes, **always change the `imageTag`**
- Tag naming convention: `{feature}-{YYYYMMDD}` or `{feature}-{YYYYMMDD-HHMMSS}`
- Use the `latest` tag only for development convenience; never reference it in CDK deployments

### Verification

```bash
# Check imageTag in cdk.context.json
cat cdk.context.json | jq '.imageTag'

# Check available tags in ECR
aws ecr list-images \
  --repository-name permission-aware-rag-webapp \
  --region ap-northeast-1 \
  --query 'imageIds[*].imageTag' \
  --output table
```

---

## 18. VoiceButton Not Displaying

### Symptoms

Voice chat is enabled (`NEXT_PUBLIC_VOICE_CHAT_ENABLED=true`) but the microphone button does not appear on the chat screen.

### Cause Patterns

#### Pattern A: Page Integration Issue

If `genai/page.tsx` renders a direct `<input>` element instead of using the `MessageInput` component, the VoiceButton inside `MessageInput.tsx` will not be displayed.

**Verification**: Check if VoiceButton import and rendering exists in `genai/page.tsx`.

```typescript
// genai/page.tsx needs the following:
import { VoiceButton } from '@/components/VoiceButton';
// ... render <VoiceButton /> in JSX
```

#### Pattern B: useVoiceCapability Permission State

When browser microphone permission is in "prompt" (unconfirmed) state, `canUseVoice` returns `false` and the button is hidden.

**Fixed logic**:
```typescript
// Correct mapping:
// "granted" → isMicrophonePermitted = true
// "prompt"  → isMicrophonePermitted = null (unconfirmed but button is shown)
// "denied"  → isMicrophonePermitted = false (button hidden)

// canUseVoice condition:
const canUseVoice = isMicrophonePermitted !== false && /* other conditions */;
```

#### Pattern C: Environment Variable Issue

`NEXT_PUBLIC_VOICE_CHAT_ENABLED=true` was not passed during Docker build.

**Verification**:
```bash
# Check Lambda environment variables
aws lambda get-function-configuration \
  --function-name perm-rag-demo-demo-webapp \
  --region ap-northeast-1 \
  --query "Environment.Variables.NEXT_PUBLIC_VOICE_CHAT_ENABLED"
```

> **Note**: `NEXT_PUBLIC_*` environment variables are embedded at Next.js build time, so they must be passed via `--build-arg` during Docker build, not as Lambda environment variables.

### Prevention

- Render VoiceButton directly in `genai/page.tsx` (don't depend on MessageInput)
- Map "prompt" state to `null` in the `useVoiceCapability` hook
- Include `--build-arg NEXT_PUBLIC_VOICE_CHAT_ENABLED=true` during Docker build

---

## 19. AgentCore Runtime CloudFormation Limitation

### Symptoms

Adding `AWS::BedrockAgentCore::AgentRuntime` or `AWS::KinesisVideo::SignalingChannelPolicy` resources to the CDK template causes the following error during deployment:

```
Resource type 'AWS::BedrockAgentCore::AgentRuntime' is not supported.
```

### Cause

AgentCore Runtime and KVS SignalingChannelPolicy are not supported as CloudFormation resource types (as of June 2026). No CDK L1/L2 constructs exist either.

### Solution

Deploy the Voice Agent manually using CLI/SDK outside of CDK/CloudFormation:

```bash
# 1. Build and push Pipecat Voice Agent Docker image
docker buildx build --provenance=false --sbom=false \
  --platform linux/amd64 \
  -t ${ECR_URI}:pipecat-agent \
  -f docker/pipecat-agent/Dockerfile \
  --push \
  docker/pipecat-agent/

# 2. Create AgentCore Runtime agent (CLI/SDK)
aws bedrock-agentcore create-agent-runtime \
  --agent-runtime-name "voice-rag-agent" \
  --description "Voice RAG Agent with Pipecat" \
  --agent-runtime-artifact '{
    "containerImage": {
      "uri": "'${ECR_URI}':pipecat-agent"
    }
  }' \
  --region ap-northeast-1

# 3. Create KVS Signaling Channel
aws kinesisvideo create-signaling-channel \
  --channel-name "voice-chat-signaling" \
  --channel-type SINGLE_MASTER \
  --region ap-northeast-1
```

### CDK Template Approach

Remove AgentCore Runtime resources from the CDK template and document CLI commands in the deployment procedure:

```typescript
// ❌ Do not define in CDK (CloudFormation not supported)
// new CfnResource(this, 'VoiceAgent', {
//   type: 'AWS::BedrockAgentCore::AgentRuntime',
//   ...
// });

// ✅ Output necessary information via CDK Outputs for manual deployment input
new cdk.CfnOutput(this, 'EcrRepoUri', { value: ecrRepo.repositoryUri });
new cdk.CfnOutput(this, 'VpcSubnetIds', { value: vpc.privateSubnets.map(s => s.subnetId).join(',') });
```

### Future Plans

- Migrate to CDK constructs once CloudFormation support is added
- Until then, consider adding Voice Agent deployment steps to `post-deploy-setup.sh`
