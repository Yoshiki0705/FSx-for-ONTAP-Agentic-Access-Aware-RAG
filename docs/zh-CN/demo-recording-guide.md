# 验证演示视频录制指南

**🌐 Language:** [日本語](../demo-recording-guide.md) | [English](../en/demo-recording-guide.md) | [한국어](../ko/demo-recording-guide.md) | **简体中文** | [繁體中文](../zh-TW/demo-recording-guide.md) | [Français](../fr/demo-recording-guide.md) | [Deutsch](../de/demo-recording-guide.md) | [Español](../es/demo-recording-guide.md)

**最后更新**: 2026-03-29  
**目的**: Permission-Aware RAG 系统验证演示视频的逐步录制指南  
**前提条件**: AWS 账户（AdministratorAccess 等效权限）、EC2 实例（Ubuntu 22.04、t3.large 或更大、50GB EBS）

---

## 需要录制的证据（6 项）

| # | 证据 | 内容 |
|---|----------|---------|
| (1) | 构建基于 RAG 的 AI 聊天机器人平台 | 架构说明 |
| (2) | 使用 AWS CDK 部署聊天机器人平台 | CDK 部署步骤 |
| (3) | 将存储数据放置在 FSx ONTAP 卷上 | 通过 S3 Access Point 进行数据摄取 |
| (4) | 反映访问权限信息 | 在 `.metadata.json` 中设置和验证 SID 信息 |
| (5) | 基于每用户权限确定数据访问 | SID 过滤验证 |
| (6) | 初始验证 | 验证卡片 UI、KB/Agent 模式和 Citation 显示 |

---

## 准备工作

### 启动 EC2 实例

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

### 在 EC2 上安装必要工具

```bash
sudo apt-get update -y
sudo apt-get install -y curl git unzip docker.io jq

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

sudo systemctl enable docker && sudo systemctl start docker
sudo usermod -aG docker ubuntu && newgrp docker

sudo npm install -g aws-cdk typescript ts-node
```

### 克隆仓库

```bash
cd /home/ubuntu
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG
npm install
```

---

## 证据 (1)：构建基于 RAG 的 AI 聊天机器人平台

**录制内容**: 系统架构说明

### 架构图

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

### 需要说明的 8 个组件

1. **Next.js RAG Chatbot on AWS Lambda** — 通过 Lambda Web Adapter 实现无服务器执行。基于卡片的任务导向 UI
2. **AWS WAF** — 速率限制、IP 信誉、OWASP 合规规则、SQL 注入防护
3. **IAM 认证** — Lambda Function URL IAM Auth + CloudFront OAC（SigV4）
4. **向量存储** — S3 Vectors（默认，低成本）/ OpenSearch Serverless（高性能，通过 `vectorStoreType` 选择）
5. **FSx ONTAP + S3 Access Point** — 通过 S3 AP 直接向 Bedrock KB 提供文档
6. **Titan Embed Text v2** — Amazon Bedrock 文本向量化模型（1024 维）
7. **SID 过滤** — 使用 NTFS ACL SID 信息的文档级访问控制
8. **KB/Agent 模式切换** — KB 模式（文档搜索）和 Agent 模式（动态 Agent 创建 + 多步推理）

### 录制步骤

1. 在屏幕上显示 `docs/implementation-overview.md`
2. 展示架构图的同时说明每个组件
3. 说明 CDK 堆栈结构（7 个堆栈）
4. 说明 SID 过滤流程图

---

## 证据 (2)：使用 AWS CDK 部署聊天机器人平台

**录制内容**: CDK 部署执行和完成验证

### 步骤 1：部署前设置（ECR 镜像准备）

```bash
cd /home/ubuntu/Permission-aware-RAG-FSxN-CDK

# Create ECR repository + Build Docker image + Push
bash demo-data/scripts/pre-deploy-setup.sh
```

### 步骤 2：CDK 部署（全部 6 个堆栈）

```bash
npx cdk deploy --all \
  --app "npx ts-node bin/demo-app.ts" \
  -c enableAgent=true \
  --require-approval never
```

> **预计时间**: 约 30-40 分钟（FSx ONTAP 创建需要 20-30 分钟）

### 步骤 3：部署后设置（单条命令）

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

自动执行的任务：
1. S3 Access Point 创建 + 策略配置
2. 通过 S3 AP 上传演示数据到 FSx ONTAP
3. Bedrock KB 数据源添加 + 同步
4. 在 DynamoDB 中注册用户 SID 数据
5. 在 Cognito 中创建演示用户

### 步骤 4：部署验证

```bash
bash demo-data/scripts/verify-deployment.sh
```

### 录制要点

- `pre-deploy-setup.sh` 的执行（ECR 镜像准备）
- `cdk deploy --all` 执行画面
- `post-deploy-setup.sh` 的执行（S3 AP 创建 → KB 同步 → 用户创建）
- `verify-deployment.sh` 的测试结果

---

## 证据 (3)：将存储数据放置在 FSx ONTAP 卷上

**录制内容**: 验证通过 S3 Access Point 的数据摄取

`post-deploy-setup.sh` 自动通过 S3 AP 上传演示数据。手动验证：

```bash
STACK_PREFIX="perm-rag-demo-demo"
S3AP_NAME=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`S3AccessPointName`].OutputValue' --output text)
S3AP_ALIAS=$(aws fsx describe-s3-access-point-attachments --region ap-northeast-1 \
  --query "S3AccessPointAttachments[?Name=='${S3AP_NAME}'].S3AccessPoint.Alias" --output text)

# List files via S3 AP
aws s3 ls "s3://${S3AP_ALIAS}/" --recursive --region ap-northeast-1
```

### 录制要点

- 显示通过 S3 AP 的文件列表
- 验证文档内容（3 种类型：public / confidential / restricted）

---

## 证据 (4)：反映访问权限信息

**录制内容**: 通过 `.metadata.json` 验证 SID 信息

```bash
# Check .metadata.json via S3 AP
aws s3 cp "s3://${S3AP_ALIAS}/public/company-overview.md.metadata.json" - | python3 -m json.tool
aws s3 cp "s3://${S3AP_ALIAS}/confidential/financial-report.md.metadata.json" - | python3 -m json.tool
aws s3 cp "s3://${S3AP_ALIAS}/restricted/project-plan.md.metadata.json" - | python3 -m json.tool
```

### SID 与访问权限映射

| 目录 | allowed_group_sids | 管理员 | 普通用户 |
|-----------|-------------------|-------|-------------|
| `public/` | `S-1-1-0`（Everyone） | ✅ 可查看 | ✅ 可查看 |
| `confidential/` | `...-512`（Domain Admins） | ✅ 可查看 | ❌ 不可查看 |
| `restricted/` | `...-1100` + `...-512` | ✅ 可查看 | ❌ 不可查看 |

### 录制要点

- 在屏幕上显示 `.metadata.json` 内容
- 说明 SID 的含义（Everyone、Domain Admins 等）

---

## 证据 (5)：基于每用户权限确定数据访问

**录制内容**: 验证管理员和普通用户返回不同的搜索结果

### 检查 DynamoDB SID 数据

```bash
USER_ACCESS_TABLE=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`UserAccessTableName`].OutputValue' --output text)

aws dynamodb get-item --table-name ${USER_ACCESS_TABLE} \
  --key '{"userId":{"S":"admin@example.com"}}' --region ap-northeast-1 --output json | python3 -m json.tool

aws dynamodb get-item --table-name ${USER_ACCESS_TABLE} \
  --key '{"userId":{"S":"user@example.com"}}' --region ap-northeast-1 --output json | python3 -m json.tool
```

### 通过 curl 进行 SID 过滤验证

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

### 录制要点

- 在屏幕上显示 DynamoDB SID 数据
- 强调管理员可以访问所有文档，而普通用户只能访问公开文档

---

## 证据 (6)：初始验证 — 卡片 UI、KB/Agent 模式和 Citation 显示

**录制内容**: 浏览器中的端到端验证

### 步骤 1：通过浏览器访问

```bash
CF_URL=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text)
echo "Access URL: ${CF_URL}/ja/signin"
```

### 步骤 2：以管理员用户验证（KB 模式）

1. 以 `admin@example.com` 登录
2. 显示卡片网格（14 张卡片：8 张研究 + 6 张输出）
3. InfoBanner 显示权限信息（3 个目录，读取 ✅，写入 ✅）
4. 点击"文档搜索"卡片 → 提示词设置到输入框
5. 提问"公司的销售额是多少？"
6. 响应中显示 Citation（FSx 文件路径 + 访问级别徽章）
   - `confidential/financial-report.md` — 仅管理员（红色徽章）
   - `public/company-overview.md` — 所有人可访问（绿色徽章）
7. 点击"🔄 返回工作流选择"按钮回到卡片网格

### 步骤 3：以管理员用户验证（Agent 模式）

1. 使用头部的"🤖 Agent"按钮切换到 Agent 模式
2. 显示 Agent 模式卡片网格（14 张卡片：8 张研究 + 6 张输出）
3. 点击"财务报告分析"卡片
4. 自动搜索并动态创建 Bedrock Agent（首次使用时等待几秒）
5. Agent 响应 + 问题的 Citation 显示

### 步骤 4：以普通用户验证

1. 退出登录 → 以 `user@example.com` 登录
2. InfoBanner 显示权限信息（仅 1 个目录）
3. 提问"公司的销售额是多少？"
4. 确认响应中不包含机密文档的 Citation
5. 提问"告诉我产品概述"
6. 确认显示公开文档的 Citation

### 验证结果摘要

| 问题 | admin | user | 原因 |
|----------|-------|------|--------|
| 公司销售额 | ✅ 引用财务报告 | ❌ 仅公开信息 | financial-report.md 仅限 Domain Admins |
| 远程办公政策 | ✅ 引用 HR 政策 | ❌ 访问被拒绝 | hr-policy.md 仅限 Domain Admins |
| 产品概述 | ✅ 引用产品目录 | ✅ 引用产品目录 | product-catalog.md 为 Everyone |

### 录制要点

- KB 模式：卡片网格 → 提问 → Citation（文件路径 + 访问级别徽章）
- Agent 模式：点击卡片 → 动态 Agent 创建 → 响应
- 管理员与普通用户结果对比
- "返回工作流选择"按钮行为

---

## 资源清理

```bash
bash demo-data/scripts/cleanup-all.sh
```

---

## 故障排除

| 症状 | 原因 | 解决方案 |
|---------|-------|------------|
| CDK 部署时 schema version mismatch | CDK CLI 版本不匹配 | 使用 `npm install aws-cdk@latest` + `npx cdk` |
| KB 搜索无结果 | 数据源未同步 | 重新运行 `post-deploy-setup.sh` |
| 所有文档被拒绝 | SID 数据未注册 | 重新运行 `post-deploy-setup.sh` |
| 页面不显示 | CloudFront 缓存 | `aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"` |
| Docker 权限错误 | 不在 docker 组中 | `sudo usermod -aG docker ubuntu && newgrp docker` |
| 动态 Agent 创建失败 | Lambda IAM 权限不足 | 在 CDK 中指定 `enableAgent=true` 进行部署 |
