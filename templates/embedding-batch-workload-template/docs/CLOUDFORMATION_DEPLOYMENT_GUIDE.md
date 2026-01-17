# ☁️ CloudFormation デプロイメントガイド / CloudFormation Deployment Guide

## 📋 概要 / Overview

このガイドでは、AWS CloudFormationテンプレートを使用してFSx for NetApp ONTAP Embedding Batch Workloadをデプロイする方法を説明します。CDKを使用しない環境や、純粋なCloudFormationテンプレートを好む場合に適しています。

This guide explains how to deploy the FSx for NetApp ONTAP Embedding Batch Workload using AWS CloudFormation templates. This is suitable for environments that don't use CDK or prefer pure CloudFormation templates.

## 🎯 対象読者 / Target Audience

- CloudFormationの基本的な知識を持つ運用者
- AWSコンソールでのデプロイメントを好む方
- CDKを使用しない環境の管理者
- インフラストラクチャテンプレートの標準化を求める組織

- Operators with basic CloudFormation knowledge
- Those who prefer AWS Console deployments
- Administrators in environments that don't use CDK
- Organizations seeking infrastructure template standardization

## ⚡ クイックスタート（AWS コンソール）/ Quick Start (AWS Console)

### 1. テンプレートダウンロード / Template Download

```bash
# CloudFormationテンプレートを生成
cd cdk
npm install
npm run build
npx cdk synth > ../cloudformation-template.yaml
```

### 2. AWSコンソールでデプロイ / Deploy via AWS Console

1. **AWS CloudFormationコンソールを開く**
   - https://console.aws.amazon.com/cloudformation/

2. **スタック作成**
   - 「スタックの作成」→「新しいリソースを使用（標準）」

3. **テンプレートアップロード**
   - 「テンプレートファイルのアップロード」を選択
   - `cloudformation-template.yaml` をアップロード

4. **パラメータ設定**
   - 必要なパラメータを入力（詳細は後述）

5. **デプロイ実行**
   - 設定を確認してスタック作成

## 📚 詳細デプロイメントガイド / Detailed Deployment Guide

### ステップ1: 前提条件確認 / Step 1: Prerequisites Check

#### 必要な権限 / Required Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "iam:CreateRole",
        "iam:AttachRolePolicy",
        "iam:PassRole",
        "ec2:*",
        "batch:*",
        "s3:*",
        "dynamodb:*",
        "fsx:*",
        "logs:*"
      ],
      "Resource": "*"
    }
  ]
}
```

#### サービス制限確認 / Service Limits Check

```bash
# vCPU制限確認
aws service-quotas get-service-quota --service-code ec2 --quota-code L-34B43A08

# FSx制限確認
aws service-quotas get-service-quota --service-code fsx --quota-code L-83C5C3F5
```

### ステップ2: CloudFormationテンプレート生成 / Step 2: CloudFormation Template Generation

#### CDKからテンプレート生成 / Generate Template from CDK

```bash
# プロジェクトディレクトリに移動
cd templates/embedding-batch-workload-template

# 依存関係インストール
cd cdk
npm install

# TypeScriptビルド
npm run build

# CloudFormationテンプレート生成
npx cdk synth --output ../cloudformation-templates/

# 単一ファイルとして出力
npx cdk synth > ../cloudformation-template.yaml
```

#### 生成されるファイル / Generated Files

```
cloudformation-templates/
├── EmbeddingWorkloadStack.template.json    # メインテンプレート
├── EmbeddingWorkloadStack.assets.json      # アセット情報
└── manifest.json                           # マニフェスト
```

### ステップ3: パラメータファイル作成 / Step 3: Parameter File Creation

#### 基本パラメータファイル / Basic Parameter File

`parameters/basic-parameters.json`:
```json
[
  {
    "ParameterKey": "ProjectName",
    "ParameterValue": "embedding-batch"
  },
  {
    "ParameterKey": "Environment",
    "ParameterValue": "dev"
  },
  {
    "ParameterKey": "VpcId",
    "ParameterValue": "vpc-xxxxxxxxx"
  },
  {
    "ParameterKey": "PrivateSubnetIds",
    "ParameterValue": "subnet-xxxxxxxx,subnet-yyyyyyyy"
  },
  {
    "ParameterKey": "FsxFileSystemId",
    "ParameterValue": "fs-xxxxxxxxx"
  },
  {
    "ParameterKey": "FsxSvmId",
    "ParameterValue": "svm-xxxxxxxxx"
  },
  {
    "ParameterKey": "MaxvCpus",
    "ParameterValue": "100"
  },
  {
    "ParameterKey": "InstanceTypes",
    "ParameterValue": "m5.large,m5.xlarge"
  }
]
```

#### 本番環境パラメータファイル / Production Parameter File

`parameters/production-parameters.json`:
```json
[
  {
    "ParameterKey": "ProjectName",
    "ParameterValue": "embedding-prod"
  },
  {
    "ParameterKey": "Environment",
    "ParameterValue": "prod"
  },
  {
    "ParameterKey": "VpcId",
    "ParameterValue": "vpc-prod123456"
  },
  {
    "ParameterKey": "PrivateSubnetIds",
    "ParameterValue": "subnet-prod1111,subnet-prod2222"
  },
  {
    "ParameterKey": "FsxFileSystemId",
    "ParameterValue": "fs-prod123456"
  },
  {
    "ParameterKey": "FsxSvmId",
    "ParameterValue": "svm-prod123456"
  },
  {
    "ParameterKey": "MaxvCpus",
    "ParameterValue": "1000"
  },
  {
    "ParameterKey": "InstanceTypes",
    "ParameterValue": "m5.xlarge,m5.2xlarge,m5.4xlarge"
  },
  {
    "ParameterKey": "EnableSpotInstances",
    "ParameterValue": "true"
  },
  {
    "ParameterKey": "SpotBidPercentage",
    "ParameterValue": "50"
  },
  {
    "ParameterKey": "EnableDetailedMonitoring",
    "ParameterValue": "true"
  },
  {
    "ParameterKey": "CreateDashboard",
    "ParameterValue": "true"
  },
  {
    "ParameterKey": "AlertEmail",
    "ParameterValue": "alerts@company.com"
  }
]
```

### ステップ4: AWS CLI デプロイメント / Step 4: AWS CLI Deployment

#### 基本デプロイメント / Basic Deployment

```bash
# スタック作成
aws cloudformation create-stack \
  --stack-name embedding-batch-dev \
  --template-body file://cloudformation-template.yaml \
  --parameters file://parameters/basic-parameters.json \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region ap-northeast-1

# デプロイ進行状況確認
aws cloudformation describe-stack-events \
  --stack-name embedding-batch-dev \
  --region ap-northeast-1
```

#### 本番環境デプロイメント / Production Deployment

```bash
# 本番環境スタック作成
aws cloudformation create-stack \
  --stack-name embedding-batch-prod \
  --template-body file://cloudformation-template.yaml \
  --parameters file://parameters/production-parameters.json \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --tags Key=Environment,Value=prod Key=Project,Value=EmbeddingBatch \
  --region ap-northeast-1

# 変更セット作成（更新時）
aws cloudformation create-change-set \
  --stack-name embedding-batch-prod \
  --template-body file://cloudformation-template.yaml \
  --parameters file://parameters/production-parameters.json \
  --change-set-name update-$(date +%Y%m%d-%H%M%S) \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM
```

### ステップ5: デプロイメント検証 / Step 5: Deployment Validation

#### スタック状態確認 / Stack Status Check

```bash
# スタック状態確認
aws cloudformation describe-stacks \
  --stack-name embedding-batch-dev \
  --query 'Stacks[0].StackStatus' \
  --output text

# リソース一覧確認
aws cloudformation describe-stack-resources \
  --stack-name embedding-batch-dev
```

#### 出力値確認 / Output Values Check

```bash
# スタック出力確認
aws cloudformation describe-stacks \
  --stack-name embedding-batch-dev \
  --query 'Stacks[0].Outputs'

# 特定の出力値取得
aws cloudformation describe-stacks \
  --stack-name embedding-batch-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
  --output text
```

## 🎛️ パラメータ詳細 / Parameter Details

### 必須パラメータ / Required Parameters

| パラメータ名 / Parameter | 説明 / Description | 例 / Example |
|------------------------|-------------------|-------------|
| `ProjectName` | プロジェクト名 | embedding-batch |
| `Environment` | 環境名 | dev, staging, prod |
| `VpcId` | 既存VPC ID | vpc-xxxxxxxxx |
| `PrivateSubnetIds` | プライベートサブネットID（カンマ区切り） | subnet-xxx,subnet-yyy |

### FSx関連パラメータ / FSx Parameters

| パラメータ名 / Parameter | 説明 / Description | デフォルト / Default |
|------------------------|-------------------|-------------------|
| `FsxFileSystemId` | 既存FSxファイルシステムID | - |
| `FsxSvmId` | 既存FSx SVM ID | - |
| `FsxVolumePath` | FSxボリュームパス | /rag-data |
| `CreateNewFsx` | 新規FSx作成フラグ | false |
| `FsxStorageCapacity` | FSxストレージ容量（GB） | 1024 |
| `FsxThroughputCapacity` | FSxスループット容量（MB/s） | 128 |

### Batch関連パラメータ / Batch Parameters

| パラメータ名 / Parameter | 説明 / Description | デフォルト / Default |
|------------------------|-------------------|-------------------|
| `MaxvCpus` | 最大vCPU数 | 100 |
| `DesiredvCpus` | 希望vCPU数 | 0 |
| `InstanceTypes` | インスタンスタイプ（カンマ区切り） | m5.large,m5.xlarge |
| `EnableSpotInstances` | Spotインスタンス有効化 | false |
| `SpotBidPercentage` | Spot入札率（%） | 50 |

### 監視関連パラメータ / Monitoring Parameters

| パラメータ名 / Parameter | 説明 / Description | デフォルト / Default |
|------------------------|-------------------|-------------------|
| `EnableDetailedMonitoring` | 詳細監視有効化 | false |
| `CreateDashboard` | ダッシュボード作成 | false |
| `AlertEmail` | アラート通知メール | - |
| `LogRetentionDays` | ログ保持日数 | 30 |

## 🔧 カスタマイゼーション / Customization

### テンプレートカスタマイズ / Template Customization

#### 条件付きリソース作成 / Conditional Resource Creation

```yaml
Conditions:
  CreateNewVpc: !Equals [!Ref CreateNewVpcFlag, 'true']
  CreateNewFsx: !Equals [!Ref CreateNewFsxFlag, 'true']
  EnableMonitoring: !Equals [!Ref EnableDetailedMonitoring, 'true']

Resources:
  NewVpc:
    Type: AWS::EC2::VPC
    Condition: CreateNewVpc
    Properties:
      CidrBlock: !Ref VpcCidr
      EnableDnsHostnames: true
      EnableDnsSupport: true

  FsxFileSystem:
    Type: AWS::FSx::FileSystem
    Condition: CreateNewFsx
    Properties:
      FileSystemType: ONTAP
      StorageCapacity: !Ref FsxStorageCapacity
      SubnetIds: !Split [',', !Ref PrivateSubnetIds]
```

#### パラメータ検証 / Parameter Validation

```yaml
Parameters:
  ProjectName:
    Type: String
    Description: Project name for resource naming
    MinLength: 3
    MaxLength: 20
    AllowedPattern: '^[a-zA-Z0-9-]+$'
    ConstraintDescription: Must contain only alphanumeric characters and hyphens

  Environment:
    Type: String
    Description: Environment name
    AllowedValues:
      - dev
      - staging
      - prod
    Default: dev

  MaxvCpus:
    Type: Number
    Description: Maximum number of vCPUs for Batch compute environment
    MinValue: 10
    MaxValue: 10000
    Default: 100
```

### ネストされたスタック / Nested Stacks

#### メインテンプレート / Main Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'FSx for NetApp ONTAP Embedding Batch Workload - Main Stack'

Resources:
  NetworkingStack:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: !Sub 'https://${TemplatesBucket}.s3.amazonaws.com/networking.yaml'
      Parameters:
        ProjectName: !Ref ProjectName
        Environment: !Ref Environment
        VpcCidr: !Ref VpcCidr

  SecurityStack:
    Type: AWS::CloudFormation::Stack
    DependsOn: NetworkingStack
    Properties:
      TemplateURL: !Sub 'https://${TemplatesBucket}.s3.amazonaws.com/security.yaml'
      Parameters:
        ProjectName: !Ref ProjectName
        Environment: !Ref Environment
        VpcId: !GetAtt NetworkingStack.Outputs.VpcId

  BatchStack:
    Type: AWS::CloudFormation::Stack
    DependsOn: [NetworkingStack, SecurityStack]
    Properties:
      TemplateURL: !Sub 'https://${TemplatesBucket}.s3.amazonaws.com/batch.yaml'
      Parameters:
        ProjectName: !Ref ProjectName
        Environment: !Ref Environment
        VpcId: !GetAtt NetworkingStack.Outputs.VpcId
        PrivateSubnetIds: !GetAtt NetworkingStack.Outputs.PrivateSubnetIds
        BatchServiceRole: !GetAtt SecurityStack.Outputs.BatchServiceRole
```

## 🔍 トラブルシューティング / Troubleshooting

### よくあるエラー / Common Errors

#### 1. IAM権限不足 / Insufficient IAM Permissions

**エラー / Error:**
```
User: arn:aws:iam::123456789012:user/username is not authorized to perform: iam:CreateRole
```

**解決方法 / Solution:**
```bash
# 必要な権限を確認
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:user/username \
  --action-names iam:CreateRole \
  --resource-arns "*"
```

#### 2. パラメータ検証エラー / Parameter Validation Error

**エラー / Error:**
```
Parameter validation failed: Invalid value for parameter ProjectName
```

**解決方法 / Solution:**
パラメータファイルの値を確認し、制約に従って修正

#### 3. リソース制限エラー / Resource Limit Error

**エラー / Error:**
```
Limit Exceeded: Cannot exceed quota for vCpus
```

**解決方法 / Solution:**
```bash
# 制限緩和申請
aws service-quotas request-service-quota-increase \
  --service-code ec2 \
  --quota-code L-34B43A08 \
  --desired-value 1000
```

### デバッグ手法 / Debugging Techniques

#### CloudFormation イベント確認 / CloudFormation Events Check

```bash
# 失敗したイベント確認
aws cloudformation describe-stack-events \
  --stack-name embedding-batch-dev \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'

# 特定リソースのイベント確認
aws cloudformation describe-stack-events \
  --stack-name embedding-batch-dev \
  --query 'StackEvents[?LogicalResourceId==`BatchComputeEnvironment`]'
```

#### ドリフト検出 / Drift Detection

```bash
# ドリフト検出開始
aws cloudformation detect-stack-drift \
  --stack-name embedding-batch-dev

# ドリフト結果確認
aws cloudformation describe-stack-drift-detection-status \
  --stack-drift-detection-id DRIFT_DETECTION_ID
```

## 🔄 更新とロールバック / Updates and Rollback

### スタック更新 / Stack Update

#### 変更セット使用 / Using Change Sets

```bash
# 変更セット作成
aws cloudformation create-change-set \
  --stack-name embedding-batch-dev \
  --template-body file://cloudformation-template.yaml \
  --parameters file://parameters/updated-parameters.json \
  --change-set-name update-$(date +%Y%m%d-%H%M%S) \
  --capabilities CAPABILITY_IAM

# 変更セット確認
aws cloudformation describe-change-set \
  --stack-name embedding-batch-dev \
  --change-set-name CHANGE_SET_NAME

# 変更セット実行
aws cloudformation execute-change-set \
  --stack-name embedding-batch-dev \
  --change-set-name CHANGE_SET_NAME
```

#### 直接更新 / Direct Update

```bash
# スタック直接更新
aws cloudformation update-stack \
  --stack-name embedding-batch-dev \
  --template-body file://cloudformation-template.yaml \
  --parameters file://parameters/updated-parameters.json \
  --capabilities CAPABILITY_IAM
```

### ロールバック / Rollback

#### 自動ロールバック / Automatic Rollback

```bash
# 更新失敗時の自動ロールバック有効化
aws cloudformation update-stack \
  --stack-name embedding-batch-dev \
  --template-body file://cloudformation-template.yaml \
  --parameters file://parameters/updated-parameters.json \
  --capabilities CAPABILITY_IAM \
  --disable-rollback false
```

#### 手動ロールバック / Manual Rollback

```bash
# 前の安定状態にロールバック
aws cloudformation cancel-update-stack \
  --stack-name embedding-batch-dev

# 完全削除してから再作成
aws cloudformation delete-stack \
  --stack-name embedding-batch-dev

# 削除完了確認
aws cloudformation wait stack-delete-complete \
  --stack-name embedding-batch-dev
```

## 📊 監視とメンテナンス / Monitoring and Maintenance

### CloudWatch統合 / CloudWatch Integration

#### カスタムメトリクス / Custom Metrics

```yaml
BatchJobFailureAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: !Sub '${ProjectName}-${Environment}-batch-job-failures'
    AlarmDescription: 'Alert when batch jobs fail'
    MetricName: FailedJobs
    Namespace: AWS/Batch
    Statistic: Sum
    Period: 300
    EvaluationPeriods: 2
    Threshold: 5
    ComparisonOperator: GreaterThanThreshold
    Dimensions:
      - Name: JobQueue
        Value: !Ref BatchJobQueue
    AlarmActions:
      - !Ref SNSAlertTopic
```

#### ダッシュボード / Dashboard

```yaml
CloudWatchDashboard:
  Type: AWS::CloudWatch::Dashboard
  Properties:
    DashboardName: !Sub '${ProjectName}-${Environment}-dashboard'
    DashboardBody: !Sub |
      {
        "widgets": [
          {
            "type": "metric",
            "properties": {
              "metrics": [
                ["AWS/Batch", "SubmittedJobs", "JobQueue", "${BatchJobQueue}"],
                [".", "RunnableJobs", ".", "."],
                [".", "RunningJobs", ".", "."]
              ],
              "period": 300,
              "stat": "Sum",
              "region": "${AWS::Region}",
              "title": "Batch Job Status"
            }
          }
        ]
      }
```

### 自動化スクリプト / Automation Scripts

#### デプロイメント自動化 / Deployment Automation

```bash
#!/bin/bash
# deploy-cloudformation.sh

set -euo pipefail

STACK_NAME="$1"
ENVIRONMENT="$2"
PARAMETERS_FILE="parameters/${ENVIRONMENT}-parameters.json"

echo "Deploying CloudFormation stack: $STACK_NAME"

# パラメータファイル存在確認
if [ ! -f "$PARAMETERS_FILE" ]; then
    echo "Error: Parameters file not found: $PARAMETERS_FILE"
    exit 1
fi

# スタック存在確認
if aws cloudformation describe-stacks --stack-name "$STACK_NAME" &>/dev/null; then
    echo "Updating existing stack..."
    aws cloudformation update-stack \
        --stack-name "$STACK_NAME" \
        --template-body file://cloudformation-template.yaml \
        --parameters file://"$PARAMETERS_FILE" \
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM
else
    echo "Creating new stack..."
    aws cloudformation create-stack \
        --stack-name "$STACK_NAME" \
        --template-body file://cloudformation-template.yaml \
        --parameters file://"$PARAMETERS_FILE" \
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM
fi

echo "Waiting for stack operation to complete..."
aws cloudformation wait stack-update-complete --stack-name "$STACK_NAME" || \
aws cloudformation wait stack-create-complete --stack-name "$STACK_NAME"

echo "Stack operation completed successfully!"
```

## 🚀 次のステップ / Next Steps

1. **テンプレートカスタマイズ / Template Customization**
   - 組織固有の要件に合わせてテンプレートを調整
   - Customize templates for organization-specific requirements

2. **CI/CDパイプライン統合 / CI/CD Pipeline Integration**
   - GitHubActions、Jenkins等との統合
   - Integration with GitHub Actions, Jenkins, etc.

3. **マルチ環境管理 / Multi-environment Management**
   - 開発、ステージング、本番環境の管理
   - Management of dev, staging, and production environments

4. **セキュリティ強化 / Security Enhancement**
   - IAM権限の最小化
   - 暗号化設定の強化
   - Minimize IAM permissions and enhance encryption

## 📚 参考資料 / References

- [AWS CloudFormation User Guide](https://docs.aws.amazon.com/cloudformation/)
- [AWS CloudFormation Template Reference](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-reference.html)
- [AWS Batch User Guide](https://docs.aws.amazon.com/batch/latest/userguide/)
- [FSx for NetApp ONTAP User Guide](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/)
- [CloudFormation Best Practices](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/best-practices.html)