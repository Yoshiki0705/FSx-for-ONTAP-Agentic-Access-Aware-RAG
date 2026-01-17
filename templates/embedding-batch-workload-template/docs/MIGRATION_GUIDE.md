# 🔄 CDK ⇄ CloudFormation 移行ガイド / Migration Guide

## 📋 概要 / Overview

このガイドでは、FSx for NetApp ONTAP Embedding Batch WorkloadのCDKとCloudFormation間の移行方法について説明します。

This guide explains how to migrate between CDK and CloudFormation for the FSx for NetApp ONTAP Embedding Batch Workload.

## 🎯 移行シナリオ / Migration Scenarios

### 1. CDK → CloudFormation 移行

#### 適用場面 / Use Cases
- 開発フェーズから本番運用フェーズへの移行
- ガバナンス要件の強化
- 運用チームへの管理移譲
- 標準化されたデプロイメントプロセスの確立

#### メリット / Benefits
✅ **ガバナンス強化**: 変更セットによる事前確認  
✅ **可視性向上**: AWSコンソールでの直接管理  
✅ **標準化**: AWS標準ツールによる統一  
✅ **依存関係削減**: Node.js環境が不要  

### 2. CloudFormation → CDK 移行

#### 適用場面 / Use Cases
- 開発効率の向上が必要
- 複雑な条件分岐やループが必要
- テスト自動化の導入
- モジュール化・再利用性の向上

#### メリット / Benefits
✅ **開発効率**: プログラマティックな記述  
✅ **型安全性**: TypeScriptによる型チェック  
✅ **テスト可能**: ユニットテストの実装  
✅ **再利用性**: コンストラクトの共有  

## 🚀 CDK → CloudFormation 移行手順

### ステップ1: 現状確認 / Current State Assessment

#### CDK環境の確認
```bash
# CDKバージョン確認
npx cdk --version

# 現在のスタック一覧
npx cdk list

# スタック詳細確認
npx cdk diff embedding-workload-dev
```

#### 依存関係の確認
```bash
# package.json確認
cat cdk/package.json

# 使用しているCDKコンストラクト確認
grep -r "import.*aws-cdk" cdk/lib/
```

### ステップ2: CloudFormationテンプレート生成

#### 2.1 テンプレート生成スクリプト作成
```bash
#!/bin/bash
# generate-cloudformation-templates.sh

set -euo pipefail

ENVIRONMENTS=("dev" "staging" "prod")
OUTPUT_DIR="cloudformation-templates"

# 出力ディレクトリ作成
mkdir -p "$OUTPUT_DIR"

echo "🔄 CloudFormationテンプレート生成開始"

for env in "${ENVIRONMENTS[@]}"; do
    echo "📦 環境 $env のテンプレート生成中..."
    
    # 環境固有の設定でCDK synth実行
    CDK_ENVIRONMENT="$env" npx cdk synth \
        --output "$OUTPUT_DIR/$env" \
        --path-metadata false \
        --version-reporting false
    
    # メインテンプレートをリネーム
    if [[ -f "$OUTPUT_DIR/$env/EmbeddingWorkloadStack.template.json" ]]; then
        cp "$OUTPUT_DIR/$env/EmbeddingWorkloadStack.template.json" \
           "$OUTPUT_DIR/EmbeddingWorkloadStack-$env.template.json"
        echo "✅ $env 環境テンプレート生成完了"
    else
        echo "❌ $env 環境テンプレート生成失敗"
    fi
done

echo "🎉 全環境のテンプレート生成完了"
```

#### 2.2 パラメータ化スクリプト作成
```bash
#!/bin/bash
# parameterize-templates.sh

set -euo pipefail

# テンプレートのパラメータ化
parameterize_template() {
    local template_file="$1"
    local output_file="$2"
    
    echo "📝 テンプレートパラメータ化: $template_file"
    
    # jqを使用してハードコードされた値をパラメータに変換
    jq '
        # VPC IDをパラメータ化
        .Parameters.VpcId = {
            "Type": "AWS::EC2::VPC::Id",
            "Description": "VPC ID where resources will be created"
        } |
        
        # サブネットIDをパラメータ化
        .Parameters.SubnetIds = {
            "Type": "List<AWS::EC2::Subnet::Id>",
            "Description": "List of private subnet IDs"
        } |
        
        # FSx IDをパラメータ化
        .Parameters.FsxFileSystemId = {
            "Type": "String",
            "Description": "FSx for NetApp ONTAP file system ID",
            "AllowedPattern": "^fs-[0-9a-f]{17}$"
        } |
        
        # リソース内の参照を更新
        walk(
            if type == "object" and has("Ref") and .Ref == "VpcXXXXXXXX" then
                .Ref = "VpcId"
            else . end
        )
    ' "$template_file" > "$output_file"
    
    echo "✅ パラメータ化完了: $output_file"
}

# 全テンプレートをパラメータ化
for template in cloudformation-templates/*.template.json; do
    if [[ -f "$template" ]]; then
        output_file="${template%.template.json}-parameterized.template.json"
        parameterize_template "$template" "$output_file"
    fi
done
```

### ステップ3: パラメータファイル生成

#### 3.1 環境別パラメータファイル作成
```bash
#!/bin/bash
# generate-parameters.sh

generate_parameters() {
    local environment="$1"
    local output_file="parameters/parameters-${environment}.json"
    
    mkdir -p parameters
    
    cat > "$output_file" << EOF
{
  "Parameters": [
    {
      "ParameterKey": "ProjectName",
      "ParameterValue": "embedding-batch-${environment}"
    },
    {
      "ParameterKey": "Environment",
      "ParameterValue": "${environment}"
    },
    {
      "ParameterKey": "VpcId",
      "ParameterValue": "vpc-${environment}123456789"
    },
    {
      "ParameterKey": "SubnetIds",
      "ParameterValue": "subnet-${environment}111,subnet-${environment}222"
    },
    {
      "ParameterKey": "FsxFileSystemId",
      "ParameterValue": "fs-${environment}123456789abcdef0"
    }
EOF

    # 環境固有設定
    case "$environment" in
        "dev")
            cat >> "$output_file" << EOF
    ,
    {
      "ParameterKey": "MaxvCpus",
      "ParameterValue": "50"
    },
    {
      "ParameterKey": "InstanceTypes",
      "ParameterValue": "m5.large"
    },
    {
      "ParameterKey": "EnableSpotInstances",
      "ParameterValue": "true"
    }
EOF
            ;;
        "prod")
            cat >> "$output_file" << EOF
    ,
    {
      "ParameterKey": "MaxvCpus",
      "ParameterValue": "1000"
    },
    {
      "ParameterKey": "InstanceTypes",
      "ParameterValue": "m5.xlarge,m5.2xlarge"
    },
    {
      "ParameterKey": "EnableDetailedMonitoring",
      "ParameterValue": "true"
    }
EOF
            ;;
    esac

    cat >> "$output_file" << EOF
  ]
}
EOF

    echo "✅ パラメータファイル生成完了: $output_file"
}

# 全環境のパラメータファイル生成
for env in dev staging prod; do
    generate_parameters "$env"
done
```

### ステップ4: 移行検証

#### 4.1 テンプレート検証
```bash
# 構文チェック
./scripts/validate-cloudformation.sh --all --lint --security

# 特定環境の検証
./scripts/validate-cloudformation.sh --environment dev
```

#### 4.2 ドライラン実行
```bash
# 変更セットによる事前確認
aws cloudformation create-change-set \
    --stack-name embedding-batch-dev-migration-test \
    --template-body file://cloudformation-templates/EmbeddingWorkloadStack-dev-parameterized.template.json \
    --parameters file://parameters/parameters-dev.json \
    --change-set-name migration-preview \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM

# 変更内容確認
aws cloudformation describe-change-set \
    --stack-name embedding-batch-dev-migration-test \
    --change-set-name migration-preview
```

### ステップ5: 段階的移行実行

#### 5.1 開発環境での検証
```bash
# 1. 新しいスタック名でデプロイ
aws cloudformation create-stack \
    --stack-name embedding-batch-dev-cf \
    --template-body file://cloudformation-templates/EmbeddingWorkloadStack-dev-parameterized.template.json \
    --parameters file://parameters/parameters-dev.json \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM

# 2. 機能テスト実行
./scripts/validate.sh --env dev --stack-name embedding-batch-dev-cf

# 3. 問題なければCDKスタック削除
npx cdk destroy embedding-workload-dev
```

#### 5.2 本番環境への適用
```bash
# メンテナンス時間での移行
# 1. 現在のスタック状態をバックアップ
aws cloudformation get-template \
    --stack-name embedding-workload-prod \
    --template-stage Original > backup-template.json

# 2. CloudFormationスタックとして再作成
aws cloudformation create-stack \
    --stack-name embedding-batch-prod-cf \
    --template-body file://cloudformation-templates/EmbeddingWorkloadStack-prod-parameterized.template.json \
    --parameters file://parameters/parameters-prod.json \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM

# 3. 検証後、旧スタック削除
npx cdk destroy embedding-workload-prod
```

## 🔄 CloudFormation → CDK 移行手順

### ステップ1: CDK環境準備

#### 1.1 CDKプロジェクト初期化
```bash
# 新しいCDKプロジェクト作成
mkdir embedding-workload-cdk
cd embedding-workload-cdk

# CDK初期化
npx cdk init app --language typescript

# 必要な依存関係追加
npm install @aws-cdk/aws-batch @aws-cdk/aws-ec2 @aws-cdk/aws-iam @aws-cdk/aws-s3
```

#### 1.2 既存リソースの分析
```bash
# 既存スタックの詳細取得
aws cloudformation describe-stacks \
    --stack-name embedding-batch-prod \
    --output json > existing-stack.json

# リソース一覧取得
aws cloudformation describe-stack-resources \
    --stack-name embedding-batch-prod \
    --output json > existing-resources.json
```

### ステップ2: CDKコード生成

#### 2.1 自動変換ツール使用
```typescript
// tools/cloudformation-to-cdk.ts
import * as fs from 'fs';
import * as cdk from 'aws-cdk-lib';

export class CloudFormationToCdkConverter {
    
    convertTemplate(templatePath: string): string {
        const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
        
        let cdkCode = `
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class MigratedStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        
`;

        // パラメータ変換
        if (template.Parameters) {
            cdkCode += this.convertParameters(template.Parameters);
        }
        
        // リソース変換
        if (template.Resources) {
            cdkCode += this.convertResources(template.Resources);
        }
        
        cdkCode += `
    }
}`;
        
        return cdkCode;
    }
    
    private convertParameters(parameters: any): string {
        let code = '\n        // Parameters\n';
        
        for (const [name, param] of Object.entries(parameters)) {
            const paramDef = param as any;
            code += `        const ${name.toLowerCase()} = new cdk.CfnParameter(this, '${name}', {\n`;
            code += `            type: '${paramDef.Type}',\n`;
            if (paramDef.Description) {
                code += `            description: '${paramDef.Description}',\n`;
            }
            if (paramDef.Default) {
                code += `            default: '${paramDef.Default}',\n`;
            }
            code += `        });\n\n`;
        }
        
        return code;
    }
    
    private convertResources(resources: any): string {
        let code = '\n        // Resources\n';
        
        for (const [logicalId, resource] of Object.entries(resources)) {
            const resourceDef = resource as any;
            code += this.convertResource(logicalId, resourceDef);
        }
        
        return code;
    }
    
    private convertResource(logicalId: string, resource: any): string {
        switch (resource.Type) {
            case 'AWS::IAM::Role':
                return this.convertIamRole(logicalId, resource);
            case 'AWS::Batch::ComputeEnvironment':
                return this.convertBatchComputeEnvironment(logicalId, resource);
            case 'AWS::EC2::SecurityGroup':
                return this.convertSecurityGroup(logicalId, resource);
            default:
                return `        // TODO: Convert ${resource.Type} - ${logicalId}\n`;
        }
    }
    
    private convertIamRole(logicalId: string, resource: any): string {
        const props = resource.Properties;
        return `
        const ${logicalId.toLowerCase()} = new iam.Role(this, '${logicalId}', {
            assumedBy: new iam.ServicePrincipal('${props.AssumeRolePolicyDocument.Statement[0].Principal.Service}'),
            managedPolicies: [
                ${props.ManagedPolicyArns?.map((arn: string) => `iam.ManagedPolicy.fromAwsManagedPolicyName('${arn.split('/').pop()}')`).join(',\n                ') || ''}
            ],
        });
        
`;
    }
    
    private convertBatchComputeEnvironment(logicalId: string, resource: any): string {
        const props = resource.Properties;
        return `
        const ${logicalId.toLowerCase()} = new batch.ComputeEnvironment(this, '${logicalId}', {
            computeEnvironmentName: '${props.ComputeEnvironmentName}',
            managed: true,
            serviceRole: ${props.ServiceRole.Ref ? props.ServiceRole.Ref.toLowerCase() : 'undefined'},
        });
        
`;
    }
    
    private convertSecurityGroup(logicalId: string, resource: any): string {
        const props = resource.Properties;
        return `
        const ${logicalId.toLowerCase()} = new ec2.SecurityGroup(this, '${logicalId}', {
            vpc: ec2.Vpc.fromLookup(this, 'ExistingVpc', { vpcId: vpcid.valueAsString }),
            description: '${props.GroupDescription}',
            allowAllOutbound: true,
        });
        
`;
    }
}
```

#### 2.2 手動変換
```typescript
// lib/migrated-embedding-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class MigratedEmbeddingStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        
        // 既存VPCの参照
        const vpc = ec2.Vpc.fromLookup(this, 'ExistingVpc', {
            vpcId: 'vpc-existing123456789'
        });
        
        // 既存サブネットの参照
        const privateSubnets = [
            ec2.Subnet.fromSubnetId(this, 'PrivateSubnet1', 'subnet-existing111'),
            ec2.Subnet.fromSubnetId(this, 'PrivateSubnet2', 'subnet-existing222')
        ];
        
        // IAMロール作成
        const batchServiceRole = new iam.Role(this, 'BatchServiceRole', {
            assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole')
            ]
        });
        
        // セキュリティグループ作成
        const batchSecurityGroup = new ec2.SecurityGroup(this, 'BatchSecurityGroup', {
            vpc: vpc,
            description: 'Security group for Batch compute environment',
            allowAllOutbound: true
        });
        
        // Batchコンピュート環境作成
        const computeEnvironment = new batch.CfnComputeEnvironment(this, 'BatchComputeEnvironment', {
            type: 'MANAGED',
            state: 'ENABLED',
            serviceRole: batchServiceRole.roleArn,
            computeResources: {
                type: 'EC2',
                minvCpus: 0,
                maxvCpus: 100,
                desiredvCpus: 0,
                instanceTypes: ['m5.large', 'm5.xlarge'],
                subnets: privateSubnets.map(subnet => subnet.subnetId),
                securityGroupIds: [batchSecurityGroup.securityGroupId]
            }
        });
    }
}
```

### ステップ3: 段階的移行

#### 3.1 CDK Import使用
```bash
# 既存リソースをCDKにインポート
npx cdk import MigratedEmbeddingStack

# インポート対象リソース指定
# BatchServiceRole -> AWS::IAM::Role
# BatchComputeEnvironment -> AWS::Batch::ComputeEnvironment
# BatchSecurityGroup -> AWS::EC2::SecurityGroup
```

#### 3.2 新規リソースの段階的追加
```typescript
// 段階1: 既存リソースの参照のみ
const existingComputeEnv = batch.ComputeEnvironment.fromComputeEnvironmentArn(
    this, 'ExistingComputeEnv', 
    'arn:aws:batch:region:account:compute-environment/existing-env'
);

// 段階2: 新しいリソースをCDKで作成
const newJobQueue = new batch.JobQueue(this, 'NewJobQueue', {
    computeEnvironments: [
        {
            computeEnvironment: existingComputeEnv,
            order: 1
        }
    ]
});

// 段階3: 既存リソースを段階的にCDK管理に移行
```

## 🔍 移行検証・テスト

### 自動テストスイート

#### CDK単体テスト
```typescript
// test/migration.test.ts
import { Template } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import { MigratedEmbeddingStack } from '../lib/migrated-embedding-stack';

describe('Migration Tests', () => {
    test('Migrated stack creates required resources', () => {
        const app = new cdk.App();
        const stack = new MigratedEmbeddingStack(app, 'TestStack');
        
        const template = Template.fromStack(stack);
        
        // IAMロールの存在確認
        template.hasResourceProperties('AWS::IAM::Role', {
            AssumeRolePolicyDocument: {
                Statement: [{
                    Effect: 'Allow',
                    Principal: { Service: 'batch.amazonaws.com' }
                }]
            }
        });
        
        // Batchコンピュート環境の存在確認
        template.hasResourceProperties('AWS::Batch::ComputeEnvironment', {
            Type: 'MANAGED',
            State: 'ENABLED'
        });
    });
    
    test('Resource properties match original CloudFormation', () => {
        const app = new cdk.App();
        const stack = new MigratedEmbeddingStack(app, 'TestStack');
        
        const template = Template.fromStack(stack);
        
        // 元のCloudFormationテンプレートと同じプロパティを持つことを確認
        template.hasResourceProperties('AWS::Batch::ComputeEnvironment', {
            ComputeResources: {
                Type: 'EC2',
                MinvCpus: 0,
                MaxvCpus: 100
            }
        });
    });
});
```

#### 統合テスト
```bash
#!/bin/bash
# integration-test.sh

set -euo pipefail

echo "🧪 移行統合テスト開始"

# 1. CDKデプロイ
echo "📦 CDKスタックデプロイ中..."
npx cdk deploy MigratedEmbeddingStack --require-approval never

# 2. 機能テスト
echo "🔍 機能テスト実行中..."
./scripts/validate.sh --stack-name MigratedEmbeddingStack

# 3. パフォーマンステスト
echo "⚡ パフォーマンステスト実行中..."
aws batch submit-job \
    --job-name migration-test-job \
    --job-queue migrated-job-queue \
    --job-definition test-job-definition

# 4. 結果確認
echo "📊 テスト結果確認中..."
JOB_ID=$(aws batch list-jobs --job-queue migrated-job-queue --query 'jobSummary[0].jobId' --output text)
aws batch describe-jobs --jobs "$JOB_ID"

echo "✅ 統合テスト完了"
```

## 🚨 トラブルシューティング

### よくある問題と解決方法

#### 1. リソース名の競合
```bash
# 問題: 同じ名前のリソースが既に存在
# 解決: リソース名にサフィックス追加

# CloudFormationテンプレート修正
jq '.Resources | to_entries | map(.value.Properties.RoleName += "-migrated") | from_entries' template.json

# CDKコード修正
const role = new iam.Role(this, 'BatchServiceRole', {
    roleName: 'embedding-batch-service-role-migrated'
});
```

#### 2. 依存関係の問題
```typescript
// 問題: リソース間の依存関係が正しく設定されていない
// 解決: 明示的な依存関係設定

const computeEnvironment = new batch.ComputeEnvironment(this, 'ComputeEnv', {
    serviceRole: batchServiceRole // 依存関係を明示
});

// または
computeEnvironment.node.addDependency(batchServiceRole);
```

#### 3. パラメータの不一致
```bash
# 問題: CDKとCloudFormationでパラメータ形式が異なる
# 解決: パラメータマッピング作成

# mapping.json
{
    "cdk_parameter": "cloudformation_parameter",
    "vpcId": "VpcId",
    "subnetIds": "SubnetIds"
}
```

## 📊 移行後の運用

### 継続的な同期

#### 1. 設定の同期
```bash
#!/bin/bash
# sync-configurations.sh

# CDKから最新のCloudFormationテンプレート生成
npx cdk synth --output ./latest-templates/

# 差分確認
diff -u cloudformation-templates/current.json latest-templates/EmbeddingWorkloadStack.template.json

# 必要に応じてCloudFormationテンプレート更新
```

#### 2. 監視・アラート設定
```yaml
# CloudWatch Alarm for Stack Drift
StackDriftAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: !Sub '${ProjectName}-stack-drift-alarm'
    AlarmDescription: 'Alert when stack drift is detected'
    MetricName: StackDriftDetection
    Namespace: Custom/CloudFormation
    Statistic: Sum
    Period: 3600
    EvaluationPeriods: 1
    Threshold: 1
    ComparisonOperator: GreaterThanOrEqualToThreshold
```

## 📚 参考資料 / References

- [AWS CDK Migration Guide](https://docs.aws.amazon.com/cdk/v2/guide/migrating.html)
- [CloudFormation Import Operations](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resource-import.html)
- [CDK Import Resources](https://docs.aws.amazon.com/cdk/v2/guide/cli.html#cli-import)
- [Infrastructure as Code Migration Best Practices](https://aws.amazon.com/blogs/devops/migrating-to-aws-cdk/)

## 🆘 サポート / Support

移行に関する質問や問題：
Questions or issues with migration:

1. [移行ガイド](./MIGRATION_GUIDE.md)を確認
2. [CDKトラブルシューティングガイド](./CDK_TROUBLESHOOTING_GUIDE.md)を参照
3. [CloudFormationトラブルシューティングガイド](./CLOUDFORMATION_TROUBLESHOOTING_GUIDE.md)を参照
4. [GitHub Issues](https://github.com/your-repo/issues)で相談

Check the migration guide, refer to troubleshooting guides, or consult on GitHub Issues.