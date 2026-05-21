# PoC 工作坊指南（90 分钟）

**🌐 Language:** [日本語](../poc-workshop-guide.md) | [English](../en/poc-workshop-guide.md) | [한국어](../ko/poc-workshop-guide.md) | **简体中文** | [繁體中文](../zh-TW/poc-workshop-guide.md) | [Français](../fr/poc-workshop-guide.md) | [Deutsch](../de/poc-workshop-guide.md) | [Español](../es/poc-workshop-guide.md)

**创建日期**: 2026-05-21  
**状态**: 草案  
**目标受众**: 解决方案架构师、合作伙伴工程师、客户云团队

---

## 概述

本工作坊将在 90 分钟内部署 Permission-aware Agentic RAG 系统，体验基于权限的搜索功能。

---

## 前提条件

| 项目 | 要求 |
|------|------|
| AWS 账户 | 具有 AdministratorAccess 相当的权限 |
| AWS CLI | v2 已配置（`aws sts get-caller-identity` 执行成功） |
| Node.js | 22 以上 |
| Docker | 已启动（`docker info` 执行成功） |
| CDK Bootstrap | 未执行的情况下在工作坊中执行 |
| Bedrock 模型访问 | Claude Haiku / Sonnet、Titan Embed v2 已启用 |

---

## 议程

| 时间 | 章节 | 内容 |
|------|------|------|
| 0:00–0:10 | 0. 简介 | 架构概述、用例说明 |
| 0:10–0:40 | 1. 环境部署 | 克隆、依赖安装、Bootstrap、部署 |
| 0:40–0:55 | 2. 演示数据导入 | 用户创建、测试文档配置 |
| 0:55–1:15 | 3. 权限感知 RAG 测试 | 不同用户的搜索、结果对比 |
| 1:15–1:25 | 4. 企业指南确认 | 生产化检查清单、评估模板 |
| 1:25–1:30 | 5. 清理 | 资源删除、费用确认 |

---

## 0. 简介（10 分钟）

### 本系统解决的问题

```
传统 RAG:
  企业文件 → 将所有文档交给 AI → 任何人都可以访问所有信息
  → 权限边界消失 → 机密泄露风险

Permission-aware RAG:
  企业文件 → 维持现有 ACL → 每个用户看到的文档不同
  → 在保护权限的同时利用 AI → 安全性与便利性兼得
```

### 架构（白板用）

```
用户 → CloudFront → Lambda (Next.js)
                          ↓
                Bedrock KB Retrieve API
                          ↓
                SID 过滤（应用层）
                          ↓
                仅使用已授权文档生成回答
```

---

## 1. 环境部署（30 分钟）

### Step 1.1: 克隆仓库

```bash
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG
npm install
```

### Step 1.2: CDK Bootstrap

```bash
# 主区域
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1

# WAF 用（CloudFront 必须使用 us-east-1）
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
```

### Step 1.3: 创建配置文件

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

> **注意**: 请根据参与者所在国家修改 `allowedCountries`。


### Step 1.4: Docker 镜像准备 & 部署

```bash
# Docker 镜像构建
bash demo-data/scripts/pre-deploy-setup.sh

# 部署（约 30 分钟）
npx cdk deploy --all --require-approval never
```

> 部署期间可以进行下一章节的说明，有效利用时间。

---

## 2. 演示数据导入（15 分钟）

### Step 2.1: 创建测试用户 & 数据

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

此脚本执行以下操作:
- 创建 Cognito 测试用户（admin@example.com, user@example.com）
- 在 DynamoDB 中注册 SID 数据
- 上传测试文档 + `.metadata.json` 到 S3
- 同步 Bedrock KB 数据源

### Step 2.2: 获取访问 URL

```bash
aws cloudformation describe-stacks \
  --stack-name ws-rag-workshop-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text
```

---

## 3. 权限感知 RAG 测试（20 分钟）

### 测试 1: 以管理员用户登录

1. 访问 CloudFront URL
2. 使用 `admin@example.com` / 密码（确认 post-deploy-setup.sh 的输出）登录
3. 提问「请告诉我公司的销售额」
4. **预期结果**: 包含 150 亿日元销售信息的回答（引用机密文档）

### 测试 2: 以普通用户登录

1. 退出登录
2. 使用 `user@example.com` 登录
3. 提出相同问题「请告诉我公司的销售额」
4. **预期结果**: 无销售信息（仅引用公开文档）

### 测试 3: Agent 模式

1. 通过页头的模式切换开关切换到「Agent」
2. 提问「请总结产品目录的内容」
3. **预期结果**: Agent 使用 KB 搜索工具，在权限范围内回答

### 确认要点

- [ ] 相同问题返回不同回答
- [ ] Citation 中显示访问级别徽章
- [ ] 普通用户不显示机密文档的 Citation

---

## 4. 企业指南确认（10 分钟）

向参与者介绍以下文档:

| 文档 | 确认要点 |
|------|---------|
| [生产化检查清单](production-readiness-checklist.md) | Demo/PoC/Production 的成熟度级别 |
| [评估模板](evaluation.md) | PoC 评估报告的单页摘要 |
| [安全实验指南](safe-experimentation-guide.md) | 导入实际数据前的检查清单 |
| [威胁模型](threat-model.md) | 10 个威胁类别和对策映射 |

---

## 5. 清理（5 分钟）

```bash
# 删除所有资源
npx cdk destroy --all --force
```

> **注意**: FSx for ONTAP 的删除需要 10〜15 分钟。命令完成后请在 AWS 控制台确认删除状态。

### 费用确认

```bash
# 确认残留资源
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=ws-rag \
  --region ap-northeast-1
```

---

## 成功标准

| 标准 | 确认方法 |
|------|---------|
| 环境正常部署 | 可以访问 CloudFront URL |
| 不同用户返回不同回答 | 测试 1 和测试 2 的对比 |
| 权限拒绝场景以 Fail-Closed 方式运行 | 普通用户不显示机密信息 |
| 生成审计日志 | CloudWatch Logs 中记录搜索日志 |
| 清理完成 | 无残留资源 |

---

## 故障排除

| 问题 | 处理方法 |
|------|---------|
| CDK Bootstrap 失败 | 确认 AWS CLI 的认证信息。`aws sts get-caller-identity` 是否成功 |
| Docker 构建失败 | 确认 Docker 是否已启动。`docker info` |
| 部署超过 40 分钟 | FSx for ONTAP 创建需要 20〜30 分钟，属于正常现象 |
| 无法登录 | 确认 Cognito 用户是否已创建。确认 `post-deploy-setup.sh` 的输出 |
| 搜索结果为 0 条 | 确认 KB 同步是否完成。等待几分钟后重试 |

---

## 后续步骤

工作坊完成后，请考虑以下事项:

1. **使用实际数据进行 PoC**: 按照[安全实验指南](safe-experimentation-guide.md)导入实际数据
2. **评估**: 使用[评估模板](evaluation.md)对 PoC 结果进行定量评估
3. **生产化探讨**: 通过[生产化检查清单](production-readiness-checklist.md)确认所需对策

---

## 相关文档

| 文档 | 内容 |
|------|------|
| [README.md](../README.md) | 系统全貌、部署步骤 |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | 安全实验指南 |
| [evaluation.md](evaluation.md) | RAG / Agent 评估指标 |
| [threat-model.md](threat-model.md) | 威胁模型 |
