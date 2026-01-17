# Windows AD FSxN統合環境 デプロイメントガイド

## 概要

このガイドでは、Windows Server 2022 + Active Directory + FSx for NetApp ONTAP統合環境のデプロイメント手順を詳しく説明します。

## 前提条件

### 必要なツール・サービス
- **AWS CLI** (バージョン 2.0以上)
- **適切なIAM権限**を持つAWSアカウント
- **EC2キーペア** (Windows インスタンス用)
- **FSx for ONTAP ファイルシステム** (事前作成済み)

### 必要なIAM権限
デプロイメントには以下の権限が必要です：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "ec2:*",
        "iam:*",
        "s3:*",
        "ssm:*",
        "secretsmanager:*",
        "kms:*",
        "logs:*",
        "cloudwatch:*",
        "cloudtrail:*",
        "guardduty:*",
        "config:*",
        "fsx:*",
        "route53:*",
        "lambda:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## デプロイメント手順

### ステップ 1: 事前準備

#### 1.1 リポジトリのクローン
```bash
git clone https://github.com/your-org/windows-ad-fsxn-integration.git
cd windows-ad-fsxn-integration
```

#### 1.2 AWS CLI設定確認
```bash
# プロファイル確認
aws configure list --profile your-profile

# 認証情報確認
aws sts get-caller-identity --profile your-profile
```

#### 1.3 EC2キーペア作成（必要に応じて）
```bash
# キーペア作成
aws ec2 create-key-pair \
    --key-name windows-ad-fsxn-keypair \
    --query 'KeyMaterial' \
    --output text > windows-ad-fsxn-keypair.pem

# 権限設定
chmod 400 windows-ad-fsxn-keypair.pem
```

#### 1.4 FSx for ONTAP ファイルシステム作成
```bash
# FSx ファイルシステム作成例
aws fsx create-file-system \
    --file-system-type ONTAP \
    --storage-capacity 1024 \
    --subnet-ids subnet-12345678 \
    --security-group-ids sg-12345678 \
    --ontap-configuration '{
        "AutomaticBackupRetentionDays": 7,
        "DeploymentType": "SINGLE_AZ_1",
        "ThroughputCapacity": 128,
        "PreferredSubnetId": "subnet-12345678"
    }'
```

### ステップ 2: パラメータ設定

#### 2.1 環境別パラメータファイルの選択

利用可能なパラメータファイル：
- `parameters/dev-environment-parameters.json` - 開発環境
- `parameters/staging-environment-parameters.json` - ステージング環境  
- `parameters/prod-environment-parameters.json` - 本番環境
- `parameters/prod-secrets-manager-parameters.json` - 本番環境（Secrets Manager統合）

#### 2.2 パラメータファイルのカスタマイズ

**必須変更項目：**
```json
{
  "ParameterKey": "AdminPassword",
  "ParameterValue": "YOUR_SECURE_PASSWORD_HERE"
},
{
  "ParameterKey": "SafeModePassword", 
  "ParameterValue": "YOUR_SAFE_MODE_PASSWORD_HERE"
},
{
  "ParameterKey": "FSxFileSystemId",
  "ParameterValue": "fs-YOUR_FILESYSTEM_ID"
},
{
  "ParameterKey": "KeyPairName",
  "ParameterValue": "YOUR_KEY_PAIR_NAME"
}
```

**推奨変更項目：**
```json
{
  "ParameterKey": "DomainName",
  "ParameterValue": "your-company.local"
},
{
  "ParameterKey": "NetBiosName",
  "ParameterValue": "YOURCOMPANY"
},
{
  "ParameterKey": "NotificationEmail",
  "ParameterValue": "admin@your-company.com"
}
```

### ステップ 3: 外部設定の準備（オプション）

#### 3.1 Secrets Manager使用の場合
```bash
# 環境設定スクリプト実行
./scripts/setup-environment-config.sh prod secrets-manager ap-northeast-1 your-profile

# パスワード設定
aws secretsmanager put-secret-value \
    --secret-id "windows-ad-fsxn/prod/admin-password" \
    --secret-string "YOUR_SECURE_PASSWORD"

aws secretsmanager put-secret-value \
    --secret-id "windows-ad-fsxn/prod/safemode-password" \
    --secret-string "YOUR_SAFE_MODE_PASSWORD"
```

#### 3.2 SSM Parameter Store使用の場合
```bash
# 環境設定スクリプト実行
./scripts/setup-environment-config.sh prod ssm ap-northeast-1 your-profile
```

### ステップ 4: デプロイメント実行

#### 4.1 テンプレート検証
```bash
# 構文チェック
./scripts/validate-templates.sh

# 手動検証
aws cloudformation validate-template \
    --template-body file://windows-ad-fsxn-environment.yaml
```

#### 4.2 デプロイメント実行
```bash
# 開発環境デプロイ
./scripts/deploy-stack.sh dev ap-northeast-1 your-profile

# ステージング環境デプロイ  
./scripts/deploy-stack.sh staging ap-northeast-1 your-profile

# 本番環境デプロイ
./scripts/deploy-stack.sh prod ap-northeast-1 your-profile
```

#### 4.3 デプロイメント進行状況確認
```bash
# スタック状況確認
aws cloudformation describe-stacks \
    --stack-name windows-ad-fsxn-prod \
    --query 'Stacks[0].StackStatus'

# イベント確認
aws cloudformation describe-stack-events \
    --stack-name windows-ad-fsxn-prod \
    --query 'StackEvents[0:10].[Timestamp,ResourceStatus,ResourceType,LogicalResourceId]' \
    --output table
```

### ステップ 5: デプロイメント後の確認

#### 5.1 リソース確認
```bash
# 出力値確認
aws cloudformation describe-stacks \
    --stack-name windows-ad-fsxn-prod \
    --query 'Stacks[0].Outputs' \
    --output table

# EC2インスタンス確認
aws ec2 describe-instances \
    --filters "Name=tag:Project,Values=windows-ad-fsxn" \
    --query 'Reservations[].Instances[].[InstanceId,State.Name,PrivateIpAddress]' \
    --output table
```

#### 5.2 Active Directory確認
```bash
# Systems Manager経由でAD状況確認
aws ssm send-command \
    --document-name "AWS-RunPowerShellScript" \
    --targets "Key=tag:Project,Values=windows-ad-fsxn" \
    --parameters 'commands=["Get-ADDomain","Get-ADForest"]'
```

#### 5.3 FSx統合確認
```bash
# FSxドメイン参加状況確認
aws fsx describe-storage-virtual-machines \
    --storage-virtual-machine-ids $(aws cloudformation describe-stacks --stack-name windows-ad-fsxn-prod --query 'Stacks[0].Outputs[?OutputKey==`FSxSVMId`].OutputValue' --output text)
```

## パラメータ設定例とベストプラクティス

### 開発環境設定例
```json
{
  "Environment": "dev",
  "InstanceType": "t3.medium",
  "EBSVolumeSize": "100",
  "EnableGuardDuty": "false",
  "BackupRetentionDays": "7",
  "VpcCidr": "10.0.0.0/16"
}
```

### 本番環境設定例
```json
{
  "Environment": "prod", 
  "InstanceType": "m5.large",
  "EBSVolumeSize": "200",
  "EnableGuardDuty": "true",
  "BackupRetentionDays": "90",
  "VpcCidr": "10.1.0.0/16",
  "UseSecretsManager": "true"
}
```

### セキュリティベストプラクティス

#### パスワード要件
- **最小長**: 8文字以上
- **複雑性**: 大文字・小文字・数字・記号を含む
- **推奨**: 16文字以上のランダム生成パスワード

#### ネットワークセキュリティ
- **RDP アクセス**: 必要最小限のCIDR範囲に制限
- **セキュリティグループ**: 最小権限の原則を適用
- **VPC設計**: プライベートサブネットでの運用

#### 暗号化設定
- **EBS暗号化**: 必須（自動有効化）
- **S3暗号化**: CloudTrail、Config用バケット
- **Secrets Manager**: 機密情報の暗号化保存

## 高度なデプロイメントオプション

### マルチリージョンデプロイメント
```bash
# 東京リージョン
./scripts/deploy-stack.sh prod ap-northeast-1 tokyo-profile

# 大阪リージョン（DR用）
./scripts/deploy-stack.sh prod ap-northeast-3 osaka-profile
```

### カスタムドメイン設定
```json
{
  "DomainName": "corp.yourcompany.com",
  "CustomDomainSuffix": ".yourcompany.com",
  "OrganizationalUnit": "OU=Servers,OU=Production,DC=corp,DC=yourcompany,DC=com"
}
```

### 大規模環境設定
```json
{
  "InstanceType": "m5.2xlarge",
  "EBSVolumeSize": "500", 
  "BackupRetentionDays": "365",
  "AdditionalTags": "CostCenter=IT,Owner=InfraTeam,Compliance=SOX,DataClassification=Internal"
}
```

## デプロイメント後の運用

### 定期メンテナンス
```bash
# パッチ適用状況確認
aws ssm describe-instance-patch-states \
    --instance-ids $(aws cloudformation describe-stacks --stack-name windows-ad-fsxn-prod --query 'Stacks[0].Outputs[?OutputKey==`WindowsADInstanceId`].OutputValue' --output text)

# ヘルスチェック実行
aws ssm send-command \
    --document-name $(aws cloudformation describe-stacks --stack-name windows-ad-fsxn-prod --query 'Stacks[0].Outputs[?OutputKey==`CustomOperationDocumentName`].OutputValue' --output text) \
    --parameters "operation=health-check" \
    --targets "Key=InstanceIds,Values=$(aws cloudformation describe-stacks --stack-name windows-ad-fsxn-prod --query 'Stacks[0].Outputs[?OutputKey==`WindowsADInstanceId`].OutputValue' --output text)"
```

### 監視・アラート
```bash
# CloudWatchダッシュボード確認
echo "ダッシュボードURL: $(aws cloudformation describe-stacks --stack-name windows-ad-fsxn-prod --query 'Stacks[0].Outputs[?OutputKey==`MonitoringDashboardURL`].OutputValue' --output text)"

# アラート設定確認
aws cloudwatch describe-alarms \
    --alarm-name-prefix "windows-ad-fsxn-prod"
```

### バックアップ・復旧
```bash
# EBSスナップショット確認
aws ec2 describe-snapshots \
    --owner-ids self \
    --filters "Name=tag:Project,Values=windows-ad-fsxn"

# FSxバックアップ確認  
aws fsx describe-backups \
    --filters "Name=file-system-id,Values=$(aws cloudformation describe-stacks --stack-name windows-ad-fsxn-prod --query 'Stacks[0].Outputs[?OutputKey==`FSxFileSystemId`].OutputValue' --output text)"
```

## 更新・アップグレード

### スタック更新
```bash
# パラメータのみ更新
aws cloudformation update-stack \
    --stack-name windows-ad-fsxn-prod \
    --use-previous-template \
    --parameters file://parameters/prod-environment-parameters-updated.json

# テンプレート更新
aws cloudformation update-stack \
    --stack-name windows-ad-fsxn-prod \
    --template-body file://windows-ad-fsxn-environment.yaml \
    --parameters file://parameters/prod-environment-parameters.json \
    --capabilities CAPABILITY_IAM
```

### ローリング更新
```bash
# インスタンス置換（メンテナンス時）
aws cloudformation update-stack \
    --stack-name windows-ad-fsxn-prod \
    --use-previous-template \
    --parameters ParameterKey=InstanceType,ParameterValue=m5.xlarge \
    --capabilities CAPABILITY_IAM
```

## 削除・クリーンアップ

### スタック削除
```bash
# 開発環境削除
aws cloudformation delete-stack --stack-name windows-ad-fsxn-dev

# 削除進行状況確認
aws cloudformation describe-stack-events \
    --stack-name windows-ad-fsxn-dev \
    --query 'StackEvents[0:5].[Timestamp,ResourceStatus,ResourceType]' \
    --output table
```

### 手動クリーンアップ
```bash
# S3バケット内容削除（CloudTrail用）
aws s3 rm s3://windows-ad-fsxn-prod-cloudtrail-bucket --recursive

# Secrets Manager シークレット削除
aws secretsmanager delete-secret \
    --secret-id "windows-ad-fsxn/prod/admin-password" \
    --force-delete-without-recovery
```

## 関連ドキュメント

- [設定管理ガイド](configuration-management.md)
- [セキュリティガイド](security-guide.md)
- [トラブルシューティングガイド](troubleshooting-guide.md)
- [運用ガイド](operations-guide.md)
- [アーキテクチャ設計書](architecture-design.md)