# Agentic Access-Aware RAG with Amazon FSx for NetApp ONTAP

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

**🌐 Language / 言語:** [日本語](README.md) | [English](README.en.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | **繁體中文** | [Français](README.fr.md) | [Deutsch](README.de.md) | [Español](README.es.md)

> 針對儲存在 FSx for ONTAP 上的企業資料，提供在查詢時自動套用 NTFS ACL / UNIX 權限的 Permission-aware RAG + Agentic AI 參考實作。AWS CDK 單一命令部署，支援從 PoC 到正式環境評估。

---

## 快速開始

| 我想要... | 指南 | 所需時間 |
|----------|------|---------|
| 快速體驗 | [PoC 工作坊指南](docs/zh-TW/poc-workshop-guide.md) | 90 分鐘 |
| 部署到我的帳戶 | [部署指南](docs/deployment-guide.md) | 30-40 分鐘 |
| 使用真實資料驗證 | [安全實驗指南](docs/zh-TW/safe-experimentation-guide.md) | 2-4 週 |
| 評估準確度與成本 | [RAG/Agent 評估框架](docs/zh-TW/evaluation.md) | 1 週 |
| 評估正式環境就緒度 | [正式環境就緒檢查清單](docs/zh-TW/production-readiness-checklist.md) | — |
| 估算成本 | [成本估算工作表](docs/zh-TW/cost-estimation-worksheet.md) | — |

<details><summary>📂 全部功能與設計指南</summary>

| 類別 | 指南 | 內容 |
|------|------|------|
| 架構 | [實作概覽（22 個面向）](docs/zh-TW/implementation-overview.md) | 全元件技術詳情 |
| 架構 | [Architecture Decision Records](docs/zh-TW/architecture-decision-records.md) | 6 項關鍵設計決策依據 |
| 權限 | [SID 過濾架構](docs/zh-TW/SID-Filtering-Architecture.md) | 權限比對機制 |
| 認證 | [認證與使用者管理](docs/zh-TW/auth-and-user-management.md) | OIDC / SAML / LDAP 整合 |
| 安全 | [威脅模型](docs/zh-TW/threat-model.md) | 10 個威脅類別、攻擊路徑、緩解措施 |
| 安全 | [治理與稽核設計](docs/zh-TW/governance-and-audit.md) | 稽核日誌、Responsible AI、Guardrails |
| 示範 | [產業示範資料（7 個產業）](demo-data/industry-packs/) | 政務・醫療・法務・製造・營建・教育・保險 |
| 全部文件 | [文件索引](docs/zh-TW/DOCUMENTATION_INDEX.md) | 含建議閱讀順序的完整清單 |

</details>

---

## 架構

```
Browser → WAF → CloudFront (OAC) → Lambda Web Adapter (Next.js 15)
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
     Cognito User Pool          Bedrock KB + S3 Vectors      DynamoDB
     (認證: OIDC/SAML/Email)    (RAG 搜尋 + Embedding)       (SID/權限資料)
                                         │
                                         ▼
                                FSx for ONTAP (SVM + Volume)
                                + S3 Access Point
```

**處理流程**: 使用者認證 → 從 DynamoDB 取得 SID → Bedrock KB 向量搜尋 → SID 比對過濾 → 僅使用授權文件產生回答

主要特性:
- **Permission-aware RAG** — 在搜尋時自動套用 NTFS ACL / UNIX 權限（Fail-Closed）
- **Agentic AI** — KB 模式（文件搜尋）與 Agent 模式（多步驟推理）一鍵切換
- **Smart Routing** — 依查詢複雜度自動選擇 Haiku / Sonnet / Opus（成本降低 40-60%）
- **低成本** — 預設使用 S3 Vectors（每月數美元）
- **22 項整合功能** — 語音聊天、Guardrails、Graph RAG、Web Search 等（[詳情](docs/zh-TW/implementation-overview.md)）

<details><summary>⚠️ 前提條件與限制</summary>

| 項目 | 內容 |
|------|------|
| 前提環境 | Node.js 22+、Docker、已設定 AWS CLI、AdministratorAccess 等效權限 |
| 部署區域 | ap-northeast-1（可更改）+ us-east-1（WAF/Web Search 用，固定） |
| ONTAP 版本 | 9.17.1 以上（S3 Access Points 需求） |
| S3 AP 主要限制 | 不支援條件寫入、不支援 Event Notifications、ListObjectsV2 高延遲 |
| 向量儲存 | S3 Vectors（預設，filterable 2KB 限制）/ OpenSearch Serverless（高效能） |
| Responsible AI | AI 輸出為輔助訊號，最終決策由人負責。[詳情](docs/zh-TW/governance-and-audit.md) |

完整 S3 AP 相容性矩陣請參見 [fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations/blob/main/docs/en/compatibility-matrix.md)。

</details>

<details><summary>📚 相關儲存庫</summary>

| 儲存庫 | 用途 | 概述 |
|--------|------|------|
| **[本儲存庫]** | AI / RAG | 權限過濾 RAG + Agentic AI |
| [FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns](https://github.com/Yoshiki0705/FSx-for-ONTAP-S3AccessPoints-Serverless-Patterns) | Serverless 自動化 | 17 個產業無伺服器模式 |
| [fsxn-lakehouse-integrations](https://github.com/Yoshiki0705/fsxn-lakehouse-integrations) | Analytics | Athena / Glue / EMR / SageMaker 整合 |
| [fsxn-observability-integrations](https://github.com/Yoshiki0705/fsxn-observability-integrations) | Observability | 無需 EC2 即可將稽核日誌傳送至 Datadog / Splunk / Grafana |

</details>

<details><summary>🔧 開發者</summary>

```bash
npx tsc --noEmit
npx cdk synth --quiet
npx jest --no-coverage
cd docker/nextjs && npx vitest run
```

專案結構與程式碼規範請參見 [CONTRIBUTING.md](CONTRIBUTING.md)，變更日誌請參見 [CHANGELOG.md](CHANGELOG.md)。

</details>

---

## License

[Apache License 2.0](LICENSE)

---

🌐 [日本語](README.md) | [English](README.en.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Español](README.es.md)
