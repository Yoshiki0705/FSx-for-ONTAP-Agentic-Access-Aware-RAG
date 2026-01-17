# 📚 ステップバイステップガイド / Step-by-Step Guide

## 📋 概要 / Overview

このガイドでは、FSx for NetApp ONTAP Embedding Batch Workloadを段階的にデプロイし、実際に動作させるまでの手順を詳しく説明します。

This guide provides detailed step-by-step instructions for deploying and running the FSx for NetApp ONTAP Embedding Batch Workload.

## 🎯 学習目標 / Learning Objectives

このガイドを完了すると、以下ができるようになります：

- Embedding Batch Workloadの基本概念を理解
- CDKまたはCloudFormationでのデプロイメント
- サンプルジョブの実行と結果確認
- 基本的なトラブルシューティング
- リソースの適切なクリーンアップ

## ⏱️ 所要時間 / Time Required

- **初回セットアップ**: 30-45分
- **デプロイメント**: 15-20分
- **サンプル実行**: 10-15分
- **クリーンアップ**: 5-10分

**合計**: 約60-90分

## 📋 前提条件 / Prerequisites

### 必要なツール / Required Tools

| ツール / Tool | バージョン / Version | インストール方法 / Installation |
|---------------|---------------------|--------------------------------|
| AWS CLI | 2.x+ | [AWS CLI インストールガイド](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
| Node.js | 18.x+ | [Node.js 公式サイト](https://nodejs.org/) |
| jq | 1.6+ | `brew install jq` (macOS) / `apt install jq` (Ubuntu) |

### AWS要件 / AWS Requirements

- **AWSアカウント**: 有効なAWSアカウント
- **IAM権限**: 管理者権限または必要な権限セット
- **リージョン**: Bedrock対応リージョン（推奨: us-east-1）
- **サービス制限**: 十分なサービス制限

### 推定コスト / Estimated Costs

| リソース / Resource | 時間単価 / Hourly Cost | 説明 / Description |
|-------------------|----------------------|-------------------|
| FSx for ONTAP (1TB) | ~$0.20 | 高性能ファイルストレージ |
| AWS Batch (t3.small x2) | ~$0.04 | コンピュート環境 |
| DynamoDB | ~$0.01 | メタデータストレージ |
| S3 | ~$0.01 | オブジェクトストレージ |
| その他 | ~$0.04 | ログ、監視など |
| **合計** | **~$0.30/時間** | **約$7.20/日** |

## 🚀 ステップ1: 環境準備 / Step 1: Environment Setup

### 1.1 プロジェクトのダウンロード

```bash
# GitHubからプロジェクトをクローン
git clone https://github.com/your-org/embedding-batch-workload.git
cd embedding-batch-workload

# または、リリースパッケージをダウンロード
wget https://github.com/your-org/embedding-batch-workload/releases/latest/download/embedding-batch-workload-v1.0.0.tar.gz
tar -xzf embedding-batch-workload-v1.0.0.tar.gz
cd embedding-batch-workload
```

### 1.2 前提条件の確認

```bash
# 前提条件チェックスクリプト実行
./scripts/check-prerequisites.sh

# 出力例:
# ✅ AWS CLI: 2.13.0
# ✅ Node.js: 18.17.0
# ✅ npm: 9.6.7
# ✅ AWS認証: 設定済み
# ✅ 前提条件チェック完了
```

### 1.3 AWS認証の設定

```bash
# AWS認証情報を設定（未設定の場合）
aws configure

# 設定内容確認
aws sts get-caller-identity

# 出力例:
# {
#     "UserId": "AIDACKCEVSQ6C2EXAMPLE",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/username"
# }
```

## 🎯 ステップ2: デプロイメント方式の選択 / Step 2: Choose Deployment Method

### 2.1 方式比較

| 項目 / Aspect | CDK | CloudFormation |
|---------------|-----|----------------|
| **学習コスト** | 高 | 低 |
| **柔軟性** | 高 | 中 |
| **保守性** | 高 | 中 |
| **可視性** | 中 | 高 |
| **推奨用途** | 開発・継続的変更 | 運用・安定環境 |

### 2.2 選択ガイド

**CDKを選ぶべき場合:**
- TypeScript/JavaScript開発者がいる
- 継続的な開発・変更が必要
- プログラマティックな設定が必要

**CloudFormationを選ぶべき場合:**
- インフラ運用者中心のチーム
- 安定した本番環境
- AWSコンソールでの管理を好む

## 🔧 ステップ3A: CDKデプロイメント / Step 3A: CDK Deployment

### 3A.1 CDK環境のセットアップ

```bash
# CDKディレクトリに移動
cd cdk

# 依存関係インストール
npm install

# TypeScriptビルド
npm run build

# CDKバージョン確認
npx cdk --version
```

### 3A.2 設定ファイルの作成

```bash
# 基本設定をコピー
cp examples/basic-config.json config/my-deployment.json

# 設定ファイルを編集
vim config/my-deployment.json
```

**設定例:**
```json
{
  "projectName": "my-embedding-project",
  "environment": "dev",
  "region": "us-east-1",
  "vpc": {
    "createNew": true,
    "cidrBlock": "10.0.0.0/16"
  },
  "fsx": {
    "createNew": true,
    "storageCapacity": 1024,
    "throughputCapacity": 128
  },
  "batch": {
    "maxvCpus": 50,
    "instanceTypes": ["m5.large", "m5.xlarge"],
    "enableSpotInstances": true
  }
}
```

### 3A.3 CDKブートストラップ

```bash
# CDKブートストラップ（初回のみ）
npx cdk bootstrap

# 出力例:
# ⏳ Bootstrapping environment aws://123456789012/us-east-1...
# ✅ Environment aws://123456789012/us-east-1 bootstrapped.
```

### 3A.4 デプロイメント実行

```bash
# 統一デプロイメントスクリプト使用
cd ..
./scripts/unified-deploy.sh \
  --method cdk \
  --env dev \
  --config config/my-deployment.json \
  --validate

# または、CDK直接実行
cd cdk
CDK_CONFIG_FILE="../config/my-deployment.json" npx cdk deploy
```

## ☁️ ステップ3B: CloudFormationデプロイメント / Step 3B: CloudFormation Deployment

### 3B.1 パラメータファイルの準備

```bash
# 基本パラメータをコピー
cp examples/cloudformation/basic-parameters.json parameters/my-parameters.json

# パラメータファイルを編集
vim parameters/my-parameters.json
```

**パラメータ例:**
```json
[
  {
    "ParameterKey": "ProjectName",
    "ParameterValue": "my-embedding-project"
  },
  {
    "ParameterKey": "Environment",
    "ParameterValue": "dev"
  },
  {
    "ParameterKey": "VpcId",
    "ParameterValue": "vpc-12345678"
  },
  {
    "ParameterKey": "SubnetIds",
    "ParameterValue": "subnet-12345678,subnet-87654321"
  }
]
```

### 3B.2 テンプレート検証

```bash
# CloudFormationテンプレート検証
./scripts/validate-cloudformation.sh \
  --template cloudformation-templates/EmbeddingWorkloadStack.template.json \
  --parameters parameters/my-parameters.json
```

### 3B.3 デプロイメント実行

```bash
# 統一デプロイメントスクリプト使用
./scripts/unified-deploy.sh \
  --method cloudformation \
  --env dev \
  --validate

# または、AWS CLI直接実行
aws cloudformation create-stack \
  --stack-name my-embedding-project-dev \
  --template-body file://cloudformation-templates/EmbeddingWorkloadStack.template.json \
  --parameters file://parameters/my-parameters.json \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM
```

## 📊 ステップ4: デプロイメント確認 / Step 4: Verify Deployment

### 4.1 スタック状態確認

```bash
# CloudFormationスタック確認
aws cloudformation describe-stacks \
  --stack-name my-embedding-project-dev \
  --query 'Stacks[0].StackStatus'

# 期待される出力: "CREATE_COMPLETE"
```

### 4.2 リソース確認

```bash
# 作成されたリソース一覧
aws cloudformation describe-stack-resources \
  --stack-name my-embedding-project-dev \
  --query 'StackResources[].[ResourceType,LogicalResourceId,ResourceStatus]' \
  --output table
```

### 4.3 出力値確認

```bash
# スタック出力値確認
aws cloudformation describe-stacks \
  --stack-name my-embedding-project-dev \
  --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' \
  --output table
```

### 4.4 検証スクリプト実行

```bash
# 包括的検証
./scripts/validate.sh --env dev --stack-name my-embedding-project-dev

# 出力例:
# ✅ スタック状態: CREATE_COMPLETE
# ✅ Batchコンピュート環境: VALID
# ✅ FSxファイルシステム: AVAILABLE
# ✅ DynamoDBテーブル: ACTIVE
# ✅ S3バケット: 作成済み
# ✅ 全ての検証が完了しました
```

## 🧪 ステップ5: サンプルジョブ実行 / Step 5: Run Sample Jobs

### 5.1 サンプルデータ準備

```bash
# サンプルデータディレクトリ作成
mkdir -p sample-data

# サンプル文書作成
cat > sample-data/document1.txt << 'EOF'
Amazon FSx for NetApp ONTAP is a fully managed service that provides highly reliable, scalable, high-performing, and feature-rich file storage built on NetApp's popular ONTAP file system.
EOF

cat > sample-data/document2.txt << 'EOF'
AWS Batch enables developers, scientists, and engineers to easily and efficiently run hundreds of thousands of batch computing jobs on AWS.
EOF

cat > sample-data/document3.txt << 'EOF'
Amazon Bedrock is a fully managed service that offers a choice of high-performing foundation models from leading AI companies.
EOF
```

### 5.2 S3にアップロード

```bash
# S3バケット名取得
S3_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name my-embedding-project-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
  --output text)

# サンプルデータをS3にアップロード
aws s3 cp sample-data/ s3://$S3_BUCKET/input/ --recursive

# アップロード確認
aws s3 ls s3://$S3_BUCKET/input/
```

### 5.3 Batchジョブ実行

```bash
# ジョブキュー名取得
JOB_QUEUE=$(aws cloudformation describe-stacks \
  --stack-name my-embedding-project-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`JobQueueArn`].OutputValue' \
  --output text | cut -d'/' -f2)

# ジョブ定義ARN取得
JOB_DEFINITION=$(aws cloudformation describe-stacks \
  --stack-name my-embedding-project-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`JobDefinitionArn`].OutputValue' \
  --output text)

# 文書処理ジョブ実行
JOB_ID=$(aws batch submit-job \
  --job-name "document-processing-$(date +%s)" \
  --job-queue "$JOB_QUEUE" \
  --job-definition "$JOB_DEFINITION" \
  --parameters inputPath="s3://$S3_BUCKET/input/",outputPath="s3://$S3_BUCKET/output/" \
  --query 'jobId' \
  --output text)

echo "ジョブID: $JOB_ID"
```

### 5.4 ジョブ状態監視

```bash
# ジョブ状態確認
aws batch describe-jobs --jobs $JOB_ID \
  --query 'jobs[0].[jobName,jobStatus,statusReason]' \
  --output table

# ジョブ完了まで待機
aws batch wait job-completed --jobs $JOB_ID

# ジョブログ確認
LOG_STREAM=$(aws batch describe-jobs --jobs $JOB_ID \
  --query 'jobs[0].attempts[0].logStreamName' \
  --output text)

aws logs get-log-events \
  --log-group-name /aws/batch/job \
  --log-stream-name $LOG_STREAM \
  --query 'events[].[timestamp,message]' \
  --output table
```

### 5.5 結果確認

```bash
# 出力結果確認
aws s3 ls s3://$S3_BUCKET/output/

# 結果ファイルダウンロード
aws s3 cp s3://$S3_BUCKET/output/ ./results/ --recursive

# 結果表示
ls -la results/
cat results/embeddings.json | jq '.[0]' # 最初の埋め込み結果表示
```

## 📊 ステップ6: 監視とログ確認 / Step 6: Monitoring and Logs

### 6.1 CloudWatchダッシュボード

```bash
# ダッシュボードURL取得
DASHBOARD_URL=$(aws cloudformation describe-stacks \
  --stack-name my-embedding-project-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`DashboardUrl`].OutputValue' \
  --output text)

echo "CloudWatchダッシュボード: $DASHBOARD_URL"
```

### 6.2 メトリクス確認

```bash
# Batchジョブメトリクス
aws cloudwatch get-metric-statistics \
  --namespace AWS/Batch \
  --metric-name SubmittedJobs \
  --dimensions Name=JobQueue,Value=$JOB_QUEUE \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# FSxメトリクス
aws cloudwatch get-metric-statistics \
  --namespace AWS/FSx \
  --metric-name DataReadBytes \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### 6.3 ログ分析

```bash
# 最新のログエントリ確認
aws logs describe-log-groups \
  --log-group-name-prefix /aws/batch/job

# エラーログ検索
aws logs filter-log-events \
  --log-group-name /aws/batch/job \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s)000
```

## 🔧 ステップ7: トラブルシューティング / Step 7: Troubleshooting

### 7.1 よくある問題

#### 問題1: FSxマウントエラー

```bash
# FSx状態確認
aws fsx describe-file-systems \
  --query 'FileSystems[0].[FileSystemId,Lifecycle,DNSName]' \
  --output table

# セキュリティグループ確認
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=*fsx*" \
  --query 'SecurityGroups[].[GroupId,GroupName]' \
  --output table
```

**解決方法:**
- FSxファイルシステムが`AVAILABLE`状態であることを確認
- セキュリティグループでNFSポート(2049)が開いていることを確認

#### 問題2: Batchジョブ失敗

```bash
# 失敗したジョブの詳細確認
aws batch describe-jobs --jobs $JOB_ID \
  --query 'jobs[0].[jobStatus,statusReason,attempts[0].exitCode]' \
  --output table

# コンピュート環境確認
aws batch describe-compute-environments \
  --query 'computeEnvironments[].[computeEnvironmentName,state,status]' \
  --output table
```

**解決方法:**
- IAMロールの権限を確認
- コンピュート環境が`VALID`状態であることを確認
- ジョブ定義のリソース要件を確認

#### 問題3: 権限エラー

```bash
# IAMロール確認
aws iam get-role --role-name EmbeddingBatchJobRole

# 権限シミュレーション
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:role/EmbeddingBatchJobRole \
  --action-names s3:GetObject \
  --resource-arns arn:aws:s3:::my-bucket/*
```

### 7.2 診断スクリプト

```bash
# 包括的診断実行
./scripts/diagnose.sh --stack-name my-embedding-project-dev

# 特定コンポーネント診断
./scripts/diagnose.sh --component batch --stack-name my-embedding-project-dev
```

## 🧹 ステップ8: クリーンアップ / Step 8: Cleanup

### 8.1 リソース削除前の確認

```bash
# 削除対象リソース確認
aws cloudformation describe-stack-resources \
  --stack-name my-embedding-project-dev \
  --query 'StackResources[].[ResourceType,PhysicalResourceId]' \
  --output table

# 推定削除時間: 10-15分
```

### 8.2 データバックアップ（オプション）

```bash
# 重要なデータをバックアップ
aws s3 sync s3://$S3_BUCKET/output/ ./backup/

# DynamoDBデータエクスポート
aws dynamodb scan --table-name MyEmbeddingTable > backup/dynamodb-data.json
```

### 8.3 スタック削除

```bash
# CloudFormationスタック削除
aws cloudformation delete-stack --stack-name my-embedding-project-dev

# 削除完了まで待機
aws cloudformation wait stack-delete-complete --stack-name my-embedding-project-dev

# 削除確認
aws cloudformation describe-stacks --stack-name my-embedding-project-dev
# 期待される結果: スタックが見つからないエラー
```

### 8.4 残存リソース確認

```bash
# S3バケット確認（手動削除が必要な場合）
aws s3 ls | grep embedding

# FSxファイルシステム確認
aws fsx describe-file-systems \
  --query 'FileSystems[?contains(Tags[?Key==`Project`].Value, `embedding`)]'

# 手動削除が必要なリソースがある場合
# aws s3 rb s3://bucket-name --force
# aws fsx delete-file-system --file-system-id fs-xxxxxxxxx
```

## 🎓 次のステップ / Next Steps

### 学習リソース

1. **詳細ドキュメント**
   - [アーキテクチャガイド](../docs/CDK_ARCHITECTURE_GUIDE.md)
   - [設定ガイド](../docs/CONFIGURATION_GUIDE.md)
   - [トラブルシューティング](../docs/CDK_TROUBLESHOOTING_GUIDE.md)

2. **高度な設定**
   - [エンタープライズ設定](../examples/enterprise-config.json)
   - [マルチリージョン設定](../examples/multi-region-config.json)
   - [ハイブリッドクラウド設定](../examples/cdk/hybrid-cloud-config.json)

3. **カスタマイズ**
   - Lambda関数の修正
   - CDK構成の調整
   - 独自のジョブ定義作成

### コミュニティ参加

- **GitHub Issues**: バグ報告・機能要求
- **GitHub Discussions**: 質問・議論
- **コントリビューション**: [CONTRIBUTING.md](../CONTRIBUTING.md)

## ❓ FAQ / よくある質問

### Q1: デプロイメントにどのくらい時間がかかりますか？

**A**: 通常15-20分程度です。FSxファイルシステムの作成に最も時間がかかります。

### Q2: コストを最小限に抑える方法は？

**A**: 
- スポットインスタンスを有効化
- 不要時にはスタックを削除
- 小さなインスタンスタイプを使用
- ログ保持期間を短縮

### Q3: 本番環境で使用する際の注意点は？

**A**:
- 適切なバックアップ戦略を実装
- 監視・アラートを設定
- セキュリティ設定を強化
- 災害復旧計画を策定

### Q4: 他のAIモデルを使用できますか？

**A**: はい。Bedrock設定でmodelIdを変更することで、他のTitanモデルやサードパーティモデルを使用できます。

### Q5: オンプレミスとの統合は可能ですか？

**A**: はい。VPN接続やDirect Connectを使用してハイブリッド構成が可能です。[ハイブリッドクラウド設定例](../examples/cdk/hybrid-cloud-config.json)を参照してください。

---

## 📞 サポート / Support

このガイドでわからないことがあれば：

1. **ドキュメント**: [docs/](../docs/) ディレクトリの詳細ガイド
2. **GitHub Issues**: バグ報告・質問
3. **GitHub Discussions**: コミュニティディスカッション
4. **Email**: support@your-org.com

**Happy Embedding!** 🚀