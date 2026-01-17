# ⚙️ CloudFormation Configuration Guide

このガイドでは、Embedding Batch Workload Template のCloudFormationテンプレートの詳細な設定方法を説明します。

## 📋 目次

- [🎯 設定概要](#-設定概要)
- [📝 パラメータ詳細](#-パラメータ詳細)
- [🏗️ リソース設定](#️-リソース設定)
- [🔧 カスタマイズ](#-カスタマイズ)
- [🌍 マルチリージョン設定](#-マルチリージョン設定)
- [🔒 セキュリティ設定](#-セキュリティ設定)

---

## 🎯 設定概要

### 基本的な設定ファイル構造

```
cloudformation/
├── templates/
│   ├── main-template.yaml          # メインテンプレート
│   ├── nested/
│   │   ├── batch-resources.yaml    # Batch関連リソース
│   │   ├── iam-resources.yaml      # IAM関連リソース
│   │   └── security-resources.yaml # セキュリティ関連リソース
├── parameters/
│   ├── dev-parameters.json         # 開発環境用パラメータ
│   ├── staging-parameters.json     # ステージング環境用パラメータ
│   └── prod-parameters.json        # 本番環境用パラメータ
└── scripts/
    ├── deploy.sh                   # デプロイスクリプト
    └── validate.sh                 # 検証スクリプト
```

### 設定の優先順位

1. **コマンドライン引数** (最高優先度)
2. **パラメータファイル**
3. **テンプレートのデフォルト値**
4. **環境変数** (最低優先度)

---

## 📝 パラメータ詳細

### 必須パラメータ

#### 1. ネットワーク設定

```json
{
  "ParameterKey": "VpcId",
  "ParameterValue": "vpc-12345678",
  "Description": "既存のVPC ID"
}
```

**設定例:**
```json
{
  "Parameters": [
    {
      "ParameterKey": "VpcId",
      "ParameterValue": "vpc-0a1b2c3d4e5f67890"
    },
    {
      "ParameterKey": "SubnetIds",
      "ParameterValue": "subnet-12345678,subnet-87654321,subnet-abcdef12"
    },
    {
      "ParameterKey": "AvailabilityZones",
      "ParameterValue": "us-east-1a,us-east-1b,us-east-1c"
    }
  ]
}
```

**検証方法:**
```bash
# VPCの存在確認
aws ec2 describe-vpcs --vpc-ids vpc-0a1b2c3d4e5f67890

# サブネットの確認
aws ec2 describe-subnets --subnet-ids subnet-12345678,subnet-87654321
```

#### 2. FSx設定

```json
{
  "ParameterKey": "FsxFileSystemId",
  "ParameterValue": "fs-0123456789abcdef0",
  "Description": "FSx for NetApp ONTAP ファイルシステムID"
}
```

**詳細設定:**
```json
{
  "Parameters": [
    {
      "ParameterKey": "FsxFileSystemId",
      "ParameterValue": "fs-0123456789abcdef0"
    },
    {
      "ParameterKey": "FsxDnsName",
      "ParameterValue": "fs-0123456789abcdef0.fsx.us-east-1.amazonaws.com"
    },
    {
      "ParameterKey": "FsxMountName",
      "ParameterValue": "vol1"
    },
    {
      "ParameterKey": "FsxMountPath",
      "ParameterValue": "/rag-data"
    }
  ]
}
```

#### 3. Bedrock設定

```json
{
  "Parameters": [
    {
      "ParameterKey": "BedrockRegion",
      "ParameterValue": "us-east-1"
    },
    {
      "ParameterKey": "EmbeddingModel",
      "ParameterValue": "amazon.titan-embed-text-v1"
    },
    {
      "ParameterKey": "ChatModel",
      "ParameterValue": "amazon.nova-pro-v1:0"
    }
  ]
}
```

### オプションパラメータ

#### 1. プロジェクト設定

```json
{
  "Parameters": [
    {
      "ParameterKey": "ProjectName",
      "ParameterValue": "my-embedding-project"
    },
    {
      "ParameterKey": "Environment",
      "ParameterValue": "production"
    },
    {
      "ParameterKey": "Owner",
      "ParameterValue": "data-team"
    },
    {
      "ParameterKey": "CostCenter",
      "ParameterValue": "AI-ML-001"
    }
  ]
}
```

#### 2. Batch設定

```json
{
  "Parameters": [
    {
      "ParameterKey": "BatchMinvCpus",
      "ParameterValue": "0"
    },
    {
      "ParameterKey": "BatchMaxvCpus",
      "ParameterValue": "500"
    },
    {
      "ParameterKey": "BatchDesiredvCpus",
      "ParameterValue": "10"
    },
    {
      "ParameterKey": "BatchInstanceTypes",
      "ParameterValue": "m5.large,m5.xlarge,m5.2xlarge"
    },
    {
      "ParameterKey": "BatchSpotFleetRequestIamRole",
      "ParameterValue": "arn:aws:iam::123456789012:role/aws-ec2-spot-fleet-tagging-role"
    }
  ]
}
```

#### 3. セキュリティ設定

```json
{
  "Parameters": [
    {
      "ParameterKey": "EnableVpcFlowLogs",
      "ParameterValue": "true"
    },
    {
      "ParameterKey": "EnableCloudTrail",
      "ParameterValue": "true"
    },
    {
      "ParameterKey": "KmsKeyId",
      "ParameterValue": "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012"
    },
    {
      "ParameterKey": "EnableEncryption",
      "ParameterValue": "true"
    }
  ]
}
```

---

## 🏗️ リソース設定

### 1. Batch Compute Environment

#### 基本設定
```yaml
BatchComputeEnvironment:
  Type: AWS::Batch::ComputeEnvironment
  Properties:
    Type: MANAGED
    State: ENABLED
    ServiceRole: !GetAtt BatchServiceRole.Arn
    ComputeResources:
      Type: EC2
      MinvCpus: !Ref BatchMinvCpus
      MaxvCpus: !Ref BatchMaxvCpus
      DesiredvCpus: !Ref BatchDesiredvCpus
      InstanceTypes: !Split [',', !Ref BatchInstanceTypes]
      Subnets: !Split [',', !Ref SubnetIds]
      SecurityGroupIds:
        - !Ref BatchSecurityGroup
      InstanceRole: !GetAtt BatchInstanceProfile.Arn
      Tags:
        Project: !Ref ProjectName
        Environment: !Ref Environment
        Component: BatchCompute
```

#### 高度な設定
```yaml
BatchComputeEnvironment:
  Type: AWS::Batch::ComputeEnvironment
  Properties:
    Type: MANAGED
    State: ENABLED
    ServiceRole: !GetAtt BatchServiceRole.Arn
    ComputeResources:
      Type: EC2
      AllocationStrategy: BEST_FIT_PROGRESSIVE
      MinvCpus: !Ref BatchMinvCpus
      MaxvCpus: !Ref BatchMaxvCpus
      DesiredvCpus: !Ref BatchDesiredvCpus
      InstanceTypes: !Split [',', !Ref BatchInstanceTypes]
      Subnets: !Split [',', !Ref SubnetIds]
      SecurityGroupIds:
        - !Ref BatchSecurityGroup
      InstanceRole: !GetAtt BatchInstanceProfile.Arn
      Ec2Configuration:
        - ImageType: ECS_AL2
      UserData: !Base64
        Fn::Sub: |
          #!/bin/bash
          yum update -y
          yum install -y nfs-utils
          mkdir -p ${FsxMountPath}
          mount -t nfs4 -o nfsvers=4.1,rsize=1048576,wsize=1048576,hard,timeo=600,retrans=2 ${FsxDnsName}:/${FsxMountName} ${FsxMountPath}
          echo "${FsxDnsName}:/${FsxMountName} ${FsxMountPath} nfs4 nfsvers=4.1,rsize=1048576,wsize=1048576,hard,timeo=600,retrans=2 0 0" >> /etc/fstab
      Tags:
        Project: !Ref ProjectName
        Environment: !Ref Environment
        Component: BatchCompute
        CostCenter: !Ref CostCenter
```

### 2. Job Definitions

#### Document Processing Job
```yaml
DocumentProcessingJobDefinition:
  Type: AWS::Batch::JobDefinition
  Properties:
    Type: container
    JobDefinitionName: !Sub "${ProjectName}-${Environment}-document-processing"
    ContainerProperties:
      Image: !Sub "${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/embedding-batch-workload:document-processor"
      Vcpus: 2
      Memory: 4096
      JobRoleArn: !GetAtt BatchJobRole.Arn
      Environment:
        - Name: FSX_MOUNT_PATH
          Value: !Ref FsxMountPath
        - Name: BEDROCK_REGION
          Value: !Ref BedrockRegion
        - Name: PROJECT_NAME
          Value: !Ref ProjectName
        - Name: ENVIRONMENT
          Value: !Ref Environment
      MountPoints:
        - SourceVolume: rag-data
          ContainerPath: !Ref FsxMountPath
          ReadOnly: false
      Volumes:
        - Name: rag-data
          Host:
            SourcePath: !Ref FsxMountPath
      LogConfiguration:
        LogDriver: awslogs
        Options:
          awslogs-group: !Ref BatchLogGroup
          awslogs-region: !Ref AWS::Region
          awslogs-stream-prefix: document-processing
    RetryStrategy:
      Attempts: 3
    Timeout:
      AttemptDurationSeconds: 3600
```

#### Embedding Generation Job
```yaml
EmbeddingGenerationJobDefinition:
  Type: AWS::Batch::JobDefinition
  Properties:
    Type: container
    JobDefinitionName: !Sub "${ProjectName}-${Environment}-embedding-generation"
    ContainerProperties:
      Image: !Sub "${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/embedding-batch-workload:embedding-generator"
      Vcpus: 4
      Memory: 8192
      JobRoleArn: !GetAtt BatchJobRole.Arn
      Environment:
        - Name: BEDROCK_REGION
          Value: !Ref BedrockRegion
        - Name: EMBEDDING_MODEL
          Value: !Ref EmbeddingModel
        - Name: BATCH_SIZE
          Value: "100"
        - Name: S3_BUCKET
          Value: !Ref S3Bucket
        - Name: DYNAMODB_TABLE
          Value: !Ref DynamoDBTable
      LogConfiguration:
        LogDriver: awslogs
        Options:
          awslogs-group: !Ref BatchLogGroup
          awslogs-region: !Ref AWS::Region
          awslogs-stream-prefix: embedding-generation
    RetryStrategy:
      Attempts: 2
    Timeout:
      AttemptDurationSeconds: 7200
```

### 3. IAM Roles

#### Batch Service Role
```yaml
BatchServiceRole:
  Type: AWS::IAM::Role
  Properties:
    RoleName: !Sub "${ProjectName}-${Environment}-batch-service-role"
    AssumeRolePolicyDocument:
      Version: '2012-10-17'
      Statement:
        - Effect: Allow
          Principal:
            Service: batch.amazonaws.com
          Action: sts:AssumeRole
    ManagedPolicyArns:
      - arn:aws:iam::aws:policy/service-role/AWSBatchServiceRole
    Tags:
      - Key: Project
        Value: !Ref ProjectName
      - Key: Environment
        Value: !Ref Environment
      - Key: Component
        Value: BatchService
```

#### Batch Job Role
```yaml
BatchJobRole:
  Type: AWS::IAM::Role
  Properties:
    RoleName: !Sub "${ProjectName}-${Environment}-batch-job-role"
    AssumeRolePolicyDocument:
      Version: '2012-10-17'
      Statement:
        - Effect: Allow
          Principal:
            Service: ecs-tasks.amazonaws.com
          Action: sts:AssumeRole
    Policies:
      - PolicyName: BedrockAccess
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - bedrock:InvokeModel
                - bedrock:InvokeModelWithResponseStream
              Resource:
                - !Sub "arn:aws:bedrock:${BedrockRegion}::foundation-model/${EmbeddingModel}"
                - !Sub "arn:aws:bedrock:${BedrockRegion}::foundation-model/${ChatModel}"
      - PolicyName: S3Access
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - s3:GetObject
                - s3:PutObject
                - s3:DeleteObject
              Resource: !Sub "${S3Bucket}/*"
            - Effect: Allow
              Action:
                - s3:ListBucket
              Resource: !Ref S3Bucket
      - PolicyName: DynamoDBAccess
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - dynamodb:GetItem
                - dynamodb:PutItem
                - dynamodb:UpdateItem
                - dynamodb:DeleteItem
                - dynamodb:Query
                - dynamodb:Scan
              Resource: !GetAtt DynamoDBTable.Arn
```

---

## 🔧 カスタマイズ

### 1. 環境別設定

#### 開発環境 (dev-parameters.json)
```json
{
  "Parameters": [
    {
      "ParameterKey": "ProjectName",
      "ParameterValue": "embedding-dev"
    },
    {
      "ParameterKey": "Environment",
      "ParameterValue": "development"
    },
    {
      "ParameterKey": "BatchMaxvCpus",
      "ParameterValue": "50"
    },
    {
      "ParameterKey": "BatchInstanceTypes",
      "ParameterValue": "t3.medium,t3.large"
    },
    {
      "ParameterKey": "EnableCloudTrail",
      "ParameterValue": "false"
    },
    {
      "ParameterKey": "EnableVpcFlowLogs",
      "ParameterValue": "false"
    }
  ]
}
```

#### 本番環境 (prod-parameters.json)
```json
{
  "Parameters": [
    {
      "ParameterKey": "ProjectName",
      "ParameterValue": "embedding-prod"
    },
    {
      "ParameterKey": "Environment",
      "ParameterValue": "production"
    },
    {
      "ParameterKey": "BatchMaxvCpus",
      "ParameterValue": "1000"
    },
    {
      "ParameterKey": "BatchInstanceTypes",
      "ParameterValue": "m5.large,m5.xlarge,m5.2xlarge,c5.large,c5.xlarge"
    },
    {
      "ParameterKey": "EnableCloudTrail",
      "ParameterValue": "true"
    },
    {
      "ParameterKey": "EnableVpcFlowLogs",
      "ParameterValue": "true"
    },
    {
      "ParameterKey": "EnableEncryption",
      "ParameterValue": "true"
    }
  ]
}
```

### 2. コスト最適化設定

#### Spot インスタンスの使用
```yaml
BatchComputeEnvironment:
  Type: AWS::Batch::ComputeEnvironment
  Properties:
    ComputeResources:
      Type: EC2
      BidPercentage: 50  # Spot価格の50%まで
      InstanceTypes:
        - m5.large
        - m5.xlarge
        - c5.large
        - c5.xlarge
      SpotIamFleetRequestRole: !Ref BatchSpotFleetRequestIamRole
```

#### 自動スケーリング設定
```yaml
BatchComputeEnvironment:
  Properties:
    ComputeResources:
      MinvCpus: 0          # 最小0でコスト削減
      MaxvCpus: !Ref BatchMaxvCpus
      DesiredvCpus: 0      # 初期は0
      AllocationStrategy: SPOT_CAPACITY_OPTIMIZED
```

### 3. パフォーマンス最適化

#### CPU集約的ワークロード
```json
{
  "ParameterKey": "BatchInstanceTypes",
  "ParameterValue": "c5.large,c5.xlarge,c5.2xlarge,c5.4xlarge"
}
```

#### メモリ集約的ワークロード
```json
{
  "ParameterKey": "BatchInstanceTypes",
  "ParameterValue": "r5.large,r5.xlarge,r5.2xlarge,r5.4xlarge"
}
```

#### GPU使用ワークロード
```json
{
  "ParameterKey": "BatchInstanceTypes",
  "ParameterValue": "p3.2xlarge,p3.8xlarge,g4dn.xlarge,g4dn.2xlarge"
}
```

---

## 🌍 マルチリージョン設定

### 1. リージョン固有パラメータ

#### US East 1 (バージニア)
```json
{
  "Parameters": [
    {
      "ParameterKey": "Region",
      "ParameterValue": "us-east-1"
    },
    {
      "ParameterKey": "BedrockRegion",
      "ParameterValue": "us-east-1"
    },
    {
      "ParameterKey": "AvailabilityZones",
      "ParameterValue": "us-east-1a,us-east-1b,us-east-1c"
    }
  ]
}
```

#### EU West 1 (アイルランド)
```json
{
  "Parameters": [
    {
      "ParameterKey": "Region",
      "ParameterValue": "eu-west-1"
    },
    {
      "ParameterKey": "BedrockRegion",
      "ParameterValue": "us-east-1"
    },
    {
      "ParameterKey": "AvailabilityZones",
      "ParameterValue": "eu-west-1a,eu-west-1b,eu-west-1c"
    }
  ]
}
```

### 2. クロスリージョンレプリケーション

#### S3 Cross-Region Replication
```yaml
S3BucketReplication:
  Type: AWS::S3::Bucket
  Properties:
    ReplicationConfiguration:
      Role: !GetAtt S3ReplicationRole.Arn
      Rules:
        - Id: ReplicateToSecondaryRegion
          Status: Enabled
          Prefix: embeddings/
          Destination:
            Bucket: !Sub "arn:aws:s3:::${ProjectName}-${Environment}-backup-${SecondaryRegion}"
            StorageClass: STANDARD_IA
```

### 3. データ主権とコンプライアンス

#### GDPR準拠設定 (EU)
```json
{
  "Parameters": [
    {
      "ParameterKey": "DataResidencyRegion",
      "ParameterValue": "eu-west-1"
    },
    {
      "ParameterKey": "EnableDataEncryption",
      "ParameterValue": "true"
    },
    {
      "ParameterKey": "DataRetentionDays",
      "ParameterValue": "2555"
    },
    {
      "ParameterKey": "EnableAuditLogging",
      "ParameterValue": "true"
    }
  ]
}
```

---

## 🔒 セキュリティ設定

### 1. 暗号化設定

#### KMS暗号化
```yaml
KMSKey:
  Type: AWS::KMS::Key
  Properties:
    Description: !Sub "KMS key for ${ProjectName}-${Environment}"
    KeyPolicy:
      Version: '2012-10-17'
      Statement:
        - Sid: Enable IAM User Permissions
          Effect: Allow
          Principal:
            AWS: !Sub "arn:aws:iam::${AWS::AccountId}:root"
          Action: "kms:*"
          Resource: "*"
        - Sid: Allow Batch Service
          Effect: Allow
          Principal:
            Service: batch.amazonaws.com
          Action:
            - kms:Decrypt
            - kms:GenerateDataKey
          Resource: "*"

KMSKeyAlias:
  Type: AWS::KMS::Alias
  Properties:
    AliasName: !Sub "alias/${ProjectName}-${Environment}-key"
    TargetKeyId: !Ref KMSKey
```

#### S3暗号化
```yaml
S3Bucket:
  Type: AWS::S3::Bucket
  Properties:
    BucketEncryption:
      ServerSideEncryptionConfiguration:
        - ServerSideEncryptionByDefault:
            SSEAlgorithm: aws:kms
            KMSMasterKeyID: !Ref KMSKey
          BucketKeyEnabled: true
```

### 2. ネットワークセキュリティ

#### VPC Endpoints
```yaml
BedrockVPCEndpoint:
  Type: AWS::EC2::VPCEndpoint
  Properties:
    VpcId: !Ref VpcId
    ServiceName: !Sub "com.amazonaws.${AWS::Region}.bedrock-runtime"
    VpcEndpointType: Interface
    SubnetIds: !Split [',', !Ref SubnetIds]
    SecurityGroupIds:
      - !Ref VPCEndpointSecurityGroup
    PolicyDocument:
      Version: '2012-10-17'
      Statement:
        - Effect: Allow
          Principal: "*"
          Action:
            - bedrock:InvokeModel
            - bedrock:InvokeModelWithResponseStream
          Resource: "*"
```

#### セキュリティグループ
```yaml
BatchSecurityGroup:
  Type: AWS::EC2::SecurityGroup
  Properties:
    GroupDescription: Security group for Batch compute environment
    VpcId: !Ref VpcId
    SecurityGroupEgress:
      - IpProtocol: tcp
        FromPort: 2049
        ToPort: 2049
        CidrIp: 10.0.0.0/8
        Description: NFS access to FSx
      - IpProtocol: tcp
        FromPort: 443
        ToPort: 443
        CidrIp: 0.0.0.0/0
        Description: HTTPS for AWS services
      - IpProtocol: tcp
        FromPort: 80
        ToPort: 80
        CidrIp: 0.0.0.0/0
        Description: HTTP for package downloads
    Tags:
      - Key: Name
        Value: !Sub "${ProjectName}-${Environment}-batch-sg"
```

### 3. アクセス制御

#### リソースベースポリシー
```yaml
S3BucketPolicy:
  Type: AWS::S3::BucketPolicy
  Properties:
    Bucket: !Ref S3Bucket
    PolicyDocument:
      Version: '2012-10-17'
      Statement:
        - Sid: DenyInsecureConnections
          Effect: Deny
          Principal: "*"
          Action: "s3:*"
          Resource:
            - !Sub "${S3Bucket}/*"
            - !Ref S3Bucket
          Condition:
            Bool:
              "aws:SecureTransport": "false"
        - Sid: AllowBatchJobAccess
          Effect: Allow
          Principal:
            AWS: !GetAtt BatchJobRole.Arn
          Action:
            - s3:GetObject
            - s3:PutObject
            - s3:DeleteObject
          Resource: !Sub "${S3Bucket}/*"
```

### 4. 監査とログ

#### CloudTrail設定
```yaml
CloudTrail:
  Type: AWS::CloudTrail::Trail
  Condition: EnableCloudTrailCondition
  Properties:
    TrailName: !Sub "${ProjectName}-${Environment}-cloudtrail"
    S3BucketName: !Ref CloudTrailBucket
    S3KeyPrefix: !Sub "${ProjectName}/${Environment}/"
    IncludeGlobalServiceEvents: true
    IsMultiRegionTrail: true
    EnableLogFileValidation: true
    KMSKeyId: !Ref KMSKey
    EventSelectors:
      - ReadWriteType: All
        IncludeManagementEvents: true
        DataResources:
          - Type: "AWS::S3::Object"
            Values:
              - !Sub "${S3Bucket}/*"
          - Type: "AWS::Batch::Job"
            Values:
              - "*"
```

---

## 🔄 設定の検証

### 1. パラメータ検証

```bash
# パラメータファイルの構文チェック
jq empty parameters/prod-parameters.json

# 必須パラメータの確認
./scripts/validate-cloudformation.sh --parameters parameters/prod-parameters.json --check-required
```

### 2. テンプレート検証

```bash
# CloudFormationテンプレートの構文チェック
aws cloudformation validate-template --template-body file://templates/main-template.yaml

# セキュリティ検証
./scripts/validate-cloudformation.sh --template templates/main-template.yaml --security
```

### 3. デプロイ前検証

```bash
# 変更セットによる事前確認
aws cloudformation create-change-set \
  --stack-name embedding-batch-workload \
  --change-set-name pre-deploy-validation \
  --template-body file://templates/main-template.yaml \
  --parameters file://parameters/prod-parameters.json \
  --capabilities CAPABILITY_IAM

# 変更内容の確認
aws cloudformation describe-change-set \
  --stack-name embedding-batch-workload \
  --change-set-name pre-deploy-validation
```

---

この設定ガイドを参考に、環境に応じた最適な設定を行ってください。追加の設定が必要な場合は、[トラブルシューティングガイド](./CLOUDFORMATION_TROUBLESHOOTING_GUIDE.md)も併せてご確認ください。