# 生產就緒檢查清單

**🌐 Language:** [日本語](../production-readiness-checklist.md) | [English](../en/production-readiness-checklist.md) | [한국어](../ko/production-readiness-checklist.md) | [简体中文](../zh-CN/production-readiness-checklist.md) | **繁體中文** | [Français](../fr/production-readiness-checklist.md) | [Deutsch](../de/production-readiness-checklist.md) | [Español](../es/production-readiness-checklist.md)

**建立日期**: 2026-05-21  
**狀態**: 草案  
**目標讀者**: 考慮從 PoC 遷移至生產環境的團隊

---

## 概述

本文件提供將 Permission-aware RAG 系統從 PoC 環境遷移至生產環境時需要驗證的檢查清單。

---

## 成熟度等級定義

| 等級 | 名稱 | 說明 | 適用對象 |
|------|------|------|----------|
| L1 | 展示 | 使用內建範例資料和使用者驗證運作。最快速的部署方式 | 技術驗證、內部展示 |
| L2 | PoC | 連接客戶 AD/IdP、匯入實際檔案、收集評估日誌 | 客戶提案、效果驗證 |
| L3 | 生產 | 多帳戶、稽核日誌保留、DR、SLO、威脅模型、維運 Runbook | 正式商業使用 |

---

## L1 → L2（展示 → PoC）檢查清單

### 認證與 ID 聯合

- [ ] 將 Cognito User Pool 連接至客戶 IdP（OIDC / SAML / LDAP）
- [ ] 確認測試使用者可成功 SSO 登入
- [ ] 確認自動 SID / UID+GID 取得正常運作
- [ ] 將 `authFailureMode` 設為 `fail-closed` 並確認權限取得失敗時的阻擋行為

### 資料匯入

- [ ] 將實際檔案（10–100 個）放置於 FSx for ONTAP 磁碟區
- [ ] 確認 `.metadata.json` 正確產生
- [ ] 確認 Bedrock KB 資料來源同步成功完成
- [ ] 確認不同權限的使用者搜尋結果正確過濾

### 評估

- [ ] 回答準確度的定性評估（10 個以上問題）
- [ ] 確認零權限違規
- [ ] 測量回應時間（P50 / P95 / P99）


---

## L2 → L3（PoC → 生產）檢查清單

### 1. 安全性

#### 加密

- [ ] S3 / DynamoDB / FSx 使用 KMS CMK 加密（`enableKmsEncryption=true`）
- [ ] 啟用 KMS 金鑰輪換
- [ ] 強制使用 TLS 1.2 或更高版本（CloudFront、ALB、FSx）
- [ ] 使用 Secrets Manager 管理密碼和 API 金鑰（不要在 `cdk.context.json` 中寫死）

#### 網路

- [ ] 啟用 VPC 端點（`enableVpcEndpoints=true`）
  - S3、DynamoDB、Bedrock、Bedrock Agent、CloudWatch Logs、STS
- [ ] 最小化安全群組權限（移除不必要的入站規則）
- [ ] 透過 NAT Gateway 限制出站流量
- [ ] 設定適當的 CloudFront 地理限制

#### WAF

- [ ] 設定生產環境速率限制值（預設：2000 req/5min）
- [ ] 設定 IP 允許清單（僅限內部 IP）
- [ ] 啟用 WAF 日誌儲存至 S3
- [ ] 考慮新增 Bot Control 規則

#### IAM

- [ ] 最小化 Lambda 執行角色權限
- [ ] 最小化 Bedrock KB 角色權限
- [ ] 限制跨帳戶存取
- [ ] 使用 IAM Access Analyzer 偵測未使用的權限

### 2. 稽核與日誌

- [ ] 啟用 CloudTrail（所有區域、管理事件 + 資料事件）
- [ ] 設定 CloudWatch Logs 保留期間（最少 1 年）
- [ ] 啟用 S3 存取日誌
- [ ] 透過 DynamoDB Streams 追蹤權限變更
- [ ] 啟用 Bedrock 模型呼叫日誌
- [ ] 防止稽核日誌竄改（S3 Object Lock / Glacier Vault Lock）
- [ ] 儲存 RAG 搜尋日誌（使用者 ID、查詢、參考文件、過濾結果）

### 3. 可用性與 DR

- [ ] 確認 FSx for ONTAP Multi-AZ 設定
- [ ] 啟用 DynamoDB Point-in-Time Recovery（PITR）
- [ ] 啟用 S3 版本控制
- [ ] 設定備份排程（FSx 自動備份）
- [ ] 定義並驗證 RTO / RPO
- [ ] 選擇 DR 區域並設計 SnapMirror 複寫
- [ ] 建立手動容錯移轉程序文件

### 4. 維運

- [ ] 設定 CloudWatch 儀表板（`enableMonitoring=true`）
- [ ] 設定警報閾值
  - Lambda 錯誤率 > 1%
  - Bedrock 延遲 P95 > 10s
  - DynamoDB 節流
  - FSx 儲存使用率 > 80%
- [ ] 建立維運 Runbook
  - KB 重新同步程序
  - 權限快取強制清除程序
  - 緊急權限撤銷程序
  - 回滾程序
- [ ] 定義事件回應流程
- [ ] 建立值班體制

### 5. 成本管理

- [ ] 使用 AWS Budgets 設定成本警報
- [ ] 定義標籤策略（Environment、Project、CostCenter）
- [ ] S3 生命週期政策（日誌遷移至 Glacier）
- [ ] 設定適當的 Lambda 記憶體和逾時值
- [ ] 監控 Bedrock 模型使用量
- [ ] 建立每月成本審查流程

### 6. 可擴展性

- [ ] 選擇 DynamoDB 容量模式（On-Demand vs Provisioned）
- [ ] 設定 Lambda 並行限制
- [ ] 驗證 Bedrock 吞吐量（考慮 Provisioned Throughput）
- [ ] 設定適當的 FSx 吞吐量容量
- [ ] 最佳化 CloudFront 快取策略

### 7. 合規性

- [ ] 建立資料分類政策（機密、內部、公開）
- [ ] 定義個人資訊處理規則
- [ ] 定義資料保留期間
- [ ] 準備服務條款和隱私政策
- [ ] 因應產業特定法規（醫療：HIPAA、金融：FISC、公部門：ISMAP）

### 8. 測試

- [ ] 執行權限矩陣測試（參見 [tests/permission-matrix/](../tests/permission-matrix/)）
- [ ] 負載測試（預期並行使用者的 2 倍）
- [ ] 安全性測試（滲透測試）
- [ ] DR 測試（容錯移轉 / 容錯回復）
- [ ] 權限變更傳播測試（ACL 變更 → 搜尋結果反映）

---

## 生產部署前最終驗證

```bash
# 1. 使用 CDK diff 驗證變更
npx cdk diff --all

# 2. 安全性掃描
npx cdk synth --quiet | cfn-nag

# 3. 執行測試
npx jest --no-coverage
cd automation/fsxn-ops && python3 -m pytest tests/ -v

# 4. 部署（需核准）
npx cdk deploy --all --require-approval broadening
```

---

## 相關文件

| 文件 | 說明 |
|------|------|
| [permission-consistency.md](permission-consistency.md) | 權限變更一致性模型 |
| [governance-and-audit.md](governance-and-audit.md) | 治理與稽核設計 |
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | 多租戶部署模式 |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | 安全實驗指南 |
| [evaluation.md](evaluation.md) | RAG / Agent 評估指標 |
