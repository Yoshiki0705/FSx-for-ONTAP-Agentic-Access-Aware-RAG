# 驗證場景指南

## 概述

Permission-aware RAG 系統的動作驗證步驟。透過基於 SID 的權限過濾，確認不同使用者對相同問題獲得不同的搜尋結果。

---

## 場景 4: OIDC + LDAP Federation 驗證

> **前提條件**: 使用 `oidcProviderConfig` + `ldapConfig` 完成 CDK 部署。VPC 內 OpenLDAP 伺服器運行中。

### 4-1. OpenLDAP 設定

```bash
bash demo-data/scripts/setup-openldap.sh
npx cdk deploy perm-rag-demo-demo-Security --require-approval never
```

### 4-2. LDAP 測試使用者

| User | Email | UID | GID | Groups |
|------|-------|-----|-----|--------|
| alice | alice@demo.local | 10001 | 5001 | engineering, confidential-readers, public-readers |
| bob | bob@demo.local | 10002 | 5002 | finance, public-readers |
| charlie | charlie@demo.local | 10003 | 5003 | hr, confidential-readers, public-readers |

### 4-4. 驗證要點

| Field | Expected |
|-------|----------|
| DynamoDB `uid` | 10001 (from LDAP) |
| DynamoDB `gid` | 5001 (from LDAP) |
| DynamoDB `source` | `OIDC-LDAP` |
| DynamoDB `authSource` | `oidc` |
| Lambda Logs | `hasLdapConfig: true`, `groupCount: 3` |

### 4-5. 驗證腳本

```bash
bash demo-data/scripts/verify-ldap-integration.sh
bash demo-data/scripts/verify-ontap-namemapping.sh
```

### 4-6. OpenLDAP 建置注意事項

| Item | Details |
|------|---------|
| memberOf overlay | `moduleload memberof` + `overlay memberof` + `groupOfNames` |
| posixGroup vs groupOfNames | Different structural classes, use separate OU |
| Security groups | Allow ports 389/636 from Lambda SG |
| VPC placement | CDK auto-places Lambda in VPC when `ldapConfig` specified |

參見 [認證模式設定指南](zh-TW/auth-mode-setup-guide.md)。


---

## 5. 多智能體協作演示

### 前提條件

在 `cdk.context.json` 中設定 `enableMultiAgent: true` 並完成部署。

### 5-1. 啟用多智能體模式

1. 點擊聊天標頭的 **[Multi]** 切換按鈕
2. 從 Team 下拉選單中選擇 "Permission RAG Team"
3. 自動建立新的多智能體工作階段

### 5-2. 權限過濾多智能體搜尋

以 **admin** 身分登入並提問。在 Agent Trace UI 中查看時間軸和成本明細。然後以 **user** 身分登入並比較結果。

### 5-3. Single Agent vs Multi-Agent 比較

1. 在 **Single 模式**下傳送問題 → 記錄回應時間和成本
2. 切換到 **Multi 模式** → 傳送相同問題 → 比較

### 5-4. 部署注意事項

- **CloudFormation `AgentCollaboration` 有效值**：`DISABLED` | `SUPERVISOR` | `SUPERVISOR_ROUTER` 僅此三種。`COLLABORATOR` 無效
- **2 階段部署**：先以 `DISABLED` 建立 Supervisor Agent，再用 Custom Resource Lambda：`UpdateAgent` → `SUPERVISOR_ROUTER`、`AssociateAgentCollaborator`、`PrepareAgent`
- **IAM 權限**：Supervisor 角色需要 `bedrock:GetAgentAlias` + `bedrock:InvokeAgent`（`agent-alias/*/*`）。Custom Resource Lambda 需要 `iam:PassRole`
- **Collaborator Alias**：每個 Collaborator Agent 在被 Supervisor 引用前需要 `CfnAgentAlias`
- **autoPrepare=true 不可用**：Supervisor Agent 不能使用

### 5-5. 運維發現

- **Team 列表取得**：聊天頁面的 Multi 模式切換按鈕在載入時透過 API 取得團隊列表並檢查 `teams.length > 0`。當沒有團隊時 Multi 模式被停用（設計行為）
- **直接選擇 Supervisor**：從下拉選單中選擇 Supervisor Agent 並在 Single Agent 模式下呼叫，仍會在 Bedrock 端觸發多智能體協作（Supervisor → Collaborator 執行流程正常運作）
- **權限過濾**：Supervisor Agent 的回應包含經過權限過濾的引用（admin 使用者可以看到機密文件，一般使用者只能看到公開文件）
- **Docker 映像更新**：程式碼變更後需要 3 個步驟：`docker buildx build --provenance=false --sbom=false` → `aws lambda update-function-code` → `aws cloudfront create-invalidation`（CDK 無法偵測 `latest` 標籤的變更）
- **Multi 模式整合**：Multi 模式切換 → `/api/bedrock/agent-team/invoke` 呼叫 → 包含 `multiAgentTrace` 的回應 → MultiAgentTraceTimeline + CostSummary 條件渲染已驗證正常運作
- **Collaborator 追蹤**：`buildCollaboratorTraces` 從 Bedrock Agent InvokeAgent API 追蹤事件中擷取 Collaborator 執行資訊，但 Supervisor 內部的 Collaborator 呼叫可能不總是出現在追蹤中（Bedrock 端限制）。回應本身正常返回
- **routingClassifierTrace**：在 `SUPERVISOR_ROUTER` 模式下，Collaborator 追蹤出現在 `routingClassifierTrace`（而非 `orchestrationTrace`）中的 `agentCollaboratorInvocationInput/Output`
- **filteredSearch SID 自動解析**：filteredSearch Lambda 透過 `sessionAttributes.userId` 從 DynamoDB User Access Table 自動解析 SID 資訊。即使沒有明確的 SID 參數，權限過濾也能正常運作
- **KB 中繼資料引號問題**：Bedrock KB 的 `allowed_group_sids` 可能包含額外的雙引號。`cleanSID` 函式會移除這些引號以實現正確的 SID 比對
- **Agent instruction 多語言支援**：CDK `agentLanguage` 屬性（預設：`'auto'`）支援英語基礎指令並自動配合使用者輸入語言進行回覆
- **E2E 驗證成功**：admin 使用者 Multi 模式 → 產品目錄查詢 → FSx for ONTAP 內容經權限過濾後返回。RetrievalAgent 詳情面板和 CostSummary 正常顯示
