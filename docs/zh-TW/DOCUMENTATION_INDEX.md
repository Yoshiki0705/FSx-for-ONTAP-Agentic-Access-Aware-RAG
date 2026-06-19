# 文件索引

**🌐 Language:** [日本語](../DOCUMENTATION_INDEX.md) | [English](../en/DOCUMENTATION_INDEX.md) | [한국어](../ko/DOCUMENTATION_INDEX.md) | [简体中文](../zh-CN/DOCUMENTATION_INDEX.md) | **繁體中文** | [Français](../fr/DOCUMENTATION_INDEX.md) | [Deutsch](../de/DOCUMENTATION_INDEX.md) | [Español](../es/DOCUMENTATION_INDEX.md)

## 必讀文件

| 文件 | 說明 |
|------|------|
| [README.md](../../README.zh-TW.md) | 系統概述、架構、部署步驟、WAF/Geo 設定 |
| [auth-and-user-management.md](auth-and-user-management.md) | 認證與使用者管理指南（認證模式選擇、AD Federation、自動 SID 註冊、疑難排解） |
| [implementation-overview.md](implementation-overview.md) | 詳細實作（22個面向：圖像分析 RAG、KB 連線 UI、Smart Routing、監控與告警、OIDC/LDAP Federation） |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | 基於 SID 的權限過濾詳細設計 |
| [verification-report.md](verification-report.md) | 部署後驗證程序和測試案例 |
| [ui-specification.md](ui-specification.md) | Chatbot UI 規格（KB/Agent 模式、Agent Directory、企業級 Agent 功能、側邊欄設計） |
| [demo-recording-guide.md](demo-recording-guide.md) | 示範影片錄製指南（6項證據） |
| [embedding-server-design.md](embedding-server-design.md) | Embedding 伺服器設計與實作文件 |
| [stack-architecture-comparison.md](stack-architecture-comparison.md) | CDK 堆疊架構指南（向量儲存比較、實作洞察） |
| [README - AD SAML Federation](../../README.zh-TW.md#ad-saml-federation-optional) | AD SAML federation 設定（Managed AD / Self-managed AD） |

## 設定與驗證

| 文件 | 說明 |
|------|------|
| [auth-mode-setup-guide.md](../../demo-data/guides/auth-mode-setup-guide.md) | 認證模式示範環境建置指南（5種模式，附帶範例設定檔） |
| [demo-scenario.md](../../demo-data/guides/demo-scenario.md) | 驗證情境（管理員與一般使用者權限差異、AD SSO 登入、OIDC/LDAP 登入） |
| [ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) | FSx for ONTAP + AD 整合、CIFS 共用、NTFS ACL 設定、Name-Mapping 設定（已驗證程序） |
| [demo-environment-guide.md](demo-environment-guide.md) | 驗證環境資源 ID、存取資訊、Embedding 伺服器程序 |

## 企業設計與維運指南

| 文件 | 說明 |
|------|------|
| [production-readiness-checklist.md](production-readiness-checklist.md) | 正式環境準備檢查清單（Demo → PoC → Production 成熟度等級定義、安全/稽核/DR/維運確認項目、含核准人欄） |
| [poc-success-criteria-template.md](poc-success-criteria-template.md) | PoC 成功標準範本（利害關係人定義、Go/No-Go 判定標準、下一階段條件、完成報告範本） |
| [data-readiness-assessment.md](data-readiness-assessment.md) | 資料就緒度評估範本（資料位置·分類·權限結構·品質·合規確認、核准流程） |
| [partner-faq.md](partner-faq.md) | 合作夥伴 FAQ（客戶提案時的12個問答、提案資源清單） |
| [permission-consistency.md](permission-consistency.md) | 權限變更一致性模型（ACL 變更 → 中繼資料再生成 → KB 重新同步 → 快取失效流程、最大延遲、緊急權限撤銷程序） |
| [fsxn-sizing-and-performance.md](fsxn-sizing-and-performance.md) | FSx for ONTAP 效能與容量設計指南（依規模配置、S3 AP 考量、QoS、向量儲存選型） |
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | 多租戶與合作夥伴部署模式（帳戶隔離/SVM 隔離/混合、成本估算範本） |
| [governance-and-audit.md](governance-and-audit.md) | 治理與稽核設計（稽核日誌結構、Responsible AI、Guardrails 政策、產業特定使用案例） |
| [evaluation.md](evaluation.md) | RAG / Agent 評估指標（4軸評估：業務 KPI、RAG 品質、權限控制、Agent 效能；PoC 評估範本） |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | 安全實驗指南（範圍定義、禁止事項、真實資料匯入檢查清單、回復程序） |
| [threat-model.md](threat-model.md) | 威脅模型（10個威脅類別、攻擊路徑、現有緩解措施、額外建議、威脅→對策對應表） |
| [cloudwatch-dashboard-guide.md](cloudwatch-dashboard-guide.md) | CloudWatch 儀表板維運指南（指標清單、告警定義、疑難排解模式） |
| [poc-workshop-guide.md](poc-workshop-guide.md) | PoC 工作坊指南（90分鐘：部署 → 測試 → 評估 → 清理） |
| [cost-estimation-worksheet.md](cost-estimation-worksheet.md) | 成本估算工作表（依配置月度概算範本、計算公式、最佳化要點） |
| [architecture-decision-records.md](architecture-decision-records.md) | Architecture Decision Records（6個主要決策：向量儲存、權限過濾、認證、前端、同步、路由） |
| [managed-kb-migration-evaluation.md](managed-kb-migration-evaluation.md) | Amazon Bedrock Managed Knowledge Base 遷移路徑評估（與現有 KB + OpenSearch Serverless / S3 Vectors 的比較、對 Permission-aware RAG 的影響、ACL 中繼資料過濾驗證要點、分階段遷移）※AWS Summit NY 2026 |
| [managed-kb-upgrade-path.md](managed-kb-upgrade-path.md) | Managed KB 升級路徑（S3 AP 資料來源連接驗證步驟 V1–V4、Permission-aware 設計課題、使用 FlexClone 的安全驗證模式、按用途選擇指南）※並行選項·驗證步驟 |
| [investigations/agentcore-web-search-integration.md](investigations/agentcore-web-search-integration.md) | 將 AgentCore Web Search Tool 整合為 Permission-aware RAG 混合搜尋選項的設計調查（UI 切換、us-east-1 跨區域 Gateway、Lambda Layer/inline、查詢安全性·引用分離·提示注入防禦、實作順序）※AWS Summit NY 2026 |
| [monitoring/athena-audit-tables.sql](../../monitoring/athena-audit-tables.sql) | Athena 表定義（稽核日誌分析用 DDL + 範例查詢） |
| [benchmark-scenarios.md](benchmark-scenarios.md) | 基準測試情境（10K/100K/1M 檔案、5個計測情境、理論基線估算值） |
| [demo-data/industry-packs/](../../demo-data/industry-packs/) | 產業示範資料包（8個產業 × 5個文件：行政·醫療·法務·製造·建設·教育·保險 + 通用） |
| [s3ap-serverless-patterns-integration.md](s3ap-serverless-patterns-integration.md) | S3AP Serverless Patterns 連動架構（與 17 UC 的 3 模式連動） |
| [benchmarks/](../../benchmarks/) | 基準測試框架（測試資料生成、執行腳本、結果範本） |
| [tests/permission-matrix/](../../tests/permission-matrix/) | 權限矩陣測試（31個 ACL 邊緣情境：Fail-Closed、群組巢狀、繼承權限、緊急撤銷） |

## FSx for ONTAP 維運自動化

| 文件 | 說明 |
|------|------|
| [automation/fsxn-ops/README.md](../../automation/fsxn-ops/README.md) | 維運自動化套件概述（目錄結構、使用案例） |
| [automation/fsxn-ops/docs/why-this-makes-fsxn-easier.md](../../automation/fsxn-ops/docs/why-this-makes-fsxn-easier.md) | 此架構如何簡化 FSx for ONTAP 維運（設計決策、成本估算、安全設計） |
| [automation/fsxn-ops/docs/aws-verification-report.md](../../automation/fsxn-ops/docs/aws-verification-report.md) | AWS 整合驗證報告（2026-05-01，所有階段通過） |
| [automation/fsxn-ops/cfn/fsxn-ops-stack.yaml](../../automation/fsxn-ops/cfn/fsxn-ops-stack.yaml) | 整合 CloudFormation 範本（含 VPC 端點） |

## Transfer Family 擷取

| 文件 | 說明 |
|------|------|
| [transfer-family-e2e-verification.md](transfer-family-e2e-verification.md) | E2E 驗證報告（SFTP 連線 → 上傳 → KB 擷取完成、全步驟 PASS） |
| [transfer-family-partner-onboarding.md](transfer-family-partner-onboarding.md) | 合作夥伴上線指南（SSH 金鑰設定、SFTP 連線、檔案命名規則、疑難排解） |
| [transfer-family-networking-prerequisites.md](transfer-family-networking-prerequisites.md) | 網路前提條件（VPC 端點、IP 允許清單、安全群組） |
| [v4.2-demo-verification-supplement.md](v4.2-demo-verification-supplement.md) | v4.2 示範驗證補充指南（全使用案例測試程序、預期結果、日誌取得方法） |

## 範例設定檔

| 檔案 | 認證模式 | 說明 |
|------|----------|------|
| `demo-data/configs/mode-a-email-password.json` | 電子郵件/密碼 | 最小設定，手動 SID 註冊 |
| `demo-data/configs/mode-b-saml-ad-federation.json` | SAML AD Federation | Managed AD + IAM Identity Center |
| `demo-data/configs/mode-c-oidc-ldap.json` | OIDC + LDAP | Auth0/Keycloak + OpenLDAP + ONTAP name-mapping |
| `demo-data/configs/mode-d-oidc-claims-only.json` | OIDC Claims Only | Okta/Auth0（無 LDAP） |
| `demo-data/configs/mode-e-saml-oidc-hybrid.json` | SAML + OIDC | AD Federation + OIDC IdP 同時啟用 |

## Embedding 伺服器（透過 FlexCache CIFS 掛載）

| 文件 / 檔案 | 說明 |
|-------------|------|
| [demo-environment-guide.md#6](demo-environment-guide.md) | Embedding 伺服器部署與營運程序 |
| `docker/embed/src/index.ts` | Embedding 應用程式（文件掃描 → 分塊 → 向量化 → 索引） |
| `docker/embed/src/oss-client.ts` | OpenSearch Serverless SigV4 簽章用戶端（IMDS 驗證支援） |
| `docker/embed/Dockerfile` | Embedding 容器定義（node:22-slim、cifs-utils） |
| `docker/embed/buildspec.yml` | CodeBuild 建置定義 |
| `lib/stacks/demo/demo-embedding-stack.ts` | EmbeddingStack CDK 定義（EC2 + ECR + IAM） |

## 設定腳本

| 腳本 | 說明 |
|------|------|
| `demo-data/scripts/create-demo-users.sh` | 建立 Cognito 測試使用者 |
| `demo-data/scripts/setup-user-access.sh` | 在 DynamoDB 中註冊 SID 資料 |
| `demo-data/scripts/upload-demo-data.sh` | 上傳測試文件至 S3 |
| `demo-data/scripts/sync-kb-datasource.sh` | 同步 Bedrock KB 資料來源 |
| `demo-data/scripts/setup-openldap.sh` | OpenLDAP 伺服器設定（VPC 內 EC2，測試使用者/群組） |
| `demo-data/scripts/setup-ontap-namemapping.sh` | ONTAP REST API name-mapping 規則設定 |
| `demo-data/scripts/verify-ldap-integration.sh` | LDAP 整合驗證（Lambda → LDAP → DynamoDB） |
| `demo-data/scripts/verify-ontap-namemapping.sh` | ONTAP name-mapping 驗證（REST API 連線與規則取得） |
| `demo-data/scripts/setup-mode-c-oidc-ldap.sh` | 模式 C（OIDC+LDAP）一鍵設定（全階段自動執行） |

## 建議閱讀順序

### 第一階段：初始設定

1. **README.md** — 系統概述和部署步驟
2. **auth-and-user-management.md** — 認證模式選擇與使用者管理
3. **implementation-overview.md** — 22個面向的詳細實作
4. **SID-Filtering-Architecture.md** — 核心功能技術詳情
5. **safe-experimentation-guide.md** — 安全實驗指南（PoC 開始前必讀）

### 第二階段：驗證與評估

6. **demo-recording-guide.md** — 示範影片錄製指南
7. **ontap-setup-guide.md** — FSx for ONTAP AD 整合、CIFS 共用設定
8. **demo-environment-guide.md** — 驗證環境設定
9. **demo-scenario.md** — 執行驗證情境
10. **evaluation.md** — PoC 評估範本

### 第三階段：正式環境與企業設計

11. **production-readiness-checklist.md** — 正式環境準備檢查清單
12. **permission-consistency.md** — 權限變更一致性模型
13. **fsxn-sizing-and-performance.md** — FSx for ONTAP 效能與容量設計
14. **governance-and-audit.md** — 治理與稽核設計
15. **partner-deployment-patterns.md** — 多租戶部署模式
