# 多租戶/合作夥伴部署模式

**🌐 Language:** [日本語](../partner-deployment-patterns.md) | [English](../en/partner-deployment-patterns.md) | [한국어](../ko/partner-deployment-patterns.md) | [简体中文](../zh-CN/partner-deployment-patterns.md) | **繁體中文** | [Français](../fr/partner-deployment-patterns.md) | [Deutsch](../de/partner-deployment-patterns.md) | [Español](../es/partner-deployment-patterns.md)

**建立日期**: 2026-05-21  
**狀態**: 草案  
**目標讀者**: 合作夥伴公司、SaaS 供應商、多租戶架構師

---

## 概述

本文件整理合作夥伴公司將 Permission-aware RAG 系統部署至多個客戶時的架構模式。提供每客戶資料隔離、認證隔離和成本隔離的設計指南。

---

## 目標客戶與產業

| 產業 | 使用案例 | 權限需求 |
|------|----------|----------|
| 製造業 | 依部門搜尋設計圖面和技術文件 | 部門 × 專案 × 機密等級 |
| 金融業 | 依權限搜尋法規文件和內部報告 | 部門 × 角色 × 客戶資訊隔離 |
| 公部門 | 依局處搜尋政策文件和內部資料 | 局處 × 職位 × 公開/非公開 |
| 醫療業 | 依科別搜尋作業手冊和研究資料 | 科別 × 職種 × 病患資訊隔離 |
| 法律業 | 依案件搜尋合約和判例 | 案件 × 承辦人 × 客戶隔離 |
| 教育業 | 依學院搜尋教材和研究資源 | 學院 × 教職員/學生 × 實驗室 |

---

## 部署模式比較

### 模式 A：每客戶 AWS 帳戶隔離（建議：企業級）

```
┌─────────────────────────────────────────────────────────┐
│ 合作夥伴管理帳戶                                          │
│ ┌─────────────────┐  ┌─────────────────┐               │
│ │ CDK Pipelines   │  │ StackSets       │               │
│ │ / CodePipeline  │  │ (範本分發)       │               │
│ └────────┬────────┘  └────────┬────────┘               │
└──────────┼────────────────────┼─────────────────────────┘
           │                    │
    ┌──────┴──────┐      ┌─────┴──────┐      ┌──────────────┐
    │ 客戶 A      │      │ 客戶 B      │      │ 客戶 C       │
    │ 帳戶        │      │ 帳戶        │      │ 帳戶         │
    │             │      │             │      │              │
    │ ・FSx for ONTAP │      │ ・FSx for ONTAP │      │ ・FSx for ONTAP  │
    │ ・Bedrock KB│      │ ・Bedrock KB│      │ ・Bedrock KB │
    │ ・Cognito   │      │ ・Cognito   │      │ ・Cognito    │
    │ ・DynamoDB  │      │ ・DynamoDB  │      │ ・DynamoDB   │
    │ ・CloudFront│      │ ・CloudFront│      │ ・CloudFront │
    └─────────────┘      └─────────────┘      └──────────────┘
```

**優點**：
- 完全資料隔離（AWS 帳戶邊界）
- 每客戶帳單分離
- 安全事件影響範圍有限
- 每客戶獨立維運和擴展

**缺點**：
- 帳戶管理維運負擔
- 共用元件的重複成本
- 部署管線複雜度

**適用情境**：
- 客戶擁有自己的 AWS 帳戶
- 存在嚴格的資料隔離需求（金融、醫療、公部門）
- 客戶數量在 10 家以下

### 模式 B：1 個帳戶內的 SVM / Volume / Prefix 隔離

```
┌─────────────────────────────────────────────────────────────────┐
│ 共用 AWS 帳戶                                                     │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ FSx for ONTAP File System                                  │    │
│  │                                                            │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │    │
│  │  │ SVM-A    │  │ SVM-B    │  │ SVM-C    │               │    │
│  │  │(客戶     │  │(客戶     │  │(客戶     │               │    │
│  │  │ A)       │  │ B)       │  │ C)       │               │    │
│  │  │ Vol-A1   │  │ Vol-B1   │  │ Vol-C1   │               │    │
│  │  │ Vol-A2   │  │ Vol-B2   │  │ Vol-C2   │               │    │
│  │  └──────────┘  └──────────┘  └──────────┘               │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ KB-A     │  │ KB-B     │  │ KB-C     │  ← 每租戶 KB         │
│  │ S3 AP-A  │  │ S3 AP-B  │  │ S3 AP-C  │  ← 每租戶 AP         │
│  └──────────┘  └──────────┘  └──────────┘                      │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ 共用資源                                                    │    │
│  │ ・CloudFront + WAF（共用，基於路徑路由）                    │    │
│  │ ・Cognito User Pool（依租戶屬性隔離）                       │    │
│  │ ・DynamoDB（租戶 ID 分區鍵）                                │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**優點**：
- 統一維運（單一帳戶管理）
- 共用元件的共享成本
- 簡化部署

**缺點**：
- 應用程式層級的資料隔離（設定錯誤風險）
- 需要帳單分攤
- 潛在的嘈雜鄰居問題

**適用情境**：
- 客戶數量多（10 家以上）
- 優先考慮成本效率
- 資料隔離需求相對寬鬆

### 模式 C：混合型（共用管理平面 + 隔離資料平面）

```
┌─────────────────────────────────────────────────────────┐
│ 合作夥伴管理帳戶                                          │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ 管理平面（共用）                                      │  │
│ │ ・CDK Pipelines / 部署自動化                         │  │
│ │ ・租戶管理 API                                       │  │
│ │ ・監控儀表板（彙總）                                  │  │
│ │ ・帳務管理                                           │  │
│ └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
           │
    ┌──────┴──────────────────────────────────────┐
    │ 資料平面（每客戶隔離）                         │
    │                                              │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
    │  │客戶 A    │  │客戶 B    │  │客戶 C    │  │
    │  │ VPC      │  │ VPC      │  │ VPC      │  │
    │  │ FSx+KB   │  │ FSx+KB   │  │ FSx+KB   │  │
    │  └──────────┘  └──────────┘  └──────────┘  │
    └─────────────────────────────────────────────┘
```

---

## 租戶隔離設計要素

### 1. 儲存隔離

| 隔離等級 | 方法 | 資料隔離強度 | 成本 |
|----------|------|-------------|------|
| 檔案系統隔離 | 每客戶 FSx 檔案系統 | 最高 | 高 |
| SVM 隔離 | 1 個檔案系統內的 SVM 隔離 | 高 | 中 |
| Volume 隔離 | 1 個 SVM 內的 Volume 隔離 | 中 | 低 |
| Prefix 隔離 | 1 個 Volume 內的目錄隔離 | 低 | 最低 |

**建議**：SVM 隔離（模式 B）或檔案系統隔離（模式 A）

### 2. 向量儲存隔離

| 方法 | S3 Vectors | OpenSearch Serverless |
|------|-----------|---------------------|
| 每租戶 KB | 獨立 KB + Index | 獨立 KB + Collection |
| 共用 KB + 中繼資料過濾 | 依 `tenant_id` 中繼資料過濾 | 依 `tenant_id` 欄位過濾 |

**建議**：每租戶 KB（明確的安全邊界）

### 3. 認證隔離

| 方法 | 說明 | 適用模式 |
|------|------|----------|
| Cognito User Pool 隔離 | 每租戶 User Pool | 模式 A |
| Cognito 群組隔離 | 共用 User Pool + 租戶群組 | 模式 B |
| 自訂屬性隔離 | `custom:tenant_id` 屬性 | 模式 B |
| 外部 IdP 隔離 | 每租戶 OIDC/SAML IdP | 模式 A/C |

### 4. 日誌與稽核隔離

| 資源 | 隔離方法 |
|------|----------|
| CloudWatch Logs | 每租戶日誌群組或前綴 |
| CloudTrail | 每租戶 Trail（模式 A）或共用 Trail + 過濾 |
| DynamoDB 稽核表 | `tenantId` 分區鍵 |
| S3 日誌 bucket | 每租戶前綴 + bucket 政策 |

### 5. KMS 加密隔離

| 方法 | 說明 | 成本 |
|------|------|------|
| 每租戶 CMK | 完全加密隔離 | CMK × 租戶數量 |
| 共用 CMK + 金鑰政策 | 成本效率優先 | 1 CMK |
| 租戶管理 CMK（BYOK） | 客戶管理金鑰 | 客戶承擔成本 |

---

## 使用 CDK 自動化部署

### StackSets 模式（適用模式 A）

```typescript
// 從合作夥伴管理帳戶部署至客戶帳戶
const stackSet = new CfnStackSet(this, 'TenantStackSet', {
  stackSetName: 'permission-aware-rag-tenant',
  templateBody: tenantTemplate,
  parameters: [
    { parameterKey: 'TenantId', parameterValue: tenantId },
    { parameterKey: 'TenantDomain', parameterValue: tenantDomain },
  ],
  permissionModel: 'SERVICE_MANAGED',
  autoDeployment: { enabled: true, retainStacksOnAccountRemoval: false },
});
```

### CDK Pipelines 模式（適用模式 C）

```typescript
// 為每個租戶新增階段
for (const tenant of tenants) {
  pipeline.addStage(new TenantStage(this, `Tenant-${tenant.id}`, {
    env: { account: tenant.accountId, region: tenant.region },
    tenantConfig: tenant,
  }));
}
```

---

## 提案範本

### 導入前後比較

| 面向 | 導入前（現狀） | 導入後（使用本系統） |
|------|---------------|---------------------|
| 檔案搜尋 | 手動瀏覽共用資料夾，搜尋精確度低 | AI 在權限範圍內呈現最佳文件 |
| 權限管理 | AI 使用時權限邊界消失的風險 | 現有 NTFS ACL 直接反映於 AI |
| 知識活用 | 部門間知識孤島，依賴個人 | 尊重權限的跨組織知識搜尋 |
| 維運負擔 | AI 需要資料複製和權限重新設定 | 將 FSx 上的資料直接連接至 AI |

### PoC 成功標準

| 指標 | 目標值 | 測量方法 |
|------|--------|----------|
| 回答準確度 | 80%+（人工評估） | 使用 50 題評估集判定 |
| 權限控制 | 0 違規 | 透過權限矩陣測試驗證 |
| 回應時間 | P95 < 10 秒 | CloudWatch 指標 |
| 維運工作量 | 比現狀減少 50% | 管理員訪談 |

### 生產環境的額外考量

| 類別 | 考量事項 |
|------|----------|
| ID 聯合 | 與現有 AD / IdP 的 SSO 整合、MFA 需求 |
| 稽核 | 搜尋日誌保留、存取軌跡、定期審查 |
| 資料分類 | 機密等級定義、AI 使用適格標準 |
| 成本管理 | 每月預算、擴展計畫、成本分攤 |
| SLA | 可用性目標、RPO/RTO、支援體制 |
| 法務 | 服務條款、資料處理協議、責任邊界 |

---

## 成本預估範本

### 每月預估（小規模 PoC）

| 資源 | 設定 | 每月預估 |
|------|------|----------|
| FSx for ONTAP | 128 MB/s、1 TiB SSD、Single-AZ | $300 |
| S3 Vectors | 約 10,000 向量 | $5 |
| Bedrock（Titan Embed） | 初始 + 增量同步 | $10 |
| Bedrock（Claude） | 1,000 查詢/月 | $50 |
| Lambda | WebApp + 同步 | $20 |
| CloudFront + WAF | 基本費用 | $15 |
| DynamoDB | On-demand | $5 |
| Cognito | 約 50 使用者 | $0（免費方案） |
| **合計** | | **約 $400/月** |

### 每月預估（生產環境：中規模）

| 資源 | 設定 | 每月預估 |
|------|------|----------|
| FSx for ONTAP | 512 MB/s、5 TiB SSD、Multi-AZ | $3,000 |
| OpenSearch Serverless | 4 OCU | $1,400 |
| Bedrock（Titan Embed） | 定期同步 | $50 |
| Bedrock（Claude Sonnet） | 10,000 查詢/月 | $500 |
| Lambda | WebApp + 同步 + 監控 | $100 |
| CloudFront + WAF | 生產流量 | $100 |
| DynamoDB | Provisioned | $50 |
| Cognito | 約 500 使用者 | $25 |
| CloudWatch | 日誌 + 指標 + 警報 | $50 |
| **合計** | | **約 $5,300/月** |

---

## 相關文件

| 文件 | 說明 |
|------|------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | 生產就緒檢查清單 |
| [governance-and-audit.md](governance-and-audit.md) | 治理與稽核設計 |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP 容量規劃與效能 |
