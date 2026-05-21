# PoC Workshop Guide (90 Minutes)

**🌐 Language:** [日本語](../poc-workshop-guide.md) | **English** | [한국어](../ko/poc-workshop-guide.md) | [简体中文](../zh-CN/poc-workshop-guide.md) | [繁體中文](../zh-TW/poc-workshop-guide.md) | [Français](../fr/poc-workshop-guide.md) | [Deutsch](../de/poc-workshop-guide.md) | [Español](../es/poc-workshop-guide.md)

**Created**: 2026-05-21  
**Status**: Draft  
**Audience**: Solution Architects, Partner Engineers, Customer Cloud Teams

---

## Overview

In this workshop, you will deploy the Permission-aware Agentic RAG system in 90 minutes and experience permission-based search in action.

---

## Prerequisites

| Item | Requirement |
|------|-------------|
| AWS Account | AdministratorAccess equivalent permissions |
| AWS CLI | v2 configured (`aws sts get-caller-identity` succeeds) |
| Node.js | 22 or higher |
| Docker | Running (`docker info` succeeds) |
| CDK Bootstrap | Will be performed during the workshop if not done |
| Bedrock Model Access | Claude Haiku / Sonnet, Titan Embed v2 enabled |

---

## Agenda

| Time | Section | Content |
|------|---------|---------|
| 0:00–0:10 | 0. Introduction | Architecture overview, use case explanation |
| 0:10–0:40 | 1. Environment Deployment | Clone, dependencies, Bootstrap, deploy |
| 0:40–0:55 | 2. Demo Data Ingestion | User creation, test document placement |
| 0:55–1:15 | 3. Permission-aware RAG Testing | Search with different users, compare results |
| 1:15–1:25 | 4. Enterprise Guide Review | Production readiness checklist, evaluation template |
| 1:25–1:30 | 5. Cleanup | Resource deletion, cost verification |

---

## 0. Introduction (10 minutes)

### The Problem This System Solves

```
Traditional RAG:
  Enterprise files → Pass all documents to AI → Anyone can access all information
  → Permission boundaries disappear → Confidential data leakage risk

Permission-aware RAG:
  Enterprise files → Maintain existing ACLs → Different documents visible per user
  → AI utilization while preserving permissions → Security and convenience combined
```

### Architecture (For Whiteboard)

```
User → CloudFront → Lambda (Next.js)
                          ↓
                Bedrock KB Retrieve API
                          ↓
                SID Filtering (Application Side)
                          ↓
                Generate response using only permitted documents
```

---

## 1. Environment Deployment (30 minutes)

### Step 1.1: Clone Repository

```bash
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG
npm install
```

### Step 1.2: CDK Bootstrap

```bash
# Main region
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1

# For WAF (CloudFront requires us-east-1)
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
```

### Step 1.3: Create Configuration File

```bash
cat > cdk.context.json << 'EOF'
{
  "projectName": "ws-rag",
  "environment": "workshop",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"]
}
EOF
```

> **Note**: Adjust `allowedCountries` to match the participants' country.

### Step 1.4: Docker Image Preparation & Deploy

```bash
# Build Docker image
bash demo-data/scripts/pre-deploy-setup.sh

# Deploy (approximately 30 minutes)
npx cdk deploy --all --require-approval never
```

> You can make effective use of time by explaining the next section during deployment.

---

## 2. Demo Data Ingestion (15 minutes)

### Step 2.1: Create Test Users & Data

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

This script performs the following:
- Creates Cognito test users (admin@example.com, user@example.com)
- Registers SID data in DynamoDB
- Uploads test documents + `.metadata.json` to S3
- Syncs Bedrock KB data source

### Step 2.2: Get Access URL

```bash
aws cloudformation describe-stacks \
  --stack-name ws-rag-workshop-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text
```

---

## 3. Permission-aware RAG Testing (20 minutes)

### Test 1: Sign in as Admin User

1. Access the CloudFront URL
2. Sign in with `admin@example.com` / password (check post-deploy-setup.sh output)
3. Ask "Tell me about the company's revenue"
4. **Expected Result**: Response including 15 billion yen revenue information (referencing confidential documents)

### Test 2: Sign in as General User

1. Sign out
2. Sign in as `user@example.com`
3. Ask the same question "Tell me about the company's revenue"
4. **Expected Result**: No revenue information (only public documents referenced)

### Test 3: Agent Mode

1. Switch to "Agent" using the mode toggle in the header
2. Ask "Please summarize the product catalog contents"
3. **Expected Result**: Agent uses KB search tool and responds within permission scope

### Verification Points

- [ ] Same question returns different answers
- [ ] Citations display access level badges
- [ ] Confidential document citations are not shown to general users

---

## 4. Enterprise Guide Review (10 minutes)

Introduce the following documents to participants:

| Document | Key Points |
|----------|------------|
| [Production Readiness Checklist](../production-readiness-checklist.md) | Demo/PoC/Production maturity levels |
| [Evaluation Template](../evaluation.md) | One-page PoC evaluation report summary |
| [Safe Experimentation Guide](../safe-experimentation-guide.md) | Checklist before real data ingestion |
| [Threat Model](../threat-model.md) | 10 threat categories and countermeasure mapping |

---

## 5. Cleanup (5 minutes)

```bash
# Delete all resources
npx cdk destroy --all --force
```

> **Note**: FSx for ONTAP deletion takes 10–15 minutes. Check the deletion status in the AWS Console even after the command completes.

### Cost Verification

```bash
# Check for remaining resources
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=ws-rag \
  --region ap-northeast-1
```

---

## Success Criteria

| Criteria | Verification Method |
|----------|-------------------|
| Environment deployed successfully | CloudFront URL is accessible |
| Different users get different answers | Compare Test 1 and Test 2 |
| Permission denial scenario works Fail-Closed | Confidential information not shown to general users |
| Audit logs are generated | Search logs recorded in CloudWatch Logs |
| Cleanup completed | No remaining resources |

---

## Troubleshooting

| Issue | Resolution |
|-------|-----------|
| CDK Bootstrap fails | Check AWS CLI credentials. Does `aws sts get-caller-identity` succeed? |
| Docker build fails | Check if Docker is running. `docker info` |
| Deployment takes over 40 minutes | FSx for ONTAP creation takes 20–30 minutes, this is normal |
| Cannot sign in | Check if Cognito users were created. Check `post-deploy-setup.sh` output |
| Search returns 0 results | Check if KB sync is complete. Wait a few minutes and retry |

---

## Next Steps

After completing the workshop, consider the following:

1. **PoC with Real Data**: Ingest real data following the [Safe Experimentation Guide](../safe-experimentation-guide.md)
2. **Evaluation**: Quantitatively evaluate PoC results using the [Evaluation Template](../evaluation.md)
3. **Production Readiness**: Review required countermeasures with the [Production Readiness Checklist](../production-readiness-checklist.md)

---

## Related Documents

| Document | Content |
|----------|---------|
| [README.md](../../README.en.md) | System overview, deployment procedures |
| [safe-experimentation-guide.md](../safe-experimentation-guide.md) | Safe experimentation guide |
| [evaluation.md](../evaluation.md) | RAG / Agent evaluation metrics |
| [threat-model.md](../threat-model.md) | Threat model |
