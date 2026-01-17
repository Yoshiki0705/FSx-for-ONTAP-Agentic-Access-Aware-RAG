# 🛠️ Permission-aware RAG System Operations, Maintenance & Development Guide

> **Last Updated**: November 16, 2025  
> **Target Version**: v1.0.0+  
> **Audience**: Developers, Operations Engineers, System Administrators

---

## 📚 Table of Contents

<details>
<summary><strong>1. Introduction</strong></summary>

- [1.1 About This Guide](#11-about-this-guide)
- [1.2 Project Overview](#12-project-overview)
- [1.3 Prerequisites](#13-prerequisites)
- [1.4 Related Documentation](#14-related-documentation)

</details>

<details>
<summary><strong>2. Quick Start</strong></summary>

- [2.1 Environment Setup](#21-environment-setup)
- [2.2 Initial Deployment](#22-initial-deployment)
- [2.3 Verification](#23-verification)
- [2.4 Common Issues and Solutions](#24-common-issues-and-solutions)

</details>

<details>
<summary><strong>3. Architecture Understanding</strong></summary>

- [3.1 System Overview](#31-system-overview)
- [3.2 Modular Architecture](#32-modular-architecture)
- [3.3 CDK Stack Configuration](#33-cdk-stack-configuration)
- [3.4 Data Flow](#34-data-flow)

</details>

<details>
<summary><strong>4. Development Guide</strong></summary>

- [4.1 Development Environment Setup](#41-development-environment-setup)
- [4.2 Coding Standards](#42-coding-standards)
- [4.3 Adding New Modules](#43-adding-new-modules)
- [4.4 Running Tests](#44-running-tests)

</details>

<details>
<summary><strong>5. Deployment</strong></summary>

- [5.1 Deployment Strategy](#51-deployment-strategy)
- [5.2 Environment-Specific Deployment](#52-environment-specific-deployment)
- [5.3 Rollback Procedures](#53-rollback-procedures)
- [5.4 Post-Deployment Verification](#54-post-deployment-verification)

</details>

<details>
<summary><strong>6. Operations & Monitoring</strong></summary>

- [6.1 Daily Operations](#61-daily-operations)
- [6.2 Monitoring and Alerts](#62-monitoring-and-alerts)
- [6.3 Log Management](#63-log-management)
- [6.4 Performance Optimization](#64-performance-optimization)

</details>

<details>
<summary><strong>7. Troubleshooting</strong></summary>

- [7.1 Common Issues](#71-common-issues)
- [7.2 Deployment Errors](#72-deployment-errors)
- [7.3 Runtime Errors](#73-runtime-errors)
- [7.4 Emergency Response](#74-emergency-response)

</details>

<details>
<summary><strong>8. Security</strong></summary>

- [8.1 Security Best Practices](#81-security-best-practices)
- [8.2 Vulnerability Management](#82-vulnerability-management)
- [8.3 Access Control](#83-access-control)
- [8.4 Audit and Compliance](#84-audit-and-compliance)

</details>

<details>
<summary><strong>9. Reference</strong></summary>

- [9.1 Command Reference](#91-command-reference)
- [9.2 Configuration Files](#92-configuration-files)
- [9.3 Environment Variables](#93-environment-variables)
- [9.4 API Endpoints](#94-api-endpoints)

</details>

---

## 1. Introduction

### 1.1 About This Guide

This guide provides comprehensive documentation for operating, maintaining, and developing the Permission-aware RAG System with FSx for ONTAP.

**Target Audience**:
- System Developers
- DevOps Engineers
- System Administrators
- Operations Staff

**How to Use This Guide**:
1. First-time users should start with "Quick Start"
2. For specific tasks, refer to the relevant section from the table of contents
3. If issues occur, check "Troubleshooting"

### 1.2 Project Overview

**System Name**: Permission-aware RAG System with FSx for ONTAP

**Key Features**:
- Permission-based document access control
- AI search and answer generation using Amazon Bedrock
- High-performance storage with FSx for ONTAP
- Serverless architecture (Lambda + CloudFront)
- Multi-region support

**Technology Stack**:
- **IaC**: AWS CDK v2 (TypeScript)
- **Frontend**: Next.js 14.2.16, React 18, Tailwind CSS
- **Backend**: AWS Lambda (Node.js 20.x)
- **Database**: DynamoDB, OpenSearch Serverless
- **Storage**: S3, FSx for ONTAP
- **AI**: Amazon Bedrock (Nova Pro, Claude 3.5 Sonnet)

### 1.3 Prerequisites

To effectively use this guide, the following knowledge is recommended:

**Required**:
- AWS fundamentals (IAM, VPC, Lambda, S3, etc.)
- TypeScript/JavaScript basics
- Git basic operations
- Command-line operations

**Recommended**:
- AWS CDK experience
- Next.js/React experience
- Docker fundamentals
- Infrastructure as Code (IaC) understanding

### 1.4 Related Documentation

Please refer to the following documents along with this guide:

| Document | Description | Path |
|----------|-------------|------|
| README.md | Project overview | `/README.md` |
| Deployment Guide | Detailed deployment procedures | `/docs/DEPLOYMENT_GUIDE_UNIFIED.md` |
| Module Development Guide | Module development procedures | `/docs/guides/MODULE_DEVELOPMENT_GUIDE_EN.md` |
| Architecture Docs | System design details | `/docs/` |

---

## 2. Quick Start

### 2.1 Environment Setup

#### Prerequisites Check

```bash
# Verify Node.js 20 or higher is installed
node --version  # v20.x.x or higher

# Verify AWS CLI is installed
aws --version

# Verify AWS credentials are configured
aws sts get-caller-identity
```

#### Clone Repository

```bash
# Clone from GitHub
git clone https://github.com/NetAppJpTechTeam/Permission-aware-RAG-FSx for ONTAP-CDK.git
cd Permission-aware-RAG-FSx for ONTAP-CDK

# Install dependencies
npm install

# Build TypeScript
npm run build
```

#### Bootstrap AWS CDK

```bash
# Run once per region (first time only)
cdk bootstrap --region ap-northeast-1
```

### 2.2 Initial Deployment

#### Deploy to Development Environment

```bash
# Deploy all stacks at once (recommended)
npm run deploy:all:dev

# Or deploy individually
cdk deploy TokyoRegion-permission-aware-rag-prod-Networking
cdk deploy TokyoRegion-permission-aware-rag-prod-Security
cdk deploy TokyoRegion-permission-aware-rag-prod-Data
```

#### Monitor Deployment Progress

```bash
# Check CloudFormation stack status
aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-Networking \
  --query 'Stacks[0].StackStatus'
```

### 2.3 Verification

#### Verify Resources

```bash
# List deployed stacks
cdk list

# Check Lambda functions
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `permission-aware-rag`)].FunctionName'

# Check DynamoDB tables
aws dynamodb list-tables \
  --query 'TableNames[?contains(@, `permission-aware-rag`)]'
```

#### Access Application

```bash
# Get CloudFront distribution URL
aws cloudfront list-distributions \
  --query 'DistributionList.Items[0].DomainName' \
  --output text
```

Access the URL in your browser and verify the sign-in page is displayed.

### 2.4 Common Issues and Solutions

<details>
<summary><strong>Issue: CDK Bootstrap Error</strong></summary>

**Error Message**:
```
Error: Need to perform AWS CDK bootstrap
```

**Solution**:
```bash
cdk bootstrap --region ap-northeast-1 --profile your-profile
```

</details>

<details>
<summary><strong>Issue: Insufficient IAM Permissions</strong></summary>

**Error Message**:
```
User is not authorized to perform: iam:CreateRole
```

**Solution**:
Grant necessary IAM permissions:
- IAMFullAccess
- CloudFormationFullAccess
- Lambda-related permissions
- S3-related permissions

</details>

<details>
<summary><strong>Issue: TypeScript Compilation Error</strong></summary>

**Solution**:
```bash
# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

</details>

---

## 3. Architecture Understanding

### 3.1 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                          Users                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    CloudFront (CDN)                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Lambda (Next.js WebApp)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  - Sign-in functionality                              │  │
│  │  - Chatbot UI                                         │  │
│  │  - Bedrock integration                                │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ DynamoDB │  │    S3    │  │  Bedrock │
│(Sessions)│  │(Documents)│  │   (AI)   │
└──────────┘  └──────────┘  └──────────┘
                     │
                     ▼
              ┌──────────┐
              │   FSx    │
              │ (ONTAP)  │
              └──────────┘
```

### 3.2 Modular Architecture

The project consists of 9 functional modules:

```
lib/modules/
├── networking/     # VPC, Subnets, Gateways
├── security/       # IAM, KMS, WAF
├── storage/        # S3, FSx, Backup
├── database/       # DynamoDB, OpenSearch
├── compute/        # Lambda, Batch
├── ai/             # Bedrock, Embedding
├── api/            # API Gateway, Cognito
├── monitoring/     # CloudWatch, X-Ray
└── enterprise/     # Access Control, BI
```

**Module Placement Principles**:
- Each module has a single responsibility
- Modules are loosely coupled
- Information sharing via CloudFormation outputs

### 3.3 CDK Stack Configuration

Composed of 6 integrated CDK stacks:

| Stack Name | Role | Key Resources |
|-----------|------|--------------|
| NetworkingStack | Network infrastructure | VPC, Subnets, Gateways |
| SecurityStack | Security configuration | IAM, KMS, WAF |
| DataStack | Data & Storage | DynamoDB, S3, FSx |
| EmbeddingStack | Embedding & AI | Lambda, Bedrock |
| WebAppStack | API & Frontend | API Gateway, CloudFront |
| OperationsStack | Monitoring & Operations | CloudWatch, X-Ray |

**Stack Dependencies**:
```
NetworkingStack
    ↓
SecurityStack
    ↓
DataStack
    ↓
EmbeddingStack
    ↓
WebAppStack
    ↓
OperationsStack
```

### 3.4 Data Flow

#### User Authentication Flow

```
1. User → CloudFront → Lambda (Sign-in page)
2. Enter credentials
3. Lambda → DynamoDB (Create session)
4. Redirect → Chatbot page
```

#### Chat & Search Flow

```
1. User question → Lambda
2. Lambda → FSx (Permission check)
3. Lambda → S3 (Retrieve documents)
4. Lambda → Bedrock (AI processing)
5. Bedrock → Lambda (Generate answer)
6. Lambda → User (Display answer)
```

---


## 4. Development Guide

### 4.1 Development Environment Setup

#### Local Development Environment

```bash
# Navigate to project directory
cd Permission-aware-RAG-FSx for ONTAP-CDK

# Install development dependencies
npm install --include=dev

# TypeScript watch mode (auto-build)
npm run watch
```

#### Recommended VS Code Settings

`.vscode/settings.json`:
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

#### Recommended VS Code Extensions

- ESLint
- Prettier
- AWS Toolkit
- TypeScript and JavaScript Language Features

### 4.2 Coding Standards

#### TypeScript Conventions

**Naming Conventions**:
```typescript
// ✅ Correct examples
export class SecurityStack extends cdk.Stack { }  // PascalCase
const bucketName = 'my-bucket';                   // camelCase
const DEFAULT_REGION = 'ap-northeast-1';          // UPPER_SNAKE_CASE

// ❌ Incorrect examples
export class security_stack { }                   // snake_case prohibited
const BucketName = 'my-bucket';                   // PascalCase for variables prohibited
```

**Comment Conventions**:
```typescript
/**
 * Constructs the Security Stack
 * 
 * @param scope - CDK application scope
 * @param id - Stack ID
 * @param props - Stack properties
 */
export class SecurityStack extends cdk.Stack {
  /** WAF WebACL ARN */
  public readonly wafArn: string;
  
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // Create KMS encryption key
    const kmsKey = new kms.Key(this, 'EncryptionKey', {
      enableKeyRotation: true,
      description: 'Encryption key for RAG system'
    });
  }
}
```

#### File Placement Rules

**Strictly Prohibited**:
- Placing files directly in project root
- Using Phase-based naming (phase6, etc.)
- Creating duplicate files (with suffixes like optimized, improved, etc.)

**Correct Placement**:
```
lib/modules/[module-name]/
├── constructs/          # CDK Construct implementations
├── interfaces/          # TypeScript type definitions
├── utils/              # Utility functions
└── README.md           # Module documentation
```

### 4.3 Adding New Modules

#### Creating a New Module

```bash
# 1. Create module directory
mkdir -p lib/modules/my-module/{constructs,interfaces,utils}

# 2. Create README
cat > lib/modules/my-module/README.md << 'EOF'
# My Module

## Overview
Description of this module

## Key Features
- Feature 1
- Feature 2

## Usage
\`\`\`typescript
import { MyConstruct } from './constructs/my-construct';
\`\`\`
EOF
```

#### Interface Definition

`lib/modules/my-module/interfaces/my-config.ts`:
```typescript
/**
 * MyModule configuration interface
 */
export interface MyModuleConfig {
  /** Module name */
  readonly moduleName: string;
  
  /** Enable flag */
  readonly enabled: boolean;
  
  /** Optional settings */
  readonly options?: {
    readonly timeout?: number;
    readonly retryCount?: number;
  };
}
```

#### Construct Implementation

`lib/modules/my-module/constructs/my-construct.ts`:
```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { MyModuleConfig } from '../interfaces/my-config';

/**
 * MyModule Construct
 */
export class MyConstruct extends Construct {
  constructor(scope: Construct, id: string, config: MyModuleConfig) {
    super(scope, id);
    
    // Resource creation logic
    if (config.enabled) {
      // Implementation
    }
  }
}
```

### 4.4 Running Tests

#### Unit Tests

```bash
# Run all tests
npm test

# Test specific file
npm test -- my-construct.test.ts

# Test with coverage
npm test -- --coverage
```

#### Writing Tests

`tests/unit/my-construct.test.ts`:
```typescript
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { MyConstruct } from '../../lib/modules/my-module/constructs/my-construct';

describe('MyConstruct', () => {
  test('Resources are created correctly', () => {
    // Arrange
    const app = new App();
    const stack = new Stack(app, 'TestStack');
    
    // Act
    new MyConstruct(stack, 'TestConstruct', {
      moduleName: 'test-module',
      enabled: true
    });
    
    // Assert
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::Lambda::Function', 1);
  });
});
```

---

## 5. Deployment

### 5.1 Deployment Strategy

#### Recommended Deployment Flow

```
1. Development Environment (dev)
   ↓ Test & Verify
2. Staging Environment (staging)
   ↓ Pre-production Check
3. Production Environment (prod)
```

#### Pre-Deployment Checklist

- [ ] TypeScript build successful (`npm run build`)
- [ ] Unit tests passed (`npm test`)
- [ ] CDK Nag validation passed
- [ ] Configuration files verified
- [ ] Backup created

### 5.2 Environment-Specific Deployment

#### Development Environment

```bash
# Deploy all stacks at once
npm run deploy:all:dev

# Deploy individual stack
cdk deploy TokyoRegion-permission-aware-rag-dev-Networking \
  -c environment=dev

# Check differences
cdk diff --all -c environment=dev
```

#### Staging Environment

```bash
# Deploy to staging
cdk deploy --all \
  -c environment=staging \
  -c region=ap-northeast-1

# Post-deployment verification
# Run stack status verification script
```

#### Production Environment

```bash
# Deploy to production (approval required)
cdk deploy --all \
  -c environment=prod \
  -c region=ap-northeast-1 \
  --require-approval broadening

# Monitor deployment
watch -n 5 'aws cloudformation describe-stacks \
  --stack-name TokyoRegion-permission-aware-rag-prod-WebApp \
  --query "Stacks[0].StackStatus"'
```

### 5.3 Rollback Procedures

#### Emergency Rollback

```bash
# 1. Identify problematic stack
cdk list

# 2. Rollback the stack
aws cloudformation cancel-update-stack \
  --stack-name TokyoRegion-permission-aware-rag-prod-WebApp

# 3. Revert to previous version
cdk deploy TokyoRegion-permission-aware-rag-prod-WebApp \
  --previous-parameters
```

#### Complete Rollback

```bash
# Delete all stacks
cdk destroy --all -c environment=prod

# Redeploy from previous version
git checkout <previous-commit>
cdk deploy --all -c environment=prod
```

### 5.4 Post-Deployment Verification

#### Automated Verification Script

```bash
# Check CloudFormation stack status
aws cloudformation describe-stacks \
  --query 'Stacks[?contains(StackName, `permission-aware-rag`)].{Name:StackName,Status:StackStatus}' \
  --output table

# Expected output:
# ✅ NetworkingStack: UPDATE_COMPLETE
# ✅ SecurityStack: CREATE_COMPLETE
# ✅ DataStack: CREATE_COMPLETE
# ✅ WebAppStack: UPDATE_COMPLETE
```

#### Manual Verification Items

```bash
# 1. Verify Lambda function operation
aws lambda invoke \
  --function-name TokyoRegion-permission-awar-WebAppFunction \
  --payload '{}' \
  response.json

# 2. Verify CloudFront access
curl -I https://d1kbivn5pdlnap.cloudfront.net

# 3. Verify DynamoDB table
aws dynamodb describe-table \
  --table-name permission-aware-rag-sessions-prod

# 4. Check logs
aws logs tail /aws/lambda/TokyoRegion-permission-awar-WebAppFunction \
  --follow
```

---

## 6. Operations & Monitoring

### 6.1 Daily Operations

#### Daily Checklist

```bash
# 1. System health check
curl https://d1kbivn5pdlnap.cloudfront.net/api/health

# 2. Check error logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/TokyoRegion-permission-awar-WebAppFunction \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d '1 hour ago' +%s)000

# 3. Check CloudFormation stack status
aws cloudformation describe-stacks \
  --query 'Stacks[?StackStatus!=`UPDATE_COMPLETE` && StackStatus!=`CREATE_COMPLETE`]'
```

#### Weekly Tasks

- [ ] Verify backups
- [ ] Check security patches
- [ ] Cost analysis
- [ ] Performance review

#### Monthly Tasks

- [ ] Access log analysis
- [ ] Capacity planning
- [ ] Security audit
- [ ] Documentation updates

### 6.2 Monitoring and Alerts

#### CloudWatch Dashboard

```bash
# Create dashboard
aws cloudwatch put-dashboard \
  --dashboard-name RAG-System-Dashboard \
  --dashboard-body file://monitoring/dashboard.json
```

#### Alarm Configuration

```typescript
// Lambda function error alarm
const errorAlarm = new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
  metric: lambdaFunction.metricErrors(),
  threshold: 10,
  evaluationPeriods: 1,
  alarmDescription: 'Lambda function errors exceeded 10',
  actionsEnabled: true
});

// SNS notification setup
const topic = new sns.Topic(this, 'AlarmTopic');
errorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(topic));
```

### 6.3 Log Management

#### Viewing Logs

```bash
# Real-time log monitoring
aws logs tail /aws/lambda/TokyoRegion-permission-awar-WebAppFunction \
  --follow \
  --format short

# Get logs for specific period
aws logs filter-log-events \
  --log-group-name /aws/lambda/TokyoRegion-permission-awar-WebAppFunction \
  --start-time $(date -u -d '1 day ago' +%s)000 \
  --end-time $(date -u +%s)000 \
  --output json > logs.json
```

#### Log Analysis

```bash
# Aggregate error logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/TokyoRegion-permission-awar-WebAppFunction \
  --filter-pattern "ERROR" \
  --query 'events[*].message' \
  --output text | sort | uniq -c | sort -rn
```

### 6.4 Performance Optimization

#### Lambda Function Optimization

```typescript
// Adjust memory size
const optimizedFunction = new lambda.Function(this, 'OptimizedFunction', {
  runtime: lambda.Runtime.NODEJS_20_X,
  memorySize: 1024,  // Increase from 512MB to 1024MB
  timeout: cdk.Duration.seconds(30),
  reservedConcurrentExecutions: 10  // Limit concurrent executions
});
```

#### CloudFront Cache Optimization

```typescript
// Configure cache policy
const cachePolicy = new cloudfront.CachePolicy(this, 'CachePolicy', {
  defaultTtl: cdk.Duration.hours(24),
  maxTtl: cdk.Duration.days(365),
  minTtl: cdk.Duration.seconds(0),
  enableAcceptEncodingGzip: true,
  enableAcceptEncodingBrotli: true
});
```

---

## 7. Troubleshooting

### 7.1 Common Issues

<details>
<summary><strong>Issue: Deployment Hangs</strong></summary>

**Symptoms**:
```
Stack deployment is taking longer than expected...
```

**Causes**:
- CloudFormation stack waiting for dependent resource creation
- Timeout setting too short

**Solution**:
```bash
# 1. Check stack status
aws cloudformation describe-stack-events \
  --stack-name TokyoRegion-permission-aware-rag-prod-WebApp \
  --max-items 10

# 2. Extend timeout
cdk deploy --all --timeout 3600
```

</details>

<details>
<summary><strong>Issue: Lambda Returns 502 Error</strong></summary>

**Symptoms**:
```
502 Bad Gateway
```

**Causes**:
- Lambda function timeout
- Out of memory
- Environment variable misconfiguration

**Solution**:
```bash
# 1. Check CloudWatch Logs for errors
aws logs tail /aws/lambda/[Function-Name] --follow

# 2. Verify environment variables
aws lambda get-function-configuration \
  --function-name [Function-Name] \
  --query 'Environment.Variables'

# 3. Adjust memory and timeout
aws lambda update-function-configuration \
  --function-name [Function-Name] \
  --memory-size 1024 \
  --timeout 30
```

</details>

### 7.2 Deployment Errors

#### CloudFormation Rollback

**Symptoms**:
```
Stack TokyoRegion-permission-aware-rag-prod-WebApp is in ROLLBACK_COMPLETE state
```

**Resolution Steps**:
```bash
# 1. Identify error cause
aws cloudformation describe-stack-events \
  --stack-name TokyoRegion-permission-aware-rag-prod-WebApp \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'

# 2. Delete stack
cdk destroy TokyoRegion-permission-aware-rag-prod-WebApp

# 3. Fix issue and redeploy
cdk deploy TokyoRegion-permission-aware-rag-prod-WebApp
```

---

## 8. Security

### 8.1 Security Best Practices

#### Principle of Least Privilege

```typescript
// ✅ Correct: Minimum necessary permissions
const lambdaRole = new iam.Role(this, 'LambdaRole', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
  ]
});

// Grant access to specific DynamoDB table only
lambdaRole.addToPolicy(new iam.PolicyStatement({
  actions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
  resources: [sessionTable.tableArn]
}));

// ❌ Incorrect: Excessive permissions
lambdaRole.addManagedPolicy(
  iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')
);
```

#### Enforce Encryption

```typescript
// S3 bucket encryption
const bucket = new s3.Bucket(this, 'DocumentBucket', {
  encryption: s3.BucketEncryption.KMS,
  encryptionKey: kmsKey,
  enforceSSL: true  // Force HTTPS
});

// DynamoDB encryption
const table = new dynamodb.Table(this, 'SessionTable', {
  encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
  encryptionKey: kmsKey
});
```

---

## 9. Reference

### 9.1 Command Reference

#### CDK Commands

| Command | Description | Example |
|---------|-------------|---------|
| `cdk list` | List stacks | `cdk list` |
| `cdk synth` | Generate CloudFormation | `cdk synth --all` |
| `cdk diff` | Show differences | `cdk diff TokyoRegion-permission-aware-rag-prod-WebApp` |
| `cdk deploy` | Deploy | `cdk deploy --all` |
| `cdk destroy` | Delete stack | `cdk destroy --all` |
| `cdk bootstrap` | Initialize CDK | `cdk bootstrap --region ap-northeast-1` |

#### NPM Scripts

| Script | Description | Command |
|--------|-------------|---------|
| `npm run build` | Build TypeScript | `npm run build` |
| `npm run watch` | Watch mode | `npm run watch` |
| `npm test` | Run tests | `npm test` |
| `npm run deploy:all` | Deploy all stacks | `npm run deploy:all` |
| `npm run deploy:all:dev` | Deploy to dev | `npm run deploy:all:dev` |
| `npm run deploy:all:prod` | Deploy to prod | `npm run deploy:all:prod` |

### 9.2 Configuration Files

| File | Description | Path |
|------|-------------|------|
| cdk.json | CDK configuration | `/cdk.json` |
| tsconfig.json | TypeScript configuration | `/tsconfig.json` |
| package.json | NPM configuration | `/package.json` |
| .gitignore | Git ignore settings | `/.gitignore` |
| tokyo-production-config.ts | Tokyo prod config | `/lib/config/environments/` |

### 9.3 Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AWS_REGION` | AWS Region | `ap-northeast-1` | ✅ |
| `AWS_ACCOUNT_ID` | AWS Account ID | - | ✅ |
| `PROJECT_NAME` | Project name | `permission-aware-rag` | ✅ |
| `ENVIRONMENT` | Environment name | `prod` | ✅ |
| `BEDROCK_MODEL_ID` | Bedrock model | `amazon.nova-pro-v1:0` | ❌ |
| `TABLE_NAME` | DynamoDB table name | - | ✅ |

### 9.4 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/auth/signin` | POST | Sign in |
| `/api/auth/signout` | POST | Sign out |
| `/api/bedrock/chat` | POST | Send chat message |
| `/api/bedrock/models` | GET | Get model list |
| `/api/documents/search` | POST | Search documents |

---

## 📞 Support

### Contact

- **GitHub Issues**: [Project Issues](https://github.com/NetAppJpTechTeam/Permission-aware-RAG-FSx for ONTAP-CDK/issues)
- **Documentation**: `/docs/` directory

### Contributing

Contributions to the project are welcome!

1. Create a Fork
2. Create a Feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

---

**Last Updated**: November 16, 2025  
**Document Version**: 1.0.0  
**License**: Follows project license

