# Leitfaden für die Permission-aware RAG-Verifizierungsumgebung

**🌐 Language:** [日本語](../demo-environment-guide.md) | [English](../en/demo-environment-guide.md) | [한국어](../ko/demo-environment-guide.md) | [简体中文](../zh-CN/demo-environment-guide.md) | [繁體中文](../zh-TW/demo-environment-guide.md) | [Français](../fr/demo-environment-guide.md) | **Deutsch** | [Español](../es/demo-environment-guide.md)

**Last Updated**: 2026-03-25  
**Region**: ap-northeast-1 (Tokyo)

---

## 1. Zugangsinformationen

### Webanwendungs-URL

| Endpoint | URL |
|---|---|
| CloudFront (Production) | `<Obtain from CloudFormation outputs after CDK deployment>` |
| Lambda Function URL (Direct) | `<Obtain from CloudFormation outputs after CDK deployment>` |

```bash
# Command to retrieve URLs
STACK_PREFIX="perm-rag-demo-demo"
aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text
aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionUrl`].OutputValue' --output text
```

### Testbenutzer

| Benutzer | E-Mail-Adresse | Passwort | Rolle | Berechtigungen |
|---|---|---|---|---|
| Administrator | `admin@example.com` | `DemoAdmin123!` | administrator | Kann alle Dokumente einsehen |
| Allgemeiner Benutzer | `user@example.com` | `DemoUser123!` | user | Nur öffentliche Dokumente |

Die Authentifizierung wird von Amazon Cognito verwaltet.

---

## 2. CDK Stack Configuration (6+1 Stacks)

| Stack Name | Region | Description |
|---|---|---|
| `${prefix}-Waf` | us-east-1 | WAF WebACL for CloudFront |
| `${prefix}-Networking` | ap-northeast-1 | VPC, Subnets, Security Groups |
| `${prefix}-Security` | ap-northeast-1 | Cognito User Pool, Authentication |
| `${prefix}-Storage` | ap-northeast-1 | FSx ONTAP + SVM + Volume + S3 + DynamoDB + AD |
| `${prefix}-AI` | ap-northeast-1 | Bedrock KB + S3 Vectors / OpenSearch Serverless (selected via `vectorStoreType`) |
| `${prefix}-WebApp` | ap-northeast-1 | Lambda Web Adapter (Next.js) + CloudFront |
| `${prefix}-Embedding` (optional) | ap-northeast-1 | Embedding EC2 + ECR (FlexCache CIFS mount) |

### Retrieving Resource IDs

```bash
STACK_PREFIX="perm-rag-demo-demo"

# Retrieve outputs from all stacks at once
for stack in Waf Networking Security Storage AI WebApp Embedding; do
  echo "=== ${STACK_PREFIX}-${stack} ==="
  aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-${stack} \
    --query 'Stacks[0].Outputs[*].{Key:OutputKey,Value:OutputValue}' --output table 2>/dev/null || echo "  (Not deployed)"
done
```

---

## 3. Verifizierungsszenarien

### Grundlegender Ablauf

1. Zugriff auf die CloudFront-URL → `/ja/signin`
2. Mit einem Testbenutzer anmelden
3. **KB-Modus**: Ein Modell auf dem Chat-Bildschirm auswählen → Berechtigungsfilterung in der RAG-Suche verifizieren
4. **Agent-Modus**: Auf die Schaltfläche "🤖 Agent" im Header klicken → Einen Agent auswählen → Einen Workflow oder freien Chat wählen

### Verifizierung der Berechtigungsunterschiede

Wenn der Administrator und der allgemeine Benutzer die gleiche Frage stellen, gibt die SID-Filterung unterschiedliche Ergebnisse zurück.
Die gleichen Berechtigungskontrollen gelten sowohl im KB-Modus als auch im Agent-Modus.

| Example Question | admin (KB/Agent) | user (KB/Agent) |
|--------|-------------------|-----------------|
| "What are the company's sales?" | ✅ References financial report (6/6 permitted) | ❌ Public information only (2/6 permitted) |
| "What is the remote work policy?" | ✅ References HR policy | ❌ Access denied |
| "What is the project plan?" | ✅ References project plan | ❌ Access denied |

### Agent Mode Verification

1. Click the "🤖 Agent" button in the header
2. Select an Agent in the sidebar (`perm-rag-demo-demo-agent`)
3. Choose a workflow (📊 Financial Report Analysis, etc.) or enter a chat message
4. Verify the Agent response (SID filtering applied via Permission-aware Action Group)

### Dynamic Agent Creation Feature

When you click a workflow card in Agent Mode, a Bedrock Agent corresponding to the category is automatically searched for and created.

| Item | Description |
|------|------|
| Trigger | Clicking a workflow card |
| Behavior | Category determination via AGENT_CATEGORY_MAP → Search for existing Agent → Dynamic creation via CreateAgent API if not found |
| Duration | 30–60 seconds for initial creation (loading UI displayed), instant from the second time onward due to localStorage cache |
| Action Group | Permission-aware Action Group is automatically attached to dynamically created Agents (specified via `PERM_SEARCH_LAMBDA_ARN` environment variable) |
| Cache | Card-Agent mapping is persisted via `useCardAgentMappingStore` (Zustand + localStorage) |
| Required Permissions | Lambda IAM role requires `bedrock:CreateAgent`, `bedrock:PrepareAgent`, `bedrock:CreateAgentAlias`, `bedrock:CreateAgentActionGroup`, `iam:PassRole` |

### CDK Deploy Options

```bash
# Agent + all options enabled
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  -c enableGuardrails=true \
  --require-approval never
```
| "Tell me about the product overview" | ✅ References product catalog | ✅ References product catalog |

For details, see [demo-data/guides/demo-scenario.md](../../demo-data/guides/demo-scenario.md).

---

## 4. Active Directory Integration

### AD Information

| Item | Value |
|---|---|
| Domain Name | `demo.local` |
| Edition | Standard |
| DNS IP | `<Obtain after AD deployment>` |

```bash
# Retrieve AD information
aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].{Id:DirectoryId,Stage:Stage,DnsIps:DnsIpAddrs}' \
  --output table
```

### SVM AD Join Procedure

CDK creates the SVM without AD configuration. After deployment, join the AD domain via CLI.

#### Prerequisites: Security Group Configuration

SVM AD join requires communication between the FSx SG and AD SG. CDK sets `allowAllOutbound: true`, but the following inbound rules are also required.

```bash
# Retrieve FSx SG ID and AD SG ID
FSX_SG_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Networking \
  --query 'Stacks[0].Outputs[?OutputKey==`FsxSgId`].OutputValue' --output text)
AD_SG_ID=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].VpcSettings.SecurityGroupId' --output text)

# Add AD communication ports to FSx SG (if missing from CDK)
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 135 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 464 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol udp --port 464 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 636 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol udp --port 123 --source-group $AD_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol tcp --port 1024-65535 --source-group $AD_SG_ID --region ap-northeast-1

# Bidirectional communication: AD SG ↔ FSx SG allow all traffic
aws ec2 authorize-security-group-ingress --group-id $AD_SG_ID \
  --protocol -1 --source-group $FSX_SG_ID --region ap-northeast-1
aws ec2 authorize-security-group-ingress --group-id $FSX_SG_ID \
  --protocol -1 --source-group $AD_SG_ID --region ap-northeast-1
```

#### SVM AD Join Command

```bash
SVM_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`SvmId`].OutputValue' --output text)
AD_DNS_IPS=$(aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].DnsIpAddrs' --output json)

# Important: For AWS Managed AD, explicitly specify OrganizationalUnitDistinguishedName
aws fsx update-storage-virtual-machine \
  --storage-virtual-machine-id $SVM_ID \
  --active-directory-configuration '{
    "NetBiosName": "RAGSVM",
    "SelfManagedActiveDirectoryConfiguration": {
      "DomainName": "demo.local",
      "UserName": "Admin",
      "Password": "<AD_PASSWORD>",
      "DnsIps": '"$AD_DNS_IPS"',
      "OrganizationalUnitDistinguishedName": "OU=Computers,OU=demo,DC=demo,DC=local",
      "FileSystemAdministratorsGroup": "Domain Admins"
    }
  }' --region ap-northeast-1
```

> **Important**: With AWS Managed AD, omitting `OrganizationalUnitDistinguishedName` results in a MISCONFIGURED state. Specify it in the format `OU=Computers,OU=<NetBIOS short name>,DC=<domain>,DC=<tld>`.

#### Verifying AD Join Status

```bash
aws fsx describe-storage-virtual-machines \
  --storage-virtual-machine-ids $SVM_ID \
  --query 'StorageVirtualMachines[0].ActiveDirectoryConfiguration' \
  --region ap-northeast-1 --output json
```

If `NetBiosName` is displayed and `SelfManagedActiveDirectoryConfiguration` contains domain information, the join was successful.

For detailed procedures, see [demo-data/guides/ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md).

---

## 5. Knowledge Base Data

### Option A: Via S3 Bucket (Default)

The following documents are registered in the S3 bucket. Each document has SID information attached via `.metadata.json`.

| File | Access Level | allowed_group_sids | admin | user |
|---|---|---|---|---|
| `public/company-overview.md` | public | S-1-1-0 (Everyone) | ✅ | ✅ |
| `public/product-catalog.md` | public | S-1-1-0 (Everyone) | ✅ | ✅ |
| `restricted/project-plan.md` | restricted | ...-1100, ...-512 | ✅ | ❌ |
| `confidential/financial-report.md` | confidential | ...-512 (Domain Admins) | ✅ | ❌ |
| `confidential/hr-policy.md` | confidential | ...-512 (Domain Admins) | ✅ | ❌ |

### Option B: Via Embedding Server (FlexCache CIFS Mount)

Mount the FlexCache Cache volume via CIFS and vectorize documents directly with the Embedding server, then index them in OpenSearch Serverless (AOSS). This is an alternative path when S3 Access Point is not available (not supported for FlexCache Cache volumes as of March 2026). Only available with AOSS configuration (`vectorStoreType=opensearch-serverless`).

For details, see [6. Embedding Server](#6-embedding-server-optional).

---

## 6. Embedding Server (Optional)

### Overview

EmbeddingStack (the 7th CDK stack) is an EC2-based server that directly reads CIFS-shared documents on FSx ONTAP, vectorizes them with Amazon Bedrock Titan Embed Text v2, and indexes them in OpenSearch Serverless (AOSS). Only available with AOSS configuration (`vectorStoreType=opensearch-serverless`).

### Architecture

```
┌──────────────────┐     CIFS/SMB      ┌──────────────────┐
│ FSx ONTAP        │◀──────────────────│ Embedding EC2    │
│ (SVM + Volume)   │    Mount          │ (m5.large)       │
│ /data            │                   │                  │
└──────────────────┘                   │ Docker Container │
                                       │ ┌──────────────┐ │
                                       │ │ embed-app    │ │
                                       │ │ - scan docs  │ │
                                       │ │ - embedding  │ │
                                       │ │ - indexing   │ │
                                       │ └──────┬───────┘ │
                                       └────────┼─────────┘
                                                │
                              ┌─────────────────┼─────────────────┐
                              ▼                                   ▼
                    ┌──────────────────┐              ┌──────────────────┐
                    │ Bedrock          │              │ OpenSearch       │
                    │ Titan Embed v2   │              │ Serverless       │
                    │ (Vector Gen)     │              │ (Indexing)       │
                    └──────────────────┘              └──────────────────┘
```

### Deployment Procedure

#### Step 1: Register Password in Secrets Manager

```bash
AD_SECRET_ARN=$(aws secretsmanager create-secret \
  --name perm-rag-demo-ad-password \
  --secret-string '{"password":"<AD_PASSWORD>"}' \
  --region ap-northeast-1 \
  --query 'ARN' --output text)
echo "Secret ARN: $AD_SECRET_ARN"
```

#### Step 2: Deploy EmbeddingStack

```bash
npx cdk deploy ${STACK_PREFIX}-Embedding \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableEmbeddingServer=true \
  -c embeddingAdSecretArn=$AD_SECRET_ARN \
  -c embeddingAdUserName=Admin \
  -c embeddingAdDomain=demo.local \
  --require-approval never
```

#### Step 3: Build and Push Docker Image

Use CodeBuild if Docker is not available on the EC2 instance.

```bash
# Retrieve ECR repository URI
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Embedding \
  --query 'Stacks[0].Outputs[?OutputKey==`EmbeddingEcrRepoUri`].OutputValue' \
  --output text)

# Build with CodeBuild (using docker/embed/buildspec.yml)
# Zip the source and upload to S3
pushd docker/embed && zip -r /tmp/embed-source.zip . -x "node_modules/*" && popd
aws s3 cp /tmp/embed-source.zip s3://<DATA_BUCKET>/codebuild/embed-source.zip

# Create and run CodeBuild project (first time only)
aws codebuild start-build --project-name embed-image-builder --region ap-northeast-1
```

If a Docker environment is available, you can build directly:

```bash
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com
docker build -t ${ECR_URI}:latest docker/embed/
docker push ${ECR_URI}:latest
```

#### Step 4: Create CIFS Share

Set the FSx ONTAP admin password and create a CIFS share via REST API.

```bash
# Set FSx admin password
FS_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`FileSystemId`].OutputValue' --output text)
aws fsx update-file-system --file-system-id $FS_ID \
  --ontap-configuration '{"FsxAdminPassword":"<ADMIN_PASSWORD>"}' \
  --region ap-northeast-1

# Retrieve SVM UUID (for REST API)
MGMT_IP=$(aws fsx describe-file-systems --file-system-ids $FS_ID \
  --query 'FileSystems[0].OntapConfiguration.Endpoints.Management.IpAddresses[0]' --output text)

# Create CIFS share via ONTAP REST API from EC2 (via SSM)
# Retrieve SVM UUID
SVM_UUID=$(curl -sk -u fsxadmin:<ADMIN_PASSWORD> \
  "https://${MGMT_IP}/api/svm/svms" | python3 -c "import sys,json; print(json.load(sys.stdin)['records'][0]['uuid'])")

# Create CIFS share
curl -sk -u fsxadmin:<ADMIN_PASSWORD> \
  -X POST "https://${MGMT_IP}/api/protocols/cifs/shares" \
  -H "Content-Type: application/json" \
  -d "{\"svm\":{\"uuid\":\"${SVM_UUID}\"},\"name\":\"data\",\"path\":\"/data\"}"
```

#### Step 5: CIFS Mount and Data Ingestion

```bash
# Connect to Embedding EC2 via SSM
EMBED_INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Embedding \
  --query 'Stacks[0].Outputs[?OutputKey==`EmbeddingInstanceId`].OutputValue' --output text)

# CIFS mount
SMB_IP=$(aws fsx describe-storage-virtual-machines --storage-virtual-machine-ids $SVM_ID \
  --query 'StorageVirtualMachines[0].Endpoints.Smb.IpAddresses[0]' --output text)

sudo mkdir -p /mnt/cifs-data
sudo mount -t cifs //${SMB_IP}/data /mnt/cifs-data \
  -o user=Admin,password=<AD_PASSWORD>,domain=demo.local,iocharset=utf8

# Ingest documents (same structure as demo-data/documents)
sudo mkdir -p /mnt/cifs-data/{public,confidential,restricted}
# Copy each document and .metadata.json
```

#### Step 6: Update OpenSearch Serverless Data Access Policy

The Embedding EC2 IAM role must be added to the AOSS data access policy.

```bash
# Retrieve current policy version
POLICY_VERSION=$(aws opensearchserverless get-access-policy \
  --name "<COLLECTION_NAME>-dat" --type data \
  --query 'accessPolicyDetail.policyVersion' --output text --region ap-northeast-1)

# Update policy with Embedding EC2 role added
# Add "arn:aws:iam::<ACCOUNT_ID>:role/<prefix>-embedding-role" to the Principal array
aws opensearchserverless update-access-policy \
  --name "<COLLECTION_NAME>-dat" --type data \
  --policy-version "$POLICY_VERSION" \
  --policy '<updated_policy_json>' \
  --region ap-northeast-1
```

#### Step 7: Run Embedding Container

```bash
# Pull image from ECR
sudo aws ecr get-login-password --region ap-northeast-1 | \
  sudo docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com
sudo docker pull ${ECR_URI}:latest

# Run container
sudo docker run -d --name embed-app \
  -v /mnt/cifs-data:/opt/netapp/ai/data \
  -v /tmp/embed-db:/opt/netapp/ai/db \
  -e ENV_REGION=ap-northeast-1 \
  -e ENV_OPEN_SEARCH_SERVERLESS_COLLECTION_NAME=<COLLECTION_NAME> \
  -e ENV_EMBEDDING_MODEL_ID=amazon.titan-embed-text-v2:0 \
  -e ENV_INDEX_NAME=bedrock-knowledge-base-default-index \
  ${ECR_URI}:latest

# Check logs
sudo docker logs -f embed-app
```

### Embedding Application Structure

```
docker/embed/
├── Dockerfile          # node:22-slim base, includes cifs-utils
├── package.json        # AWS SDK v3, chokidar, dotenv
├── tsconfig.json
├── buildspec.yml       # CodeBuild build definition
├── .env                # Default environment variables
└── src/
    ├── index.ts        # Main: document scan → chunk split → embedding → indexing
    └── oss-client.ts   # OpenSearch Serverless SigV4 signing client (IMDS auth support)
```

### Processing Flow

1. Recursively scan the CIFS-mounted directory (.md, .txt, .html, etc.)
2. Read SID information from each document's `.metadata.json`
3. Split text into 1000-character chunks (200-character overlap)
4. Generate 1024-dimensional vectors with Bedrock Titan Embed Text v2
5. Index in OpenSearch Serverless in Bedrock KB-compatible format
6. Record processed files in `processed.json` (supports incremental processing)

---

## 7. API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/signin` | Sign in (Cognito authentication) |
| POST | `/api/auth/signout` | Sign out |
| GET | `/api/auth/session` | Retrieve session information |
| GET | `/api/bedrock/models` | List available models |
| POST | `/api/bedrock/chat` | Chat |
| POST | `/api/bedrock/kb/retrieve` | RAG search (with SID filtering) |
| GET | `/api/health` | Health check |

---

## 8. Setup Procedure (Post-Deployment)

```bash
STACK_PREFIX="perm-rag-demo-demo"

# 1. Retrieve resource IDs
COGNITO_USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Security \
  --query 'Stacks[0].Outputs[?contains(OutputKey,`UserPoolId`)].OutputValue' --output text)
USER_ACCESS_TABLE_NAME=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`UserAccessTableName`].OutputValue' --output text)
DATA_BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-Storage \
  --query 'Stacks[0].Outputs[?OutputKey==`DataBucketName`].OutputValue' --output text)
BEDROCK_KB_ID=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_PREFIX}-AI \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)

# 2. Create test users
export COGNITO_USER_POOL_ID
bash demo-data/scripts/create-demo-users.sh

# 3. Register SID data (email address is used as userId in the app's JWT)
export USER_ACCESS_TABLE_NAME
bash demo-data/scripts/setup-user-access.sh

# 4. Upload test data
export DATA_BUCKET_NAME
bash demo-data/scripts/upload-demo-data.sh

# 5. Sync KB
export BEDROCK_KB_ID
bash demo-data/scripts/sync-kb-datasource.sh
```

---

## 9. Troubleshooting

| Symptom | Cause | Resolution |
|------|------|------|
| Cannot sign in | Cognito users not created | Run `create-demo-users.sh` |
| KB search returns no results | Data source not synced | Run `sync-kb-datasource.sh` |
| All documents are denied | SID data not registered | Run `setup-user-access.sh` |
| SVM AD join is MISCONFIGURED | OU not specified or SG insufficient | Explicitly specify OU path + allow communication between FSx/AD SGs |
| Embedding 403 Forbidden | AOSS data access policy missing | Add Embedding EC2 role to AOSS policy |
| Authentication error in Embedding container | IMDS hop limit insufficient | Verify EC2 metadata hop limit = 2 |
| Page does not display | CloudFront cache | `aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"` |
| Cold start delay | Lambda initial startup | Wait 10-15 seconds (normal behavior) |


---

## Environment Deletion

### Notes on Deletion

You can delete all resources with `cdk destroy --all`, but manual intervention may be required due to the following dependencies.

| Issue | Cause | CDK Handling |
|------|------|---------|
| AI stack deletion fails | Data sources remain in KB | ✅ Automatically deleted by KbCleanup custom resource |
| Storage stack deletion fails | S3 AP attached to volume | ✅ Automatically deleted by S3 AP custom resource Delete handler |
| Networking stack deletion fails | AD Controller SG is orphaned | ❌ Manual deletion required (see script below) |
| Embedding stack not recognized | Depends on CDK context | ❌ Delete manually first |
| Manually created resources remain | CodeBuild, ECR, IAM policies | ❌ Delete with the script below |

### Recommended Deletion Procedure

```bash
# 1. Delete Embedding stack (if it exists)
aws cloudformation delete-stack --stack-name perm-rag-demo-demo-Embedding --region ap-northeast-1 2>/dev/null
aws cloudformation wait stack-delete-complete --stack-name perm-rag-demo-demo-Embedding --region ap-northeast-1 2>/dev/null

# 2. Delete KB data sources
KB_ID=$(aws cloudformation describe-stacks --stack-name perm-rag-demo-demo-AI --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text 2>/dev/null)
if [ -n "$KB_ID" ] && [ "$KB_ID" != "None" ]; then
  for DS_ID in $(aws bedrock-agent list-data-sources --knowledge-base-id $KB_ID --region ap-northeast-1 \
    --query 'dataSourceSummaries[].dataSourceId' --output text 2>/dev/null); do
    aws bedrock-agent delete-data-source --knowledge-base-id $KB_ID --data-source-id $DS_ID --region ap-northeast-1
  done
  sleep 10
fi

# 3. Delete S3 AP
aws fsx detach-and-delete-s3-access-point --name perm-rag-demo-s3ap --region ap-northeast-1 2>/dev/null
sleep 30

# 4. CDK destroy
npx cdk destroy --all --app "npx ts-node bin/demo-app.ts" --force

# 5. Delete orphaned AD SGs (when using Managed AD)
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=*perm-rag*" --region ap-northeast-1 \
  --query 'Vpcs[0].VpcId' --output text 2>/dev/null)
if [ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
  for SG_ID in $(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=d-*_controllers" \
    --region ap-northeast-1 --query 'SecurityGroups[].GroupId' --output text 2>/dev/null); do
    aws ec2 delete-security-group --group-id $SG_ID --region ap-northeast-1
  done
  # Retry Networking stack deletion
  aws cloudformation delete-stack --stack-name perm-rag-demo-demo-Networking --region ap-northeast-1
  aws cloudformation wait stack-delete-complete --stack-name perm-rag-demo-demo-Networking --region ap-northeast-1
fi
```
