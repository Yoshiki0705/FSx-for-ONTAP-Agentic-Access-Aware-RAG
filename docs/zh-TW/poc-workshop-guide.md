# PoC 工作坊指南（90 分鐘）

**🌐 Language:** [日本語](../poc-workshop-guide.md) | [English](../en/poc-workshop-guide.md) | [한국어](../ko/poc-workshop-guide.md) | [简体中文](../zh-CN/poc-workshop-guide.md) | **繁體中文** | [Français](../fr/poc-workshop-guide.md) | [Deutsch](../de/poc-workshop-guide.md) | [Español](../es/poc-workshop-guide.md)

**建立日期**: 2026-05-21  
**狀態**: 草案  
**目標對象**: 解決方案架構師、合作夥伴工程師、客戶雲端團隊

---

## 概述

本工作坊將在 90 分鐘內部署 Permission-aware Agentic RAG 系統，並體驗權限感知搜尋的運作方式。

---

## 前提條件

| 項目 | 需求 |
|------|------|
| AWS 帳戶 | 具備 AdministratorAccess 等級的權限 |
| AWS CLI | v2 已設定完成（`aws sts get-caller-identity` 可成功執行） |
| Node.js | 22 以上 |
| Docker | 已啟動（`docker info` 可成功執行） |
| CDK Bootstrap | 若未執行，將在工作坊中進行 |
| Bedrock 模型存取 | Claude Haiku / Sonnet、Titan Embed v2 已啟用 |

---

## 議程

| 時間 | 章節 | 內容 |
|------|------|------|
| 0:00–0:10 | 0. 簡介 | 架構概述、使用案例說明 |
| 0:10–0:40 | 1. 環境部署 | 複製、相依套件、Bootstrap、部署 |
| 0:40–0:55 | 2. 示範資料匯入 | 使用者建立、測試文件配置 |
| 0:55–1:15 | 3. 權限感知 RAG 測試 | 不同使用者的搜尋、結果比較 |
| 1:15–1:25 | 4. 企業指南確認 | 正式環境化檢查清單、評估範本 |
| 1:25–1:30 | 5. 清理 | 資源刪除、費用確認 |

---

## 0. 簡介（10 分鐘）

### 本系統解決的課題

```
傳統 RAG:
  企業檔案 → 將所有文件交給 AI → 任何人都能存取所有資訊
  → 權限邊界消失 → 機密洩露風險

Permission-aware RAG:
  企業檔案 → 維持既有 ACL → 每位使用者可見的文件不同
  → 在維護權限的同時活用 AI → 兼顧安全性與便利性
```

### 架構（白板用）

```
使用者 → CloudFront → Lambda (Next.js)
                              ↓
                    Bedrock KB Retrieve API
                              ↓
                    SID 過濾（應用端）
                              ↓
                    僅以授權文件產生回答
```

---

## 1. 環境部署（30 分鐘）

### Step 1.1: 複製儲存庫

```bash
git clone https://github.com/Yoshiki0705/FSx-for-ONTAP-Agentic-Access-Aware-RAG.git
cd FSx-for-ONTAP-Agentic-Access-Aware-RAG
npm install
```

### Step 1.2: CDK Bootstrap

```bash
# 主要區域
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1

# WAF 用（CloudFront 必須使用 us-east-1）
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
```

### Step 1.3: 建立設定檔

```bash
cat > cdk.context.json << 'EOF'
{
  "projectName": "ws-rag",
  "environment": "workshop",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"]
}
EOF
```

> **注意**: 請根據參加者所在國家調整 `allowedCountries`。

### Step 1.4: Docker 映像準備 & 部署

```bash
# Docker 映像建置
bash demo-data/scripts/pre-deploy-setup.sh

# 部署（約 30 分鐘）
npx cdk deploy --all --require-approval never
```

> 部署期間可進行下一章節的說明，有效利用時間。

---

## 2. 示範資料匯入（15 分鐘）

### Step 2.1: 建立測試使用者 & 資料

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

此腳本將執行以下操作:
- 建立 Cognito 測試使用者（admin@example.com, user@example.com）
- 在 DynamoDB 註冊 SID 資料
- 上傳測試文件 + `.metadata.json` 至 S3
- 同步 Bedrock KB 資料來源

### Step 2.2: 取得存取 URL

```bash
aws cloudformation describe-stacks \
  --stack-name ws-rag-workshop-WebApp \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text
```

---

## 3. 權限感知 RAG 測試（20 分鐘）

### 測試 1: 以管理員使用者登入

1. 存取 CloudFront URL
2. 以 `admin@example.com` / 密碼（確認 post-deploy-setup.sh 的輸出）登入
3. 提問「請告訴我公司的營收」
4. **預期結果**: 包含 150 億日圓營收資訊的回答（參照機密文件）

### 測試 2: 以一般使用者登入

1. 登出
2. 以 `user@example.com` 登入
3. 提出相同問題「請告訴我公司的營收」
4. **預期結果**: 無營收資訊（僅參照公開文件）

### 測試 3: Agent 模式

1. 透過標題列的模式切換切換至「Agent」
2. 提問「請摘要產品目錄的內容」
3. **預期結果**: Agent 使用 KB 搜尋工具，在權限範圍內回答

### 確認要點

- [ ] 相同問題返回不同回答
- [ ] Citation 顯示存取層級徽章
- [ ] 一般使用者不會顯示機密文件的 Citation

---

## 4. 企業指南確認（10 分鐘）

向參加者介紹以下文件:

| 文件 | 確認要點 |
|------|---------|
| [正式環境化檢查清單](../production-readiness-checklist.md) | Demo/PoC/Production 的成熟度等級 |
| [評估範本](../evaluation.md) | PoC 評估報告的單頁摘要 |
| [安全實驗指南](../safe-experimentation-guide.md) | 匯入實際資料前的檢查清單 |
| [威脅模型](threat-model.md) | 10 個威脅類別與對策對應 |

---

## 5. 清理（5 分鐘）

```bash
# 刪除所有資源
npx cdk destroy --all --force
```

> **注意**: FSx for ONTAP 的刪除需要 10～15 分鐘。命令完成後仍請在 AWS 主控台確認刪除狀態。

### 費用確認

```bash
# 確認殘留資源
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=Project,Values=ws-rag \
  --region ap-northeast-1
```

---

## 成功標準

| 標準 | 確認方式 |
|------|---------|
| 環境已正常部署 | 可存取 CloudFront URL |
| 不同使用者返回不同回答 | 測試 1 與測試 2 的比較 |
| 權限拒絕情境以 Fail-Closed 運作 | 一般使用者不會顯示機密資訊 |
| 已產生稽核日誌 | CloudWatch Logs 中記錄搜尋日誌 |
| 清理已完成 | 無殘留資源 |

---

## 疑難排解

| 問題 | 處理方式 |
|------|---------|
| CDK Bootstrap 失敗 | 確認 AWS CLI 的認證資訊。`aws sts get-caller-identity` 是否成功 |
| Docker 建置失敗 | 確認 Docker 是否已啟動。`docker info` |
| 部署超過 40 分鐘 | FSx for ONTAP 建立需要 20～30 分鐘，屬正常現象 |
| 無法登入 | 確認 Cognito 使用者是否已建立。確認 `post-deploy-setup.sh` 的輸出 |
| 搜尋結果為 0 筆 | 確認 KB 同步是否已完成。等待數分鐘後重試 |

---

## 後續步驟

工作坊完成後，請考慮以下事項:

1. **以實際資料進行 PoC**: 依照[安全實驗指南](../safe-experimentation-guide.md)匯入實際資料
2. **評估**: 以[評估範本](../evaluation.md)定量評估 PoC 結果
3. **正式環境化評估**: 以[正式環境化檢查清單](../production-readiness-checklist.md)確認所需對策

---

## 相關文件

| 文件 | 內容 |
|------|------|
| [README.md](../../README.md) | 系統全貌、部署步驟 |
| [safe-experimentation-guide.md](../safe-experimentation-guide.md) | 安全實驗指南 |
| [evaluation.md](../evaluation.md) | RAG / Agent 評估指標 |
| [threat-model.md](threat-model.md) | 威脅模型 |
