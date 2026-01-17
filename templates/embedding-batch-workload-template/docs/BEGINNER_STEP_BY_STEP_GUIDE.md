# 初心者向けステップバイステップガイド

## 📋 概要

このガイドは、Embedding Batch Workload Template を初めて使用する方のための完全なステップバイステップガイドです。AWS の基礎知識があれば、誰でもこのガイドに従ってデプロイできます。

## 🎯 このガイドの対象者

- AWS を初めて使用する方
- CDK や CloudFormation の経験が少ない方
- 段階的な手順を必要とする方
- 確実にデプロイを成功させたい方

## ⏱️ 所要時間

- **準備**: 30 分
- **デプロイ**: 20-30 分
- **検証**: 10 分
- **合計**: 約 60-70 分

## 📚 前提知識

このガイドを始める前に、以下の基礎知識があると理解しやすくなります：

- ✅ AWS アカウントの基本操作
- ✅ ターミナル（コマンドライン）の基本操作
- ✅ JSON ファイルの基本的な編集

## 🚀 ステップ 1: 環境準備（30 分）

### 1.1 AWS アカウントの準備

**必要なもの**:
- AWS アカウント
- 管理者権限または適切な IAM 権限

**確認方法**:
```bash
# AWS CLI が設定されているか確認
aws sts get-caller-identity
```

**期待される出力**:
```json
{
    "UserId": "AIDAI...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-name"
}
```

❌ **エラーが出た場合**:
```bash
# AWS CLI の設定
aws configure
# AWS Access Key ID: [あなたのアクセスキー]
# AWS Secret Access Key: [あなたのシークレットキー]
# Default region name: ap-northeast-1
# Default output format: json
```

---

### 1.2 必要なツールのインストール

#### Node.js のインストール

**macOS**:
```bash
# Homebrew を使用
brew install node@20

# バージョン確認
node --version  # v20.x.x が表示されればOK
```

**Linux (Ubuntu/Debian)**:
```bash
# Node.js 20.x をインストール
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# バージョン確認
node --version
```

**Windows**:
1. [Node.js 公式サイト](https://nodejs.org/)から LTS 版をダウンロード
2. インストーラーを実行
3. コマンドプロンプトで `node --version` を実行して確認

---

#### AWS CDK のインストール

```bash
# CDK をグローバルインストール
npm install -g aws-cdk

# バージョン確認
cdk --version  # 2.x.x が表示されればOK
```

---

#### Git のインストール

**macOS**:
```bash
brew install git
```

**Linux**:
```bash
sudo apt-get install git
```

**Windows**:
[Git 公式サイト](https://git-scm.com/)からダウンロードしてインストール

---

### 1.3 テンプレートのダウンロード

```bash
# リポジトリをクローン
git clone https://github.com/your-org/embedding-batch-workload.git

# ディレクトリに移動
cd embedding-batch-workload

# 依存関係をインストール
cd cdk
npm install
```

**確認**:
```bash
# ファイル構造を確認
ls -la
# 以下のディレクトリが表示されればOK:
# - cdk/
# - lambda/
# - scripts/
# - docs/
# - examples/
```

---

### 1.4 前提条件チェック

```bash
# 自動チェックスクリプトを実行
./scripts/check-prerequisites.sh --cdk
```

**期待される出力**:
```
✅ Node.js: v20.x.x
✅ AWS CLI: 2.x.x
✅ AWS CDK: 2.x.x
✅ Git: 2.x.x
✅ AWS 認証情報: 設定済み
✅ 全ての前提条件が満たされています
```

❌ **エラーが出た場合**:
- 各ツールのバージョンを確認
- インストール手順を再確認
- エラーメッセージに従って修正

---

## 🔧 ステップ 2: 設定ファイルの作成（15 分）

### 2.1 既存リソースの確認

まず、使用する VPC と FSx の情報を確認します。

#### VPC 情報の確認

```bash
# VPC 一覧を表示
aws ec2 describe-vpcs --query 'Vpcs[*].[VpcId,CidrBlock,Tags[?Key==`Name`].Value|[0]]' --output table
```

**出力例**:
```
-----------------------------------------
|           DescribeVpcs                |
+------------------+----------+---------+
|  vpc-0123456789  | 10.0.0.0/16 | MyVPC |
+------------------+----------+---------+
```

**メモ**: VPC ID（例: `vpc-0123456789`）を控えておきます。

---

#### サブネット情報の確認

```bash
# プライベートサブネット一覧を表示
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=vpc-0123456789" \
  --query 'Subnets[*].[SubnetId,AvailabilityZone,CidrBlock,Tags[?Key==`Name`].Value|[0]]' \
  --output table
```

**出力例**:
```
---------------------------------------------------------------
|                      DescribeSubnets                        |
+---------------------+------------------+------------+--------+
|  subnet-0123456789  | ap-northeast-1a  | 10.0.1.0/24 | Private-1a |
|  subnet-9876543210  | ap-northeast-1c  | 10.0.2.0/24 | Private-1c |
+---------------------+------------------+------------+--------+
```

**メモ**: プライベートサブネット ID を 2 つ以上控えておきます。

---

#### FSx 情報の確認

```bash
# FSx ファイルシステム一覧を表示
aws fsx describe-file-systems \
  --query 'FileSystems[*].[FileSystemId,FileSystemType,StorageCapacity,Tags[?Key==`Name`].Value|[0]]' \
  --output table
```

**出力例**:
```
---------------------------------------------------------
|              DescribeFileSystems                      |
+------------------+--------+------+---------------------+
|  fs-0123456789   | ONTAP  | 1024 | MyFSx              |
+------------------+--------+------+---------------------+
```

**メモ**: FSx ファイルシステム ID（例: `fs-0123456789`）を控えておきます。

---

### 2.2 設定ファイルの作成

#### 基本設定ファイルをコピー

```bash
# 例から設定ファイルを作成
cp examples/basic-config.json config/my-config.json
```

---

#### 設定ファイルの編集

テキストエディタで `config/my-config.json` を開きます：

```bash
# VS Code を使用する場合
code config/my-config.json

# vim を使用する場合
vim config/my-config.json

# nano を使用する場合
nano config/my-config.json
```

---

#### 必須項目の編集

以下の項目を、先ほど確認した情報で置き換えます：

```json
{
  "projectName": "my-embedding-project",  // ← あなたのプロジェクト名
  "environment": "dev",
  "region": "ap-northeast-1",  // ← あなたのリージョン
  
  "vpc": {
    "mode": "existing",
    "existing": {
      "vpcId": "vpc-0123456789",  // ← あなたの VPC ID
      "privateSubnetIds": [
        "subnet-0123456789",  // ← あなたのサブネット ID 1
        "subnet-9876543210"   // ← あなたのサブネット ID 2
      ]
    }
  },
  
  "fsx": {
    "mode": "existing",
    "existing": {
      "fileSystemId": "fs-0123456789",  // ← あなたの FSx ID
      "volumePath": "/vol1",
      "mountPoint": "/mnt/fsx"
    }
  }
}
```

**保存方法**:
- VS Code: `Ctrl+S` (Windows/Linux) または `Cmd+S` (macOS)
- vim: `:wq` を入力して Enter
- nano: `Ctrl+X` → `Y` → Enter

---

### 2.3 設定ファイルの検証

```bash
# 設定ファイルを検証
./scripts/validate-config.sh -f config/my-config.json --verbose
```

**期待される出力**:
```
✅ JSON 形式: 正常
✅ 必須フィールド: 全て存在
✅ プロジェクト名: 有効
✅ 環境名: 有効
✅ リージョン: 有効
✅ VPC 設定: 正常
✅ FSx 設定: 正常
✅ Batch 設定: 正常

✅ 設定ファイルは有効です
```

❌ **エラーが出た場合**:
- エラーメッセージを確認
- 該当する項目を修正
- 再度検証を実行

---

## 🚀 ステップ 3: デプロイ実行（20-30 分）

### 3.1 CDK Bootstrap（初回のみ）

**注意**: この手順は AWS アカウントとリージョンの組み合わせごとに 1 回だけ実行します。

```bash
# CDK Bootstrap を実行
cd cdk
cdk bootstrap aws://123456789012/ap-northeast-1
```

**期待される出力**:
```
 ✅  Environment aws://123456789012/ap-northeast-1 bootstrapped.
```

---

### 3.2 デプロイの実行

```bash
# プロジェクトルートに戻る
cd ..

# デプロイスクリプトを実行
./scripts/deploy.sh --config config/my-config.json --env dev --validate
```

**デプロイの進行状況**:
```
🔍 設定ファイルを検証中...
✅ 設定ファイルは有効です

🔍 デプロイ前チェックを実行中...
✅ AWS CLI: 設定済み
✅ CDK: インストール済み
✅ AWS 認証情報: 有効

📦 CDK スタックをビルド中...
✅ ビルド完了

🚀 デプロイを開始します...
```

**デプロイ中の表示**:
```
EmbeddingWorkloadStack: creating CloudFormation changeset...

 ✅  EmbeddingWorkloadStack

✨  Deployment time: 1234.56s

Outputs:
EmbeddingWorkloadStack.BatchComputeEnvironmentName = my-embedding-project-dev-compute-env
EmbeddingWorkloadStack.BatchJobQueueName = my-embedding-project-dev-queue
EmbeddingWorkloadStack.DocumentProcessingJobDefinition = my-embedding-project-dev-doc-processor:1
```

**所要時間**: 約 20-30 分

---

### 3.3 デプロイ結果の確認

```bash
# スタック情報を確認
aws cloudformation describe-stacks \
  --stack-name EmbeddingWorkloadStack \
  --query 'Stacks[0].StackStatus' \
  --output text
```

**期待される出力**:
```
CREATE_COMPLETE
```

---

## ✅ ステップ 4: 動作確認（10 分）

### 4.1 リソースの確認

#### Batch コンピュート環境の確認

```bash
# コンピュート環境を確認
aws batch describe-compute-environments \
  --compute-environments my-embedding-project-dev-compute-env \
  --query 'computeEnvironments[0].status' \
  --output text
```

**期待される出力**:
```
VALID
```

---

#### ジョブキューの確認

```bash
# ジョブキューを確認
aws batch describe-job-queues \
  --job-queues my-embedding-project-dev-queue \
  --query 'jobQueues[0].state' \
  --output text
```

**期待される出力**:
```
ENABLED
```

---

### 4.2 テストジョブの実行

```bash
# テストジョブを投入
aws batch submit-job \
  --job-name test-job-$(date +%s) \
  --job-queue my-embedding-project-dev-queue \
  --job-definition my-embedding-project-dev-doc-processor:1 \
  --parameters inputPath=s3://test-bucket/test.txt
```

**期待される出力**:
```json
{
    "jobArn": "arn:aws:batch:...",
    "jobName": "test-job-1699999999",
    "jobId": "12345678-1234-1234-1234-123456789012"
}
```

---

#### ジョブ状態の確認

```bash
# ジョブ ID を使用して状態を確認
aws batch describe-jobs \
  --jobs 12345678-1234-1234-1234-123456789012 \
  --query 'jobs[0].status' \
  --output text
```

**期待される状態の遷移**:
1. `SUBMITTED` - ジョブが投入された
2. `PENDING` - リソース待ち
3. `RUNNABLE` - 実行可能
4. `STARTING` - 起動中
5. `RUNNING` - 実行中
6. `SUCCEEDED` - 成功

---

### 4.3 ログの確認

```bash
# CloudWatch Logs でログを確認
aws logs tail /aws/batch/job --follow
```

**期待されるログ**:
```
2025-11-09 10:00:00 [INFO] Job started
2025-11-09 10:00:05 [INFO] Processing document...
2025-11-09 10:00:10 [INFO] Job completed successfully
```

---

## 🎉 完了！

おめでとうございます！Embedding Batch Workload Template のデプロイが完了しました。

### 次のステップ

1. **実際のデータで試す**
   - 自分の文書をアップロード
   - 埋め込み生成ジョブを実行
   - 結果を確認

2. **設定をカスタマイズ**
   - [使用例とベストプラクティス](./USAGE_EXAMPLES_BEST_PRACTICES.md)を参照
   - 環境に合わせて設定を調整

3. **監視を設定**
   - CloudWatch ダッシュボードを確認
   - アラートを設定

4. **本番環境へ**
   - 本番用の設定ファイルを作成
   - セキュリティ設定を強化
   - 本番環境にデプロイ

---

## ❓ トラブルシューティング

### よくある問題と解決方法

#### 問題 1: デプロイが失敗する

**症状**:
```
❌ EmbeddingWorkloadStack failed: Resource creation failed
```

**解決方法**:
1. エラーメッセージを確認
2. CloudFormation コンソールでスタックイベントを確認
3. [トラブルシューティングガイド](./TROUBLESHOOTING_GUIDE.md)を参照

---

#### 問題 2: ジョブが RUNNABLE で止まる

**症状**:
ジョブが `RUNNABLE` 状態から進まない

**解決方法**:
1. コンピュート環境の状態を確認
2. サブネットの設定を確認
3. セキュリティグループを確認

```bash
# コンピュート環境の詳細を確認
aws batch describe-compute-environments \
  --compute-environments my-embedding-project-dev-compute-env
```

---

#### 問題 3: 権限エラー

**症状**:
```
AccessDenied: User is not authorized to perform...
```

**解決方法**:
1. IAM ユーザーの権限を確認
2. 必要な権限を付与
3. AWS CLI の認証情報を再設定

---

## 📚 参考資料

### 公式ドキュメント
- [AWS Batch ユーザーガイド](https://docs.aws.amazon.com/batch/)
- [AWS CDK ドキュメント](https://docs.aws.amazon.com/cdk/)
- [Amazon FSx ドキュメント](https://docs.aws.amazon.com/fsx/)

### プロジェクトドキュメント
- [TypeScript インターフェースリファレンス](./TYPESCRIPT_INTERFACES_REFERENCE.md)
- [設定パラメータリファレンス](./CONFIGURATION_PARAMETERS_REFERENCE.md)
- [使用例とベストプラクティス](./USAGE_EXAMPLES_BEST_PRACTICES.md)
- [FAQ](./FAQ.md)

---

## 💬 サポート

質問や問題がある場合:

1. [FAQ](./FAQ.md)を確認
2. [GitHub Issues](https://github.com/your-org/embedding-batch-workload/issues)で検索
3. 新しい Issue を作成

---

**最終更新**: 2025年11月9日  
**バージョン**: 2.0.0
