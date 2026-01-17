# SQLite Embedding負荷試験 デプロイメントガイド

## 概要

このガイドでは、FSx for ONTAP上でのSQLite負荷試験とEmbedding処理を統合したシステムのデプロイ方法を説明します。

## 前提条件

### 必要なリソース

1. **FSx for ONTAP ファイルシステム**
   - ファイルシステムID
   - SVM ID
   - ボリュームID（SQLite負荷試験用）
   - NFSエンドポイント
   - CIFS共有（Windows負荷試験用）

2. **VPC環境**
   - VPC ID
   - プライベートサブネット（最低2つ）
   - パブリックサブネット（踏み台サーバー用）

3. **IAMロール**
   - AWS Batch Service Role
   - ECS Instance Role
   - EventBridge Role

4. **EC2キーペア**（Windows負荷試験用）

### 必要なツール

- AWS CLI v2
- Node.js 20+
- AWS CDK v2
- TypeScript

## デプロイ手順

### 1. 設定ファイルの準備

```bash
# 設定ファイルをコピー
cp examples/sqlite-embedding-config.json config/sqlite-embedding-config.json

# 設定を環境に合わせて編集
vi config/sqlite-embedding-config.json
```

### 2. 必要な設定項目

```json
{
  "projectName": "your-project-name",
  "environment": "dev|staging|prod",
  "region": "ap-northeast-1",
  "vpc": {
    "vpcId": "vpc-xxxxxxxxx",
    "privateSubnetIds": ["subnet-xxxxxxxxx", "subnet-yyyyyyyyy"],
    "publicSubnetIds": ["subnet-zzzzzzzzz"]
  },
  "fsx": {
    "fileSystemId": "fs-xxxxxxxxx",
    "svmId": "svm-xxxxxxxxx",
    "volumeId": "fsvol-xxxxxxxxx",
    "mountPath": "/sqlite-load-test",
    "nfsEndpoint": "svm-xxx.fs-xxx.fsx.region.amazonaws.com",
    "cifsEndpoint": "10.x.x.x",
    "cifsShareName": "sqlite-load-test"
  },
  "windowsLoadTest": {
    "keyPairName": "your-keypair-name"
  }
}
```

### 3. CDKデプロイ

```bash
# 依存関係のインストール
npm install

# CDKブートストラップ（初回のみ）
cdk bootstrap

# 設定の検証
npm run validate-config

# デプロイ実行
cdk deploy --context configFile=config/sqlite-embedding-config.json
```

### 4. デプロイ後の確認

```bash
# AWS Batchリソースの確認
aws batch describe-compute-environments
aws batch describe-job-queues
aws batch describe-job-definitions

# EventBridgeルールの確認
aws events list-rules --name-prefix sqlite-embedding

# EC2インスタンスの確認（Windows負荷試験が有効な場合）
aws ec2 describe-instances --filters "Name=tag:Component,Values=WindowsSQLiteLoadTest"
```

## 使用方法

### オンデマンド実行

```bash
# SQLite負荷試験ジョブの手動実行
aws batch submit-job \
  --job-name "sqlite-embedding-manual-$(date +%Y%m%d%H%M%S)" \
  --job-queue "your-project-dev-sqlite-job-queue" \
  --job-definition "your-project-dev-sqlite-embedding-job-def"
```

### 定期実行

- EventBridgeルールにより毎日午前2時（UTC）に自動実行
- スケジュール変更は設定ファイルの `scheduledExecution.scheduleExpression` を編集

### Windows負荷試験

1. **RDP接続**
   ```bash
   # 踏み台サーバー経由でWindows EC2にRDP接続
   # パスワードはAWS EC2コンソールから取得
   ```

2. **CIFS共有マウント**
   ```powershell
   # PowerShellでCIFS共有をマウント
   & "C:\SQLiteLoadTest\mount_fsx.ps1"
   ```

3. **負荷試験実行**
   ```powershell
   # 簡単な負荷試験
   & "C:\SQLiteLoadTest\run_quick_test.ps1"
   
   # カスタム負荷試験
   python "C:\SQLiteLoadTest\unique_constraint_test.py" "Z:\test.db" 20 5000
   ```

## 監視とログ

### CloudWatch Logs

```bash
# Batchジョブのログ確認
aws logs describe-log-groups --log-group-name-prefix "/aws/batch"
aws logs get-log-events --log-group-name "/aws/batch/your-project-dev-sqlite-embedding"
```

### メトリクス監視

- AWS Batch ジョブの成功/失敗率
- 実行時間
- リソース使用量
- FSx for ONTAP パフォーマンスメトリクス

## トラブルシューティング

### よくある問題

1. **Batchジョブが開始されない**
   ```bash
   # コンピュート環境の状態確認
   aws batch describe-compute-environments
   
   # IAMロールの権限確認
   aws iam get-role --role-name AWSBatchServiceRole
   ```

2. **FSxマウントエラー**
   ```bash
   # セキュリティグループの確認
   aws ec2 describe-security-groups --group-ids sg-xxxxxxxxx
   
   # NFSポート（2049）が開放されているか確認
   ```

3. **Windows RDP接続エラー**
   ```bash
   # インスタンス状態の確認
   aws ec2 describe-instances --instance-ids i-xxxxxxxxx
   
   # セキュリティグループでRDP（3389）が許可されているか確認
   ```

### ログの確認

```bash
# Batchジョブの詳細ログ
aws batch describe-jobs --jobs JOB_ID

# CloudWatch Logsでエラー詳細を確認
aws logs filter-log-events \
  --log-group-name "/aws/batch/your-project-dev-sqlite-embedding" \
  --filter-pattern "ERROR"
```

## カスタマイズ

### ジョブ定義の変更

1. `lib/modules/embedding/constructs/sqlite-load-test.ts` を編集
2. `generateJobCommand()` メソッドでスクリプト内容を変更
3. CDK再デプロイ

### スケジュール変更

```json
{
  "scheduledExecution": {
    "scheduleExpression": "cron(0 */6 * * ? *)"  // 6時間毎に実行
  }
}
```

### リソース調整

```json
{
  "batch": {
    "embeddingEnvironment": {
      "maxvCpus": 50,  // 最大vCPU数を増加
      "instanceTypes": ["m5.2xlarge", "m5.4xlarge"]  // より大きなインスタンス
    }
  }
}
```

## セキュリティ考慮事項

1. **IAM権限の最小化**
   - 必要最小限の権限のみ付与
   - リソースベースのポリシー使用

2. **ネットワークセキュリティ**
   - プライベートサブネットでの実行
   - セキュリティグループによる通信制限

3. **データ暗号化**
   - FSx for ONTAP暗号化有効化
   - S3バケット暗号化
   - EBS暗号化

4. **ログ管理**
   - CloudWatch Logsでの集中管理
   - ログ保持期間の設定

## コスト最適化

1. **Spot インスタンス使用**
   ```json
   {
     "batch": {
       "embeddingEnvironment": {
         "enableSpotInstances": true
       }
     }
   }
   ```

2. **リソース自動スケーリング**
   - 最小vCPU: 0（アイドル時のコスト削減）
   - 最大vCPU: 必要に応じて調整

3. **ログ保持期間の最適化**
   ```json
   {
     "monitoring": {
       "logRetentionDays": 7  // 短期間での削除
     }
   }
   ```

## 更新とメンテナンス

### 設定更新

```bash
# 設定ファイル更新後の再デプロイ
cdk diff --context configFile=config/sqlite-embedding-config.json
cdk deploy --context configFile=config/sqlite-embedding-config.json
```

### バージョン管理

- 設定ファイルはGitで管理
- 環境別設定ファイルの分離
- デプロイ履歴の記録

## サポート

### ドキュメント

- [AWS Batch ユーザーガイド](https://docs.aws.amazon.com/batch/)
- [FSx for ONTAP ユーザーガイド](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/)
- [EventBridge ユーザーガイド](https://docs.aws.amazon.com/eventbridge/)

### 問い合わせ

技術的な問題や質問については、プロジェクトのIssueトラッカーまたは開発チームにお問い合わせください。