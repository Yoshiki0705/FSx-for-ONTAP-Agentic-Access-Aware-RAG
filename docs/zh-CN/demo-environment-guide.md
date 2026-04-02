# Permission-aware RAG 验证环境指南

**🌐 Language:** [日本語](../demo-environment-guide.md) | [English](../en/demo-environment-guide.md) | [한국어](../ko/demo-environment-guide.md) | **简体中文** | [繁體中文](../zh-TW/demo-environment-guide.md) | [Français](../fr/demo-environment-guide.md) | [Deutsch](../de/demo-environment-guide.md) | [Español](../es/demo-environment-guide.md)

**最后更新**: 2026-03-25  
**区域**: ap-northeast-1（东京）

---

## 1. 访问信息

### Web 应用程序 URL

| 端点 | URL |
|---|---|
| CloudFront（生产） | `<CDK 部署后从 CloudFormation 输出获取>` |
| Lambda Function URL（直接） | `<CDK 部署后从 CloudFormation 输出获取>` |

```bash
# Command to retrieve URLs
STACK_PREFIX="perm-rag-demo-demo"
aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text
aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionUrl`].OutputValue' --output text
```

### 测试用户

| 用户 | 邮箱地址 | 密码 | 角色 | 权限 |
|---|---|---|---|---|
| 管理员 | `admin@example.com` | `DemoAdmin123!` | administrator | 可查看所有文档 |
| 普通用户 | `user@example.com` | `DemoUser123!` | user | 仅公开文档 |

认证由 Amazon Cognito 管理。

---

## 2. CDK 堆栈配置（6+1 个堆栈）

| 堆栈名称 | 区域 | 说明 |
|---|---|---|
| `${prefix}-Waf` | us-east-1 | CloudFront 的 WAF WebACL |
| `${prefix}-Networking` | ap-northeast-1 | VPC、子网、安全组 |
| `${prefix}-Security` | ap-northeast-1 | Cognito User Pool、认证 |
| `${prefix}-Storage` | ap-northeast-1 | FSx ONTAP + SVM + Volume + S3 + DynamoDB + AD |
| `${prefix}-AI` | ap-northeast-1 | Bedrock KB + S3 Vectors / OpenSearch Serverless（通过 `vectorStoreType` 选择） |
| `${prefix}-WebApp` | ap-northeast-1 | Lambda Web Adapter（Next.js）+ CloudFront |
| `${prefix}-Embedding`（可选） | ap-northeast-1 | Embedding EC2 + ECR（FlexCache CIFS 挂载） |

### 获取资源 ID

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

## 3. 验证场景

### 基本流程

1. 访问 CloudFront URL → `/ja/signin`
2. 使用测试用户登录
3. **KB 模式**：在聊天界面选择模型 → 验证 RAG 搜索中的权限过滤
4. **Agent 模式**：点击头部的"🤖 Agent"按钮 → 选择 Agent → 选择工作流或自由聊天

### 验证权限差异

当管理员和普通用户提出相同问题时，SID 过滤返回不同的结果。
KB 模式和 Agent 模式都适用相同的权限控制。

| 示例问题 | admin（KB/Agent） | user（KB/Agent） |
|--------|-------------------|-----------------|
| "公司的销售额是多少？" | ✅ 引用财务报告（6/6 允许） | ❌ 仅公开信息（2/6 允许） |
| "远程办公政策是什么？" | ✅ 引用 HR 政策 | ❌ 访问被拒绝 |
| "项目计划是什么？" | ✅ 引用项目计划 | ❌ 访问被拒绝 |

### Agent 模式验证

1. 点击头部的"🤖 Agent"按钮
2. 在侧边栏中选择 Agent（`perm-rag-demo-demo-agent`）
3. 选择工作流（📊 财务报告分析等）或输入聊天消息
4. 验证 Agent 响应（通过 Permission-aware Action Group 应用 SID 过滤）

### 动态 Agent 创建功能

在 Agent 模式中点击工作流卡片时，会自动搜索并创建对应类别的 Bedrock Agent。

| 项目 | 说明 |
|------|------|
| 触发器 | 点击工作流卡片 |
| 行为 | 通过 AGENT_CATEGORY_MAP 确定类别 → 搜索现有 Agent → 未找到时通过 CreateAgent API 动态创建 |
| 时长 | 首次创建 30-60 秒（显示加载 UI），第二次起由于 localStorage 缓存而即时 |
| Action Group | 动态创建的 Agent 自动附加 Permission-aware Action Group（通过 `PERM_SEARCH_LAMBDA_ARN` 环境变量指定） |
| 缓存 | 卡片-Agent 映射通过 `useCardAgentMappingStore`（Zustand + localStorage）持久化 |
| 所需权限 | Lambda IAM 角色需要 `bedrock:CreateAgent`、`bedrock:PrepareAgent`、`bedrock:CreateAgentAlias`、`bedrock:CreateAgentActionGroup`、`iam:PassRole` |

### CDK 部署选项

```bash
# Agent + all options enabled
npx cdk deploy --all --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  -c enableGuardrails=true \
  --require-approval never
```
| "告诉我产品概述" | ✅ 引用产品目录 | ✅ 引用产品目录 |

详情请参阅 [demo-data/guides/demo-scenario.md](../../demo-data/guides/demo-scenario.md)。

---

## 4. Active Directory 集成

### AD 信息

| 项目 | 值 |
|---|---|
| 域名 | `demo.local` |
| 版本 | Standard |
| DNS IP | `<AD 部署后获取>` |

```bash
# Retrieve AD information
aws ds describe-directories --region ap-northeast-1 \
  --query 'DirectoryDescriptions[?Name==`demo.local`].{Id:DirectoryId,Stage:Stage,DnsIps:DnsIpAddrs}' \
  --output table
```

### SVM AD 加入步骤

CDK 创建 SVM 时不包含 AD 配置。部署后，通过 CLI 加入 AD 域。

#### 前提条件：安全组配置

SVM AD 加入需要 FSx SG 和 AD SG 之间的通信。CDK 设置 `allowAllOutbound: true`，但还需要以下入站规则。

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

#### SVM AD 加入命令

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

> **重要**：使用 AWS Managed AD 时，省略 `OrganizationalUnitDistinguishedName` 会导致 MISCONFIGURED 状态。请按 `OU=Computers,OU=<NetBIOS 短名称>,DC=<域>,DC=<顶级域>` 格式指定。

#### 验证 AD 加入状态

```bash
aws fsx describe-storage-virtual-machines \
  --storage-virtual-machine-ids $SVM_ID \
  --query 'StorageVirtualMachines[0].ActiveDirectoryConfiguration' \
  --region ap-northeast-1 --output json
```

如果显示 `NetBiosName` 且 `SelfManagedActiveDirectoryConfiguration` 包含域信息，则加入成功。

详细步骤请参阅 [demo-data/guides/ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md)。

---

## 5. Knowledge Base 数据

### 选项 A：通过 S3 存储桶（默认）

以下文档注册在 S3 存储桶中。每个文档通过 `.metadata.json` 附加了 SID 信息。

| 文件 | 访问级别 | allowed_group_sids | admin | user |
|---|---|---|---|---|
| `public/company-overview.md` | public | S-1-1-0（Everyone） | ✅ | ✅ |
| `public/product-catalog.md` | public | S-1-1-0（Everyone） | ✅ | ✅ |
| `restricted/project-plan.md` | restricted | ...-1100, ...-512 | ✅ | ❌ |
| `confidential/financial-report.md` | confidential | ...-512（Domain Admins） | ✅ | ❌ |
| `confidential/hr-policy.md` | confidential | ...-512（Domain Admins） | ✅ | ❌ |

### 选项 B：通过 Embedding 服务器（FlexCache CIFS 挂载）

通过 CIFS 挂载 FlexCache Cache 卷，使用 Embedding 服务器直接向量化文档，然后索引到 OpenSearch Serverless（AOSS）。这是 S3 Access Point 不可用时的替代路径（截至 2026 年 3 月不支持 FlexCache Cache 卷）。仅在 AOSS 配置（`vectorStoreType=opensearch-serverless`）下可用。

详情请参阅 [6. Embedding 服务器](#6-embedding-服务器可选)。

---

## 6. Embedding 服务器（可选）

### 概述

EmbeddingStack（第 7 个 CDK 堆栈）是一个基于 EC2 的服务器，直接读取 FSx ONTAP 上 CIFS 共享的文档，使用 Amazon Bedrock Titan Embed Text v2 进行向量化，并索引到 OpenSearch Serverless（AOSS）。仅在 AOSS 配置（`vectorStoreType=opensearch-serverless`）下可用。

### 架构

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

### 部署步骤

#### 步骤 1：在 Secrets Manager 中注册密码

```bash
AD_SECRET_ARN=$(aws secretsmanager create-secret \
  --name perm-rag-demo-ad-password \
  --secret-string '{"password":"<AD_PASSWORD>"}' \
  --region ap-northeast-1 \
  --query 'ARN' --output text)
echo "Secret ARN: $AD_SECRET_ARN"
```

#### 步骤 2：部署 EmbeddingStack

```bash
npx cdk deploy ${STACK_PREFIX}-Embedding \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableEmbeddingServer=true \
  -c embeddingAdSecretArn=$AD_SECRET_ARN \
  -c embeddingAdUserName=Admin \
  -c embeddingAdDomain=demo.local \
  --require-approval never
```

#### 步骤 3：构建并推送 Docker 镜像

如果 EC2 实例上没有 Docker，请使用 CodeBuild。

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

如果有 Docker 环境，可以直接构建：

```bash
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com
docker build -t ${ECR_URI}:latest docker/embed/
docker push ${ECR_URI}:latest
```

#### 步骤 4：创建 CIFS 共享

设置 FSx ONTAP 管理员密码并通过 REST API 创建 CIFS 共享。

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

#### 步骤 5：CIFS 挂载和数据摄取

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

#### 步骤 6：更新 OpenSearch Serverless 数据访问策略

Embedding EC2 IAM 角色必须添加到 AOSS 数据访问策略中。

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

#### 步骤 7：运行 Embedding 容器

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

### Embedding 应用程序结构

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

### 处理流程

1. 递归扫描 CIFS 挂载的目录（.md、.txt、.html 等）
2. 从每个文档的 `.metadata.json` 读取 SID 信息
3. 将文本分割为 1000 字符的块（200 字符重叠）
4. 使用 Bedrock Titan Embed Text v2 生成 1024 维向量
5. 以 Bedrock KB 兼容格式索引到 OpenSearch Serverless
6. 在 `processed.json` 中记录已处理的文件（支持增量处理）

---

## 7. API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/signin` | 登录（Cognito 认证） |
| POST | `/api/auth/signout` | 退出登录 |
| GET | `/api/auth/session` | 获取会话信息 |
| GET | `/api/bedrock/models` | 列出可用模型 |
| POST | `/api/bedrock/chat` | 聊天 |
| POST | `/api/bedrock/kb/retrieve` | RAG 搜索（带 SID 过滤） |
| GET | `/api/health` | 健康检查 |

---

## 8. 设置步骤（部署后）

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

## 9. 故障排除

| 症状 | 原因 | 解决方案 |
|------|------|------|
| 无法登录 | Cognito 用户未创建 | 运行 `create-demo-users.sh` |
| KB 搜索无结果 | 数据源未同步 | 运行 `sync-kb-datasource.sh` |
| 所有文档被拒绝 | SID 数据未注册 | 运行 `setup-user-access.sh` |
| SVM AD 加入为 MISCONFIGURED | 未指定 OU 或安全组不足 | 显式指定 OU 路径 + 允许 FSx/AD SG 之间的通信 |
| Embedding 403 Forbidden | AOSS 数据访问策略缺失 | 将 Embedding EC2 角色添加到 AOSS 策略 |
| Embedding 容器认证错误 | IMDS hop 限制不足 | 验证 EC2 元数据 hop 限制 = 2 |
| 页面不显示 | CloudFront 缓存 | `aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"` |
| 冷启动延迟 | Lambda 初始启动 | 等待 10-15 秒（正常行为） |


---

## 环境删除

### 删除注意事项

您可以使用 `cdk destroy --all` 删除所有资源，但由于以下依赖关系可能需要手动干预。

| 问题 | 原因 | CDK 处理 |
|------|------|---------|
| AI 堆栈删除失败 | KB 中残留数据源 | ✅ 由 KbCleanup 自定义资源自动删除 |
| Storage 堆栈删除失败 | S3 AP 附加到卷 | ✅ 由 S3 AP 自定义资源 Delete 处理程序自动删除 |
| Networking 堆栈删除失败 | AD Controller SG 成为孤立资源 | ❌ 需要手动删除（见下方脚本） |
| Embedding 堆栈未被识别 | 依赖 CDK context | ❌ 需要先手动删除 |
| 手动创建的资源残留 | CodeBuild、ECR、IAM 策略 | ❌ 使用下方脚本删除 |

### 推荐的删除步骤

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
