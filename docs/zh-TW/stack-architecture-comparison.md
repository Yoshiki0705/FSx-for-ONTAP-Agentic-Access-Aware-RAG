# CDK 堆疊架構指南

**🌐 Language:** [日本語](../stack-architecture-comparison.md) | [English](../en/stack-architecture-comparison.md) | [한국어](../ko/stack-architecture-comparison.md) | [简体中文](../zh-CN/stack-architecture-comparison.md) | **繁體中文** | [Français](../fr/stack-architecture-comparison.md) | [Deutsch](../de/stack-architecture-comparison.md) | [Español](../es/stack-architecture-comparison.md)

**最後更新**: 2026-03-31  
**狀態**: 已整合至 demo 堆疊譜系，S3 Vectors 整合已驗證

---

## 概述

所有 CDK 堆疊整合於 `lib/stacks/demo/` 下。唯一的進入點為 `bin/demo-app.ts`。可透過 CDK context 參數啟用選用功能。

---

## 功能比較

| 功能 | Demo 堆疊（目前） | CDK Context | 備註 |
|------|-------------------|-------------|------|
| 認證 | Cognito + AD（選用） | `adPassword`, `adDomainName` | 未設定 AD 時僅使用 Cognito |
| 自動 SID 擷取 | AD Sync Lambda | `adType=managed\|self-managed` | 未設定 AD 時需手動執行（`setup-user-access.sh`） |
| NTFS ACL 擷取 | Embedding 伺服器內自動產生 | `ontapMgmtIp`, `ontapSvmUuid` | 未設定時需手動建立 `.metadata.json` |
| 權限過濾 | Next.js API Route 內（預設） | `usePermissionFilterLambda=true` | 也可遷移至專用 Lambda |
| Bedrock Agent | 動態 Agent 建立 + Action Group | `enableAgent=true` | 點擊卡片時自動建立對應類別的 Agent |
| Bedrock Guardrails | 內容安全 + PII 保護 | `enableGuardrails=true` | |
| KMS 加密 | S3 / DynamoDB CMK 加密 | `enableKmsEncryption=true` | 已啟用金鑰輪替 |
| CloudTrail | S3 資料存取 + Lambda 稽核 | `enableCloudTrail=true` | 90 天保留 |
| VPC Endpoints | S3、DynamoDB、Bedrock 等 | `enableVpcEndpoints=true` | 支援 6 項服務 |
| Embedding 伺服器 | FlexCache CIFS 掛載 + 直接向量儲存寫入 | `enableEmbeddingServer=true` | S3 AP 不可用時的備援路徑（僅限 AOSS 設定） |
| 進階權限控制 | 時間基礎存取控制 + 權限判定稽核日誌 | `enableAdvancedPermissions=true` | `permission-audit` DynamoDB 資料表 + GSI |

---

## 資料匯入路徑

| 路徑 | 方法 | 啟用方式 | 使用情境 |
|------|------|---------|---------|
| 主要 | FSx ONTAP → S3 Access Point → Bedrock KB | `post-deploy-setup.sh` | 標準磁碟區 |
| 備援 | 直接上傳至 S3 儲存桶 → Bedrock KB | `upload-demo-data.sh` | S3 AP 不可用時 |
| 替代 | CIFS 掛載 → Embedding 伺服器 → 直接向量儲存寫入 | `enableEmbeddingServer=true` | FlexCache 磁碟區（僅限 AOSS 設定） |

---

## Bedrock KB Ingestion Job — 配額與設計考量

Bedrock KB Ingestion Job 是一項託管服務，負責文件擷取、分塊、向量化和儲存。它透過 S3 Access Point 直接從 FSx ONTAP 讀取資料，並透過增量同步僅處理已變更的檔案。不需要自訂 Embedding 管線（如 AWS Batch）。

### 服務配額（截至 2026 年 3 月，均不可調整）

| 配額 | 值 | 設計影響 |
|------|-----|---------|
| 每個作業的資料大小 | 100GB | 超出的資料不會被處理。超過 100GB 的資料來源必須分割為多個資料來源 |
| 每個檔案的大小 | 50MB | 大型 PDF 需要分割 |
| 每個作業新增/更新的檔案數 | 5,000,000 | 對於一般企業文件量已足夠 |
| 每個作業刪除的檔案數 | 5,000,000 | 同上 |
| 使用 BDA 解析器時的檔案數 | 1,000 | 使用 Bedrock Data Automation 解析器時的限制 |
| 使用 FM 解析器時的檔案數 | 1,000 | 使用 Foundation Model 解析器時的限制 |
| 每個 KB 的資料來源數 | 5 | 將多個磁碟區註冊為個別資料來源時的上限 |
| 每個帳戶的 KB 數 | 100 | 多租戶設計的考量 |
| 每個帳戶的並行作業數 | 5 | 多個 KB 並行同步的限制 |
| 每個 KB 的並行作業數 | 1 | 無法對同一 KB 進行並行同步。必須等待前一個作業完成 |
| 每個資料來源的並行作業數 | 1 | 同上 |

### 執行觸發與頻率限制

| 項目 | 值 | 備註 |
|------|-----|------|
| StartIngestionJob API 速率 | 0.1 req/sec（每 10 秒一次） | **不可調整**。不適合高頻率自動同步 |
| 執行觸發 | 手動（API/CLI/Console） | Bedrock KB 端無自動排程功能 |
| 同步方式 | 增量同步 | 僅處理新增、變更和刪除。不需要完整重新處理 |
| 同步時間 | 取決於資料量（數十秒至數小時） | 小規模（數十個檔案）：30 秒-2 分鐘，大規模：數小時 |

### 排程自動同步

由於 Bedrock KB 沒有內建的排程同步功能，如需定期同步，請使用以下方法實作：

```bash
# 使用 EventBridge Scheduler 定期執行（例如每小時）
aws scheduler create-schedule \
  --name kb-sync-hourly \
  --schedule-expression "rate(1 hour)" \
  --target '{"Arn":"arn:aws:bedrock:ap-northeast-1:ACCOUNT_ID:knowledge-base/KB_ID","RoleArn":"arn:aws:iam::ACCOUNT_ID:role/scheduler-role","Input":"{\"dataSourceId\":\"DS_ID\"}"}' \
  --flexible-time-window '{"Mode":"OFF"}'
```

或者，您可以透過 S3 事件通知偵測 FSx ONTAP 上的檔案變更並觸發 Ingestion Job。但請注意 StartIngestionJob API 的速率限制（每 10 秒一次）。

### 設計建議

1. **同步頻率**：無法實現即時同步。最小間隔為 10 秒；實務上建議 15 分鐘至 1 小時
2. **大規模資料**：超過 100GB 的資料來源應分割至多個 FSx ONTAP 磁碟區（= 多個 S3 AP = 多個資料來源）
3. **並行處理**：無法對同一 KB 進行並行同步。多個資料來源需依序同步
4. **錯誤處理**：實作作業失敗的重試邏輯（使用 `GetIngestionJob` 監控狀態）
5. **不需要自訂 Embedding 管線**：由於 Bedrock KB 管理分塊、向量化和儲存，因此不需要 AWS Batch 等自訂管線

---

## CDK 堆疊結構（7 個堆疊）

| # | 堆疊 | 必要/選用 | 說明 |
|---|------|----------|------|
| 1 | WafStack | 必要 | CloudFront 的 WAF（us-east-1） |
| 2 | NetworkingStack | 必要 | VPC、子網路、安全群組 |
| 3 | SecurityStack | 必要 | Cognito User Pool |
| 4 | StorageStack | 必要 | FSx ONTAP + SVM + Volume（或現有參考）、S3、DynamoDB×2 |
| 5 | AIStack | 必要 | Bedrock KB、S3 Vectors 或 OpenSearch Serverless、Agent（選用） |
| 6 | WebAppStack | 必要 | Lambda Web Adapter + CloudFront |
| 7 | EmbeddingStack | 選用 | FlexCache CIFS 掛載 + Embedding 伺服器 |

### 現有 FSx for ONTAP 參考模式

StorageStack 可透過 `existingFileSystemId`/`existingSvmId`/`existingVolumeId` 參數參考現有的 FSx ONTAP 資源。在此情況下：
- 跳過建立新的 FSx/SVM/Volume（減少 30-40 分鐘的部署時間）
- 同時跳過 Managed AD 建立（使用現有環境的 AD 設定）
- S3 儲存桶、DynamoDB 資料表和 S3 AP 自訂資源照常建立
- `cdk destroy` 不會刪除 FSx/SVM/Volume（在 CDK 管理範圍之外）

---

## 向量儲存設定比較

向量儲存設定可透過 CDK context 參數 `vectorStoreType` 切換。第三種設定（S3 Vectors + AOSS 匯出）是在 S3 Vectors 設定之上提供的按需匯出操作程序。

> **區域支援**：S3 Vectors 在 `ap-northeast-1`（東京區域）可用。

| 項目 | OpenSearch Serverless | S3 Vectors 獨立 | S3 Vectors + AOSS 匯出 |
|------|----------------------|-----------------|------------------------|
| **CDK 參數** | `vectorStoreType=opensearch-serverless` | `vectorStoreType=s3vectors`（預設） | 在設定 2 之上執行 `export-to-opensearch.sh` |
| **成本** | 約 $700/月（2 OCU 持續運行） | 數美元/月（小規模） | S3 Vectors + AOSS OCU（僅在匯出期間） |
| **延遲** | 約 10ms | 次秒級（冷）、約 100ms（暖） | 約 10ms（匯出後 AOSS 搜尋） |
| **過濾** | 中繼資料過濾（`$eq`、`$ne`、`$in` 等） | 中繼資料過濾（`$eq`、`$in`、`$and`、`$or`） | 匯出後使用 AOSS 過濾 |
| **中繼資料限制** | 無限制 | filterable 2KB/向量（自訂實際上為 1KB），non-filterable 金鑰最多 10 個 | 匯出後遵循 AOSS 限制 |
| **使用情境** | 需要高效能的生產環境 | 成本最佳化、示範、開發環境 | 臨時高效能需求 |
| **操作程序** | 僅 CDK deploy | 僅 CDK deploy | CDK deploy 後執行 `export-to-opensearch.sh`。匯出 IAM 角色自動建立 |

> **S3 Vectors 中繼資料限制**：使用 Bedrock KB + S3 Vectors 時，自訂中繼資料實際上限制為 1KB 以下（Bedrock KB 內部中繼資料消耗 2KB filterable 中繼資料限制中的約 1KB）。CDK 程式碼將所有中繼資料設為 non-filterable 以繞過 2KB 限制。SID 過濾在應用程式端執行，因此不需要 S3 Vectors QueryVectors 過濾。詳情請參閱 [docs/s3-vectors-sid-architecture-guide.md](s3-vectors-sid-architecture-guide.md)。

### 匯出注意事項

- 匯出是**時間點複製**。S3 Vectors 資料更新後需要重新匯出（不會進行持續同步）
- 匯出期間會自動建立 AOSS 集合、OSI 管線、IAM 服務角色和 DLQ S3 儲存桶
- 主控台的「建立並使用新的服務角色」選項會自動建立 IAM 角色，因此不需要事先建立角色
- 匯出大約需要 15 分鐘（AOSS 集合建立 5 分鐘 + 管線建立 5 分鐘 + 資料傳輸 5 分鐘）
- OSI 管線在資料傳輸完成後**自動停止**（節省成本）
- 管線停止後 AOSS 集合仍可搜尋
- **不再需要時請手動刪除 AOSS 集合**（`cdk destroy` 不會刪除，因為在 CDK 管理範圍之外。OCU 計費會持續）

---

## S3 Vectors 實作經驗教訓（已驗證）

以下是 2026-03-29 在 ap-northeast-1（東京區域）實際部署驗證中獲得的經驗教訓。

### SDK/API 相關

| 項目 | 經驗教訓 |
|------|---------|
| SDK v3 回應 | `CreateVectorBucketCommand`/`CreateIndexCommand` 回應不包含 `vectorBucketArn`/`indexArn`。僅回傳 `$metadata`。ARN 必須使用模式 `arn:aws:s3vectors:{region}:{account}:bucket/{name}` 建構 |
| API 命令名稱 | `CreateIndexCommand`/`DeleteIndexCommand` 是正確的。`CreateVectorBucketIndexCommand` 不存在 |
| CreateIndex 必要參數 | `dataType: 'float32'` 為必要。省略會導致驗證錯誤 |
| 中繼資料設計 | 所有中繼資料金鑰預設為 filterable。`metadataConfiguration` 僅指定 `nonFilterableMetadataKeys`。不需要明確設定即可使 `allowed_group_sids` 為 filterable |

### Bedrock KB 相關

| 項目 | 經驗教訓 |
|------|---------|
| S3VectorsConfiguration | `indexArn` 和 `indexName` 互斥。同時指定會導致 `2 subschemas matched instead of one` 錯誤。僅使用 `indexArn` |
| IAM 權限驗證 | Bedrock KB 在建立時驗證 KB Role 的 `s3vectors:QueryVectors` 權限。IAM 政策必須在 KB 建立前套用 |
| 必要的 IAM 動作 | 需要 5 個動作：`s3vectors:QueryVectors`、`s3vectors:PutVectors`、`s3vectors:DeleteVectors`、`s3vectors:GetVectors`、`s3vectors:ListVectors` |

### CDK/CloudFormation 相關

| 項目 | 經驗教訓 |
|------|---------|
| IAM 政策資源 ARN | 使用明確的 ARN 模式而非自訂資源 `GetAtt` 權杖。這可避免相依性問題 |
| CloudFormation Hook | 組織層級的 `AWS::EarlyValidation::ResourceExistenceCheck` Hook 阻擋 change-set 可透過 `--method=direct` 繞過 |
| 部署時間 | AI 堆疊（S3 Vectors 設定）部署時間約 83 秒（相較 AOSS 設定的約 5 分鐘大幅縮短） |

---

---

## 未來擴充選項

以下功能目前未實作，但設計為可透過 CDK context 參數作為選用功能新增。

| 功能 | 概述 | 預期參數 |
|------|------|---------|
| 監控與告警 | CloudWatch 儀表板（跨堆疊指標）、SNS 告警（錯誤率/延遲閾值超標） | `enableMonitoring=true` |
| 進階權限控制 | 基於時間的存取控制（僅在上班時間允許）、地理存取限制（IP 地理位置）、DynamoDB 稽核日誌 | `enableAdvancedPermissions=true` |

---

## 相關文件

| 文件 | 內容 |
|------|------|
| [README.md](../../README.zh-TW.md) | 部署程序和 CDK context 參數列表 |
| [SID-Filtering-Architecture.md](SID-Filtering-Architecture.md) | SID 過濾設計和資料匯入路徑詳情 |
| [embedding-server-design.md](embedding-server-design.md) | Embedding 伺服器設計（包含 ONTAP ACL 自動擷取） |
| [ui-specification.md](ui-specification.md) | UI 規格（卡片 UI、KB/Agent 模式切換） |
