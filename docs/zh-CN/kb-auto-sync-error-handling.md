# KB Auto-Sync 错误处理设计

**🌐 Language:** [日本語](../kb-auto-sync-error-handling.md) | [English](../en/kb-auto-sync-error-handling.md) | [한국어](../ko/kb-auto-sync-error-handling.md) | **简体中文** | [繁體中文](../zh-TW/kb-auto-sync-error-handling.md) | [Français](../fr/kb-auto-sync-error-handling.md) | [Deutsch](../de/kb-auto-sync-error-handling.md) | [Español](../es/kb-auto-sync-error-handling.md)

## 概述

本文档定义 KB Auto-Sync（`enableKbAutoSync=true`）发生错误时的流程、重试策略、告警以及手动恢复步骤。

## 错误检测机制

### CloudWatch Alarm（自动检测）

```
EventBridge Scheduler（每 5 分钟）
  → 执行 Lambda
    → 成功：指标正常
    → 失败：Lambda Errors 指标 +1
      → 连续 3 次错误：触发 CloudWatch Alarm
        → SNS 通知（enableMonitoring=true 时）
```

**告警配置：**
- 名称：`${prefix}-kb-auto-sync-errors`
- 阈值：1 个错误 × 连续 3 个周期
- 周期：与轮询间隔相同（默认 5 分钟）
- 缺失数据：NOT_BREACHING（Lambda 未运行时不告警）

### EMF 指标（详细监控）

KB Auto-Sync Lambda 输出以下自定义指标：

| 指标 | Namespace | 含义 |
|---|---|---|
| `FilesScanned` | `KbAutoSync` | 扫描的文件数 |
| `FilesChanged` | `KbAutoSync` | 检测到变更的文件数 |
| `IngestionJobTriggered` | `KbAutoSync` | 启动的摄取作业数 |
| `IngestionJobFailed` | `KbAutoSync` | 失败的摄取作业数 |
| `InventoryDiffErrors` | `KbAutoSync` | 清单差分计算错误数 |

## 错误模式与应对

### 模式 1：S3 Access Point ListObjectsV2 错误

**原因**: FSx for ONTAP S3 AP 连接失败、IAM 权限不足，或 Access Point 已删除

**行为**:
- Lambda 记录错误并抛出异常
- 连续三次失败后触发 CloudWatch Alarm
- DynamoDB 清单保持不变，从而保证原子性

**手动恢复**:
```bash
# 1. 确认 S3 Access Point 是否存在
aws fsx describe-s3-access-points --volume-id <VOLUME_ID> --region ap-northeast-1

# 2. 检查 Lambda 环境变量中的 Access Point ARN
aws lambda get-function-configuration \
  --function-name ${PREFIX}-kb-auto-sync \
  --query 'Environment.Variables.S3_ACCESS_POINT_ARN'

# 3. 通过手动调用进行测试
aws lambda invoke --function-name ${PREFIX}-kb-auto-sync /dev/stdout
```

### 模式 2：Bedrock KB 摄取作业失败

**原因**: KB 数据源配置错误、S3 Access Point 权限错误，或分块/解析错误

**行为**:
- Lambda 使用 `StartIngestionJob` 后再用 `GetIngestionJob` 跟踪状态
- 状态为 `FAILED` 时：
  - 在 DynamoDB 清单中将该文件置为 `status: "failed"`
  - 下次轮询不再重新摄取，从而避免无限重试
  - 输出 `IngestionJobFailed` 指标
- 状态为 `IN_PROGRESS` 时：
  - 不启动重复作业（IN_PROGRESS 起到互斥作用）

**手动恢复**:
```bash
# 1. 查看失败的作业
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID> \
  --filters '[{"attribute":"STATUS","operator":"EQ","values":["FAILED"]}]'

# 2. 在清单中查找失败的文件
aws dynamodb scan \
  --table-name ${PREFIX}-kb-sync-inventory \
  --filter-expression "#s = :failed" \
  --expression-attribute-names '{"#s": "status"}' \
  --expression-attribute-values '{":failed": {"S": "failed"}}'

# 3. 重置清单条目以便重新摄取
aws dynamodb delete-item \
  --table-name ${PREFIX}-kb-sync-inventory \
  --key '{"fileKey": {"S": "<file_key>"}}'

# 4. 手动启动摄取
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id <KB_ID> \
  --data-source-id <DS_ID>
```

### 模式 3：DynamoDB 清单表错误

**原因**: DynamoDB 容量耗尽、权限错误，或表被删除

**行为**:
- Lambda 抛出异常并立即结束
- 故障安全：不更新清单，因此下次轮询会重新扫描全部内容
- 连续三次失败后触发 CloudWatch Alarm

**手动恢复**:
```bash
# 确认清单表是否存在
aws dynamodb describe-table --table-name ${PREFIX}-kb-sync-inventory

# 表不存在时使用 CDK 重新部署
npx cdk deploy ${STACK_PREFIX}-AI -c enableKbAutoSync=true
```

### 模式 4：Lambda 超时（超过 5 分钟）

**原因**: 扫描大量文件（>10,000 个）或 ListObjectsV2 延迟较高

**行为**:
- Lambda 在 5 分钟时超时，Errors 指标递增
- 部分扫描的文件不会记录到清单中，从而保证原子性

**应对措施**:
- 将 `kbAutoSyncIntervalMinutes` 设置得更长（例如 15 分钟）
- 文件数极多时，考虑按前缀拆分 S3 Access Point

## 重试策略

| 错误模式 | 自动重试 | 重试间隔 | 最大次数 |
|---|---|---|---|
| S3 Access Point 连接错误 | ✅（下次轮询） | 轮询间隔（5 分钟） | 无限制（由告警发现） |
| KB 摄取失败 | ❌（需手动重置） | — | — |
| DynamoDB 错误 | ✅（下次轮询） | 轮询间隔（5 分钟） | 无限制（由告警发现） |
| Lambda 超时 | ✅（下次轮询） | 轮询间隔（5 分钟） | 无限制（由告警发现） |

**设计判断**：不使用 Dead Letter Queue。在由 EventBridge Scheduler 驱动的周期性轮询模式中，失败的执行会在下次轮询自动重试，因此 DLQ 没有作用。例外是 KB 摄取作业失败——它**不会**自动重试，因为可能是数据质量问题，需要人工确认。

## 摄取失败时的 Fail-Closed 行为

KB Auto-Sync 的错误不会削弱 RAG 管道的权限边界：

1. **清单未更新时现有索引保持不变。** 新文件只是不会进入检索范围，现有文件的权限控制不受影响。
2. **失败的文件标记为 `status: "failed"`。** 不会自动重新摄取；经人工确认后再重置该条目。
3. **IN_PROGRESS 作业互斥**，可防止重复摄取导致的数据不一致。
4. **没有权限元数据（`.metadata.json`）的文件**即使进入 KB，也会在检索时被 Fail-closed 过滤器排除。Fail-closed 原则始终生效。

## 监控面板

当 `enableMonitoring=true` 时，CloudWatch 面板会增加以下小组件：

- **KB Auto-Sync Errors**：Lambda Errors 指标（5 分钟周期）
- **Ingestion Job Status**：成功/失败/进行中的作业数
- **Files Changed**：每次轮询检测到变更的文件数
- **Scan Duration**：Lambda 执行时间（P50/P90/P99）

## 相关文档

- [权限元数据一致性模型](permission-consistency.md) —— 权限更新与 KB 索引更新的关系，以及 ACL 变更为何不会自动反映
- [CloudWatch 面板指南](cloudwatch-dashboard-guide.md) —— 如何解读监控指标
- [生产就绪检查清单](production-readiness-checklist.md) —— 在生产环境运行 KB Auto-Sync 的前提条件
