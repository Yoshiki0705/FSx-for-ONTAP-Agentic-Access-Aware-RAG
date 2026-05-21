# 生产就绪检查清单

**🌐 Language:** [日本語](../production-readiness-checklist.md) | [English](../en/production-readiness-checklist.md) | [한국어](../ko/production-readiness-checklist.md) | **简体中文** | [繁體中文](../zh-TW/production-readiness-checklist.md) | [Français](../fr/production-readiness-checklist.md) | [Deutsch](../de/production-readiness-checklist.md) | [Español](../es/production-readiness-checklist.md)

**创建日期**: 2026-05-21  
**状态**: 草案  
**目标读者**: 考虑从 PoC 迁移到生产环境的团队

---

## 概述

本文档提供了将 Permission-aware RAG 系统从 PoC 环境迁移到生产环境时需要验证的检查清单。

---

## 成熟度级别定义

| 级别 | 名称 | 描述 | 目标 |
|------|------|------|------|
| L1 | 演示 | 使用内置示例数据和用户验证运行。最快部署 | 技术验证、内部演示 |
| L2 | PoC | 连接客户 AD/IdP，导入真实文件，收集评估日志 | 客户提案、效果验证 |
| L3 | 生产 | 多账户、审计日志保留、DR、SLO、威胁模型、运维 Runbook | 生产业务使用 |

---

## L1 → L2（演示 → PoC）检查清单

### 认证与 ID 联合

- [ ] 将 Cognito User Pool 连接到客户 IdP（OIDC / SAML / LDAP）
- [ ] 确认测试用户 SSO 登录成功
- [ ] 确认自动 SID / UID+GID 获取正常工作
- [ ] 将 `authFailureMode` 设置为 `fail-closed` 并确认权限获取失败时的阻止行为

### 数据导入

- [ ] 将真实文件（10–100 个）放置到 FSx for ONTAP 卷上
- [ ] 确认 `.metadata.json` 正确生成
- [ ] 确认 Bedrock KB 数据源同步成功完成
- [ ] 确认不同权限的用户搜索结果被正确过滤

### 评估

- [ ] 回答准确性的定性评估（10 个以上问题）
- [ ] 确认零权限违规
- [ ] 测量响应时间（P50 / P95 / P99）

---

## L2 → L3（PoC → 生产）检查清单

### 1. 安全性

#### 加密

- [ ] S3 / DynamoDB / FSx 的 KMS CMK 加密（`enableKmsEncryption=true`）
- [ ] 启用 KMS 密钥轮换
- [ ] 强制 TLS 1.2 或更高版本（CloudFront、ALB、FSx）
- [ ] 使用 Secrets Manager 管理密码和 API 密钥（不要硬编码在 `cdk.context.json` 中）

#### 网络

- [ ] 启用 VPC 端点（`enableVpcEndpoints=true`）
  - S3、DynamoDB、Bedrock、Bedrock Agent、CloudWatch Logs、STS
- [ ] 最小化安全组权限（删除不必要的入站规则）
- [ ] 通过 NAT Gateway 限制出站流量
- [ ] 配置适当的 CloudFront 地理限制

#### WAF

- [ ] 设置生产环境速率限制值（默认：2000 req/5min）
- [ ] 配置 IP 允许列表（仅限内部 IP）
- [ ] 启用 WAF 日志存储到 S3
- [ ] 考虑添加 Bot Control 规则

#### IAM

- [ ] 最小化 Lambda 执行角色权限
- [ ] 最小化 Bedrock KB 角色权限
- [ ] 限制跨账户访问
- [ ] 使用 IAM Access Analyzer 检测未使用的权限

### 2. 审计与日志

- [ ] 启用 CloudTrail（所有区域，管理事件 + 数据事件）
- [ ] 设置 CloudWatch Logs 保留期限（最少 1 年）
- [ ] 启用 S3 访问日志
- [ ] 通过 DynamoDB Streams 跟踪权限变更
- [ ] 启用 Bedrock 模型调用日志
- [ ] 防止审计日志篡改（S3 Object Lock / Glacier Vault Lock）
- [ ] 存储 RAG 搜索日志（用户 ID、查询、引用文档、过滤结果）

### 3. 可用性与灾难恢复

- [ ] 确认 FSx for ONTAP Multi-AZ 配置
- [ ] 启用 DynamoDB 时间点恢复（PITR）
- [ ] 启用 S3 版本控制
- [ ] 配置备份计划（FSx 自动备份）
- [ ] 定义并验证 RTO / RPO
- [ ] 选择 DR 区域并设计 SnapMirror 复制
- [ ] 创建手动故障转移操作文档

### 4. 运维

- [ ] 配置 CloudWatch 仪表板（`enableMonitoring=true`）
- [ ] 设置告警阈值
  - Lambda 错误率 > 1%
  - Bedrock 延迟 P95 > 10s
  - DynamoDB 限流
  - FSx 存储利用率 > 80%
- [ ] 创建运维 Runbook
  - KB 重新同步流程
  - 权限缓存强制清除流程
  - 紧急权限撤销流程
  - 回滚流程
- [ ] 定义事件响应流程
- [ ] 建立值班体制

### 5. 成本管理

- [ ] 使用 AWS Budgets 设置成本告警
- [ ] 定义标签策略（Environment、Project、CostCenter）
- [ ] S3 生命周期策略（日志迁移到 Glacier）
- [ ] 设置适当的 Lambda 内存和超时值
- [ ] 监控 Bedrock 模型使用量
- [ ] 建立月度成本审查流程

### 6. 可扩展性

- [ ] 选择 DynamoDB 容量模式（On-Demand vs Provisioned）
- [ ] 配置 Lambda 并发限制
- [ ] 验证 Bedrock 吞吐量（考虑 Provisioned Throughput）
- [ ] 设置适当的 FSx 吞吐量容量
- [ ] 优化 CloudFront 缓存策略

### 7. 合规性

- [ ] 建立数据分类策略（机密、内部、公开）
- [ ] 定义个人信息处理规则
- [ ] 定义数据保留期限
- [ ] 准备服务条款和隐私政策
- [ ] 应对行业特定法规（医疗：HIPAA、金融：FISC、公共：ISMAP）

### 8. 测试

- [ ] 执行权限矩阵测试（参见 [tests/permission-matrix/](../tests/permission-matrix/)）
- [ ] 负载测试（预期并发用户数的 2 倍）
- [ ] 安全测试（渗透测试）
- [ ] DR 测试（故障转移 / 故障恢复）
- [ ] 权限变更传播测试（ACL 变更 → 搜索结果反映）

---

## 生产部署前的最终验证

```bash
# 1. 使用 CDK diff 验证变更
npx cdk diff --all

# 2. 安全扫描
npx cdk synth --quiet | cfn-nag

# 3. 运行测试
npx jest --no-coverage
cd automation/fsxn-ops && python3 -m pytest tests/ -v

# 4. 部署（需要审批）
npx cdk deploy --all --require-approval broadening
```

---

## 相关文档

| 文档 | 描述 |
|------|------|
| [permission-consistency.md](permission-consistency.md) | 权限变更一致性模型 |
| [governance-and-audit.md](governance-and-audit.md) | 治理与审计设计 |
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | 多租户部署模式 |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | 安全实验指南 |
| [evaluation.md](evaluation.md) | RAG / Agent 评估指标 |
