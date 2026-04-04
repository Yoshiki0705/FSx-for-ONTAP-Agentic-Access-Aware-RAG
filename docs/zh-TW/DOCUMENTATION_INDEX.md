# 文件索引

**🌐 Language:** [日本語](../DOCUMENTATION_INDEX.md) | [English](../en/DOCUMENTATION_INDEX.md) | [한국어](../ko/DOCUMENTATION_INDEX.md) | [简体中文](../zh-CN/DOCUMENTATION_INDEX.md) | **繁體中文** | [Français](../fr/DOCUMENTATION_INDEX.md) | [Deutsch](../de/DOCUMENTATION_INDEX.md) | [Español](../es/DOCUMENTATION_INDEX.md)

## 必讀文件

| 文件 | 說明 |
|------|------|
| [README.md](../../README.zh-TW.md) | 系統概述、架構、部署步驟、WAF/Geo 設定 |
| [implementation-overview.md](implementation-overview.md) | 詳細實作（14個面向：圖像分析 RAG、KB 連線 UI、Smart Routing、監控與告警） |
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
| [demo-scenario.md](../../demo-data/guides/demo-scenario.md) | 驗證情境（管理員與一般使用者權限差異、AD SSO 登入） |
| [ontap-setup-guide.md](../../demo-data/guides/ontap-setup-guide.md) | FSx ONTAP + AD 整合、CIFS 共用、NTFS ACL 設定（已驗證程序） |
| [demo-environment-guide.md](demo-environment-guide.md) | 驗證環境資源 ID、存取資訊、Embedding 伺服器程序 |

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

| `demo-data/scripts/setup-openldap.sh` | OpenLDAP server setup (EC2 in VPC, test users/groups) |
| `demo-data/scripts/setup-ontap-namemapping.sh` | ONTAP REST API name-mapping rule setup |
| `demo-data/scripts/verify-ldap-integration.sh` | LDAP integration verification |
| `demo-data/scripts/verify-ontap-namemapping.sh` | ONTAP name-mapping verification |
| `demo-data/scripts/setup-mode-c-oidc-ldap.sh` | Mode C (OIDC+LDAP) one-shot setup |
## 建議閱讀順序

1. **README.md** — 系統概述和部署步驟
2. **implementation-overview.md** — 8個面向的詳細實作
3. **SID-Filtering-Architecture.md** — 核心功能技術詳情
4. **demo-recording-guide.md** — 示範影片錄製指南
5. **ontap-setup-guide.md** — FSx ONTAP AD 整合、CIFS 共用設定
6. **README.md - AD SAML Federation** — AD SAML federation 設定（選用）
7. **demo-environment-guide.md** — 驗證環境設定（包含 Embedding 伺服器）
8. **demo-scenario.md** — 執行驗證情境（AD SSO 登入）
9. **verification-report.md** — API 層級驗證程序
