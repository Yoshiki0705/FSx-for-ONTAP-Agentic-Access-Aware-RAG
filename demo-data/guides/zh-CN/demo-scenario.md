# 验证场景指南

## 概述

Permission-aware RAG 系统的动作验证步骤。通过基于 SID 的权限过滤，确认不同用户对相同问题获得不同的搜索结果。

---

## 场景 4: OIDC + LDAP Federation 验证

> **前提条件**: 使用 `oidcProviderConfig` + `ldapConfig` 完成 CDK 部署。VPC 内 OpenLDAP 服务器运行中。

### 4-1. OpenLDAP 设置

```bash
bash demo-data/scripts/setup-openldap.sh
npx cdk deploy perm-rag-demo-demo-Security --require-approval never
```

### 4-2. LDAP 测试用户

| User | Email | UID | GID | Groups |
|------|-------|-----|-----|--------|
| alice | alice@demo.local | 10001 | 5001 | engineering, confidential-readers, public-readers |
| bob | bob@demo.local | 10002 | 5002 | finance, public-readers |
| charlie | charlie@demo.local | 10003 | 5003 | hr, confidential-readers, public-readers |

### 4-4. 验证要点

| Field | Expected |
|-------|----------|
| DynamoDB `uid` | 10001 (from LDAP) |
| DynamoDB `gid` | 5001 (from LDAP) |
| DynamoDB `source` | `OIDC-LDAP` |
| DynamoDB `authSource` | `oidc` |
| Lambda Logs | `hasLdapConfig: true`, `groupCount: 3` |

### 4-5. 验证脚本

```bash
bash demo-data/scripts/verify-ldap-integration.sh
bash demo-data/scripts/verify-ontap-namemapping.sh
```

### 4-6. OpenLDAP 搭建注意事项

| Item | Details |
|------|---------|
| memberOf overlay | `moduleload memberof` + `overlay memberof` + `groupOfNames` |
| posixGroup vs groupOfNames | Different structural classes, use separate OU |
| Security groups | Allow ports 389/636 from Lambda SG |
| VPC placement | CDK auto-places Lambda in VPC when `ldapConfig` specified |

参见 [认证模式设置指南](zh-CN/auth-mode-setup-guide.md)。


---

## 5. 多智能体协作演示

### 前提条件

在 `cdk.context.json` 中设置 `enableMultiAgent: true` 并完成部署。

### 5-1. 启用多智能体模式

1. 点击聊天头部的 **[Multi Agent]** 切换按钮
2. 从头部的 **[Agent Select]** 下拉菜单中选择 Supervisor Agent
3. 自动创建新的多智能体会话

### 5-2. 权限过滤多智能体搜索

以 **admin** 身份登录并提问。在 Agent Trace UI 中查看时间线和成本明细。然后以 **user** 身份登录并比较结果。

### 5-3. Single Agent vs Multi-Agent 对比

1. 在 **Single 模式**下发送问题 → 记录响应时间和成本
2. 切换到 **Multi 模式** → 发送相同问题 → 对比

### 5-4. 部署注意事项

- **CloudFormation `AgentCollaboration` 有效值**：`DISABLED` | `SUPERVISOR` | `SUPERVISOR_ROUTER` 仅此三种。`COLLABORATOR` 无效
- **2 阶段部署**：先以 `DISABLED` 创建 Supervisor Agent，再用 Custom Resource Lambda：`UpdateAgent` → `SUPERVISOR_ROUTER`、`AssociateAgentCollaborator`、`PrepareAgent`
- **IAM 权限**：Supervisor 角色需要 `bedrock:GetAgentAlias` + `bedrock:InvokeAgent`（`agent-alias/*/*`）。Custom Resource Lambda 需要 `iam:PassRole`
- **Collaborator Alias**：每个 Collaborator Agent 在被 Supervisor 引用前需要 `CfnAgentAlias`
- **autoPrepare=true 不可用**：Supervisor Agent 不能使用

### 5-5. 运维发现

- **Team 列表获取**：聊天页面的 Multi 模式切换按钮在加载时通过 API 获取团队列表并检查 `teams.length > 0`。当没有团队时 Multi 模式被禁用（设计行为）
- **直接选择 Supervisor**：从下拉菜单中选择 Supervisor Agent 并在 Single Agent 模式下调用，仍会在 Bedrock 端触发多智能体协作（Supervisor → Collaborator 执行流程正常工作）
- **权限过滤**：Supervisor Agent 的响应包含经过权限过滤的引用（admin 用户可以看到机密文档，普通用户只能看到公开文档）
- **Docker 镜像更新**：代码更改后需要 3 个步骤：`docker buildx build --provenance=false --sbom=false` → `aws lambda update-function-code` → `aws cloudfront create-invalidation`（CDK 无法检测 `latest` 标签的变更）
- **Multi 模式集成**：Multi 模式切换 → `/api/bedrock/agent-team/invoke` 调用 → 包含 `multiAgentTrace` 的响应 → MultiAgentTraceTimeline + CostSummary 条件渲染已验证正常工作
- **Collaborator 追踪**：`buildCollaboratorTraces` 从 Bedrock Agent InvokeAgent API 追踪事件中提取 Collaborator 执行信息，但 Supervisor 内部的 Collaborator 调用可能不总是出现在追踪中（Bedrock 端限制）。响应本身正常返回
- **routingClassifierTrace**：在 `SUPERVISOR_ROUTER` 模式下，Collaborator 追踪出现在 `routingClassifierTrace`（而非 `orchestrationTrace`）中的 `agentCollaboratorInvocationInput/Output`
- **filteredSearch SID 自动解析**：filteredSearch Lambda 通过 `sessionAttributes.userId` 从 DynamoDB User Access Table 自动解析 SID 信息。即使没有显式 SID 参数，权限过滤也能正常工作
- **KB 元数据引号问题**：Bedrock KB 的 `allowed_group_sids` 可能包含额外的双引号。`cleanSID` 函数会去除这些引号以实现正确的 SID 匹配
- **Agent instruction 多语言支持**：CDK `agentLanguage` 属性（默认：`'auto'`）支持英语基础指令并自动匹配用户输入语言进行回复
- **E2E 验证成功**：admin 用户 Multi 模式 → 产品目录查询 → FSx for ONTAP 内容经权限过滤后返回。RetrievalAgent 详情面板和 CostSummary 正常显示
