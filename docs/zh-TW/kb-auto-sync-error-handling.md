# KB Auto-Sync 錯誤處理設計

**🌐 Language:** [日本語](../kb-auto-sync-error-handling.md) | [English](../en/kb-auto-sync-error-handling.md) | [한국어](../ko/kb-auto-sync-error-handling.md) | [简体中文](../zh-CN/kb-auto-sync-error-handling.md) | **繁體中文** | [Français](../fr/kb-auto-sync-error-handling.md) | [Deutsch](../de/kb-auto-sync-error-handling.md) | [Español](../es/kb-auto-sync-error-handling.md)

## 概述

本文件定義 KB Auto-Sync（`enableKbAutoSync=true`）發生錯誤時的流程、重試策略、告警以及手動復原步驟。

## 錯誤偵測機制

### CloudWatch Alarm（自動偵測）

```
EventBridge Scheduler（每 5 分鐘）
  → 執行 Lambda
    → 成功：指標正常
    → 失敗：Lambda Errors 指標 +1
      → 連續 3 次錯誤：觸發 CloudWatch Alarm
        → SNS 通知（enableMonitoring=true 時）
```

**告警設定：**
- 名稱：`${prefix}-kb-auto-sync-errors`
- 閾值：1 個錯誤 × 連續 3 個週期
- 週期：與輪詢間隔相同（預設 5 分鐘）
- 缺漏資料：NOT_BREACHING（Lambda 未執行時不告警）

### EMF 指標（詳細監控）

KB Auto-Sync Lambda 會輸出下列自訂指標：

| 指標 | Namespace | 意義 |
|---|---|---|
| `FilesScanned` | `KbAutoSync` | 掃描的檔案數 |
| `FilesChanged` | `KbAutoSync` | 偵測到變更的檔案數 |
| `IngestionJobTriggered` | `KbAutoSync` | 啟動的擷取作業數 |
| `IngestionJobFailed` | `KbAutoSync` | 失敗的擷取作業數 |
| `InventoryDiffErrors` | `KbAutoSync` | 清單差異計算錯誤數 |

## 錯誤模式與應對

### 模式 1：S3 Access Point ListObjectsV2 錯誤

**原因**: FSx for ONTAP S3 AP 連線失敗、IAM 權限不足，或 Access Point 已刪除

**行為**:
- Lambda 記錄錯誤並拋出例外
- 連續三次失敗後觸發 CloudWatch Alarm
- DynamoDB 清單保持不變，因此維持原子性

**手動復原**:
```bash
# 1. 確認 S3 Access Point 是否存在
aws fsx describe-s3-access-points --volume-id <VOLUME_ID> --region ap-northeast-1

# 2. 檢查 Lambda 環境變數中的 Access Point ARN
aws lambda get-function-configuration \
  --function-name ${PREFIX}-kb-auto-sync \
  --query 'Environment.Variables.S3_ACCESS_POINT_ARN'

# 3. 以手動叫用進行測試
aws lambda invoke --function-name ${PREFIX}-kb-auto-sync /dev/stdout
```

### 模式 2：Bedrock KB 擷取作業失敗

**原因**: KB 資料來源設定錯誤、S3 Access Point 權限錯誤，或分塊／解析錯誤

**行為**:
- Lambda 先以 `StartIngestionJob` 再以 `GetIngestionJob` 追蹤狀態
- 狀態為 `FAILED` 時：
  - 在 DynamoDB 清單中將該檔案設為 `status: "failed"`
  - 下次輪詢不再重新擷取，以避免無限重試
  - 輸出 `IngestionJobFailed` 指標
- 狀態為 `IN_PROGRESS` 時：
  - 不會啟動重複作業（IN_PROGRESS 具互斥作用）

**手動復原**:
```bash
# 1. 檢視失敗的作業
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --filters '[{"attribute":"STATUS","operator":"EQ","values":["FAILED"]}]'

# 2. 在清單中找出失敗的檔案
aws dynamodb scan \
  --table-name ${PREFIX}-kb-sync-inventory \
  --filter-expression "#s = :failed" \
  --expression-attribute-names '{"#s": "status"}' \
  --expression-attribute-values '{":failed": {"S": "failed"}}'

# 3. 重設清單項目以便重新擷取
aws dynamodb delete-item \
  --table-name ${PREFIX}-kb-sync-inventory \
  --key '{"fileKey": {"S": "<file_key>"}}'

# 4. 手動啟動擷取
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>
```

### 模式 3：DynamoDB 清單資料表錯誤

**原因**: DynamoDB 容量耗盡、權限錯誤，或資料表被刪除

**行為**:
- Lambda 拋出例外並立即結束
- 故障安全：不更新清單，因此下次輪詢會重新掃描全部內容
- 連續三次失敗後觸發 CloudWatch Alarm

**手動復原**:
```bash
# 確認清單資料表是否存在
aws dynamodb describe-table --table-name ${PREFIX}-kb-sync-inventory

# 資料表不存在時以 CDK 重新部署
npx cdk deploy ${STACK_PREFIX}-AI -c enableKbAutoSync=true
```

### 模式 4：Lambda 逾時（超過 5 分鐘）

**原因**: 掃描大量檔案（>10,000 個）或 ListObjectsV2 延遲偏高

**行為**:
- Lambda 在 5 分鐘時逾時，Errors 指標遞增
- 部分掃描的檔案不會記錄到清單，因此維持原子性

**應對措施**:
- 將 `kbAutoSyncIntervalMinutes` 設定得更長（例如 15 分鐘）
- 檔案數極多時，考慮依前綴拆分 S3 Access Point

## 重試策略

| 錯誤模式 | 自動重試 | 重試間隔 | 最大次數 |
|---|---|---|---|
| S3 Access Point 連線錯誤 | ✅（下次輪詢） | 輪詢間隔（5 分鐘） | 無限制（由告警發現） |
| KB 擷取失敗 | ❌（需手動重設） | — | — |
| DynamoDB 錯誤 | ✅（下次輪詢） | 輪詢間隔（5 分鐘） | 無限制（由告警發現） |
| Lambda 逾時 | ✅（下次輪詢） | 輪詢間隔（5 分鐘） | 無限制（由告警發現） |

**設計判斷**：不採用 Dead Letter Queue。在由 EventBridge Scheduler 驅動的週期性輪詢模式中，失敗的執行會在下次輪詢自動重試，因此 DLQ 沒有作用。例外是 KB 擷取作業失敗——它**不會**自動重試，因為可能是資料品質問題，需要人工確認。

## 擷取失敗時的 Fail-Closed 行為

KB Auto-Sync 的錯誤不會削弱 RAG 管線的權限邊界：

1. **清單未更新時現有索引維持不變。** 新檔案只是不會進入檢索範圍，現有檔案的權限控制不受影響。
2. **失敗的檔案標記為 `status: "failed"`。** 不會自動重新擷取；經人工確認後再重設該項目。
3. **IN_PROGRESS 作業互斥**，可避免重複擷取造成的資料不一致。
4. **沒有權限中繼資料（`.metadata.json`）的檔案**即使進入 KB，也會在檢索時被 Fail-closed 篩選器排除。Fail-closed 原則永遠生效。

## 監控面板

當 `enableMonitoring=true` 時，CloudWatch 面板會加入下列小工具：

- **KB Auto-Sync Errors**：Lambda Errors 指標（5 分鐘週期）
- **Ingestion Job Status**：成功／失敗／進行中的作業數
- **Files Changed**：每次輪詢偵測到變更的檔案數
- **Scan Duration**：Lambda 執行時間（P50/P90/P99）

## 相關文件

- [權限中繼資料一致性模型](permission-consistency.md) —— 權限更新與 KB 索引更新的關係，以及 ACL 變更為何不會自動反映
- [CloudWatch 面板指南](cloudwatch-dashboard-guide.md) —— 如何解讀監控指標
- [生產就緒檢查清單](production-readiness-checklist.md) —— 在生產環境執行 KB Auto-Sync 的前提條件
