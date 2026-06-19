# 合作伙伴 FAQ（常见问题）

**🌐 Language:** [日本語](../partner-faq.md) | [English](../en/partner-faq.md) | [한국어](../ko/partner-faq.md) | **简体中文** | [繁體中文](../zh-TW/partner-faq.md) | [Français](../fr/partner-faq.md) | [Deutsch](../de/partner-faq.md) | [Español](../es/partner-faq.md)

**创建日期**: 2026-05-24  
**对象**: 面向合作伙伴企业、系统集成商（SI）、咨询公司

---

## 客户提案时的常见问题

### Q1. 是否可以从现有的文件服务器（Windows Server）迁移？

**A**: 可以。FSx for ONTAP 支持与 Windows Server 文件服务器相同的 SMB/CIFS 协议，并可原样保留 NTFS ACL。通过将其加入现有的 Active Directory 域，用户的操作体验不会发生变化。迁移可以使用 AWS DataSync 或 robocopy。

**相关文档**: [FSx for ONTAP 规模与性能设计](fsxn-sizing-and-performance.md)

---

### Q2. 权限设置由谁来做？是否需要额外的设置工作？

**A**: 现有的 NTFS ACL / UNIX 权限会直接反映到 RAG 检索中。无需额外的权限设置。文件服务器管理员只需像往常一样设置文件夹权限，即可自动反映到 RAG 检索结果中。

**工作原理**: 文件的 `.metadata.json` 中记录了权限信息（SID/UID/GID），检索时会与用户的权限进行比对并过滤。

---

### Q3. 系统可以处理多少文件？

**A**: 我们推荐以下按规模划分的配置:

| 规模 | 文件数 | FSx 配置 | 每月概算 |
|------|-----------|---------|---------|
| 小规模（PoC） | 最多 10,000 | 128 MB/s, 1TB SSD | ~$430 |
| 中等规模 | 最多 100,000 | 256 MB/s, 5TB SSD | ~$3,626 |
| 大规模 | 最多 1,000,000 | 512 MB/s, 10TB SSD | ~$8,512 |

**相关文档**: [成本估算工作表](cost-estimation-worksheet.md)

---

### Q4. 是否可以与现有的身份认证基础设施（Active Directory / Okta / Auth0）集成？

**A**: 可以。支持以下认证方式:

| 认证方式 | 支持的 IdP | SID/权限获取方法 |
|---------|---------|----------------|
| SAML Federation | AD + IAM Identity Center, AD FS | 通过 Post-Auth Trigger 从 AD 自动获取 SID |
| OIDC | Auth0, Okta, Keycloak, Entra ID | OIDC 组声明 + LDAP 查询 |
| LDAP | OpenLDAP, FreeIPA | 直接获取 UID/GID |
| 邮箱/密码 | Cognito | 在 DynamoDB 中手动注册 |

**相关文档**: [认证与用户管理指南](auth-and-user-management.md)

---

### Q5. PoC 需要多长时间，成本是多少？

**A**: 

| 阶段 | 期间 | AWS 成本 | 作业内容 |
|---------|------|-----------|---------|
| 部署 | 1天 | — | CDK 部署 + 测试数据导入 |
| 基础验证 | 1周 | ~$100 | 使用演示数据进行功能确认 |
| 客户数据 PoC | 2-4周 | ~$430/月 | 真实数据导入 + 评估 |

我们还提供 **90 分钟动手实践研讨会** → [PoC 研讨会指南](poc-workshop-guide.md)

---

### Q6. 能否向安全要求严格的客户（金融、医疗、公共部门）提案？

**A**: 可以。系统具备以下安全功能:

- 6 层防御（Geo 限制 → WAF → OAC → IAM Auth → Cognito → SID 过滤）
- KMS 加密（S3、DynamoDB、FSx）
- VPC 端点（不经过互联网）
- 审计日志（CloudTrail + DynamoDB 审计表）
- Fail-Closed 设计（权限不明时拒绝访问）
- Bedrock Guardrails（内容过滤、PII 检测）

**但是**: 本系统的技术性安全功能并不会自动满足法律或合规要求。对于受监管的工作负载，需要进行客户特定的法务和合规评估。

**相关文档**: [生产就绪检查清单](production-readiness-checklist.md)、[威胁模型](threat-model.md)

---

### Q7. 是否支持多租户（向多个客户部署）？

**A**: 支持。我们提供 3 种部署模式:

| 模式 | 隔离级别 | 适用条件 |
|---------|-----------|---------|
| A: 账户隔离 | 最高 | 严格的数据隔离要求（金融、医疗） |
| B: SVM 隔离 | 高 | 在同一账户内隔离客户数据 |
| C: 前缀隔离 | 中 | 注重成本、小规模客户 |

**相关文档**: [合作伙伴部署模式](partner-deployment-patterns.md)

---

### Q8. 如何接收来自外部合作伙伴（律师事务所、审计公司）的文档？

**A**: 支持通过 AWS Transfer Family 进行 SFTP 导入。合作伙伴只需使用 SFTP 客户端上传文件，系统就会自动附加权限元数据并导入到 RAG Knowledge Base。

- 合作伙伴无需访问 Web UI 或 AWS Console
- 通过 IAM Deny 防止覆盖 `.metadata.json`（保护信任边界）
- 5 分钟内即可进行 RAG 检索

**相关文档**: [Transfer Family 合作伙伴入门](transfer-family-partner-onboarding.md)

---

### Q9. 是否可以通过语音提问？

**A**: 可以。我们提供两种语音聊天模式:

| 模式 | 技术 | 延迟 | 状态 |
|--------|------|-----------|------|
| Phase 1 (REST) | Amazon Nova Sonic | 中 | GA，可通过 CDK 部署 |
| Phase 2 (WebRTC) | AgentCore + Pipecat + KVS | 低 | 已实现，CLI 部署 |

在 语音输入 → 文本转换 → Permission-aware RAG 检索 → 语音输出 的整个流程中都会应用权限过滤。

---

### Q10. 与其他 AWS 服务的集成如何？

**A**: 已与以下服务集成:

| 服务 | 用途 |
|---------|------|
| Amazon Bedrock (KB + Agent) | RAG 检索 + 多智能体协作 |
| Amazon Cognito | 认证·用户管理 |
| Amazon CloudFront + WAF | CDN + 安全 |
| Amazon S3 Vectors | 矢量数据库（低成本） |
| Amazon EventBridge | KB 自动同步调度 |
| AWS Transfer Family | SFTP 导入 |
| Amazon CloudWatch | 监控·告警·仪表板 |
| AWS Step Functions | FSx for ONTAP 运维自动化 |

---

## 技术常见问题

### Q11. S3 Access Point 与 S3 存储桶有什么区别？

**A**: S3 Access Point 是面向 FSx for ONTAP 卷的 S3 兼容访问接口。与 S3 存储桶不同:

- 数据始终保留在 FSx for ONTAP 上（不会复制到 S3）
- 可通过 NFS/SMB 和 S3 API 两种方式访问相同的数据
- 存在 5GB 的上传大小限制
- 不支持 rename / append 操作

---

### Q12. 部署失败时如何回滚？

**A**: CDK 基于 CloudFormation，因此部署失败时会自动回滚。如果需要手动回滚:

```bash
# 删除特定堆栈
npx cdk destroy <stack-name>

# 删除所有堆栈
npx cdk destroy --all --force
```

**相关文档**: [部署故障排查](deployment-troubleshooting.md)

---

## 可用于提案和研讨会的资源

| 资源 | 用途 | 链接 |
|---------|------|--------|
| 行业专属演示数据 | 针对客户行业定制的演示 | [demo-data/industry-packs/](../demo-data/industry-packs/) |
| 90 分钟研讨会 | 动手实践体验 | [PoC 研讨会指南](poc-workshop-guide.md) |
| 成本估算 | 用于提案附件 | [成本估算工作表](cost-estimation-worksheet.md) |
| PoC 成功标准 | 用于客户共识 | [PoC 成功标准模板](poc-success-criteria-template.md) |
| 生产就绪检查清单 | 用于迁移规划 | [生产就绪检查清单](production-readiness-checklist.md) |
| 架构图 | 用于提案附件 | README.md 的 Architecture 部分 |
