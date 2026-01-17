# 🔧 CDK トラブルシューティングガイド / CDK Troubleshooting Guide

## 📋 概要 / Overview

このガイドでは、FSx for NetApp ONTAP Embedding Batch WorkloadのCDKデプロイメント時によく発生する問題と解決方法を説明します。

This guide explains common issues and solutions when deploying the FSx for NetApp ONTAP Embedding Batch Workload with CDK.

## 🚨 よくある問題と解決方法 / Common Issues and Solutions

### 1. CDK ブートストラップ関連 / CDK Bootstrap Issues

#### 問題: ブートストラップが必要 / Issue: Bootstrap Required

**エラーメッセージ / Error Message:**
```
This stack uses assets, so the toolkit stack must be deployed to the environment
```

**原因 / Cause:**
CDKがまだブートストラップされていない

**解決方法 / Solution:**
```bash
# 現在のアカウント・リージョンでブートストラップ
npx cdk bootstrap

# 特定のアカウント・リージョンでブートストラップ
npx cdk bootstrap aws://123456789012/ap-northeast-1
```

#### 問題: ブートストラップバージョン不一致 / Issue: Bootstrap Version Mismatch

**エラーメッセージ / Error Message:**
```
This CDK deployment requires bootstrap stack version 'X', found 'Y'
```

**解決方法 / Solution:**
```bash
# ブートストラップを最新バージョンに更新
npx cdk bootstrap --force
```

### 2. IAM 権限関連 / IAM Permission Issues

#### 問題: IAM ロール作成権限不足 / Issue: Insufficient IAM Role Creation Permissions

**エラーメッセージ / Error Message:**
```
User: arn:aws:iam::123456789012:user/username is not authorized to perform: iam:CreateRole
```

**必要な権限 / Required Permissions:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:PassRole",
        "iam:CreateInstanceProfile",
        "iam:AddRoleToInstanceProfile",
        "iam:RemoveRoleFromInstanceProfile",
        "iam:DeleteInstanceProfile"
      ],
      "Resource": "*"
    }
  ]
}
```

**解決方法 / Solution:**
1. 管理者に上記権限の付与を依頼
2. または、事前に作成済みのIAMロールを使用する設定に変更

#### 問題: サービスリンクロール不足 / Issue: Missing Service-Linked Roles

**エラーメッセージ / Error Message:**
```
The service-linked role for AWS Batch does not exist
```

**解決方法 / Solution:**
```bash
# AWS Batch サービスリンクロール作成
aws iam create-service-linked-role --aws-service-name batch.amazonaws.com

# EC2 Spot Fleet サービスリンクロール作成
aws iam create-service-linked-role --aws-service-name spot.amazonaws.com
```

### 3. VPC・ネットワーク関連 / VPC and Network Issues

#### 問題: VPC が見つからない / Issue: VPC Not Found

**エラーメッセージ / Error Message:**
```
The vpc 'vpc-xxxxxxxxx' does not exist
```

**解決方法 / Solution:**
```bash
# VPC の存在確認
aws ec2 describe-vpcs --vpc-ids vpc-xxxxxxxxx

# 設定ファイルのVPC IDを確認・修正
vim config/deployment-config.json
```

#### 問題: サブネット設定エラー / Issue: Subnet Configuration Error

**エラーメッセージ / Error Message:**
```
The subnet 'subnet-xxxxxxxxx' does not exist in VPC 'vpc-yyyyyyyyy'
```

**解決方法 / Solution:**
```bash
# サブネット情報確認
aws ec2 describe-subnets --subnet-ids subnet-xxxxxxxxx

# VPC内のサブネット一覧取得
aws ec2 describe-subnets --filters "Name=vpc-id,Values=vpc-yyyyyyyyy"
```

#### 問題: アベイラビリティゾーン不足 / Issue: Insufficient Availability Zones

**エラーメッセージ / Error Message:**
```
Cannot create the cluster; at least 2 subnets in different AZs are required
```

**解決方法 / Solution:**
```bash
# 利用可能なAZ確認
aws ec2 describe-availability-zones --region ap-northeast-1

# 設定で複数AZのサブネットを指定
```

### 4. FSx for NetApp ONTAP 関連 / FSx for NetApp ONTAP Issues

#### 問題: FSx ファイルシステムが見つからない / Issue: FSx File System Not Found

**エラーメッセージ / Error Message:**
```
The file system 'fs-xxxxxxxxx' does not exist
```

**解決方法 / Solution:**
```bash
# FSx ファイルシステム確認
aws fsx describe-file-systems --file-system-ids fs-xxxxxxxxx

# リージョン確認
aws fsx describe-file-systems --region ap-northeast-1
```

#### 問題: FSx SVM が見つからない / Issue: FSx SVM Not Found

**エラーメッセージ / Error Message:**
```
The storage virtual machine 'svm-xxxxxxxxx' does not exist
```

**解決方法 / Solution:**
```bash
# SVM 一覧確認
aws fsx describe-storage-virtual-machines --filters "Name=file-system-id,Values=fs-xxxxxxxxx"
```

#### 問題: FSx 容量不足 / Issue: Insufficient FSx Capacity

**エラーメッセージ / Error Message:**
```
Insufficient capacity for the requested file system size
```

**解決方法 / Solution:**
1. より小さい容量で作成を試行
2. 別のAZで作成を試行
3. AWS サポートに容量増加を依頼

### 5. AWS Batch 関連 / AWS Batch Issues

#### 問題: コンピュート環境作成失敗 / Issue: Compute Environment Creation Failed

**エラーメッセージ / Error Message:**
```
INVALID: The compute environment failed to create
```

**確認手順 / Troubleshooting Steps:**
```bash
# コンピュート環境状態確認
aws batch describe-compute-environments --compute-environments COMPUTE_ENV_NAME

# CloudFormation イベント確認
aws cloudformation describe-stack-events --stack-name STACK_NAME
```

**よくある原因と解決方法 / Common Causes and Solutions:**

1. **サービスロール不足**
   ```bash
   # Batch サービスロール確認
   aws iam get-role --role-name AWSBatchServiceRole
   ```

2. **インスタンスプロファイル不足**
   ```bash
   # インスタンスプロファイル確認
   aws iam get-instance-profile --instance-profile-name ecsInstanceRole
   ```

3. **セキュリティグループ設定**
   ```bash
   # セキュリティグループ確認
   aws ec2 describe-security-groups --group-ids sg-xxxxxxxxx
   ```

#### 問題: ジョブキュー作成失敗 / Issue: Job Queue Creation Failed

**エラーメッセージ / Error Message:**
```
The compute environment is not in a valid state
```

**解決方法 / Solution:**
1. コンピュート環境が `VALID` 状態になるまで待機
2. コンピュート環境の設定を確認・修正

### 6. リソース制限関連 / Resource Limit Issues

#### 問題: vCPU 制限超過 / Issue: vCPU Limit Exceeded

**エラーメッセージ / Error Message:**
```
Limit Exceeded: Cannot exceed quota for vCpus: Requested 500, Maximum allowed 100
```

**解決方法 / Solution:**
```bash
# 現在の制限確認
aws service-quotas get-service-quota --service-code ec2 --quota-code L-34B43A08

# 制限緩和申請
aws service-quotas request-service-quota-increase \
  --service-code ec2 \
  --quota-code L-34B43A08 \
  --desired-value 1000
```

#### 問題: Spot インスタンス制限 / Issue: Spot Instance Limits

**エラーメッセージ / Error Message:**
```
Max spot instance count exceeded
```

**解決方法 / Solution:**
1. Spot インスタンス使用量を削減
2. オンデマンドインスタンスに変更
3. 制限緩和を申請

### 7. S3・DynamoDB 関連 / S3 and DynamoDB Issues

#### 問題: S3 バケット名重複 / Issue: S3 Bucket Name Conflict

**エラーメッセージ / Error Message:**
```
The requested bucket name is not available
```

**解決方法 / Solution:**
```bash
# 設定でプロジェクト名を変更
vim config/deployment-config.json

# または、バケット名にランダム文字列を追加
```

#### 問題: DynamoDB テーブル作成失敗 / Issue: DynamoDB Table Creation Failed

**エラーメッセージ / Error Message:**
```
Table already exists: table-name
```

**解決方法 / Solution:**
```bash
# 既存テーブル確認
aws dynamodb describe-table --table-name table-name

# 必要に応じて既存テーブル削除
aws dynamodb delete-table --table-name table-name
```

### 8. Amazon Bedrock 関連 / Amazon Bedrock Issues

#### 問題: Bedrock モデルアクセス拒否 / Issue: Bedrock Model Access Denied

**エラーメッセージ / Error Message:**
```
You don't have access to the model with the specified model ID
```

**解決方法 / Solution:**
1. Bedrock コンソールでモデルアクセスを有効化
2. 適切なリージョンでアクセスしているか確認
3. IAM 権限を確認

```bash
# Bedrock 利用可能モデル確認
aws bedrock list-foundation-models --region us-east-1
```

## 🔍 デバッグ手法 / Debugging Techniques

### 1. CDK ログ確認 / CDK Log Analysis

#### 詳細ログ出力 / Verbose Logging

```bash
# 詳細ログでデプロイ
npx cdk deploy --verbose

# デバッグモードでデプロイ
npx cdk deploy --debug

# 特定スタックのみデプロイ
npx cdk deploy StackName --verbose
```

#### CDK コンテキスト確認 / CDK Context Check

```bash
# コンテキスト一覧表示
npx cdk context

# 特定コンテキスト削除
npx cdk context --reset availability-zones:account=123456789012:region=ap-northeast-1
```

### 2. CloudFormation ログ確認 / CloudFormation Log Analysis

```bash
# スタックイベント確認
aws cloudformation describe-stack-events --stack-name STACK_NAME

# スタック状態確認
aws cloudformation describe-stacks --stack-name STACK_NAME

# 失敗したリソース確認
aws cloudformation describe-stack-resources --stack-name STACK_NAME --logical-resource-id RESOURCE_ID
```

### 3. AWS Batch ログ確認 / AWS Batch Log Analysis

```bash
# ジョブログ確認
aws logs get-log-events \
  --log-group-name /aws/batch/job \
  --log-stream-name JOB_ID

# コンピュート環境ログ確認
aws batch describe-compute-environments --compute-environments COMPUTE_ENV_NAME
```

### 4. ネットワーク診断 / Network Diagnostics

```bash
# VPC エンドポイント確認
aws ec2 describe-vpc-endpoints --filters "Name=vpc-id,Values=vpc-xxxxxxxxx"

# ルートテーブル確認
aws ec2 describe-route-tables --filters "Name=vpc-id,Values=vpc-xxxxxxxxx"

# セキュリティグループ確認
aws ec2 describe-security-groups --filters "Name=vpc-id,Values=vpc-xxxxxxxxx"
```

## 🛠️ 予防策 / Prevention Strategies

### 1. 事前チェックリスト / Pre-deployment Checklist

```bash
# 前提条件チェック実行
./scripts/check-prerequisites.sh

# 設定ファイル検証
jq empty config/deployment-config.json

# AWS 認証情報確認
aws sts get-caller-identity

# リージョン設定確認
aws configure get region
```

### 2. 段階的デプロイメント / Staged Deployment

```bash
# 1. ネットワークスタックのみデプロイ
npx cdk deploy NetworkStack

# 2. セキュリティスタックデプロイ
npx cdk deploy SecurityStack

# 3. 残りのスタックデプロイ
npx cdk deploy --all
```

### 3. 設定検証 / Configuration Validation

```bash
# 設定スキーマ検証
./scripts/validate-config.sh config/deployment-config.json

# リソース存在確認
./scripts/verify-resources.sh config/deployment-config.json
```

## 🔄 復旧手順 / Recovery Procedures

### 1. 部分的な失敗からの復旧 / Recovery from Partial Failure

```bash
# 失敗したスタックの状態確認
aws cloudformation describe-stacks --stack-name STACK_NAME

# 失敗したリソースの削除
aws cloudformation cancel-update-stack --stack-name STACK_NAME

# 再デプロイ実行
npx cdk deploy --force
```

### 2. 完全なロールバック / Complete Rollback

```bash
# スタック削除
npx cdk destroy

# 設定確認・修正
vim config/deployment-config.json

# 再デプロイ
npx cdk deploy
```

### 3. 手動リソース削除 / Manual Resource Cleanup

```bash
# 残存リソース確認
aws cloudformation describe-stack-resources --stack-name STACK_NAME

# 手動でリソース削除（例：S3バケット）
aws s3 rm s3://bucket-name --recursive
aws s3 rb s3://bucket-name

# 手動でリソース削除（例：DynamoDBテーブル）
aws dynamodb delete-table --table-name table-name
```

## 📞 サポート連絡先 / Support Contacts

### AWS サポート / AWS Support

1. **AWS サポートケース作成**
   - AWS コンソール → Support → Create case

2. **AWS フォーラム**
   - https://forums.aws.amazon.com/

3. **AWS ドキュメント**
   - CDK: https://docs.aws.amazon.com/cdk/
   - Batch: https://docs.aws.amazon.com/batch/
   - FSx: https://docs.aws.amazon.com/fsx/

### コミュニティサポート / Community Support

1. **GitHub Issues**
   - プロジェクトのGitHubリポジトリでIssue作成

2. **Stack Overflow**
   - タグ: `aws-cdk`, `aws-batch`, `amazon-fsx`

## 📋 トラブルシューティングチェックリスト / Troubleshooting Checklist

### デプロイメント前 / Before Deployment

- [ ] AWS CLI がインストール・設定済み
- [ ] Node.js 18+ がインストール済み
- [ ] AWS CDK がインストール済み
- [ ] 必要なIAM権限が付与済み
- [ ] 設定ファイルが正しく作成済み
- [ ] リージョンが正しく設定済み

### デプロイメント中 / During Deployment

- [ ] CDK ブートストラップが完了済み
- [ ] CloudFormation スタック状態が正常
- [ ] リソース制限に問題なし
- [ ] ネットワーク設定が正しい
- [ ] セキュリティグループ設定が適切

### デプロイメント後 / After Deployment

- [ ] 全リソースが正常に作成済み
- [ ] AWS Batch が正常に動作
- [ ] FSx マウントが正常に動作
- [ ] S3・DynamoDB が正常にアクセス可能
- [ ] 監視・ログが正常に動作

## 🚨 緊急時対応 / Emergency Response

### 本番環境での問題 / Production Issues

1. **即座にアラート確認**
   ```bash
   # CloudWatch アラーム確認
   aws cloudwatch describe-alarms --state-value ALARM
   ```

2. **ログ確認**
   ```bash
   # 最新のエラーログ確認
   aws logs filter-log-events --log-group-name /aws/batch/job --start-time $(date -d '1 hour ago' +%s)000
   ```

3. **必要に応じてロールバック**
   ```bash
   # 前のバージョンにロールバック
   git checkout PREVIOUS_COMMIT
   npx cdk deploy
   ```

### エスカレーション基準 / Escalation Criteria

- データ損失の可能性
- 1時間以上のサービス停止
- セキュリティインシデント
- 複数リージョンでの同時障害