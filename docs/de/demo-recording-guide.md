# Leitfaden zur Aufnahme von Verifizierungs-Demovideos

**🌐 Language:** [日本語](../demo-recording-guide.md) | [English](../en/demo-recording-guide.md) | [한국어](../ko/demo-recording-guide.md) | [简体中文](../zh-CN/demo-recording-guide.md) | [繁體中文](../zh-TW/demo-recording-guide.md) | [Français](../fr/demo-recording-guide.md) | **Deutsch** | [Español](../es/demo-recording-guide.md)

**Letzte Aktualisierung**: 2026-03-29  
**Zweck**: Schritt-für-Schritt-Anleitung zur Aufnahme von Verifizierungs-Demovideos des Permission-Aware RAG-Systems  
**Voraussetzungen**: AWS-Konto (AdministratorAccess-Äquivalent), EC2-Instanz (Ubuntu 22.04, t3.large oder größer, 50GB EBS)

---

## Aufzunehmende Nachweise (6 Punkte)

| # | Nachweis | Inhalt |
|---|----------|--------|
| (1) | Aufbau einer RAG-basierten KI-Chatbot-Plattform | Architekturerklärung |
| (2) | Bereitstellung der Chatbot-Plattform mit AWS CDK | CDK-Deployment-Verfahren |
| (3) | Platzierung von Speicherdaten auf FSx ONTAP-Volumes | Datenaufnahme über S3 Access Point |
| (4) | Abbildung von Zugriffsberechtigungsinformationen | Einrichtung und Verifizierung von SID-Informationen in `.metadata.json` |
| (5) | Bestimmung des Datenzugriffs basierend auf benutzerspezifischen Berechtigungen | SID-Filterung-Verifizierung |
| (6) | Erstverifizierung | Verifizierung der Karten-UI, KB/Agent-Modus und Zitat-Anzeige |

---

## Vorbereitung

### Starten einer EC2-Instanz

```bash
aws ec2 run-instances \
  --region ap-northeast-1 \
  --image-id <UBUNTU_22_04_AMI_ID> \
  --instance-type t3.large \
  --subnet-id <PUBLIC_SUBNET_ID> \
  --security-group-ids <SG_ID> \
  --iam-instance-profile Name=<ADMIN_INSTANCE_PROFILE> \
  --associate-public-ip-address \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":50,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=cdk-deploy-server}]'
```

### Installation der erforderlichen Tools auf EC2

```bash
sudo apt-get update -y
sudo apt-get install -y curl git unzip docker.io jq

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

sudo systemctl enable docker && sudo systemctl start docker
sudo usermod -aG docker ubuntu && newgrp docker

sudo npm install -g aws-cdk typescript ts-node
```

### Klonen des Repositorys

```bash
cd /home/ubuntu
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG
npm install
```

---

## Nachweis (1): Aufbau einer RAG-basierten KI-Chatbot-Plattform

**Aufnahmeinhalt**: Systemarchitektur-Erklärung

### Architekturdiagramm

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
                                          ▼
                                 ┌──────────────────┐
                                 │ FSx for ONTAP    │
                                 │ (SVM + Volume)   │
                                 │ + S3 Access Point│
                                 └──────────────────┘
```

### 8 Components to Explain

1. **Next.js RAG Chatbot on AWS Lambda** — Serverless execution via Lambda Web Adapter. Card-based task-oriented UI
2. **AWS WAF** — Rate limiting, IP Reputation, OWASP-compliant rules, SQLi protection
3. **IAM Authentication** — Lambda Function URL IAM Auth + CloudFront OAC (SigV4)
4. **Vector Store** — S3 Vectors (default, low cost) / OpenSearch Serverless (high performance, selected via `vectorStoreType`)
5. **FSx ONTAP + S3 Access Point** — Provides documents directly to Bedrock KB via S3 AP
6. **Titan Embed Text v2** — Amazon Bedrock text vectorization model (1024 dimensions)
7. **SID Filtering** — Document-level access control using NTFS ACL SID information
8. **KB/Agent Mode Switching** — KB mode (document search) and Agent mode (dynamic Agent creation + multi-step reasoning)

### Recording Procedure

1. Display `docs/implementation-overview.md` on screen
2. Explain each component while showing the architecture diagram
3. Explain the CDK stack structure (7 stacks)
4. Explain the SID filtering flow diagram

---

## Evidence (2): Deploying the Chatbot Platform Using AWS CDK

**Recording Content**: CDK deployment execution and completion verification

### Step 1: Pre-Deploy Setup (ECR Image Preparation)

```bash
cd /home/ubuntu/Permission-aware-RAG-FSxN-CDK

# Create ECR repository + Build Docker image + Push
bash demo-data/scripts/pre-deploy-setup.sh
```

### Step 2: CDK Deployment (All 6 Stacks)

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  --require-approval never
```

> **Estimated Time**: Approximately 30–40 minutes (20–30 minutes for FSx ONTAP creation)

### Step 3: Post-Deploy Setup (Single Command)

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

Automatically executed tasks:
1. S3 Access Point creation + policy configuration
2. Upload demo data to FSx ONTAP (via S3 AP)
3. Bedrock KB data source addition + sync
4. Register user SID data in DynamoDB
5. Create demo users in Cognito

### Step 4: Deployment Verification

```bash
bash demo-data/scripts/verify-deployment.sh
```

### Recording Points

- Execution of `pre-deploy-setup.sh` (ECR image preparation)
- `cdk deploy --all` execution screen
- Execution of `post-deploy-setup.sh` (S3 AP creation → KB sync → user creation)
- Test results from `verify-deployment.sh`

---

## Evidence (3): Placing Storage Data on FSx ONTAP Volumes

**Recording Content**: Verifying data ingestion via S3 Access Point

`post-deploy-setup.sh` automatically uploads demo data via S3 AP. Manual verification:

```bash
STACK_PREFIX="perm-rag-demo-demo"
S3AP_NAME=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`S3AccessPointName`].OutputValue' --output text)
S3AP_ALIAS=$(aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query "S3AccessPointAttachments[?Name=='${S3AP_NAME}'].S3AccessPoint.Alias" --output text)

# List files via S3 AP
aws s3 ls "s3://${S3AP_ALIAS}/" --recursive --region ap-northeast-1
```

### Recording Points

- Display file listing via S3 AP
- Verify document contents (3 types: public / confidential / restricted)

---

## Evidence (4): Reflecting Access Permission Information

**Recording Content**: Verifying SID information via `.metadata.json`

```bash
# Check .metadata.json via S3 AP
aws s3 cp "s3://${S3AP_ALIAS}/public/company-overview.md.metadata.json" - | python3 -m json.tool
aws s3 cp "s3://${S3AP_ALIAS}/confidential/financial-report.md.metadata.json" - | python3 -m json.tool
aws s3 cp "s3://${S3AP_ALIAS}/restricted/project-plan.md.metadata.json" - | python3 -m json.tool
```

### SID and Access Permission Mapping

| Directory | allowed_group_sids | Admin | Regular User |
|-----------|-------------------|-------|-------------|
| `public/` | `S-1-1-0` (Everyone) | ✅ Viewable | ✅ Viewable |
| `confidential/` | `...-512` (Domain Admins) | ✅ Viewable | ❌ Not Viewable |
| `restricted/` | `...-1100` + `...-512` | ✅ Viewable | ❌ Not Viewable |

### Recording Points

- Display `.metadata.json` contents on screen
- Explain the meaning of SIDs (Everyone, Domain Admins, etc.)

---

## Evidence (5): Determining Data Access Based on Per-User Permissions

**Recording Content**: Verifying that different search results are returned for admin and regular users

### Checking DynamoDB SID Data

```bash
USER_ACCESS_TABLE=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`UserAccessTableName`].OutputValue' --output text)

aws dynamodb get-item --table-name ${USER_ACCESS_TABLE} \
  --key '{"userId":{"S":"admin@example.com"}}' --region ap-northeast-1 --output json | python3 -m json.tool

aws dynamodb get-item --table-name ${USER_ACCESS_TABLE} \
  --key '{"userId":{"S":"user@example.com"}}' --region ap-northeast-1 --output json | python3 -m json.tool
```

### SID Filtering Verification via curl

```bash
LAMBDA_URL=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionUrl`].OutputValue' --output text)
KB_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-AI --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)

# Admin user
echo "=== admin@example.com ==="
curl -s -X POST "${LAMBDA_URL}api/bedrock/kb/retrieve" \
  -H "Content-Type: application/json" \
  -d '{"query":"会社の売上はいくらですか？","userId":"admin@example.com","knowledgeBaseId":"'${KB_ID}'"}' \
  | python3 -c "import sys,json;fl=json.load(sys.stdin).get('filterLog',{});print(f'  {fl.get(\"allowedDocuments\",0)}/{fl.get(\"totalDocuments\",0)} documents allowed')"

# Regular user
echo "=== user@example.com ==="
curl -s -X POST "${LAMBDA_URL}api/bedrock/kb/retrieve" \
  -H "Content-Type: application/json" \
  -d '{"query":"会社の売上はいくらですか？","userId":"user@example.com","knowledgeBaseId":"'${KB_ID}'"}' \
  | python3 -c "import sys,json;fl=json.load(sys.stdin).get('filterLog',{});print(f'  {fl.get(\"allowedDocuments\",0)}/{fl.get(\"totalDocuments\",0)} documents allowed')"
```

### Recording Points

- Display DynamoDB SID data on screen
- Emphasize that admin has access to all documents while regular user only has access to public documents

---

## Evidence (6): Initial Verification — Card UI, KB/Agent Mode, and Citation Display

**Recording Content**: End-to-end verification in the browser

### Step 1: Access via Browser

```bash
CF_URL=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text)
echo "Access URL: ${CF_URL}/ja/signin"
```

### Step 2: Verification as Admin User (KB Mode)

1. Sign in as `admin@example.com`
2. Card grid is displayed (14 cards: 8 research + 6 output)
3. InfoBanner displays permission information (3 directories, read ✅, write ✅)
4. Click the "Document Search" card → prompt is set in the input field
5. Ask "What are the company's sales figures?"
6. Citations are displayed in the response (FSx file path + access level badge)
   - `confidential/financial-report.md` — Admin only (red badge)
   - `public/company-overview.md` — Accessible by everyone (green badge)
7. Click the "🔄 Return to Workflow Selection" button to go back to the card grid

### Step 3: Verification as Admin User (Agent Mode)

1. Switch to Agent mode using the "🤖 Agent" button in the header
2. Agent mode card grid is displayed (14 cards: 8 research + 6 output)
3. Click the "Financial Report Analysis" card
4. Bedrock Agent is automatically searched and dynamically created (wait a few seconds on first use)
5. Agent response + Citation display for the question

### Step 4: Verification as Regular User

1. Sign out → Sign in as `user@example.com`
2. InfoBanner displays permission information (1 directory only)
3. Ask "What are the company's sales figures?"
4. Confirm that Citations for confidential documents are not included in the response
5. Ask "Tell me about the product overview"
6. Confirm that Citations for public documents are displayed

### Verification Results Summary

| Question | admin | user | Reason |
|----------|-------|------|--------|
| Company sales | ✅ References financial report | ❌ Public info only | financial-report.md is Domain Admins only |
| Remote work policy | ✅ References HR policy | ❌ Access denied | hr-policy.md is Domain Admins only |
| Product overview | ✅ References product catalog | ✅ References product catalog | product-catalog.md is Everyone |

### Recording Points

- KB mode: Card grid → Question → Citation (file path + access level badge)
- Agent mode: Card click → Dynamic Agent creation → Response
- Comparison of admin vs. regular user results
- "Return to Workflow Selection" button behavior

---

## Resource Cleanup

```bash
bash demo-data/scripts/cleanup-all.sh
```

---

## Troubleshooting

| Symptom | Cause | Resolution |
|---------|-------|------------|
| schema version mismatch during CDK deploy | CDK CLI version mismatch | Use `npm install aws-cdk@latest` + `npx cdk` |
| KB search returns no results | Data source not synced | Re-run `post-deploy-setup.sh` |
| All documents are denied | SID data not registered | Re-run `post-deploy-setup.sh` |
| Page does not display | CloudFront cache | `aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"` |
| Docker permission error | Not in docker group | `sudo usermod -aG docker ubuntu && newgrp docker` |
| Dynamic Agent creation fails | Lambda IAM permissions insufficient | Deploy with `enableAgent=true` specified in CDK |
