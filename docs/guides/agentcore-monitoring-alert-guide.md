# AgentCore 監視・アラート設定ガイド

**最終更新**: 2026-01-05  
**対象**: Amazon Bedrock AgentCore機能（9つのConstruct）  
**バージョン**: 1.0

---

## 📋 概要

このガイドは、AgentCore機能の監視とアラート設定に必要な手順を提供します。CloudWatch Dashboard、CloudWatch Alarms、X-Ray、ログ集約、アラート通知の設定方法と推奨閾値を定義します。

### 対象読者

- システム管理者
- DevOpsエンジニア
- SREエンジニア
- 運用チーム

### 前提条件

- AWS CLIがインストールされている
- 適切なIAM権限がある（CloudWatch、X-Ray、SNS、Lambda）
- AgentCore機能がデプロイされている

---

## 🎯 監視戦略

### 監視の4つの柱

1. **メトリクス監視**: Lambda、DynamoDB、API Gatewayのパフォーマンスメトリクス
2. **ログ監視**: CloudWatch Logsでのエラーログとアクセスログ
3. **トレース監視**: X-Rayでの分散トレーシング
4. **アラート**: CloudWatch Alarmsでの異常検知と通知

### 監視対象リソース

| AgentCore機能 | 主要リソース | 監視項目 |
|--------------|-------------|---------|
| Runtime | Lambda関数 | Duration, Errors, Throttles, Concurrent Executions |
| Gateway | Lambda関数（3つ） | Duration, Errors, Invocations |
| Memory | Memory Resource | API呼び出し回数、レイテンシ |
| Identity | Lambda関数、DynamoDB | Duration, Errors, Read/Write Capacity |
| Browser | Lambda関数 | Duration, Errors, Ephemeral Storage使用率 |
| Code Interpreter | Lambda関数 | Duration, Errors, Timeout率 |
| Observability | X-Ray、CloudWatch Logs | トレース数、ログエラー率 |
| Evaluations | Lambda関数、DynamoDB | Duration, Errors, 評価実行回数 |
| Policy | Lambda関数、S3 | Duration, Errors, ポリシー評価回数 |

---

## 📊 CloudWatch Dashboard設定

### 1. ダッシュボード作成

```bash
# ダッシュボード作成
aws cloudwatch put-dashboard \
  --dashboard-name AgentCore-Production-Dashboard \
  --dashboard-body file://dashboard-config.json
```

### 2. ダッシュボード設定ファイル

`dashboard-config.json`:
```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Duration", {"stat": "Average"}],
          [".", "Errors", {"stat": "Sum"}],
          [".", "Throttles", {"stat": "Sum"}],
          [".", "ConcurrentExecutions", {"stat": "Maximum"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "ap-northeast-1",
        "title": "AgentCore Runtime - Lambda Metrics",
        "yAxis": {
          "left": {"min": 0}
        }
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/DynamoDB", "ConsumedReadCapacityUnits", {"stat": "Sum"}],
          [".", "ConsumedWriteCapacityUnits", {"stat": "Sum"}],
          [".", "UserErrors", {"stat": "Sum"}],
          [".", "SystemErrors", {"stat": "Sum"}]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "ap-northeast-1",
        "title": "AgentCore Identity - DynamoDB Metrics"
      }
    }
  ]
}
```


### 3. ウィジェット種類

#### メトリクスウィジェット
- Lambda関数のパフォーマンス（Duration、Errors、Throttles）
- DynamoDBのキャパシティ使用率
- API Gatewayのリクエスト数とレイテンシ

#### ログウィジェットト
- CloudWatch Logs Insightsクエリ結果
- エラーログの集計
- アクセスログの統計

#### アラームステータスウィジェット
- 全アラームの現在のステータス
- アラーム履歴

---

## 🚨 CloudWatch Alarms設定

### 1. Lambda関数アラーム

#### Runtime Lambda関数

```bash
# エラー率アラーム（5分間で5回以上のエラー）
aws cloudwatch put-metric-alarm \
  --alarm-name AgentCore-Runtime-HighErrorRate \
  --alarm-description "Runtime Lambda function error rate is high" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=TokyoRegion-project-name-prod-AgentCoreRuntime-Function \
  --alarm-actions arn:aws:sns:ap-northeast-1:ACCOUNT_ID:AgentCore-Alerts

# Duration（実行時間）アラーム（平均5秒以上）
aws cloudwatch put-metric-alarm \
  --alarm-name AgentCore-Runtime-HighDuration \
  --alarm-description "Runtime Lambda function duration is high" \
  --metric-name Duration \
  --namespace AWS/Lambda \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 5000 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=TokyoRegion-project-name-prod-AgentCoreRuntime-Function \
  --alarm-actions arn:aws:sns:ap-northeast-1:ACCOUNT_ID:AgentCore-Alerts

# スロットリングアラーム（5分間で1回以上）
aws cloudwatch put-metric-alarm \
  --alarm-name AgentCore-Runtime-Throttles \
  --alarm-description "Runtime Lambda function is being throttled" \
  --metric-name Throttles \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=TokyoRegion-project-name-prod-AgentCoreRuntime-Function \
  --alarm-actions arn:aws:sns:ap-northeast-1:ACCOUNT_ID:AgentCore-Alerts
```

#### Gateway Lambda関数（REST API Converter）

```bash
# エラー率アラーム
aws cloudwatch put-metric-alarm \
  --alarm-name AgentCore-Gateway-RestApiConverter-HighErrorRate \
  --alarm-description "Gateway REST API Converter error rate is high" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 3 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=TokyoRegion-project-name-prod-AgentCoreGateway-RestApiConverter \
  --alarm-actions arn:aws:sns:ap-northeast-1:ACCOUNT_ID:AgentCore-Alerts
```

### 2. DynamoDBアラーム

#### Identity DynamoDBテーブル

```bash
# Read Capacity使用率アラーム（80%以上）
aws cloudwatch put-metric-alarm \
  --alarm-name AgentCore-Identity-DynamoDB-HighReadCapacity \
  --alarm-description "Identity DynamoDB table read capacity is high" \
  --metric-name ConsumedReadCapacityUnits \
  --namespace AWS/DynamoDB \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 800 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=TableName,Value=AgentCoreIdentity \
  --alarm-actions arn:aws:sns:ap-northeast-1:ACCOUNT_ID:AgentCore-Alerts

# Write Capacity使用率アラーム（80%以上）
aws cloudwatch put-metric-alarm \
  --alarm-name AgentCore-Identity-DynamoDB-HighWriteCapacity \
  --alarm-description "Identity DynamoDB table write capacity is high" \
  --metric-name ConsumedWriteCapacityUnits \
  --namespace AWS/DynamoDB \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 800 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=TableName,Value=AgentCoreIdentity \
  --alarm-actions arn:aws:sns:ap-northeast-1:ACCOUNT_ID:AgentCore-Alerts

# User Errorsアラーム（5分間で5回以上）
aws cloudwatch put-metric-alarm \
  --alarm-name AgentCore-Identity-DynamoDB-UserErrors \
  --alarm-description "Identity DynamoDB table has user errors" \
  --metric-name UserErrors \
  --namespace AWS/DynamoDB \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=TableName,Value=AgentCoreIdentity \
  --alarm-actions arn:aws:sns:ap-northeast-1:ACCOUNT_ID:AgentCore-Alerts
```


### 3. 複合アラーム

複数のメトリクスを組み合わせたアラーム：

```bash
# Runtime Lambda関数の総合ヘルスアラーム
aws cloudwatch put-composite-alarm \
  --alarm-name AgentCore-Runtime-UnhealthyComposite \
  --alarm-description "Runtime Lambda function is unhealthy (high errors OR high duration)" \
  --alarm-rule "ALARM(AgentCore-Runtime-HighErrorRate) OR ALARM(AgentCore-Runtime-HighDuration)" \
  --alarm-actions arn:aws:sns:ap-northeast-1:ACCOUNT_ID:AgentCore-Critical-Alerts
```

---

## 🔍 X-Ray設定

### 1. X-Rayトレーシング有効化

#### Lambda関数でX-Rayを有効化

```bash
# Runtime Lambda関数
aws lambda update-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreRuntime-Function \
  --tracing-config Mode=Active

# Gateway Lambda関数（REST API Converter）
aws lambda update-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreGateway-RestApiConverter \
  --tracing-config Mode=Active

# Gateway Lambda関数（Lambda Function Converter）
aws lambda update-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreGateway-LambdaConverter \
  --tracing-config Mode=Active

# Gateway Lambda関数（MCP Integration）
aws lambda update-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreGateway-McpIntegration \
  --tracing-config Mode=Active

# Identity Lambda関数
aws lambda update-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreIdentity-Function \
  --tracing-config Mode=Active

# Browser Lambda関数
aws lambda update-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreBrowser-Function \
  --tracing-config Mode=Active

# Code Interpreter Lambda関数
aws lambda update-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreCodeInterpreter-Function \
  --tracing-config Mode=Active

# Observability Lambda関数
aws lambda update-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreObservability-Function \
  --tracing-config Mode=Active

# Evaluations Lambda関数
aws lambda update-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCoreEvaluations-Function \
  --tracing-config Mode=Active

# Policy Lambda関数
aws lambda update-function-configuration \
  --function-name TokyoRegion-project-name-prod-AgentCorePolicy-Function \
  --tracing-config Mode=Active
```

### 2. X-Rayサンプリングルール設定

`xray-sampling-rules.json`:
```json
{
  "SamplingRule": {
    "RuleName": "AgentCore-HighPriority",
    "Priority": 100,
    "FixedRate": 1.0,
    "ReservoirSize": 100,
    "ServiceName": "*AgentCore*",
    "ServiceType": "AWS::Lambda::Function",
    "Host": "*",
    "HTTPMethod": "*",
    "URLPath": "*",
    "Version": 1,
    "ResourceARN": "*",
    "Attributes": {}
  }
}
```

```bash
# サンプリングルール作成
aws xray create-sampling-rule \
  --cli-input-json file://xray-sampling-rules.json
```

### 3. X-Rayグループ設定

```bash
# エラートレース用グループ
aws xray create-group \
  --group-name AgentCore-Errors \
  --filter-expression 'error = true OR fault = true'

# 遅いトレース用グループ（5秒以上）
aws xray create-group \
  --group-name AgentCore-SlowTraces \
  --filter-expression 'duration >= 5'

# Runtime機能用グループ
aws xray create-group \
  --group-name AgentCore-Runtime \
  --filter-expression 'service("TokyoRegion-project-name-prod-AgentCoreRuntime-Function")'
```

---

## 📝 ログ集約設定

### 1. CloudWatch Logs Insights クエリ

#### エラーログ集計クエリ

```sql
-- 過去1時間のエラーログを集計
fields @timestamp, @message, @logStream
| filter @message like /ERROR/
| stats count() by bin(5m)
| sort @timestamp desc
```

#### Lambda関数のパフォーマンスクエリ

```sql
-- Lambda関数の実行時間統計
fields @timestamp, @duration, @billedDuration, @memorySize, @maxMemoryUsed
| filter @type = "REPORT"
| stats avg(@duration), max(@duration), min(@duration), pct(@duration, 95) by bin(5m)
```

#### エラー率クエリ

```sql
-- エラー率の計算
fields @timestamp
| filter @type = "REPORT"
| stats count() as total_invocations,
        sum(@message like /ERROR/) as error_count
| fields error_count / total_invocations * 100 as error_rate_percent
```

### 2. ログサブスクリプションフィルター

#### S3へのログエクスポート

```bash
# ログサブスクリプションフィルター作成
aws logs put-subscription-filter \
  --log-group-name /aws/lambda/AgentCoreRuntime \
  --filter-name AgentCore-Runtime-S3Export \
  --filter-pattern "" \
  --destination-arn arn:aws:kinesis:ap-northeast-1:ACCOUNT_ID:stream/AgentCore-Logs
```


### 3. ログ保持期間設定

```bash
# Runtime Lambda関数のログ保持期間を30日に設定
aws logs put-retention-policy \
  --log-group-name /aws/lambda/AgentCoreRuntime \
  --retention-in-days 30

# Gateway Lambda関数のログ保持期間を30日に設定
aws logs put-retention-policy \
  --log-group-name /aws/lambda/AgentCoreGateway-RestApiConverter \
  --retention-in-days 30

aws logs put-retention-policy \
  --log-group-name /aws/lambda/AgentCoreGateway-LambdaConverter \
  --retention-in-days 30

aws logs put-retention-policy \
  --log-group-name /aws/lambda/AgentCoreGateway-McpIntegration \
  --retention-in-days 30

# Identity Lambda関数のログ保持期間を30日に設定
aws logs put-retention-policy \
  --log-group-name /aws/lambda/AgentCoreIdentity \
  --retention-in-days 30

# Browser Lambda関数のログ保持期間を30日に設定
aws logs put-retention-policy \
  --log-group-name /aws/lambda/AgentCoreBrowser \
  --retention-in-days 30

# Code Interpreter Lambda関数のログ保持期間を30日に設定
aws logs put-retention-policy \
  --log-group-name /aws/lambda/AgentCoreCodeInterpreter \
  --retention-in-days 30

# Observability Lambda関数のログ保持期間を30日に設定
aws logs put-retention-policy \
  --log-group-name /aws/lambda/AgentCoreObservability \
  --retention-in-days 30

# Evaluations Lambda関数のログ保持期間を30日に設定
aws logs put-retention-policy \
  --log-group-name /aws/lambda/AgentCoreEvaluations \
  --retention-in-days 30

# Policy Lambda関数のログ保持期間を30日に設定
aws logs put-retention-policy \
  --log-group-name /aws/lambda/AgentCorePolicy \
  --retention-in-days 30
```

---

## 📧 アラート通知設定

### 1. SNSトピック作成

```bash
# アラート通知用SNSトピック作成
aws sns create-topic \
  --name AgentCore-Alerts \
  --region ap-northeast-1

# 重要アラート用SNSトピック作成
aws sns create-topic \
  --name AgentCore-Critical-Alerts \
  --region ap-northeast-1
```

### 2. メール通知設定

```bash
# メールサブスクリプション作成
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-northeast-1:ACCOUNT_ID:AgentCore-Alerts \
  --protocol email \
  --notification-endpoint ops-team@example.com

# 重要アラート用メールサブスクリプション
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-northeast-1:ACCOUNT_ID:AgentCore-Critical-Alerts \
  --protocol email \
  --notification-endpoint critical-alerts@example.com
```

### 3. Slack通知設定

#### Lambda関数でSlack通知

`slack-notifier/index.js`:
```javascript
const https = require('https');

exports.handler = async (event) => {
  const message = JSON.parse(event.Records[0].Sns.Message);
  
  const slackMessage = {
    text: `🚨 AgentCore Alert`,
    attachments: [{
      color: 'danger',
      fields: [
        {
          title: 'Alarm Name',
          value: message.AlarmName,
          short: true
        },
        {
          title: 'State',
          value: message.NewStateValue,
          short: true
        },
        {
          title: 'Reason',
          value: message.NewStateReason,
          short: false
        }
      ]
    }]
  };
  
  const options = {
    hostname: 'hooks.slack.com',
    path: '/services/YOUR/WEBHOOK/URL',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      resolve({ statusCode: 200 });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    req.write(JSON.stringify(slackMessage));
    req.end();
  });
};
```

```bash
# Slack通知Lambda関数作成
aws lambda create-function \
  --function-name AgentCore-SlackNotifier \
  --runtime nodejs18.x \
  --role arn:aws:iam::ACCOUNT_ID:role/AgentCore-SlackNotifier-Role \
  --handler index.handler \
  --zip-file fileb://slack-notifier.zip

# SNSトピックからLambda関数を呼び出す
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-northeast-1:ACCOUNT_ID:AgentCore-Alerts \
  --protocol lambda \
  --notification-endpoint arn:aws:lambda:ap-northeast-1:ACCOUNT_ID:function:AgentCore-SlackNotifier
```

### 4. PagerDuty統合

```bash
# PagerDuty統合用SNSサブスクリプション
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-northeast-1:ACCOUNT_ID:AgentCore-Critical-Alerts \
  --protocol https \
  --notification-endpoint https://events.pagerduty.com/integration/YOUR_INTEGRATION_KEY/enqueue
```

---

## 📏 メトリクス閾値の推奨値

### Lambda関数

| メトリクス | 推奨閾値 | 評価期間 | アクション |
|-----------|---------|---------|----------|
| Errors | 5回/5分 | 1期間 | アラート通知 |
| Duration（平均） | 5秒 | 2期間 | アラート通知 |
| Duration（P95） | 10秒 | 2期間 | 調査 |
| Throttles | 1回/5分 | 1期間 | 即座対応 |
| Concurrent Executions | Reserved Concurrencyの80% | 2期間 | スケーリング検討 |
| Memory使用率 | 80% | 2期間 | メモリ増加検討 |

### DynamoDB

| メトリクス | 推奨閾値 | 評価期間 | アクション |
|-----------|---------|---------|----------|
| ConsumedReadCapacityUnits | Provisioned Capacityの80% | 2期間 | Auto Scaling確認 |
| ConsumedWriteCapacityUnits | Provisioned Capacityの80% | 2期間 | Auto Scaling確認 |
| UserErrors | 5回/5分 | 1期間 | アラート通知 |
| SystemErrors | 1回/5分 | 1期間 | 即座対応 |
| ThrottledRequests | 1回/5分 | 1期間 | キャパシティ増加 |

### X-Ray

| メトリクス | 推奨閾値 | 評価期間 | アクション |
|-----------|---------|---------|----------|
| エラー率 | 5% | 5分 | アラート通知 |
| レイテンシ（P95） | 10秒 | 5分 | パフォーマンス調査 |
| レイテンシ（P99） | 15秒 | 5分 | 緊急調査 |


### CloudWatch Logs

| メトリクス | 推奨閾値 | 評価期間 | アクション |
|-----------|---------|---------|----------|
| エラーログ数 | 10回/5分 | 1期間 | アラート通知 |
| WARNログ数 | 50回/5分 | 2期間 | 調査 |
| ログサイズ | 1GB/日 | 1日 | ログ最適化検討 |

---

## 🔧 自動化スクリプト

### 1. 全アラーム一括作成スクリプト

`setup-all-alarms.sh`:
```bash
#!/bin/bash
set -euo pipefail

# 環境変数
REGION="ap-northeast-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
SNS_TOPIC_ARN="arn:aws:sns:${REGION}:${ACCOUNT_ID}:AgentCore-Alerts"
PROJECT_NAME="permission-aware-rag"
ENVIRONMENT="prod"

# Lambda関数名のプレフィックス
FUNCTION_PREFIX="TokyoRegion-${PROJECT_NAME}-${ENVIRONMENT}"

# Lambda関数リスト
LAMBDA_FUNCTIONS=(
  "AgentCoreRuntime-Function"
  "AgentCoreGateway-RestApiConverter"
  "AgentCoreGateway-LambdaConverter"
  "AgentCoreGateway-McpIntegration"
  "AgentCoreIdentity-Function"
  "AgentCoreBrowser-Function"
  "AgentCoreCodeInterpreter-Function"
  "AgentCoreObservability-Function"
  "AgentCoreEvaluations-Function"
  "AgentCorePolicy-Function"
)

echo "🚀 Creating CloudWatch Alarms for AgentCore..."

# 各Lambda関数のアラーム作成
for FUNCTION in "${LAMBDA_FUNCTIONS[@]}"; do
  FULL_FUNCTION_NAME="${FUNCTION_PREFIX}-${FUNCTION}"
  
  echo "📊 Creating alarms for ${FULL_FUNCTION_NAME}..."
  
  # エラー率アラーム
  aws cloudwatch put-metric-alarm \
    --alarm-name "${FULL_FUNCTION_NAME}-HighErrorRate" \
    --alarm-description "${FUNCTION} error rate is high" \
    --metric-name Errors \
    --namespace AWS/Lambda \
    --statistic Sum \
    --period 300 \
    --evaluation-periods 1 \
    --threshold 5 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=FunctionName,Value="${FULL_FUNCTION_NAME}" \
    --alarm-actions "${SNS_TOPIC_ARN}" \
    --region "${REGION}"
  
  # Duration（実行時間）アラーム
  aws cloudwatch put-metric-alarm \
    --alarm-name "${FULL_FUNCTION_NAME}-HighDuration" \
    --alarm-description "${FUNCTION} duration is high" \
    --metric-name Duration \
    --namespace AWS/Lambda \
    --statistic Average \
    --period 300 \
    --evaluation-periods 2 \
    --threshold 5000 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=FunctionName,Value="${FULL_FUNCTION_NAME}" \
    --alarm-actions "${SNS_TOPIC_ARN}" \
    --region "${REGION}"
  
  # スロットリングアラーム
  aws cloudwatch put-metric-alarm \
    --alarm-name "${FULL_FUNCTION_NAME}-Throttles" \
    --alarm-description "${FUNCTION} is being throttled" \
    --metric-name Throttles \
    --namespace AWS/Lambda \
    --statistic Sum \
    --period 300 \
    --evaluation-periods 1 \
    --threshold 1 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=FunctionName,Value="${FULL_FUNCTION_NAME}" \
    --alarm-actions "${SNS_TOPIC_ARN}" \
    --region "${REGION}"
  
  echo "✅ Alarms created for ${FULL_FUNCTION_NAME}"
done

echo "🎉 All CloudWatch Alarms created successfully!"
```

### 2. X-Ray一括有効化スクリプト

`enable-xray-all.sh`:
```bash
#!/bin/bash
set -euo pipefail

# 環境変数
REGION="ap-northeast-1"
PROJECT_NAME="permission-aware-rag"
ENVIRONMENT="prod"

# Lambda関数名のプレフィックス
FUNCTION_PREFIX="TokyoRegion-${PROJECT_NAME}-${ENVIRONMENT}"

# Lambda関数リスト
LAMBDA_FUNCTIONS=(
  "AgentCoreRuntime-Function"
  "AgentCoreGateway-RestApiConverter"
  "AgentCoreGateway-LambdaConverter"
  "AgentCoreGateway-McpIntegration"
  "AgentCoreIdentity-Function"
  "AgentCoreBrowser-Function"
  "AgentCoreCodeInterpreter-Function"
  "AgentCoreObservability-Function"
  "AgentCoreEvaluations-Function"
  "AgentCorePolicy-Function"
)

echo "🔍 Enabling X-Ray tracing for AgentCore Lambda functions..."

for FUNCTION in "${LAMBDA_FUNCTIONS[@]}"; do
  FULL_FUNCTION_NAME="${FUNCTION_PREFIX}-${FUNCTION}"
  
  echo "📊 Enabling X-Ray for ${FULL_FUNCTION_NAME}..."
  
  aws lambda update-function-configuration \
    --function-name "${FULL_FUNCTION_NAME}" \
    --tracing-config Mode=Active \
    --region "${REGION}"
  
  echo "✅ X-Ray enabled for ${FULL_FUNCTION_NAME}"
done

echo "🎉 X-Ray tracing enabled for all AgentCore Lambda functions!"
```

### 3. ログ保持期間一括設定スクリプト

`set-log-retention-all.sh`:
```bash
#!/bin/bash
set -euo pipefail

# 環境変数
REGION="ap-northeast-1"
RETENTION_DAYS=30

# ロググループリスト
LOG_GROUPS=(
  "/aws/lambda/AgentCoreRuntime"
  "/aws/lambda/AgentCoreGateway-RestApiConverter"
  "/aws/lambda/AgentCoreGateway-LambdaConverter"
  "/aws/lambda/AgentCoreGateway-McpIntegration"
  "/aws/lambda/AgentCoreIdentity"
  "/aws/lambda/AgentCoreBrowser"
  "/aws/lambda/AgentCoreCodeInterpreter"
  "/aws/lambda/AgentCoreObservability"
  "/aws/lambda/AgentCoreEvaluations"
  "/aws/lambda/AgentCorePolicy"
)

echo "📝 Setting log retention to ${RETENTION_DAYS} days for AgentCore..."

for LOG_GROUP in "${LOG_GROUPS[@]}"; do
  echo "📊 Setting retention for ${LOG_GROUP}..."
  
  aws logs put-retention-policy \
    --log-group-name "${LOG_GROUP}" \
    --retention-in-days "${RETENTION_DAYS}" \
    --region "${REGION}"
  
  echo "✅ Retention set for ${LOG_GROUP}"
done

echo "🎉 Log retention set for all AgentCore log groups!"
```

---

## 📋 監視チェックリスト

### 日次チェック

- [ ] CloudWatch Dashboardで全体的なヘルスを確認
- [ ] アクティブなアラームがないか確認
- [ ] エラーログの件数を確認（10件/日以下が正常）
- [ ] Lambda関数のDuration平均を確認（5秒以下が正常）
- [ ] DynamoDBのキャパシティ使用率を確認（80%以下が正常）

### 週次チェック

- [ ] X-Rayサービスマップでボトルネックを確認
- [ ] CloudWatch Logs Insightsでエラーパターンを分析
- [ ] Lambda関数のメモリ使用率を確認（80%以下が正常）
- [ ] DynamoDBのAuto Scaling設定を確認
- [ ] アラーム履歴をレビュー

### 月次チェック

- [ ] CloudWatch Dashboardの設定を見直し
- [ ] アラーム閾値の妥当性を確認
- [ ] X-Rayサンプリングルールを見直し
- [ ] ログ保持期間とコストを確認
- [ ] 監視コストを確認（CloudWatch、X-Ray）

---

## 🚨 アラート対応フロー

### レベル1: 警告アラート（Warning）

**対応時間**: 1時間以内

**対応手順**:
1. CloudWatch Dashboardで状況確認
2. CloudWatch Logsでエラーログ確認
3. 一時的な問題か継続的な問題かを判断
4. 継続的な問題の場合はレベル2へエスカレーション

### レベル2: 重要アラート（Critical）

**対応時間**: 30分以内

**対応手順**:
1. X-Rayトレースで根本原因を特定
2. トラブルシューティングガイドを参照
3. 緊急対応を実施（Lambda再起動、キャパシティ増加等）
4. 解決しない場合はレベル3へエスカレーション

### レベル3: 緊急アラート（Emergency）

**対応時間**: 15分以内

**対応手順**:
1. システム管理者に即座通知
2. AWS Supportケースを作成
3. ロールバック計画を検討
4. ステークホルダーに状況報告

---

## 📚 関連ドキュメント

- **運用手順書**: `docs/guides/agentcore-operations-manual.md`
- **トラブルシューティングガイド**: `docs/guides/debugging-troubleshooting-guide.md`
- **デプロイガイド**: `docs/guides/agentcore-deployment-guide.md`
- **実装ガイド**: `docs/guides/bedrock-agentcore-implementation-guide.md`

---

## 📝 付録

### A. CloudWatch Dashboardテンプレート（完全版）

完全なダッシュボード設定は、`development/configs/cloudwatch-dashboard-template.json`を参照してください。

### B. アラーム設定一覧

全アラームの設定詳細は、`development/configs/cloudwatch-alarms-config.json`を参照してください。

### C. X-Ray設定一覧

X-Rayの詳細設定は、`development/configs/xray-config.json`を参照してください。

---

**このガイドは継続的に更新されます。新しい監視項目やアラート設定が追加され次第、更新してください。**
