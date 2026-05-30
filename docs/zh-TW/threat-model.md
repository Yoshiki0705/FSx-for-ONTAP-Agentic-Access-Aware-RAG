# 威脅模型 — Access-Aware Agentic RAG

**🌐 Language:** [日本語](../threat-model.md) | [English](../en/threat-model.md) | [한국어](../ko/threat-model.md) | [简体中文](../zh-CN/threat-model.md) | **繁體中文** | [Français](../fr/threat-model.md) | [Deutsch](../de/threat-model.md) | [Español](../es/threat-model.md)

**建立日期**: 2026-05-21  
**狀態**: 草案  
**目標對象**: 安全架構師、威脅建模負責人、CISO

---

## 概述

本文件整理了 Permission-aware Agentic RAG 系統的主要威脅、攻擊路徑、影響、現有緩解措施及建議追加對策的威脅模型。

---

## 系統邊界與信任邊界

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 信任邊界 1: 網際網路 → CloudFront                                        │
│  攻擊者: 外部使用者、機器人、腳本                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ 信任邊界 2: CloudFront → Lambda (WebApp)                                │
│  攻擊者: 已驗證但越權的使用者                                             │
├─────────────────────────────────────────────────────────────────────────┤
│ 信任邊界 3: Lambda → Bedrock / DynamoDB / FSx                           │
│  攻擊者: 內部威脅、設定錯誤、供應鏈                                       │
├─────────────────────────────────────────────────────────────────────────┤
│ 信任邊界 4: FSx for ONTAP → S3 Access Point → Bedrock KB                    │
│  攻擊者: 權限提升、中繼資料竄改                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 威脅目錄

### T1: Prompt Injection

| 項目 | 內容 |
|------|------|
| **威脅** | 惡意提示詞導致系統忽略系統提示詞、繞過權限檢查、造成非預期的資訊洩露 |
| **攻擊路徑** | 使用者輸入 → Converse API / Agent |
| **影響** | 高 — 越權文件內容洩露、系統行為被篡改 |
| **現有緩解措施** | Bedrock Guardrails（內容過濾）、SID 過濾在應用層執行（LLM 無法繞過） |
| **追加建議** | 啟用 Guardrails 的 Prompt Attack 過濾、輸入長度限制、新增輸出驗證層 |
| **殘餘風險** | 間接 Prompt Injection（嵌入文件中的指令）無法完全防範 |

**重要**: 本系統的 SID 過濾在 LLM 外部（應用層）執行，因此 Prompt Injection 無法繞過權限檢查本身。但仍存在將已授權文件中的資訊以非預期方式洩露的風險。

---

### T2: Retrieval Poisoning

| 項目 | 內容 |
|------|------|
| **威脅** | 將惡意文件放置於 FSx 磁碟區，污染 RAG 搜尋結果 |
| **攻擊路徑** | CIFS/SMB 存取 → FSx 磁碟區 → S3 AP → Bedrock KB |
| **影響** | 中～高 — 產生錯誤資訊、釣魚誘導、間接 Prompt Injection |
| **現有緩解措施** | NTFS ACL 寫入限制、Transfer Family 的 IAM 角色限制、`.metadata.json` 僅由服務角色產生 |
| **追加建議** | 文件匯入時進行惡意軟體掃描、內容驗證管線、異常偵測（文件急增告警） |
| **殘餘風險** | 擁有正規寫入權限的內部使用者蓄意污染 |

---

### T3: Cross-User Data Leakage

| 項目 | 內容 |
|------|------|
| **威脅** | 使用者 A 的搜尋結果中包含僅使用者 B 可存取的文件 |
| **攻擊路徑** | SID 過濾實作缺陷、快取污染、工作階段混淆 |
| **影響** | 高 — 機密資訊洩露、合規違規 |
| **現有緩解措施** | SID 比對（集合交集）、Fail-Closed 原則、權限矩陣測試（31 個情境） |
| **追加建議** | 定期自動執行權限矩陣測試、異常偵測（存取非常規文件的模式） |
| **殘餘風險** | 低 — SID 過濾在 LLM 外部執行，除實作缺陷外難以繞過 |

---

### T4: Stale ACL / Permission Drift

| 項目 | 內容 |
|------|------|
| **威脅** | 檔案 ACL 已變更，但向量儲存的中繼資料或權限快取中仍保留舊權限 |
| **攻擊路徑** | ACL 變更 → 中繼資料未更新 → 以舊權限可搜尋 |
| **影響** | 中 — 權限撤銷後仍可存取一段時間（最長 35 分鐘） |
| **現有緩解措施** | KB Auto-Sync（15 分鐘間隔）、權限快取 TTL（5 分鐘）、緊急權限撤銷程序 |
| **追加建議** | ACL 變更事件即時偵測（FSx Audit Log → EventBridge）、縮短快取 TTL、權限變更稽核日誌 |
| **殘餘風險** | Eventually Consistent 模型無法實現完全即時反映。緊急時以手動撤銷因應 |

**詳細**: 請參閱 [permission-consistency.md](../permission-consistency.md)

---

### T5: Over-Permissive Cache

| 項目 | 內容 |
|------|------|
| **威脅** | 權限快取以過度許可的狀態固定，持續允許本應拒絕的存取 |
| **攻擊路徑** | 快取寫入時的競爭條件、TTL 設定錯誤、快取金鑰衝突 |
| **影響** | 高 — 持續存取越權文件 |
| **現有緩解措施** | DynamoDB TTL 自動過期（5 分鐘）、快取金鑰包含使用者 ID + 文件 ID |
| **追加建議** | 監控快取命中率、異常高命中率告警、定期全面清除快取（每日） |
| **殘餘風險** | 低 — TTL 較短，即使被污染也會在 5 分鐘內自動恢復 |

---

### T6: Agent Tool Abuse

| 項目 | 內容 |
|------|------|
| **威脅** | Agent 呼叫非預期的工具，執行資料變更、刪除或外部傳送 |
| **攻擊路徑** | Prompt Injection → Agent 行動計畫被篡改 → 呼叫危險工具 |
| **影響** | 高 — 資料毀損、資訊洩露、成本暴增 |
| **現有緩解措施** | AgentCore Policy（工具存取限制）、Action Group 的 IAM 角色最小權限化、預設僅提供唯讀工具 |
| **追加建議** | Human Approval（外部動作執行前的核准）、工具呼叫次數限制、成本上限設定 |
| **殘餘風險** | 中 — Agent 自主性與安全性的取捨。限制為唯讀可降低風險 |

---

### T7: Audit Log Tampering

| 項目 | 內容 |
|------|------|
| **威脅** | 竄改或刪除稽核日誌，隱匿非法存取的證據 |
| **攻擊路徑** | Lambda 執行角色的權限提升 → 竄改 CloudWatch Logs / S3 |
| **影響** | 高 — 無法進行事件調查、合規違規 |
| **現有緩解措施** | CloudWatch Logs 保留政策、IAM 最小權限 |
| **追加建議** | S3 Object Lock（WORM）、CloudTrail 日誌儲存至另一帳戶、日誌完整性驗證（CloudTrail Digest） |
| **殘餘風險** | 低 — S3 Object Lock + 另一帳戶儲存可實質防止竄改 |

**詳細**: 請參閱 [governance-and-audit.md](../governance-and-audit.md)

---

### T8: Misconfigured Identity Federation

| 項目 | 內容 |
|------|------|
| **威脅** | OIDC / SAML / LDAP 設定錯誤導致非法使用者通過驗證，或正規使用者被授予過多權限 |
| **攻擊路徑** | IdP 設定錯誤 → 發行非法權杖 → 通過 Cognito 驗證 → 被授予過多 SID |
| **影響** | 高 — 權限提升、存取所有文件 |
| **現有緩解措施** | `authFailureMode=fail-closed`（權限取得失敗時封鎖）、Cognito 權杖驗證、LDAP 健康檢查 |
| **追加建議** | IdP 設定定期稽核、聯合身分中繼資料自動驗證、異常群組 SID 數量告警 |
| **殘餘風險** | 中 — IdP 端設定不在本系統控制範圍內。以 Fail-Closed 限制影響 |

---

### T9: Vector Metadata Leakage

| 項目 | 內容 |
|------|------|
| **威脅** | 向量儲存的中繼資料（SID 資訊、檔案路徑）意外暴露，洩露組織結構或存取權限資訊 |
| **攻擊路徑** | 直接存取 S3 Vectors / OpenSearch Serverless、API 回應返回過多資訊 |
| **影響** | 中 — 推測組織結構、收集目標式攻擊情報 |
| **現有緩解措施** | 透過 VPC 端點限制存取、IAM 政策防止直接存取、前端 API 回應排除 SID 資訊 |
| **追加建議** | S3 Vectors 儲存貯體政策最小權限化、OpenSearch Serverless 資料存取政策稽核、中繼資料加密 |
| **殘餘風險** | 低 — 僅允許透過 Bedrock KB 存取，以 IAM 防止直接存取 |

---

### T10: Denial of Wallet / Cost Abuse

| 項目 | 內容 |
|------|------|
| **威脅** | 大量請求或蓄意使用高成本模型，導致 AWS 費用暴增 |
| **攻擊路徑** | 已驗證使用者大量查詢、Agent 模式無限迴圈、連續使用高成本模型 |
| **影響** | 高 — 非預期的高額帳單 |
| **現有緩解措施** | WAF 速率限制（2000 req/5min）、Smart Routing（優先使用低成本模型）、Lambda 並行執行數限制 |
| **追加建議** | AWS Budgets 告警、使用者每日查詢上限、Agent 步驟數上限、考慮 Bedrock Provisioned Throughput |
| **殘餘風險** | 中 — 速率限制可緩解，但無法完全防止正規使用者的過度使用 |

---

## 威脅 → 對策對應表

| 威脅 | WAF | Guardrails | SID Filter | Fail-Closed | IAM | KMS | Audit | AgentCore Policy |
|------|-----|-----------|-----------|------------|-----|-----|-------|-----------------|
| T1: Prompt Injection | — | ✅ | — | — | — | — | ✅ | — |
| T2: Retrieval Poisoning | — | ✅ | — | — | ✅ | — | ✅ | — |
| T3: Cross-User Leakage | — | — | ✅ | ✅ | — | — | ✅ | — |
| T4: Stale ACL | — | — | — | ✅ | — | — | ✅ | — |
| T5: Over-Permissive Cache | — | — | ✅ | ✅ | — | — | ✅ | — |
| T6: Agent Tool Abuse | — | ✅ | — | — | ✅ | — | ✅ | ✅ |
| T7: Audit Log Tampering | — | — | — | — | ✅ | ✅ | — | — |
| T8: Misconfigured IdP | — | — | — | ✅ | ✅ | — | ✅ | — |
| T9: Metadata Leakage | — | — | — | — | ✅ | ✅ | ✅ | — |
| T10: Cost Abuse | ✅ | — | — | — | — | — | ✅ | ✅ |

---

## 風險評估摘要

| 威脅 | 發生可能性 | 影響度 | 殘餘風險 | 優先順序 |
|------|-----------|--------|---------|---------|
| T1: Prompt Injection | 高 | 中 | 中 | P1 |
| T2: Retrieval Poisoning | 低 | 高 | 低 | P2 |
| T3: Cross-User Leakage | 低 | 高 | 低 | P1 |
| T4: Stale ACL | 中 | 中 | 中 | P2 |
| T5: Over-Permissive Cache | 低 | 高 | 低 | P3 |
| T6: Agent Tool Abuse | 中 | 高 | 中 | P1 |
| T7: Audit Log Tampering | 低 | 高 | 低 | P2 |
| T8: Misconfigured IdP | 中 | 高 | 中 | P1 |
| T9: Metadata Leakage | 低 | 中 | 低 | P3 |
| T10: Cost Abuse | 中 | 中 | 中 | P2 |

---

## 建議追加對策（依優先順序）

### 即時應對（P1）

1. **啟用 Guardrails Prompt Attack 過濾** — T1 對策
2. **實作 Agent 工具呼叫的 Human Approval** — T6 對策
3. **建立 IdP 設定定期稽核流程** — T8 對策
4. **將權限矩陣測試納入 CI/CD** — T3 對策

### 短期應對（P2）

5. **以 S3 Object Lock 保護稽核日誌** — T7 對策
6. **ACL 變更事件即時偵測** — T4 對策
7. **文件匯入時的內容驗證** — T2 對策
8. **AWS Budgets + 使用者每日查詢上限** — T10 對策

### 中期應對（P3）

9. **快取命中率異常偵測** — T5 對策
10. **向量儲存中繼資料加密** — T9 對策

---

## 相關文件

| 文件 | 相關威脅 |
|------|---------|
| [production-readiness-checklist.md](../production-readiness-checklist.md) | 所有威脅（正式環境化時的對策確認） |
| [permission-consistency.md](../permission-consistency.md) | T3, T4, T5（權限一致性） |
| [governance-and-audit.md](../governance-and-audit.md) | T7, T8, T9（稽核・治理） |
| [safe-experimentation-guide.md](../safe-experimentation-guide.md) | T2, T10（安全實驗範圍） |
| [SID-Filtering-Architecture.md](../SID-Filtering-Architecture.md) | T1, T3, T5（SID 過濾架構設計） |
