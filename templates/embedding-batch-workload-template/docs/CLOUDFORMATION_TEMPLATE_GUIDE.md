# CloudFormation Template Guide

## 概要

このガイドでは、Embedding Batch WorkloadのCloudFormationテンプレートの生成、カスタマイズ、デプロイメント方法について説明します。

## テンプレート構成

### 📁 ディレクトリ構造

```
cloudformation/
├── templates/                    # 生成されたCloudFormationテンプレート
│   ├── embedding-workload-stack.template.json
│   └── embedding-workload-stack-parameterized.template.json
├── parameters/                   # 環境別パラメータファイル
│   ├── dev-parameters.json
│   ├── staging-parameters.json
│   └── prod-parameters.json
├── nested/                       # ネストされたスタックテンプレート
│   ├── master-stack.template.json
│   ├── networking-stack.template.json
│   ├── security-stack.template.json
│   ├── storage-stack.template.json
│   ├── embedding-stack.template.json
│   └── monitoring-stack.template.json
└── scripts/                      # デプロイメントスクリプト
    ├── deploy-cloudformation.sh
    ├── deploy-nested-stacks.sh
    └── validate-templates.sh
```

## テンプレート生成

### 🔧 CDKからの自動生成

```bash
# 基本的なテンプレート生成
./scripts/generate-cloudformation.sh --environment dev

# パラメータ化されたテンプレート生成
./scripts/generate-cloudformation.sh --environment prod --parameterize

# ネストされたスタックテンプレート生成
./scripts/generate-cloudformation.sh --environment prod --nested --parameterize

# 生成と検証を同時実行
./scripts/generate-cloudformation.sh --environment prod --parameterize --validate
```

### 📋 生成オプション

| オプション | 説明 | 例 |
|-----------|------|-----|
| `--environment` | 環境名を指定 | `--environment prod` |
| `--parameterize` | パラメータ化されたテンプレートを生成 | `--parameterize` |
| `--nested` | ネストされたスタックテンプレートを生成 | `--nested` |
| `--validate` | 生成後にテンプレートを検証 | `--validate` |
| `--clean` | 既存のテンプレートを削除してから生成 | `--clean` |
| `--output` | 出力ディレクトリを指定 | `--output custom-cfn` |

## テンプレートの種類

### 1. 基本テンプレート

**ファイル**: `templates/embedding-workload-stack.template.json`

- 単一のCloudFormationテンプレート
- すべてのリソースを1つのスタックで管理
- 小規模〜中規模のデプロイメントに適している

**主要リソース**:
- VPC、サブネット、セキュリティグループ
- IAMロール、ポリシー
- AWS Batch（コンピュート環境、ジョブキュー、ジョブ定義）
- S3バケット、DynamoDBテーブル
- SNSトピック、CloudWatchアラーム

### 2. パラメータ化テンプレート

**ファイル**: `templates/embedding-workload-stack-parameterized.template.json`

- 環境固有の値をパラメータとして外部化
- 複数環境での再利用が容易
- 設定の標準化とガバナンス強化

**主要パラメータ**:
```json
{
  "ProjectName": "embedding-workload",
  "Environment": "prod",
  "VpcId": "",
  "BedrockRegion": "us-east-1",
  "BedrockModelId": "amazon.titan-embed-text-v1",
  "EnableAutoRemediation": "true",
  "AlertContactEmail": "ops@company.com"
}
```

### 3. ネストされたスタック

**ファイル**: `nested/master-stack.template.json`

- 機能別に分割されたスタック構成
- 大規模デプロイメントに適している
- 独立したライフサイクル管理が可能

**スタック構成**:
- **Networking Stack**: VPC、サブネット、ルーティング
- **Security Stack**: IAMロール、セキュリティグループ
- **Storage Stack**: S3、DynamoDB
- **Compute Stack**: AWS Batch、Lambda
- **Monitoring Stack**: CloudWatch、SNS

## パラメータ設定

### 🔧 環境別パラメータファイル

#### 開発環境 (`dev-parameters.json`)
```json
[
  {
    "ParameterKey": "Environment",
    "ParameterValue": "dev"
  },
  {
    "ParameterKey": "EnableAutoRemediation",
    "ParameterValue": "false"
  },
  {
    "ParameterKey": "AlertContactEmail",
    "ParameterValue": "dev-team@company.com"
  }
]
```

#### 本番環境 (`prod-parameters.json`)
```json
[
  {
    "ParameterKey": "Environment",
    "ParameterValue": "prod"
  },
  {
    "ParameterKey": "EnableAutoRemediation",
    "ParameterValue": "true"
  },
  {
    "ParameterKey": "EnableEscalation",
    "ParameterValue": "true"
  },
  {
    "ParameterKey": "AlertContactEmail",
    "ParameterValue": "ops@company.com"
  }
]
```

### 📝 パラメータカスタマイズ

#### 既存インフラの利用
```json
[
  {
    "ParameterKey": "VpcId",
    "ParameterValue": "vpc-12345678"
  },
  {
    "ParameterKey": "PrivateSubnetIds",
    "ParameterValue": "subnet-12345678,subnet-87654321"
  },
  {
    "ParameterKey": "FsxFileSystemId",
    "ParameterValue": "fs-12345678"
  }
]
```

#### Bedrock設定
```json
[
  {
    "ParameterKey": "BedrockRegion",
    "ParameterValue": "us-west-2"
  },
  {
    "ParameterKey": "BedrockModelId",
    "ParameterValue": "amazon.titan-embed-text-v2"
  }
]
```

#### アラート設定
```json
[
  {
    "ParameterKey": "SlackWebhookUrl",
    "ParameterValue": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
  },
  {
    "ParameterKey": "PagerDutyIntegrationKey",
    "ParameterValue": "your-pagerduty-integration-key"
  }
]
```

## デプロイメント方法

### 🚀 基本デプロイメント

```bash
# デフォルト設定でデプロイ
./cloudformation/scripts/deploy-cloudformation.sh

# カスタム設定でデプロイ
./cloudformation/scripts/deploy-cloudformation.sh \
  my-embedding-stack \
  templates/embedding-workload-stack.template.json \
  prod

# パラメータファイルを指定してデプロイ
./cloudformation/scripts/deploy-cloudformation.sh \
  --parameters parameters/prod-parameters.json \
  my-embedding-stack
```

### 🏗️ ネストされたスタックのデプロイ

```bash
# S3バケットを作成してデプロイ
./cloudformation/scripts/deploy-nested-stacks.sh \
  --create-bucket \
  my-master-stack \
  my-cloudformation-templates-bucket \
  prod

# 既存のS3バケットを使用してデプロイ
./cloudformation/scripts/deploy-nested-stacks.sh \
  my-master-stack \
  existing-bucket \
  prod

# テンプレートの検証のみ
./cloudformation/scripts/deploy-nested-stacks.sh \
  --validate-only \
  my-master-stack \
  my-bucket
```

### 🔍 AWS CLIでの直接デプロイ

```bash
# 基本デプロイ
aws cloudformation deploy \
  --template-file cloudformation/templates/embedding-workload-stack.template.json \
  --stack-name embedding-workload-stack \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    Environment=prod \
    ProjectName=embedding-workload \
    AlertContactEmail=ops@company.com

# パラメータファイルを使用
aws cloudformation deploy \
  --template-file cloudformation/templates/embedding-workload-stack-parameterized.template.json \
  --stack-name embedding-workload-stack \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameters file://cloudformation/parameters/prod-parameters.json
```

## テンプレートの検証

### ✅ 構文検証

```bash
# 単一テンプレートの検証
aws cloudformation validate-template \
  --template-body file://cloudformation/templates/embedding-workload-stack.template.json

# 全テンプレートの検証
find cloudformation -name "*.template.json" -exec \
  aws cloudformation validate-template --template-body file://{} \;
```

### 🔍 リンター使用

```bash
# cfn-lintのインストール
pip install cfn-lint

# テンプレートのリント
cfn-lint cloudformation/templates/embedding-workload-stack.template.json

# 全テンプレートのリント
cfn-lint cloudformation/**/*.template.json
```

### 📊 セキュリティ分析

```bash
# cfn_nagのインストール
gem install cfn-nag

# セキュリティ分析
cfn_nag_scan --input-path cloudformation/templates/

# 特定のルールを無視
cfn_nag_scan --input-path cloudformation/templates/ \
  --blacklist-path .cfnnag_blacklist.yml
```

## カスタマイズガイド

### 🔧 リソースの追加

#### Lambda関数の追加
```json
{
  "CustomProcessorLambda": {
    "Type": "AWS::Lambda::Function",
    "Properties": {
      "FunctionName": {"Fn::Sub": "${ProjectName}-${Environment}-custom-processor"},
      "Runtime": "python3.9",
      "Handler": "index.handler",
      "Code": {
        "ZipFile": "def handler(event, context): return {'statusCode': 200}"
      },
      "Role": {"Fn::GetAtt": ["BatchJobRole", "Arn"]},
      "Environment": {
        "Variables": {
          "EMBEDDINGS_BUCKET": {"Ref": "EmbeddingsBucket"},
          "EMBEDDINGS_TABLE": {"Ref": "EmbeddingsTable"}
        }
      }
    }
  }
}
```

#### 追加のアラームの設定
```json
{
  "CustomMetricAlarm": {
    "Type": "AWS::CloudWatch::Alarm",
    "Properties": {
      "AlarmName": {"Fn::Sub": "${ProjectName}-${Environment}-custom-metric"},
      "AlarmDescription": "Custom metric alarm",
      "MetricName": "CustomMetric",
      "Namespace": "Custom/Application",
      "Statistic": "Average",
      "Period": 300,
      "EvaluationPeriods": 2,
      "Threshold": 100,
      "ComparisonOperator": "GreaterThanThreshold",
      "AlarmActions": [{"Ref": "HighAlertTopic"}]
    }
  }
}
```

### 🏷️ タグの標準化

```json
{
  "Tags": [
    {"Key": "Project", "Value": {"Ref": "ProjectName"}},
    {"Key": "Environment", "Value": {"Ref": "Environment"}},
    {"Key": "Component", "Value": "EmbeddingWorkload"},
    {"Key": "ManagedBy", "Value": "CloudFormation"},
    {"Key": "CostCenter", "Value": "Engineering"},
    {"Key": "Owner", "Value": "DataTeam"},
    {"Key": "Backup", "Value": "Required"},
    {"Key": "Compliance", "Value": "SOC2"}
  ]
}
```

### 🔒 セキュリティ強化

#### KMS暗号化の追加
```json
{
  "EmbeddingsKMSKey": {
    "Type": "AWS::KMS::Key",
    "Properties": {
      "Description": "KMS key for embeddings encryption",
      "KeyPolicy": {
        "Statement": [
          {
            "Effect": "Allow",
            "Principal": {"AWS": {"Fn::Sub": "arn:aws:iam::${AWS::AccountId}:root"}},
            "Action": "kms:*",
            "Resource": "*"
          }
        ]
      }
    }
  },
  "EmbeddingsKMSKeyAlias": {
    "Type": "AWS::KMS::Alias",
    "Properties": {
      "AliasName": {"Fn::Sub": "alias/${ProjectName}-${Environment}-embeddings"},
      "TargetKeyId": {"Ref": "EmbeddingsKMSKey"}
    }
  }
}
```

#### VPCエンドポイントの追加
```json
{
  "S3VPCEndpoint": {
    "Type": "AWS::EC2::VPCEndpoint",
    "Properties": {
      "VpcId": {"Fn::If": ["HasVpcId", {"Ref": "VpcId"}, {"Ref": "VPC"}]},
      "ServiceName": {"Fn::Sub": "com.amazonaws.${AWS::Region}.s3"},
      "VpcEndpointType": "Gateway",
      "RouteTableIds": [
        {"Ref": "PrivateRouteTable1"},
        {"Ref": "PrivateRouteTable2"}
      ]
    }
  }
}
```

## トラブルシューティング

### ❌ 一般的なエラー

#### 1. IAM権限不足
```
User: arn:aws:iam::123456789012:user/username is not authorized to perform: iam:CreateRole
```

**解決方法**:
```bash
# 必要なIAM権限を確認
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:user/username \
  --action-names iam:CreateRole \
  --resource-arns "*"

# 管理者権限でデプロイ
aws sts assume-role --role-arn arn:aws:iam::123456789012:role/AdminRole \
  --role-session-name CloudFormationDeploy
```

#### 2. リソース名の競合
```
Resource already exists: embedding-workload-prod-embeddings-bucket
```

**解決方法**:
```json
{
  "ParameterKey": "ProjectName",
  "ParameterValue": "my-unique-embedding-workload"
}
```

#### 3. VPC制限
```
The maximum number of VPCs has been reached
```

**解決方法**:
```json
{
  "ParameterKey": "VpcId",
  "ParameterValue": "vpc-existing123"
}
```

### 🔍 デバッグ方法

#### CloudFormationイベントの確認
```bash
# スタックイベントの表示
aws cloudformation describe-stack-events \
  --stack-name embedding-workload-stack \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'

# リソースの詳細確認
aws cloudformation describe-stack-resources \
  --stack-name embedding-workload-stack \
  --logical-resource-id BatchComputeEnvironment
```

#### ログの確認
```bash
# CloudWatch Logsの確認
aws logs describe-log-groups \
  --log-group-name-prefix "/aws/batch/job"

# 最新のログストリーム確認
aws logs describe-log-streams \
  --log-group-name "/aws/batch/job" \
  --order-by LastEventTime \
  --descending \
  --max-items 1
```

## ベストプラクティス

### 🎯 デプロイメント戦略

1. **段階的デプロイ**
   - 開発環境 → ステージング環境 → 本番環境
   - 各環境での十分なテスト実施

2. **ロールバック計画**
   - 前バージョンのテンプレート保持
   - データベースバックアップの事前取得

3. **変更管理**
   - テンプレートのバージョン管理
   - 変更内容の文書化

### 🔒 セキュリティ

1. **最小権限の原則**
   - 必要最小限のIAM権限設定
   - リソースベースのポリシー活用

2. **暗号化**
   - 保存時暗号化の有効化
   - 転送時暗号化の確保

3. **ネットワークセキュリティ**
   - プライベートサブネットの使用
   - セキュリティグループの適切な設定

### 💰 コスト最適化

1. **リソースサイジング**
   - 適切なインスタンスタイプの選択
   - Auto Scalingの活用

2. **ライフサイクル管理**
   - S3ライフサイクルポリシーの設定
   - 不要なリソースの自動削除

3. **モニタリング**
   - コストアラートの設定
   - リソース使用率の監視

## 関連ドキュメント

- [CloudFormation Deployment Guide](CLOUDFORMATION_DEPLOYMENT_GUIDE.md)
- [CloudFormation Configuration Guide](CLOUDFORMATION_CONFIGURATION_GUIDE.md)
- [CloudFormation Troubleshooting Guide](CLOUDFORMATION_TROUBLESHOOTING_GUIDE.md)
- [CDK Architecture Guide](CDK_ARCHITECTURE_GUIDE.md)
- [Security Best Practices Guide](SECURITY_BEST_PRACTICES_GUIDE.md)