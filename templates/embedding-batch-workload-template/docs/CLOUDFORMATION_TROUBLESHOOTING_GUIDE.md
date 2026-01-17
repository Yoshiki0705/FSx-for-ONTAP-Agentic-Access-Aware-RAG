# 🔧 CloudFormation Troubleshooting Guide

このガイドでは、Embedding Batch Workload Template のCloudFormationデプロイメントで発生する一般的な問題と解決方法を説明します。

## 📋 目次

- [🚨 一般的な問題と解決方法](#-一般的な問題と解決方法)
- [📊 スタック状態の診断](#-スタック状態の診断)
- [🔍 ログとメトリクスの確認](#-ログとメトリクスの確認)
- [🛠️ 修復手順](#️-修復手順)
- [📞 サポートへの連絡](#-サポートへの連絡)

---

## 🚨 一般的な問題と解決方法

### 1. スタック作成の失敗

#### 問題: `CREATE_FAILED` 状態でスタックが停止

**症状:**
```
Stack Status: CREATE_FAILED
Status Reason: The following resource(s) failed to create: [ResourceName]
```

**原因と解決方法:**

##### A. IAM権限不足
```bash
# 現在のIAM権限を確認
aws sts get-caller-identity
aws iam get-user --user-name $(aws sts get-caller-identity --query User.UserName --output text)

# 必要な権限を確認
./scripts/validate-cloudformation.sh --check-permissions
```

**解決方法:**
- 管理者権限を持つユーザーでデプロイを実行
- 最小権限の場合は、以下のポリシーを追加:
  - `AWSCloudFormationFullAccess`
  - `IAMFullAccess`
  - `AmazonEC2FullAccess`
  - `AWSBatchFullAccess`

##### B. リソース制限に達している
```bash
# サービス制限を確認
aws service-quotas get-service-quota --service-code batch --quota-code L-34E4B58F
aws service-quotas get-service-quota --service-code ec2 --quota-code L-1216C47A
```

**解決方法:**
- AWS Service Quotasで制限値を確認
- 必要に応じて制限値の引き上げを申請
- 不要なリソースを削除してスペースを確保

##### C. VPCまたはサブネットの問題
```bash
# VPCとサブネットの存在確認
aws ec2 describe-vpcs --vpc-ids vpc-12345678
aws ec2 describe-subnets --subnet-ids subnet-12345678 subnet-87654321
```

**解決方法:**
- 指定したVPC IDとサブネット IDが正しいことを確認
- サブネットが異なるアベイラビリティゾーンにあることを確認
- サブネットにインターネットアクセスがあることを確認

### 2. FSx統合の問題

#### 問題: FSxファイルシステムにアクセスできない

**症状:**
```
Batch Job Status: FAILED
Exit Code: 1
Reason: Mount failed: No such file or directory
```

**診断手順:**
```bash
# FSxファイルシステムの状態確認
aws fsx describe-file-systems --file-system-ids fs-12345678

# セキュリティグループの確認
aws ec2 describe-security-groups --group-ids sg-12345678
```

**解決方法:**

##### A. FSxファイルシステムが利用可能でない
- FSxファイルシステムのステータスが `AVAILABLE` であることを確認
- 同じVPC内にFSxファイルシステムがあることを確認

##### B. セキュリティグループの設定問題
```bash
# NFS通信用のセキュリティグループルールを追加
aws ec2 authorize-security-group-egress \
  --group-id sg-12345678 \
  --protocol tcp \
  --port 2049 \
  --cidr 10.0.0.0/8
```

##### C. DNS名またはマウント名の間違い
- CloudFormationパラメータでFSx DNS名が正しいことを確認
- FSxマウント名（通常は `vol1`）が正しいことを確認

### 3. Batch ジョブの実行失敗

#### 問題: ジョブが `FAILED` 状態になる

**診断手順:**
```bash
# ジョブの詳細を確認
aws batch describe-jobs --jobs job-id-12345

# ジョブのログを確認
aws logs get-log-events \
  --log-group-name /aws/batch/job \
  --log-stream-name job-name/default/job-id-12345
```

**一般的な原因と解決方法:**

##### A. コンテナイメージの問題
```bash
# イメージの存在確認
aws ecr describe-images --repository-name embedding-batch-workload
```

**解決方法:**
- 正しいECRリポジトリ名とタグを指定
- イメージがプッシュされていることを確認
- リージョンが一致していることを確認

##### B. 環境変数の設定問題
```bash
# ジョブ定義の環境変数を確認
aws batch describe-job-definitions --job-definition-name document-processing
```

**解決方法:**
- 必要な環境変数がすべて設定されていることを確認
- Bedrock リージョンとモデル名が正しいことを確認

##### C. IAM権限の問題
```bash
# ジョブロールの権限を確認
aws iam get-role-policy --role-name EmbeddingBatchJobRole --policy-name JobRolePolicy
```

**解決方法:**
- Bedrock、S3、DynamoDBへのアクセス権限を確認
- リソースARNが正しいことを確認

### 4. スタック更新の失敗

#### 問題: `UPDATE_ROLLBACK_COMPLETE` 状態

**症状:**
```
Stack Status: UPDATE_ROLLBACK_COMPLETE
Status Reason: The following resource(s) failed to update: [ResourceName]
```

**解決方法:**

##### A. 変更セットを使用した安全な更新
```bash
# 変更セットを作成
aws cloudformation create-change-set \
  --stack-name embedding-batch-workload \
  --change-set-name update-$(date +%Y%m%d-%H%M%S) \
  --template-body file://template.yaml \
  --parameters file://parameters.json \
  --capabilities CAPABILITY_IAM

# 変更内容を確認
aws cloudformation describe-change-set \
  --stack-name embedding-batch-workload \
  --change-set-name update-$(date +%Y%m%d-%H%M%S)

# 変更セットを実行
aws cloudformation execute-change-set \
  --stack-name embedding-batch-workload \
  --change-set-name update-$(date +%Y%m%d-%H%M%S)
```

##### B. リソースの置換が必要な場合
- 重要なリソース（Batch Compute Environment等）の置換を避ける
- 必要に応じて新しいスタックを作成し、段階的に移行

### 5. パフォーマンスの問題

#### 問題: ジョブの実行が遅い

**診断手順:**
```bash
# Compute Environment の状態確認
aws batch describe-compute-environments \
  --compute-environments embedding-batch-compute-env

# ジョブキューの状態確認
aws batch describe-job-queues --job-queues embedding-batch-job-queue
```

**解決方法:**

##### A. Compute Environment のスケーリング設定
```yaml
# CloudFormationテンプレートで調整
ComputeResources:
  MinvCpus: 0
  MaxvCpus: 500  # 必要に応じて増加
  DesiredvCpus: 10  # 初期容量を設定
  InstanceTypes:
    - m5.large
    - m5.xlarge
    - m5.2xlarge
    - c5.large    # CPU集約的なワークロード用
    - c5.xlarge
```

##### B. インスタンスタイプの最適化
- CPU集約的: c5, c6i シリーズ
- メモリ集約的: r5, r6i シリーズ
- バランス型: m5, m6i シリーズ

---

## 📊 スタック状態の診断

### スタック状態の確認

```bash
# スタックの基本情報
aws cloudformation describe-stacks --stack-name embedding-batch-workload

# スタックイベントの確認
aws cloudformation describe-stack-events --stack-name embedding-batch-workload

# スタックリソースの確認
aws cloudformation describe-stack-resources --stack-name embedding-batch-workload
```

### 自動診断スクリプト

```bash
# 包括的な診断を実行
./scripts/monitor-cloudformation.sh --stack embedding-batch-workload --diagnose

# 特定のリソースタイプの診断
./scripts/monitor-cloudformation.sh --stack embedding-batch-workload --resource-type AWS::Batch::ComputeEnvironment
```

### ドリフト検出

```bash
# スタックドリフトの検出
aws cloudformation detect-stack-drift --stack-name embedding-batch-workload

# ドリフト結果の確認
aws cloudformation describe-stack-drift-detection-status --stack-drift-detection-id drift-id-12345
```

---

## 🔍 ログとメトリクスの確認

### CloudWatch Logs

```bash
# Batch ジョブのログ
aws logs describe-log-groups --log-group-name-prefix /aws/batch/job

# 特定のジョブのログストリーム
aws logs describe-log-streams \
  --log-group-name /aws/batch/job \
  --log-stream-name-prefix job-name

# ログの内容を確認
aws logs get-log-events \
  --log-group-name /aws/batch/job \
  --log-stream-name job-name/default/job-id-12345 \
  --start-time $(date -d '1 hour ago' +%s)000
```

### CloudWatch Metrics

```bash
# Batch メトリクスの確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/Batch \
  --metric-name SubmittedJobs \
  --dimensions Name=JobQueue,Value=embedding-batch-job-queue \
  --start-time $(date -d '1 hour ago' --iso-8601) \
  --end-time $(date --iso-8601) \
  --period 300 \
  --statistics Sum

# EC2 インスタンスのメトリクス
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=AutoScalingGroupName,Value=batch-compute-env-asg \
  --start-time $(date -d '1 hour ago' --iso-8601) \
  --end-time $(date --iso-8601) \
  --period 300 \
  --statistics Average,Maximum
```

---

## 🛠️ 修復手順

### 1. スタックの修復

#### A. 失敗したリソースの特定
```bash
# 失敗したリソースを特定
aws cloudformation describe-stack-events \
  --stack-name embedding-batch-workload \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'
```

#### B. 部分的な修復
```bash
# 特定のリソースのみを更新
aws cloudformation update-stack \
  --stack-name embedding-batch-workload \
  --use-previous-template \
  --parameters ParameterKey=FixSpecificResource,ParameterValue=true
```

#### C. スタックの再作成
```bash
# 既存スタックを削除（注意: データが失われる可能性があります）
aws cloudformation delete-stack --stack-name embedding-batch-workload

# スタック削除の完了を待機
aws cloudformation wait stack-delete-complete --stack-name embedding-batch-workload

# 新しいスタックを作成
aws cloudformation create-stack \
  --stack-name embedding-batch-workload \
  --template-body file://template.yaml \
  --parameters file://parameters.json \
  --capabilities CAPABILITY_IAM
```

### 2. Batch環境の修復

#### A. Compute Environment の無効化と再有効化
```bash
# Compute Environment を無効化
aws batch update-compute-environment \
  --compute-environment embedding-batch-compute-env \
  --state DISABLED

# 無効化の完了を待機
aws batch describe-compute-environments \
  --compute-environments embedding-batch-compute-env \
  --query 'computeEnvironments[0].status'

# 再有効化
aws batch update-compute-environment \
  --compute-environment embedding-batch-compute-env \
  --state ENABLED
```

#### B. ジョブキューの一時停止と再開
```bash
# ジョブキューを無効化
aws batch update-job-queue \
  --job-queue embedding-batch-job-queue \
  --state DISABLED

# 再有効化
aws batch update-job-queue \
  --job-queue embedding-batch-job-queue \
  --state ENABLED
```

### 3. 設定の修正

#### A. パラメータファイルの更新
```json
{
  "Parameters": [
    {
      "ParameterKey": "VpcId",
      "ParameterValue": "vpc-corrected-id"
    },
    {
      "ParameterKey": "SubnetIds",
      "ParameterValue": "subnet-12345678,subnet-87654321"
    },
    {
      "ParameterKey": "FsxFileSystemId",
      "ParameterValue": "fs-corrected-id"
    }
  ]
}
```

#### B. テンプレートの修正
```yaml
# リソース制限の調整
ComputeEnvironment:
  Type: AWS::Batch::ComputeEnvironment
  Properties:
    ComputeResources:
      MaxvCpus: !Ref MaxvCpus  # パラメータ化
      InstanceTypes:
        - !Ref InstanceType1
        - !Ref InstanceType2
```

---

## 📞 サポートへの連絡

### 問題報告時に含める情報

1. **基本情報**
   - AWSアカウントID
   - リージョン
   - スタック名
   - デプロイメント時刻

2. **エラー情報**
   ```bash
   # スタックイベントのエクスポート
   aws cloudformation describe-stack-events \
     --stack-name embedding-batch-workload \
     --output table > stack-events.txt
   
   # 失敗したリソースの詳細
   aws cloudformation describe-stack-resources \
     --stack-name embedding-batch-workload \
     --output json > stack-resources.json
   ```

3. **設定情報**
   - 使用したパラメータファイル
   - カスタマイズしたテンプレート部分
   - 環境固有の設定

4. **ログファイル**
   ```bash
   # 関連するCloudWatchログをダウンロード
   aws logs create-export-task \
     --log-group-name /aws/batch/job \
     --from $(date -d '1 day ago' +%s)000 \
     --to $(date +%s)000 \
     --destination embedding-batch-logs \
     --destination-prefix troubleshooting/
   ```

### サポートチャネル

- **GitHub Issues**: [プロジェクトのIssuesページ](https://github.com/your-org/embedding-batch-workload/issues)
- **AWS Support**: AWS Technical Support（有料プランの場合）
- **Community Forums**: AWS re:Post、Stack Overflow

### 緊急時の対応

1. **即座にスタックを停止**
   ```bash
   aws cloudformation cancel-update-stack --stack-name embedding-batch-workload
   ```

2. **実行中のジョブを停止**
   ```bash
   # 実行中のジョブを一覧表示
   aws batch list-jobs --job-queue embedding-batch-job-queue --job-status RUNNING
   
   # ジョブを停止
   aws batch cancel-job --job-id job-id-12345 --reason "Emergency stop"
   ```

3. **コスト制御**
   ```bash
   # Compute Environment を無効化してインスタンス起動を停止
   aws batch update-compute-environment \
     --compute-environment embedding-batch-compute-env \
     --state DISABLED
   ```

---

## 🔄 予防策

### 1. デプロイメント前のチェック

```bash
# 自動検証スクリプトの実行
./scripts/validate-cloudformation.sh --all --lint --security

# テンプレートの構文チェック
aws cloudformation validate-template --template-body file://template.yaml
```

### 2. 段階的デプロイメント

```bash
# 開発環境での事前テスト
aws cloudformation create-stack \
  --stack-name embedding-batch-workload-dev \
  --template-body file://template.yaml \
  --parameters file://dev-parameters.json

# 本番環境への適用前に変更セットで確認
aws cloudformation create-change-set \
  --stack-name embedding-batch-workload-prod \
  --change-set-name prod-update-$(date +%Y%m%d) \
  --template-body file://template.yaml \
  --parameters file://prod-parameters.json
```

### 3. 監視とアラートの設定

```bash
# CloudWatch アラームの設定
aws cloudwatch put-metric-alarm \
  --alarm-name "BatchJobFailures" \
  --alarm-description "Alert when batch jobs fail" \
  --metric-name FailedJobs \
  --namespace AWS/Batch \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold
```

---

このトラブルシューティングガイドを参考に、問題の迅速な解決を図ってください。追加の支援が必要な場合は、上記のサポートチャネルをご利用ください。